/**
 * Expression Performance Monitor Tests
 * 
 * Tests for performance monitoring and duration limit enforcement
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  ExpressionPerformanceMonitor,
  withPerformanceMonitoring
} from '../expressionPerformanceMonitor';

// Mock dependencies
vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../expressionMetrics', () => ({
  expressionMetrics: {
    errorCount: { inc: vi.fn() }
  },
  expressionMetricsRecorder: {
    recordExpressionDuration: vi.fn(),
    recordFirstAudio: vi.fn(),
    recordTTSTotal: vi.fn(),
    recordPreloadComplete: vi.fn(),
    recordMixingComplete: vi.fn(),
    recordPerformanceBaseline: vi.fn()
  }
}));

vi.mock('../expressionErrorHandler', () => ({
  ExpressionErrorHandler: vi.fn().mockImplementation(() => ({
    createError: vi.fn(),
    handleExpressionFailure: vi.fn()
  })),
  ExpressionErrorType: {
    NETWORK_ERROR: 'NETWORK_ERROR',
    BUFFER_NOT_READY: 'BUFFER_NOT_READY',
    AUDIO_CONTEXT_ERROR: 'AUDIO_CONTEXT_ERROR',
    DECODE_ERROR: 'DECODE_ERROR',
    PLAYBACK_ERROR: 'PLAYBACK_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    FEATURE_DISABLED: 'FEATURE_DISABLED',
    PRIVACY_BLOCKED: 'PRIVACY_BLOCKED',
    DURATION_EXCEEDED: 'DURATION_EXCEEDED',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
  },
  ExpressionErrorStage: {
    INITIALIZATION: 'INITIALIZATION',
    LOADING: 'LOADING',
    PRELOADING: 'PRELOADING',
    SCHEDULING: 'SCHEDULING',
    PLAYBACK: 'PLAYBACK',
    MIXING: 'MIXING',
    CLEANUP: 'CLEANUP'
  }
}));

describe('ExpressionPerformanceMonitor', () => {
  let monitor: ExpressionPerformanceMonitor;

  beforeEach(() => {
    monitor = new ExpressionPerformanceMonitor();
    monitor.startMonitoring();
  });

  afterEach(() => {
    monitor.stopMonitoring();
    vi.clearAllMocks();
  });

  describe('measureExpressionDuration', () => {
    it('should pass when duration is within limit', () => {
      const result = monitor.measureExpressionDuration(
        'test-expression',
        250, // 250ms - within 300ms limit
        'laugh',
        'user'
      );

      expect(result).toBe(true);
    });

    it('should fail when duration exceeds limit', () => {
      const result = monitor.measureExpressionDuration(
        'test-expression',
        350, // 350ms - exceeds 300ms limit
        'laugh',
        'user'
      );

      expect(result).toBe(false);
    });

    it('should record metrics for expression duration', () => {
      monitor.measureExpressionDuration(
        'test-expression',
        200,
        'laugh',
        'user',
        { priority: 10 }
      );

      const { expressionMetricsRecorder } = await import('../expressionMetrics');
      expect(expressionMetricsRecorder.recordExpressionDuration).toHaveBeenCalledWith(
        200,
        'laugh',
        'user',
        'medium'
      );
    });
  });

  describe('measureFirstAudio', () => {
    it('should pass when first audio is within threshold', () => {
      const result = monitor.measureFirstAudio(
        150, // 150ms - within 200ms threshold
        'user',
        true,
        'ready'
      );

      expect(result).toBe(true);
    });

    it('should fail when first audio exceeds threshold', () => {
      const result = monitor.measureFirstAudio(
        250, // 250ms - exceeds 200ms threshold
        'user',
        true,
        'loading'
      );

      expect(result).toBe(false);
    });

    it('should record first audio metrics', () => {
      monitor.measureFirstAudio(100, 'user', true, 'ready');

      const { expressionMetricsRecorder } = await import('../expressionMetrics');
      expect(expressionMetricsRecorder.recordFirstAudio).toHaveBeenCalledWith(
        'user',
        true,
        'ready'
      );
    });
  });

  describe('measureTTSTotal', () => {
    it('should pass when TTS increase is within threshold', () => {
      const result = monitor.measureTTSTotal(
        1030, // 30ms increase over 1000ms baseline
        1000, // baseline
        'user',
        2,
        true
      );

      expect(result).toBe(true);
    });

    it('should fail when TTS increase exceeds threshold', () => {
      const result = monitor.measureTTSTotal(
        1080, // 80ms increase over 1000ms baseline - exceeds 50ms threshold
        1000, // baseline
        'user',
        3,
        true
      );

      expect(result).toBe(false);
    });

    it('should always pass when expressions are disabled', () => {
      const result = monitor.measureTTSTotal(
        1200, // Large increase
        1000, // baseline
        'user',
        0,
        false // expressions disabled
      );

      expect(result).toBe(true);
    });

    it('should record TTS total metrics', () => {
      monitor.measureTTSTotal(1020, 1000, 'user', 2, true);

      const { expressionMetricsRecorder } = await import('../expressionMetrics');
      expect(expressionMetricsRecorder.recordTTSTotal).toHaveBeenCalledWith(
        'user',
        2,
        true
      );
    });
  });

  describe('measurePreload', () => {
    it('should pass when preload is within threshold', () => {
      const result = monitor.measurePreload(
        1500, // 1.5 seconds - within 2 second threshold
        'user',
        5,
        'hit'
      );

      expect(result).toBe(true);
    });

    it('should fail when preload exceeds threshold', () => {
      const result = monitor.measurePreload(
        2500, // 2.5 seconds - exceeds 2 second threshold
        'user',
        10,
        'miss'
      );

      expect(result).toBe(false);
    });

    it('should record preload metrics', () => {
      monitor.measurePreload(800, 'user', 3, 'partial');

      const { expressionMetricsRecorder } = await import('../expressionMetrics');
      expect(expressionMetricsRecorder.recordPreloadComplete).toHaveBeenCalledWith(
        'user',
        3,
        'partial'
      );
    });
  });

  describe('measureMixing', () => {
    it('should pass when mixing is within threshold', () => {
      const result = monitor.measureMixing(
        5, // 5ms - within 10ms threshold
        'play',
        2
      );

      expect(result).toBe(true);
    });

    it('should fail when mixing exceeds threshold', () => {
      const result = monitor.measureMixing(
        15, // 15ms - exceeds 10ms threshold
        'schedule',
        3
      );

      expect(result).toBe(false);
    });

    it('should record mixing metrics', () => {
      monitor.measureMixing(3, 'duck', 1);

      const { expressionMetricsRecorder } = await import('../expressionMetrics');
      expect(expressionMetricsRecorder.recordMixingComplete).toHaveBeenCalledWith(
        'duck',
        1
      );
    });
  });

  describe('generateReport', () => {
    it('should generate comprehensive performance report', () => {
      // Add some measurements
      monitor.measureExpressionDuration('expr1', 200, 'laugh', 'user');
      monitor.measureExpressionDuration('expr2', 350, 'sigh', 'user'); // This will fail
      monitor.measureFirstAudio(100, 'user', true, 'ready');
      monitor.measureFirstAudio(250, 'user', true, 'loading'); // This will fail

      const report = monitor.generateReport();

      expect(report.totalMeasurements).toBe(4);
      expect(report.passedMeasurements).toBe(2);
      expect(report.failedMeasurements).toBe(2);
      expect(report.passRate).toBe(0.5);
      expect(report.thresholdViolations).toHaveLength(2);
      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should provide specific recommendations for violations', () => {
      // Add duration violations
      monitor.measureExpressionDuration('expr1', 400, 'laugh', 'user');
      monitor.measureExpressionDuration('expr2', 450, 'sigh', 'user');

      const report = monitor.generateReport();

      expect(report.recommendations).toContain(
        expect.stringContaining('expressions exceeded 300ms duration limit')
      );
    });

    it('should recommend no action when performance is good', () => {
      // Add only passing measurements
      monitor.measureExpressionDuration('expr1', 200, 'laugh', 'user');
      monitor.measureFirstAudio(100, 'user', true, 'ready');

      const report = monitor.generateReport();

      expect(report.recommendations).toContain(
        'Performance is within acceptable thresholds. No action required.'
      );
    });
  });

  describe('getStats', () => {
    it('should return current performance statistics', () => {
      monitor.measureExpressionDuration('expr1', 200, 'laugh', 'user');
      monitor.measureExpressionDuration('expr2', 350, 'sigh', 'user'); // Violation

      const stats = monitor.getStats();

      expect(stats.isMonitoring).toBe(true);
      expect(stats.measurementCount).toBe(2);
      expect(stats.passRate).toBe(0.5);
      expect(stats.recentViolations).toBe(1);
      expect(stats.thresholds).toMatchObject({
        maxExpressionDuration: 300,
        maxFirstAudioDelay: 200,
        maxTTSIncrease: 50,
        maxPreloadTime: 2000,
        maxMixingLatency: 10
      });
    });
  });

  describe('cleanup', () => {
    it('should remove old measurements', () => {
      // Add measurement
      monitor.measureExpressionDuration('expr1', 200, 'laugh', 'user');
      
      let stats = monitor.getStats();
      expect(stats.measurementCount).toBe(1);

      // Mock old timestamp
      const measurements = (monitor as any).measurements;
      measurements[0].timestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago

      monitor.cleanup();

      stats = monitor.getStats();
      expect(stats.measurementCount).toBe(0);
    });
  });

  describe('custom thresholds', () => {
    it('should use custom thresholds when provided', () => {
      const customMonitor = new ExpressionPerformanceMonitor({
        maxExpressionDuration: 500, // Custom 500ms limit
        maxFirstAudioDelay: 300
      });
      customMonitor.startMonitoring();

      const result = customMonitor.measureExpressionDuration(
        'expr1',
        400, // Would fail with default 300ms, but passes with 500ms
        'laugh',
        'user'
      );

      expect(result).toBe(true);
    });
  });
});

describe('withPerformanceMonitoring', () => {
  let monitor: ExpressionPerformanceMonitor;

  beforeEach(() => {
    monitor = new ExpressionPerformanceMonitor();
    monitor.startMonitoring();
  });

  afterEach(() => {
    monitor.stopMonitoring();
    vi.clearAllMocks();
  });

  it('should measure preload operation performance', async () => {
    const operation = vi.fn().mockResolvedValue('success');
    
    const result = await withPerformanceMonitoring(
      operation,
      'preload',
      {
        ownerType: 'user',
        expressionCount: 5,
        cacheStatus: 'hit'
      }
    );

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalled();

    const { expressionMetricsRecorder } = await import('../expressionMetrics');
    expect(expressionMetricsRecorder.recordPreloadComplete).toHaveBeenCalled();
  });

  it('should measure mixing operation performance', async () => {
    const operation = vi.fn().mockResolvedValue('mixed');
    
    const result = await withPerformanceMonitoring(
      operation,
      'mixing',
      {
        operationType: 'play',
        concurrentExpressions: 2
      }
    );

    expect(result).toBe('mixed');
    expect(operation).toHaveBeenCalled();

    const { expressionMetricsRecorder } = await import('../expressionMetrics');
    expect(expressionMetricsRecorder.recordMixingComplete).toHaveBeenCalledWith(
      'play',
      2
    );
  });

  it('should still record metrics on operation failure', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('Operation failed'));
    
    await expect(
      withPerformanceMonitoring(
        operation,
        'preload',
        {
          ownerType: 'user',
          expressionCount: 3,
          cacheStatus: 'miss'
        }
      )
    ).rejects.toThrow('Operation failed');

    const { expressionMetricsRecorder } = await import('../expressionMetrics');
    expect(expressionMetricsRecorder.recordPreloadComplete).toHaveBeenCalled();
  });
});