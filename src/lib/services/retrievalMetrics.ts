// src/lib/services/retrievalMetrics.ts
// Comprehensive metrics collection and aggregation for hybrid retrieval system

import { RetrievalMetrics, RetrievalResult } from './hybridRetrieval';
import { RetrievalLogEntry } from './retrievalLogger';

/**
 * Aggregated metrics for monitoring dashboard
 */
export interface AggregatedRetrievalMetrics {
  // Time window
  timeWindowMs: number;
  startTime: number;
  endTime: number;
  
  // Volume metrics
  totalRequests: number;
  requestsPerSecond: number;
  
  // Performance metrics
  averageLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  maxLatencyMs: number;
  
  // Component performance breakdown
  componentLatencies: {
    bm25: { avg: number; p95: number };
    vector: { avg: number; p95: number };
    expansion: { avg: number; p95: number };
    reranking: { avg: number; p95: number };
    fusion: { avg: number; p95: number };
  };
  
  // Quality metrics
  averageResultCount: number;
  averageConfidenceScore: number;
  averageTopScore: number;
  
  // Feature usage rates
  methodUsageRates: {
    bm25: number;
    vector: number;
    expansion: number;
    reranking: number;
    fusion: number;
  };
  
  // Cache performance
  cacheHitRate: number;
  embeddingCacheHitRate: number;
  expansionCacheHitRate: number;
  
  // Error and fallback rates
  errorRate: number;
  fallbackRate: number;
  fallbackBreakdown: {
    basic_hybrid: number;
    bm25_only: number;
    empty: number;
  };
  
  // Component health rates
  componentHealthRates: {
    bm25: number;
    vector: number;
    expansion: number;
    reranking: number;
  };
  
  // Expansion trigger analysis
  expansionTriggerRate: number;
  expansionReasons: {
    low_top_score: number;
    few_results: number;
    empty_results: number;
  };
  
  // Top queries and patterns
  topQueries: Array<{
    query: string;
    count: number;
    avgLatency: number;
    avgResultCount: number;
  }>;
  
  // Error patterns
  topErrors: Array<{
    error: string;
    count: number;
    component?: string;
  }>;
}

/**
 * Real-time metrics for monitoring dashboard
 */
export interface RealtimeMetrics {
  timestamp: number;
  
  // Current performance
  currentThroughput: number; // requests per second
  currentP95Latency: number;
  currentErrorRate: number;
  
  // Component status
  componentStatus: {
    bm25: 'healthy' | 'degraded' | 'failed';
    vector: 'healthy' | 'degraded' | 'failed' | 'disabled';
    expansion: 'healthy' | 'degraded' | 'failed' | 'disabled';
    reranking: 'healthy' | 'degraded' | 'failed' | 'disabled';
  };
  
  // Cache efficiency
  cacheEfficiency: {
    hitRate: number;
    size: number;
    memoryUsageMB: number;
  };
  
  // Recent activity
  recentQueries: number; // last 5 minutes
  recentErrors: number;
  recentFallbacks: number;
}

/**
 * Performance trend data for dashboard charts
 */
export interface PerformanceTrend {
  timestamp: number;
  latencyMs: number;
  throughput: number;
  errorRate: number;
  cacheHitRate: number;
}

/**
 * Metrics collector and aggregator for hybrid retrieval system
 */
export class RetrievalMetricsCollector {
  private metrics: RetrievalLogEntry[] = [];
  private maxMetricsHistory: number = 10000;
  private aggregationIntervalMs: number = 60000; // 1 minute
  private lastAggregation: number = 0;
  private cachedAggregation: AggregatedRetrievalMetrics | null = null;
  
  constructor(options?: {
    maxMetricsHistory?: number;
    aggregationIntervalMs?: number;
  }) {
    this.maxMetricsHistory = options?.maxMetricsHistory || 10000;
    this.aggregationIntervalMs = options?.aggregationIntervalMs || 60000;
  }
  
  /**
   * Record a retrieval operation for metrics collection
   */
  recordRetrieval(logEntry: RetrievalLogEntry): void {
    this.metrics.push(logEntry);
    
    // Maintain history size limit
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }
    
    // Invalidate cached aggregation if needed
    if (this.cachedAggregation && 
        (Date.now() - this.lastAggregation) > this.aggregationIntervalMs) {
      this.cachedAggregation = null;
    }
  }
  
  /**
   * Get aggregated metrics for a time window
   */
  getAggregatedMetrics(timeWindowMs: number = 3600000): AggregatedRetrievalMetrics {
    const now = Date.now();
    const startTime = now - timeWindowMs;
    
    // Use cached aggregation if recent enough
    if (this.cachedAggregation && 
        (now - this.lastAggregation) < this.aggregationIntervalMs &&
        this.cachedAggregation.timeWindowMs === timeWindowMs) {
      return this.cachedAggregation;
    }
    
    // Filter metrics to time window
    const windowMetrics = this.metrics.filter(m => m.timestamp >= startTime);
    
    if (windowMetrics.length === 0) {
      return this.getEmptyAggregation(timeWindowMs, startTime, now);
    }
    
    // Calculate aggregated metrics
    const aggregation = this.calculateAggregation(windowMetrics, timeWindowMs, startTime, now);
    
    // Cache the result
    this.cachedAggregation = aggregation;
    this.lastAggregation = now;
    
    return aggregation;
  }
  
  /**
   * Get real-time metrics for dashboard
   */
  getRealtimeMetrics(): RealtimeMetrics {
    const now = Date.now();
    const last5Minutes = now - (5 * 60 * 1000);
    const last1Minute = now - (1 * 60 * 1000);
    
    const recent5MinMetrics = this.metrics.filter(m => m.timestamp >= last5Minutes);
    const recent1MinMetrics = this.metrics.filter(m => m.timestamp >= last1Minute);
    
    // Calculate current throughput (requests per second)
    const currentThroughput = recent1MinMetrics.length / 60;
    
    // Calculate current P95 latency
    const recentLatencies = recent5MinMetrics.map(m => m.totalTimeMs).sort((a, b) => a - b);
    const currentP95Latency = recentLatencies.length > 0 
      ? recentLatencies[Math.floor(recentLatencies.length * 0.95)] 
      : 0;
    
    // Calculate current error rate
    const recentErrors = recent5MinMetrics.filter(m => m.errors.length > 0);
    const currentErrorRate = recent5MinMetrics.length > 0 
      ? recentErrors.length / recent5MinMetrics.length 
      : 0;
    
    // Determine component status based on recent health
    const componentStatus = this.calculateComponentStatus(recent5MinMetrics);
    
    // Calculate cache efficiency
    const cacheHits = recent5MinMetrics.filter(m => m.cacheHit).length;
    const cacheEfficiency = {
      hitRate: recent5MinMetrics.length > 0 ? cacheHits / recent5MinMetrics.length : 0,
      size: 0, // Would need to be provided by cache manager
      memoryUsageMB: this.calculateAverageMemoryUsage(recent5MinMetrics)
    };
    
    return {
      timestamp: now,
      currentThroughput,
      currentP95Latency,
      currentErrorRate,
      componentStatus,
      cacheEfficiency,
      recentQueries: recent5MinMetrics.length,
      recentErrors: recentErrors.length,
      recentFallbacks: recent5MinMetrics.filter(m => m.fallbackLevel !== 'none').length
    };
  }
  
  /**
   * Get performance trend data for charts
   */
  getPerformanceTrend(
    timeWindowMs: number = 3600000, 
    intervalMs: number = 300000 // 5 minute intervals
  ): PerformanceTrend[] {
    const now = Date.now();
    const startTime = now - timeWindowMs;
    const intervals = Math.ceil(timeWindowMs / intervalMs);
    
    const trends: PerformanceTrend[] = [];
    
    for (let i = 0; i < intervals; i++) {
      const intervalStart = startTime + (i * intervalMs);
      const intervalEnd = intervalStart + intervalMs;
      
      const intervalMetrics = this.metrics.filter(m => 
        m.timestamp >= intervalStart && m.timestamp < intervalEnd
      );
      
      if (intervalMetrics.length === 0) {
        trends.push({
          timestamp: intervalStart,
          latencyMs: 0,
          throughput: 0,
          errorRate: 0,
          cacheHitRate: 0
        });
        continue;
      }
      
      // Calculate interval metrics
      const latencies = intervalMetrics.map(m => m.totalTimeMs).sort((a, b) => a - b);
      const p95Latency = latencies[Math.floor(latencies.length * 0.95)] || 0;
      
      const throughput = intervalMetrics.length / (intervalMs / 1000);
      
      const errors = intervalMetrics.filter(m => m.errors.length > 0);
      const errorRate = errors.length / intervalMetrics.length;
      
      const cacheHits = intervalMetrics.filter(m => m.cacheHit);
      const cacheHitRate = cacheHits.length / intervalMetrics.length;
      
      trends.push({
        timestamp: intervalStart,
        latencyMs: p95Latency,
        throughput,
        errorRate,
        cacheHitRate
      });
    }
    
    return trends;
  }
  
  /**
   * Export metrics for external monitoring systems (Prometheus, etc.)
   */
  exportPrometheusMetrics(): string {
    const aggregated = this.getAggregatedMetrics();
    const realtime = this.getRealtimeMetrics();
    
    const metrics = [
      // Request metrics
      `# HELP hybrid_retrieval_requests_total Total number of retrieval requests`,
      `# TYPE hybrid_retrieval_requests_total counter`,
      `hybrid_retrieval_requests_total ${aggregated.totalRequests}`,
      
      // Latency metrics
      `# HELP hybrid_retrieval_latency_seconds Request latency in seconds`,
      `# TYPE hybrid_retrieval_latency_seconds histogram`,
      `hybrid_retrieval_latency_seconds{quantile="0.5"} ${aggregated.p50LatencyMs / 1000}`,
      `hybrid_retrieval_latency_seconds{quantile="0.95"} ${aggregated.p95LatencyMs / 1000}`,
      `hybrid_retrieval_latency_seconds{quantile="0.99"} ${aggregated.p99LatencyMs / 1000}`,
      
      // Component latencies
      `# HELP hybrid_retrieval_component_latency_seconds Component latency in seconds`,
      `# TYPE hybrid_retrieval_component_latency_seconds histogram`,
      `hybrid_retrieval_component_latency_seconds{component="bm25",quantile="0.95"} ${aggregated.componentLatencies.bm25.p95 / 1000}`,
      `hybrid_retrieval_component_latency_seconds{component="vector",quantile="0.95"} ${aggregated.componentLatencies.vector.p95 / 1000}`,
      `hybrid_retrieval_component_latency_seconds{component="expansion",quantile="0.95"} ${aggregated.componentLatencies.expansion.p95 / 1000}`,
      `hybrid_retrieval_component_latency_seconds{component="reranking",quantile="0.95"} ${aggregated.componentLatencies.reranking.p95 / 1000}`,
      
      // Error rate
      `# HELP hybrid_retrieval_error_rate Error rate (0-1)`,
      `# TYPE hybrid_retrieval_error_rate gauge`,
      `hybrid_retrieval_error_rate ${aggregated.errorRate}`,
      
      // Cache hit rate
      `# HELP hybrid_retrieval_cache_hit_rate Cache hit rate (0-1)`,
      `# TYPE hybrid_retrieval_cache_hit_rate gauge`,
      `hybrid_retrieval_cache_hit_rate ${aggregated.cacheHitRate}`,
      
      // Component health
      `# HELP hybrid_retrieval_component_health Component health rate (0-1)`,
      `# TYPE hybrid_retrieval_component_health gauge`,
      `hybrid_retrieval_component_health{component="bm25"} ${aggregated.componentHealthRates.bm25}`,
      `hybrid_retrieval_component_health{component="vector"} ${aggregated.componentHealthRates.vector}`,
      `hybrid_retrieval_component_health{component="expansion"} ${aggregated.componentHealthRates.expansion}`,
      `hybrid_retrieval_component_health{component="reranking"} ${aggregated.componentHealthRates.reranking}`,
      
      // Feature usage
      `# HELP hybrid_retrieval_feature_usage_rate Feature usage rate (0-1)`,
      `# TYPE hybrid_retrieval_feature_usage_rate gauge`,
      `hybrid_retrieval_feature_usage_rate{feature="expansion"} ${aggregated.methodUsageRates.expansion}`,
      `hybrid_retrieval_feature_usage_rate{feature="reranking"} ${aggregated.methodUsageRates.reranking}`,
      `hybrid_retrieval_feature_usage_rate{feature="vector"} ${aggregated.methodUsageRates.vector}`,
      
      // Fallback rate
      `# HELP hybrid_retrieval_fallback_rate Fallback usage rate (0-1)`,
      `# TYPE hybrid_retrieval_fallback_rate gauge`,
      `hybrid_retrieval_fallback_rate ${aggregated.fallbackRate}`,
      
      // Current throughput
      `# HELP hybrid_retrieval_throughput_rps Current throughput in requests per second`,
      `# TYPE hybrid_retrieval_throughput_rps gauge`,
      `hybrid_retrieval_throughput_rps ${realtime.currentThroughput}`
    ];
    
    return metrics.join('\n') + '\n';
  }
  
  /**
   * Get detailed query analysis
   */
  getQueryAnalysis(timeWindowMs: number = 3600000): {
    totalQueries: number;
    uniqueQueries: number;
    topQueries: Array<{
      query: string;
      count: number;
      avgLatency: number;
      avgResultCount: number;
      errorRate: number;
    }>;
    queryPatterns: {
      shortQueries: number; // < 10 chars
      mediumQueries: number; // 10-50 chars
      longQueries: number; // > 50 chars
    };
  } {
    const now = Date.now();
    const startTime = now - timeWindowMs;
    const windowMetrics = this.metrics.filter(m => m.timestamp >= startTime);
    
    // Group by query
    const queryGroups = new Map<string, RetrievalLogEntry[]>();
    windowMetrics.forEach(metric => {
      const existing = queryGroups.get(metric.query) || [];
      existing.push(metric);
      queryGroups.set(metric.query, existing);
    });
    
    // Calculate top queries
    const topQueries = Array.from(queryGroups.entries())
      .map(([query, entries]) => ({
        query,
        count: entries.length,
        avgLatency: entries.reduce((sum, e) => sum + e.totalTimeMs, 0) / entries.length,
        avgResultCount: entries.reduce((sum, e) => sum + e.resultCount, 0) / entries.length,
        errorRate: entries.filter(e => e.errors.length > 0).length / entries.length
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
    
    // Calculate query patterns
    const queryPatterns = {
      shortQueries: windowMetrics.filter(m => m.query.length < 10).length,
      mediumQueries: windowMetrics.filter(m => m.query.length >= 10 && m.query.length <= 50).length,
      longQueries: windowMetrics.filter(m => m.query.length > 50).length
    };
    
    return {
      totalQueries: windowMetrics.length,
      uniqueQueries: queryGroups.size,
      topQueries,
      queryPatterns
    };
  }
  
  /**
   * Clear metrics history
   */
  clearMetrics(): void {
    this.metrics = [];
    this.cachedAggregation = null;
    this.lastAggregation = 0;
  }
  
  // Private helper methods
  
  private calculateAggregation(
    metrics: RetrievalLogEntry[],
    timeWindowMs: number,
    startTime: number,
    endTime: number
  ): AggregatedRetrievalMetrics {
    const totalRequests = metrics.length;
    const requestsPerSecond = totalRequests / (timeWindowMs / 1000);
    
    // Latency calculations
    const latencies = metrics.map(m => m.totalTimeMs).sort((a, b) => a - b);
    const averageLatencyMs = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    const p50LatencyMs = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95LatencyMs = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99LatencyMs = latencies[Math.floor(latencies.length * 0.99)] || 0;
    const maxLatencyMs = latencies[latencies.length - 1] || 0;
    
    // Component latencies
    const componentLatencies = this.calculateComponentLatencies(metrics);
    
    // Quality metrics
    const averageResultCount = metrics.reduce((sum, m) => sum + m.resultCount, 0) / totalRequests;
    const averageConfidenceScore = metrics.reduce((sum, m) => sum + (m.topScore || 0), 0) / totalRequests;
    const averageTopScore = metrics.filter(m => m.topScore).reduce((sum, m) => sum + m.topScore!, 0) / 
                           metrics.filter(m => m.topScore).length || 0;
    
    // Feature usage rates
    const methodUsageRates = this.calculateMethodUsageRates(metrics);
    
    // Cache performance
    const cacheHitRate = metrics.filter(m => m.cacheHit).length / totalRequests;
    const embeddingCacheHitRate = this.calculateAverageEmbeddingCacheHitRate(metrics);
    const expansionCacheHitRate = this.calculateAverageExpansionCacheHitRate(metrics);
    
    // Error and fallback rates
    const errorRate = metrics.filter(m => m.errors.length > 0).length / totalRequests;
    const fallbackRate = metrics.filter(m => m.fallbackLevel !== 'none').length / totalRequests;
    const fallbackBreakdown = this.calculateFallbackBreakdown(metrics);
    
    // Component health rates
    const componentHealthRates = this.calculateComponentHealthRates(metrics);
    
    // Expansion analysis
    const expansionTriggerRate = metrics.filter(m => m.expansionTriggered).length / totalRequests;
    const expansionReasons = this.calculateExpansionReasons(metrics);
    
    // Top queries
    const topQueries = this.calculateTopQueries(metrics);
    
    // Top errors
    const topErrors = this.calculateTopErrors(metrics);
    
    return {
      timeWindowMs,
      startTime,
      endTime,
      totalRequests,
      requestsPerSecond,
      averageLatencyMs,
      p50LatencyMs,
      p95LatencyMs,
      p99LatencyMs,
      maxLatencyMs,
      componentLatencies,
      averageResultCount,
      averageConfidenceScore,
      averageTopScore,
      methodUsageRates,
      cacheHitRate,
      embeddingCacheHitRate,
      expansionCacheHitRate,
      errorRate,
      fallbackRate,
      fallbackBreakdown,
      componentHealthRates,
      expansionTriggerRate,
      expansionReasons,
      topQueries,
      topErrors
    };
  }
  
  private getEmptyAggregation(timeWindowMs: number, startTime: number, endTime: number): AggregatedRetrievalMetrics {
    return {
      timeWindowMs,
      startTime,
      endTime,
      totalRequests: 0,
      requestsPerSecond: 0,
      averageLatencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      maxLatencyMs: 0,
      componentLatencies: {
        bm25: { avg: 0, p95: 0 },
        vector: { avg: 0, p95: 0 },
        expansion: { avg: 0, p95: 0 },
        reranking: { avg: 0, p95: 0 },
        fusion: { avg: 0, p95: 0 }
      },
      averageResultCount: 0,
      averageConfidenceScore: 0,
      averageTopScore: 0,
      methodUsageRates: {
        bm25: 0,
        vector: 0,
        expansion: 0,
        reranking: 0,
        fusion: 0
      },
      cacheHitRate: 0,
      embeddingCacheHitRate: 0,
      expansionCacheHitRate: 0,
      errorRate: 0,
      fallbackRate: 0,
      fallbackBreakdown: {
        basic_hybrid: 0,
        bm25_only: 0,
        empty: 0
      },
      componentHealthRates: {
        bm25: 0,
        vector: 0,
        expansion: 0,
        reranking: 0
      },
      expansionTriggerRate: 0,
      expansionReasons: {
        low_top_score: 0,
        few_results: 0,
        empty_results: 0
      },
      topQueries: [],
      topErrors: []
    };
  }
  
  private calculateComponentLatencies(metrics: RetrievalLogEntry[]) {
    const components = ['bm25', 'vector', 'expansion', 'reranking', 'fusion'] as const;
    const result: any = {};
    
    components.forEach(component => {
      const componentMetrics = metrics
        .map(m => m[`${component}TimeMs` as keyof RetrievalLogEntry] as number)
        .filter(t => t !== undefined && t > 0)
        .sort((a, b) => a - b);
      
      if (componentMetrics.length > 0) {
        const avg = componentMetrics.reduce((sum, t) => sum + t, 0) / componentMetrics.length;
        const p95 = componentMetrics[Math.floor(componentMetrics.length * 0.95)] || 0;
        result[component] = { avg, p95 };
      } else {
        result[component] = { avg: 0, p95: 0 };
      }
    });
    
    return result;
  }
  
  private calculateMethodUsageRates(metrics: RetrievalLogEntry[]) {
    const total = metrics.length;
    if (total === 0) {
      return { bm25: 0, vector: 0, expansion: 0, reranking: 0, fusion: 0 };
    }
    
    return {
      bm25: metrics.filter(m => m.methodsUsed.includes('bm25')).length / total,
      vector: metrics.filter(m => m.methodsUsed.includes('vector')).length / total,
      expansion: metrics.filter(m => m.methodsUsed.includes('expansion')).length / total,
      reranking: metrics.filter(m => m.methodsUsed.includes('reranking')).length / total,
      fusion: metrics.filter(m => m.methodsUsed.includes('fusion')).length / total
    };
  }
  
  private calculateComponentStatus(metrics: RetrievalLogEntry[]) {
    if (metrics.length === 0) {
      return {
        bm25: 'healthy' as const,
        vector: 'healthy' as const,
        expansion: 'healthy' as const,
        reranking: 'healthy' as const
      };
    }
    
    const components = ['bm25', 'vector', 'expansion', 'reranking'] as const;
    const result: any = {};
    
    components.forEach(component => {
      const healthyCount = metrics.filter(m => 
        m.componentStatus[component] === 'healthy'
      ).length;
      const healthRate = healthyCount / metrics.length;
      
      if (healthRate >= 0.95) {
        result[component] = 'healthy';
      } else if (healthRate >= 0.8) {
        result[component] = 'degraded';
      } else {
        result[component] = 'failed';
      }
    });
    
    return result;
  }
  
  private calculateAverageMemoryUsage(metrics: RetrievalLogEntry[]): number {
    const memoryMetrics = metrics
      .map(m => m.memoryUsageMB)
      .filter(m => m !== undefined) as number[];
    
    if (memoryMetrics.length === 0) return 0;
    
    return memoryMetrics.reduce((sum, m) => sum + m, 0) / memoryMetrics.length;
  }
  
  private calculateAverageEmbeddingCacheHitRate(metrics: RetrievalLogEntry[]): number {
    const cacheMetrics = metrics
      .map(m => m.embeddingCacheHits)
      .filter(h => h !== undefined) as number[];
    
    if (cacheMetrics.length === 0) return 0;
    
    return cacheMetrics.reduce((sum, h) => sum + h, 0) / cacheMetrics.length;
  }
  
  private calculateAverageExpansionCacheHitRate(metrics: RetrievalLogEntry[]): number {
    const cacheMetrics = metrics
      .map(m => m.expansionCacheHits)
      .filter(h => h !== undefined) as number[];
    
    if (cacheMetrics.length === 0) return 0;
    
    return cacheMetrics.reduce((sum, h) => sum + h, 0) / cacheMetrics.length;
  }
  
  private calculateFallbackBreakdown(metrics: RetrievalLogEntry[]) {
    const total = metrics.length;
    if (total === 0) {
      return { basic_hybrid: 0, bm25_only: 0, empty: 0 };
    }
    
    return {
      basic_hybrid: metrics.filter(m => m.fallbackLevel === 'basic_hybrid').length / total,
      bm25_only: metrics.filter(m => m.fallbackLevel === 'bm25_only').length / total,
      empty: metrics.filter(m => m.fallbackLevel === 'empty').length / total
    };
  }
  
  private calculateComponentHealthRates(metrics: RetrievalLogEntry[]) {
    const total = metrics.length;
    if (total === 0) {
      return { bm25: 0, vector: 0, expansion: 0, reranking: 0 };
    }
    
    return {
      bm25: metrics.filter(m => m.componentStatus.bm25 === 'healthy').length / total,
      vector: metrics.filter(m => m.componentStatus.vector === 'healthy').length / total,
      expansion: metrics.filter(m => m.componentStatus.expansion === 'healthy').length / total,
      reranking: metrics.filter(m => m.componentStatus.reranking === 'healthy').length / total
    };
  }
  
  private calculateExpansionReasons(metrics: RetrievalLogEntry[]) {
    const expansionMetrics = metrics.filter(m => m.expansionTriggered);
    const total = expansionMetrics.length;
    
    if (total === 0) {
      return { low_top_score: 0, few_results: 0, empty_results: 0 };
    }
    
    return {
      low_top_score: expansionMetrics.filter(m => m.expansionReason === 'low_top_score').length / total,
      few_results: expansionMetrics.filter(m => m.expansionReason === 'few_results').length / total,
      empty_results: expansionMetrics.filter(m => m.expansionReason === 'empty_results').length / total
    };
  }
  
  private calculateTopQueries(metrics: RetrievalLogEntry[]) {
    const queryGroups = new Map<string, RetrievalLogEntry[]>();
    
    metrics.forEach(metric => {
      const existing = queryGroups.get(metric.query) || [];
      existing.push(metric);
      queryGroups.set(metric.query, existing);
    });
    
    return Array.from(queryGroups.entries())
      .map(([query, entries]) => ({
        query,
        count: entries.length,
        avgLatency: entries.reduce((sum, e) => sum + e.totalTimeMs, 0) / entries.length,
        avgResultCount: entries.reduce((sum, e) => sum + e.resultCount, 0) / entries.length
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
  
  private calculateTopErrors(metrics: RetrievalLogEntry[]) {
    const errorCounts = new Map<string, number>();
    
    metrics.forEach(metric => {
      metric.errors.forEach(error => {
        errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
      });
    });
    
    return Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
}

/**
 * Global metrics collector instance
 */
export const retrievalMetricsCollector = new RetrievalMetricsCollector({
  maxMetricsHistory: parseInt(process.env.RETRIEVAL_METRICS_HISTORY_SIZE || '10000'),
  aggregationIntervalMs: parseInt(process.env.RETRIEVAL_METRICS_AGGREGATION_INTERVAL_MS || '60000')
});