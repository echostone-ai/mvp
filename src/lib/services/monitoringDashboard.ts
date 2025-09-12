// src/lib/services/monitoringDashboard.ts
// Monitoring dashboard integration for hybrid retrieval system

import { 
  AggregatedRetrievalMetrics, 
  RealtimeMetrics, 
  PerformanceTrend,
  retrievalMetricsCollector 
} from './retrievalMetrics';
import { retrievalLogger } from './retrievalLogger';
import { retrievalDebugger } from './retrievalDebugger';

/**
 * Dashboard data structure for monitoring UI
 */
export interface DashboardData {
  // Timestamp and metadata
  timestamp: number;
  timeWindow: string;
  
  // Real-time performance indicators
  realtime: {
    currentThroughput: number;
    currentP95Latency: number;
    currentErrorRate: number;
    systemStatus: 'healthy' | 'degraded' | 'unhealthy';
  };
  
  // Aggregated performance metrics
  performance: {
    totalRequests: number;
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
    requestsPerSecond: number;
  };
  
  // Component health and performance
  components: {
    bm25: ComponentHealth;
    vector: ComponentHealth;
    expansion: ComponentHealth;
    reranking: ComponentHealth;
  };
  
  // Feature usage statistics
  features: {
    hybridUsagePercent: number;
    expansionTriggerRate: number;
    rerankingUsagePercent: number;
    fallbackRate: number;
  };
  
  // Quality indicators
  quality: {
    averageResultCount: number;
    averageConfidenceScore: number;
    averageTopScore: number;
    cacheHitRate: number;
  };
  
  // System health indicators
  system: {
    memoryUsageMB: number;
    cacheEfficiency: number;
    componentAvailability: number;
    errorPatterns: Array<{ error: string; count: number }>;
  };
  
  // Performance trends for charts
  trends: {
    latency: PerformanceTrend[];
    throughput: PerformanceTrend[];
    errorRate: PerformanceTrend[];
    cacheHitRate: PerformanceTrend[];
  };
  
  // Top queries and analysis
  queries: {
    topQueries: Array<{
      query: string;
      count: number;
      avgLatency: number;
      avgResultCount: number;
    }>;
    queryPatterns: {
      shortQueries: number;
      mediumQueries: number;
      longQueries: number;
    };
  };
  
  // Recent activity and alerts
  activity: {
    recentErrors: number;
    recentFallbacks: number;
    activeAlerts: Alert[];
    recentQueries: number;
  };
}

/**
 * Component health information
 */
export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'failed' | 'disabled';
  availability: number; // 0-1
  averageLatency: number;
  p95Latency: number;
  errorRate: number;
  lastError?: string;
  lastErrorTime?: number;
}

/**
 * Alert information for monitoring
 */
export interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  component: string;
  message: string;
  timestamp: number;
  resolved: boolean;
  details?: Record<string, any>;
}

/**
 * Dashboard configuration options
 */
export interface DashboardConfig {
  // Time windows for different views
  defaultTimeWindow: number; // milliseconds
  trendIntervals: number; // milliseconds between trend points
  
  // Alert thresholds
  alertThresholds: {
    latencyP95Ms: number;
    errorRatePercent: number;
    fallbackRatePercent: number;
    cacheHitRatePercent: number;
    componentAvailabilityPercent: number;
  };
  
  // Refresh intervals
  realtimeRefreshMs: number;
  aggregatedRefreshMs: number;
  
  // Data retention
  maxTrendPoints: number;
  maxAlerts: number;
}

/**
 * Monitoring dashboard service for hybrid retrieval system
 */
export class MonitoringDashboard {
  private config: DashboardConfig;
  private alerts: Alert[] = [];
  private alertIdCounter: number = 1;
  private lastAlertCheck: number = 0;
  
  constructor(config?: Partial<DashboardConfig>) {
    this.config = {
      defaultTimeWindow: 3600000, // 1 hour
      trendIntervals: 300000, // 5 minutes
      alertThresholds: {
        latencyP95Ms: 1000,
        errorRatePercent: 5,
        fallbackRatePercent: 10,
        cacheHitRatePercent: 70,
        componentAvailabilityPercent: 95
      },
      realtimeRefreshMs: 30000, // 30 seconds
      aggregatedRefreshMs: 300000, // 5 minutes
      maxTrendPoints: 288, // 24 hours at 5-minute intervals
      maxAlerts: 100,
      ...config
    };
  }
  
  /**
   * Get complete dashboard data
   */
  async getDashboardData(timeWindowMs?: number): Promise<DashboardData> {
    const window = timeWindowMs || this.config.defaultTimeWindow;
    
    // Get aggregated metrics
    const aggregated = retrievalMetricsCollector.getAggregatedMetrics(window);
    const realtime = retrievalMetricsCollector.getRealtimeMetrics();
    const trends = retrievalMetricsCollector.getPerformanceTrend(window, this.config.trendIntervals);
    const queryAnalysis = retrievalMetricsCollector.getQueryAnalysis(window);
    
    // Check for alerts
    await this.checkAlerts(aggregated, realtime);
    
    // Build dashboard data
    const dashboardData: DashboardData = {
      timestamp: Date.now(),
      timeWindow: this.formatTimeWindow(window),
      
      realtime: {
        currentThroughput: realtime.currentThroughput,
        currentP95Latency: realtime.currentP95Latency,
        currentErrorRate: realtime.currentErrorRate,
        systemStatus: this.calculateSystemStatus(realtime)
      },
      
      performance: {
        totalRequests: aggregated.totalRequests,
        averageLatency: aggregated.averageLatencyMs,
        p95Latency: aggregated.p95LatencyMs,
        p99Latency: aggregated.p99LatencyMs,
        requestsPerSecond: aggregated.requestsPerSecond
      },
      
      components: {
        bm25: this.buildComponentHealth('bm25', aggregated, realtime),
        vector: this.buildComponentHealth('vector', aggregated, realtime),
        expansion: this.buildComponentHealth('expansion', aggregated, realtime),
        reranking: this.buildComponentHealth('reranking', aggregated, realtime)
      },
      
      features: {
        hybridUsagePercent: (aggregated.methodUsageRates.vector + aggregated.methodUsageRates.fusion) * 100,
        expansionTriggerRate: aggregated.expansionTriggerRate * 100,
        rerankingUsagePercent: aggregated.methodUsageRates.reranking * 100,
        fallbackRate: aggregated.fallbackRate * 100
      },
      
      quality: {
        averageResultCount: aggregated.averageResultCount,
        averageConfidenceScore: aggregated.averageConfidenceScore,
        averageTopScore: aggregated.averageTopScore,
        cacheHitRate: aggregated.cacheHitRate * 100
      },
      
      system: {
        memoryUsageMB: realtime.cacheEfficiency.memoryUsageMB,
        cacheEfficiency: realtime.cacheEfficiency.hitRate * 100,
        componentAvailability: this.calculateComponentAvailability(aggregated),
        errorPatterns: aggregated.topErrors
      },
      
      trends: {
        latency: trends,
        throughput: trends,
        errorRate: trends,
        cacheHitRate: trends
      },
      
      queries: {
        topQueries: queryAnalysis.topQueries,
        queryPatterns: queryAnalysis.queryPatterns
      },
      
      activity: {
        recentErrors: realtime.recentErrors,
        recentFallbacks: realtime.recentFallbacks,
        activeAlerts: this.getActiveAlerts(),
        recentQueries: realtime.recentQueries
      }
    };
    
    return dashboardData;
  }
  
  /**
   * Get real-time metrics for live dashboard updates
   */
  getRealtimeData(): RealtimeMetrics {
    return retrievalMetricsCollector.getRealtimeMetrics();
  }
  
  /**
   * Get performance trends for charts
   */
  getPerformanceTrends(
    timeWindowMs: number = this.config.defaultTimeWindow,
    intervalMs: number = this.config.trendIntervals
  ): PerformanceTrend[] {
    return retrievalMetricsCollector.getPerformanceTrend(timeWindowMs, intervalMs);
  }
  
  /**
   * Get component-specific health data
   */
  getComponentHealth(component: string): ComponentHealth | null {
    const aggregated = retrievalMetricsCollector.getAggregatedMetrics();
    const realtime = retrievalMetricsCollector.getRealtimeMetrics();
    
    if (!['bm25', 'vector', 'expansion', 'reranking'].includes(component)) {
      return null;
    }
    
    return this.buildComponentHealth(component as any, aggregated, realtime);
  }
  
  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }
  
  /**
   * Get all alerts (including resolved)
   */
  getAllAlerts(limit: number = 50): Alert[] {
    return this.alerts
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
  
  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      return true;
    }
    return false;
  }
  
  /**
   * Get debug information for a specific query
   */
  getQueryDebugInfo(query: string): any {
    const debugHistory = retrievalDebugger.getQueryDebugHistory(query);
    const logHistory = retrievalLogger.getFilteredLogs({ query });
    
    return {
      debugPaths: debugHistory,
      logEntries: logHistory,
      queryAnalysis: retrievalDebugger.analyzeQuery(query)
    };
  }
  
  /**
   * Export dashboard data for external monitoring
   */
  exportMetrics(format: 'prometheus' | 'json' | 'csv' = 'json'): string {
    switch (format) {
      case 'prometheus':
        return retrievalMetricsCollector.exportPrometheusMetrics();
      
      case 'json':
        return JSON.stringify(this.getDashboardData(), null, 2);
      
      case 'csv':
        return retrievalLogger.exportLogs('csv');
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
  
  /**
   * Get system health summary
   */
  getHealthSummary(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, string>;
    alerts: number;
    uptime: number;
    lastCheck: number;
  } {
    const realtime = retrievalMetricsCollector.getRealtimeMetrics();
    const activeAlerts = this.getActiveAlerts();
    
    return {
      status: this.calculateSystemStatus(realtime),
      components: {
        bm25: realtime.componentStatus.bm25,
        vector: realtime.componentStatus.vector,
        expansion: realtime.componentStatus.expansion,
        reranking: realtime.componentStatus.reranking
      },
      alerts: activeAlerts.length,
      uptime: Date.now() - (process.uptime() * 1000),
      lastCheck: Date.now()
    };
  }
  
  // Private helper methods
  
  private async checkAlerts(
    aggregated: AggregatedRetrievalMetrics,
    realtime: RealtimeMetrics
  ): Promise<void> {
    const now = Date.now();
    
    // Skip if checked recently
    if (now - this.lastAlertCheck < 30000) { // 30 seconds
      return;
    }
    
    this.lastAlertCheck = now;
    
    // Check latency alerts
    if (aggregated.p95LatencyMs > this.config.alertThresholds.latencyP95Ms) {
      this.createAlert(
        'warning',
        'performance',
        `High P95 latency: ${aggregated.p95LatencyMs.toFixed(0)}ms (threshold: ${this.config.alertThresholds.latencyP95Ms}ms)`,
        { p95Latency: aggregated.p95LatencyMs, threshold: this.config.alertThresholds.latencyP95Ms }
      );
    }
    
    // Check error rate alerts
    if (aggregated.errorRate * 100 > this.config.alertThresholds.errorRatePercent) {
      this.createAlert(
        'error',
        'reliability',
        `High error rate: ${(aggregated.errorRate * 100).toFixed(1)}% (threshold: ${this.config.alertThresholds.errorRatePercent}%)`,
        { errorRate: aggregated.errorRate, threshold: this.config.alertThresholds.errorRatePercent }
      );
    }
    
    // Check fallback rate alerts
    if (aggregated.fallbackRate * 100 > this.config.alertThresholds.fallbackRatePercent) {
      this.createAlert(
        'warning',
        'reliability',
        `High fallback rate: ${(aggregated.fallbackRate * 100).toFixed(1)}% (threshold: ${this.config.alertThresholds.fallbackRatePercent}%)`,
        { fallbackRate: aggregated.fallbackRate, threshold: this.config.alertThresholds.fallbackRatePercent }
      );
    }
    
    // Check cache hit rate alerts
    if (aggregated.cacheHitRate * 100 < this.config.alertThresholds.cacheHitRatePercent) {
      this.createAlert(
        'info',
        'performance',
        `Low cache hit rate: ${(aggregated.cacheHitRate * 100).toFixed(1)}% (threshold: ${this.config.alertThresholds.cacheHitRatePercent}%)`,
        { cacheHitRate: aggregated.cacheHitRate, threshold: this.config.alertThresholds.cacheHitRatePercent }
      );
    }
    
    // Check component availability
    const componentAvailability = this.calculateComponentAvailability(aggregated);
    if (componentAvailability < this.config.alertThresholds.componentAvailabilityPercent) {
      this.createAlert(
        'critical',
        'availability',
        `Low component availability: ${componentAvailability.toFixed(1)}% (threshold: ${this.config.alertThresholds.componentAvailabilityPercent}%)`,
        { availability: componentAvailability, threshold: this.config.alertThresholds.componentAvailabilityPercent }
      );
    }
    
    // Clean up old alerts
    this.cleanupAlerts();
  }
  
  private createAlert(
    severity: Alert['severity'],
    component: string,
    message: string,
    details?: Record<string, any>
  ): void {
    // Check if similar alert already exists
    const existingAlert = this.alerts.find(alert => 
      !alert.resolved && 
      alert.component === component && 
      alert.message === message
    );
    
    if (existingAlert) {
      return; // Don't create duplicate alerts
    }
    
    const alert: Alert = {
      id: `alert_${this.alertIdCounter++}`,
      severity,
      component,
      message,
      timestamp: Date.now(),
      resolved: false,
      details
    };
    
    this.alerts.push(alert);
    
    // Log the alert
    console.log('monitoring_alert_created', {
      alert_id: alert.id,
      severity,
      component,
      message,
      details
    });
  }
  
  private cleanupAlerts(): void {
    // Remove old resolved alerts
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    this.alerts = this.alerts.filter(alert => 
      !alert.resolved || alert.timestamp > cutoffTime
    );
    
    // Limit total alerts
    if (this.alerts.length > this.config.maxAlerts) {
      this.alerts = this.alerts
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.config.maxAlerts);
    }
  }
  
  private buildComponentHealth(
    component: 'bm25' | 'vector' | 'expansion' | 'reranking',
    aggregated: AggregatedRetrievalMetrics,
    realtime: RealtimeMetrics
  ): ComponentHealth {
    const healthRate = aggregated.componentHealthRates[component];
    const latency = aggregated.componentLatencies[component];
    
    // Find recent errors for this component
    const recentLogs = retrievalLogger.getRecentLogs(100);
    const componentErrors = recentLogs
      .filter(log => log.errors.some(error => error.toLowerCase().includes(component)))
      .sort((a, b) => b.timestamp - a.timestamp);
    
    return {
      status: realtime.componentStatus[component],
      availability: healthRate,
      averageLatency: latency.avg,
      p95Latency: latency.p95,
      errorRate: componentErrors.length / Math.max(recentLogs.length, 1),
      lastError: componentErrors.length > 0 ? componentErrors[0].errors[0] : undefined,
      lastErrorTime: componentErrors.length > 0 ? componentErrors[0].timestamp : undefined
    };
  }
  
  private calculateSystemStatus(realtime: RealtimeMetrics): 'healthy' | 'degraded' | 'unhealthy' {
    const components = Object.values(realtime.componentStatus);
    const healthyCount = components.filter(status => status === 'healthy').length;
    const failedCount = components.filter(status => status === 'failed').length;
    
    if (failedCount > 0 || realtime.currentErrorRate > 0.1) {
      return 'unhealthy';
    } else if (healthyCount < components.length * 0.8) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }
  
  private calculateComponentAvailability(aggregated: AggregatedRetrievalMetrics): number {
    const rates = Object.values(aggregated.componentHealthRates);
    return (rates.reduce((sum, rate) => sum + rate, 0) / rates.length) * 100;
  }
  
  private formatTimeWindow(windowMs: number): string {
    const hours = windowMs / (1000 * 60 * 60);
    if (hours < 1) {
      const minutes = windowMs / (1000 * 60);
      return `${minutes.toFixed(0)}m`;
    } else if (hours < 24) {
      return `${hours.toFixed(0)}h`;
    } else {
      const days = hours / 24;
      return `${days.toFixed(0)}d`;
    }
  }
}

/**
 * Global monitoring dashboard instance
 */
export const monitoringDashboard = new MonitoringDashboard({
  alertThresholds: {
    latencyP95Ms: parseInt(process.env.ALERT_LATENCY_P95_MS || '1000'),
    errorRatePercent: parseFloat(process.env.ALERT_ERROR_RATE_PERCENT || '5'),
    fallbackRatePercent: parseFloat(process.env.ALERT_FALLBACK_RATE_PERCENT || '10'),
    cacheHitRatePercent: parseFloat(process.env.ALERT_CACHE_HIT_RATE_PERCENT || '70'),
    componentAvailabilityPercent: parseFloat(process.env.ALERT_COMPONENT_AVAILABILITY_PERCENT || '95')
  }
});