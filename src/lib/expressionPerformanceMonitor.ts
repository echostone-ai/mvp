/**
 * Expression Performance Monitor
 * 
 * Monitors expression system performance to ensure <300ms duration limit
 * and maintains TTS baseline performance standards.
 * 
 * Requirements: 9.5, 7.1, 7.2, 9.1, 9.2
 */

import { logger } from './logger';
import { expressionMetrics, expressionMetricsRecorder } from './expressionMetrics';
import { ExpressionErrorHandler, ExpressionErrorType, ExpressionErrorStage } from './expressionErrorHandler';

export interface PerformanceThresholds {
  /** Maximum allowed expression duration (ms) */
  maxExpressionDuration: number;
  /** Maximum allowed first audio delay (ms) */
  maxFirstAudioDelay: number;
  /** Maximum allowed TTS total time increase (ms) */
  maxTTSIncrease: number;
  /** Maximum allowed preload time (ms) */
  maxPreloadTime: number;
  /** Maximum allowed mixing latency (ms) */
  maxMixingLatency: number;
}

export interface PerformanceMeasurement {
  timestamp: number;
  measurementType: 'expression_duration' | 'first_audio' | 'tts_total' | 'preload' | 'mixing';
  value: number;
  threshold: number;
  passed: boolean;
  context?: Record<string, any>;
}

export interface PerformanceReport {
  totalMeasurements: number;
  passedMeasurements: number;
  failedMeasurements: number;
  passRate: number;
  averageValues: Record<string, number>;
  thresholdViolations: PerformanceMeasurement[];
  recommendations: string[];
}

/**
 * Performance monitor for expression system
 */
export class ExpressionPerformanceMonitor {
  private thresholds: PerformanceThresholds;
  private measurements: PerformanceMeasurement[] = [];
  private errorHandler: ExpressionErrorHandler;
  private isMonitoring = false;
  private baselineMetrics = new Map<string, number[]>();

  constructor(
    thresholds: Partial<PerformanceThresholds> = {},
    errorHandler?: ExpressionErrorHandler
  ) {
    this.thresholds = {
      maxExpressionDuration: thresholds.maxExpressionDuration ?? 300, // 300ms limit
      maxFirstAudioDelay: thresholds.maxFirstAudioDelay ?? 200, // Should not delay TTS
      maxTTSIncrease: thresholds.maxTTSIncrease ?? 50, // Max 50ms increase over baseline
      maxPreloadTime: thresholds.maxPreloadTime ?? 2000, // 2 second preload limit
      maxMixingLatency: thresholds.maxMixingLatency ?? 10 // 10ms mixing operations
    };

    this.errorHandler = errorHandler || new ExpressionErrorHandler();
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    this.isMonitoring = true;
    logger.info('Expression performance monitoring started', {
      thresholds: this.thresholds
    });
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    logger.info('Expression performance monitoring stopped');
  }

  /**
   * Measure expression duration and enforce limit
   */
  measureExpressionDuration(
    expressionId: string,
    durationMs: number,
    expressionType: string,
    ownerType: 'user' | 'avatar',
    context?: Record<string, any>
  ): boolean {
    const measurement: PerformanceMeasurement = {
      timestamp: Date.now(),
      measurementType: 'expression_duration',
      value: durationMs,
      threshold: this.thresholds.maxExpressionDuration,
      passed: durationMs <= this.thresholds.maxExpressionDuration,
      context: { expressionId, expressionType, ownerType, ...context }
    };

    this.recordMeasurement(measurement);

    // Record metrics
    expressionMetricsRecorder.recordExpressionDuration(
      durationMs,
      expressionType,
      ownerType,
      this.getPriorityLevel(context?.priority)
    );

    // Handle threshold violation
    if (!measurement.passed) {
      this.handleThresholdViolation(measurement);
      return false;
    }

    return true;
  }

  /**
   * Measure first audio timing
   */
  measureFirstAudio(
    durationMs: number,
    ownerType: 'user' | 'avatar',
    expressionsEnabled: boolean,
    preloadStatus: 'ready' | 'loading' | 'failed',
    context?: Record<string, any>
  ): boolean {
    const measurement: PerformanceMeasurement = {
      timestamp: Date.now(),
      measurementType: 'first_audio',
      value: durationMs,
      threshold: this.thresholds.maxFirstAudioDelay,
      passed: durationMs <= this.thresholds.maxFirstAudioDelay,
      context: { ownerType, expressionsEnabled, preloadStatus, ...context }
    };

    this.recordMeasurement(measurement);

    // Record metrics
    expressionMetricsRecorder.recordFirstAudio(ownerType, expressionsEnabled, preloadStatus);

    // Compare with baseline if available
    this.compareWithBaseline('first_audio', durationMs, expressionsEnabled);

    // Handle threshold violation
    if (!measurement.passed) {
      this.handleThresholdViolation(measurement);
      return false;
    }

    return true;
  }

  /**
   * Measure total TTS time including expressions
   */
  measureTTSTotal(
    durationMs: number,
    baselineDurationMs: number | undefined,
    ownerType: 'user' | 'avatar',
    overlayCount: number,
    expressionsEnabled: boolean,
    context?: Record<string, any>
  ): boolean {
    // Calculate increase over baseline
    const increase = baselineDurationMs ? durationMs - baselineDurationMs : 0;
    
    const measurement: PerformanceMeasurement = {
      timestamp: Date.now(),
      measurementType: 'tts_total',
      value: increase,
      threshold: this.thresholds.maxTTSIncrease,
      passed: increase <= this.thresholds.maxTTSIncrease,
      context: { 
        ownerType, 
        overlayCount, 
        expressionsEnabled, 
        totalDuration: durationMs,
        baselineDuration: baselineDurationMs,
        ...context 
      }
    };

    this.recordMeasurement(measurement);

    // Record metrics
    expressionMetricsRecorder.recordTTSTotal(ownerType, overlayCount, expressionsEnabled);

    // Store baseline for future comparisons
    if (!expressionsEnabled && baselineDurationMs) {
      this.recordBaseline('tts_total', baselineDurationMs);
    }

    // Handle threshold violation
    if (!measurement.passed && expressionsEnabled) {
      this.handleThresholdViolation(measurement);
      return false;
    }

    return true;
  }

  /**
   * Measure preload performance
   */
  measurePreload(
    durationMs: number,
    ownerType: 'user' | 'avatar',
    expressionCount: number,
    cacheStatus: 'hit' | 'miss' | 'partial',
    context?: Record<string, any>
  ): boolean {
    const measurement: PerformanceMeasurement = {
      timestamp: Date.now(),
      measurementType: 'preload',
      value: durationMs,
      threshold: this.thresholds.maxPreloadTime,
      passed: durationMs <= this.thresholds.maxPreloadTime,
      context: { ownerType, expressionCount, cacheStatus, ...context }
    };

    this.recordMeasurement(measurement);

    // Record metrics
    expressionMetricsRecorder.recordPreloadComplete(ownerType, expressionCount, cacheStatus);

    // Handle threshold violation
    if (!measurement.passed) {
      this.handleThresholdViolation(measurement);
      return false;
    }

    return true;
  }

  /**
   * Record TTS performance metrics
   */
  recordTTSPerformance(durationMs: number, type: 'baseline' | 'with_expressions' | 'overhead'): void {
    const metricName = `tts_${type}_ms`;
    
    // Store in baseline metrics for comparison
    if (!this.baselineMetrics.has(metricName)) {
      this.baselineMetrics.set(metricName, []);
    }
    
    const metrics = this.baselineMetrics.get(metricName)!;
    metrics.push(durationMs);
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
    
    logger.debug(`Recorded TTS performance: ${metricName} = ${durationMs}ms`);
  }

  /**
   * Measure audio mixing latency
   */
  measureMixing(
    durationMs: number,
    operationType: 'schedule' | 'play' | 'duck' | 'cleanup',
    concurrentExpressions: number,
    context?: Record<string, any>
  ): boolean {
    const measurement: PerformanceMeasurement = {
      timestamp: Date.now(),
      measurementType: 'mixing',
      value: durationMs,
      threshold: this.thresholds.maxMixingLatency,
      passed: durationMs <= this.thresholds.maxMixingLatency,
      context: { operationType, concurrentExpressions, ...context }
    };

    this.recordMeasurement(measurement);

    // Record metrics
    expressionMetricsRecorder.recordMixingComplete(operationType, concurrentExpressions);

    // Handle threshold violation
    if (!measurement.passed) {
      this.handleThresholdViolation(measurement);
      return false;
    }

    return true;
  }

  /**
   * Record a performance measurement
   */
  private recordMeasurement(measurement: PerformanceMeasurement): void {
    if (!this.isMonitoring) return;

    this.measurements.push(measurement);

    // Keep only recent measurements (last hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.measurements = this.measurements.filter(m => m.timestamp > oneHourAgo);

    // Log measurement
    logger.debug('Performance measurement recorded', {
      type: measurement.measurementType,
      value: measurement.value,
      threshold: measurement.threshold,
      passed: measurement.passed,
      context: measurement.context
    });
  }

  /**
   * Handle threshold violations
   */
  private handleThresholdViolation(measurement: PerformanceMeasurement): void {
    logger.warn('Expression performance threshold violated', {
      type: measurement.measurementType,
      value: measurement.value,
      threshold: measurement.threshold,
      violation: measurement.value - measurement.threshold,
      context: measurement.context
    });

    // Create appropriate error based on measurement type
    let errorType: ExpressionErrorType;
    let errorStage: ExpressionErrorStage;

    switch (measurement.measurementType) {
      case 'expression_duration':
        errorType = ExpressionErrorType.DURATION_EXCEEDED;
        errorStage = ExpressionErrorStage.SCHEDULING;
        break;
      case 'first_audio':
      case 'tts_total':
        errorType = ExpressionErrorType.PLAYBACK_ERROR;
        errorStage = ExpressionErrorStage.PLAYBACK;
        break;
      case 'preload':
        errorType = ExpressionErrorType.TIMEOUT_ERROR;
        errorStage = ExpressionErrorStage.PRELOADING;
        break;
      case 'mixing':
        errorType = ExpressionErrorType.PLAYBACK_ERROR;
        errorStage = ExpressionErrorStage.MIXING;
        break;
      default:
        errorType = ExpressionErrorType.UNKNOWN_ERROR;
        errorStage = ExpressionErrorStage.PLAYBACK;
    }

    // Record error metrics
    expressionMetrics.errorCount.inc({
      error_type: errorType,
      error_stage: errorStage,
      owner_type: measurement.context?.ownerType || 'unknown'
    });
  }

  /**
   * Compare measurement with baseline
   */
  private compareWithBaseline(
    measurementType: string,
    value: number,
    expressionsEnabled: boolean
  ): void {
    const baselineKey = `${measurementType}_${expressionsEnabled ? 'with' : 'without'}_expressions`;
    
    if (!this.baselineMetrics.has(baselineKey)) {
      this.baselineMetrics.set(baselineKey, []);
    }
    
    const baseline = this.baselineMetrics.get(baselineKey)!;
    baseline.push(value);
    
    // Keep only recent measurements for baseline
    if (baseline.length > 100) {
      baseline.splice(0, baseline.length - 100);
    }

    // Record baseline metrics
    expressionMetricsRecorder.recordPerformanceBaseline(
      measurementType as any,
      expressionsEnabled ? 'with_expressions' : 'without_expressions',
      value
    );
  }

  /**
   * Record baseline measurement
   */
  private recordBaseline(measurementType: string, value: number): void {
    const baselineKey = `${measurementType}_baseline`;
    
    if (!this.baselineMetrics.has(baselineKey)) {
      this.baselineMetrics.set(baselineKey, []);
    }
    
    const baseline = this.baselineMetrics.get(baselineKey)!;
    baseline.push(value);
    
    // Keep only recent measurements
    if (baseline.length > 50) {
      baseline.splice(0, baseline.length - 50);
    }
  }

  /**
   * Get priority level from context
   */
  private getPriorityLevel(priority?: number): 'low' | 'medium' | 'high' | 'admin' {
    if (priority === undefined) return 'medium';
    if (priority >= 50) return 'admin';
    if (priority >= 20) return 'high';
    if (priority >= 10) return 'medium';
    return 'low';
  }

  /**
   * Generate performance report
   */
  generateReport(): PerformanceReport {
    const totalMeasurements = this.measurements.length;
    const passedMeasurements = this.measurements.filter(m => m.passed).length;
    const failedMeasurements = totalMeasurements - passedMeasurements;
    const passRate = totalMeasurements > 0 ? passedMeasurements / totalMeasurements : 1;

    // Calculate average values by measurement type
    const averageValues: Record<string, number> = {};
    const measurementsByType = new Map<string, number[]>();

    for (const measurement of this.measurements) {
      if (!measurementsByType.has(measurement.measurementType)) {
        measurementsByType.set(measurement.measurementType, []);
      }
      measurementsByType.get(measurement.measurementType)!.push(measurement.value);
    }

    for (const [type, values] of measurementsByType) {
      averageValues[type] = values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    // Get threshold violations
    const thresholdViolations = this.measurements.filter(m => !m.passed);

    // Generate recommendations
    const recommendations = this.generateRecommendations(thresholdViolations, averageValues);

    return {
      totalMeasurements,
      passedMeasurements,
      failedMeasurements,
      passRate,
      averageValues,
      thresholdViolations,
      recommendations
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    violations: PerformanceMeasurement[],
    averages: Record<string, number>
  ): string[] {
    const recommendations: string[] = [];

    // Check expression duration violations
    const durationViolations = violations.filter(v => v.measurementType === 'expression_duration');
    if (durationViolations.length > 0) {
      recommendations.push(
        `${durationViolations.length} expressions exceeded 300ms duration limit. ` +
        'Consider trimming audio files or rejecting long expressions during upload.'
      );
    }

    // Check first audio delays
    const firstAudioViolations = violations.filter(v => v.measurementType === 'first_audio');
    if (firstAudioViolations.length > 0) {
      recommendations.push(
        `${firstAudioViolations.length} instances of delayed first audio. ` +
        'Consider improving preload strategy or reducing expression processing overhead.'
      );
    }

    // Check TTS performance impact
    const ttsViolations = violations.filter(v => v.measurementType === 'tts_total');
    if (ttsViolations.length > 0) {
      recommendations.push(
        `${ttsViolations.length} instances of TTS performance degradation. ` +
        'Consider optimizing expression scheduling or reducing overlay complexity.'
      );
    }

    // Check preload performance
    const preloadViolations = violations.filter(v => v.measurementType === 'preload');
    if (preloadViolations.length > 0) {
      recommendations.push(
        `${preloadViolations.length} slow preload operations. ` +
        'Consider implementing progressive loading or reducing concurrent preloads.'
      );
    }

    // Check mixing performance
    const mixingViolations = violations.filter(v => v.measurementType === 'mixing');
    if (mixingViolations.length > 0) {
      recommendations.push(
        `${mixingViolations.length} slow audio mixing operations. ` +
        'Consider optimizing Web Audio API usage or reducing concurrent expressions.'
      );
    }

    // General performance recommendations
    if (averages.expression_duration > 200) {
      recommendations.push(
        'Average expression duration is high (>200ms). ' +
        'Consider encouraging shorter expressions or implementing automatic trimming.'
      );
    }

    if (violations.length === 0) {
      recommendations.push('Performance is within acceptable thresholds. No action required.');
    }

    return recommendations;
  }

  /**
   * Get current performance statistics
   */
  getStats(): {
    isMonitoring: boolean;
    measurementCount: number;
    passRate: number;
    recentViolations: number;
    thresholds: PerformanceThresholds;
  } {
    const recentViolations = this.measurements
      .filter(m => !m.passed && m.timestamp > Date.now() - 5 * 60 * 1000) // Last 5 minutes
      .length;

    const passRate = this.measurements.length > 0 
      ? this.measurements.filter(m => m.passed).length / this.measurements.length 
      : 1;

    return {
      isMonitoring: this.isMonitoring,
      measurementCount: this.measurements.length,
      passRate,
      recentViolations,
      thresholds: this.thresholds
    };
  }

  /**
   * Clear old measurements to prevent memory leaks
   */
  cleanup(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.measurements = this.measurements.filter(m => m.timestamp > oneHourAgo);

    // Clean up baseline metrics
    for (const [key, values] of this.baselineMetrics) {
      if (values.length > 100) {
        this.baselineMetrics.set(key, values.slice(-50));
      }
    }
  }
}

/**
 * Global performance monitor instance
 */
export const expressionPerformanceMonitor = new ExpressionPerformanceMonitor();

/**
 * Utility function to wrap operations with performance monitoring
 */
export async function withPerformanceMonitoring<T>(
  operation: () => Promise<T>,
  measurementType: 'preload' | 'mixing',
  context: Record<string, any>
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await operation();
    const duration = performance.now() - startTime;
    
    if (measurementType === 'preload') {
      expressionPerformanceMonitor.measurePreload(
        duration,
        context.ownerType,
        context.expressionCount,
        context.cacheStatus,
        context
      );
    } else if (measurementType === 'mixing') {
      expressionPerformanceMonitor.measureMixing(
        duration,
        context.operationType,
        context.concurrentExpressions,
        context
      );
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    // Still record the measurement even on error
    if (measurementType === 'preload') {
      expressionPerformanceMonitor.measurePreload(
        duration,
        context.ownerType,
        context.expressionCount,
        'miss', // Assume cache miss on error
        { ...context, error: true }
      );
    } else if (measurementType === 'mixing') {
      expressionPerformanceMonitor.measureMixing(
        duration,
        context.operationType,
        context.concurrentExpressions,
        { ...context, error: true }
      );
    }
    
    throw error;
  }
}