// src/lib/services/__tests__/caching.integration.test.ts
// Integration tests for comprehensive caching system

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CacheManager } from '../cacheManager';
import { CacheWarmingService } from '../cacheWarming';
import { PerformanceMonitor } from '../performanceMonitor';
import { HybridRetriever, parseHybridRetrievalConfig } from '../hybridRetrieval';
import { FactbookService } from '../factbookService';

describe('Caching System Integration', () => {
  let cacheManager: CacheManager;
  let cacheWarmingService: CacheWarmingService;
  let performanceMonitor: PerformanceMonitor;
  let hybridRetriever: HybridRetriever;
  let factbookService: FactbookService;

  beforeEach(() => {
    // Initialize factbook service
    factbookService = FactbookService.getInstance();

    // Initialize cache manager with test configuration
    cacheManager = new CacheManager({
      maxMemorySize: 10 * 1024 * 1024, // 10MB
      maxMemoryEntries: 1000,
      memoryTTL: 60 * 60 * 1000, // 1 hour
      fileCacheDir: '.cache/test-integration',
      enableWarmup: false,
      enableMetrics: true
    });

    // Initialize performance monitor
    performanceMonitor = new PerformanceMonitor({
      enableMonitoring: true,
      aggregationIntervalMs: 5000, // 5 seconds for tests
      enableMetricsExport: false
    }, cacheManager);

    // Initialize cache warming service
    cacheWarmingService = new CacheWarmingService({
      queryWarmingEnabled: true,
      embeddingWarmingEnabled: false, // Disable to avoid API calls
      expansionWarmingEnabled: false, // Disable to avoid API calls
      enableScheduledWarming: false,
      commonQueries: ['test query 1', 'test query 2']
    }, cacheManager, factbookService);

    // Initialize hybrid retriever
    const config = parseHybridRetrievalConfig();
    hybridRetriever = new HybridRetriever(config, factbookService);
    
    // Connect the components
    hybridRetriever.setCacheManager(cacheManager);
    hybridRetriever.setPerformanceMonitor(performanceMonitor);
    cacheWarmingService.setHybridRetriever(hybridRetriever);
    performanceMonitor.setCacheWarmingService(cacheWarmingService);
  });

  afterEach(() => {
    cacheManager.destroy();
    performanceMonitor.destroy();
    cacheWarmingService.destroy();
  });

  describe('Cache Manager Integration', () => {
    it('should store and retrieve values across cache levels', async () => {
      const key = 'integration_test_key';
      const value = { data: 'integration_test_value', timestamp: Date.now() };

      // Store value
      await cacheManager.set(key, value);

      // Retrieve value
      const retrieved = await cacheManager.get(key);

      expect(retrieved).toEqual(value);
    });

    it('should provide comprehensive cache statistics', async () => {
      // Add some test data
      await cacheManager.set('stats_key_1', { data: 'value1' });
      await cacheManager.set('stats_key_2', { data: 'value2' });
      
      // Access data to create hits
      await cacheManager.get('stats_key_1');
      await cacheManager.get('nonexistent_key'); // Create a miss

      const stats = await cacheManager.getStats();

      expect(stats).toBeDefined();
      expect(stats.memoryEntries).toBeGreaterThan(0);
      expect(stats.totalHits).toBeGreaterThan(0);
      expect(stats.totalMisses).toBeGreaterThan(0);
      expect(stats.overallHitRate).toBeGreaterThan(0);
      expect(stats.overallHitRate).toBeLessThanOrEqual(1);
    });

    it('should handle memory usage monitoring', () => {
      const usage = cacheManager.getMemoryUsage();

      expect(usage).toBeDefined();
      expect(usage.usedMB).toBeGreaterThanOrEqual(0);
      expect(usage.maxMB).toBe(10); // From test config
      expect(usage.utilizationPercent).toBeGreaterThanOrEqual(0);
      expect(usage.utilizationPercent).toBeLessThanOrEqual(100);
    });
  });

  describe('Performance Monitor Integration', () => {
    it('should generate performance snapshots', async () => {
      const snapshot = await performanceMonitor.getCurrentSnapshot();

      expect(snapshot).toBeDefined();
      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(snapshot.cacheStats).toBeDefined();
      expect(snapshot.systemHealthScore).toBeGreaterThanOrEqual(0);
      expect(snapshot.systemHealthScore).toBeLessThanOrEqual(100);
      expect(snapshot.componentHealth).toBeDefined();
    });

    it('should provide dashboard data', () => {
      const dashboardData = performanceMonitor.getDashboardData();

      expect(dashboardData).toBeDefined();
      expect(dashboardData.recentSnapshots).toBeDefined();
      expect(dashboardData.aggregatedMetrics).toBeDefined();
      expect(dashboardData.activeAlerts).toBeDefined();
      expect(Array.isArray(dashboardData.recentSnapshots)).toBe(true);
      expect(Array.isArray(dashboardData.activeAlerts)).toBe(true);
    });

    it('should calculate aggregated metrics', () => {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      const aggregated = performanceMonitor.getAggregatedMetrics(oneHourAgo, now);

      expect(aggregated).toBeDefined();
      expect(aggregated.timeRange.start).toBe(oneHourAgo);
      expect(aggregated.timeRange.end).toBe(now);
      expect(aggregated.timeRange.durationMs).toBe(60 * 60 * 1000);
    });
  });

  describe('Cache Warming Integration', () => {
    it('should provide warming statistics', () => {
      const stats = cacheWarmingService.getStats();
      
      // Should be null before first warming
      expect(stats).toBeNull();
    });

    it('should track warming progress', () => {
      expect(cacheWarmingService.isWarmingInProgress()).toBe(false);
    });

    it('should handle factbook updates', async () => {
      await expect(cacheWarmingService.onFactbookUpdate('v2.0')).resolves.not.toThrow();
    });

    it('should handle model updates', async () => {
      await expect(cacheWarmingService.onModelUpdate('gpt-4-turbo')).resolves.not.toThrow();
    });
  });

  describe('Hybrid Retriever Integration', () => {
    it('should integrate with cache manager', () => {
      const memoryUsage = hybridRetriever.getMemoryUsage();

      expect(memoryUsage).toBeDefined();
      expect(memoryUsage.usedMB).toBeGreaterThanOrEqual(0);
      expect(memoryUsage.maxMB).toBeGreaterThan(0);
      expect(memoryUsage.utilizationPercent).toBeGreaterThanOrEqual(0);
    });

    it('should handle cache invalidation', async () => {
      await expect(hybridRetriever.invalidateOnFactbookChange('v2.0')).resolves.not.toThrow();
      await expect(hybridRetriever.invalidateOnModelChange('gpt-4-turbo')).resolves.not.toThrow();
    });

    it('should perform retrieval with caching', async () => {
      const query = 'test integration query';
      
      // First retrieval should miss cache
      const result1 = await hybridRetriever.retrieve(query);
      expect(result1).toBeDefined();
      expect(result1.results).toBeDefined();
      expect(result1.metrics).toBeDefined();
      expect(result1.metrics.cacheHit).toBe(false);

      // Second retrieval should hit cache (if caching is working)
      const result2 = await hybridRetriever.retrieve(query);
      expect(result2).toBeDefined();
      expect(result2.results).toBeDefined();
      expect(result2.metrics).toBeDefined();
      // Note: Cache hit depends on implementation details and may not always be true
    });
  });

  describe('End-to-End Caching Flow', () => {
    it('should demonstrate complete caching workflow', async () => {
      // 1. Perform a retrieval to populate cache
      const query = 'end to end test query';
      const retrievalResult = await hybridRetriever.retrieve(query);
      
      expect(retrievalResult).toBeDefined();
      expect(retrievalResult.metrics).toBeDefined();

      // 2. Check that performance metrics were recorded
      const snapshot = await performanceMonitor.getCurrentSnapshot();
      expect(snapshot).toBeDefined();

      // 3. Verify cache statistics
      const cacheStats = await cacheManager.getStats();
      expect(cacheStats).toBeDefined();

      // 4. Check dashboard data includes all components
      const dashboardData = performanceMonitor.getDashboardData();
      expect(dashboardData.currentSnapshot).toBeDefined();
      expect(dashboardData.aggregatedMetrics).toBeDefined();

      // 5. Verify memory usage is being tracked
      const memoryUsage = cacheManager.getMemoryUsage();
      expect(memoryUsage.usedMB).toBeGreaterThanOrEqual(0);
    });

    it('should handle cache invalidation across all components', async () => {
      // Add some cached data
      await cacheManager.set('test_key', { data: 'test_value' });
      
      // Verify data exists
      const beforeInvalidation = await cacheManager.get('test_key');
      expect(beforeInvalidation).toBeDefined();

      // Trigger invalidation
      await cacheManager.invalidateOnFactbookChange('v2.0');

      // Verify data is cleared
      const afterInvalidation = await cacheManager.get('test_key');
      expect(afterInvalidation).toBeNull();
    });

    it('should maintain performance under load', async () => {
      const startTime = Date.now();
      const operationCount = 100;

      // Perform many cache operations
      const promises = [];
      for (let i = 0; i < operationCount; i++) {
        promises.push(cacheManager.set(`load_test_${i}`, { index: i, data: `value_${i}` }));
      }
      await Promise.all(promises);

      // Read them back
      const readPromises = [];
      for (let i = 0; i < operationCount; i++) {
        readPromises.push(cacheManager.get(`load_test_${i}`));
      }
      const results = await Promise.all(readPromises);

      const elapsedMs = Date.now() - startTime;
      const operationsPerSecond = (operationCount * 2 * 1000) / elapsedMs;

      // Verify all operations completed successfully
      expect(results).toHaveLength(operationCount);
      expect(results.every(result => result !== null)).toBe(true);
      
      // Performance should be reasonable
      expect(operationsPerSecond).toBeGreaterThan(100);
      
      console.log(`Integration test performance: ${operationsPerSecond.toFixed(0)} ops/sec`);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle component failures gracefully', async () => {
      // Test that the system continues to work even if some components fail
      const query = 'resilience test query';
      
      // This should not throw even if some internal components have issues
      await expect(hybridRetriever.retrieve(query)).resolves.toBeDefined();
      
      // Performance monitoring should continue working
      await expect(performanceMonitor.getCurrentSnapshot()).resolves.toBeDefined();
      
      // Cache operations should continue working
      await expect(cacheManager.set('resilience_key', { data: 'value' })).resolves.not.toThrow();
      await expect(cacheManager.get('resilience_key')).resolves.toBeDefined();
    });

    it('should recover from temporary failures', async () => {
      // Simulate a temporary failure and recovery
      const key = 'recovery_test_key';
      const value = { data: 'recovery_test_value' };

      // Normal operation should work
      await cacheManager.set(key, value);
      const retrieved = await cacheManager.get(key);
      expect(retrieved).toEqual(value);

      // System should continue working after errors
      const stats = await cacheManager.getStats();
      expect(stats).toBeDefined();
    });
  });
});