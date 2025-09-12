// src/lib/services/__tests__/monitoring.integration.test.ts
// Integration tests for monitoring infrastructure with hybrid retrieval

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HybridRetriever, parseHybridRetrievalConfig } from '../hybridRetrieval';
import { retrievalLogger } from '../retrievalLogger';
import { retrievalMetricsCollector } from '../retrievalMetrics';
import { retrievalDebugger } from '../retrievalDebugger';
import { monitoringDashboard } from '../monitoringDashboard';
import { FactbookService } from '../factbookService';

// Mock external dependencies
vi.mock('../factbookService');
vi.mock('openai');

describe('Monitoring Integration', () => {
  let hybridRetriever: HybridRetriever;
  let mockFactbookService: any;

  beforeEach(() => {
    // Clear monitoring state
    retrievalLogger.clearLogs();
    retrievalMetricsCollector.clearMetrics();
    retrievalDebugger.clearHistory();

    // Mock FactbookService
    mockFactbookService = {
      getAllSnippets: vi.fn().mockReturnValue([
        {
          id: 'test1',
          path: 'test/path1',
          text: 'Test snippet about Morocco cobra encounter',
          topics: ['travel', 'animals'],
          keywords: ['morocco', 'cobra', 'snake', 'encounter']
        },
        {
          id: 'test2',
          path: 'test/path2',
          text: 'Test snippet about SXSW concert with Bill Murray',
          topics: ['music', 'events'],
          keywords: ['sxsw', 'concert', 'bill', 'murray', 'music']
        }
      ])
    };

    // Create hybrid retriever with monitoring
    const config = parseHybridRetrievalConfig();
    hybridRetriever = new HybridRetriever(
      { ...config, enableEmbeddings: false, enableExpansion: 'off', enableReranking: false },
      mockFactbookService
    );
  });

  describe('End-to-End Monitoring Flow', () => {
    it('should capture complete monitoring data for a retrieval operation', async () => {
      const query = 'snake story';
      
      // Perform retrieval
      const result = await hybridRetriever.retrieve(query);
      
      // Verify retrieval worked
      expect(result.results).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.metrics.totalTimeMs).toBeGreaterThan(0);
      expect(result.metrics.bm25TimeMs).toBeGreaterThan(0);
      expect(result.metrics.methodsUsed).toContain('bm25');
      
      // Verify logging captured the operation
      const logs = retrievalLogger.getRecentLogs(10);
      expect(logs).toHaveLength(1);
      
      const log = logs[0];
      expect(log.query).toBe(query);
      expect(log.totalTimeMs).toBe(result.metrics.totalTimeMs);
      expect(log.methodsUsed).toEqual(result.metrics.methodsUsed);
      expect(log.componentStatus.bm25).toBe('healthy');
      
      // Verify metrics collection
      const aggregated = retrievalMetricsCollector.getAggregatedMetrics(3600000);
      expect(aggregated.totalRequests).toBe(1);
      expect(aggregated.averageLatencyMs).toBe(result.metrics.totalTimeMs);
      expect(aggregated.methodUsageRates.bm25).toBe(1);
      
      // Verify debugging captured the operation
      const debugHistory = retrievalDebugger.getDebugHistory(10);
      expect(debugHistory).toHaveLength(1);
      
      const debugPath = debugHistory[0];
      expect(debugPath.query).toBe(query);
      expect(debugPath.finalResults).toEqual(result.results);
      expect(debugPath.finalMetrics).toEqual(result.metrics);
      expect(debugPath.steps.length).toBeGreaterThan(0);
    });

    it('should track performance trends over multiple queries', async () => {
      const queries = ['snake story', 'SXSW concert', 'Bill Murray'];
      
      // Perform multiple retrievals
      for (const query of queries) {
        await hybridRetriever.retrieve(query);
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Verify aggregated metrics
      const aggregated = retrievalMetricsCollector.getAggregatedMetrics(3600000);
      expect(aggregated.totalRequests).toBe(3);
      expect(aggregated.requestsPerSecond).toBeGreaterThan(0);
      expect(aggregated.averageLatencyMs).toBeGreaterThan(0);
      expect(aggregated.methodUsageRates.bm25).toBe(1); // All used BM25
      
      // Verify performance trends
      const trends = retrievalMetricsCollector.getPerformanceTrend(3600000, 300000);
      expect(trends.length).toBeGreaterThan(0);
      
      // Verify query analysis
      const queryAnalysis = retrievalMetricsCollector.getQueryAnalysis(3600000);
      expect(queryAnalysis.totalQueries).toBe(3);
      expect(queryAnalysis.uniqueQueries).toBe(3);
      expect(queryAnalysis.topQueries.length).toBeGreaterThan(0);
    });

    it('should generate comprehensive dashboard data', async () => {
      // Perform some retrievals
      await hybridRetriever.retrieve('test query 1');
      await hybridRetriever.retrieve('test query 2');
      
      // Get dashboard data
      const dashboardData = await monitoringDashboard.getDashboardData();
      
      // Verify dashboard structure
      expect(dashboardData.timestamp).toBeCloseTo(Date.now(), -2);
      expect(dashboardData.timeWindow).toBe('1h');
      
      // Verify real-time metrics
      expect(dashboardData.realtime.currentThroughput).toBeGreaterThanOrEqual(0);
      expect(dashboardData.realtime.systemStatus).toMatch(/healthy|degraded|unhealthy/);
      
      // Verify performance metrics
      expect(dashboardData.performance.totalRequests).toBe(2);
      expect(dashboardData.performance.averageLatency).toBeGreaterThan(0);
      
      // Verify component health
      expect(dashboardData.components.bm25.status).toBe('healthy');
      expect(dashboardData.components.bm25.availability).toBeGreaterThan(0);
      
      // Verify feature usage
      expect(dashboardData.features.hybridUsagePercent).toBeGreaterThanOrEqual(0);
      expect(dashboardData.features.fallbackRate).toBeGreaterThanOrEqual(0);
      
      // Verify quality metrics
      expect(dashboardData.quality.averageResultCount).toBeGreaterThanOrEqual(0);
      expect(dashboardData.quality.cacheHitRate).toBeGreaterThanOrEqual(0);
      
      // Verify system health
      expect(dashboardData.system.componentAvailability).toBeGreaterThan(0);
      expect(dashboardData.system.errorPatterns).toBeDefined();
      
      // Verify activity
      expect(dashboardData.activity.recentQueries).toBe(2);
      expect(dashboardData.activity.activeAlerts).toBeDefined();
    });

    it('should handle error scenarios with proper monitoring', async () => {
      // Mock an error in the factbook service
      mockFactbookService.getAllSnippets.mockImplementation(() => {
        throw new Error('Factbook service error');
      });
      
      // Create a new retriever that will fail
      const config = parseHybridRetrievalConfig();
      const failingRetriever = new HybridRetriever(
        { ...config, enableEmbeddings: false, enableExpansion: 'off', enableReranking: false },
        mockFactbookService
      );
      
      // Attempt retrieval (should fail gracefully)
      const result = await failingRetriever.retrieve('test query');
      
      // Verify graceful failure
      expect(result.results).toHaveLength(0);
      expect(result.metrics.errors.length).toBeGreaterThan(0);
      expect(result.metrics.fallbackUsed).toBe(true);
      
      // Verify error was logged
      const logs = retrievalLogger.getRecentLogs(10);
      const errorLog = logs.find(log => log.errors.length > 0);
      expect(errorLog).toBeDefined();
      expect(errorLog!.errors[0]).toContain('Factbook service error');
      
      // Verify metrics captured the error
      const aggregated = retrievalMetricsCollector.getAggregatedMetrics(3600000);
      expect(aggregated.errorRate).toBeGreaterThan(0);
      expect(aggregated.fallbackRate).toBeGreaterThan(0);
      
      // Verify debugging captured the failure
      const debugHistory = retrievalDebugger.getDebugHistory(10);
      const errorDebug = debugHistory.find(debug => debug.decisions.fallbackUsed);
      expect(errorDebug).toBeDefined();
      expect(errorDebug!.decisions.fallbackReason).toBeDefined();
    });

    it('should export metrics in various formats', async () => {
      // Perform some retrievals
      await hybridRetriever.retrieve('export test 1');
      await hybridRetriever.retrieve('export test 2');
      
      // Test JSON export
      const jsonExport = monitoringDashboard.exportMetrics('json');
      const jsonData = JSON.parse(jsonExport);
      expect(jsonData.performance.totalRequests).toBe(2);
      
      // Test CSV export
      const csvExport = monitoringDashboard.exportMetrics('csv');
      expect(csvExport).toContain('timestamp,query');
      expect(csvExport).toContain('export test 1');
      
      // Test Prometheus export
      const prometheusExport = monitoringDashboard.exportMetrics('prometheus');
      expect(prometheusExport).toContain('hybrid_retrieval_requests_total 2');
      expect(prometheusExport).toContain('hybrid_retrieval_latency_seconds');
      expect(prometheusExport).toContain('hybrid_retrieval_error_rate');
    });

    it('should provide query-specific debugging information', async () => {
      const testQuery = 'debug test query';
      
      // Perform retrieval
      await hybridRetriever.retrieve(testQuery);
      
      // Get debug info for the specific query
      const debugInfo = monitoringDashboard.getQueryDebugInfo(testQuery);
      
      expect(debugInfo.debugPaths).toHaveLength(1);
      expect(debugInfo.debugPaths[0].query).toBe(testQuery);
      
      expect(debugInfo.logEntries).toHaveLength(1);
      expect(debugInfo.logEntries[0].query).toBe(testQuery);
      
      expect(debugInfo.queryAnalysis.query).toBe(testQuery);
      expect(debugInfo.queryAnalysis.characteristics).toBeDefined();
      expect(debugInfo.queryAnalysis.predictions).toBeDefined();
    });

    it('should track system health over time', async () => {
      // Perform several successful retrievals
      for (let i = 0; i < 5; i++) {
        await hybridRetriever.retrieve(`health test ${i}`);
      }
      
      // Get health summary
      const healthSummary = monitoringDashboard.getHealthSummary();
      
      expect(healthSummary.status).toBe('healthy');
      expect(healthSummary.components.bm25).toBe('healthy');
      expect(healthSummary.alerts).toBe(0);
      expect(healthSummary.uptime).toBeGreaterThan(0);
      expect(healthSummary.lastCheck).toBeCloseTo(Date.now(), -2);
      
      // Verify real-time metrics
      const realtimeData = monitoringDashboard.getRealtimeData();
      expect(realtimeData.currentThroughput).toBeGreaterThan(0);
      expect(realtimeData.currentErrorRate).toBe(0); // No errors
      expect(realtimeData.componentStatus.bm25).toBe('healthy');
    });
  });

  describe('Performance Monitoring', () => {
    it('should track component-specific performance', async () => {
      await hybridRetriever.retrieve('performance test');
      
      const aggregated = retrievalMetricsCollector.getAggregatedMetrics(3600000);
      
      // Verify component latencies are tracked
      expect(aggregated.componentLatencies.bm25.avg).toBeGreaterThan(0);
      expect(aggregated.componentLatencies.bm25.p95).toBeGreaterThan(0);
      
      // Verify method usage rates
      expect(aggregated.methodUsageRates.bm25).toBe(1);
      expect(aggregated.methodUsageRates.vector).toBe(0); // Disabled
      expect(aggregated.methodUsageRates.expansion).toBe(0); // Disabled
      expect(aggregated.methodUsageRates.reranking).toBe(0); // Disabled
    });

    it('should calculate accurate performance percentiles', async () => {
      // Perform multiple retrievals to get statistical data
      const latencies: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const result = await hybridRetriever.retrieve(`percentile test ${i}`);
        latencies.push(result.metrics.totalTimeMs);
      }
      
      const aggregated = retrievalMetricsCollector.getAggregatedMetrics(3600000);
      
      expect(aggregated.totalRequests).toBe(10);
      expect(aggregated.averageLatencyMs).toBeGreaterThan(0);
      expect(aggregated.p50LatencyMs).toBeGreaterThan(0);
      expect(aggregated.p95LatencyMs).toBeGreaterThanOrEqual(aggregated.p50LatencyMs);
      expect(aggregated.p99LatencyMs).toBeGreaterThanOrEqual(aggregated.p95LatencyMs);
      expect(aggregated.maxLatencyMs).toBeGreaterThanOrEqual(aggregated.p99LatencyMs);
    });
  });

  describe('Alert System', () => {
    it('should not generate alerts for normal operation', async () => {
      // Perform normal retrievals
      await hybridRetriever.retrieve('normal test 1');
      await hybridRetriever.retrieve('normal test 2');
      
      // Get dashboard data (which checks for alerts)
      await monitoringDashboard.getDashboardData();
      
      // Verify no alerts were generated
      const activeAlerts = monitoringDashboard.getActiveAlerts();
      expect(activeAlerts).toHaveLength(0);
    });
  });

  describe('Data Export and Analysis', () => {
    it('should provide comprehensive log statistics', async () => {
      // Generate various types of operations
      await hybridRetriever.retrieve('stats test 1');
      await hybridRetriever.retrieve('stats test 2');
      await hybridRetriever.retrieve('stats test 3');
      
      const logStats = retrievalLogger.getLogStats();
      
      expect(logStats.totalEntries).toBe(3);
      expect(logStats.timeRange).toBeDefined();
      expect(logStats.timeRange!.start).toBeLessThanOrEqual(logStats.timeRange!.end);
      expect(logStats.averageLatency).toBeGreaterThan(0);
      expect(logStats.errorRate).toBe(0); // No errors in normal operation
      expect(logStats.fallbackRate).toBe(0); // No fallbacks in normal operation
      expect(logStats.expansionRate).toBe(0); // Expansion disabled
      expect(logStats.componentHealth.bm25).toBe(1); // All healthy
    });

    it('should support filtered log queries', async () => {
      // Generate logs with different characteristics
      await hybridRetriever.retrieve('filter test query');
      await hybridRetriever.retrieve('different query');
      
      // Test query filtering
      const filteredLogs = retrievalLogger.getFilteredLogs({ query: 'filter' });
      expect(filteredLogs).toHaveLength(1);
      expect(filteredLogs[0].query).toBe('filter test query');
      
      // Test time range filtering
      const recentLogs = retrievalLogger.getFilteredLogs({ timeRangeMs: 60000 }); // 1 minute
      expect(recentLogs).toHaveLength(2); // Both should be recent
      
      // Test expansion filtering (should be empty since expansion is disabled)
      const expansionLogs = retrievalLogger.getFilteredLogs({ expansionTriggered: true });
      expect(expansionLogs).toHaveLength(0);
    });
  });
});