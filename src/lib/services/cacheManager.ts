// src/lib/services/cacheManager.ts
// Comprehensive caching and performance optimization for hybrid retrieval

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ExpansionResponse } from './queryExpander';
import { RetrievalResult } from './hybridRetrieval';

/**
 * Configuration for cache manager
 */
export interface CacheManagerConfig {
  // Memory cache settings
  maxMemorySize: number; // Default: 100MB
  maxMemoryEntries: number; // Default: 10000
  memoryTTL: number; // Default: 1 hour in ms
  
  // Redis settings (optional)
  redisEnabled: boolean; // Default: false
  redisUrl?: string;
  redisKeyPrefix: string; // Default: 'hybrid-retrieval:'
  redisTTL: number; // Default: 24 hours in seconds
  
  // File cache settings
  fileCacheDir: string; // Default: '.cache/hybrid-retrieval'
  maxFileCacheSize: number; // Default: 500MB
  fileCacheCleanupInterval: number; // Default: 1 hour in ms
  
  // Cache warming settings
  enableWarmup: boolean; // Default: true
  warmupQueries: string[]; // Common queries to pre-cache
  warmupOnBoot: boolean; // Default: true
  
  // Performance monitoring
  enableMetrics: boolean; // Default: true
  metricsRetentionMs: number; // Default: 24 hours
}

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  size: number; // Estimated size in bytes
  ttl?: number; // Time to live in ms
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  // Memory cache stats
  memoryEntries: number;
  memorySize: number;
  memoryHitRate: number;
  memoryMissRate: number;
  
  // File cache stats
  fileEntries: number;
  fileSize: number;
  fileHitRate: number;
  fileMissRate: number;
  
  // Redis cache stats (if enabled)
  redisEntries?: number;
  redisHitRate?: number;
  redisMissRate?: number;
  
  // Overall stats
  totalHits: number;
  totalMisses: number;
  overallHitRate: number;
  
  // Performance stats
  averageGetTimeMs: number;
  averageSetTimeMs: number;
  memoryUsageMB: number;
  
  // Cache efficiency
  evictionCount: number;
  lastCleanup: number;
  oldestEntry: number;
  newestEntry: number;
}

/**
 * Cache invalidation reasons
 */
export type InvalidationReason = 
  | 'factbook_updated' 
  | 'model_version_changed' 
  | 'manual_clear' 
  | 'ttl_expired' 
  | 'memory_pressure';

/**
 * LRU Cache implementation with TTL support
 */
class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder = new Map<string, number>(); // key -> access timestamp
  private maxSize: number;
  private maxEntries: number;
  private defaultTTL: number;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(maxSize: number, maxEntries: number, defaultTTL: number) {
    this.maxSize = maxSize;
    this.maxEntries = maxEntries;
    this.defaultTTL = defaultTTL;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }

    // Check TTL
    if (entry.ttl && Date.now() - entry.createdAt > entry.ttl) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.misses++;
      return null;
    }

    // Update access info
    entry.lastAccessed = Date.now();
    entry.accessCount++;
    this.accessOrder.set(key, entry.lastAccessed);
    
    this.hits++;
    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    const size = this.estimateSize(value);
    const now = Date.now();
    
    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: now,
      lastAccessed: now,
      accessCount: 1,
      size,
      ttl: ttl || this.defaultTTL
    };

    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
    }

    // Evict entries if necessary
    this.evictIfNecessary(size);

    // Add new entry
    this.cache.set(key, entry);
    this.accessOrder.set(key, now);
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    this.accessOrder.delete(key);
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): {
    entries: number;
    size: number;
    hitRate: number;
    missRate: number;
    evictions: number;
  } {
    const totalRequests = this.hits + this.misses;
    const totalSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);

    return {
      entries: this.cache.size,
      size: totalSize,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.misses / totalRequests : 0,
      evictions: this.evictions
    };
  }

  private evictIfNecessary(newEntrySize: number): void {
    // Check if we need to evict based on entry count
    while (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    // Check if we need to evict based on total size
    const currentSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
    while (currentSize + newEntrySize > this.maxSize && this.cache.size > 0) {
      this.evictOldest();
    }
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, timestamp] of this.accessOrder.entries()) {
      if (timestamp < oldestTime) {
        oldestTime = timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
      this.evictions++;
    }
  }

  private estimateSize(value: any): number {
    try {
      return JSON.stringify(value).length * 2; // UTF-16 encoding
    } catch {
      return 1000; // Default size estimate
    }
  }
}

/**
 * Redis cache implementation (optional)
 */
class RedisCache {
  private client: any = null; // Redis client
  private keyPrefix: string;
  private ttl: number;
  private hits = 0;
  private misses = 0;

  constructor(redisUrl: string, keyPrefix: string, ttl: number) {
    this.keyPrefix = keyPrefix;
    this.ttl = ttl;
    
    // Initialize Redis client if available
    try {
      // Note: In a real implementation, you'd import and configure Redis client
      // const Redis = require('ioredis');
      // this.client = new Redis(redisUrl);
      console.log('redis_cache_initialized', { url: redisUrl, prefix: keyPrefix, ttl });
    } catch (error) {
      console.warn('redis_cache_init_failed', { error: error instanceof Error ? error.message : error });
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) {
      this.misses++;
      return null;
    }

    try {
      const fullKey = `${this.keyPrefix}${key}`;
      const value = await this.client.get(fullKey);
      
      if (value) {
        this.hits++;
        return JSON.parse(value);
      } else {
        this.misses++;
        return null;
      }
    } catch (error) {
      console.warn('redis_get_error', { key, error: error instanceof Error ? error.message : error });
      this.misses++;
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      const fullKey = `${this.keyPrefix}${key}`;
      const serialized = JSON.stringify(value);
      const effectiveTTL = ttl || this.ttl;
      
      await this.client.setex(fullKey, effectiveTTL, serialized);
    } catch (error) {
      console.warn('redis_set_error', { key, error: error instanceof Error ? error.message : error });
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      const fullKey = `${this.keyPrefix}${key}`;
      await this.client.del(fullKey);
    } catch (error) {
      console.warn('redis_delete_error', { key, error: error instanceof Error ? error.message : error });
    }
  }

  async clear(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      const keys = await this.client.keys(`${this.keyPrefix}*`);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      this.hits = 0;
      this.misses = 0;
    } catch (error) {
      console.warn('redis_clear_error', { error: error instanceof Error ? error.message : error });
    }
  }

  getStats(): { hitRate: number; missRate: number; hits: number; misses: number } {
    const totalRequests = this.hits + this.misses;
    return {
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.misses / totalRequests : 0,
      hits: this.hits,
      misses: this.misses
    };
  }

  isConnected(): boolean {
    return this.client !== null;
  }
}

/**
 * Comprehensive cache manager for hybrid retrieval system
 */
export class CacheManager {
  private config: CacheManagerConfig;
  private memoryCache: LRUCache<any>;
  private redisCache: RedisCache | null = null;
  private fileCacheDir: string;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private metricsHistory: Array<{ timestamp: number; stats: CacheStats }> = [];
  private lastCleanup = 0;

  constructor(config: Partial<CacheManagerConfig> = {}) {
    this.config = {
      maxMemorySize: config.maxMemorySize || 100 * 1024 * 1024, // 100MB
      maxMemoryEntries: config.maxMemoryEntries || 10000,
      memoryTTL: config.memoryTTL || 60 * 60 * 1000, // 1 hour
      
      redisEnabled: config.redisEnabled || false,
      redisUrl: config.redisUrl,
      redisKeyPrefix: config.redisKeyPrefix || 'hybrid-retrieval:',
      redisTTL: config.redisTTL || 24 * 60 * 60, // 24 hours
      
      fileCacheDir: config.fileCacheDir || '.cache/hybrid-retrieval',
      maxFileCacheSize: config.maxFileCacheSize || 500 * 1024 * 1024, // 500MB
      fileCacheCleanupInterval: config.fileCacheCleanupInterval || 60 * 60 * 1000, // 1 hour
      
      enableWarmup: config.enableWarmup !== false,
      warmupQueries: config.warmupQueries || [],
      warmupOnBoot: config.warmupOnBoot !== false,
      
      enableMetrics: config.enableMetrics !== false,
      metricsRetentionMs: config.metricsRetentionMs || 24 * 60 * 60 * 1000 // 24 hours
    };

    this.fileCacheDir = this.config.fileCacheDir;

    // Initialize memory cache
    this.memoryCache = new LRUCache(
      this.config.maxMemorySize,
      this.config.maxMemoryEntries,
      this.config.memoryTTL
    );

    // Initialize Redis cache if enabled
    if (this.config.redisEnabled && this.config.redisUrl) {
      this.redisCache = new RedisCache(
        this.config.redisUrl,
        this.config.redisKeyPrefix,
        this.config.redisTTL
      );
    }

    // Start cleanup interval
    if (this.config.fileCacheCleanupInterval > 0) {
      this.cleanupInterval = setInterval(
        () => this.performCleanup(),
        this.config.fileCacheCleanupInterval
      );
    }

    console.log('cache_manager_initialized', {
      memory_max_size_mb: Math.round(this.config.maxMemorySize / 1024 / 1024),
      memory_max_entries: this.config.maxMemoryEntries,
      redis_enabled: this.config.redisEnabled,
      file_cache_dir: this.fileCacheDir,
      warmup_enabled: this.config.enableWarmup
    });
  }

  /**
   * Get value from cache with multi-level lookup
   * Order: Memory -> Redis -> File -> null
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    const hashedKey = this.hashKey(key);

    try {
      // Level 1: Memory cache
      const memoryResult = this.memoryCache.get(hashedKey);
      if (memoryResult !== null) {
        this.recordMetric('get', Date.now() - startTime, 'memory_hit');
        return memoryResult;
      }

      // Level 2: Redis cache (if enabled)
      if (this.redisCache) {
        const redisResult = await this.redisCache.get<T>(hashedKey);
        if (redisResult !== null) {
          // Store in memory cache for faster future access
          this.memoryCache.set(hashedKey, redisResult);
          this.recordMetric('get', Date.now() - startTime, 'redis_hit');
          return redisResult;
        }
      }

      // Level 3: File cache
      const fileResult = await this.getFromFile<T>(hashedKey);
      if (fileResult !== null) {
        // Store in memory and Redis for faster future access
        this.memoryCache.set(hashedKey, fileResult);
        if (this.redisCache) {
          await this.redisCache.set(hashedKey, fileResult);
        }
        this.recordMetric('get', Date.now() - startTime, 'file_hit');
        return fileResult;
      }

      // Cache miss
      this.recordMetric('get', Date.now() - startTime, 'miss');
      return null;

    } catch (error) {
      console.warn('cache_get_error', {
        key: hashedKey,
        error: error instanceof Error ? error.message : error
      });
      this.recordMetric('get', Date.now() - startTime, 'error');
      return null;
    }
  }

  /**
   * Set value in cache with multi-level storage
   * Stores in: Memory + Redis + File (async)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const startTime = Date.now();
    const hashedKey = this.hashKey(key);

    try {
      // Store in memory cache immediately
      this.memoryCache.set(hashedKey, value, ttl);

      // Store in Redis (async, don't wait)
      if (this.redisCache) {
        this.redisCache.set(hashedKey, value, ttl ? Math.floor(ttl / 1000) : undefined)
          .catch(error => {
            console.warn('redis_set_async_error', {
              key: hashedKey,
              error: error instanceof Error ? error.message : error
            });
          });
      }

      // Store in file cache (async, don't wait)
      this.setToFile(hashedKey, value, ttl)
        .catch(error => {
          console.warn('file_set_async_error', {
            key: hashedKey,
            error: error instanceof Error ? error.message : error
          });
        });

      this.recordMetric('set', Date.now() - startTime, 'success');

    } catch (error) {
      console.warn('cache_set_error', {
        key: hashedKey,
        error: error instanceof Error ? error.message : error
      });
      this.recordMetric('set', Date.now() - startTime, 'error');
    }
  }

  /**
   * Delete value from all cache levels
   */
  async delete(key: string): Promise<void> {
    const hashedKey = this.hashKey(key);

    try {
      // Delete from memory
      this.memoryCache.delete(hashedKey);

      // Delete from Redis
      if (this.redisCache) {
        await this.redisCache.delete(hashedKey);
      }

      // Delete from file cache
      await this.deleteFromFile(hashedKey);

    } catch (error) {
      console.warn('cache_delete_error', {
        key: hashedKey,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Clear all caches
   */
  async clear(reason: InvalidationReason = 'manual_clear'): Promise<void> {
    console.log('cache_clear_start', { reason });

    try {
      // Clear memory cache
      this.memoryCache.clear();

      // Clear Redis cache
      if (this.redisCache) {
        await this.redisCache.clear();
      }

      // Clear file cache
      await this.clearFileCache();

      console.log('cache_clear_complete', { reason });

    } catch (error) {
      console.error('cache_clear_error', {
        reason,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Warm cache with common queries
   */
  async warmCache(queries: string[] = this.config.warmupQueries): Promise<void> {
    if (!this.config.enableWarmup || queries.length === 0) {
      return;
    }

    console.log('cache_warmup_start', { query_count: queries.length });
    const startTime = Date.now();

    try {
      // Pre-generate embeddings for common queries
      const warmupPromises = queries.map(async (query) => {
        try {
          // This would typically involve calling the embedding service
          // For now, we'll just ensure the query is in the cache structure
          const hashedKey = this.hashKey(`embedding:${query}`);
          
          // Check if already cached
          const existing = await this.get(hashedKey);
          if (!existing) {
            // In a real implementation, you'd generate the embedding here
            // await this.set(hashedKey, embedding, this.config.memoryTTL);
            console.log('cache_warmup_query', { query, key: hashedKey });
          }
        } catch (error) {
          console.warn('cache_warmup_query_error', {
            query,
            error: error instanceof Error ? error.message : error
          });
        }
      });

      await Promise.allSettled(warmupPromises);

      const elapsedMs = Date.now() - startTime;
      console.log('cache_warmup_complete', {
        query_count: queries.length,
        time_ms: elapsedMs
      });

    } catch (error) {
      console.error('cache_warmup_error', {
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const memoryStats = this.memoryCache.getStats();
    const redisStats = this.redisCache?.getStats() || { hitRate: 0, missRate: 0, hits: 0, misses: 0 };
    const fileStats = await this.getFileCacheStats();

    const totalHits = memoryStats.entries > 0 ? 
      (memoryStats.hitRate * (memoryStats.entries + 1)) : 0;
    const totalMisses = memoryStats.entries > 0 ? 
      (memoryStats.missRate * (memoryStats.entries + 1)) : 0;
    const totalRequests = totalHits + totalMisses;

    const stats: CacheStats = {
      // Memory cache stats
      memoryEntries: memoryStats.entries,
      memorySize: memoryStats.size,
      memoryHitRate: memoryStats.hitRate,
      memoryMissRate: memoryStats.missRate,

      // File cache stats
      fileEntries: fileStats.entries,
      fileSize: fileStats.size,
      fileHitRate: fileStats.hitRate,
      fileMissRate: fileStats.missRate,

      // Redis cache stats
      redisEntries: this.redisCache ? undefined : undefined,
      redisHitRate: this.redisCache ? redisStats.hitRate : undefined,
      redisMissRate: this.redisCache ? redisStats.missRate : undefined,

      // Overall stats
      totalHits: totalHits + redisStats.hits,
      totalMisses: totalMisses + redisStats.misses,
      overallHitRate: totalRequests > 0 ? (totalHits + redisStats.hits) / totalRequests : 0,

      // Performance stats
      averageGetTimeMs: this.calculateAverageMetric('get'),
      averageSetTimeMs: this.calculateAverageMetric('set'),
      memoryUsageMB: Math.round(memoryStats.size / 1024 / 1024),

      // Cache efficiency
      evictionCount: memoryStats.evictions,
      lastCleanup: this.lastCleanup,
      oldestEntry: fileStats.oldestEntry,
      newestEntry: fileStats.newestEntry
    };

    // Store stats for historical tracking
    if (this.config.enableMetrics) {
      this.metricsHistory.push({
        timestamp: Date.now(),
        stats
      });

      // Clean old metrics
      const cutoff = Date.now() - this.config.metricsRetentionMs;
      this.metricsHistory = this.metricsHistory.filter(m => m.timestamp > cutoff);
    }

    return stats;
  }

  /**
   * Invalidate cache when factbook content changes
   */
  async invalidateOnFactbookChange(factbookVersion: string): Promise<void> {
    console.log('cache_invalidation_factbook_change', { version: factbookVersion });
    
    // Clear all caches since factbook content affects all results
    await this.clear('factbook_updated');
    
    // Re-warm cache if enabled
    if (this.config.enableWarmup && this.config.warmupOnBoot) {
      await this.warmCache();
    }
  }

  /**
   * Invalidate cache when model versions change
   */
  async invalidateOnModelChange(modelVersion: string): Promise<void> {
    console.log('cache_invalidation_model_change', { version: modelVersion });
    
    // Clear embedding and expansion caches specifically
    await this.clearByPrefix('embedding:');
    await this.clearByPrefix('expansion:');
    
    // Re-warm cache if enabled
    if (this.config.enableWarmup && this.config.warmupOnBoot) {
      await this.warmCache();
    }
  }

  /**
   * Monitor memory usage and trigger cleanup if needed
   */
  getMemoryUsage(): { usedMB: number; maxMB: number; utilizationPercent: number } {
    const memoryStats = this.memoryCache.getStats();
    const usedMB = Math.round(memoryStats.size / 1024 / 1024);
    const maxMB = Math.round(this.config.maxMemorySize / 1024 / 1024);
    const utilizationPercent = (memoryStats.size / this.config.maxMemorySize) * 100;

    return { usedMB, maxMB, utilizationPercent };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.memoryCache.clear();
    console.log('cache_manager_destroyed');
  }

  // Private helper methods

  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex').substring(0, 16);
  }

  private async getFromFile<T>(hashedKey: string): Promise<T | null> {
    try {
      const filePath = path.join(this.fileCacheDir, `${hashedKey}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Check TTL
      if (parsed.ttl && Date.now() - parsed.createdAt > parsed.ttl) {
        await fs.unlink(filePath).catch(() => {}); // Clean up expired file
        return null;
      }

      return parsed.value;
    } catch (error) {
      return null; // File doesn't exist or is corrupted
    }
  }

  private async setToFile<T>(hashedKey: string, value: T, ttl?: number): Promise<void> {
    try {
      await fs.mkdir(this.fileCacheDir, { recursive: true });
      
      const filePath = path.join(this.fileCacheDir, `${hashedKey}.json`);
      const data = {
        value,
        createdAt: Date.now(),
        ttl
      };

      await fs.writeFile(filePath, JSON.stringify(data), 'utf-8');
    } catch (error) {
      // Don't throw - file cache is optional
    }
  }

  private async deleteFromFile(hashedKey: string): Promise<void> {
    try {
      const filePath = path.join(this.fileCacheDir, `${hashedKey}.json`);
      await fs.unlink(filePath);
    } catch (error) {
      // File might not exist - that's fine
    }
  }

  private async clearFileCache(): Promise<void> {
    try {
      const files = await fs.readdir(this.fileCacheDir);
      const deletePromises = files
        .filter(file => file.endsWith('.json'))
        .map(file => fs.unlink(path.join(this.fileCacheDir, file)));
      
      await Promise.allSettled(deletePromises);
    } catch (error) {
      // Directory might not exist - that's fine
    }
  }

  private async clearByPrefix(prefix: string): Promise<void> {
    // This is a simplified implementation
    // In a real system, you'd need to track keys by prefix
    console.log('cache_clear_by_prefix', { prefix });
  }

  private async getFileCacheStats(): Promise<{
    entries: number;
    size: number;
    hitRate: number;
    fileMissRate: number;
    oldestEntry: number;
    newestEntry: number;
  }> {
    try {
      const files = await fs.readdir(this.fileCacheDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      let totalSize = 0;
      let oldestEntry = Date.now();
      let newestEntry = 0;

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.fileCacheDir, file);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
          
          if (stats.mtime.getTime() < oldestEntry) {
            oldestEntry = stats.mtime.getTime();
          }
          if (stats.mtime.getTime() > newestEntry) {
            newestEntry = stats.mtime.getTime();
          }
        } catch (error) {
          // Skip corrupted files
        }
      }

      return {
        entries: jsonFiles.length,
        size: totalSize,
        hitRate: 0, // Would need to track this separately
        fileMissRate: 0, // Would need to track this separately
        oldestEntry,
        newestEntry
      };
    } catch (error) {
      return {
        entries: 0,
        size: 0,
        hitRate: 0,
        fileMissRate: 0,
        oldestEntry: 0,
        newestEntry: 0
      };
    }
  }

  private async performCleanup(): Promise<void> {
    console.log('cache_cleanup_start');
    const startTime = Date.now();

    try {
      // Clean up expired file cache entries
      const files = await fs.readdir(this.fileCacheDir);
      let cleanedCount = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const filePath = path.join(this.fileCacheDir, file);
          const data = await fs.readFile(filePath, 'utf-8');
          const parsed = JSON.parse(data);

          // Check if expired
          if (parsed.ttl && Date.now() - parsed.createdAt > parsed.ttl) {
            await fs.unlink(filePath);
            cleanedCount++;
          }
        } catch (error) {
          // Remove corrupted files
          try {
            await fs.unlink(path.join(this.fileCacheDir, file));
            cleanedCount++;
          } catch (unlinkError) {
            // Ignore unlink errors
          }
        }
      }

      this.lastCleanup = Date.now();
      const elapsedMs = Date.now() - startTime;

      console.log('cache_cleanup_complete', {
        cleaned_files: cleanedCount,
        time_ms: elapsedMs
      });

    } catch (error) {
      console.warn('cache_cleanup_error', {
        error: error instanceof Error ? error.message : error
      });
    }
  }

  private recordMetric(operation: string, timeMs: number, result: string): void {
    if (!this.config.enableMetrics) return;

    // In a real implementation, you'd store these metrics for analysis
    console.log('cache_metric', {
      operation,
      time_ms: timeMs,
      result
    });
  }

  private calculateAverageMetric(operation: string): number {
    // In a real implementation, you'd calculate this from stored metrics
    return 0;
  }
}

/**
 * Factory function to create cache manager with environment-based config
 */
export function createCacheManager(): CacheManager {
  const config: Partial<CacheManagerConfig> = {
    maxMemorySize: parseInt(process.env.CACHE_MAX_MEMORY_MB || '100') * 1024 * 1024,
    maxMemoryEntries: parseInt(process.env.CACHE_MAX_ENTRIES || '10000'),
    memoryTTL: parseInt(process.env.CACHE_MEMORY_TTL_HOURS || '1') * 60 * 60 * 1000,
    
    redisEnabled: process.env.CACHE_REDIS_ENABLED?.toLowerCase() === 'true',
    redisUrl: process.env.CACHE_REDIS_URL,
    redisKeyPrefix: process.env.CACHE_REDIS_PREFIX || 'hybrid-retrieval:',
    redisTTL: parseInt(process.env.CACHE_REDIS_TTL_HOURS || '24') * 60 * 60,
    
    fileCacheDir: process.env.CACHE_FILE_DIR || '.cache/hybrid-retrieval',
    maxFileCacheSize: parseInt(process.env.CACHE_MAX_FILE_MB || '500') * 1024 * 1024,
    
    enableWarmup: process.env.CACHE_WARMUP_ENABLED?.toLowerCase() !== 'false',
    warmupQueries: process.env.CACHE_WARMUP_QUERIES?.split(',') || [
      'where did you grow up',
      'tell me about your brother',
      'what happened with the snake',
      'who is tyler',
      'tell me about olive',
      'what about george'
    ],
    
    enableMetrics: process.env.CACHE_METRICS_ENABLED?.toLowerCase() !== 'false'
  };

  return new CacheManager(config);
}