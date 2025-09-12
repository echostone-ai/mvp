// src/lib/services/storyMetrics.ts
// Performance monitoring for authentic voice stories system

// Browser-safe metrics import
let client: any = null;
let registry: any = null;

// Only import prom-client on server side
if (typeof window === 'undefined') {
  try {
    client = require('prom-client');
    const { registry: existingRegistry } = require('../metrics');
    registry = existingRegistry;
  } catch (error) {
    console.warn('Story metrics system not available:', error);
  }
} else {
  // Browser-side stub
  registry = {
    registerMetric: () => {},
    getMetricsAsJSON: () => [],
    metrics: () => ''
  };
}

// Create browser-safe metric stubs
const createMetricStub = () => ({
  observe: () => {},
  inc: () => {},
  set: () => {},
  labels: () => ({ observe: () => {}, inc: () => {}, set: () => {} })
});

// Core latency metrics
export const storyMatchLatency = client ? new client.Histogram({
  name: 'story_match_latency_ms',
  help: 'Time taken to match conversation triggers to stories',
  buckets: [10, 25, 50, 75, 100, 150, 200, 300],
  labelNames: ['avatar_id', 'match_found'],
}) : createMetricStub();

export const storyStartLatency = client ? new client.Histogram({
  name: 'story_start_latency_ms',
  help: 'Time from story selection to first audio frame',
  buckets: [100, 250, 500, 750, 1000, 1500, 2000, 3000],
  labelNames: ['avatar_id', 'preloaded'],
}) : createMetricStub();

export const ttsTimeToFirstChunk = client ? new client.Histogram({
  name: 'tts_time_to_first_chunk_ms',
  help: 'Time to first TTS audio chunk when no story is selected',
  buckets: [50, 100, 200, 300, 400, 500, 600, 800, 1000],
  labelNames: ['avatar_id', 'story_system_enabled'],
}) : createMetricStub();

// Story selection and playback counters
export const storySelected = client ? new client.Counter({
  name: 'story_selected_total',
  help: 'Number of times a story was selected for playback',
  labelNames: ['avatar_id', 'story_category', 'trigger_type'],
}) : createMetricStub();

export const storySkippedNoMatch = client ? new client.Counter({
  name: 'story_skipped_no_match_total',
  help: 'Number of times no story matched conversation triggers',
  labelNames: ['avatar_id', 'trigger_count'],
}) : createMetricStub();

export const storyPlaySuccess = client ? new client.Counter({
  name: 'story_play_success_total',
  help: 'Number of successful story playbacks',
  labelNames: ['avatar_id', 'story_category', 'duration_bucket'],
}) : createMetricStub();

export const storyPlayFailed = client ? new client.Counter({
  name: 'story_play_failed_total',
  help: 'Number of failed story playbacks',
  labelNames: ['avatar_id', 'error_type', 'fallback_used'],
}) : createMetricStub();

export const storyFallbackTts = client ? new client.Counter({
  name: 'story_fallback_tts_total',
  help: 'Number of times system fell back to TTS from story',
  labelNames: ['avatar_id', 'reason', 'latency_bucket'],
}) : createMetricStub();

// 2-second timeout compliance monitoring
export const storyTimeoutCompliance = client ? new client.Histogram({
  name: 'story_timeout_compliance_ms',
  help: 'Story loading times with 2-second SLA tracking',
  buckets: [500, 1000, 1500, 2000, 2500, 3000, 4000, 5000],
  labelNames: ['avatar_id', 'within_sla'],
}) : createMetricStub();

export const storyTimeoutViolations = client ? new client.Counter({
  name: 'story_timeout_violations_total',
  help: 'Number of times story loading exceeded 2-second SLA',
  labelNames: ['avatar_id', 'timeout_duration_bucket'],
}) : createMetricStub();

// Performance health metrics
export const storySystemOverhead = client ? new client.Histogram({
  name: 'story_system_overhead_ms',
  help: 'CPU overhead added by story system during normal chat',
  buckets: [1, 5, 10, 20, 50, 100, 200],
  labelNames: ['operation_type'],
}) : createMetricStub();

export const storyCacheHitRate = client ? new client.Gauge({
  name: 'story_cache_hit_rate',
  help: 'Cache hit rate for story audio buffers',
  labelNames: ['avatar_id'],
}) : createMetricStub();

// Task 13: Queue-related metrics
export const storyQueued = client ? new client.Counter({
  name: 'story_queued_total',
  help: 'Number of stories queued for later playback',
  labelNames: ['avatar_id', 'story_category'],
}) : createMetricStub();

export const storyReplaced = client ? new client.Counter({
  name: 'story_replaced_total',
  help: 'Number of queued stories replaced by newer triggers',
  labelNames: ['avatar_id', 'story_category'],
}) : createMetricStub();

export const storyExpired = client ? new client.Counter({
  name: 'story_expired_total',
  help: 'Number of queued stories that expired before playback',
  labelNames: ['avatar_id', 'story_category'],
}) : createMetricStub();

export const storyQueueAge = client ? new client.Histogram({
  name: 'story_queue_age_ms',
  help: 'Time stories spend in queue before playback',
  buckets: [100, 500, 1000, 2000, 5000, 10000, 15000],
  labelNames: ['avatar_id', 'story_category'],
}) : createMetricStub();

// Register metrics only on server side
if (registry && typeof registry.registerMetric === 'function') {
  try {
    registry.registerMetric(storyMatchLatency);
    registry.registerMetric(storyStartLatency);
    registry.registerMetric(ttsTimeToFirstChunk);
    registry.registerMetric(storySelected);
    registry.registerMetric(storySkippedNoMatch);
    registry.registerMetric(storyPlaySuccess);
    registry.registerMetric(storyPlayFailed);
    registry.registerMetric(storyFallbackTts);
    registry.registerMetric(storyTimeoutCompliance);
    registry.registerMetric(storyTimeoutViolations);
    registry.registerMetric(storySystemOverhead);
    registry.registerMetric(storyCacheHitRate);
    // Task 13: Register queue metrics
    registry.registerMetric(storyQueued);
    registry.registerMetric(storyReplaced);
    registry.registerMetric(storyExpired);
    registry.registerMetric(storyQueueAge);
  } catch (error) {
    console.warn('Failed to register story metrics:', error);
  }
}

// Utility functions for common metric patterns
export class StoryMetricsCollector {
  private static instance: StoryMetricsCollector;
  
  static getInstance(): StoryMetricsCollector {
    if (!StoryMetricsCollector.instance) {
      StoryMetricsCollector.instance = new StoryMetricsCollector();
    }
    return StoryMetricsCollector.instance;
  }

  // Track story matching performance
  trackStoryMatching(avatarId: string, startTime: number, matchFound: boolean): void {
    const latency = Date.now() - startTime;
    storyMatchLatency.labels(avatarId, matchFound.toString()).observe(latency);
    
    if (!matchFound) {
      storySkippedNoMatch.labels(avatarId, 'unknown').inc();
    }
  }

  // Track story playback start
  trackStoryStart(avatarId: string, startTime: number, preloaded: boolean): void {
    const latency = Date.now() - startTime;
    storyStartLatency.labels(avatarId, preloaded.toString()).observe(latency);
    
    // Check 2-second SLA compliance
    const withinSla = latency <= 2000;
    storyTimeoutCompliance.labels(avatarId, withinSla.toString()).observe(latency);
    
    if (!withinSla) {
      const timeoutBucket = latency <= 3000 ? '2-3s' : latency <= 4000 ? '3-4s' : '4s+';
      storyTimeoutViolations.labels(avatarId, timeoutBucket).inc();
    }
  }

  // Track TTS performance when stories are enabled
  trackTtsFirstChunk(avatarId: string, startTime: number, storySystemEnabled: boolean): void {
    const latency = Date.now() - startTime;
    ttsTimeToFirstChunk.labels(avatarId, storySystemEnabled.toString()).observe(latency);
  }

  // Track story selection
  trackStorySelection(avatarId: string, category: string, triggerType: string): void {
    storySelected.labels(avatarId, category, triggerType).inc();
  }

  // Track successful story playback
  trackStoryPlaySuccess(avatarId: string, category: string, durationMs: number): void {
    const durationBucket = durationMs <= 60000 ? '0-1min' : 
                          durationMs <= 180000 ? '1-3min' : '3min+';
    storyPlaySuccess.labels(avatarId, category, durationBucket).inc();
  }

  // Track story playback failure
  trackStoryPlayFailure(avatarId: string, errorType: string, fallbackUsed: boolean): void {
    storyPlayFailed.labels(avatarId, errorType, fallbackUsed.toString()).inc();
  }

  // Track fallback to TTS
  trackFallbackToTts(avatarId: string, reason: string, latency: number): void {
    const latencyBucket = latency <= 1000 ? '0-1s' : 
                         latency <= 2000 ? '1-2s' : '2s+';
    storyFallbackTts.labels(avatarId, reason, latencyBucket).inc();
  }

  // Track system overhead
  trackSystemOverhead(operationType: string, startTime: number): void {
    const overhead = Date.now() - startTime;
    storySystemOverhead.labels(operationType).observe(overhead);
  }

  // Update cache hit rate
  updateCacheHitRate(avatarId: string, hitRate: number): void {
    storyCacheHitRate.labels(avatarId).set(hitRate);
  }

  // Task 13: Track story queuing
  trackStoryQueued(avatarId: string, category: string): void {
    storyQueued.labels(avatarId, category).inc();
  }

  // Task 13: Track story replacement in queue
  trackStoryReplaced(avatarId: string, category: string): void {
    storyReplaced.labels(avatarId, category).inc();
  }

  // Task 13: Track story expiration from queue
  trackStoryExpired(avatarId: string, category: string): void {
    storyExpired.labels(avatarId, category).inc();
  }

  // Task 13: Track queue processing time
  trackQueueProcessing(avatarId: string, category: string, queueAge: number): void {
    storyQueueAge.labels(avatarId, category).observe(queueAge);
  }

  // Get performance summary for debugging
  getPerformanceSummary(): any {
    if (typeof window !== 'undefined') {
      return { message: 'Metrics only available on server side' };
    }
    
    try {
      return registry?.getMetricsAsJSON?.() || [];
    } catch (error) {
      console.warn('Failed to get metrics summary:', error);
      return [];
    }
  }
}

export default StoryMetricsCollector;