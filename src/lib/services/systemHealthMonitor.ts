/**
 * System Health Monitor for Hybrid Retrieval System
 * 
 * Monitors system resources, cache sizes, memory usage, and
 * overall health of the hybrid retrieval components.
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SystemHealthMetrics {
  timestamp: number;
  
  // System resources
  cpuUsagePercent: number;
  memoryUsageMB: number;
  memoryUsagePercent: number;
  diskUsageMB: number;
  diskUsagePercent: number;
  
  // Hybrid retrieval specific
  embeddingCacheSize: number;
  embeddingCacheSizeMB: number;
  vectorIndexSize: number;
  vectorIndexSizeMB: number;
  bm25IndexSize: number;
  
  // Cache health
  embeddingCacheHitRate: number;
  queryCacheHitRate: number;
  expansionCacheHitRate: number;
  
  // Component status
  componentHealth: {
    bm25Retriever: 'healthy' | 'degraded' | 'unhealthy';
    vectorRetriever: 'healthy' | 'degraded' | 'unhealthy';
    queryExpander: 'healthy' | 'degraded' | 'unhealthy';
    resultReranker: 'healthy' | 'degraded' | 'unhealthy';
    embeddingService: 'healthy' | 'degraded' | 'unhealthy';
    cacheManager: 'healthy' | 'degraded' | 'unhealthy';
  };
  
  // Performance indicators
  averageResponseTime: number;
  p95ResponseTime: number;
  errorRate: number;
  throughput: number;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  timestamp: number;
  duration: number;
  metadata?: Record<string, any>;
}

export interface HealthThresholds {
  cpuUsageWarning: number;
  cpuUsageCritical: number;
  memoryUsageWarning: number;
  memoryUsageCritical: number;
  diskUsageWarning: number;
  diskUsageCritical: number;
  responseTimeWarning: number;
  responseTimeCritical: number;
  errorRateWarning: number;
  errorRateCritical: number;
  cacheHitRateWarning: number;
}

export class SystemHealthMonitor extends EventEmitter {
  private metrics: SystemHealthMetrics;
  private thresholds: HealthThresholds;
  private healthChecks: Map<string, HealthCheck>;
  private monitoringInterval: NodeJS.Timeout | null;
  private performanceHistory: Array<{
    timestamp: number;
    responseTime: number;
    errorOccurred: boolean;
  }>;
  private maxHistorySize: number;

  constructor(options: {
    thresholds?: Partial<HealthThresholds>;
    maxHistorySize?: number;
  } = {}) {
    super();
    
    this.maxHistorySize = options.maxHistorySize || 1000;
    this.performanceHistory = [];
    this.healthChecks = new Map();
    this.monitoringInterval = null;
    
    this.thresholds = {
      cpuUsageWarning: 70,
      cpuUsageCritical: 90,
      memoryUsageWarning: 80,
      memoryUsageCritical: 95,
      diskUsageWarning: 80,
      diskUsageCritical: 95,
      responseTimeWarning: 500,
      responseTimeCritical: 1000,
      errorRateWarning: 5,
      errorRateCritical: 15,
      cacheHitRateWarning: 60,
      ...options.thresholds
    };

    this.metrics = {
      timestamp: Date.now(),
      cpuUsagePercent: 0,
      memoryUsageMB: 0,
      memoryUsagePercent: 0,
      diskUsageMB: 0,
      diskUsagePercent: 0,
      embeddingCacheSize: 0,
      embeddingCacheSizeMB: 0,
      vectorIndexSize: 0,
      vectorIndexSizeMB: 0,
      bm25IndexSize: 0,
      embeddingCacheHitRate: 0,
      queryCacheHitRate: 0,
      expansionCacheHitRate: 0,
      componentHealth: {
        bm25Retriever: 'healthy',
        vectorRetriever: 'healthy',
        queryExpander: 'healthy',
        resultReranker: 'healthy',
        embeddingService: 'healthy',
        cacheManager: 'healthy'
      },
      averageResponseTime: 0,
      p95ResponseTime: 0,
      errorRate: 0,
      throughput: 0
    };
  }

  /**
   * Start health monitoring
   */
  start(intervalMs: number = 30000): void {
    if (this.monitoringInterval) {
      this.stop();
    }

    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
      await this.runHealthChecks();
      this.analyzeHealth();
    }, intervalMs);

    console.log('System health monitoring started');
    this.emit('monitoring:started');
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('System health monitoring stopped');
    this.emit('monitoring:stopped');
  }

  /**
   * Get current health metrics
   */
  getCurrentMetrics(): SystemHealthMetrics {
    return { ...this.metrics };
  }

  /**
   * Get health check results
   */
  getHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  /**
   * Record performance data point
   */
  recordPerformance(responseTime: number, errorOccurred: boolean = false): void {
    this.performanceHistory.push({
      timestamp: Date.now(),
      responseTime,
      errorOccurred
    });

    // Trim history if needed
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory = this.performanceHistory.slice(-this.maxHistorySize);
    }

    // Update real-time metrics
    this.updatePerformanceMetrics();
  }

  /**
   * Update cache metrics
   */
  updateCacheMetrics(cacheMetrics: {
    embeddingCacheSize?: number;
    embeddingCacheSizeMB?: number;
    vectorIndexSize?: number;
    vectorIndexSizeMB?: number;
    bm25IndexSize?: number;
    embeddingCacheHitRate?: number;
    queryCacheHitRate?: number;
    expansionCacheHitRate?: number;
  }): void {
    Object.assign(this.metrics, cacheMetrics);
    this.emit('metrics:cache_updated', cacheMetrics);
  }

  /**
   * Update component health status
   */
  updateComponentHealth(component: keyof SystemHealthMetrics['componentHealth'], status: 'healthy' | 'degraded' | 'unhealthy'): void {
    this.metrics.componentHealth[component] = status;
    this.emit('health:component_updated', { component, status });
  }

  /**
   * Get overall system health status
   */
  getOverallHealth(): 'healthy' | 'degraded' | 'unhealthy' {
    const healthChecks = Array.from(this.healthChecks.values());
    const failedChecks = healthChecks.filter(check => check.status === 'fail');
    const warningChecks = healthChecks.filter(check => check.status === 'warn');

    if (failedChecks.length > 0) {
      return 'unhealthy';
    }

    if (warningChecks.length > 2) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Generate health report
   */
  generateHealthReport(): {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    metrics: SystemHealthMetrics;
    healthChecks: HealthCheck[];
    recommendations: string[];
  } {
    const overall = this.getOverallHealth();
    const healthChecks = this.getHealthChecks();
    const recommendations = this.generateRecommendations();

    return {
      overall,
      metrics: this.getCurrentMetrics(),
      healthChecks,
      recommendations
    };
  }

  private async collectMetrics(): Promise<void> {
    try {
      // System metrics
      const cpuUsage = await this.getCpuUsage();
      const memoryUsage = this.getMemoryUsage();
      const diskUsage = await this.getDiskUsage();

      this.metrics.timestamp = Date.now();
      this.metrics.cpuUsagePercent = cpuUsage;
      this.metrics.memoryUsageMB = memoryUsage.usedMB;
      this.metrics.memoryUsagePercent = memoryUsage.usagePercent;
      this.metrics.diskUsageMB = diskUsage.usedMB;
      this.metrics.diskUsagePercent = diskUsage.usagePercent;

      this.emit('metrics:collected', this.metrics);
      
    } catch (error) {
      console.error('Error collecting system metrics:', error);
      this.emit('metrics:error', error);
    }
  }

  private async runHealthChecks(): Promise<void> {
    const checks = [
      this.checkCpuHealth(),
      this.checkMemoryHealth(),
      this.checkDiskHealth(),
      this.checkResponseTimeHealth(),
      this.checkErrorRateHealth(),
      this.checkCacheHealth(),
      this.checkComponentHealth()
    ];

    const results = await Promise.allSettled(checks);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        this.healthChecks.set(result.value.name, result.value);
      } else {
        console.error(`Health check ${index} failed:`, result.reason);
      }
    });
  }

  private async checkCpuHealth(): Promise<HealthCheck> {
    const start = Date.now();
    const cpuUsage = this.metrics.cpuUsagePercent;
    
    let status: 'pass' | 'warn' | 'fail' = 'pass';
    let message = `CPU usage is ${cpuUsage.toFixed(1)}%`;

    if (cpuUsage >= this.thresholds.cpuUsageCritical) {
      status = 'fail';
      message += ' (critical threshold exceeded)';
    } else if (cpuUsage >= this.thresholds.cpuUsageWarning) {
      status = 'warn';
      message += ' (warning threshold exceeded)';
    }

    return {
      name: 'cpu_usage',
      status,
      message,
      timestamp: Date.now(),
      duration: Date.now() - start,
      metadata: { cpuUsage, threshold: this.thresholds.cpuUsageWarning }
    };
  }

  private async checkMemoryHealth(): Promise<HealthCheck> {
    const start = Date.now();
    const memoryUsage = this.metrics.memoryUsagePercent;
    
    let status: 'pass' | 'warn' | 'fail' = 'pass';
    let message = `Memory usage is ${memoryUsage.toFixed(1)}%`;

    if (memoryUsage >= this.thresholds.memoryUsageCritical) {
      status = 'fail';
      message += ' (critical threshold exceeded)';
    } else if (memoryUsage >= this.thresholds.memoryUsageWarning) {
      status = 'warn';
      message += ' (warning threshold exceeded)';
    }

    return {
      name: 'memory_usage',
      status,
      message,
      timestamp: Date.now(),
      duration: Date.now() - start,
      metadata: { memoryUsage, threshold: this.thresholds.memoryUsageWarning }
    };
  }

  private async checkDiskHealth(): Promise<HealthCheck> {
    const start = Date.now();
    const diskUsage = this.metrics.diskUsagePercent;
    
    let status: 'pass' | 'warn' | 'fail' = 'pass';
    let message = `Disk usage is ${diskUsage.toFixed(1)}%`;

    if (diskUsage >= this.thresholds.diskUsageCritical) {
      status = 'fail';
      message += ' (critical threshold exceeded)';
    } else if (diskUsage >= this.thresholds.diskUsageWarning) {
      status = 'warn';
      message += ' (warning threshold exceeded)';
    }

    return {
      name: 'disk_usage',
      status,
      message,
      timestamp: Date.now(),
      duration: Date.now() - start,
      metadata: { diskUsage, threshold: this.thresholds.diskUsageWarning }
    };
  }

  private async checkResponseTimeHealth(): Promise<HealthCheck> {
    const start = Date.now();
    const responseTime = this.metrics.p95ResponseTime;
    
    let status: 'pass' | 'warn' | 'fail' = 'pass';
    let message = `P95 response time is ${responseTime}ms`;

    if (responseTime >= this.thresholds.responseTimeCritical) {
      status = 'fail';
      message += ' (critical threshold exceeded)';
    } else if (responseTime >= this.thresholds.responseTimeWarning) {
      status = 'warn';
      message += ' (warning threshold exceeded)';
    }

    return {
      name: 'response_time',
      status,
      message,
      timestamp: Date.now(),
      duration: Date.now() - start,
      metadata: { responseTime, threshold: this.thresholds.responseTimeWarning }
    };
  }

  private async checkErrorRateHealth(): Promise<HealthCheck> {
    const start = Date.now();
    const errorRate = this.metrics.errorRate;
    
    let status: 'pass' | 'warn' | 'fail' = 'pass';
    let message = `Error rate is ${errorRate.toFixed(1)}%`;

    if (errorRate >= this.thresholds.errorRateCritical) {
      status = 'fail';
      message += ' (critical threshold exceeded)';
    } else if (errorRate >= this.thresholds.errorRateWarning) {
      status = 'warn';
      message += ' (warning threshold exceeded)';
    }

    return {
      name: 'error_rate',
      status,
      message,
      timestamp: Date.now(),
      duration: Date.now() - start,
      metadata: { errorRate, threshold: this.thresholds.errorRateWarning }
    };
  }

  private async checkCacheHealth(): Promise<HealthCheck> {
    const start = Date.now();
    const cacheHitRate = Math.min(
      this.metrics.embeddingCacheHitRate,
      this.metrics.queryCacheHitRate,
      this.metrics.expansionCacheHitRate
    );
    
    let status: 'pass' | 'warn' | 'fail' = 'pass';
    let message = `Minimum cache hit rate is ${cacheHitRate.toFixed(1)}%`;

    if (cacheHitRate < this.thresholds.cacheHitRateWarning) {
      status = 'warn';
      message += ' (below warning threshold)';
    }

    return {
      name: 'cache_efficiency',
      status,
      message,
      timestamp: Date.now(),
      duration: Date.now() - start,
      metadata: { 
        cacheHitRate, 
        threshold: this.thresholds.cacheHitRateWarning,
        embeddingCacheHitRate: this.metrics.embeddingCacheHitRate,
        queryCacheHitRate: this.metrics.queryCacheHitRate,
        expansionCacheHitRate: this.metrics.expansionCacheHitRate
      }
    };
  }

  private async checkComponentHealth(): Promise<HealthCheck> {
    const start = Date.now();
    const components = this.metrics.componentHealth;
    const unhealthyComponents = Object.entries(components)
      .filter(([_, status]) => status === 'unhealthy')
      .map(([name, _]) => name);
    const degradedComponents = Object.entries(components)
      .filter(([_, status]) => status === 'degraded')
      .map(([name, _]) => name);
    
    let status: 'pass' | 'warn' | 'fail' = 'pass';
    let message = 'All components are healthy';

    if (unhealthyComponents.length > 0) {
      status = 'fail';
      message = `Unhealthy components: ${unhealthyComponents.join(', ')}`;
    } else if (degradedComponents.length > 0) {
      status = 'warn';
      message = `Degraded components: ${degradedComponents.join(', ')}`;
    }

    return {
      name: 'component_health',
      status,
      message,
      timestamp: Date.now(),
      duration: Date.now() - start,
      metadata: { unhealthyComponents, degradedComponents, components }
    };
  }

  private async getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();
      
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = Date.now();
        
        const totalTime = (endTime - startTime) * 1000; // Convert to microseconds
        const totalUsage = endUsage.user + endUsage.system;
        const cpuPercent = (totalUsage / totalTime) * 100;
        
        resolve(Math.min(100, Math.max(0, cpuPercent)));
      }, 100);
    });
  }

  private getMemoryUsage(): { usedMB: number; usagePercent: number } {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    return {
      usedMB: Math.round(usedMemory / (1024 * 1024)),
      usagePercent: (usedMemory / totalMemory) * 100
    };
  }

  private async getDiskUsage(): Promise<{ usedMB: number; usagePercent: number }> {
    try {
      const stats = await fs.stat(process.cwd());
      // This is a simplified disk usage calculation
      // In production, you might want to use a more sophisticated method
      return {
        usedMB: 0, // Placeholder
        usagePercent: 0 // Placeholder
      };
    } catch (error) {
      return { usedMB: 0, usagePercent: 0 };
    }
  }

  private updatePerformanceMetrics(): void {
    if (this.performanceHistory.length === 0) return;

    const recentHistory = this.performanceHistory.slice(-100); // Last 100 requests
    const responseTimes = recentHistory.map(h => h.responseTime);
    const errors = recentHistory.filter(h => h.errorOccurred);

    this.metrics.averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    this.metrics.p95ResponseTime = this.calculatePercentile(responseTimes, 0.95);
    this.metrics.errorRate = (errors.length / recentHistory.length) * 100;
    this.metrics.throughput = recentHistory.length / ((Date.now() - recentHistory[0].timestamp) / 1000);
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }

  private analyzeHealth(): void {
    const overallHealth = this.getOverallHealth();
    const previousHealth = this.getOverallHealth(); // This would be stored from previous check
    
    if (overallHealth !== previousHealth) {
      this.emit('health:changed', { 
        from: previousHealth, 
        to: overallHealth, 
        timestamp: Date.now() 
      });
    }

    this.emit('health:analyzed', {
      health: overallHealth,
      metrics: this.metrics,
      healthChecks: Array.from(this.healthChecks.values())
    });
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const healthChecks = Array.from(this.healthChecks.values());

    // CPU recommendations
    const cpuCheck = healthChecks.find(check => check.name === 'cpu_usage');
    if (cpuCheck && cpuCheck.status !== 'pass') {
      recommendations.push('Consider scaling up CPU resources or optimizing query processing');
    }

    // Memory recommendations
    const memoryCheck = healthChecks.find(check => check.name === 'memory_usage');
    if (memoryCheck && memoryCheck.status !== 'pass') {
      recommendations.push('Consider increasing memory allocation or optimizing cache sizes');
    }

    // Response time recommendations
    const responseTimeCheck = healthChecks.find(check => check.name === 'response_time');
    if (responseTimeCheck && responseTimeCheck.status !== 'pass') {
      recommendations.push('Investigate query performance bottlenecks and consider caching optimizations');
    }

    // Cache recommendations
    const cacheCheck = healthChecks.find(check => check.name === 'cache_efficiency');
    if (cacheCheck && cacheCheck.status !== 'pass') {
      recommendations.push('Review cache warming strategies and consider increasing cache TTL');
    }

    // Component recommendations
    const componentCheck = healthChecks.find(check => check.name === 'component_health');
    if (componentCheck && componentCheck.status !== 'pass') {
      recommendations.push('Investigate unhealthy components and check external service dependencies');
    }

    if (recommendations.length === 0) {
      recommendations.push('System health is optimal - no immediate actions required');
    }

    return recommendations;
  }
}