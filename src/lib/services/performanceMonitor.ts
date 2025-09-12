// src/lib/services/performanceMonitor.ts
// Performance monitoring and cache efficiency metrics for hybrid retrieval

import { CacheManager, CacheStats } from './cacheManager';
import { CacheWarmingService, CacheWarmingStats } from './cacheWarming';
import { RetrievalMetrics } from './hybridRetrieval';

/**
 * Performance monitoring configuration
 */
export interface PerformanceMonitorConfig {
  // Monitoring settings
  enableMonitoring: boolean;
  metricsRetentionMs: number; // How long to keep metrics
  aggregationIntervalMs: number; // How often to aggregate metrics
  
  // Alerting thresholds
  maxMemoryUsageMB: number;
  minCacheHitRate: number;
  maxAverageLatencyMs: number;
  maxErrorRate: number;
  
  // Dashboard settings
  enableDashboard: boolean;
  dashboardUpdateIntervalMs: number;
  maxDataPoints: number;
  
  // Export settings
  enableMetricsExport: boolean;
  exportFormat: 'json' | 'csv' | 'prometheus';
  exportIntervalMs: number;
  exportPath: string;
}

/**
 * Performance metrics snapshot
 */
export interface PerformanceSnapshot {
  timestamp: number;
  
  // Cache performance
  cacheStats: CacheStats;
  memoryUsageMB: number;
  cacheEfficiencyScore: number; // 0-100
  
  // Retrieval performance
  averageRetrievalTimeMs: number;
  p95RetrievalTimeMs: number;
  retrievalThroughput: number; // requests per second
  errorRate: number;
  
  // Feature usage
  bm25UsagePercent: number;
  vectorUsagePercent: number;
  expansionUsagePercent: number;
  rerankingUsagePercent: number;
  
  // System health
  systemHealthScore: number; // 0-100
  componentHealth: {
    cache: 'healthy' | 'degraded' | 'unhealthy';
    retrieval: 'healthy' | 'degraded' | 'unhealthy';
    expansion: 'healthy' | 'degraded' | 'unhealthy';
    reranking: 'healthy' | 'degraded' | 'unhealthy';
  };
  
  // Alerts
  activeAlerts: PerformanceAlert[];
}

/**
 * Performance alert
 */
export interface PerformanceAlert {
  id: string;
  type: 'memory' | 'cache_hit_rate' | 'latency' | 'error_rate' | 'system_health';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  resolved: boolean;
}

/**
 * Aggregated performance metrics
 */
export interface AggregatedMetrics {
  timeRange: {
    start: number;
    end: number;
    durationMs: number;
  };
  
  // Cache metrics
  averageCacheHitRate: number;
  cacheHitRateTrend: 'improving' | 'stable' | 'degrading';
  totalCacheOperations: number;
  cacheEfficiencyTrend: 'improving' | 'stable' | 'degrading';
  
  // Performance metrics
  averageLatency: number;
  p95Latency: number;
  latencyTrend: 'improving' | 'stable' | 'degrading';
  totalRequests: number;
  throughputTrend: 'improving' | 'stable' | 'degrading';
  
  // Error metrics
  totalErrors: number;
  errorRate: number;
  errorTrend: 'improving' | 'stable' | 'degrading';
  
  // Resource usage
  peakMemoryUsageMB: number;
  averageMemoryUsageMB: number;
  memoryTrend: 'improving' | 'stable' | 'degrading';
  
  // Feature adoption
  featureUsage: {
    bm25: number;
    vector: number;
    expansion: number;
    reranking: number;
  };
  
  // System reliability
  uptimePercent: number;
  systemHealthScore: number;
  alertCount: number;
}

/**
 * Performance monitoring service
 */
export class PerformanceMonitor {
  private config: PerformanceMonitorConfig;
  private cacheManager: CacheManager;
  private cacheWarmingService: CacheWarmingService | null = null;
  
  private snapshots: PerformanceSnapshot[] = [];
  private retrievalMetrics: RetrievalMetrics[] = [];
  private activeAlerts: Map<string, PerformanceAlert> = new Map();
  
  private monitoringInterval: NodeJS.Timeout | null = null;
  private exportInterval: NodeJS.Timeout | null = null;
  private lastSnapshot: PerformanceSnapshot | null = null;

  constructor(config: Partial<PerformanceMonitorConfig>, cacheManager: CacheManager) {
    this.config = {
      enableMonitoring: config.enableMonitoring !== false,
      metricsRetentionMs: config.metricsRetentionMs || 24 * 60 * 60 * 1000, // 24 hours
      aggregationIntervalMs: config.aggregationIntervalMs || 60 * 1000, // 1 minute
      
      maxMemoryUsageMB: config.maxMemoryUsageMB || 200,
      minCacheHitRate: config.minCacheHitRate || 0.7,
      maxAverageLatencyMs: config.maxAverageLatencyMs || 500,
      maxErrorRate: config.maxErrorRate || 0.05,
      
      enableDashboard: config.enableDashboard !== false,
      dashboardUpdateIntervalMs: config.dashboardUpdateIntervalMs || 5000, // 5 seconds
      maxDataPoints: config.maxDataPoints || 1000,
      
      enableMetricsExport: config.enableMetricsExport || false,
      exportFormat: config.exportFormat || 'json',
      exportIntervalMs: config.exportIntervalMs || 5 * 60 * 1000, // 5 minutes
      exportPath: config.exportPath || './metrics'
    };

    this.cacheManager = cacheManager;

    if (this.config.enableMonitoring) {
      this.startMonitoring();
    }

    if (this.config.enableMetricsExport) {
      this.startMetricsExport();
    }

    console.log('performance_monitor_initialized', {
      monitoring_enabled: this.config.enableMonitoring,
      aggregation_interval_ms: this.config.aggregationIntervalMs,
      retention_hours: Math.round(this.config.metricsRetentionMs / (60 * 60 * 1000)),
      dashboard_enabled: this.config.enableDashboard,
      export_enabled: this.config.enableMetricsExport
    });
  }

  /**
   * Set cache warming service for monitoring
   */
  setCacheWarmingService(service: CacheWarmingService): void {
    this.cacheWarmingService = service;
  }

  /**
   * Record retrieval metrics for performance analysis
   */
  recordRetrievalMetrics(metrics: RetrievalMetrics): void {
    if (!this.config.enableMonitoring) {
      return;
    }

    this.retrievalMetrics.push({
      ...metrics,
      timestamp: Date.now()
    } as RetrievalMetrics & { timestamp: number });

    // Keep only recent metrics
    const cutoff = Date.now() - this.config.metricsRetentionMs;
    this.retrievalMetrics = this.retrievalMetrics.filter(m => 
      (m as any).timestamp > cutoff
    );

    // Check for performance alerts
    this.checkPerformanceAlerts(metrics);
  }

  /**
   * Get current performance snapshot
   */
  async getCurrentSnapshot(): Promise<PerformanceSnapshot> {
    const timestamp = Date.now();
    
    // Get cache statistics
    const cacheStats = await this.cacheManager.getStats();
    const memoryUsage = this.cacheManager.getMemoryUsage();
    
    // Calculate retrieval performance metrics
    const recentMetrics = this.getRecentRetrievalMetrics(5 * 60 * 1000); // Last 5 minutes
    const retrievalPerformance = this.calculateRetrievalPerformance(recentMetrics);
    
    // Calculate feature usage
    const featureUsage = this.calculateFeatureUsage(recentMetrics);
    
    // Calculate system health
    const systemHealth = this.calculateSystemHealth(cacheStats, retrievalPerformance, memoryUsage);
    
    // Get active alerts
    const activeAlerts = Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);

    const snapshot: PerformanceSnapshot = {
      timestamp,
      
      cacheStats,
      memoryUsageMB: memoryUsage.usedMB,
      cacheEfficiencyScore: this.calculateCacheEfficiencyScore(cacheStats),
      
      averageRetrievalTimeMs: retrievalPerformance.averageTimeMs,
      p95RetrievalTimeMs: retrievalPerformance.p95TimeMs,
      retrievalThroughput: retrievalPerformance.throughput,
      errorRate: retrievalPerformance.errorRate,
      
      bm25UsagePercent: featureUsage.bm25,
      vectorUsagePercent: featureUsage.vector,
      expansionUsagePercent: featureUsage.expansion,
      rerankingUsagePercent: featureUsage.reranking,
      
      systemHealthScore: systemHealth.overallScore,
      componentHealth: systemHealth.componentHealth,
      
      activeAlerts
    };

    this.lastSnapshot = snapshot;
    return snapshot;
  }

  /**
   * Get aggregated metrics for a time range
   */
  getAggregatedMetrics(startTime: number, endTime: number): AggregatedMetrics {
    const relevantSnapshots = this.snapshots.filter(s => 
      s.timestamp >= startTime && s.timestamp <= endTime
    );

    const relevantRetrievalMetrics = this.retrievalMetrics.filter(m => 
      (m as any).timestamp >= startTime && (m as any).timestamp <= endTime
    );

    if (relevantSnapshots.length === 0) {
      return this.createEmptyAggregatedMetrics(startTime, endTime);
    }

    // Calculate cache metrics
    const cacheHitRates = relevantSnapshots.map(s => s.cacheStats.overallHitRate);
    const averageCacheHitRate = cacheHitRates.reduce((sum, rate) => sum + rate, 0) / cacheHitRates.length;
    const cacheHitRateTrend = this.calculateTrend(cacheHitRates);

    // Calculate performance metrics
    const latencies = relevantSnapshots.map(s => s.averageRetrievalTimeMs);
    const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
    const p95Latencies = relevantSnapshots.map(s => s.p95RetrievalTimeMs);
    const p95Latency = Math.max(...p95Latencies);
    const latencyTrend = this.calculateTrend(latencies);

    // Calculate error metrics
    const errorRates = relevantSnapshots.map(s => s.errorRate);
    const errorRate = errorRates.reduce((sum, rate) => sum + rate, 0) / errorRates.length;
    const errorTrend = this.calculateTrend(errorRates, true); // Lower is better for errors

    // Calculate memory usage
    const memoryUsages = relevantSnapshots.map(s => s.memoryUsageMB);
    const averageMemoryUsageMB = memoryUsages.reduce((sum, mem) => sum + mem, 0) / memoryUsages.length;
    const peakMemoryUsageMB = Math.max(...memoryUsages);
    const memoryTrend = this.calculateTrend(memoryUsages, true); // Lower is better for memory

    // Calculate feature usage
    const featureUsage = {
      bm25: relevantSnapshots.reduce((sum, s) => sum + s.bm25UsagePercent, 0) / relevantSnapshots.length,
      vector: relevantSnapshots.reduce((sum, s) => sum + s.vectorUsagePercent, 0) / relevantSnapshots.length,
      expansion: relevantSnapshots.reduce((sum, s) => sum + s.expansionUsagePercent, 0) / relevantSnapshots.length,
      reranking: relevantSnapshots.reduce((sum, s) => sum + s.rerankingUsagePercent, 0) / relevantSnapshots.length
    };

    // Calculate system reliability
    const healthScores = relevantSnapshots.map(s => s.systemHealthScore);
    const systemHealthScore = healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length;
    const uptimePercent = healthScores.filter(score => score > 70).length / healthScores.length * 100;

    return {
      timeRange: {
        start: startTime,
        end: endTime,
        durationMs: endTime - startTime
      },
      
      averageCacheHitRate,
      cacheHitRateTrend,
      totalCacheOperations: relevantSnapshots.reduce((sum, s) => sum + s.cacheStats.totalHits + s.cacheStats.totalMisses, 0),
      cacheEfficiencyTrend: this.calculateTrend(relevantSnapshots.map(s => s.cacheEfficiencyScore)),
      
      averageLatency,
      p95Latency,
      latencyTrend,
      totalRequests: relevantRetrievalMetrics.length,
      throughputTrend: this.calculateTrend(relevantSnapshots.map(s => s.retrievalThroughput)),
      
      totalErrors: relevantRetrievalMetrics.reduce((sum, m) => sum + m.errors.length, 0),
      errorRate,
      errorTrend,
      
      peakMemoryUsageMB,
      averageMemoryUsageMB,
      memoryTrend,
      
      featureUsage,
      
      uptimePercent,
      systemHealthScore,
      alertCount: Array.from(this.activeAlerts.values()).filter(alert => 
        alert.timestamp >= startTime && alert.timestamp <= endTime
      ).length
    };
  }

  /**
   * Get performance dashboard data
   */
  getDashboardData(): {
    currentSnapshot: PerformanceSnapshot | null;
    recentSnapshots: PerformanceSnapshot[];
    aggregatedMetrics: AggregatedMetrics;
    activeAlerts: PerformanceAlert[];
    cacheWarmingStats: CacheWarmingStats | null;
  } {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    
    const recentSnapshots = this.snapshots
      .filter(s => s.timestamp >= oneHourAgo)
      .slice(-60); // Last 60 data points

    const aggregatedMetrics = this.getAggregatedMetrics(oneHourAgo, now);
    const activeAlerts = Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
    const cacheWarmingStats = this.cacheWarmingService?.getStats() || null;

    return {
      currentSnapshot: this.lastSnapshot,
      recentSnapshots,
      aggregatedMetrics,
      activeAlerts,
      cacheWarmingStats
    };
  }

  /**
   * Export metrics in specified format
   */
  async exportMetrics(): Promise<void> {
    if (!this.config.enableMetricsExport) {
      return;
    }

    try {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;
      const aggregatedMetrics = this.getAggregatedMetrics(oneHourAgo, now);

      const exportData = {
        timestamp: now,
        aggregatedMetrics,
        recentSnapshots: this.snapshots.slice(-100), // Last 100 snapshots
        activeAlerts: Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved)
      };

      const filename = `metrics-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${this.config.exportFormat}`;
      const filepath = `${this.config.exportPath}/${filename}`;

      let content: string;
      switch (this.config.exportFormat) {
        case 'json':
          content = JSON.stringify(exportData, null, 2);
          break;
        case 'csv':
          content = this.convertToCSV(exportData);
          break;
        case 'prometheus':
          content = this.convertToPrometheus(exportData);
          break;
        default:
          throw new Error(`Unsupported export format: ${this.config.exportFormat}`);
      }

      // In a real implementation, you'd write to file system
      console.log('metrics_exported', {
        format: this.config.exportFormat,
        filepath,
        size_bytes: content.length,
        snapshots_count: exportData.recentSnapshots.length,
        alerts_count: exportData.activeAlerts.length
      });

    } catch (error) {
      console.error('metrics_export_error', {
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.exportInterval) {
      clearInterval(this.exportInterval);
      this.exportInterval = null;
    }

    console.log('performance_monitor_destroyed');
  }

  // Private methods

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        const snapshot = await this.getCurrentSnapshot();
        this.snapshots.push(snapshot);

        // Keep only recent snapshots
        const cutoff = Date.now() - this.config.metricsRetentionMs;
        this.snapshots = this.snapshots.filter(s => s.timestamp > cutoff);

        // Limit total snapshots
        if (this.snapshots.length > this.config.maxDataPoints) {
          this.snapshots = this.snapshots.slice(-this.config.maxDataPoints);
        }

      } catch (error) {
        console.error('monitoring_snapshot_error', {
          error: error instanceof Error ? error.message : error
        });
      }
    }, this.config.aggregationIntervalMs);

    console.log('performance_monitoring_started', {
      interval_ms: this.config.aggregationIntervalMs
    });
  }

  private startMetricsExport(): void {
    this.exportInterval = setInterval(async () => {
      await this.exportMetrics();
    }, this.config.exportIntervalMs);

    console.log('metrics_export_started', {
      interval_ms: this.config.exportIntervalMs,
      format: this.config.exportFormat
    });
  }

  private getRecentRetrievalMetrics(timeWindowMs: number): RetrievalMetrics[] {
    const cutoff = Date.now() - timeWindowMs;
    return this.retrievalMetrics.filter(m => (m as any).timestamp > cutoff);
  }

  private calculateRetrievalPerformance(metrics: RetrievalMetrics[]): {
    averageTimeMs: number;
    p95TimeMs: number;
    throughput: number;
    errorRate: number;
  } {
    if (metrics.length === 0) {
      return { averageTimeMs: 0, p95TimeMs: 0, throughput: 0, errorRate: 0 };
    }

    const times = metrics.map(m => m.totalTimeMs);
    const averageTimeMs = times.reduce((sum, time) => sum + time, 0) / times.length;
    
    const sortedTimes = times.sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p95TimeMs = sortedTimes[p95Index] || 0;

    const timeSpanMs = 5 * 60 * 1000; // 5 minutes
    const throughput = (metrics.length * 1000) / timeSpanMs;

    const totalErrors = metrics.reduce((sum, m) => sum + m.errors.length, 0);
    const errorRate = totalErrors / metrics.length;

    return { averageTimeMs, p95TimeMs, throughput, errorRate };
  }

  private calculateFeatureUsage(metrics: RetrievalMetrics[]): {
    bm25: number;
    vector: number;
    expansion: number;
    reranking: number;
  } {
    if (metrics.length === 0) {
      return { bm25: 0, vector: 0, expansion: 0, reranking: 0 };
    }

    const bm25Usage = metrics.filter(m => m.methodsUsed.includes('bm25')).length / metrics.length * 100;
    const vectorUsage = metrics.filter(m => m.methodsUsed.includes('vector')).length / metrics.length * 100;
    const expansionUsage = metrics.filter(m => m.expansionTriggered).length / metrics.length * 100;
    const rerankingUsage = metrics.filter(m => m.rerankingApplied).length / metrics.length * 100;

    return {
      bm25: bm25Usage,
      vector: vectorUsage,
      expansion: expansionUsage,
      reranking: rerankingUsage
    };
  }

  private calculateSystemHealth(
    cacheStats: CacheStats,
    retrievalPerformance: any,
    memoryUsage: any
  ): {
    overallScore: number;
    componentHealth: PerformanceSnapshot['componentHealth'];
  } {
    // Calculate component health scores
    const cacheHealth = this.calculateComponentHealth('cache', {
      hitRate: cacheStats.overallHitRate,
      memoryUsage: memoryUsage.utilizationPercent
    });

    const retrievalHealth = this.calculateComponentHealth('retrieval', {
      averageLatency: retrievalPerformance.averageTimeMs,
      errorRate: retrievalPerformance.errorRate
    });

    const expansionHealth = this.calculateComponentHealth('expansion', {
      // Would need expansion-specific metrics
    });

    const rerankingHealth = this.calculateComponentHealth('reranking', {
      // Would need reranking-specific metrics
    });

    // Calculate overall score
    const healthScores = [
      this.healthToScore(cacheHealth),
      this.healthToScore(retrievalHealth),
      this.healthToScore(expansionHealth),
      this.healthToScore(rerankingHealth)
    ];

    const overallScore = healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length;

    return {
      overallScore,
      componentHealth: {
        cache: cacheHealth,
        retrieval: retrievalHealth,
        expansion: expansionHealth,
        reranking: rerankingHealth
      }
    };
  }

  private calculateComponentHealth(component: string, metrics: any): 'healthy' | 'degraded' | 'unhealthy' {
    // Simplified health calculation - in production, this would be more sophisticated
    switch (component) {
      case 'cache':
        if (metrics.hitRate > 0.8 && metrics.memoryUsage < 80) return 'healthy';
        if (metrics.hitRate > 0.6 && metrics.memoryUsage < 90) return 'degraded';
        return 'unhealthy';
      
      case 'retrieval':
        if (metrics.averageLatency < 300 && metrics.errorRate < 0.01) return 'healthy';
        if (metrics.averageLatency < 600 && metrics.errorRate < 0.05) return 'degraded';
        return 'unhealthy';
      
      default:
        return 'healthy'; // Default for components without specific metrics
    }
  }

  private healthToScore(health: 'healthy' | 'degraded' | 'unhealthy'): number {
    switch (health) {
      case 'healthy': return 100;
      case 'degraded': return 60;
      case 'unhealthy': return 20;
    }
  }

  private calculateCacheEfficiencyScore(cacheStats: CacheStats): number {
    // Combine hit rate and memory efficiency
    const hitRateScore = cacheStats.overallHitRate * 70; // 70% weight
    const memoryEfficiencyScore = Math.max(0, 100 - (cacheStats.memoryUsageMB / 10)) * 0.3; // 30% weight
    
    return Math.min(100, hitRateScore + memoryEfficiencyScore);
  }

  private calculateTrend(values: number[], lowerIsBetter = false): 'improving' | 'stable' | 'degrading' {
    if (values.length < 2) return 'stable';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    const threshold = 0.05; // 5% change threshold
    const change = (secondAvg - firstAvg) / firstAvg;

    if (Math.abs(change) < threshold) return 'stable';
    
    if (lowerIsBetter) {
      return change < 0 ? 'improving' : 'degrading';
    } else {
      return change > 0 ? 'improving' : 'degrading';
    }
  }

  private checkPerformanceAlerts(metrics: RetrievalMetrics): void {
    // Check latency alert
    if (metrics.totalTimeMs > this.config.maxAverageLatencyMs) {
      this.createAlert('latency', 'warning', 
        `High retrieval latency: ${metrics.totalTimeMs}ms`, 
        metrics.totalTimeMs, this.config.maxAverageLatencyMs);
    }

    // Check error rate alert
    const errorRate = metrics.errors.length / Math.max(1, metrics.resultCount);
    if (errorRate > this.config.maxErrorRate) {
      this.createAlert('error_rate', 'critical',
        `High error rate: ${(errorRate * 100).toFixed(1)}%`,
        errorRate, this.config.maxErrorRate);
    }
  }

  private createAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    message: string,
    value: number,
    threshold: number
  ): void {
    const id = `${type}_${Date.now()}`;
    const alert: PerformanceAlert = {
      id,
      type,
      severity,
      message,
      value,
      threshold,
      timestamp: Date.now(),
      resolved: false
    };

    this.activeAlerts.set(id, alert);

    console.warn('performance_alert_created', {
      id,
      type,
      severity,
      message,
      value,
      threshold
    });
  }

  private createEmptyAggregatedMetrics(startTime: number, endTime: number): AggregatedMetrics {
    return {
      timeRange: { start: startTime, end: endTime, durationMs: endTime - startTime },
      averageCacheHitRate: 0,
      cacheHitRateTrend: 'stable',
      totalCacheOperations: 0,
      cacheEfficiencyTrend: 'stable',
      averageLatency: 0,
      p95Latency: 0,
      latencyTrend: 'stable',
      totalRequests: 0,
      throughputTrend: 'stable',
      totalErrors: 0,
      errorRate: 0,
      errorTrend: 'stable',
      peakMemoryUsageMB: 0,
      averageMemoryUsageMB: 0,
      memoryTrend: 'stable',
      featureUsage: { bm25: 0, vector: 0, expansion: 0, reranking: 0 },
      uptimePercent: 100,
      systemHealthScore: 100,
      alertCount: 0
    };
  }

  private convertToCSV(data: any): string {
    // Simplified CSV conversion - in production, use a proper CSV library
    return 'timestamp,cache_hit_rate,average_latency,error_rate,memory_usage\n' +
           data.recentSnapshots.map((s: PerformanceSnapshot) => 
             `${s.timestamp},${s.cacheStats.overallHitRate},${s.averageRetrievalTimeMs},${s.errorRate},${s.memoryUsageMB}`
           ).join('\n');
  }

  private convertToPrometheus(data: any): string {
    // Simplified Prometheus format - in production, use a proper Prometheus client
    const timestamp = Date.now();
    return [
      `# HELP cache_hit_rate Cache hit rate`,
      `# TYPE cache_hit_rate gauge`,
      `cache_hit_rate ${data.aggregatedMetrics.averageCacheHitRate} ${timestamp}`,
      `# HELP average_latency_ms Average retrieval latency in milliseconds`,
      `# TYPE average_latency_ms gauge`,
      `average_latency_ms ${data.aggregatedMetrics.averageLatency} ${timestamp}`,
      `# HELP error_rate Error rate`,
      `# TYPE error_rate gauge`,
      `error_rate ${data.aggregatedMetrics.errorRate} ${timestamp}`
    ].join('\n');
  }
}

/**
 * Factory function to create performance monitor
 */
export function createPerformanceMonitor(cacheManager: CacheManager): PerformanceMonitor {
  const config: Partial<PerformanceMonitorConfig> = {
    enableMonitoring: process.env.PERF_MONITORING_ENABLED?.toLowerCase() !== 'false',
    aggregationIntervalMs: parseInt(process.env.PERF_AGGREGATION_INTERVAL_MS || '60000'),
    metricsRetentionMs: parseInt(process.env.PERF_RETENTION_HOURS || '24') * 60 * 60 * 1000,
    
    maxMemoryUsageMB: parseInt(process.env.PERF_MAX_MEMORY_MB || '200'),
    minCacheHitRate: parseFloat(process.env.PERF_MIN_CACHE_HIT_RATE || '0.7'),
    maxAverageLatencyMs: parseInt(process.env.PERF_MAX_LATENCY_MS || '500'),
    maxErrorRate: parseFloat(process.env.PERF_MAX_ERROR_RATE || '0.05'),
    
    enableDashboard: process.env.PERF_DASHBOARD_ENABLED?.toLowerCase() !== 'false',
    enableMetricsExport: process.env.PERF_EXPORT_ENABLED?.toLowerCase() === 'true',
    exportFormat: (process.env.PERF_EXPORT_FORMAT as any) || 'json',
    exportPath: process.env.PERF_EXPORT_PATH || './metrics'
  };

  return new PerformanceMonitor(config, cacheManager);
}