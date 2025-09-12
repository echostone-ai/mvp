/**
 * Expression Metrics System
 * 
 * Comprehensive metrics tracking for expression overlays including performance,
 * usage, and error monitoring to ensure TTS performance is maintained.
 * 
 * Requirements: 7.1, 7.2, 7.3, 9.1, 9.2, 9.5
 */

// Browser-safe metrics import
let client: any = null;
let registry: any = null;

// Only import prom-client on server side
if (typeof window === 'undefined') {
  try {
    client = require('prom-client');
    const metricsModule = require('./metrics');
    registry = metricsModule.registry;
  } catch (error) {
    console.warn('Metrics system not available:', error);
  }
}

// Create browser-safe metric stubs
const createMetricStub = () => ({
  observe: () => {},
  inc: () => {},
  set: () => {},
  labels: () => ({ observe: () => {}, inc: () => {}, set: () => {} })
});

/**
 * Expression overlay count per conversation turn
 * Tracks how many expressions are being used per turn
 */
export const overlaysCount = client ? new client.Histogram({
  name: 'expression_overlays_count',
  help: 'Number of expression overlays per conversation turn',
  buckets: [0, 1, 2, 3, 4, 5],
  labelNames: ['owner_type', 'avatar_id', 'turn_type']
}) : createMetricStub();

/**
 * First audio timing - critical metric to ensure TTS isn't delayed
 * Measures time from request to first audio output
 */
export const firstAudioMs = client ? new client.Histogram({
  name: 'expression_first_audio_ms',
  help: 'Time to first audio output with expressions enabled (ms)',
  buckets: [50, 100, 150, 200, 250, 300, 400, 500, 750, 1000],
  labelNames: ['owner_type', 'expressions_enabled', 'preload_status']
}) : createMetricStub();

/**
 * Total TTS time including expression integration
 * Measures end-to-end TTS processing time
 */
export const ttsTotalMs = client ? new client.Histogram({
  name: 'expression_tts_total_ms',
  help: 'Total TTS processing time including expression integration (ms)',
  buckets: [100, 250, 500, 750, 1000, 1500, 2000, 3000, 5000],
  labelNames: ['owner_type', 'overlay_count', 'expressions_enabled']
}) : createMetricStub();

/**
 * Expression preload performance
 * Tracks how long it takes to preload expression buffers
 */
export const preloadDuration = client ? new client.Histogram({
  name: 'expression_preload_duration_ms',
  help: 'Time to preload expression audio buffers (ms)',
  buckets: [50, 100, 200, 300, 500, 1000, 2000],
  labelNames: ['owner_type', 'expression_count', 'cache_status']
}) : createMetricStub();

/**
 * Expression duration monitoring
 * Ensures expressions stay within the 300ms limit
 */
export const expressionDuration = client ? new client.Histogram({
  name: 'expression_duration_ms',
  help: 'Duration of individual expression clips (ms)',
  buckets: [50, 100, 150, 200, 250, 300, 400, 500],
  labelNames: ['expression_type', 'owner_type', 'priority_level']
}) : createMetricStub();

/**
 * Expression usage by type
 * Tracks which expression types are most commonly used
 */
export const expressionTypeUsage = client ? new client.Counter({
  name: 'expression_type_usage_total',
  help: 'Count of expression usage by type',
  labelNames: ['expression_type', 'owner_type', 'selection_method']
}) : createMetricStub();

/**
 * Expression error tracking
 * Monitors different types of expression failures
 */
export const errorCount = client ? new client.Counter({
  name: 'expression_errors_total',
  help: 'Count of expression errors by type and stage',
  labelNames: ['error_type', 'error_stage', 'owner_type']
}) : createMetricStub();

/**
 * Expression error rate
 * Tracks error rate over time
 */
export const errorRate = client ? new client.Counter({
  name: 'expression_error_rate_total',
  help: 'Rate of expression errors per owner type',
  labelNames: ['owner_type']
}) : createMetricStub();

/**
 * Network retry success rate
 * Tracks successful retries for network failures
 */
export const networkRetrySuccess = client ? new client.Counter({
  name: 'expression_network_retry_success_total',
  help: 'Successful network retries for expression loading',
  labelNames: ['owner_type', 'retry_count']
}) : createMetricStub();

/**
 * Session-level error tracking
 * Monitors errors per session to detect problematic sessions
 */
export const sessionErrors = client ? new client.Gauge({
  name: 'expression_session_errors',
  help: 'Number of expression errors in current session',
  labelNames: ['session_id']
}) : createMetricStub();

/**
 * Expression system availability
 * Tracks when expressions are disabled due to errors or settings
 */
export const systemAvailability = client ? new client.Gauge({
  name: 'expression_system_availability',
  help: 'Whether expression system is available (1) or disabled (0)',
  labelNames: ['owner_type', 'disable_reason']
}) : createMetricStub();

/**
 * Session disabled counter
 * Tracks when sessions have expressions disabled
 */
export const sessionDisabled = client ? new client.Counter({
  name: 'expression_session_disabled_total',
  help: 'Count of sessions with expressions disabled',
  labelNames: ['owner_type', 'reason']
}) : createMetricStub();

/**
 * Audio mixing performance
 * Tracks Web Audio API mixing performance
 */
export const mixingLatency = client ? new client.Histogram({
  name: 'expression_mixing_latency_ms',
  help: 'Latency for audio mixing operations (ms)',
  buckets: [1, 2, 5, 10, 20, 50, 100],
  labelNames: ['operation_type', 'concurrent_expressions']
}) : createMetricStub();

/**
 * Buffer memory usage
 * Tracks memory usage of preloaded audio buffers
 */
export const bufferMemoryUsage = client ? new client.Gauge({
  name: 'expression_buffer_memory_bytes',
  help: 'Memory usage of preloaded expression buffers (bytes)',
  labelNames: ['owner_type', 'buffer_count']
}) : createMetricStub();

/**
 * Cache hit rate for expressions
 * Tracks CDN/browser cache effectiveness
 */
export const cacheHitRate = client ? new client.Counter({
  name: 'expression_cache_hits_total',
  help: 'Cache hits for expression audio files',
  labelNames: ['cache_type', 'owner_type']
}) : createMetricStub();

/**
 * User engagement with expressions
 * Tracks user adoption and usage patterns
 */
export const userEngagement = client ? new client.Counter({
  name: 'expression_user_engagement_total',
  help: 'User engagement events with expression system',
  labelNames: ['event_type', 'owner_type']
}) : createMetricStub();

/**
 * Performance baseline comparison
 * Compares performance with and without expressions
 */
export const performanceBaseline = client ? new client.Histogram({
  name: 'expression_performance_baseline_ms',
  help: 'Performance comparison baseline (TTS without expressions)',
  buckets: [50, 100, 150, 200, 250, 300, 400, 500],
  labelNames: ['measurement_type', 'baseline_type']
}) : createMetricStub();

// Register all metrics with the global registry (only on server side)
if (registry && typeof registry.registerMetric === 'function') {
  try {
    registry.registerMetric(overlaysCount);
    registry.registerMetric(firstAudioMs);
    registry.registerMetric(ttsTotalMs);
    registry.registerMetric(preloadDuration);
    registry.registerMetric(expressionDuration);
    registry.registerMetric(expressionTypeUsage);
    registry.registerMetric(errorCount);
    registry.registerMetric(errorRate);
    registry.registerMetric(networkRetrySuccess);
    registry.registerMetric(sessionErrors);
    registry.registerMetric(systemAvailability);
    registry.registerMetric(sessionDisabled);
    registry.registerMetric(mixingLatency);
    registry.registerMetric(bufferMemoryUsage);
    registry.registerMetric(cacheHitRate);
    registry.registerMetric(userEngagement);
    registry.registerMetric(performanceBaseline);
  } catch (error) {
    console.warn('Failed to register metrics:', error);
  }
}

/**
 * Utility class for recording expression metrics
 */
export class ExpressionMetricsRecorder {
  private turnStartTime: number = 0;
  private preloadStartTime: number = 0;
  private mixingStartTime: number = 0;

  /**
   * Start timing for a conversation turn
   */
  startTurn(): void {
    this.turnStartTime = performance.now();
  }

  /**
   * Record first audio timing
   */
  recordFirstAudio(
    ownerType: 'user' | 'avatar',
    expressionsEnabled: boolean,
    preloadStatus: 'ready' | 'loading' | 'failed'
  ): void {
    if (this.turnStartTime > 0) {
      const duration = performance.now() - this.turnStartTime;
      firstAudioMs.observe(
        {
          owner_type: ownerType,
          expressions_enabled: expressionsEnabled.toString(),
          preload_status: preloadStatus
        },
        duration
      );
    }
  }

  /**
   * Record total TTS time
   */
  recordTTSTotal(
    ownerType: 'user' | 'avatar',
    overlayCount: number,
    expressionsEnabled: boolean
  ): void {
    if (this.turnStartTime > 0) {
      const duration = performance.now() - this.turnStartTime;
      ttsTotalMs.observe(
        {
          owner_type: ownerType,
          overlay_count: Math.min(overlayCount, 5).toString(), // Cap at 5 for bucketing
          expressions_enabled: expressionsEnabled.toString()
        },
        duration
      );
    }
  }

  /**
   * Start timing for preload operation
   */
  startPreload(expressionCount?: number): void {
    this.preloadStartTime = performance.now();
  }

  /**
   * Record preload completion
   */
  recordPreloadComplete(
    totalExpressions: number,
    loadedBuffers: number,
    totalTimeMs: number,
    ownerType: 'user' | 'avatar' = 'avatar'
  ): void {
    const cacheStatus = loadedBuffers === totalExpressions ? 'hit' : 
                       loadedBuffers === 0 ? 'miss' : 'partial';
    
    preloadDuration.observe(
      {
        owner_type: ownerType,
        expression_count: Math.min(totalExpressions, 20).toString(), // Cap for bucketing
        cache_status: cacheStatus
      },
      totalTimeMs
    );
  }

  /**
   * Start timing for audio mixing operation
   */
  startMixing(): void {
    this.mixingStartTime = performance.now();
  }

  /**
   * Record mixing operation completion
   */
  recordMixingComplete(
    operationType: 'schedule' | 'play' | 'duck' | 'cleanup',
    concurrentExpressions: number
  ): void {
    if (this.mixingStartTime > 0) {
      const duration = performance.now() - this.mixingStartTime;
      mixingLatency.observe(
        {
          operation_type: operationType,
          concurrent_expressions: Math.min(concurrentExpressions, 5).toString()
        },
        duration
      );
    }
  }

  /**
   * Record expression usage
   */
  recordExpressionUsage(
    expressionType: string,
    ownerType: 'user' | 'avatar',
    selectionMethod: 'keyword' | 'random' | 'priority' | 'admin'
  ): void {
    expressionTypeUsage.inc({
      expression_type: expressionType,
      owner_type: ownerType,
      selection_method: selectionMethod
    });
  }

  /**
   * Record expression duration
   */
  recordExpressionDuration(
    durationMs: number,
    expressionType: string,
    ownerType: 'user' | 'avatar',
    priorityLevel: 'low' | 'medium' | 'high' | 'admin'
  ): void {
    expressionDuration.observe(
      {
        expression_type: expressionType,
        owner_type: ownerType,
        priority_level: priorityLevel
      },
      durationMs
    );
  }

  /**
   * Record buffer memory usage
   */
  recordBufferMemoryUsage(
    ownerType: 'user' | 'avatar',
    bufferCount: number,
    totalBytes: number
  ): void {
    bufferMemoryUsage.set(
      {
        owner_type: ownerType,
        buffer_count: bufferCount.toString()
      },
      totalBytes
    );
  }

  /**
   * Record cache hit
   */
  recordCacheHit(
    cacheType: 'browser' | 'cdn' | 'memory',
    ownerType: 'user' | 'avatar'
  ): void {
    cacheHitRate.inc({
      cache_type: cacheType,
      owner_type: ownerType
    });
  }

  /**
   * Record user engagement event
   */
  recordUserEngagement(
    eventType: 'upload' | 'activate' | 'deactivate' | 'delete' | 'preview',
    ownerType: 'user' | 'avatar'
  ): void {
    userEngagement.inc({
      event_type: eventType,
      owner_type: ownerType
    });
  }

  /**
   * Record performance baseline measurement
   */
  recordPerformanceBaseline(
    measurementType: 'first_audio' | 'total_tts' | 'mixing_latency',
    baselineType: 'with_expressions' | 'without_expressions',
    durationMs: number
  ): void {
    performanceBaseline.observe(
      {
        measurement_type: measurementType,
        baseline_type: baselineType
      },
      durationMs
    );
  }

  /**
   * Update system availability status
   */
  updateSystemAvailability(
    ownerType: 'user' | 'avatar',
    isAvailable: boolean,
    disableReason?: 'error' | 'privacy' | 'feature_flag' | 'performance'
  ): void {
    systemAvailability.set(
      {
        owner_type: ownerType,
        disable_reason: disableReason || 'none'
      },
      isAvailable ? 1 : 0
    );
  }

  /**
   * Reset timing for new operation
   */
  reset(): void {
    this.turnStartTime = 0;
    this.preloadStartTime = 0;
    this.mixingStartTime = 0;
  }
}

/**
 * Global metrics recorder instance
 */
export const expressionMetricsRecorder = new ExpressionMetricsRecorder();

/**
 * Consolidated metrics object for easy import
 */
export const expressionMetrics = {
  overlaysCount,
  firstAudioMs,
  ttsTotalMs,
  preloadDuration,
  expressionDuration,
  expressionTypeUsage,
  errorCount,
  errorRate,
  networkRetrySuccess,
  sessionErrors,
  systemAvailability,
  sessionDisabled,
  mixingLatency,
  bufferMemoryUsage,
  cacheHitRate,
  userEngagement,
  performanceBaseline,
  recorder: expressionMetricsRecorder
};