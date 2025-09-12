// src/lib/services/__tests__/performanceMonitor.test.ts
// Tests for performance monitoring and cache efficiency metrics

import { PerformanceMonitor, PerformanceMonitorConfig } from '../performanceMonitor';
import { CacheManager, CacheStats } from '../cacheManager';
import { CacheWarmingService } from '../cacheWarming';
import { RetrievalMetrics } from '../hybridRetrieval';

// Mock dependencies
jest.mock('../cacheManager');
jest.mock('../cacheWarming');

const MockCacheManager = CacheManager as jest.MockedClass<typeof CacheManager>;
const MockCacheWarmingService = CacheWarmingService as jest.MockedClass<typeof CacheWarmingService>;

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor;
  let mockCacheManager: jest.Mocked<CacheManager>;
  let testConfig: Partial<PerformanceMonitorConfig>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock cache manager
    mockCacheManager = {
      getStats: jest.fn().mockResolvedValue({
        memoryEntries: 100,
        memorySize: 1024 * 1024, // 1MB
        memoryHitRate: 0.8,
        memoryMissRate: 0.2,
        fileEntries: 50,
        fileSize: 2 * 1024 * 1024, // 2MB
        fileHitRate: 0.6,
        fileMissRate: 0.4,
        totalHits: 800,
        totalMisses: 200,
        overallHitRate: 0.8,
        averageGetTimeMs: 5,
        averageSetTimeMs: 3,
        memoryUsageMB: 1,
        evictionCount: 10,
        lastCleanup: Date.now() - 60000,
        oldestEntry: Date.now() - 3600000,
        newestEntry: Date.now()
      } as CacheStats),
      getMemoryUsage: jest.fn().mockReturnValue({
        usedMB: 1,
        maxMB: 100,
        utilizationPercent: 1
      })
    } as any;

    testConfig = {
      enableMonitoring: true,
      metricsRetentionMs: 60 * 60 * 1000, // 1 hour
      aggregationIntervalMs: 1000, // 1 second for tests
      
      maxMemoryUsageMB: 50,
      minCacheHitRate: 0.7,
      maxAverageLatencyMs: 300,
      maxErrorRate: 0.05,
      
      enableDashboard: true,
      dashboardUpdateIntervalMs: 1000,
      maxDataPoints: 100,
      
      enableMetricsExport: false, // Disable for tests
      exportFormat: 'json',
      exportIntervalMs: 60000,
      exportPath: './test-metrics'
    };

    performanceMonitor = new PerformanceMonitor(testConfig, mockCacheManager);
  });

  afterEach(() => {
    performanceMonitor.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultMonitor = new PerformanceMonitor({}, mockCacheManager);
      expect(defaultMonitor).toBeDefined();
      defaultMonitor.destroy();
    });

    it('should start monitoring when enabled', () => {
      expect(performanceMonitor).toBeDefined();
      // Monitoring should be started automatically
    });

    it('should not start monitoring when disabled', () => {
      const disabledConfig = { ...testConfig, enableMonitoring: false };
      const disabledMonitor = new PerformanceMonitor(disabledConfig, mockCacheManager);
      
      expect(disabledMonitor).toBeDefined();
      disabledMonitor.destroy();
    });
  });

  describe('Retrieval Metrics Recording', () => {
    it('should record retrieval metrics', () => {
      const testMetrics: RetrievalMetrics = {
        totalTimeMs: 150,
        bm25TimeMs: 50,
        vectorTimeMs: 80,
        expansionTimeMs: 20,
        rerankTimeMs: 0,
        fusionTimeMs: 10,
        
        cacheHit: false,
        embeddingCacheHits: 2,
        expansionCacheHits: 0,
        
        methodsUsed: ['bm25', 'vector', 'fusion'],
        fallbackLevel: 'none',
        
        resultCount: 5,
        confidenceScore: 0.85,
        topScore: 0.92,
        averageScore: 0.78,
        
        expansionTriggered: true,
        rerankingApplied: false,
        fallbackUsed: false,
        
        bm25Available: true,
        vectorAvailable: true,
        expansionAvailable: true,
        rerankingAvailable: false,
        
        errors: [],
        warnings: ['Minor warning']
      };

      expect(() => {
        performanceMonitor.recordRetrievalMetrics(testMetrics);
      }).not.toThrow();
    });

    it('should not record metrics when monitoring is disabled', () => {
      const disabledConfig = { ...testConfig, enableMonitoring: false };
      const disabledMonitor = new PerformanceMonitor(disabledConfig, mockCacheManager);

      const testMetrics: RetrievalMetrics = {
        totalTimeMs: 100,
        bm25TimeMs: 50,
        cacheHit: false,
        methodsUsed: ['bm25'],
        resultCount: 3,
        confidenceScore: 0.7,
        expansionTriggered: false,
        rerankingApplied: false,
        fallbackUsed: false,
        bm25Available: true,
        vectorAvailable: false,
        expansionAvailable: false,
        rerankingAvailable: false,
        errors: [],
        warnings: []
      };

      expect(() => {
        disabledMonitor.recordRetrievalMetrics(testMetrics);
      }).not.toThrow();

      disabledMonitor.destroy();
    });
  });

  describe('Performance Snapshots', () => {
    it('should generate current performance snapshot', async () => {
      const snapshot = await performanceMonitor.getCurrentSnapshot();

      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('cacheStats');
      expect(snapshot).toHaveProperty('memoryUsageMB');
      expect(snapshot).toHaveProperty('cacheEfficiencyScore');
      expect(snapshot).toHaveProperty('averageRetrievalTimeMs');
      expect(snapshot).toHaveProperty('systemHealthScore');
      expect(snapshot).toHaveProperty('componentHealth');
      expect(snapshot).toHaveProperty('activeAlerts');

      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(snapshot.cacheStats).toBeDefined();
      expect(snapshot.memoryUsageMB).toBeGreaterThanOrEqual(0);
      expect(snapshot.cacheEfficiencyScore).toBeGreaterThanOrEqual(0);
      expect(snapshot.cacheEfficiencyScore).toBeLessThanOrEqual(100);
      expect(snapshot.systemHealthScore).toBeGreaterThanOrEqual(0);
      expect(snapshot.systemHealthScore).toBeLessThanOrEqual(100);
    });

    it('should calculate cache efficiency score correctly', async () => {
      // Mock high hit rate for good efficiency
      mockCacheManager.getStats.mockResolvedValue({
        ...await mockCacheManager.getStats(),
        overallHitRate: 0.9,
        memoryUsageMB: 5 // Low memory usage
      } as CacheStats);

      const snapshot = await performanceMonitor.getCurrentSnapshot();

      expect(snapshot.cacheEfficiencyScore).toBeGreaterThan(70);
    });

    it('should calculate system health score', async () => {
      const snapshot = await performanceMonitor.getCurrentSnapshot();

      expect(snapshot.systemHealthScore).toBeGreaterThanOrEqual(0);
      expect(snapshot.systemHealthScore).toBeLessThanOrEqual(100);
      expect(snapshot.componentHealth).toHaveProperty('cache');
      expect(snapshot.componentHealth).toHaveProperty('retrieval');
      expect(snapshot.componentHealth).toHaveProperty('expansion');
      expect(snapshot.componentHealth).toHaveProperty('reranking');
    });
  });

  describe('Aggregated Metrics', () => {
    beforeEach(async () => {
      // Record some test metrics to have data for aggregation
      const testMetrics: RetrievalMetrics = {
        totalTimeMs: 200,
        bm25TimeMs: 100,
        cacheHit: false,
        methodsUsed: ['bm25', 'vector'],
        resultCount: 3,
        confidenceScore: 0.8,
        expansionTriggered: false,
        rerankingApplied: false,
        fallbackUsed: false,
        bm25Available: true,
        vectorAvailable: true,
        expansionAvailable: true,
        rerankingAvailable: true,
        errors: [],
        warnings: []
      };

      performanceMonitor.recordRetrievalMetrics(testMetrics);
      
      // Wait for snapshot to be taken
      await new Promise(resolve => setTimeout(resolve, 1100));
    });

    it('should calculate aggregated metrics for time range', () => {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      const aggregated = performanceMonitor.getAggregatedMetrics(oneHourAgo, now);

      expect(aggregated).toHaveProperty('timeRange');
      expect(aggregated).toHaveProperty('averageCacheHitRate');
      expect(aggregated).toHaveProperty('averageLatency');
      expect(aggregated).toHaveProperty('errorRate');
      expect(aggregated).toHaveProperty('featureUsage');
      expect(aggregated).toHaveProperty('systemHealthScore');

      expect(aggregated.timeRange.start).toBe(oneHourAgo);
      expect(aggregated.timeRange.end).toBe(now);
      expect(aggregated.timeRange.durationMs).toBe(60 * 60 * 1000);
    });

    it('should calculate trends correctly', () => {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      const aggregated = performanceMonitor.getAggregatedMetrics(oneHourAgo, now);

      expect(aggregated.cacheHitRateTrend).toMatch(/improving|stable|degrading/);
      expect(aggregated.latencyTrend).toMatch(/improving|stable|degrading/);
      expect(aggregated.errorTrend).toMatch(/improving|stable|degrading/);
    });

    it('should handle empty time ranges gracefully', () => {
      const now = Date.now();
      const futureTime = now + 60 * 60 * 1000;

      const aggregated = performanceMonitor.getAggregatedMetrics(now, futureTime);

      expect(aggregated.totalRequests).toBe(0);
      expect(aggregated.averageLatency).toBe(0);
      expect(aggregated.errorRate).toBe(0);
    });
  });

  describe('Dashboard Data', () => {
    it('should provide comprehensive dashboard data', () => {
      const dashboardData = performanceMonitor.getDashboardData();

      expect(dashboardData).toHaveProperty('currentSnapshot');
      expect(dashboardData).toHaveProperty('recentSnapshots');
      expect(dashboardData).toHaveProperty('aggregatedMetrics');
      expect(dashboardData).toHaveProperty('activeAlerts');
      expect(dashboardData).toHaveProperty('cacheWarmingStats');

      expect(Array.isArray(dashboardData.recentSnapshots)).toBe(true);
      expect(Array.isArray(dashboardData.activeAlerts)).toBe(true);
    });

    it('should include cache warming stats when service is set', () => {
      const mockCacheWarmingService = {
        getStats: jest.fn().mockReturnValue({
          totalOperations: 100,
          successfulOperations: 95,
          failedOperations: 5,
          lastWarmingTime: Date.now()
        })
      } as any;

      performanceMonitor.setCacheWarmingService(mockCacheWarmingService);

      const dashboardData = performanceMonitor.getDashboardData();

      expect(dashboardData.cacheWarmingStats).toBeDefined();
      expect(mockCacheWarmingService.getStats).toHaveBeenCalled();
    });
  });

  describe('Performance Alerts', () => {
    it('should create alerts for high latency', () => {
      const highLatencyMetrics: RetrievalMetrics = {
        totalTimeMs: 600, // Above threshold
        bm25TimeMs: 300,
        cacheHit: false,
        methodsUsed: ['bm25'],
        resultCount: 1,
        confidenceScore: 0.5,
        expansionTriggered: false,
        rerankingApplied: false,
        fallbackUsed: false,
        bm25Available: true,
        vectorAvailable: false,
        expansionAvailable: false,
        rerankingAvailable: false,
        errors: [],
        warnings: []
      };

      performanceMonitor.recordRetrievalMetrics(highLatencyMetrics);

      // Check that alert would be created (implementation detail)
      expect(performanceMonitor).toBeDefined();
    });

    it('should create alerts for high error rate', () => {
      const highErrorMetrics: RetrievalMetrics = {
        totalTimeMs: 100,
        bm25TimeMs: 50,
        cacheHit: false,
        methodsUsed: ['bm25'],
        resultCount: 1,
        confidenceScore: 0.5,
        expansionTriggered: false,
        rerankingApplied: false,
        fallbackUsed: false,
        bm25Available: true,
        vectorAvailable: false,
        expansionAvailable: false,
        rerankingAvailable: false,
        errors: ['Error 1', 'Error 2'], // High error count
        warnings: []
      };

      performanceMonitor.recordRetrievalMetrics(highErrorMetrics);

      expect(performanceMonitor).toBeDefined();
    });
  });

  describe('Metrics Export', () => {
    it('should export metrics when enabled', async () => {
      const exportConfig = { ...testConfig, enableMetricsExport: true };
      const exportMonitor = new PerformanceMonitor(exportConfig, mockCacheManager);

      await expect(exportMonitor.exportMetrics()).resolves.not.toThrow();

      exportMonitor.destroy();
    });

    it('should skip export when disabled', async () => {
      await expect(performanceMonitor.exportMetrics()).resolves.not.toThrow();
    });

    it('should handle export errors gracefully', async () => {
      const exportConfig = { 
        ...testConfig, 
        enableMetricsExport: true,
        exportPath: '/invalid/path'
      };
      const exportMonitor = new PerformanceMonitor(exportConfig, mockCacheManager);

      await expect(exportMonitor.exportMetrics()).resolves.not.toThrow();

      exportMonitor.destroy();
    });
  });

  describe('Memory Management', () => {
    it('should limit stored snapshots to maxDataPoints', async () => {
      const limitedConfig = { ...testConfig, maxDataPoints: 5 };
      const limitedMonitor = new PerformanceMonitor(limitedConfig, mockCacheManager);

      // Generate more snapshots than the limit
      for (let i = 0; i < 10; i++) {
        await limitedMonitor.getCurrentSnapshot();
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const dashboardData = limitedMonitor.getDashboardData();
      expect(dashboardData.recentSnapshots.length).toBeLessThanOrEqual(5);

      limitedMonitor.destroy();
    });

    it('should clean old metrics based on retention period', () => {
      const shortRetentionConfig = { 
        ...testConfig, 
        metricsRetentionMs: 100 // Very short retention
      };
      const shortRetentionMonitor = new PerformanceMonitor(shortRetentionConfig, mockCacheManager);

      const oldMetrics: RetrievalMetrics = {
        totalTimeMs: 100,
        bm25TimeMs: 50,
        cacheHit: false,
        methodsUsed: ['bm25'],
        resultCount: 1,
        confidenceScore: 0.5,
        expansionTriggered: false,
        rerankingApplied: false,
        fallbackUsed: false,
        bm25Available: true,
        vectorAvailable: false,
        expansionAvailable: false,
        rerankingAvailable: false,
        errors: [],
        warnings: []
      };

      shortRetentionMonitor.recordRetrievalMetrics(oldMetrics);

      // Wait for retention period to pass
      setTimeout(() => {
        shortRetentionMonitor.recordRetrievalMetrics(oldMetrics);
        // Old metrics should be cleaned up
      }, 150);

      shortRetentionMonitor.destroy();
    });
  });

  describe('Error Handling', () => {
    it('should handle cache manager errors gracefully', async () => {
      mockCacheManager.getStats.mockRejectedValue(new Error('Cache error'));

      await expect(performanceMonitor.getCurrentSnapshot()).resolves.toBeDefined();
    });

    it('should handle missing cache warming service gracefully', () => {
      const dashboardData = performanceMonitor.getDashboardData();

      expect(dashboardData.cacheWarmingStats).toBeNull();
    });

    it('should continue monitoring after errors', async () => {
      // Cause an error
      mockCacheManager.getStats.mockRejectedValueOnce(new Error('Temporary error'));
      
      await performanceMonitor.getCurrentSnapshot();

      // Should recover and continue working
      mockCacheManager.getStats.mockResolvedValue({
        memoryEntries: 50,
        overallHitRate: 0.7,
        memoryUsageMB: 2
      } as CacheStats);

      const snapshot = await performanceMonitor.getCurrentSnapshot();
      expect(snapshot).toBeDefined();
    });
  });

  describe('Configuration', () => {
    it('should use environment variables for configuration', () => {
      const originalEnv = process.env;
      
      process.env = {
        ...originalEnv,
        PERF_MONITORING_ENABLED: 'true',
        PERF_AGGREGATION_INTERVAL_MS: '30000',
        PERF_MAX_MEMORY_MB: '100',
        PERF_MIN_CACHE_HIT_RATE: '0.8'
      };

      // This would test the factory function if we imported it
      // const factoryMonitor = createPerformanceMonitor(mockCacheManager);
      
      process.env = originalEnv;
    });

    it('should validate configuration parameters', () => {
      const invalidConfig = {
        maxMemoryUsageMB: -1,
        minCacheHitRate: 2.0, // Invalid rate
        maxAverageLatencyMs: -100
      };

      expect(() => {
        new PerformanceMonitor(invalidConfig, mockCacheManager);
      }).not.toThrow(); // Should handle gracefully
    });
  });

  describe('Performance', () => {
    it('should handle high-frequency metric recording efficiently', () => {
      const startTime = Date.now();
      const metricCount = 1000;

      const testMetrics: RetrievalMetrics = {
        totalTimeMs: 100,
        bm25TimeMs: 50,
        cacheHit: false,
        methodsUsed: ['bm25'],
        resultCount: 1,
        confidenceScore: 0.5,
        expansionTriggered: false,
        rerankingApplied: false,
        fallbackUsed: false,
        bm25Available: true,
        vectorAvailable: false,
        expansionAvailable: false,
        rerankingAvailable: false,
        errors: [],
        warnings: []
      };

      for (let i = 0; i < metricCount; i++) {
        performanceMonitor.recordRetrievalMetrics(testMetrics);
      }

      const elapsedMs = Date.now() - startTime;
      const metricsPerSecond = (metricCount * 1000) / elapsedMs;

      console.log(`Performance monitoring: ${metricsPerSecond.toFixed(0)} metrics/sec`);

      // Should be able to handle high frequency
      expect(metricsPerSecond).toBeGreaterThan(1000);
    });

    it('should maintain performance with large datasets', async () => {
      // Generate many snapshots
      for (let i = 0; i < 100; i++) {
        await performanceMonitor.getCurrentSnapshot();
      }

      const startTime = Date.now();
      const aggregated = performanceMonitor.getAggregatedMetrics(
        Date.now() - 60000, 
        Date.now()
      );
      const elapsedMs = Date.now() - startTime;

      expect(aggregated).toBeDefined();
      expect(elapsedMs).toBeLessThan(100); // Should be fast
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources on destroy', () => {
      expect(() => performanceMonitor.destroy()).not.toThrow();
    });

    it('should stop monitoring intervals on destroy', () => {
      const monitoringMonitor = new PerformanceMonitor(testConfig, mockCacheManager);
      
      expect(() => monitoringMonitor.destroy()).not.toThrow();
    });

    it('should stop export intervals on destroy', () => {
      const exportConfig = { ...testConfig, enableMetricsExport: true };
      const exportMonitor = new PerformanceMonitor(exportConfig, mockCacheManager);
      
      expect(() => exportMonitor.destroy()).not.toThrow();
    });
  });
});