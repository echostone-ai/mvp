// src/lib/metrics.ts
// Browser-safe metrics import
let client: any = null;
let registry: any = null;

// Only import prom-client on server side
if (typeof window === 'undefined') {
  try {
    client = require('prom-client');
    registry = new client.Registry();
    client.collectDefaultMetrics({ register: registry });
  } catch (error) {
    console.warn('Metrics system not available:', error);
  }
} else {
  // Browser-side stub
  registry = {
    registerMetric: () => {},
    getMetricsAsJSON: () => [],
    metrics: () => ''
  };
}

export { registry };

// Create browser-safe metric stubs
const createMetricStub = () => ({
  observe: () => {},
  inc: () => {},
  set: () => {},
  labels: () => ({ observe: () => {}, inc: () => {}, set: () => {} })
});

export const convoLatency = client ? new client.Histogram({
  name: 'conversation_total_latency_ms',
  help: 'End-to-end latency for a conversation turn',
  buckets: [100, 250, 500, 1000, 1500, 2000, 3000, 5000],
  labelNames: ['route', 'model', 'mode'],
}) : createMetricStub();

export const firstTokenLatency = client ? new client.Histogram({
  name: 'first_token_latency_ms',
  help: 'Time to first token (if streaming)',
  buckets: [50, 100, 150, 250, 400, 600, 1000],
  labelNames: ['route', 'model', 'mode'],
}) : createMetricStub();

export const factRecallAccuracy = client ? new client.Gauge({
  name: 'fact_recall_accuracy_ratio',
  help: 'Ratio of referenced facts that matched stored facts in the turn',
  labelNames: ['route', 'model'],
}) : createMetricStub();

export const hallucinationIncidents = client ? new client.Counter({
  name: 'hallucination_incidents_total',
  help: 'Count of detected hallucinations per route/model',
  labelNames: ['route', 'model'],
}) : createMetricStub();

export const dbQueryDuration = client ? new client.Histogram({
  name: 'db_query_duration_ms',
  help: 'DB query duration by type',
  buckets: [5, 10, 20, 40, 80, 160, 320, 640],
  labelNames: ['query', 'cache'],
}) : createMetricStub();

// Deep lane merge metrics
export const deepLaneMerge = client ? new client.Counter({
  name: 'deep_lane_merge_total',
  help: 'Count of deep lane merge attempts',
  labelNames: ['merged', 'tokens_any'],
}) : createMetricStub();

// Preference bypass metrics
export const preferenceBypass = client ? new client.Counter({
  name: 'preference_bypass_total',
  help: 'Count of preference bypass applications',
  labelNames: ['applied', 'query_type'],
}) : createMetricStub();

// Political query metrics
export const politicalQueryHandling = client ? new client.Counter({
  name: 'political_query_handling_total',
  help: 'Count of political query handling',
  labelNames: ['query_type', 'memories_found'],
}) : createMetricStub();

// Create additional metrics for story system
export const storyMetrics = client ? {
  triggerMatchingFailed: new client.Counter({
    name: 'story_trigger_matching_failed_total',
    help: 'Count of story trigger matching failures',
  }),
  fallbackSuccess: new client.Counter({
    name: 'story_fallback_success_total',
    help: 'Count of successful story fallbacks',
  }),
  fallbackDuration: new client.Histogram({
    name: 'story_fallback_duration_ms',
    help: 'Duration of story fallback operations',
    buckets: [10, 50, 100, 250, 500, 1000, 2000],
  }),
  emergencyFallback: new client.Counter({
    name: 'story_emergency_fallback_total',
    help: 'Count of emergency fallbacks',
  }),
  criticalFailure: new client.Counter({
    name: 'story_critical_failure_total',
    help: 'Count of critical story failures',
  }),
  errorsByType: new client.Counter({
    name: 'story_error_by_type_total',
    help: 'Count of story errors by type',
    labelNames: ['type'],
  }),
  errorsByStory: new client.Counter({
    name: 'story_error_by_story_total',
    help: 'Count of story errors by story ID',
    labelNames: ['storyId'],
  }),
} : {
  triggerMatchingFailed: createMetricStub(),
  fallbackSuccess: createMetricStub(),
  fallbackDuration: createMetricStub(),
  emergencyFallback: createMetricStub(),
  criticalFailure: createMetricStub(),
  errorsByType: createMetricStub(),
  errorsByStory: createMetricStub(),
};

// Create a metrics helper object for backward compatibility
export const metrics = {
  increment: (name: string, labels?: Record<string, string>) => {
    switch (name) {
      case 'story_trigger_matching_failed':
        storyMetrics.triggerMatchingFailed.inc();
        break;
      case 'story_fallback_success':
        storyMetrics.fallbackSuccess.inc();
        break;
      case 'story_emergency_fallback':
        storyMetrics.emergencyFallback.inc();
        break;
      case 'story_critical_failure':
        storyMetrics.criticalFailure.inc();
        break;
      case 'story_error_by_story':
        if (labels?.storyId) {
          storyMetrics.errorsByStory.labels(labels.storyId).inc();
        }
        break;
      default:
        if (name.startsWith('story_error_')) {
          const type = name.replace('story_error_', '');
          storyMetrics.errorsByType.labels(type).inc();
        }
        break;
    }
  },
  timing: (name: string, value: number) => {
    switch (name) {
      case 'story_fallback_duration_ms':
        storyMetrics.fallbackDuration.observe(value);
        break;
    }
  }
};

// Register metrics only on server side
if (registry && typeof registry.registerMetric === 'function') {
  try {
    registry.registerMetric(convoLatency);
    registry.registerMetric(firstTokenLatency);
    registry.registerMetric(factRecallAccuracy);
    registry.registerMetric(hallucinationIncidents);
    registry.registerMetric(dbQueryDuration);
    
    // Register story metrics
    if (client) {
      registry.registerMetric(storyMetrics.triggerMatchingFailed);
      registry.registerMetric(storyMetrics.fallbackSuccess);
      registry.registerMetric(storyMetrics.fallbackDuration);
      registry.registerMetric(storyMetrics.emergencyFallback);
      registry.registerMetric(storyMetrics.criticalFailure);
      registry.registerMetric(storyMetrics.errorsByType);
      registry.registerMetric(storyMetrics.errorsByStory);
    }
    
    // Register new metrics
    registry.registerMetric(deepLaneMerge);
    registry.registerMetric(preferenceBypass);
    registry.registerMetric(politicalQueryHandling);
  } catch (error) {
    console.warn('Failed to register core metrics:', error);
  }
}


