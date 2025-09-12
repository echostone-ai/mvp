// src/lib/services/embeddingCache.ts
// Embedding cache interface and implementations for persistent storage

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Interface for embedding cache implementations
 */
export interface EmbeddingCache {
  get(text: string): Promise<number[] | null>;
  set(text: string, embedding: number[]): Promise<void>;
  getBatch(texts: string[]): Promise<Map<string, number[]>>;
  setBatch(embeddings: Map<string, number[]>): Promise<void>;
  clear(): Promise<void>;
  size(): Promise<number>;
  getStats(): Promise<CacheStats>;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  cacheSize: number; // in bytes
  lastUpdated: number;
}

/**
 * In-memory LRU cache for embeddings
 */
export class MemoryEmbeddingCache implements EmbeddingCache {
  private cache = new Map<string, { embedding: number[]; lastAccessed: number }>();
  private maxSize: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  async get(text: string): Promise<number[] | null> {
    const key = this.hashText(text);
    const entry = this.cache.get(key);

    if (entry) {
      entry.lastAccessed = Date.now();
      this.hits++;
      return [...entry.embedding]; // Return copy to prevent mutation
    }

    this.misses++;
    return null;
  }

  async set(text: string, embedding: number[]): Promise<void> {
    const key = this.hashText(text);
    
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest();
    }

    this.cache.set(key, {
      embedding: [...embedding], // Store copy to prevent mutation
      lastAccessed: Date.now()
    });
  }

  async getBatch(texts: string[]): Promise<Map<string, number[]>> {
    const results = new Map<string, number[]>();

    for (const text of texts) {
      const embedding = await this.get(text);
      if (embedding) {
        results.set(text, embedding);
      }
    }

    return results;
  }

  async setBatch(embeddings: Map<string, number[]>): Promise<void> {
    for (const [text, embedding] of embeddings.entries()) {
      await this.set(text, embedding);
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  async getStats(): Promise<CacheStats> {
    const totalRequests = this.hits + this.misses;
    const cacheSize = this.estimateCacheSize();

    return {
      totalEntries: this.cache.size,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.misses / totalRequests : 0,
      totalHits: this.hits,
      totalMisses: this.misses,
      cacheSize,
      lastUpdated: Date.now()
    };
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private hashText(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  private estimateCacheSize(): number {
    let totalSize = 0;
    for (const [key, entry] of this.cache.entries()) {
      totalSize += key.length * 2; // UTF-16 encoding
      totalSize += entry.embedding.length * 8; // 8 bytes per float64
      totalSize += 8; // lastAccessed timestamp
    }
    return totalSize;
  }
}

/**
 * File-based persistent cache for embeddings
 */
export class FileEmbeddingCache implements EmbeddingCache {
  private cacheDir: string;
  private memoryCache: MemoryEmbeddingCache;
  private hits = 0;
  private misses = 0;

  constructor(cacheDir: string, memoryCacheSize: number = 500) {
    this.cacheDir = cacheDir;
    this.memoryCache = new MemoryEmbeddingCache(memoryCacheSize);
  }

  async get(text: string): Promise<number[] | null> {
    // Check memory cache first
    const memoryResult = await this.memoryCache.get(text);
    if (memoryResult) {
      this.hits++;
      return memoryResult;
    }

    // Check file cache
    try {
      const key = this.hashText(text);
      const filePath = this.getFilePath(key);
      
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      
      if (parsed.text === text && Array.isArray(parsed.embedding)) {
        // Store in memory cache for faster future access
        await this.memoryCache.set(text, parsed.embedding);
        this.hits++;
        return parsed.embedding;
      }

    } catch (error) {
      // File doesn't exist or is corrupted - not an error, just a cache miss
    }

    this.misses++;
    return null;
  }

  async set(text: string, embedding: number[]): Promise<void> {
    // Store in memory cache
    await this.memoryCache.set(text, embedding);

    // Store in file cache
    try {
      await this.ensureCacheDir();
      
      const key = this.hashText(text);
      const filePath = this.getFilePath(key);
      
      const data = {
        text,
        embedding,
        timestamp: Date.now()
      };

      await fs.writeFile(filePath, JSON.stringify(data), 'utf-8');

    } catch (error) {
      console.warn('file_cache_write_error', {
        error: error instanceof Error ? error.message : error,
        text_length: text.length
      });
      // Don't throw - memory cache still works
    }
  }

  async getBatch(texts: string[]): Promise<Map<string, number[]>> {
    const results = new Map<string, number[]>();

    // Check memory cache first for all texts
    const memoryResults = await this.memoryCache.getBatch(texts);
    for (const [text, embedding] of memoryResults.entries()) {
      results.set(text, embedding);
      this.hits++;
    }

    // Check file cache for remaining texts
    const remainingTexts = texts.filter(text => !results.has(text));
    
    for (const text of remainingTexts) {
      const embedding = await this.getFromFile(text);
      if (embedding) {
        results.set(text, embedding);
        // Store in memory cache for future access
        await this.memoryCache.set(text, embedding);
        this.hits++;
      } else {
        this.misses++;
      }
    }

    return results;
  }

  async setBatch(embeddings: Map<string, number[]>): Promise<void> {
    // Store in memory cache
    await this.memoryCache.setBatch(embeddings);

    // Store in file cache
    await this.ensureCacheDir();
    
    const writePromises: Promise<void>[] = [];
    
    for (const [text, embedding] of embeddings.entries()) {
      const writePromise = this.writeToFile(text, embedding);
      writePromises.push(writePromise);
    }

    // Write all files concurrently, but don't fail if some writes fail
    const results = await Promise.allSettled(writePromises);
    const failures = results.filter(result => result.status === 'rejected').length;
    
    if (failures > 0) {
      console.warn('file_cache_batch_write_partial_failure', {
        total_writes: writePromises.length,
        failures
      });
    }
  }

  async clear(): Promise<void> {
    // Clear memory cache
    await this.memoryCache.clear();

    // Clear file cache
    try {
      const files = await fs.readdir(this.cacheDir);
      const deletePromises = files
        .filter(file => file.endsWith('.json'))
        .map(file => fs.unlink(path.join(this.cacheDir, file)));
      
      await Promise.allSettled(deletePromises);
      
    } catch (error) {
      console.warn('file_cache_clear_error', {
        error: error instanceof Error ? error.message : error
      });
    }

    this.hits = 0;
    this.misses = 0;
  }

  async size(): Promise<number> {
    try {
      const files = await fs.readdir(this.cacheDir);
      return files.filter(file => file.endsWith('.json')).length;
    } catch (error) {
      return 0;
    }
  }

  async getStats(): Promise<CacheStats> {
    const memoryStats = await this.memoryCache.getStats();
    const fileCount = await this.size();
    const totalRequests = this.hits + this.misses;

    return {
      totalEntries: fileCount,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.misses / totalRequests : 0,
      totalHits: this.hits,
      totalMisses: this.misses,
      cacheSize: memoryStats.cacheSize + await this.estimateFileCacheSize(),
      lastUpdated: Date.now()
    };
  }

  private async getFromFile(text: string): Promise<number[] | null> {
    try {
      const key = this.hashText(text);
      const filePath = this.getFilePath(key);
      
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      
      if (parsed.text === text && Array.isArray(parsed.embedding)) {
        return parsed.embedding;
      }

    } catch (error) {
      // File doesn't exist or is corrupted
    }

    return null;
  }

  private async writeToFile(text: string, embedding: number[]): Promise<void> {
    const key = this.hashText(text);
    const filePath = this.getFilePath(key);
    
    const data = {
      text,
      embedding,
      timestamp: Date.now()
    };

    await fs.writeFile(filePath, JSON.stringify(data), 'utf-8');
  }

  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private getFilePath(key: string): string {
    return path.join(this.cacheDir, `${key}.json`);
  }

  private hashText(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  private async estimateFileCacheSize(): number {
    try {
      const files = await fs.readdir(this.cacheDir);
      let totalSize = 0;

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.cacheDir, file);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
        }
      }

      return totalSize;
    } catch (error) {
      return 0;
    }
  }
}

/**
 * Factory function to create appropriate cache based on configuration
 */
export function createEmbeddingCache(
  type: 'memory' | 'file',
  options: {
    maxSize?: number;
    cacheDir?: string;
    memoryCacheSize?: number;
  } = {}
): EmbeddingCache {
  switch (type) {
    case 'memory':
      return new MemoryEmbeddingCache(options.maxSize || 1000);
    
    case 'file':
      if (!options.cacheDir) {
        throw new Error('cacheDir required for file-based cache');
      }
      return new FileEmbeddingCache(options.cacheDir, options.memoryCacheSize || 500);
    
    default:
      throw new Error(`Unknown cache type: ${type}`);
  }
}