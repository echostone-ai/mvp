// src/lib/services/__tests__/monitoringDashboard.test.ts
// Tests for monitoring dashboard integration

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MonitoringDashboard } from '../monitoringDashboard';
import { retrievalMetricsCollector } from '../retrievalMetrics';
import { retrievalLogger } from '../retrievalLogger';
import { retrievalDebugger } from '../retrievalDebugger';

// Mock the global instances
vi.mock('../retrievalMetrics');
vi.mock('../retrievalLogger');
vi.mock('../retrievalDebugger');

describe('MonitoringDashboard', () => {
  let dashboard: MonitoringDashboard;
  let mockAggregatedMetrics: any;
  let mockRealtimeMetrics: any;
  let mockPerformanceTrend: any;
  let mockQueryAnalysis: any;

  beforeEach(() => {
    dashboard = new MonitoringDashboard({
      defaultTimeWindow: 3600000, // 1 hour
      alertThresholds: {
        latencyP95Ms: 1000,
        errorRatePercent: 5,
        fallbackRatePercent: 10,
        cacheHitRatePercent: 70,
        componentAvailabilityPercent: 95
      }
    });

    mockAggregatedMetrics = {
      timeWindowMs: 3600000,
      startTime: Date.now() - 3600000,
      endTime: Date.now(),
      totalRequests: 100,
      requestsPerSecond: 0.028,
      averageLatencyMs: 150,
      p50LatencyMs: 140,
      p95LatencyMs: 200,
      p99LatencyMs: 250,
      maxLatencyMs: 300,
      componentLatencies: {
        bm25: { avg: 50, p95: 80 },
        vector: { avg: 60, p95: 90 },
        expansion: { avg: 30, p95: 50 },
        reranking: { avg: 20, p95: 40 },
        fusion: { avg: 5, p95: 10 }
      },
      averageResultCount: 3.5,
      averageConfidenceScore: 0.75,
      averageTopScore: 0.82,
      methodUsageRates: {
        bm25: 1.0,
        vector: 0.8,
        expansion: 0.3,
        reranking: 0.1,
        fusion: 0.8
      },
      cacheHitRate: 0.65,
      embeddingCacheHitRate: 0.7,
      expansionCacheHitRate: 0.8,
      errorRate: 0.02,
      fallbackRate: 0.05,
      fallbackBreakdown: {
        basic_hybrid: 0.03,
        bm25_only: 0.02,
        empty: 0.0
      },
      componentHealthRates: {
        bm25: 0.98,
        vector: 0.95,
        expansion: 0.92,
        reranking: 0.0
      },
      expansionTriggerRate: 0.3,
      expansionReasons: {
        low_top_score: 0.6,
        few_results: 0.3,
        empty_results: 0.1
      },
      topQueries: [
        { query: 'test query', count: 10, avgLatency: 150, avgResultCount: 3 },
        { query: 'another query', count: 5, avgLatency: 120, avgResultCount: 4 }
      ],
      topErrors: [
        { error: 'Vector search timeout', count: 2 }
      ]
    };

    mockRealtimeMetrics = {
      timestamp: Date.now(),
      currentThroughput: 0.5,
      currentP95Latency: 180,
      currentErrorRate: 0.01,
      componentStatus: {
        bm25: 'healthy' as const,
        vector: 'healthy' as const,
        expansion: 'degraded' as const,
        reranking: 'disabled' as const
      },
      cacheEfficiency: {
        hitRate: 0.7,
        size: 1000,
        memoryUsageMB: 128
      },
      recentQueries: 30,
      recentErrors: 1,
      recentFallbacks: 2
    };

    mockPerformanceTrend = [
      {
        timestamp: Date.now() - 1800000,
        latencyMs: 160,
        throughput: 0.4,
        errorRate: 0.02,
        cacheHitRate: 0.65
      },
      {
        timestamp: Date.now() - 900000,
        latencyMs: 170,
        throughput: 0.45,
        errorRate: 0.015,
        cacheHitRate: 0.68
      },
      {
        timestamp: Date.now(),
        latencyMs: 180,
        throughput: 0.5,
        errorRate: 0.01,
        cacheHitRate: 0.7
      }
    ];

    mockQueryAnalysis = {
      totalQueries: 100,
      uniqueQueries: 75,
      topQueries: mockAggregatedMetrics.topQueries,
      queryPatterns: {
        shortQueries: 20,
        mediumQueries: 60,
        longQueries: 20
      }
    };

    // Mock the global instances
    (retrievalMetricsCollector.getAggregatedMetrics as any).mockReturnValue(mockAggregatedMetrics);
    (retrievalMetricsCollector.getRealtimeMetrics as any).mockReturnValue(mockRealtimeMetrics);
    (retrievalMetricsCollector.getPerformanceTrend as any).mockReturnValue(mockPerformanceTrend);
    (retrievalMetricsCollector.getQueryAnalysis as any).mockReturnValue(mockQueryAnalysis);
    (retrievalLogger.getRecentLogs as any).mockReturnValue([]);
  });

  describe('getDashboardData', () => {
    it('should return complete dashboard data', async () => {
      const dashboardData = await dashboard.getDashboardData();
      
      expect(dashboardData.timestamp).toBeCloseTo(Date.now(), -2);
      expect(dashboardData.timeWindow).toBe('1h');
      
      // Real-time metrics
      expect(dashboardData.realtime.currentThroughput).toBe(0.5);
      expect(dashboardData.realtime.currentP95Latency).toBe(180);
      expect(dashboardData.realtime.currentErrorRate).toBe(0.01);
      expect(dashboardData.realtime.systemStatus).toBe('healthy');
      
      // Performance metrics
      expect(dashboardData.performance.totalRequests).toBe(100);
      expect(dashboardData.performance.averageLatency).toBe(150);
      expect(dashboardData.performance.p95Latency).toBe(200);
      
      // Component health
      expect(dashboardData.components.bm25.status).toBe('healthy');
      expect(dashboardData.components.vector.status).toBe('healthy');
      expect(dashboardData.components.expansion.status).toBe('degraded');
      expect(dashboardData.components.reranking.status).toBe('healthy');
      
      // Feature usage
      expect(dashboardData.features.hybridUsagePercent).toBe(160); // vector + fusion = 0.8 + 0.8 = 1.6 * 100
      expect(dashboardData.features.expansionTriggerRate).toBe(30);
      expect(dashboardData.features.rerankingUsagePercent).toBe(10);
      expect(dashboardData.features.fallbackRate).toBe(5);
      
      // Quality metrics
      expect(dashboardData.quality.averageResultCount).toBe(3.5);
      expect(dashboardData.quality.averageConfidenceScore).toBe(0.75);
      expect(dashboardData.quality.cacheHitRate).toBe(65);
      
      // System health
      expect(dashboardData.system.memoryUsageMB).toBe(128);
      expect(dashboardData.system.cacheEfficiency).toBe(70);
      expect(dashboardData.system.errorPatterns).toHaveLength(1);
      
      // Trends
      expect(dashboardData.trends.latency).toEqual(mockPerformanceTrend);
      
      // Queries
      expect(dashboardData.queries.topQueries).toHaveLength(2);
      expect(dashboardData.queries.queryPatterns.shortQueries).toBe(20);
      
      // Activity
      expect(dashboardData.activity.recentQueries).toBe(30);
      expect(dashboardData.activity.recentErrors).toBe(1);
      expect(dashboardData.activity.recentFallbacks).toBe(2);
    });

    it('should use custom time window', async () => {
      const customWindow = 7200000; // 2 hours
      await dashboard.getDashboardData(customWindow);
      
      expect(retrievalMetricsCollector.getAggregatedMetrics).toHaveBeenCalledWith(customWindow);
    });
  });

  describe('getRealtimeData', () => {
    it('should return real-time metrics', () => {
      const realtime = dashboard.getRealtimeData();
      
      expect(realtime).toEqual(mockRealtimeMetrics);
      expect(retrievalMetricsCollector.getRealtimeMetrics).toHaveBeenCalled();
    });
  });

  describe('getPerformanceTrends', () => {
    it('should return performance trends with default parameters', () => {
      const trends = dashboard.getPerformanceTrends();
      
      expect(trends).toEqual(mockPerformanceTrend);
      expect(retrievalMetricsCollector.getPerformanceTrend).toHaveBeenCalledWith(3600000, 300000);
    });

    it('should return performance trends with custom parameters', () => {
      const customWindow = 7200000;
      const customInterval = 600000;
      
      dashboard.getPerformanceTrends(customWindow, customInterval);
      
      expect(retrievalMetricsCollector.getPerformanceTrend).toHaveBeenCalledWith(customWindow, customInterval);
    });
  });

  describe('getComponentHealth', () => {
    it('should return health for valid components', () => {
      const health = dashboard.getComponentHealth('bm25');
      
      expect(health).toBeDefined();
      expect(health!.status).toBe('healthy');
      expect(health!.availability).toBe(0.98);
      expect(health!.averageLatency).toBe(50);
      expect(health!.p95Latency).toBe(80);
    });

    it('should return null for invalid components', () => {
      const health = dashboard.getComponentHealth('invalid');
      
      expect(health).toBeNull();
    });
  });

  describe('alert management', () => {
    beforeEach(() => {
      // Mock high latency to trigger alerts
      mockAggregatedMetrics.p95LatencyMs = 1500; // Above threshold of 1000
      mockAggregatedMetrics.errorRate = 0.08; // Above threshold of 5%
      (retrievalMetricsCollector.getAggregatedMetrics as any).mockReturnValue(mockAggregatedMetrics);
    });

    it('should create alerts for threshold violations', async () => {
      await dashboard.getDashboardData();
      
      const activeAlerts = dashboard.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);
      
      // Should have latency and error rate alerts
      const latencyAlert = activeAlerts.find(a => a.message.includes('High P95 latency'));
      const errorAlert = activeAlerts.find(a => a.message.includes('High error rate'));
      
      expect(latencyAlert).toBeDefined();
      expect(errorAlert).toBeDefined();
    });

    it('should resolve alerts', async () => {
      await dashboard.getDashboardData();
      
      const activeAlerts = dashboard.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);
      
      const alertId = activeAlerts[0].id;
      const resolved = dashboard.resolveAlert(alertId);
      
      expect(resolved).toBe(true);
      
      const updatedAlerts = dashboard.getActiveAlerts();
      expect(updatedAlerts.find(a => a.id === alertId)).toBeUndefined();
    });

    it('should return false when resolving non-existent alert', () => {
      const resolved = dashboard.resolveAlert('non-existent');
      expect(resolved).toBe(false);
    });

    it('should get all alerts including resolved ones', async () => {
      await dashboard.getDashboardData();
      
      const activeAlerts = dashboard.getActiveAlerts();
      const alertId = activeAlerts[0].id;
      dashboard.resolveAlert(alertId);
      
      const allAlerts = dashboard.getAllAlerts();
      expect(allAlerts.length).toBeGreaterThanOrEqual(activeAlerts.length);
      expect(allAlerts.find(a => a.id === alertId && a.resolved)).toBeDefined();
    });
  });

  describe('getQueryDebugInfo', () => {
    it('should return debug information for a query', () => {
      const mockDebugHistory = [{ query: 'test query', steps: [] }];
      const mockLogHistory = [{ query: 'test query', timestamp: Date.now() }];
      const mockQueryAnalysis = { query: 'test query', characteristics: {} };
      
      (retrievalDebugger.getQueryDebugHistory as any).mockReturnValue(mockDebugHistory);
      (retrievalLogger.getFilteredLogs as any).mockReturnValue(mockLogHistory);
      (retrievalDebugger.analyzeQuery as any).mockReturnValue(mockQueryAnalysis);
      
      const debugInfo = dashboard.getQueryDebugInfo('test query');
      
      expect(debugInfo.debugPaths).toEqual(mockDebugHistory);
      expect(debugInfo.logEntries).toEqual(mockLogHistory);
      expect(debugInfo.queryAnalysis).toEqual(mockQueryAnalysis);
      
      expect(retrievalDebugger.getQueryDebugHistory).toHaveBeenCalledWith('test query');
      expect(retrievalLogger.getFilteredLogs).toHaveBeenCalledWith({ query: 'test query' });
      expect(retrievalDebugger.analyzeQuery).toHaveBeenCalledWith('test query');
    });
  });

  describe('exportMetrics', () => {
    it('should export metrics in Prometheus format', () => {
      const mockPrometheusMetrics = 'hybrid_retrieval_requests_total 100\n';
      (retrievalMetricsCollector.exportPrometheusMetrics as any).mockReturnValue(mockPrometheusMetrics);
      
      const exported = dashboard.exportMetrics('prometheus');
      
      expect(exported).toBe(mockPrometheusMetrics);
      expect(retrievalMetricsCollector.exportPrometheusMetrics).toHaveBeenCalled();
    });

    it('should export metrics in JSON format', async () => {
      const exported = dashboard.exportMetrics('json');
      
      const parsed = JSON.parse(exported);
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.performance).toBeDefined();
      expect(parsed.components).toBeDefined();
    });

    it('should export metrics in CSV format', () => {
      const mockCSV = 'timestamp,query,latency\n1234567890,test,150\n';
      (retrievalLogger.exportLogs as any).mockReturnValue(mockCSV);
      
      const exported = dashboard.exportMetrics('csv');
      
      expect(exported).toBe(mockCSV);
      expect(retrievalLogger.exportLogs).toHaveBeenCalledWith('csv');
    });

    it('should throw error for unsupported format', () => {
      expect(() => {
        dashboard.exportMetrics('xml' as any);
      }).toThrow('Unsupported export format: xml');
    });
  });

  describe('getHealthSummary', () => {
    it('should return system health summary', () => {
      const summary = dashboard.getHealthSummary();
      
      expect(summary.status).toBe('healthy');
      expect(summary.components.bm25).toBe('healthy');
      expect(summary.components.vector).toBe('healthy');
      expect(summary.components.expansion).toBe('degraded');
      expect(summary.components.reranking).toBe('disabled');
      expect(summary.alerts).toBe(0);
      expect(summary.uptime).toBeGreaterThan(0);
      expect(summary.lastCheck).toBeCloseTo(Date.now(), -2);
    });

    it('should reflect system status based on component health', () => {
      // Mock unhealthy components
      mockRealtimeMetrics.componentStatus.bm25 = 'failed';
      (retrievalMetricsCollector.getRealtimeMetrics as any).mockReturnValue(mockRealtimeMetrics);
      
      const summary = dashboard.getHealthSummary();
      
      expect(summary.status).toBe('unhealthy');
      expect(summary.components.bm25).toBe('failed');
    });
  });

  describe('time window formatting', () => {
    it('should format time windows correctly', async () => {
      // Test minutes
      await dashboard.getDashboardData(1800000); // 30 minutes
      let data = await dashboard.getDashboardData(1800000);
      expect(data.timeWindow).toBe('30m');
      
      // Test hours
      data = await dashboard.getDashboardData(7200000); // 2 hours
      expect(data.timeWindow).toBe('2h');
      
      // Test days
      data = await dashboard.getDashboardData(172800000); // 2 days
      expect(data.timeWindow).toBe('2d');
    });
  });

  describe('component availability calculation', () => {
    it('should calculate correct component availability', async () => {
      const data = await dashboard.getDashboardData();
      
      // Average of component health rates: (0.98 + 0.95 + 0.92 + 0.0) / 4 = 0.7125 * 100 = 71.25
      expect(data.system.componentAvailability).toBeCloseTo(71.25, 1);
    });
  });

  describe('system status calculation', () => {
    it('should return healthy status when all components are healthy', () => {
      mockRealtimeMetrics.componentStatus = {
        bm25: 'healthy',
        vector: 'healthy',
        expansion: 'healthy',
        reranking: 'healthy'
      };
      mockRealtimeMetrics.currentErrorRate = 0.01;
      (retrievalMetricsCollector.getRealtimeMetrics as any).mockReturnValue(mockRealtimeMetrics);
      
      const realtime = dashboard.getRealtimeData();
      const summary = dashboard.getHealthSummary();
      
      expect(summary.status).toBe('healthy');
    });

    it('should return degraded status when some components are degraded', () => {
      mockRealtimeMetrics.componentStatus = {
        bm25: 'healthy',
        vector: 'degraded',
        expansion: 'degraded',
        reranking: 'disabled'
      };
      mockRealtimeMetrics.currentErrorRate = 0.01;
      (retrievalMetricsCollector.getRealtimeMetrics as any).mockReturnValue(mockRealtimeMetrics);
      
      const summary = dashboard.getHealthSummary();
      
      expect(summary.status).toBe('degraded');
    });

    it('should return unhealthy status when components fail or error rate is high', () => {
      mockRealtimeMetrics.componentStatus = {
        bm25: 'failed',
        vector: 'healthy',
        expansion: 'healthy',
        reranking: 'disabled'
      };
      mockRealtimeMetrics.currentErrorRate = 0.01;
      (retrievalMetricsCollector.getRealtimeMetrics as any).mockReturnValue(mockRealtimeMetrics);
      
      const summary = dashboard.getHealthSummary();
      
      expect(summary.status).toBe('unhealthy');
    });

    it('should return unhealthy status when error rate is too high', () => {
      mockRealtimeMetrics.componentStatus = {
        bm25: 'healthy',
        vector: 'healthy',
        expansion: 'healthy',
        reranking: 'disabled'
      };
      mockRealtimeMetrics.currentErrorRate = 0.15; // 15% error rate
      (retrievalMetricsCollector.getRealtimeMetrics as any).mockReturnValue(mockRealtimeMetrics);
      
      const summary = dashboard.getHealthSummary();
      
      expect(summary.status).toBe('unhealthy');
    });
  });
});