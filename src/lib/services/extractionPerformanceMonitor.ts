/**
 * Extraction Performance Monitor - Advanced monitoring for Hot Facts Pipeline
 * 
 * Provides comprehensive performance monitoring, database query optimization tracking,
 * alerting for extraction failures and performance degradation, and dashboard metrics
 * for fact extraction pipeline health.
 */

import { ExtractionErrorHandler, ExtractionMetrics } from './extractionErrorHandler';

/**
 * Database performance metrics
 */
export interface DatabasePerformanceMetrics {
  quick_facts_queries: {
    total_queries: number;
    average_response_time_ms: number;
    slow_queries_count: number; // > 100ms
    failed_queries_count: number;
    cache_hit_rate: number;
  };
  fact_history_queries: {
    total_queries: number;
    average_response_time_ms: number;
    slow_queries_count: number;
    failed_queries_count: number;
  };
  memory_fragments_queries: {
    total_queries: number;
    average_response_time_ms: number;
    slow_queries_count: number;
    failed_queries_count: number;
  };
  connection_pool: {
    active_connections: number;
    idle_connections: number;
    waiting_requests: number;
    connection_errors: number;
  };
}

/**
 * Extraction pipeline performance metrics
 */
export interface PipelinePerformanceMetrics {
  stage_performance: {
    pattern_extraction: {
      average_time_ms: number;
      p95_time_ms: number;
      p99_time_ms: number;
      success_rate: number;
      throughput_per_minute: number;
    };
    llm_extraction: {
      average_time_ms: number;
      p95_time_ms: number;
      p99_time_ms: number;
      success_rate: number;
      throughput_per_minute: number;
      token_usage: {
        input_tokens: number;
        output_tokens: number;
        cost_estimate_usd: number;
      };
    };
    storage_operations: {
      average_time_ms: number;
      p95_time_ms: number;
      p99_time_ms: number;
      success_rate: number;
      throughput_per_minute: number;
    };
  };
  end_to_end: {
    average_time_ms: number;
    p95_time_ms: number;
    p99_time_ms: number;
    success_rate: number;
    facts_per_extraction: number;
  };
}

/**
 * System resource metrics
 */
export interface SystemResourceMetrics {
  memory_usage: {
    heap_used_mb: number;
    heap_total_mb: number;
    external_mb: number;
    rss_mb: number;
  };
  cpu_usage: {
    user_percent: number;
    system_percent: number;
    idle_percent: number;
  };
  event_loop: {
    lag_ms: number;
    utilization_percent: number;
  };
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  extraction_success_rate_threshold: number; // Below this triggers alert
  average_processing_time_threshold_ms: number; // Above this triggers alert
  database_query_time_threshold_ms: number; // Above this triggers alert
  error_rate_threshold_per_hour: number; // Above this triggers alert
  memory_usage_threshold_mb: number; // Above this triggers alert
  cpu_usage_threshold_percent: number; // Above this triggers alert
}

/**
 * Alert types
 */
export enum AlertType {
  LOW_SUCCESS_RATE = 'low_success_rate',
  HIGH_PROCESSING_TIME = 'high_processing_time',
  DATABASE_PERFORMANCE = 'database_performance',
  HIGH_ERROR_RATE = 'high_error_rate',
  RESOURCE_EXHAUSTION = 'resource_exhaustion',
  CIRCUIT_BREAKER_OPEN = 'circuit_breaker_open',
  EXTRACTION_TIMEOUT = 'extraction_timeout'
}

/**
 * Alert instance
 */
export interface Alert {
  id: string;
  type: AlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  metrics: Record<string, any>;
  resolved: boolean;
  resolved_at?: Date;
}

/**
 * Performance data point for time series
 */
interface PerformanceDataPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

/**
 * Time series data storage
 */
class TimeSeriesData {
  private data: Map<string, PerformanceDataPoint[]> = new Map();
  private readonly maxDataPoints = 1000; // Keep last 1000 points per metric

  addDataPoint(metric: string, value: number, metadata?: Record<string, any>): void {
    if (!this.data.has(metric)) {
      this.data.set(metric, []);
    }

    const points = this.data.get(metric)!;
    points.push({
      timestamp: new Date(),
      value,
      metadata
    });

    // Keep only the most recent data points
    if (points.length > this.maxDataPoints) {
      points.splice(0, points.length - this.maxDataPoints);
    }
  }

  getDataPoints(metric: string, since?: Date): PerformanceDataPoint[] {
    const points = this.data.get(metric) || [];
    
    if (!since) {
      return [...points];
    }

    return points.filter(point => point.timestamp >= since);
  }

  getLatestValue(metric: string): number | null {
    const points = this.data.get(metric) || [];
    return points.length > 0 ? points[points.length - 1].value : null;
  }

  calculatePercentile(metric: string, percentile: number, since?: Date): number | null {
    const points = this.getDataPoints(metric, since);
    if (points.length === 0) return null;

    const values = points.map(p => p.value).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[Math.max(0, index)];
  }

  calculateAverage(metric: string, since?: Date): number | null {
    const points = this.getDataPoints(metric, since);
    if (points.length === 0) return null;

    const sum = points.reduce((acc, point) => acc + point.value, 0);
    return sum / points.length;
  }
}

/**
 * Comprehensive performance monitor for extraction pipeline
 */
export class ExtractionPerformanceMonitor {
  private static instance: ExtractionPerformanceMonitor;
  private timeSeriesData: TimeSeriesData = new TimeSeriesData();
  private alerts: Alert[] = [];
  private alertConfig: AlertConfig;
  private monitoringInterval?: NodeJS.Timeout;
  private databaseMetrics: DatabasePerformanceMetrics;
  private systemMetrics: SystemResourceMetrics;

  private constructor() {
    this.alertConfig = {
      extraction_success_rate_threshold: 80,
      average_processing_time_threshold_ms: 15000,
      database_query_time_threshold_ms: 100,
      error_rate_threshold_per_hour: 50,
      memory_usage_threshold_mb: 512,
      cpu_usage_threshold_percent: 80
    };

    this.databaseMetrics = this.initializeDatabaseMetrics();
    this.systemMetrics = this.initializeSystemMetrics();
  }

  static getInstance(): ExtractionPerformanceMonitor {
    if (!ExtractionPerformanceMonitor.instance) {
      ExtractionPerformanceMonitor.instance = new ExtractionPerformanceMonitor();
    }
    return ExtractionPerformanceMonitor.instance;
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(intervalMs: number = 60000): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.checkAlerts();
    }, intervalMs);

    console.log('Extraction performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    console.log('Extraction performance monitoring stopped');
  }

  /**
   * Record extraction performance data
   */
  recordExtractionPerformance(
    stage: 'pattern' | 'llm' | 'storage' | 'end_to_end',
    duration_ms: number,
    success: boolean,
    metadata?: Record<string, any>
  ): void {
    const metricPrefix = `extraction_${stage}`;
    
    // Record timing data
    this.timeSeriesData.addDataPoint(`${metricPrefix}_duration`, duration_ms, metadata);
    
    // Record success/failure
    this.timeSeriesData.addDataPoint(`${metricPrefix}_success`, success ? 1 : 0, metadata);
    
    // Record throughput (operations per minute)
    this.timeSeriesData.addDataPoint(`${metricPrefix}_throughput`, 1, metadata);

    // Record LLM-specific metrics
    if (stage === 'llm' && metadata) {
      if (metadata.input_tokens) {
        this.timeSeriesData.addDataPoint('llm_input_tokens', metadata.input_tokens);
      }
      if (metadata.output_tokens) {
        this.timeSeriesData.addDataPoint('llm_output_tokens', metadata.output_tokens);
      }
      if (metadata.cost_estimate) {
        this.timeSeriesData.addDataPoint('llm_cost_usd', metadata.cost_estimate);
      }
    }

    // Record facts extracted for end-to-end metrics
    if (stage === 'end_to_end' && metadata?.facts_count) {
      this.timeSeriesData.addDataPoint('facts_per_extraction', metadata.facts_count);
    }
  }

  /**
   * Record database query performance
   */
  recordDatabaseQuery(
    table: 'quick_facts' | 'fact_history' | 'memory_fragments',
    duration_ms: number,
    success: boolean,
    query_type: 'select' | 'insert' | 'update' | 'delete' = 'select'
  ): void {
    const metricPrefix = `db_${table}`;
    
    this.timeSeriesData.addDataPoint(`${metricPrefix}_duration`, duration_ms);
    this.timeSeriesData.addDataPoint(`${metricPrefix}_success`, success ? 1 : 0);
    this.timeSeriesData.addDataPoint(`${metricPrefix}_${query_type}`, 1);

    // Update database metrics
    const tableMetrics = this.databaseMetrics[`${table}_queries`];
    if (tableMetrics) {
      tableMetrics.total_queries++;
      
      // Update running average
      const totalTime = tableMetrics.average_response_time_ms * (tableMetrics.total_queries - 1) + duration_ms;
      tableMetrics.average_response_time_ms = totalTime / tableMetrics.total_queries;
      
      if (duration_ms > 100) {
        tableMetrics.slow_queries_count++;
      }
      
      if (!success) {
        tableMetrics.failed_queries_count++;
      }
    }
  }

  /**
   * Get current pipeline performance metrics
   */
  getPipelinePerformanceMetrics(): PipelinePerformanceMetrics {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    return {
      stage_performance: {
        pattern_extraction: {
          average_time_ms: this.timeSeriesData.calculateAverage('extraction_pattern_duration', oneHourAgo) || 0,
          p95_time_ms: this.timeSeriesData.calculatePercentile('extraction_pattern_duration', 95, oneHourAgo) || 0,
          p99_time_ms: this.timeSeriesData.calculatePercentile('extraction_pattern_duration', 99, oneHourAgo) || 0,
          success_rate: this.calculateSuccessRate('extraction_pattern_success', oneHourAgo),
          throughput_per_minute: this.calculateThroughput('extraction_pattern_throughput', oneHourAgo)
        },
        llm_extraction: {
          average_time_ms: this.timeSeriesData.calculateAverage('extraction_llm_duration', oneHourAgo) || 0,
          p95_time_ms: this.timeSeriesData.calculatePercentile('extraction_llm_duration', 95, oneHourAgo) || 0,
          p99_time_ms: this.timeSeriesData.calculatePercentile('extraction_llm_duration', 99, oneHourAgo) || 0,
          success_rate: this.calculateSuccessRate('extraction_llm_success', oneHourAgo),
          throughput_per_minute: this.calculateThroughput('extraction_llm_throughput', oneHourAgo),
          token_usage: {
            input_tokens: this.timeSeriesData.getDataPoints('llm_input_tokens', oneHourAgo)
              .reduce((sum, point) => sum + point.value, 0),
            output_tokens: this.timeSeriesData.getDataPoints('llm_output_tokens', oneHourAgo)
              .reduce((sum, point) => sum + point.value, 0),
            cost_estimate_usd: this.timeSeriesData.getDataPoints('llm_cost_usd', oneHourAgo)
              .reduce((sum, point) => sum + point.value, 0)
          }
        },
        storage_operations: {
          average_time_ms: this.timeSeriesData.calculateAverage('extraction_storage_duration', oneHourAgo) || 0,
          p95_time_ms: this.timeSeriesData.calculatePercentile('extraction_storage_duration', 95, oneHourAgo) || 0,
          p99_time_ms: this.timeSeriesData.calculatePercentile('extraction_storage_duration', 99, oneHourAgo) || 0,
          success_rate: this.calculateSuccessRate('extraction_storage_success', oneHourAgo),
          throughput_per_minute: this.calculateThroughput('extraction_storage_throughput', oneHourAgo)
        }
      },
      end_to_end: {
        average_time_ms: this.timeSeriesData.calculateAverage('extraction_end_to_end_duration', oneHourAgo) || 0,
        p95_time_ms: this.timeSeriesData.calculatePercentile('extraction_end_to_end_duration', 95, oneHourAgo) || 0,
        p99_time_ms: this.timeSeriesData.calculatePercentile('extraction_end_to_end_duration', 99, oneHourAgo) || 0,
        success_rate: this.calculateSuccessRate('extraction_end_to_end_success', oneHourAgo),
        facts_per_extraction: this.timeSeriesData.calculateAverage('facts_per_extraction', oneHourAgo) || 0
      }
    };
  }

  /**
   * Get database performance metrics
   */
  getDatabasePerformanceMetrics(): DatabasePerformanceMetrics {
    return { ...this.databaseMetrics };
  }

  /**
   * Get system resource metrics
   */
  getSystemResourceMetrics(): SystemResourceMetrics {
    this.updateSystemMetrics();
    return { ...this.systemMetrics };
  }

  /**
   * Get comprehensive dashboard metrics
   */
  getDashboardMetrics(): {
    pipeline: PipelinePerformanceMetrics;
    database: DatabasePerformanceMetrics;
    system: SystemResourceMetrics;
    extraction: ExtractionMetrics;
    alerts: Alert[];
    health_score: number;
  } {
    const pipelineMetrics = this.getPipelinePerformanceMetrics();
    const databaseMetrics = this.getDatabasePerformanceMetrics();
    const systemMetrics = this.getSystemResourceMetrics();
    const extractionMetrics = ExtractionErrorHandler.getExtractionMetrics();
    const activeAlerts = this.getActiveAlerts();
    
    const healthScore = this.calculateHealthScore(
      pipelineMetrics,
      databaseMetrics,
      systemMetrics,
      extractionMetrics,
      activeAlerts
    );

    return {
      pipeline: pipelineMetrics,
      database: databaseMetrics,
      system: systemMetrics,
      extraction: extractionMetrics,
      alerts: activeAlerts,
      health_score: healthScore
    };
  }

  /**
   * Check for performance alerts
   */
  private checkAlerts(): void {
    const pipelineMetrics = this.getPipelinePerformanceMetrics();
    const databaseMetrics = this.getDatabasePerformanceMetrics();
    const systemMetrics = this.getSystemResourceMetrics();
    const extractionMetrics = ExtractionErrorHandler.getExtractionMetrics();

    // Check extraction success rate
    if (pipelineMetrics.end_to_end.success_rate < this.alertConfig.extraction_success_rate_threshold) {
      this.createAlert(
        AlertType.LOW_SUCCESS_RATE,
        'high',
        `Extraction success rate (${pipelineMetrics.end_to_end.success_rate.toFixed(1)}%) is below threshold (${this.alertConfig.extraction_success_rate_threshold}%)`,
        { success_rate: pipelineMetrics.end_to_end.success_rate }
      );
    }

    // Check processing time
    if (pipelineMetrics.end_to_end.average_time_ms > this.alertConfig.average_processing_time_threshold_ms) {
      this.createAlert(
        AlertType.HIGH_PROCESSING_TIME,
        'medium',
        `Average processing time (${pipelineMetrics.end_to_end.average_time_ms}ms) exceeds threshold (${this.alertConfig.average_processing_time_threshold_ms}ms)`,
        { processing_time_ms: pipelineMetrics.end_to_end.average_time_ms }
      );
    }

    // Check database performance
    const avgDbTime = Math.max(
      databaseMetrics.quick_facts_queries.average_response_time_ms,
      databaseMetrics.fact_history_queries.average_response_time_ms,
      databaseMetrics.memory_fragments_queries.average_response_time_ms
    );
    
    if (avgDbTime > this.alertConfig.database_query_time_threshold_ms) {
      this.createAlert(
        AlertType.DATABASE_PERFORMANCE,
        'medium',
        `Database query time (${avgDbTime.toFixed(1)}ms) exceeds threshold (${this.alertConfig.database_query_time_threshold_ms}ms)`,
        { database_response_time_ms: avgDbTime }
      );
    }

    // Check error rates
    const totalErrors = extractionMetrics.pattern_failures + extractionMetrics.llm_failures + extractionMetrics.storage_failures;
    if (totalErrors > this.alertConfig.error_rate_threshold_per_hour) {
      this.createAlert(
        AlertType.HIGH_ERROR_RATE,
        'high',
        `Error rate (${totalErrors} errors) exceeds threshold (${this.alertConfig.error_rate_threshold_per_hour} per hour)`,
        { error_count: totalErrors }
      );
    }

    // Check system resources
    if (systemMetrics.memory_usage.heap_used_mb > this.alertConfig.memory_usage_threshold_mb) {
      this.createAlert(
        AlertType.RESOURCE_EXHAUSTION,
        'high',
        `Memory usage (${systemMetrics.memory_usage.heap_used_mb}MB) exceeds threshold (${this.alertConfig.memory_usage_threshold_mb}MB)`,
        { memory_usage_mb: systemMetrics.memory_usage.heap_used_mb }
      );
    }

    const totalCpuUsage = systemMetrics.cpu_usage.user_percent + systemMetrics.cpu_usage.system_percent;
    if (totalCpuUsage > this.alertConfig.cpu_usage_threshold_percent) {
      this.createAlert(
        AlertType.RESOURCE_EXHAUSTION,
        'medium',
        `CPU usage (${totalCpuUsage.toFixed(1)}%) exceeds threshold (${this.alertConfig.cpu_usage_threshold_percent}%)`,
        { cpu_usage_percent: totalCpuUsage }
      );
    }
  }

  /**
   * Create a new alert
   */
  private createAlert(
    type: AlertType,
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
    metrics: Record<string, any>
  ): void {
    // Check if similar alert already exists and is not resolved
    const existingAlert = this.alerts.find(alert => 
      alert.type === type && 
      !alert.resolved && 
      Date.now() - alert.timestamp.getTime() < 5 * 60 * 1000 // Within 5 minutes
    );

    if (existingAlert) {
      return; // Don't create duplicate alerts
    }

    const alert: Alert = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message,
      timestamp: new Date(),
      metrics,
      resolved: false
    };

    this.alerts.push(alert);

    // Log alert
    const logLevel = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
    console[logLevel](`EXTRACTION ALERT [${severity.toUpperCase()}]: ${message}`, metrics);

    // Keep only recent alerts (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.alerts = this.alerts.filter(alert => alert.timestamp >= oneDayAgo);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolved_at = new Date();
      console.log(`Alert resolved: ${alert.message}`);
      return true;
    }
    return false;
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
  getAllAlerts(): Alert[] {
    return [...this.alerts];
  }

  /**
   * Update alert configuration
   */
  updateAlertConfig(config: Partial<AlertConfig>): void {
    this.alertConfig = { ...this.alertConfig, ...config };
    console.log('Alert configuration updated:', config);
  }

  /**
   * Calculate success rate for a metric
   */
  private calculateSuccessRate(metric: string, since: Date): number {
    const points = this.timeSeriesData.getDataPoints(metric, since);
    if (points.length === 0) return 0;

    const successCount = points.reduce((sum, point) => sum + point.value, 0);
    return (successCount / points.length) * 100;
  }

  /**
   * Calculate throughput per minute
   */
  private calculateThroughput(metric: string, since: Date): number {
    const points = this.timeSeriesData.getDataPoints(metric, since);
    if (points.length === 0) return 0;

    const timeSpanMinutes = (Date.now() - since.getTime()) / (1000 * 60);
    return points.length / Math.max(timeSpanMinutes, 1);
  }

  /**
   * Calculate overall health score (0-100)
   */
  private calculateHealthScore(
    pipeline: PipelinePerformanceMetrics,
    database: DatabasePerformanceMetrics,
    system: SystemResourceMetrics,
    extraction: ExtractionMetrics,
    alerts: Alert[]
  ): number {
    let score = 100;

    // Deduct points for low success rates
    if (pipeline.end_to_end.success_rate < 95) {
      score -= (95 - pipeline.end_to_end.success_rate) * 2;
    }

    // Deduct points for slow processing
    if (pipeline.end_to_end.average_time_ms > 5000) {
      score -= Math.min(20, (pipeline.end_to_end.average_time_ms - 5000) / 1000);
    }

    // Deduct points for database performance
    const avgDbTime = Math.max(
      database.quick_facts_queries.average_response_time_ms,
      database.fact_history_queries.average_response_time_ms
    );
    if (avgDbTime > 50) {
      score -= Math.min(15, (avgDbTime - 50) / 10);
    }

    // Deduct points for high resource usage
    const memoryUsagePercent = (system.memory_usage.heap_used_mb / system.memory_usage.heap_total_mb) * 100;
    if (memoryUsagePercent > 80) {
      score -= (memoryUsagePercent - 80) / 2;
    }

    // Deduct points for active alerts
    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    const highAlerts = alerts.filter(a => a.severity === 'high').length;
    const mediumAlerts = alerts.filter(a => a.severity === 'medium').length;

    score -= criticalAlerts * 20;
    score -= highAlerts * 10;
    score -= mediumAlerts * 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Collect current metrics
   */
  private collectMetrics(): void {
    this.updateSystemMetrics();
    
    // Record current system metrics as time series data
    this.timeSeriesData.addDataPoint('system_memory_heap_used', this.systemMetrics.memory_usage.heap_used_mb);
    this.timeSeriesData.addDataPoint('system_memory_heap_total', this.systemMetrics.memory_usage.heap_total_mb);
    this.timeSeriesData.addDataPoint('system_cpu_usage', 
      this.systemMetrics.cpu_usage.user_percent + this.systemMetrics.cpu_usage.system_percent);
    this.timeSeriesData.addDataPoint('system_event_loop_lag', this.systemMetrics.event_loop.lag_ms);
  }

  /**
   * Initialize database metrics
   */
  private initializeDatabaseMetrics(): DatabasePerformanceMetrics {
    return {
      quick_facts_queries: {
        total_queries: 0,
        average_response_time_ms: 0,
        slow_queries_count: 0,
        failed_queries_count: 0,
        cache_hit_rate: 0
      },
      fact_history_queries: {
        total_queries: 0,
        average_response_time_ms: 0,
        slow_queries_count: 0,
        failed_queries_count: 0
      },
      memory_fragments_queries: {
        total_queries: 0,
        average_response_time_ms: 0,
        slow_queries_count: 0,
        failed_queries_count: 0
      },
      connection_pool: {
        active_connections: 0,
        idle_connections: 0,
        waiting_requests: 0,
        connection_errors: 0
      }
    };
  }

  /**
   * Initialize system metrics
   */
  private initializeSystemMetrics(): SystemResourceMetrics {
    return {
      memory_usage: {
        heap_used_mb: 0,
        heap_total_mb: 0,
        external_mb: 0,
        rss_mb: 0
      },
      cpu_usage: {
        user_percent: 0,
        system_percent: 0,
        idle_percent: 100
      },
      event_loop: {
        lag_ms: 0,
        utilization_percent: 0
      }
    };
  }

  /**
   * Update system metrics with current values
   */
  private updateSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.systemMetrics.memory_usage = {
      heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
      external_mb: Math.round(memUsage.external / 1024 / 1024),
      rss_mb: Math.round(memUsage.rss / 1024 / 1024)
    };

    // Note: CPU usage calculation would need additional implementation
    // for accurate real-time CPU monitoring in production
    this.systemMetrics.cpu_usage = {
      user_percent: Math.round((cpuUsage.user / 1000000) * 100) / 100,
      system_percent: Math.round((cpuUsage.system / 1000000) * 100) / 100,
      idle_percent: 100 - Math.round(((cpuUsage.user + cpuUsage.system) / 1000000) * 100) / 100
    };

    // Event loop lag would need additional monitoring setup
    this.systemMetrics.event_loop = {
      lag_ms: 0, // Would need hrtime measurement
      utilization_percent: 0
    };
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): {
    timestamp: string;
    pipeline: PipelinePerformanceMetrics;
    database: DatabasePerformanceMetrics;
    system: SystemResourceMetrics;
    extraction: ExtractionMetrics;
  } {
    return {
      timestamp: new Date().toISOString(),
      pipeline: this.getPipelinePerformanceMetrics(),
      database: this.getDatabasePerformanceMetrics(),
      system: this.getSystemResourceMetrics(),
      extraction: ExtractionErrorHandler.getExtractionMetrics()
    };
  }

  /**
   * Reset all monitoring data (for testing)
   */
  resetMonitoringData(): void {
    this.timeSeriesData = new TimeSeriesData();
    this.alerts = [];
    this.databaseMetrics = this.initializeDatabaseMetrics();
    this.systemMetrics = this.initializeSystemMetrics();
  }
}

/**
 * Lightweight metric hook used across services
 * Maps custom stages to internal performance monitor buckets and attaches avatar metadata
 */
export function recordMetric(
  avatarId: string | undefined,
  stage: 'pattern' | 'llm' | 'persist' | 'promotion',
  ok: boolean,
  durationMs: number,
  metadata: Record<string, any> = {}
): void {
  try {
    const monitor = ExtractionPerformanceMonitor.getInstance();
    const mappedStage: 'pattern' | 'llm' | 'storage' | 'end_to_end' =
      stage === 'persist' ? 'storage' : stage === 'promotion' ? 'end_to_end' : stage;

    monitor.recordExtractionPerformance(mappedStage, durationMs, ok, {
      avatarId,
      stageAlias: stage,
      ...metadata,
    });
  } catch (_) {
    // never throw from metrics helper
  }
}