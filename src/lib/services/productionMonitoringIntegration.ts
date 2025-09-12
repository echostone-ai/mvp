/**
 * Production Monitoring Integration
 * 
 * Integrates all monitoring components for the hybrid retrieval system
 * and provides a unified interface for production monitoring.
 */

import { EventEmitter } from 'events';
import { ProductionMonitoringDashboard, DashboardMetrics, AlertEvent } from './productionMonitoringDashboard';
import { AlertingSystem, AlertChannel } from './alertingSystem';
import { SystemHealthMonitor, SystemHealthMetrics } from './systemHealthMonitor';
import { DeploymentValidator, ValidationConfig } from './deploymentValidator';
import { HybridRetriever } from './hybridRetrieval';
import { FactbookService } from './factbookService';

export interface MonitoringConfig {
  dashboard: {
    enabled: boolean;
    updateIntervalMs: number;
    maxHistorySize: number;
  };
  alerting: {
    enabled: boolean;
    maxRetries: number;
    retryDelayMs: number;
    defaultChannels: string[];
  };
  healthMonitoring: {
    enabled: boolean;
    intervalMs: number;
    thresholds: {
      cpuWarning: number;
      memoryWarning: number;
      latencyWarning: number;
      errorRateWarning: number;
    };
  };
  validation: {
    enabled: boolean;
    runOnStartup: boolean;
    environment: string;
  };
}

export interface MonitoringStatus {
  dashboard: {
    running: boolean;
    lastUpdate: number;
    metricsCount: number;
  };
  alerting: {
    enabled: boolean;
    activeAlerts: number;
    channelCount: number;
  };
  healthMonitoring: {
    running: boolean;
    overallHealth: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: number;
  };
  validation: {
    lastRun: number;
    lastStatus: 'pass' | 'fail' | 'partial' | 'never';
  };
}

export class ProductionMonitoringIntegration extends EventEmitter {
  private dashboard: ProductionMonitoringDashboard;
  private alerting: AlertingSystem;
  private healthMonitor: SystemHealthMonitor;
  private validator: DeploymentValidator;
  private config: MonitoringConfig;
  private hybridRetriever: HybridRetriever;
  private isRunning: boolean;

  constructor(
    hybridRetriever: HybridRetriever,
    factbookService: FactbookService,
    config: Partial<MonitoringConfig> = {}
  ) {
    super();
    
    this.hybridRetriever = hybridRetriever;
    this.isRunning = false;
    
    this.config = {
      dashboard: {
        enabled: true,
        updateIntervalMs: 30000,
        maxHistorySize: 1000,
        ...config.dashboard
      },
      alerting: {
        enabled: true,
        maxRetries: 3,
        retryDelayMs: 60000,
        defaultChannels: ['console'],
        ...config.alerting
      },
      healthMonitoring: {
        enabled: true,
        intervalMs: 30000,
        thresholds: {
          cpuWarning: 70,
          memoryWarning: 80,
          latencyWarning: 500,
          errorRateWarning: 5
        },
        ...config.healthMonitoring
      },
      validation: {
        enabled: true,
        runOnStartup: false,
        environment: process.env.NODE_ENV || 'development',
        ...config.validation
      }
    };

    // Initialize components
    this.dashboard = new ProductionMonitoringDashboard({
      maxHistorySize: this.config.dashboard.maxHistorySize,
      updateIntervalMs: this.config.dashboard.updateIntervalMs
    });

    this.alerting = new AlertingSystem({
      maxRetries: this.config.alerting.maxRetries,
      retryDelayMs: this.config.alerting.retryDelayMs,
      defaultChannels: this.config.alerting.defaultChannels
    });

    this.healthMonitor = new SystemHealthMonitor({
      thresholds: {
        cpuUsageWarning: this.config.healthMonitoring.thresholds.cpuWarning,
        memoryUsageWarning: this.config.healthMonitoring.thresholds.memoryWarning,
        responseTimeWarning: this.config.healthMonitoring.thresholds.latencyWarning,
        errorRateWarning: this.config.healthMonitoring.thresholds.errorRateWarning,
        cpuUsageCritical: this.config.healthMonitoring.thresholds.cpuWarning + 20,
        memoryUsageCritical: this.config.healthMonitoring.thresholds.memoryWarning + 15,
        responseTimeCritical: this.config.healthMonitoring.thresholds.latencyWarning * 2,
        errorRateCritical: this.config.healthMonitoring.thresholds.errorRateWarning * 3,
        diskUsageWarning: 80,
        diskUsageCritical: 95,
        cacheHitRateWarning: 60
      }
    });

    this.validator = new DeploymentValidator(hybridRetriever, factbookService);

    this.setupEventHandlers();
  }

  /**
   * Start all monitoring components
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('Monitoring is already running');
      return;
    }

    console.log('Starting production monitoring integration...');

    try {
      // Start dashboard
      if (this.config.dashboard.enabled) {
        this.dashboard.start(this.config.dashboard.updateIntervalMs);
      }

      // Start health monitoring
      if (this.config.healthMonitoring.enabled) {
        this.healthMonitor.start(this.config.healthMonitoring.intervalMs);
      }

      // Run startup validation if enabled
      if (this.config.validation.enabled && this.config.validation.runOnStartup) {
        await this.runStartupValidation();
      }

      this.isRunning = true;
      console.log('Production monitoring started successfully');
      this.emit('monitoring:started');

    } catch (error) {
      console.error('Failed to start monitoring:', error);
      this.emit('monitoring:error', error);
      throw error;
    }
  }

  /**
   * Stop all monitoring components
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('Monitoring is not running');
      return;
    }

    console.log('Stopping production monitoring integration...');

    this.dashboard.stop();
    this.healthMonitor.stop();

    this.isRunning = false;
    console.log('Production monitoring stopped');
    this.emit('monitoring:stopped');
  }

  /**
   * Get current monitoring status
   */
  getStatus(): MonitoringStatus {
    const dashboardMetrics = this.dashboard.getCurrentMetrics();
    const healthMetrics = this.healthMonitor.getCurrentMetrics();
    
    return {
      dashboard: {
        running: this.isRunning && this.config.dashboard.enabled,
        lastUpdate: dashboardMetrics.timestamp || 0,
        metricsCount: Object.keys(dashboardMetrics).length
      },
      alerting: {
        enabled: this.config.alerting.enabled,
        activeAlerts: this.alerting.getActiveNotifications().length,
        channelCount: 0 // Would need to expose this from AlertingSystem
      },
      healthMonitoring: {
        running: this.isRunning && this.config.healthMonitoring.enabled,
        overallHealth: this.healthMonitor.getOverallHealth(),
        lastCheck: healthMetrics.timestamp
      },
      validation: {
        lastRun: 0, // Would need to track this
        lastStatus: 'never'
      }
    };
  }

  /**
   * Record retrieval performance data
   */
  recordRetrievalPerformance(
    responseTime: number,
    resultCount: number,
    errorOccurred: boolean = false,
    source: string = 'hybrid'
  ): void {
    // Update health monitor
    this.healthMonitor.recordPerformance(responseTime, errorOccurred);

    // Update dashboard metrics
    const currentMetrics = this.dashboard.getCurrentMetrics();
    this.dashboard.updateMetricsFromSource({
      currentThroughput: currentMetrics.currentThroughput + 1,
      averageResultCount: (currentMetrics.averageResultCount + resultCount) / 2
    });

    this.emit('performance:recorded', {
      responseTime,
      resultCount,
      errorOccurred,
      source
    });
  }

  /**
   * Update cache metrics
   */
  updateCacheMetrics(metrics: {
    embeddingCacheSize?: number;
    embeddingCacheSizeMB?: number;
    vectorIndexSize?: number;
    vectorIndexSizeMB?: number;
    bm25IndexSize?: number;
    embeddingCacheHitRate?: number;
    queryCacheHitRate?: number;
    expansionCacheHitRate?: number;
  }): void {
    // Update health monitor
    this.healthMonitor.updateCacheMetrics(metrics);

    // Update dashboard
    this.dashboard.updateMetricsFromSource({
      embeddingCacheSize: metrics.embeddingCacheSize || 0,
      vectorIndexSize: metrics.vectorIndexSize || 0,
      cacheEfficiency: Math.max(
        metrics.embeddingCacheHitRate || 0,
        metrics.queryCacheHitRate || 0,
        metrics.expansionCacheHitRate || 0
      )
    });

    this.emit('cache:updated', metrics);
  }

  /**
   * Update component health status
   */
  updateComponentHealth(
    component: keyof SystemHealthMetrics['componentHealth'],
    status: 'healthy' | 'degraded' | 'unhealthy'
  ): void {
    this.healthMonitor.updateComponentHealth(component, status);
    this.emit('component:health_changed', { component, status });
  }

  /**
   * Add alert channel
   */
  addAlertChannel(channel: AlertChannel): void {
    this.alerting.addChannel(channel);
    this.emit('alerting:channel_added', channel);
  }

  /**
   * Test alert channel
   */
  async testAlertChannel(channelId: string): Promise<boolean> {
    return this.alerting.testChannel(channelId);
  }

  /**
   * Run deployment validation
   */
  async runValidation(config?: Partial<ValidationConfig>) {
    const validationConfig: ValidationConfig = {
      environment: this.config.validation.environment,
      version: process.env.npm_package_version || 'unknown',
      timeout: 30000,
      skipNonCritical: false,
      enablePerformanceTests: true,
      enableSemanticTests: true,
      ...config
    };

    console.log('Running deployment validation...');
    const report = await this.validator.runValidation(validationConfig);
    
    this.emit('validation:completed', report);
    
    if (report.overallStatus === 'fail') {
      console.error('Validation failed:', report.criticalFailures);
    } else {
      console.log(`Validation ${report.overallStatus}: ${report.summary.passed}/${report.summary.total} tests passed`);
    }

    return report;
  }

  /**
   * Generate comprehensive monitoring report
   */
  generateMonitoringReport(timeRangeMs: number = 3600000): {
    timestamp: number;
    timeRange: number;
    status: MonitoringStatus;
    performanceReport: any;
    healthReport: any;
    alertSummary: {
      totalAlerts: number;
      criticalAlerts: number;
      activeAlerts: number;
    };
  } {
    const endTime = Date.now();
    const startTime = endTime - timeRangeMs;

    const performanceReport = this.dashboard.generatePerformanceReport(startTime, endTime);
    const healthReport = this.healthMonitor.generateHealthReport();
    const activeNotifications = this.alerting.getActiveNotifications();

    return {
      timestamp: endTime,
      timeRange: timeRangeMs,
      status: this.getStatus(),
      performanceReport,
      healthReport,
      alertSummary: {
        totalAlerts: 0, // Would need to track historical alerts
        criticalAlerts: activeNotifications.filter(n => n.alertEvent.severity === 'critical').length,
        activeAlerts: activeNotifications.length
      }
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    return this.dashboard.exportPrometheusMetrics();
  }

  private setupEventHandlers(): void {
    // Dashboard events
    this.dashboard.on('alert:triggered', (alertEvent: AlertEvent) => {
      if (this.config.alerting.enabled) {
        this.alerting.processAlert(alertEvent);
      }
      this.emit('alert:triggered', alertEvent);
    });

    this.dashboard.on('metrics:updated', (metrics: DashboardMetrics) => {
      this.emit('metrics:updated', metrics);
    });

    // Health monitor events
    this.healthMonitor.on('health:changed', (event) => {
      console.log(`System health changed: ${event.from} → ${event.to}`);
      this.emit('health:changed', event);
    });

    this.healthMonitor.on('metrics:collected', (metrics: SystemHealthMetrics) => {
      // Update dashboard with health metrics
      this.dashboard.updateMetricsFromSource({
        memoryUsageMB: metrics.memoryUsageMB,
        currentP95Latency: metrics.p95ResponseTime,
        errorRate: metrics.errorRate,
        currentThroughput: metrics.throughput
      });
    });

    // Alerting events
    this.alerting.on('alert:processed', (event) => {
      console.log(`Alert processed: ${event.alertEvent.ruleName}`);
      this.emit('alert:processed', event);
    });

    this.alerting.on('alert:escalated', (event) => {
      console.warn(`Alert escalated: ${event.alertEvent.ruleName}`);
      this.emit('alert:escalated', event);
    });

    // Hybrid retriever events (if available)
    if (this.hybridRetriever && typeof this.hybridRetriever.on === 'function') {
      this.hybridRetriever.on('retrieval:completed', (event: any) => {
        this.recordRetrievalPerformance(
          event.metrics?.totalTimeMs || 0,
          event.results?.length || 0,
          false,
          'hybrid'
        );
      });

      this.hybridRetriever.on('retrieval:error', (event: any) => {
        this.recordRetrievalPerformance(
          event.duration || 0,
          0,
          true,
          'hybrid'
        );
      });
    }
  }

  private async runStartupValidation(): Promise<void> {
    try {
      console.log('Running startup validation...');
      
      const report = await this.validator.runValidation({
        environment: this.config.validation.environment,
        version: process.env.npm_package_version || 'unknown',
        timeout: 60000,
        skipNonCritical: true, // Only run critical tests on startup
        enablePerformanceTests: false,
        enableSemanticTests: true
      });

      if (report.overallStatus === 'fail') {
        console.error('Startup validation failed - system may not be ready');
        this.emit('validation:startup_failed', report);
      } else {
        console.log('Startup validation passed');
        this.emit('validation:startup_passed', report);
      }

    } catch (error) {
      console.error('Startup validation error:', error);
      this.emit('validation:startup_error', error);
    }
  }
}