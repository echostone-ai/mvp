/**
 * Dashboard Service for GPT-5 Avatar Memory System
 * Provides real-time dashboard data and system health monitoring
 */

import { MonitoringService } from './monitoringService';
import { AnalyticsService } from './analyticsService';

export interface DashboardData {
  timestamp: Date;
  systemStatus: 'healthy' | 'warning' | 'critical';
  performance: {
    averageResponseTime: number;
    p95ResponseTime: number;
    requestsPerMinute: number;
    errorRate: number;
    trend: 'up' | 'down' | 'stable';
  };
  accuracy: {
    factRecallAccuracy: number;
    contextContinuity: number;
    hallucinationRate: number;
    trend: 'up' | 'down' | 'stable';
  };
  systemHealth: {
    databaseHealth: 'healthy' | 'warning' | 'critical';
    apiHealth: 'healthy' | 'warning' | 'critical';
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
    cacheHitRate: number;
  };
  alerts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    recent: Array<{
      id: string;
      type: string;
      severity: string;
      message: string;
      timestamp: Date;
    }>;
  };
  topAvatars: Array<{
    avatarId: string;
    conversationCount: number;
    averageResponseTime: number;
    accuracyScore: number;
    userSatisfaction: number;
  }>;
  recentActivity: Array<{
    timestamp: Date;
    type: 'conversation' | 'error' | 'alert' | 'system';
    message: string;
    severity?: 'info' | 'warning' | 'error';
  }>;
}

export interface SystemHealthCheck {
  component: string;
  status: 'healthy' | 'warning' | 'critical';
  responseTime?: number;
  errorRate?: number;
  lastCheck: Date;
  details?: string;
}

export class DashboardService {
  private lastDashboardData: DashboardData | null = null;
  private healthChecks: Map<string, SystemHealthCheck> = new Map();

  constructor(
    private monitoringService: MonitoringService,
    private analyticsService: AnalyticsService
  ) {
    this.initializeHealthChecks();
  }

  /**
   * Get real-time dashboard data
   */
  async getDashboardData(): Promise<DashboardData> {
    const timestamp = new Date();
    
    // Get current metrics
    const performanceStats = this.monitoringService.getPerformanceStats(1); // Last hour
    const accuracyStats = this.monitoringService.getAccuracyStats(1);
    const systemHealthStats = this.monitoringService.getSystemHealthStats(1);
    const activeAlerts = this.monitoringService.getActiveAlerts();
    const avatarProfiles = this.analyticsService.generateAvatarProfiles(24);

    // Calculate trends
    const performanceTrends = this.analyticsService.analyzePerformanceTrends(1);
    const accuracyTrends = this.analyticsService.analyzeAccuracyTrends(1);

    // Determine system status
    const systemStatus = this.calculateSystemStatus(activeAlerts, systemHealthStats);

    // Get recent activity
    const recentActivity = this.getRecentActivity();

    const dashboardData: DashboardData = {
      timestamp,
      systemStatus,
      performance: {
        averageResponseTime: performanceStats.averageResponseTime,
        p95ResponseTime: performanceStats.p95ResponseTime,
        requestsPerMinute: this.calculateRequestsPerMinute(performanceStats.totalRequests),
        errorRate: performanceStats.errorRate,
        trend: this.getTrendDirection(performanceTrends.find(t => t.metric === 'Response Time'))
      },
      accuracy: {
        factRecallAccuracy: accuracyStats.averageFactRecall,
        contextContinuity: accuracyStats.averageContextContinuity,
        hallucinationRate: accuracyStats.averageHallucinationRate,
        trend: this.getTrendDirection(accuracyTrends.find(t => t.metric === 'Fact Recall Accuracy'))
      },
      systemHealth: {
        databaseHealth: this.getComponentHealth('database'),
        apiHealth: this.getComponentHealth('api'),
        memoryUsage: systemHealthStats.currentMemoryUsage,
        cpuUsage: systemHealthStats.currentCpuUsage,
        activeConnections: systemHealthStats.currentActiveConnections,
        cacheHitRate: systemHealthStats.averageCacheHitRate
      },
      alerts: {
        critical: activeAlerts.filter(a => a.severity === 'critical').length,
        high: activeAlerts.filter(a => a.severity === 'high').length,
        medium: activeAlerts.filter(a => a.severity === 'medium').length,
        low: activeAlerts.filter(a => a.severity === 'low').length,
        recent: activeAlerts.slice(0, 5).map(alert => ({
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          timestamp: alert.timestamp
        }))
      },
      topAvatars: avatarProfiles.slice(0, 5).map(profile => ({
        avatarId: profile.avatarId,
        conversationCount: profile.conversationCount,
        averageResponseTime: profile.averageResponseTime,
        accuracyScore: profile.accuracyScore,
        userSatisfaction: profile.userSatisfaction
      })),
      recentActivity
    };

    this.lastDashboardData = dashboardData;
    return dashboardData;
  }

  /**
   * Get system health checks
   */
  async getSystemHealthChecks(): Promise<SystemHealthCheck[]> {
    // Update health checks
    await this.performHealthChecks();
    
    return Array.from(this.healthChecks.values());
  }

  /**
   * Get detailed performance metrics for charts
   */
  getPerformanceChartData(hours: number = 24): {
    timestamps: Date[];
    responseTime: number[];
    requestVolume: number[];
    errorRate: number[];
    accuracy: number[];
  } {
    const metrics = this.monitoringService.exportMetrics(hours);
    
    // Group metrics by hour
    const hourlyData = new Map<string, {
      responseTimes: number[];
      requestCount: number;
      errors: number;
      accuracyScores: number[];
    }>();

    metrics.performance.forEach(metric => {
      const hourKey = new Date(metric.timestamp.getTime()).toISOString().slice(0, 13);
      if (!hourlyData.has(hourKey)) {
        hourlyData.set(hourKey, {
          responseTimes: [],
          requestCount: 0,
          errors: 0,
          accuracyScores: []
        });
      }
      const data = hourlyData.get(hourKey)!;
      data.responseTimes.push(metric.totalRequestTime);
      data.requestCount++;
    });

    metrics.accuracy.forEach(metric => {
      const hourKey = new Date(metric.timestamp.getTime()).toISOString().slice(0, 13);
      const data = hourlyData.get(hourKey);
      if (data) {
        data.accuracyScores.push(metric.factRecallAccuracy);
      }
    });

    // Convert to chart format
    const sortedHours = Array.from(hourlyData.keys()).sort();
    const timestamps = sortedHours.map(hour => new Date(hour + ':00:00'));
    const responseTime = sortedHours.map(hour => {
      const data = hourlyData.get(hour)!;
      return data.responseTimes.length > 0 
        ? data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length 
        : 0;
    });
    const requestVolume = sortedHours.map(hour => hourlyData.get(hour)!.requestCount);
    const errorRate = sortedHours.map(hour => {
      const data = hourlyData.get(hour)!;
      return data.requestCount > 0 ? (data.errors / data.requestCount) * 100 : 0;
    });
    const accuracy = sortedHours.map(hour => {
      const data = hourlyData.get(hour)!;
      return data.accuracyScores.length > 0 
        ? data.accuracyScores.reduce((a, b) => a + b, 0) / data.accuracyScores.length 
        : 0;
    });

    return {
      timestamps,
      responseTime,
      requestVolume,
      errorRate,
      accuracy
    };
  }

  /**
   * Get avatar comparison data
   */
  getAvatarComparisonData(avatarIds: string[], hours: number = 24): {
    avatarId: string;
    metrics: {
      responseTime: number;
      accuracy: number;
      conversationCount: number;
      userSatisfaction: number;
    };
  }[] {
    const profiles = this.analyticsService.generateAvatarProfiles(hours);
    
    return avatarIds.map(avatarId => {
      const profile = profiles.find(p => p.avatarId === avatarId);
      return {
        avatarId,
        metrics: {
          responseTime: profile?.averageResponseTime || 0,
          accuracy: profile?.accuracyScore || 0,
          conversationCount: profile?.conversationCount || 0,
          userSatisfaction: profile?.userSatisfaction || 0
        }
      };
    });
  }

  /**
   * Get usage heatmap data
   */
  getUsageHeatmapData(days: number = 30): {
    hour: number;
    day: number;
    value: number;
  }[] {
    const patterns = this.analyticsService.analyzeUsagePatterns(days);
    
    return patterns.map(pattern => ({
      hour: pattern.timeOfDay,
      day: pattern.dayOfWeek,
      value: pattern.requestCount
    }));
  }

  /**
   * Export dashboard data for external systems
   */
  exportDashboardData(format: 'json' | 'csv' = 'json'): string {
    if (!this.lastDashboardData) {
      throw new Error('No dashboard data available. Call getDashboardData() first.');
    }

    if (format === 'json') {
      return JSON.stringify(this.lastDashboardData, null, 2);
    } else {
      // Convert to CSV format
      const csvRows = [
        'Timestamp,System Status,Avg Response Time,P95 Response Time,Requests/Min,Error Rate,Fact Recall,Context Continuity,Hallucination Rate,Memory Usage,CPU Usage',
        [
          this.lastDashboardData.timestamp.toISOString(),
          this.lastDashboardData.systemStatus,
          this.lastDashboardData.performance.averageResponseTime,
          this.lastDashboardData.performance.p95ResponseTime,
          this.lastDashboardData.performance.requestsPerMinute,
          this.lastDashboardData.performance.errorRate,
          this.lastDashboardData.accuracy.factRecallAccuracy,
          this.lastDashboardData.accuracy.contextContinuity,
          this.lastDashboardData.accuracy.hallucinationRate,
          this.lastDashboardData.systemHealth.memoryUsage,
          this.lastDashboardData.systemHealth.cpuUsage
        ].join(',')
      ];
      return csvRows.join('\n');
    }
  }

  private initializeHealthChecks(): void {
    const components = ['database', 'api', 'cache', 'memory', 'gpt5'];
    
    components.forEach(component => {
      this.healthChecks.set(component, {
        component,
        status: 'healthy',
        lastCheck: new Date(),
        details: 'Initialized'
      });
    });
  }

  private async performHealthChecks(): Promise<void> {
    const now = new Date();
    
    // Database health check
    try {
      const start = Date.now();
      // This would typically perform a simple database query
      const responseTime = Date.now() - start;
      
      this.healthChecks.set('database', {
        component: 'database',
        status: responseTime < 100 ? 'healthy' : responseTime < 500 ? 'warning' : 'critical',
        responseTime,
        lastCheck: now,
        details: `Response time: ${responseTime}ms`
      });
    } catch (error) {
      this.healthChecks.set('database', {
        component: 'database',
        status: 'critical',
        lastCheck: now,
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    // API health check
    try {
      const start = Date.now();
      // This would typically make a test API call
      const responseTime = Date.now() - start;
      
      this.healthChecks.set('api', {
        component: 'api',
        status: responseTime < 200 ? 'healthy' : responseTime < 1000 ? 'warning' : 'critical',
        responseTime,
        lastCheck: now,
        details: `Response time: ${responseTime}ms`
      });
    } catch (error) {
      this.healthChecks.set('api', {
        component: 'api',
        status: 'critical',
        lastCheck: now,
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    // Memory health check
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    this.healthChecks.set('memory', {
      component: 'memory',
      status: memoryUsagePercent < 70 ? 'healthy' : memoryUsagePercent < 85 ? 'warning' : 'critical',
      lastCheck: now,
      details: `Memory usage: ${memoryUsagePercent.toFixed(1)}%`
    });
  }

  private calculateSystemStatus(
    alerts: any[], 
    systemHealth: any
  ): 'healthy' | 'warning' | 'critical' {
    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    const highAlerts = alerts.filter(a => a.severity === 'high').length;
    
    if (criticalAlerts > 0 || systemHealth.currentMemoryUsage > 90) {
      return 'critical';
    }
    
    if (highAlerts > 0 || systemHealth.currentMemoryUsage > 80 || systemHealth.averageErrorRate > 5) {
      return 'warning';
    }
    
    return 'healthy';
  }

  private calculateRequestsPerMinute(totalRequests: number): number {
    // This is a simplified calculation - in reality, you'd track requests over time
    return Math.round(totalRequests / 60);
  }

  private getTrendDirection(trend: any): 'up' | 'down' | 'stable' {
    if (!trend) return 'stable';
    
    switch (trend.trend) {
      case 'improving': return 'up';
      case 'declining': return 'down';
      default: return 'stable';
    }
  }

  private getComponentHealth(component: string): 'healthy' | 'warning' | 'critical' {
    const healthCheck = this.healthChecks.get(component);
    return healthCheck?.status || 'warning';
  }

  private getRecentActivity(): Array<{
    timestamp: Date;
    type: 'conversation' | 'error' | 'alert' | 'system';
    message: string;
    severity?: 'info' | 'warning' | 'error';
  }> {
    // This would typically query recent logs/events
    // For now, return mock data
    const now = new Date();
    return [
      {
        timestamp: new Date(now.getTime() - 5 * 60 * 1000),
        type: 'conversation',
        message: 'High conversation volume detected',
        severity: 'info'
      },
      {
        timestamp: new Date(now.getTime() - 10 * 60 * 1000),
        type: 'system',
        message: 'Cache hit rate improved to 85%',
        severity: 'info'
      },
      {
        timestamp: new Date(now.getTime() - 15 * 60 * 1000),
        type: 'alert',
        message: 'Response time alert resolved',
        severity: 'info'
      }
    ];
  }
}