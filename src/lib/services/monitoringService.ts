/**
 * Monitoring Service for GPT-5 Avatar Memory System
 * Tracks performance metrics, accuracy, and system health
 */

export interface PerformanceMetrics {
  responseTime: number;
  contextRetrievalTime: number;
  gpt5ProcessingTime: number;
  memoryUpdateTime: number;
  totalRequestTime: number;
  timestamp: Date;
  avatarId: string;
  requestId: string;
}

export interface AccuracyMetrics {
  factRecallAccuracy: number;
  contextContinuityScore: number;
  hallucinationRate: number;
  factExtractionAccuracy: number;
  conflictResolutionSuccess: number;
  timestamp: Date;
  avatarId: string;
  conversationId: string;
}

export interface ConversationQualityMetrics {
  userSatisfactionScore?: number;
  conversationLength: number;
  topicCoherence: number;
  responseRelevance: number;
  personalityConsistency: number;
  emotionalAppropriatenessScore: number;
  timestamp: Date;
  avatarId: string;
  conversationId: string;
}

export interface SystemHealthMetrics {
  databaseResponseTime: number;
  apiResponseTime: number;
  cacheHitRate: number;
  errorRate: number;
  activeConnections: number;
  memoryUsage: number;
  cpuUsage: number;
  timestamp: Date;
}

export interface AlertThresholds {
  responseTimeThreshold: number; // ms
  errorRateThreshold: number; // percentage
  accuracyThreshold: number; // percentage
  databaseResponseThreshold: number; // ms
  memoryUsageThreshold: number; // percentage
}

export interface Alert {
  id: string;
  type: 'performance' | 'accuracy' | 'system' | 'error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metrics: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export class MonitoringService {
  private performanceMetrics: PerformanceMetrics[] = [];
  private accuracyMetrics: AccuracyMetrics[] = [];
  private qualityMetrics: ConversationQualityMetrics[] = [];
  private systemMetrics: SystemHealthMetrics[] = [];
  private alerts: Alert[] = [];
  
  private readonly thresholds: AlertThresholds = {
    responseTimeThreshold: 1500, // 1.5 seconds
    errorRateThreshold: 5, // 5%
    accuracyThreshold: 85, // 85%
    databaseResponseThreshold: 500, // 500ms
    memoryUsageThreshold: 80 // 80%
  };

  private readonly maxMetricsHistory = 10000;
  private readonly alertRetentionDays = 30;

  /**
   * Record performance metrics for a conversation request
   */
  recordPerformanceMetrics(metrics: PerformanceMetrics): void {
    this.performanceMetrics.push(metrics);
    this.trimMetricsHistory(this.performanceMetrics);
    
    // Check for performance alerts
    this.checkPerformanceAlerts(metrics);
  }

  /**
   * Record accuracy metrics for fact recall and context continuity
   */
  recordAccuracyMetrics(metrics: AccuracyMetrics): void {
    this.accuracyMetrics.push(metrics);
    this.trimMetricsHistory(this.accuracyMetrics);
    
    // Check for accuracy alerts
    this.checkAccuracyAlerts(metrics);
  }

  /**
   * Record conversation quality metrics
   */
  recordConversationQuality(metrics: ConversationQualityMetrics): void {
    this.qualityMetrics.push(metrics);
    this.trimMetricsHistory(this.qualityMetrics);
  }

  /**
   * Record system health metrics
   */
  recordSystemHealth(metrics: SystemHealthMetrics): void {
    this.systemMetrics.push(metrics);
    this.trimMetricsHistory(this.systemMetrics);
    
    // Check for system health alerts
    this.checkSystemHealthAlerts(metrics);
  }

  /**
   * Get performance statistics for a time period
   */
  getPerformanceStats(hours: number = 24): {
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    totalRequests: number;
    errorRate: number;
  } {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentMetrics = this.performanceMetrics.filter(m => m.timestamp >= cutoff);
    
    if (recentMetrics.length === 0) {
      return {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        totalRequests: 0,
        errorRate: 0
      };
    }

    const responseTimes = recentMetrics.map(m => m.totalRequestTime).sort((a, b) => a - b);
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);

    return {
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      p95ResponseTime: responseTimes[p95Index] || 0,
      p99ResponseTime: responseTimes[p99Index] || 0,
      totalRequests: recentMetrics.length,
      errorRate: 0 // Will be calculated from error tracking
    };
  }

  /**
   * Get accuracy statistics for a time period
   */
  getAccuracyStats(hours: number = 24): {
    averageFactRecall: number;
    averageContextContinuity: number;
    averageHallucinationRate: number;
    totalConversations: number;
  } {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentMetrics = this.accuracyMetrics.filter(m => m.timestamp >= cutoff);
    
    if (recentMetrics.length === 0) {
      return {
        averageFactRecall: 0,
        averageContextContinuity: 0,
        averageHallucinationRate: 0,
        totalConversations: 0
      };
    }

    return {
      averageFactRecall: recentMetrics.reduce((sum, m) => sum + m.factRecallAccuracy, 0) / recentMetrics.length,
      averageContextContinuity: recentMetrics.reduce((sum, m) => sum + m.contextContinuityScore, 0) / recentMetrics.length,
      averageHallucinationRate: recentMetrics.reduce((sum, m) => sum + m.hallucinationRate, 0) / recentMetrics.length,
      totalConversations: recentMetrics.length
    };
  }

  /**
   * Get conversation quality statistics
   */
  getQualityStats(hours: number = 24): {
    averageSatisfaction: number;
    averageCoherence: number;
    averageRelevance: number;
    averagePersonalityConsistency: number;
    totalConversations: number;
  } {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentMetrics = this.qualityMetrics.filter(m => m.timestamp >= cutoff);
    
    if (recentMetrics.length === 0) {
      return {
        averageSatisfaction: 0,
        averageCoherence: 0,
        averageRelevance: 0,
        averagePersonalityConsistency: 0,
        totalConversations: 0
      };
    }

    const satisfactionMetrics = recentMetrics.filter(m => m.userSatisfactionScore !== undefined);

    return {
      averageSatisfaction: satisfactionMetrics.length > 0 
        ? satisfactionMetrics.reduce((sum, m) => sum + (m.userSatisfactionScore || 0), 0) / satisfactionMetrics.length
        : 0,
      averageCoherence: recentMetrics.reduce((sum, m) => sum + m.topicCoherence, 0) / recentMetrics.length,
      averageRelevance: recentMetrics.reduce((sum, m) => sum + m.responseRelevance, 0) / recentMetrics.length,
      averagePersonalityConsistency: recentMetrics.reduce((sum, m) => sum + m.personalityConsistency, 0) / recentMetrics.length,
      totalConversations: recentMetrics.length
    };
  }

  /**
   * Get system health statistics
   */
  getSystemHealthStats(hours: number = 24): {
    averageDatabaseResponseTime: number;
    averageApiResponseTime: number;
    averageCacheHitRate: number;
    averageErrorRate: number;
    currentActiveConnections: number;
    currentMemoryUsage: number;
    currentCpuUsage: number;
  } {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentMetrics = this.systemMetrics.filter(m => m.timestamp >= cutoff);
    
    if (recentMetrics.length === 0) {
      return {
        averageDatabaseResponseTime: 0,
        averageApiResponseTime: 0,
        averageCacheHitRate: 0,
        averageErrorRate: 0,
        currentActiveConnections: 0,
        currentMemoryUsage: 0,
        currentCpuUsage: 0
      };
    }

    const latest = recentMetrics[recentMetrics.length - 1];

    return {
      averageDatabaseResponseTime: recentMetrics.reduce((sum, m) => sum + m.databaseResponseTime, 0) / recentMetrics.length,
      averageApiResponseTime: recentMetrics.reduce((sum, m) => sum + m.apiResponseTime, 0) / recentMetrics.length,
      averageCacheHitRate: recentMetrics.reduce((sum, m) => sum + m.cacheHitRate, 0) / recentMetrics.length,
      averageErrorRate: recentMetrics.reduce((sum, m) => sum + m.errorRate, 0) / recentMetrics.length,
      currentActiveConnections: latest.activeConnections,
      currentMemoryUsage: latest.memoryUsage,
      currentCpuUsage: latest.cpuUsage
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Get all alerts for a time period
   */
  getAlerts(hours: number = 24): Alert[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.alerts.filter(alert => alert.timestamp >= cutoff);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * Generate dashboard data
   */
  getDashboardData(hours: number = 24): {
    performance: ReturnType<typeof this.getPerformanceStats>;
    accuracy: ReturnType<typeof this.getAccuracyStats>;
    quality: ReturnType<typeof this.getQualityStats>;
    systemHealth: ReturnType<typeof this.getSystemHealthStats>;
    activeAlerts: Alert[];
    alertsSummary: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  } {
    const activeAlerts = this.getActiveAlerts();
    
    return {
      performance: this.getPerformanceStats(hours),
      accuracy: this.getAccuracyStats(hours),
      quality: this.getQualityStats(hours),
      systemHealth: this.getSystemHealthStats(hours),
      activeAlerts,
      alertsSummary: {
        critical: activeAlerts.filter(a => a.severity === 'critical').length,
        high: activeAlerts.filter(a => a.severity === 'high').length,
        medium: activeAlerts.filter(a => a.severity === 'medium').length,
        low: activeAlerts.filter(a => a.severity === 'low').length
      }
    };
  }

  private checkPerformanceAlerts(metrics: PerformanceMetrics): void {
    if (metrics.totalRequestTime > this.thresholds.responseTimeThreshold) {
      this.createAlert({
        type: 'performance',
        severity: metrics.totalRequestTime > this.thresholds.responseTimeThreshold * 2 ? 'high' : 'medium',
        message: `Response time exceeded threshold: ${metrics.totalRequestTime}ms > ${this.thresholds.responseTimeThreshold}ms`,
        metrics: { responseTime: metrics.totalRequestTime, avatarId: metrics.avatarId }
      });
    }
  }

  private checkAccuracyAlerts(metrics: AccuracyMetrics): void {
    if (metrics.factRecallAccuracy < this.thresholds.accuracyThreshold) {
      this.createAlert({
        type: 'accuracy',
        severity: metrics.factRecallAccuracy < this.thresholds.accuracyThreshold * 0.8 ? 'high' : 'medium',
        message: `Fact recall accuracy below threshold: ${metrics.factRecallAccuracy}% < ${this.thresholds.accuracyThreshold}%`,
        metrics: { accuracy: metrics.factRecallAccuracy, avatarId: metrics.avatarId }
      });
    }

    if (metrics.hallucinationRate > 10) { // 10% hallucination rate threshold
      this.createAlert({
        type: 'accuracy',
        severity: 'high',
        message: `High hallucination rate detected: ${metrics.hallucinationRate}%`,
        metrics: { hallucinationRate: metrics.hallucinationRate, avatarId: metrics.avatarId }
      });
    }
  }

  private checkSystemHealthAlerts(metrics: SystemHealthMetrics): void {
    if (metrics.databaseResponseTime > this.thresholds.databaseResponseThreshold) {
      this.createAlert({
        type: 'system',
        severity: 'medium',
        message: `Database response time exceeded threshold: ${metrics.databaseResponseTime}ms`,
        metrics: { databaseResponseTime: metrics.databaseResponseTime }
      });
    }

    if (metrics.memoryUsage > this.thresholds.memoryUsageThreshold) {
      this.createAlert({
        type: 'system',
        severity: metrics.memoryUsage > 90 ? 'critical' : 'high',
        message: `High memory usage: ${metrics.memoryUsage}%`,
        metrics: { memoryUsage: metrics.memoryUsage }
      });
    }

    if (metrics.errorRate > this.thresholds.errorRateThreshold) {
      this.createAlert({
        type: 'error',
        severity: 'high',
        message: `Error rate exceeded threshold: ${metrics.errorRate}%`,
        metrics: { errorRate: metrics.errorRate }
      });
    }
  }

  private createAlert(alertData: Omit<Alert, 'id' | 'timestamp' | 'resolved'>): void {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      resolved: false,
      ...alertData
    };

    this.alerts.push(alert);
    this.cleanupOldAlerts();
  }

  private trimMetricsHistory<T extends { timestamp: Date }>(metrics: T[]): void {
    if (metrics.length > this.maxMetricsHistory) {
      metrics.splice(0, metrics.length - this.maxMetricsHistory);
    }
  }

  private cleanupOldAlerts(): void {
    const cutoff = new Date(Date.now() - this.alertRetentionDays * 24 * 60 * 60 * 1000);
    this.alerts = this.alerts.filter(alert => alert.timestamp >= cutoff);
  }

  /**
   * Export metrics for external analysis
   */
  exportMetrics(hours: number = 24): {
    performance: PerformanceMetrics[];
    accuracy: AccuracyMetrics[];
    quality: ConversationQualityMetrics[];
    systemHealth: SystemHealthMetrics[];
  } {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return {
      performance: this.performanceMetrics.filter(m => m.timestamp >= cutoff),
      accuracy: this.accuracyMetrics.filter(m => m.timestamp >= cutoff),
      quality: this.qualityMetrics.filter(m => m.timestamp >= cutoff),
      systemHealth: this.systemMetrics.filter(m => m.timestamp >= cutoff)
    };
  }

  /**
   * Clear all metrics and alerts (for testing)
   */
  clearAll(): void {
    this.performanceMetrics = [];
    this.accuracyMetrics = [];
    this.qualityMetrics = [];
    this.systemMetrics = [];
    this.alerts = [];
  }
}

// Singleton instance
export const monitoringService = new MonitoringService();