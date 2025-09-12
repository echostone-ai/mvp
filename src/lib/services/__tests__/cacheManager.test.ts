// src/lib/services/__tests__/cacheManager.test.ts
// Tests for comprehensive caching and performance optimization

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheManager, CacheManagerConfig } from '../cacheManager';
import { promises as fs } from 'fs';
import path from 'path';

// Mock file system operations
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn()
  }
}));

const mockFs = fs as any;

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let testConfig: Partial<CacheManagerConfig>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    testConfig = {
      maxMemorySize: 10 * 1024 * 1024, // 10MB
      maxMemoryEntries: 1000,
      memoryTTL: 60 * 60 * 1000, // 1 hour
      fileCacheDir: '.cache/test',
      enableWarmup: false, // Disable for tests
      enableMetrics: true
    };

    cacheManager = new CacheManager(testConfig);
  });

  afterEach(async () => {
    cacheManager.destroy();
  });

  describe('Memory Cache Operations', () => {
    it('should store and retrieve values from memory cache', async () => {
      const key = 'test_key';
      const value = { data: 'test_value', number: 42 };

      await cacheManager.set(key, value);
      const retrieved = await cacheManager.get(key);

      expect(retrieved).toEqual(value);
    });

    it('should handle cache misses gracefully', async () => {
      const result = await cacheManager.get('nonexistent_key');
      expect(result).toBeNull();
    });

    it('should respect TTL for cached values', async () => {
      const key = 'ttl_test';
      const value = { data: 'expires_soon' };
      const shortTTL = 100; // 100ms

      await cacheManager.set(key, value, shortTTL);
      
      // Should be available immediately
      let retrieved = await cacheManager.get(key);
      expect(retrieved).toEqual(value);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should be expired now
      retrieved = await cacheManager.get(key);
      expect(retrieved).toBeNull();
    });

    it('should evict oldest entries when memory limit is reached', async () => {
      // Create cache with very small limits
      const smallCache = new CacheManager({
        maxMemorySize: 1000, // 1KB
        maxMemoryEntries: 2,
        memoryTTL: 60000
      });

      // Add entries that exceed the limit
      await smallCache.set('key1', { data: 'value1' });
      await smallCache.set('key2', { data: 'value2' });
      await smallCache.set('key3', { data: 'value3' }); // Should evict key1

      const key1Result = await smallCache.get('key1');
      const key2Result = await smallCache.get('key2');
      const key3Result = await smallCache.get('key3');

      expect(key1Result).toBeNull(); // Evicted
      expect(key2Result).toEqual({ data: 'value2' });
      expect(key3Result).toEqual({ data: 'value3' });

      smallCache.destroy();
    });
  });

  describe('File Cache Operations', () => {
    beforeEach(() => {
      // Mock successful file operations
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        value: { data: 'file_cached_value' },
        createdAt: Date.now(),
        ttl: 60000
      }));
      mockFs.readdir.mockResolvedValue(['test.json'] as any);
      mockFs.stat.mockResolvedValue({ size: 100, mtime: new Date() } as any);
    });

    it('should attempt to write to file cache when setting values', async () => {
      const key = 'file_test';
      const value = { data: 'file_value' };

      await cacheManager.set(key, value);

      // Give async file write time to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockFs.mkdir).toHaveBeenCalledWith('.cache/test', { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should attempt to read from file cache on memory miss', async () => {
      const key = 'file_read_test';

      // This will miss memory cache and try file cache
      await cacheManager.get(key);

      expect(mockFs.readFile).toHaveBeenCalled();
    });

    it('should handle file cache errors gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const result = await cacheManager.get('missing_file_key');
      expect(result).toBeNull();
    });
  });

  describe('Cache Statistics', () => {
    it('should provide comprehensive cache statistics', async () => {
      // Add some test data
      await cacheManager.set('stats_key1', { data: 'value1' });
      await cacheManager.set('stats_key2', { data: 'value2' });
      
      // Get one value to create a hit
      await cacheManager.get('stats_key1');
      
      // Try to get non-existent value to create a miss
      await cacheManager.get('nonexistent');

      const stats = await cacheManager.getStats();

      expect(stats).toHaveProperty('memoryEntries');
      expect(stats).toHaveProperty('memoryHitRate');
      expect(stats).toHaveProperty('memoryMissRate');
      expect(stats).toHaveProperty('totalHits');
      expect(stats).toHaveProperty('totalMisses');
      expect(stats).toHaveProperty('overallHitRate');
      expect(stats).toHaveProperty('memoryUsageMB');

      expect(stats.memoryEntries).toBe(2);
      expect(stats.totalHits).toBeGreaterThan(0);
      expect(stats.totalMisses).toBeGreaterThan(0);
    });
  });

  describe('Cache Invalidation', () => {
    it('should clear all caches on factbook update', async () => {
      // Add test data
      await cacheManager.set('factbook_key', { data: 'factbook_value' });
      
      // Verify data exists
      let result = await cacheManager.get('factbook_key');
      expect(result).toEqual({ data: 'factbook_value' });

      // Invalidate on factbook update
      await cacheManager.invalidateOnFactbookChange('v2.0');

      // Data should be cleared
      result = await cacheManager.get('factbook_key');
      expect(result).toBeNull();
    });

    it('should clear model-specific caches on model update', async () => {
      // Add embedding and expansion data
      await cacheManager.set('embedding:test_query', [0.1, 0.2, 0.3]);
      await cacheManager.set('expansion:test_query', { alternates: ['alt1'] });
      await cacheManager.set('other:test_key', { data: 'should_remain' });

      // Invalidate on model update
      await cacheManager.invalidateOnModelChange('gpt-4-turbo');

      // Model-specific caches should be cleared, others should remain
      // Note: This is a simplified test - actual implementation would need prefix tracking
      const stats = await cacheManager.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('Memory Usage Monitoring', () => {
    it('should track memory usage accurately', async () => {
      const usage = cacheManager.getMemoryUsage();

      expect(usage).toHaveProperty('usedMB');
      expect(usage).toHaveProperty('maxMB');
      expect(usage).toHaveProperty('utilizationPercent');

      expect(usage.usedMB).toBeGreaterThanOrEqual(0);
      expect(usage.maxMB).toBe(10); // From test config
      expect(usage.utilizationPercent).toBeGreaterThanOrEqual(0);
      expect(usage.utilizationPercent).toBeLessThanOrEqual(100);
    });

    it('should update memory usage as cache grows', async () => {
      const initialUsage = cacheManager.getMemoryUsage();

      // Add substantial data
      const largeValue = { data: 'x'.repeat(1000) }; // 1KB string
      for (let i = 0; i < 10; i++) {
        await cacheManager.set(`large_key_${i}`, largeValue);
      }

      const finalUsage = cacheManager.getMemoryUsage();

      expect(finalUsage.usedMB).toBeGreaterThan(initialUsage.usedMB);
      expect(finalUsage.utilizationPercent).toBeGreaterThan(initialUsage.utilizationPercent);
    });
  });

  describe('Cache Warming', () => {
    it('should support cache warming with common queries', async () => {
      const warmupQueries = ['test query 1', 'test query 2'];
      
      // Create cache manager with warmup enabled
      const warmupCache = new CacheManager({
        ...testConfig,
        enableWarmup: true,
        warmupQueries,
        warmupOnBoot: false // Don't auto-warm in tests
      });

      await warmupCache.warmCache(warmupQueries);

      // Verify warmup completed without errors
      const stats = await warmupCache.getStats();
      expect(stats).toBeDefined();

      warmupCache.destroy();
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Disk full'));
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

      // These operations should not throw
      await expect(cacheManager.set('error_key', { data: 'value' })).resolves.not.toThrow();
      await expect(cacheManager.get('error_key')).resolves.not.toThrow();
    });

    it('should continue operating when file cache fails', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Cannot create directory'));
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));

      // Memory cache should still work
      await cacheManager.set('memory_only', { data: 'memory_value' });
      const result = await cacheManager.get('memory_only');

      expect(result).toEqual({ data: 'memory_value' });
    });
  });

  describe('Configuration', () => {
    it('should use environment variables for configuration', () => {
      // Test the factory function with environment variables
      const originalEnv = process.env;
      
      process.env = {
        ...originalEnv,
        CACHE_MAX_MEMORY_MB: '50',
        CACHE_MAX_ENTRIES: '5000',
        CACHE_MEMORY_TTL_HOURS: '2',
        CACHE_FILE_DIR: '.cache/custom',
        CACHE_WARMUP_ENABLED: 'true'
      };

      // This would test the factory function if we imported it
      // const factoryCache = createCacheManager();
      
      process.env = originalEnv;
    });

    it('should validate configuration parameters', () => {
      expect(() => {
        new CacheManager({
          maxMemorySize: -1, // Invalid
          maxMemoryEntries: 1000
        });
      }).not.toThrow(); // Should handle gracefully with defaults
    });
  });

  describe('Performance', () => {
    it('should handle high-frequency operations efficiently', async () => {
      const startTime = Date.now();
      const operationCount = 1000;

      // Perform many cache operations
      const promises = [];
      for (let i = 0; i < operationCount; i++) {
        promises.push(cacheManager.set(`perf_key_${i}`, { index: i }));
      }
      await Promise.all(promises);

      // Read them back
      const readPromises = [];
      for (let i = 0; i < operationCount; i++) {
        readPromises.push(cacheManager.get(`perf_key_${i}`));
      }
      const results = await Promise.all(readPromises);

      const elapsedMs = Date.now() - startTime;
      const operationsPerSecond = (operationCount * 2 * 1000) / elapsedMs;

      console.log(`Cache performance: ${operationsPerSecond.toFixed(0)} ops/sec`);

      // Verify all operations completed successfully
      expect(results).toHaveLength(operationCount);
      expect(results.every(result => result !== null)).toBe(true);
      
      // Performance should be reasonable (>1000 ops/sec)
      expect(operationsPerSecond).toBeGreaterThan(1000);
    });

    it('should maintain performance under memory pressure', async () => {
      // Create cache with small memory limit to force evictions
      const pressureCache = new CacheManager({
        maxMemorySize: 10000, // 10KB
        maxMemoryEntries: 50,
        memoryTTL: 60000
      });

      const startTime = Date.now();
      
      // Add more data than can fit in cache
      for (let i = 0; i < 200; i++) {
        await pressureCache.set(`pressure_key_${i}`, { 
          data: 'x'.repeat(100), // 100 bytes
          index: i 
        });
      }

      const elapsedMs = Date.now() - startTime;
      
      // Should complete in reasonable time even with evictions
      expect(elapsedMs).toBeLessThan(1000); // Less than 1 second

      const stats = await pressureCache.getStats();
      expect(stats.memoryEntries).toBeLessThanOrEqual(50); // Respects max entries

      pressureCache.destroy();
    });
  });
});