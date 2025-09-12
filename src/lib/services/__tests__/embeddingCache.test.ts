// src/lib/services/__tests__/embeddingCache.test.ts
// Tests for embedding cache implementations

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { MemoryEmbeddingCache, FileEmbeddingCache, createEmbeddingCache } from '../embeddingCache';

// Mock fs for file cache tests
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
    mkdir: vi.fn(),
    unlink: vi.fn(),
    stat: vi.fn()
  }
}));

describe('MemoryEmbeddingCache', () => {
  let cache: MemoryEmbeddingCache;

  beforeEach(() => {
    cache = new MemoryEmbeddingCache(3); // Small cache for testing eviction
  });

  describe('basic operations', () => {
    it('should store and retrieve embeddings', async () => {
      const embedding = [0.1, 0.2, 0.3];
      
      await cache.set('test text', embedding);
      const result = await cache.get('test text');
      
      expect(result).toEqual(embedding);
      expect(result).not.toBe(embedding); // Should return a copy
    });

    it('should return null for non-existent keys', async () => {
      const result = await cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should handle batch operations', async () => {
      const embeddings = new Map([
        ['text1', [0.1, 0.2]],
        ['text2', [0.3, 0.4]],
        ['text3', [0.5, 0.6]]
      ]);

      await cache.setBatch(embeddings);
      
      const results = await cache.getBatch(['text1', 'text2', 'text3', 'text4']);
      
      expect(results.size).toBe(3);
      expect(results.get('text1')).toEqual([0.1, 0.2]);
      expect(results.get('text2')).toEqual([0.3, 0.4]);
      expect(results.get('text3')).toEqual([0.5, 0.6]);
      expect(results.has('text4')).toBe(false);
    });

    it('should clear all entries', async () => {
      await cache.set('text1', [0.1, 0.2]);
      await cache.set('text2', [0.3, 0.4]);
      
      expect(await cache.size()).toBe(2);
      
      await cache.clear();
      
      expect(await cache.size()).toBe(0);
      expect(await cache.get('text1')).toBeNull();
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entries when at capacity', async () => {
      // Fill cache to capacity
      await cache.set('text1', [0.1]);
      await cache.set('text2', [0.2]);
      await cache.set('text3', [0.3]);
      
      expect(await cache.size()).toBe(3);
      
      // Access text1 to make it recently used
      await cache.get('text1');
      
      // Add new entry, should evict text2 (oldest unused)
      await cache.set('text4', [0.4]);
      
      expect(await cache.size()).toBe(3);
      expect(await cache.get('text1')).toEqual([0.1]); // Still there
      expect(await cache.get('text2')).toBeNull(); // Evicted
      expect(await cache.get('text3')).toEqual([0.3]); // Still there
      expect(await cache.get('text4')).toEqual([0.4]); // New entry
    });

    it('should update access time on get', async () => {
      await cache.set('text1', [0.1]);
      await cache.set('text2', [0.2]);
      await cache.set('text3', [0.3]);
      
      // Access text1 to make it recently used
      await cache.get('text1');
      
      // Add two more entries to force eviction
      await cache.set('text4', [0.4]);
      await cache.set('text5', [0.5]);
      
      // text1 should still be there due to recent access
      expect(await cache.get('text1')).toEqual([0.1]);
      // text2 and text3 should be evicted
      expect(await cache.get('text2')).toBeNull();
      expect(await cache.get('text3')).toBeNull();
    });
  });

  describe('statistics', () => {
    it('should track hit and miss rates', async () => {
      await cache.set('text1', [0.1]);
      
      // 2 hits
      await cache.get('text1');
      await cache.get('text1');
      
      // 3 misses
      await cache.get('text2');
      await cache.get('text3');
      await cache.get('text4');
      
      const stats = await cache.getStats();
      
      expect(stats.totalHits).toBe(2);
      expect(stats.totalMisses).toBe(3);
      expect(stats.hitRate).toBeCloseTo(0.4); // 2/5
      expect(stats.missRate).toBeCloseTo(0.6); // 3/5
      expect(stats.totalEntries).toBe(1);
    });

    it('should reset stats on clear', async () => {
      await cache.set('text1', [0.1]);
      await cache.get('text1'); // Hit
      await cache.get('text2'); // Miss
      
      await cache.clear();
      
      const stats = await cache.getStats();
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);
      expect(stats.totalEntries).toBe(0);
    });
  });
});

describe('FileEmbeddingCache', () => {
  let cache: FileEmbeddingCache;
  const testCacheDir = '/test/cache';

  beforeEach(() => {
    cache = new FileEmbeddingCache(testCacheDir, 2); // Small memory cache
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('basic operations', () => {
    it('should store and retrieve from memory cache first', async () => {
      const embedding = [0.1, 0.2, 0.3];
      
      await cache.set('test text', embedding);
      const result = await cache.get('test text');
      
      expect(result).toEqual(embedding);
      // Should not read from file since it's in memory cache
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it('should fall back to file cache on memory miss', async () => {
      const embedding = [0.1, 0.2, 0.3];
      const fileData = JSON.stringify({
        text: 'test text',
        embedding,
        timestamp: Date.now()
      });

      (fs.readFile as any).mockResolvedValue(fileData);
      
      const result = await cache.get('test text');
      
      expect(result).toEqual(embedding);
      expect(fs.readFile).toHaveBeenCalled();
    });

    it('should handle file read errors gracefully', async () => {
      (fs.readFile as any).mockRejectedValue(new Error('File not found'));
      
      const result = await cache.get('test text');
      
      expect(result).toBeNull();
      expect(fs.readFile).toHaveBeenCalled();
    });

    it('should write to both memory and file cache', async () => {
      const embedding = [0.1, 0.2, 0.3];
      
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);
      
      await cache.set('test text', embedding);
      
      expect(fs.mkdir).toHaveBeenCalledWith(testCacheDir, { recursive: true });
      expect(fs.writeFile).toHaveBeenCalled();
      
      // Should be in memory cache
      const result = await cache.get('test text');
      expect(result).toEqual(embedding);
    });

    it('should continue working if file write fails', async () => {
      const embedding = [0.1, 0.2, 0.3];
      
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockRejectedValue(new Error('Write failed'));
      
      // Should not throw
      await expect(cache.set('test text', embedding)).resolves.toBeUndefined();
      
      // Should still be in memory cache
      const result = await cache.get('test text');
      expect(result).toEqual(embedding);
    });
  });

  describe('batch operations', () => {
    it('should handle batch get with mixed memory/file results', async () => {
      const embedding1 = [0.1, 0.2];
      const embedding2 = [0.3, 0.4];
      
      // Set one in memory cache
      await cache.set('text1', embedding1);
      
      // Mock file read for second text
      const fileData = JSON.stringify({
        text: 'text2',
        embedding: embedding2,
        timestamp: Date.now()
      });
      (fs.readFile as any).mockResolvedValue(fileData);
      
      const results = await cache.getBatch(['text1', 'text2', 'text3']);
      
      expect(results.size).toBe(2);
      expect(results.get('text1')).toEqual(embedding1);
      expect(results.get('text2')).toEqual(embedding2);
      expect(results.has('text3')).toBe(false);
    });

    it('should handle batch set with concurrent file writes', async () => {
      const embeddings = new Map([
        ['text1', [0.1, 0.2]],
        ['text2', [0.3, 0.4]]
      ]);

      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);
      
      await cache.setBatch(embeddings);
      
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('clear operation', () => {
    it('should clear both memory and file cache', async () => {
      (fs.readdir as any).mockResolvedValue(['file1.json', 'file2.json', 'other.txt']);
      (fs.unlink as any).mockResolvedValue(undefined);
      
      await cache.clear();
      
      expect(fs.readdir).toHaveBeenCalledWith(testCacheDir);
      expect(fs.unlink).toHaveBeenCalledTimes(2); // Only .json files
    });

    it('should handle clear errors gracefully', async () => {
      (fs.readdir as any).mockRejectedValue(new Error('Directory not found'));
      
      // Should not throw
      await expect(cache.clear()).resolves.toBeUndefined();
    });
  });

  describe('size and stats', () => {
    it('should count file cache entries', async () => {
      (fs.readdir as any).mockResolvedValue(['file1.json', 'file2.json', 'other.txt']);
      
      const size = await cache.size();
      
      expect(size).toBe(2); // Only .json files
    });

    it('should handle readdir errors in size calculation', async () => {
      (fs.readdir as any).mockRejectedValue(new Error('Directory not found'));
      
      const size = await cache.size();
      
      expect(size).toBe(0);
    });

    it('should estimate file cache size', async () => {
      (fs.readdir as any).mockResolvedValue(['file1.json', 'file2.json']);
      (fs.stat as any).mockResolvedValue({ size: 1000 });
      
      const stats = await cache.getStats();
      
      expect(stats.cacheSize).toBeGreaterThan(2000); // 2 files * 1000 bytes + memory cache
    });
  });
});

describe('createEmbeddingCache', () => {
  it('should create memory cache', () => {
    const cache = createEmbeddingCache('memory', { maxSize: 500 });
    expect(cache).toBeInstanceOf(MemoryEmbeddingCache);
  });

  it('should create file cache', () => {
    const cache = createEmbeddingCache('file', { 
      cacheDir: '/test/cache',
      memoryCacheSize: 100 
    });
    expect(cache).toBeInstanceOf(FileEmbeddingCache);
  });

  it('should throw error for file cache without cacheDir', () => {
    expect(() => createEmbeddingCache('file')).toThrow('cacheDir required');
  });

  it('should throw error for unknown cache type', () => {
    expect(() => createEmbeddingCache('unknown' as any)).toThrow('Unknown cache type');
  });
});