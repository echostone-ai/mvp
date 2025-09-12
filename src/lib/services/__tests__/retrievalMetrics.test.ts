// src/lib/services/__tests__/retrievalMetrics.test.ts
// Tests for retrieval metrics collection and aggregation

import { describe, it, expect, beforeEach } from 'vitest';
import { RetrievalMetricsCollector } from '../retrievalMetrics';
import { RetrievalLogEntry } from '../retrievalLogger';

describe('RetrievalMetricsCollector', () => {
  let collector: RetrievalMetricsCollector;
  let mockLogEntry: RetrievalLogEntry;

  beforeEach(() => {
    collector = new RetrievalMetricsCollector({
      maxMetricsHistory: 100,
      aggregationIntervalMs: 1000 // 1 second for testing
    });

    mockLogEntry = {
      timestamp: Date.now(),
      query: 'test query',
      queryHash: 'abc123',
      totalTimeMs: 150,
      bm25TimeMs: 50,
      vectorTimeMs: 60,
      expansionTimeMs: 30,
      rerankTimeMs: 10,
      fusionTimeMs: 5,
      resultCount: 3,
      hitIds: ['hit1', 'hit2', 'hit3'],
      confidenceScores: [0.8, 0.7, 0.6],
      topScore: 0.85,
      averageScore: 0.7,
      methodsUsed: ['bm25', 'vector', 'fusion', 'expansion'],
      fallbackLevel: 'none',
      expansionTriggered: true,
      rerankingApplied: false,
      cacheHit: false,
      embeddingCacheHits: 2,
      expansionCacheHits: 1,
      componentStatus: {
        bm25: 'healthy',
        vector: 'healthy',
        expansion: 'healthy',
        reranking: 'disabled'
      },
      errors: [],
      warnings: ['Test warning'],
      expansionReason: 'low_top_score',
      memoryUsageMB: 128,
      timeoutOccurred: false,
      config: {
        enableEmbeddings: true,
        enableExpansion: 'auto',
        enableReranking: false,
        expansionThreshold: 0.3,
        maxResults: 10
      }
    };
  });

  describe('recordRetrieval', () => {
    it('should record a retrieval operation', () => {
      collector.recordRetrieval(mockLogEntry);
      
      const aggregated = collector.getAggregatedMetrics(3600000); // 1 hour
      expect(aggregated.totalRequests).toBe(1);
      expect(aggregated.averageLatencyMs).toBe(150);
      expect(aggregated.averageResultCount).toBe(3);
    });

    it('should maintain history size limit', () => {
      const smallCollector = new RetrievalMetricsCollector({ maxMetricsHistory: 2 });
      
      // Add 3 entries
      smallCollector.recordRetrieval({ ...mockLogEntry, query: 'query1' });
      smallCollector.recordRetrieval({ ...mockLogEntry, query: 'query2' });
      smallCollector.recordRetrieval({ ...mockLogEntry, query: 'query3' });
      
      const aggregated = smallCollector.getAggregatedMetrics(3600000);
      expect(aggregated.totalRequests).toBe(2); // Only last 2 should remain
    });
  });

  describe('getAggregatedMetrics', () => {
    beforeEach(() => {
      // Add multiple entries with different characteristics
      collector.recordRetrieval(mockLogEntry);
      
      collector.recordRetrieval({
        ...mockLogEntry,
        query: 'query2',
        totalTimeMs: 200,
        resultCount: 5,
        expansionTriggered: false,
        errors: ['Test error'],
        fallbackLevel: 'bm25_only'
      });
      
      collector.recordRetrieval({
        ...mockLogEntry,
        query: 'query3',
        totalTimeMs: 100,
        resultCount: 1,
        rerankingApplied: true,
        methodsUsed: ['bm25', 'vector', 'fusion', 'reranking']
      });
    });

    it('should calculate correct performance metrics', () => {
      const aggregated = collector.getAggregatedMetrics(3600000);
      
      expect(aggregated.totalRequests).toBe(3);
      expect(aggregated.averageLatencyMs).toBe(150); // (150 + 200 + 100) / 3
      expect(aggregated.p50LatencyMs).toBe(150);
      expect(aggregated.p95LatencyMs).toBe(200);
      expect(aggregated.p99LatencyMs).toBe(200);
      expect(aggregated.maxLatencyMs).toBe(200);
    });

    it('should calculate correct quality metrics', () => {
      const aggregated = collector.getAggregatedMetrics(3600000);
      
      expect(aggregated.averageResultCount).toBe(3); // (3 + 5 + 1) / 3
      expect(aggregated.averageConfidenceScore).toBe(0.85); // Average of topScore
      expect(aggregated.cacheHitRate).toBe(0); // No cache hits
    });

    it('should calculate correct feature usage rates', () => {
      const aggregated = collector.getAggregatedMetrics(3600000);
      
      expect(aggregated.methodUsageRates.bm25).toBe(1); // All use BM25
      expect(aggregated.methodUsageRates.vector).toBe(1); // All use vector
      expect(aggregated.methodUsageRates.expansion).toBe(2/3); // 2 out of 3 (first and third entries)
      expect(aggregated.methodUsageRates.reranking).toBe(1/3); // 1 out of 3
      expect(aggregated.methodUsageRates.fusion).toBe(1); // All use fusion
    });

    it('should calculate correct error and fallback rates', () => {
      const aggregated = collector.getAggregatedMetrics(3600000);
      
      expect(aggregated.errorRate).toBe(1/3); // 1 out of 3 has errors
      expect(aggregated.fallbackRate).toBe(1/3); // 1 out of 3 uses fallback
      expect(aggregated.fallbackBreakdown.bm25_only).toBe(1/3);
      expect(aggregated.fallbackBreakdown.basic_hybrid).toBe(0);
      expect(aggregated.fallbackBreakdown.empty).toBe(0);
    });

    it('should calculate component health rates', () => {
      const aggregated = collector.getAggregatedMetrics(3600000);
      
      expect(aggregated.componentHealthRates.bm25).toBe(1); // All healthy
      expect(aggregated.componentHealthRates.vector).toBe(1); // All healthy
      expect(aggregated.componentHealthRates.expansion).toBe(1); // All healthy
      expect(aggregated.componentHealthRates.reranking).toBe(0); // All disabled
    });

    it('should calculate expansion trigger analysis', () => {
      const aggregated = collector.getAggregatedMetrics(3600000);
      
      expect(aggregated.expansionTriggerRate).toBe(2/3); // 2 out of 3
      expect(aggregated.expansionReasons.low_top_score).toBe(1); // 1 out of 2 expansion triggers
    });

    it('should include top queries and errors', () => {
      const aggregated = collector.getAggregatedMetrics(3600000);
      
      expect(aggregated.topQueries).toHaveLength(3);
      expect(aggregated.topQueries[0].query).toBe('test query');
      expect(aggregated.topQueries[0].count).toBe(1);
      
      expect(aggregated.topErrors).toHaveLength(1);
      expect(aggregated.topErrors[0].error).toBe('Test error');
      expect(aggregated.topErrors[0].count).toBe(1);
    });

    it('should handle empty metrics', () => {
      const emptyCollector = new RetrievalMetricsCollector();
      const aggregated = emptyCollector.getAggregatedMetrics(3600000);
      
      expect(aggregated.totalRequests).toBe(0);
      expect(aggregated.averageLatencyMs).toBe(0);
      expect(aggregated.errorRate).toBe(0);
      expect(aggregated.topQueries).toHaveLength(0);
      expect(aggregated.topErrors).toHaveLength(0);
    });

    it('should filter by time window', () => {
      const now = Date.now();
      const oldEntry = {
        ...mockLogEntry,
        timestamp: now - 7200000, // 2 hours ago
        query: 'old query'
      };
      
      collector.recordRetrieval(oldEntry);
      
      // 1 hour window should exclude the old entry
      const aggregated = collector.getAggregatedMetrics(3600000);
      expect(aggregated.totalRequests).toBe(3); // Only recent entries
      
      // 3 hour window should include the old entry
      const aggregatedLong = collector.getAggregatedMetrics(10800000);
      expect(aggregatedLong.totalRequests).toBe(4); // All entries
    });
  });

  describe('getRealtimeMetrics', () => {
    beforeEach(() => {
      // Add some recent entries
      const now = Date.now();
      collector.recordRetrieval({ ...mockLogEntry, timestamp: now - 30000 }); // 30s ago
      collector.recordRetrieval({ ...mockLogEntry, timestamp: now - 60000 }); // 1m ago
      collector.recordRetrieval({ ...mockLogEntry, timestamp: now - 120000 }); // 2m ago
    });

    it('should calculate current throughput', () => {
      const realtime = collector.getRealtimeMetrics();
      
      expect(realtime.currentThroughput).toBeGreaterThan(0);
      expect(realtime.timestamp).toBeCloseTo(Date.now(), -2); // Within 100ms
    });

    it('should calculate current P95 latency', () => {
      const realtime = collector.getRealtimeMetrics();
      
      expect(realtime.currentP95Latency).toBe(150); // All entries have same latency
    });

    it('should calculate component status', () => {
      const realtime = collector.getRealtimeMetrics();
      
      expect(realtime.componentStatus.bm25).toBe('healthy');
      expect(realtime.componentStatus.vector).toBe('healthy');
      expect(realtime.componentStatus.expansion).toBe('healthy');
      expect(realtime.componentStatus.reranking).toBe('failed'); // Based on recent health (disabled counts as failed)
    });

    it('should calculate cache efficiency', () => {
      const realtime = collector.getRealtimeMetrics();
      
      expect(realtime.cacheEfficiency.hitRate).toBe(0); // No cache hits in test data
      expect(realtime.cacheEfficiency.memoryUsageMB).toBe(128);
    });
  });

  describe('getPerformanceTrend', () => {
    beforeEach(() => {
      const now = Date.now();
      const interval = 300000; // 5 minutes
      
      // Add entries across different time intervals
      for (let i = 0; i < 5; i++) {
        collector.recordRetrieval({
          ...mockLogEntry,
          timestamp: now - (i * interval),
          totalTimeMs: 100 + (i * 20), // Increasing latency
          query: `query${i}`
        });
      }
    });

    it('should generate performance trend data', () => {
      const trends = collector.getPerformanceTrend(1800000, 300000); // 30 min, 5 min intervals
      
      expect(trends).toHaveLength(6); // 30/5 = 6 intervals
      
      // Check that trends have required properties
      trends.forEach(trend => {
        expect(trend).toHaveProperty('timestamp');
        expect(trend).toHaveProperty('latencyMs');
        expect(trend).toHaveProperty('throughput');
        expect(trend).toHaveProperty('errorRate');
        expect(trend).toHaveProperty('cacheHitRate');
      });
    });

    it('should handle empty intervals', () => {
      const emptyCollector = new RetrievalMetricsCollector();
      const trends = emptyCollector.getPerformanceTrend(1800000, 300000);
      
      expect(trends).toHaveLength(6);
      trends.forEach(trend => {
        expect(trend.latencyMs).toBe(0);
        expect(trend.throughput).toBe(0);
        expect(trend.errorRate).toBe(0);
        expect(trend.cacheHitRate).toBe(0);
      });
    });
  });

  describe('exportPrometheusMetrics', () => {
    beforeEach(() => {
      collector.recordRetrieval(mockLogEntry);
    });

    it('should export metrics in Prometheus format', () => {
      const prometheus = collector.exportPrometheusMetrics();
      
      expect(prometheus).toContain('# HELP hybrid_retrieval_requests_total');
      expect(prometheus).toContain('# TYPE hybrid_retrieval_requests_total counter');
      expect(prometheus).toContain('hybrid_retrieval_requests_total 1');
      
      expect(prometheus).toContain('# HELP hybrid_retrieval_latency_seconds');
      expect(prometheus).toContain('hybrid_retrieval_latency_seconds{quantile="0.95"}');
      
      expect(prometheus).toContain('# HELP hybrid_retrieval_error_rate');
      expect(prometheus).toContain('hybrid_retrieval_error_rate 0');
      
      expect(prometheus).toContain('# HELP hybrid_retrieval_cache_hit_rate');
      expect(prometheus).toContain('hybrid_retrieval_cache_hit_rate 0');
    });

    it('should include component health metrics', () => {
      const prometheus = collector.exportPrometheusMetrics();
      
      expect(prometheus).toContain('# HELP hybrid_retrieval_component_health');
      expect(prometheus).toContain('hybrid_retrieval_component_health{component="bm25"} 1');
      expect(prometheus).toContain('hybrid_retrieval_component_health{component="vector"} 1');
    });

    it('should include feature usage metrics', () => {
      const prometheus = collector.exportPrometheusMetrics();
      
      expect(prometheus).toContain('# HELP hybrid_retrieval_feature_usage_rate');
      expect(prometheus).toContain('hybrid_retrieval_feature_usage_rate{feature="expansion"}');
      expect(prometheus).toContain('hybrid_retrieval_feature_usage_rate{feature="reranking"}');
    });
  });

  describe('getQueryAnalysis', () => {
    beforeEach(() => {
      // Add queries of different lengths and patterns
      collector.recordRetrieval({ ...mockLogEntry, query: 'short' }); // Short query
      collector.recordRetrieval({ ...mockLogEntry, query: 'this is a medium length query' }); // Medium query
      collector.recordRetrieval({ ...mockLogEntry, query: 'this is a very long query that exceeds fifty characters in total length' }); // Long query
      collector.recordRetrieval({ ...mockLogEntry, query: 'short' }); // Duplicate short query
    });

    it('should analyze query patterns', () => {
      const analysis = collector.getQueryAnalysis(3600000);
      
      expect(analysis.totalQueries).toBe(4);
      expect(analysis.uniqueQueries).toBe(3);
      
      expect(analysis.queryPatterns.shortQueries).toBe(2); // 'short' appears twice
      expect(analysis.queryPatterns.mediumQueries).toBe(1);
      expect(analysis.queryPatterns.longQueries).toBe(1);
    });

    it('should identify top queries', () => {
      const analysis = collector.getQueryAnalysis(3600000);
      
      expect(analysis.topQueries).toHaveLength(3);
      expect(analysis.topQueries[0].query).toBe('short');
      expect(analysis.topQueries[0].count).toBe(2);
      expect(analysis.topQueries[0].avgLatency).toBe(150);
      expect(analysis.topQueries[0].errorRate).toBe(0);
    });
  });

  describe('clearMetrics', () => {
    it('should clear all metrics', () => {
      collector.recordRetrieval(mockLogEntry);
      expect(collector.getAggregatedMetrics(3600000).totalRequests).toBe(1);
      
      collector.clearMetrics();
      expect(collector.getAggregatedMetrics(3600000).totalRequests).toBe(0);
    });
  });
});