import { metrics, trace, NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// Metrics interface for type safety
export interface EchoStoneMetrics {
  tts_first_byte_ms: number;
  overlay_injections_count: number;
  overlay_dropped_count: number;
  memory_fetch_ms: number;
  stream_interrupts: number;
  expression_overlay_timing_ms: number;
  conversation_duration_ms: number;
  audio_quality_score: number;
  error_count: number;
  sla_compliance_percentage: number;
}

// SLA thresholds
export const SLA_THRESHOLDS = {
  TTS_FIRST_BYTE_MAX_MS: 1000,
  MEMORY_FETCH_MAX_MS: 200,
  EXPRESSION_TIMING_MAX_MS: 50,
  AUDIO_QUALITY_MIN_SCORE: 0.8,
  UPTIME_MIN_PERCENTAGE: 99.5
} as const;

class MetricsService {
  private static instance: MetricsService;
  private meterProvider: metrics.MeterProvider | null = null;
  private meter: metrics.Meter | null = null;
  private counters: Map<string, metrics.Counter> = new Map();
  private histograms: Map<string, metrics.Histogram> = new Map();
  private gauges: Map<string, metrics.ObservableGauge> = new Map();
  private isInitialized = false;

  private constructor() {}

  static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Skip OpenTelemetry initialization in test environment
      if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
        // Create mock meter for tests
        this.meter = {
          createCounter: () => ({ add: () => {} }),
          createHistogram: () => ({ record: () => {} }),
          createObservableGauge: () => ({ addCallback: () => {} }),
        } as any;
        
        this.isInitialized = true;
        console.log('MetricsService initialized successfully (test mode)');
        return;
      }

      // Initialize OpenTelemetry SDK
      const sdk = new NodeSDK({
        resource: new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: 'echostone-streaming-audio',
          [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
          [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
        }),
        traceExporter: new OTLPTraceExporter({
          url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
        }),
        metricReader: new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({
            url: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || 'http://localhost:4318/v1/metrics',
          }),
          exportIntervalMillis: 5000, // Export every 5 seconds
        }),
        instrumentations: [getNodeAutoInstrumentations()],
      });

      sdk.start();

      // Get meter for custom metrics
      this.meter = metrics.getMeter('echostone-streaming-audio', '1.0.0');

      // Initialize counters
      this.counters.set('overlay_injections_total', this.meter.createCounter('overlay_injections_total', {
        description: 'Total number of expression overlays injected',
      }));

      this.counters.set('overlay_dropped_total', this.meter.createCounter('overlay_dropped_total', {
        description: 'Total number of expression overlays dropped due to constraints',
      }));

      this.counters.set('stream_interrupts_total', this.meter.createCounter('stream_interrupts_total', {
        description: 'Total number of audio stream interruptions',
      }));

      this.counters.set('errors_total', this.meter.createCounter('errors_total', {
        description: 'Total number of errors by type',
      }));

      // Initialize histograms for timing metrics
      this.histograms.set('tts_first_byte_duration_ms', this.meter.createHistogram('tts_first_byte_duration_ms', {
        description: 'Time to first byte for TTS responses',
        unit: 'ms',
        boundaries: [100, 250, 500, 750, 1000, 1500, 2000, 3000, 5000],
      }));

      this.histograms.set('memory_fetch_duration_ms', this.meter.createHistogram('memory_fetch_duration_ms', {
        description: 'Memory retrieval duration',
        unit: 'ms',
        boundaries: [10, 25, 50, 100, 150, 200, 300, 500, 1000],
      }));

      this.histograms.set('expression_overlay_timing_ms', this.meter.createHistogram('expression_overlay_timing_ms', {
        description: 'Expression overlay scheduling and execution timing',
        unit: 'ms',
        boundaries: [5, 10, 25, 50, 75, 100, 150, 200],
      }));

      this.histograms.set('conversation_duration_ms', this.meter.createHistogram('conversation_duration_ms', {
        description: 'Total conversation duration',
        unit: 'ms',
        boundaries: [1000, 5000, 10000, 30000, 60000, 120000, 300000],
      }));

      // Initialize gauges for real-time metrics
      this.gauges.set('audio_quality_score', this.meter.createObservableGauge('audio_quality_score', {
        description: 'Current audio quality score (0-1)',
      }));

      this.gauges.set('sla_compliance_percentage', this.meter.createObservableGauge('sla_compliance_percentage', {
        description: 'Current SLA compliance percentage',
      }));

      this.isInitialized = true;
      console.log('MetricsService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MetricsService:', error);
      throw error;
    }
  }

  // Counter methods
  incrementOverlayInjections(attributes?: Record<string, string>): void {
    this.counters.get('overlay_injections_total')?.add(1, attributes);
  }

  incrementOverlayDropped(reason: string, attributes?: Record<string, string>): void {
    this.counters.get('overlay_dropped_total')?.add(1, { reason, ...attributes });
  }

  incrementStreamInterrupts(cause: string, attributes?: Record<string, string>): void {
    this.counters.get('stream_interrupts_total')?.add(1, { cause, ...attributes });
  }

  incrementErrors(errorType: string, component: string, attributes?: Record<string, string>): void {
    this.counters.get('errors_total')?.add(1, { error_type: errorType, component, ...attributes });
  }

  // Histogram methods
  recordTTSFirstByte(durationMs: number, attributes?: Record<string, string>): void {
    this.histograms.get('tts_first_byte_duration_ms')?.record(durationMs, attributes);
    
    // Check SLA compliance
    if (durationMs > SLA_THRESHOLDS.TTS_FIRST_BYTE_MAX_MS) {
      this.incrementErrors('sla_violation', 'tts_latency', { threshold: String(SLA_THRESHOLDS.TTS_FIRST_BYTE_MAX_MS) });
    }
  }

  recordMemoryFetch(durationMs: number, attributes?: Record<string, string>): void {
    this.histograms.get('memory_fetch_duration_ms')?.record(durationMs, attributes);
    
    // Check SLA compliance
    if (durationMs > SLA_THRESHOLDS.MEMORY_FETCH_MAX_MS) {
      this.incrementErrors('sla_violation', 'memory_fetch', { threshold: String(SLA_THRESHOLDS.MEMORY_FETCH_MAX_MS) });
    }
  }

  recordExpressionTiming(durationMs: number, attributes?: Record<string, string>): void {
    this.histograms.get('expression_overlay_timing_ms')?.record(durationMs, attributes);
    
    // Check SLA compliance
    if (durationMs > SLA_THRESHOLDS.EXPRESSION_TIMING_MAX_MS) {
      this.incrementErrors('sla_violation', 'expression_timing', { threshold: String(SLA_THRESHOLDS.EXPRESSION_TIMING_MAX_MS) });
    }
  }

  recordConversationDuration(durationMs: number, attributes?: Record<string, string>): void {
    this.histograms.get('conversation_duration_ms')?.record(durationMs, attributes);
  }

  // Gauge methods (these would typically be updated by background processes)
  updateAudioQualityScore(score: number): void {
    // This would be called by a background process that monitors audio quality
    if (score < SLA_THRESHOLDS.AUDIO_QUALITY_MIN_SCORE) {
      this.incrementErrors('sla_violation', 'audio_quality', { threshold: String(SLA_THRESHOLDS.AUDIO_QUALITY_MIN_SCORE) });
    }
  }

  // Utility methods for creating spans and measuring operations
  async measureOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    attributes?: Record<string, string>
  ): Promise<T> {
    // Skip tracing in test environment
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      const startTime = Date.now();
      try {
        const result = await operation();
        const duration = Date.now() - startTime;
        
        // Record timing based on operation type
        if (operationName.includes('tts') || operationName.includes('voice')) {
          this.recordTTSFirstByte(duration, attributes);
        } else if (operationName.includes('memory')) {
          this.recordMemoryFetch(duration, attributes);
        } else if (operationName.includes('expression')) {
          this.recordExpressionTiming(duration, attributes);
        }
        
        return result;
      } catch (error) {
        this.incrementErrors('operation_failure', operationName, attributes);
        throw error;
      }
    }

    const tracer = trace.getTracer('echostone-streaming-audio');
    const span = tracer.startSpan(operationName, { attributes });
    const startTime = Date.now();

    try {
      const result = await operation();
      span.setStatus({ code: trace.SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ 
        code: trace.SpanStatusCode.ERROR, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
      this.incrementErrors('operation_failure', operationName, attributes);
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      span.end();
      
      // Record timing based on operation type
      if (operationName.includes('tts') || operationName.includes('voice')) {
        this.recordTTSFirstByte(duration, attributes);
      } else if (operationName.includes('memory')) {
        this.recordMemoryFetch(duration, attributes);
      } else if (operationName.includes('expression')) {
        this.recordExpressionTiming(duration, attributes);
      }
    }
  }

  // Health check method
  isHealthy(): boolean {
    return this.isInitialized;
  }

  // Shutdown method
  async shutdown(): Promise<void> {
    if (this.meterProvider) {
      await this.meterProvider.shutdown();
    }
  }
}

export const metricsService = MetricsService.getInstance();