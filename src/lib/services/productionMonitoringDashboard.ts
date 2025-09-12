/**
 * Production Monitoring Dashboard for Hybrid Retrieval System
 * 
 * Provides real-time monitoring, alerting, and performance tracking
 * for the hybrid retrieval system in production environments.
 */

import { EventEmitter } from 'events';

export interface DashboardMetrics {
  // Real-time performance
  currentP95Latency: number;
  currentP99Latency: number;
  currentThroughput: number;
  errorRate: number;
  
  // Feature usage
  hybridUsagePercent: number;
  expansionTriggerRate: number;
  rerankingUsagePercent: number;
  
  // Quality indicators
  averageResultCount: number;
  averageConfidenceScore: number;
  cacheEfficiency: number;
  
  // System health
  embeddingCacheSize: number;
  vectorIndexSize: number;
  memoryUsageMB: number;
  
  // Error tracking
  recentErrors: ErrorSummary[];
  warningCount: number;
}

export interface ErrorSummary {
  timestamp: number;
  component: string;
  error: string;
  count: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: DashboardMetrics) => boolean;
  severity: 'warning' | 'critical';
  cooldownMs: number;
  lastTriggered?: number;
}

export interface AlertEvent {
  ruleId: string;
  ruleName: string;
  severity: 'warning' | 'critical';
  timestamp: number;
  metrics: DashboardMetrics;
  message: string;
}

export interface PerformanceReport {
  timeRange: {
    start: number;
    end: number;
  };
  summary: {
    totalQueries: number;
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
    errorRate: number;
    cacheHitRate: number;
  };
  trends: {
    latencyTrend: 'improving' | 'stable' | 'degrading';
    throughputTrend: 'increasing' | 'stable' | 'decreasing';
    errorTrend: 'improving' | 'stable' | 'worsening';
  };
  semanticAccuracy: {
    goldenQueryAccuracy: number;
    averageRelevanceScore: number;
    semanticConnectionSuccess: number;
  };
  recommendations: string[];
}

export class ProductionMonitoringDashboard extends EventEmitter {
  private metrics: DashboardMetrics;
  private alertRules: Map<string, AlertRule>;
  private metricsHistory: Array<{ timestamp: number; metrics: DashboardMetrics }>;
  private maxHistorySize: number;
  private updateInterval: NodeJS.Timeout | null;

  constructor(options: {
    maxHistorySize?: number;
    updateIntervalMs?: number;
  } = {}) {
    super();
    
    this.maxHistorySize = options.maxHistorySize || 1000;
    this.updateInterval = null;
    this.metricsHistory = [];
    this.alertRules = new Map();
    
    this.metrics = {
      currentP95Latency: 0,
      currentP99Latency: 0,
      currentThroughput: 0,
      errorRate: 0,
      hybridUsagePercent: 0,
      expansionTriggerRate: 0,
      rerankingUsagePercent: 0,
      averageResultCount: 0,
      averageConfidenceScore: 0,
      cacheEfficiency: 0,
      embeddingCacheSize: 0,
      vectorIndexSize: 0,
      memoryUsageMB: 0,
      recentErrors: [],
      warningCount: 0
    };

    this.setupDefaultAlertRules();
  }

  /**
   * Start the monitoring dashboard with periodic updates
   */
  start(updateIntervalMs: number = 30000): void {
    if (this.updateInterval) {
      this.stop();
    }

    this.updateInterval = setInterval(() => {
      this.updateMetrics();
      this.checkAlerts();
    }, updateIntervalMs);

    console.log('Production monitoring dashboard started');
    this.emit('dashboard:started');
  }

  /**
   * Stop the monitoring dashboard
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    console.log('Production monitoring dashboard stopped');
    this.emit('dashboard:stopped');
  }

  /**
   * Get current dashboard metrics
   */
  getCurrentMetrics(): DashboardMetrics {
    return { ...this.metrics };
  }

  /**
   * Update metrics from external sources
   */
  updateMetricsFromSource(newMetrics: Partial<DashboardMetrics>): void {
    this.metrics = { ...this.metrics, ...newMetrics };
    
    // Store in history
    this.metricsHistory.push({
      timestamp: Date.now(),
      metrics: { ...this.metrics }
    });

    // Trim history if needed
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
    }

    this.emit('metrics:updated', this.metrics);
    
    // Check alerts immediately when metrics are updated
    this.checkAlerts();
  }

  /**
   * Add custom alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    console.log(`Alert rule added: ${rule.name}`);
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId);
    console.log(`Alert rule removed: ${ruleId}`);
  }

  /**
   * Get metrics history for a time range
   */
  getMetricsHistory(startTime: number, endTime: number): Array<{ timestamp: number; metrics: DashboardMetrics }> {
    return this.metricsHistory.filter(
      entry => entry.timestamp >= startTime && entry.timestamp <= endTime
    );
  }

  /**
   * Generate performance report for a time period
   */
  generatePerformanceReport(startTime: number, endTime: number): PerformanceReport {
    const historyData = this.getMetricsHistory(startTime, endTime);
    
    if (historyData.length === 0) {
      throw new Error('No data available for the specified time range');
    }

    const latencies = historyData.map(d => d.metrics.currentP95Latency);
    const throughputs = historyData.map(d => d.metrics.currentThroughput);
    const errorRates = historyData.map(d => d.metrics.errorRate);
    const cacheHitRates = historyData.map(d => d.metrics.cacheEfficiency);

    const summary = {
      totalQueries: historyData.reduce((sum, d) => sum + d.metrics.currentThroughput, 0),
      averageLatency: this.calculateAverage(latencies),
      p95Latency: this.calculatePercentile(latencies, 0.95),
      p99Latency: this.calculatePercentile(latencies, 0.99),
      errorRate: this.calculateAverage(errorRates),
      cacheHitRate: this.calculateAverage(cacheHitRates)
    };

    const trends = {
      latencyTrend: this.calculateTrend(latencies) as 'improving' | 'stable' | 'degrading',
      throughputTrend: this.calculateTrend(throughputs) as 'increasing' | 'stable' | 'decreasing',
      errorTrend: this.calculateTrend(errorRates) as 'improving' | 'stable' | 'worsening'
    };

    const semanticAccuracy = {
      goldenQueryAccuracy: this.calculateAverage(historyData.map(d => d.metrics.averageConfidenceScore)),
      averageRelevanceScore: this.calculateAverage(historyData.map(d => d.metrics.averageConfidenceScore)),
      semanticConnectionSuccess: this.calculateAverage(historyData.map(d => d.metrics.hybridUsagePercent))
    };

    const recommendations = this.generateRecommendations(summary, trends, semanticAccuracy);

    return {
      timeRange: { start: startTime, end: endTime },
      summary,
      trends,
      semanticAccuracy,
      recommendations
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    const timestamp = Date.now();
    const metrics = this.metrics;

    return [
      `# HELP hybrid_retrieval_latency_p95 95th percentile latency in milliseconds`,
      `# TYPE hybrid_retrieval_latency_p95 gauge`,
      `hybrid_retrieval_latency_p95 ${metrics.currentP95Latency} ${timestamp}`,
      
      `# HELP hybrid_retrieval_latency_p99 99th percentile latency in milliseconds`,
      `# TYPE hybrid_retrieval_latency_p99 gauge`,
      `hybrid_retrieval_latency_p99 ${metrics.currentP99Latency} ${timestamp}`,
      
      `# HELP hybrid_retrieval_throughput Current throughput in queries per second`,
      `# TYPE hybrid_retrieval_throughput gauge`,
      `hybrid_retrieval_throughput ${metrics.currentThroughput} ${timestamp}`,
      
      `# HELP hybrid_retrieval_error_rate Error rate as percentage`,
      `# TYPE hybrid_retrieval_error_rate gauge`,
      `hybrid_retrieval_error_rate ${metrics.errorRate} ${timestamp}`,
      
      `# HELP hybrid_retrieval_cache_efficiency Cache hit rate as percentage`,
      `# TYPE hybrid_retrieval_cache_efficiency gauge`,
      `hybrid_retrieval_cache_efficiency ${metrics.cacheEfficiency} ${timestamp}`,
      
      `# HELP hybrid_retrieval_memory_usage Memory usage in MB`,
      `# TYPE hybrid_retrieval_memory_usage gauge`,
      `hybrid_retrieval_memory_usage ${metrics.memoryUsageMB} ${timestamp}`,
      
      `# HELP hybrid_retrieval_feature_usage_hybrid Hybrid retrieval usage percentage`,
      `# TYPE hybrid_retrieval_feature_usage_hybrid gauge`,
      `hybrid_retrieval_feature_usage_hybrid ${metrics.hybridUsagePercent} ${timestamp}`,
      
      `# HELP hybrid_retrieval_feature_usage_expansion Query expansion trigger rate`,
      `# TYPE hybrid_retrieval_feature_usage_expansion gauge`,
      `hybrid_retrieval_feature_usage_expansion ${metrics.expansionTriggerRate} ${timestamp}`,
      
      `# HELP hybrid_retrieval_feature_usage_reranking Reranking usage percentage`,
      `# TYPE hybrid_retrieval_feature_usage_reranking gauge`,
      `hybrid_retrieval_feature_usage_reranking ${metrics.rerankingUsagePercent} ${timestamp}`
    ].join('\n');
  }

  private setupDefaultAlertRules(): void {
    // High latency alert
    this.addAlertRule({
      id: 'high_latency',
      name: 'High P95 Latency',
      condition: (metrics) => metrics.currentP95Latency > 1000,
      severity: 'warning',
      cooldownMs: 300000 // 5 minutes
    });

    // Critical latency alert
    this.addAlertRule({
      id: 'critical_latency',
      name: 'Critical P95 Latency',
      condition: (metrics) => metrics.currentP95Latency > 2000,
      severity: 'critical',
      cooldownMs: 300000
    });

    // High error rate alert
    this.addAlertRule({
      id: 'high_error_rate',
      name: 'High Error Rate',
      condition: (metrics) => metrics.errorRate > 5,
      severity: 'warning',
      cooldownMs: 300000
    });

    // Critical error rate alert
    this.addAlertRule({
      id: 'critical_error_rate',
      name: 'Critical Error Rate',
      condition: (metrics) => metrics.errorRate > 15,
      severity: 'critical',
      cooldownMs: 180000 // 3 minutes
    });

    // Low cache efficiency alert
    this.addAlertRule({
      id: 'low_cache_efficiency',
      name: 'Low Cache Efficiency',
      condition: (metrics) => metrics.cacheEfficiency < 50,
      severity: 'warning',
      cooldownMs: 600000 // 10 minutes
    });

    // High memory usage alert
    this.addAlertRule({
      id: 'high_memory_usage',
      name: 'High Memory Usage',
      condition: (metrics) => metrics.memoryUsageMB > 1000,
      severity: 'warning',
      cooldownMs: 300000
    });
  }

  private updateMetrics(): void {
    // This would typically collect metrics from various sources
    // For now, we'll emit an event that external systems can listen to
    this.emit('metrics:collect');
  }

  private checkAlerts(): void {
    const now = Date.now();

    for (const [ruleId, rule] of this.alertRules) {
      // Check cooldown
      if (rule.lastTriggered && (now - rule.lastTriggered) < rule.cooldownMs) {
        continue;
      }

      // Check condition
      if (rule.condition(this.metrics)) {
        const alertEvent: AlertEvent = {
          ruleId,
          ruleName: rule.name,
          severity: rule.severity,
          timestamp: now,
          metrics: { ...this.metrics },
          message: this.generateAlertMessage(rule, this.metrics)
        };

        rule.lastTriggered = now;
        this.emit('alert:triggered', alertEvent);
        
        console.warn(`Alert triggered: ${rule.name}`, {
          severity: rule.severity,
          metrics: this.metrics
        });
      }
    }
  }

  private generateAlertMessage(rule: AlertRule, metrics: DashboardMetrics): string {
    switch (rule.id) {
      case 'high_latency':
        return `P95 latency is ${metrics.currentP95Latency}ms (threshold: 1000ms)`;
      case 'critical_latency':
        return `P95 latency is critically high at ${metrics.currentP95Latency}ms (threshold: 2000ms)`;
      case 'high_error_rate':
        return `Error rate is ${metrics.errorRate}% (threshold: 5%)`;
      case 'critical_error_rate':
        return `Error rate is critically high at ${metrics.errorRate}% (threshold: 15%)`;
      case 'low_cache_efficiency':
        return `Cache efficiency is ${metrics.cacheEfficiency}% (threshold: 50%)`;
      case 'high_memory_usage':
        return `Memory usage is ${metrics.memoryUsageMB}MB (threshold: 1000MB)`;
      default:
        return `Alert condition met for rule: ${rule.name}`;
    }
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }

  private calculateTrend(values: number[]): string {
    if (values.length < 2) return 'stable';
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = this.calculateAverage(firstHalf);
    const secondAvg = this.calculateAverage(secondHalf);
    
    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (Math.abs(changePercent) < 5) return 'stable';
    return changePercent > 0 ? 'increasing' : 'decreasing';
  }

  private generateRecommendations(
    summary: PerformanceReport['summary'],
    trends: PerformanceReport['trends'],
    semanticAccuracy: PerformanceReport['semanticAccuracy']
  ): string[] {
    const recommendations: string[] = [];

    if (summary.p95Latency > 800) {
      recommendations.push('Consider optimizing vector search performance or increasing cache size');
    }

    if (summary.errorRate > 3) {
      recommendations.push('Investigate error patterns and improve fallback mechanisms');
    }

    if (summary.cacheHitRate < 60) {
      recommendations.push('Review cache warming strategies and increase cache TTL');
    }

    if (trends.latencyTrend === 'degrading') {
      recommendations.push('Latency is trending upward - monitor system resources and query complexity');
    }

    if (trends.errorTrend === 'worsening') {
      recommendations.push('Error rate is increasing - check external service health and timeout configurations');
    }

    if (semanticAccuracy.goldenQueryAccuracy < 0.8) {
      recommendations.push('Semantic accuracy is below target - consider retraining embeddings or adjusting fusion weights');
    }

    if (recommendations.length === 0) {
      recommendations.push('System performance is within acceptable ranges');
    }

    return recommendations;
  }
}