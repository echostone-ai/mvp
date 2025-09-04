import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { metricsService, SLA_THRESHOLDS } from '../metricsService';
import { metricsRecorder, MetricsHelpers } from '../metricsIntegration';

// Mock OpenTelemetry modules
vi.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
  })),
  metrics: {
    getMeter: vi.fn().mockReturnValue({
      createCounter: vi.fn().mockReturnValue({
        add: vi.fn(),
      }),
      createHistogram: vi.fn().mockReturnValue({
        record: vi.fn(),
      }),
      createObservableGauge: vi.fn().mockReturnValue({
        addCallback: vi.fn(),
      }),
    }),
  },
  trace: {
    getTracer: vi.fn().mockReturnValue({
      startSpan: vi.fn().mockReturnValue({
        setStatus: vi.fn(),
        end: vi.fn(),
      }),
    }),
    SpanStatusCode: {
      OK: 1,
      ERROR: 2,
    },
  },
}));

vi.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: vi.fn().mockReturnValue([]),
}));

vi.mock('@opentelemetry/exporter-metrics-otlp-http', () => ({
  OTLPMetricExporter: vi.fn(),
}));

vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: vi.fn(),
}));

vi.mock('@opentelemetry/sdk-metrics', () => ({
  PeriodicExportingMetricReader: vi.fn(),
}));

vi.mock('@opentelemetry/resources', () => ({
  Resource: vi.fn(),
}));

vi.mock('@opentelemetry/semantic-conventions', () => ({
  SemanticResourceAttributes: {
    SERVICE_NAME: 'service.name',
    SERVICE_VERSION: 'service.version',
    DEPLOYMENT_ENVIRONMENT: 'deployment.environment',
  },
}));

describe('MetricsService', () => {
  beforeEach(async () => {
    // Reset the singleton instance
    (metricsService as any).isInitialized = false;
    (metricsService as any).counters.clear();
    (metricsService as any).histograms.clear();
    (metricsService as any).gauges.clear();
    
    await metricsService.initialize();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      expect(metricsService.isHealthy()).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      const initSpy = vi.spyOn(metricsService as any, 'initialize');
      await metricsService.initialize();
      expect(initSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('counter metrics', () => {
    it('should increment overlay injections', () => {
      const mockCounter = { add: vi.fn() };
      (metricsService as any).counters.set('overlay_injections_total', mockCounter);
      
      metricsService.incrementOverlayInjections({ expression_type: 'laughter' });
      
      expect(mockCounter.add).toHaveBeenCalledWith(1, { expression_type: 'laughter' });
    });

    it('should increment overlay dropped with reason', () => {
      const mockCounter = { add: vi.fn() };
      (metricsService as any).counters.set('overlay_dropped_total', mockCounter);
      
      metricsService.incrementOverlayDropped('rate_limit', { expression_type: 'thinking' });
      
      expect(mockCounter.add).toHaveBeenCalledWith(1, { 
        reason: 'rate_limit', 
        expression_type: 'thinking' 
      });
    });

    it('should increment stream interrupts', () => {
      const mockCounter = { add: vi.fn() };
      (metricsService as any).counters.set('stream_interrupts_total', mockCounter);
      
      metricsService.incrementStreamInterrupts('network_timeout');
      
      expect(mockCounter.add).toHaveBeenCalledWith(1, { cause: 'network_timeout' });
    });

    it('should increment errors with component info', () => {
      const mockCounter = { add: vi.fn() };
      (metricsService as any).counters.set('errors_total', mockCounter);
      
      metricsService.incrementErrors('synthesis_failure', 'tts_service', { voice_id: 'test' });
      
      expect(mockCounter.add).toHaveBeenCalledWith(1, {
        error_type: 'synthesis_failure',
        component: 'tts_service',
        voice_id: 'test'
      });
    });
  });

  describe('histogram metrics', () => {
    it('should record TTS first byte timing', () => {
      const mockHistogram = { record: vi.fn() };
      (metricsService as any).histograms.set('tts_first_byte_duration_ms', mockHistogram);
      
      metricsService.recordTTSFirstByte(750, { voice_id: 'test' });
      
      expect(mockHistogram.record).toHaveBeenCalledWith(750, { voice_id: 'test' });
    });

    it('should record memory fetch timing', () => {
      const mockHistogram = { record: vi.fn() };
      (metricsService as any).histograms.set('memory_fetch_duration_ms', mockHistogram);
      
      metricsService.recordMemoryFetch(120, { query_type: 'semantic' });
      
      expect(mockHistogram.record).toHaveBeenCalledWith(120, { query_type: 'semantic' });
    });

    it('should record expression timing', () => {
      const mockHistogram = { record: vi.fn() };
      (metricsService as any).histograms.set('expression_overlay_timing_ms', mockHistogram);
      
      metricsService.recordExpressionTiming(35, { expression_type: 'laughter' });
      
      expect(mockHistogram.record).toHaveBeenCalledWith(35, { expression_type: 'laughter' });
    });

    it('should record conversation duration', () => {
      const mockHistogram = { record: vi.fn() };
      (metricsService as any).histograms.set('conversation_duration_ms', mockHistogram);
      
      metricsService.recordConversationDuration(45000, { user_id: 'test' });
      
      expect(mockHistogram.record).toHaveBeenCalledWith(45000, { user_id: 'test' });
    });
  });

  describe('SLA compliance', () => {
    it('should track SLA violations for TTS latency', () => {
      const mockErrorCounter = { add: vi.fn() };
      (metricsService as any).counters.set('errors_total', mockErrorCounter);
      
      // This should trigger an SLA violation
      metricsService.recordTTSFirstByte(1500);
      
      expect(mockErrorCounter.add).toHaveBeenCalledWith(1, {
        error_type: 'sla_violation',
        component: 'tts_latency',
        threshold: String(SLA_THRESHOLDS.TTS_FIRST_BYTE_MAX_MS)
      });
    });

    it('should track SLA violations for memory fetch', () => {
      const mockErrorCounter = { add: vi.fn() };
      (metricsService as any).counters.set('errors_total', mockErrorCounter);
      
      // This should trigger an SLA violation
      metricsService.recordMemoryFetch(250);
      
      expect(mockErrorCounter.add).toHaveBeenCalledWith(1, {
        error_type: 'sla_violation',
        component: 'memory_fetch',
        threshold: String(SLA_THRESHOLDS.MEMORY_FETCH_MAX_MS)
      });
    });

    it('should track SLA violations for expression timing', () => {
      const mockErrorCounter = { add: vi.fn() };
      (metricsService as any).counters.set('errors_total', mockErrorCounter);
      
      // This should trigger an SLA violation
      metricsService.recordExpressionTiming(75);
      
      expect(mockErrorCounter.add).toHaveBeenCalledWith(1, {
        error_type: 'sla_violation',
        component: 'expression_timing',
        threshold: String(SLA_THRESHOLDS.EXPRESSION_TIMING_MAX_MS)
      });
    });

    it('should not track SLA violations for compliant metrics', () => {
      const mockErrorCounter = { add: vi.fn() };
      (metricsService as any).counters.set('errors_total', mockErrorCounter);
      
      // These should not trigger SLA violations
      metricsService.recordTTSFirstByte(500);
      metricsService.recordMemoryFetch(100);
      metricsService.recordExpressionTiming(25);
      
      expect(mockErrorCounter.add).not.toHaveBeenCalled();
    });
  });

  describe('measureOperation', () => {
    it('should measure successful operations', async () => {
      const mockHistogram = { record: vi.fn() };
      (metricsService as any).histograms.set('tts_first_byte_duration_ms', mockHistogram);
      
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await metricsService.measureOperation('tts_synthesis', operation, { test: 'attr' });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
      expect(mockHistogram.record).toHaveBeenCalled();
    });

    it('should handle operation failures', async () => {
      const mockErrorCounter = { add: vi.fn() };
      (metricsService as any).counters.set('errors_total', mockErrorCounter);
      
      const operation = vi.fn().mockRejectedValue(new Error('Test error'));
      
      await expect(
        metricsService.measureOperation('tts_synthesis', operation, { test: 'attr' })
      ).rejects.toThrow('Test error');
      
      expect(mockErrorCounter.add).toHaveBeenCalledWith(1, {
        error_type: 'operation_failure',
        component: 'tts_synthesis',
        test: 'attr'
      });
    });
  });
});

describe('MetricsRecorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('timing operations', () => {
    it('should track timing for operations', () => {
      const startTime = Date.now();
      vi.spyOn(Date, 'now').mockReturnValueOnce(startTime).mockReturnValueOnce(startTime + 500);
      
      const recordSpy = vi.spyOn(metricsService, 'recordTTSFirstByte');
      
      metricsRecorder.startTiming('test-op');
      metricsRecorder.endTiming('test-op', 'tts', { test: 'attr' });
      
      expect(recordSpy).toHaveBeenCalledWith(500, { test: 'attr' });
    });

    it('should handle missing start times gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      metricsRecorder.endTiming('nonexistent-op', 'tts');
      
      expect(consoleSpy).toHaveBeenCalledWith('No start time found for operation: nonexistent-op');
    });
  });

  describe('event recording', () => {
    it('should record overlay injections', () => {
      const incrementSpy = vi.spyOn(metricsService, 'incrementOverlayInjections');
      
      metricsRecorder.recordOverlayInjection('laughter');
      
      expect(incrementSpy).toHaveBeenCalledWith({ expression_type: 'laughter' });
    });

    it('should record overlay drops', () => {
      const incrementSpy = vi.spyOn(metricsService, 'incrementOverlayDropped');
      
      metricsRecorder.recordOverlayDropped('rate_limit', 'thinking');
      
      expect(incrementSpy).toHaveBeenCalledWith('rate_limit', { expression_type: 'thinking' });
    });

    it('should record stream interrupts', () => {
      const incrementSpy = vi.spyOn(metricsService, 'incrementStreamInterrupts');
      
      metricsRecorder.recordStreamInterrupt('network_timeout');
      
      expect(incrementSpy).toHaveBeenCalledWith('network_timeout');
    });

    it('should record errors', () => {
      const incrementSpy = vi.spyOn(metricsService, 'incrementErrors');
      
      metricsRecorder.recordError('synthesis_failure', 'tts_service', { voice_id: 'test' });
      
      expect(incrementSpy).toHaveBeenCalledWith('synthesis_failure', 'tts_service', { voice_id: 'test' });
    });
  });
});

describe('MetricsHelpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('operation measurement', () => {
    it('should measure TTS operations', async () => {
      const measureSpy = vi.spyOn(metricsService, 'measureOperation');
      const operation = vi.fn().mockResolvedValue('result');
      
      await MetricsHelpers.measureTTSOperation(operation, { test: 'attr' });
      
      expect(measureSpy).toHaveBeenCalledWith('tts_synthesis', operation, { test: 'attr' });
    });

    it('should measure memory operations', async () => {
      const measureSpy = vi.spyOn(metricsService, 'measureOperation');
      const operation = vi.fn().mockResolvedValue('result');
      
      await MetricsHelpers.measureMemoryOperation(operation, { test: 'attr' });
      
      expect(measureSpy).toHaveBeenCalledWith('memory_fetch', operation, { test: 'attr' });
    });

    it('should measure expression operations', async () => {
      const measureSpy = vi.spyOn(metricsService, 'measureOperation');
      const operation = vi.fn().mockResolvedValue('result');
      
      await MetricsHelpers.measureExpressionOperation(operation, { test: 'attr' });
      
      expect(measureSpy).toHaveBeenCalledWith('expression_scheduling', operation, { test: 'attr' });
    });
  });

  describe('batch metrics recording', () => {
    it('should record batch metrics correctly', () => {
      const ttsSpy = vi.spyOn(metricsService, 'recordTTSFirstByte');
      const memorySpy = vi.spyOn(metricsService, 'recordMemoryFetch');
      const expressionSpy = vi.spyOn(metricsService, 'recordExpressionTiming');
      const injectionSpy = vi.spyOn(metricsService, 'incrementOverlayInjections');
      
      MetricsHelpers.recordBatchMetrics({
        tts_first_byte_ms: 750,
        memory_fetch_ms: 120,
        expression_timing_ms: 35,
        overlay_injections_count: 3,
      });
      
      expect(ttsSpy).toHaveBeenCalledWith(750);
      expect(memorySpy).toHaveBeenCalledWith(120);
      expect(expressionSpy).toHaveBeenCalledWith(35);
      expect(injectionSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('dashboard integration', () => {
    it('should send metrics to dashboard API', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
      global.fetch = mockFetch;
      
      await MetricsHelpers.sendMetricsToDashboard({ test: 'data' });
      
      expect(mockFetch).toHaveBeenCalledWith('/api/metrics/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
      });
    });

    it('should handle dashboard API failures gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Should not throw
      await MetricsHelpers.sendMetricsToDashboard({ test: 'data' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to send metrics to dashboard:',
        expect.any(Error)
      );
    });
  });
});

describe('SLA_THRESHOLDS', () => {
  it('should have correct threshold values', () => {
    expect(SLA_THRESHOLDS.TTS_FIRST_BYTE_MAX_MS).toBe(1000);
    expect(SLA_THRESHOLDS.MEMORY_FETCH_MAX_MS).toBe(200);
    expect(SLA_THRESHOLDS.EXPRESSION_TIMING_MAX_MS).toBe(50);
    expect(SLA_THRESHOLDS.AUDIO_QUALITY_MIN_SCORE).toBe(0.8);
    expect(SLA_THRESHOLDS.UPTIME_MIN_PERCENTAGE).toBe(99.5);
  });
});