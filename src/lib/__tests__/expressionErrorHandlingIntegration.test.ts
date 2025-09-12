/**
 * Expression Error Handling Integration Tests
 * 
 * Integration tests for the complete error handling and monitoring system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  expressionErrorHandler,
  ExpressionErrorType,
  ExpressionErrorStage,
  PlaybackContext
} from '../expressionErrorHandler';
import { expressionPerformanceMonitor } from '../expressionPerformanceMonitor';
import { expressionNetworkManager } from '../expressionNetworkManager';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Expression Error Handling Integration', () => {
  let mockContext: PlaybackContext;

  beforeEach(() => {
    mockContext = {
      sessionId: 'integration-test-session',
      ownerId: 'test-user',
      ownerType: 'user',
      turnId: 'test-turn',
      skipExpressions: false,
      disabledExpressions: new Set(),
      temporaryDisableUntil: 0,
      isExpressionsEnabled: true,
      removeExpression: vi.fn(),
      disableExpressions: vi.fn(),
      temporaryDisable: vi.fn()
    };

    // Start monitoring
    expressionPerformanceMonitor.startMonitoring();
  });

  afterEach(() => {
    vi.clearAllMocks();
    expressionPerformanceMonitor.stopMonitoring();
    expressionNetworkManager.cleanup();
  });

  describe('Network Error Handling', () => {
    it('should handle network failures gracefully', async () => {
      // Mock network failure
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await expressionNetworkManager.loadExpressionAudio(
        'https://example.com/test.mp3',
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.retryCount).toBeGreaterThan(0);
    });

    it('should retry with exponential backoff', async () => {
      const mockArrayBuffer = new ArrayBuffer(1024);
      const mockResponse = {
        ok: true,
        status: 200,
        arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
        clone: vi.fn().mockReturnThis(),
        headers: new Headers()
      };

      // Fail first attempt, succeed on second
      mockFetch
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockResolvedValueOnce(mockResponse);

      const result = await expressionNetworkManager.loadExpressionAudio(
        'https://example.com/test.mp3',
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance Monitoring', () => {
    it('should enforce expression duration limits', () => {
      // Test within limit
      const validResult = expressionPerformanceMonitor.measureExpressionDuration(
        'valid-expression',
        250, // 250ms - within 300ms limit
        'laugh',
        'user'
      );
      expect(validResult).toBe(true);

      // Test exceeding limit
      const invalidResult = expressionPerformanceMonitor.measureExpressionDuration(
        'invalid-expression',
        400, // 400ms - exceeds 300ms limit
        'laugh',
        'user'
      );
      expect(invalidResult).toBe(false);
    });

    it('should track performance metrics', () => {
      // Add some measurements
      expressionPerformanceMonitor.measureExpressionDuration('expr1', 200, 'laugh', 'user');
      expressionPerformanceMonitor.measureFirstAudio(150, 'user', true, 'ready');
      expressionPerformanceMonitor.measureTTSTotal(1020, 1000, 'user', 2, true);

      const stats = expressionPerformanceMonitor.getStats();
      expect(stats.measurementCount).toBe(3);
      expect(stats.passRate).toBe(1); // All should pass
    });

    it('should generate performance reports', () => {
      // Add some violations
      expressionPerformanceMonitor.measureExpressionDuration('long-expr', 400, 'laugh', 'user');
      expressionPerformanceMonitor.measureFirstAudio(300, 'user', true, 'loading');

      const report = expressionPerformanceMonitor.generateReport();
      expect(report.totalMeasurements).toBe(2);
      expect(report.failedMeasurements).toBe(2);
      expect(report.thresholdViolations).toHaveLength(2);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from temporary errors', async () => {
      // Create a temporary error
      const error = expressionErrorHandler.createError(
        ExpressionErrorType.NETWORK_ERROR,
        ExpressionErrorStage.LOADING,
        'Temporary network issue'
      );

      await expressionErrorHandler.handleExpressionFailure(error, mockContext);

      // Should skip expressions for this turn but not disable permanently
      expect(mockContext.skipExpressions).toBe(true);
      expect(mockContext.disableExpressions).not.toHaveBeenCalled();
    });

    it('should disable expressions after too many errors', async () => {
      const errorHandler = expressionErrorHandler;
      
      // Create multiple errors to exceed threshold
      for (let i = 0; i < 6; i++) {
        const error = errorHandler.createError(
          ExpressionErrorType.NETWORK_ERROR,
          ExpressionErrorStage.LOADING,
          `Error ${i}`
        );
        await errorHandler.handleExpressionFailure(error, mockContext);
      }

      // Should disable expressions after threshold
      expect(mockContext.disableExpressions).toHaveBeenCalled();
    });
  });

  describe('Graceful Degradation', () => {
    it('should continue TTS operation when expressions fail', async () => {
      // Simulate expression failure
      const error = expressionErrorHandler.createError(
        ExpressionErrorType.BUFFER_NOT_READY,
        ExpressionErrorStage.PLAYBACK,
        'Buffer not ready',
        { expressionId: 'test-expression' }
      );

      await expressionErrorHandler.handleExpressionFailure(error, mockContext);

      // Should remove the problematic expression but continue
      expect(mockContext.removeExpression).toHaveBeenCalledWith('test-expression');
      expect(mockContext.isExpressionsEnabled).toBe(true);
    });

    it('should handle decode errors by removing expressions', async () => {
      await expressionErrorHandler.handleDecodeError(
        'corrupted-expression',
        new Error('Invalid audio format'),
        mockContext
      );

      expect(mockContext.removeExpression).toHaveBeenCalledWith('corrupted-expression');
    });

    it('should handle duration exceeded by removing expressions', async () => {
      await expressionErrorHandler.handleDurationExceeded(
        'long-expression',
        500, // 500ms
        300, // 300ms limit
        mockContext
      );

      expect(mockContext.removeExpression).toHaveBeenCalledWith('long-expression');
    });
  });

  describe('Error Statistics', () => {
    it('should track comprehensive error statistics', async () => {
      // Create various types of errors
      const errors = [
        expressionErrorHandler.createError(
          ExpressionErrorType.NETWORK_ERROR,
          ExpressionErrorStage.LOADING,
          'Network error'
        ),
        expressionErrorHandler.createError(
          ExpressionErrorType.DECODE_ERROR,
          ExpressionErrorStage.PRELOADING,
          'Decode error'
        ),
        expressionErrorHandler.createError(
          ExpressionErrorType.PLAYBACK_ERROR,
          ExpressionErrorStage.PLAYBACK,
          'Playback error'
        )
      ];

      for (const error of errors) {
        await expressionErrorHandler.handleExpressionFailure(error, mockContext);
      }

      const stats = expressionErrorHandler.getErrorStats();
      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByType[ExpressionErrorType.NETWORK_ERROR]).toBe(1);
      expect(stats.errorsByType[ExpressionErrorType.DECODE_ERROR]).toBe(1);
      expect(stats.errorsByType[ExpressionErrorType.PLAYBACK_ERROR]).toBe(1);
      expect(stats.sessionErrorCounts[mockContext.sessionId]).toBe(3);
    });
  });

  describe('Cleanup and Memory Management', () => {
    it('should clean up old data to prevent memory leaks', () => {
      // Add some data
      expressionPerformanceMonitor.measureExpressionDuration('expr1', 200, 'laugh', 'user');
      
      let stats = expressionPerformanceMonitor.getStats();
      expect(stats.measurementCount).toBe(1);

      // Simulate old data by manipulating timestamps
      const measurements = (expressionPerformanceMonitor as any).measurements;
      if (measurements.length > 0) {
        measurements[0].timestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      }

      expressionPerformanceMonitor.cleanup();

      stats = expressionPerformanceMonitor.getStats();
      expect(stats.measurementCount).toBe(0);
    });

    it('should clean up network manager state', async () => {
      // Cause a failure to populate state
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      await expressionNetworkManager.loadExpressionAudio(
        'https://example.com/test.mp3',
        mockContext
      );

      let stats = expressionNetworkManager.getStats();
      expect(stats.failedUrlCount).toBeGreaterThan(0);

      expressionNetworkManager.cleanup();

      stats = expressionNetworkManager.getStats();
      expect(stats.failedUrlCount).toBe(0);
    });
  });
});