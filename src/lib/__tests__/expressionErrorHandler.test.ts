/**
 * Expression Error Handler Tests
 * 
 * Tests for comprehensive error handling and graceful degradation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  ExpressionErrorHandler,
  ExpressionErrorType,
  ExpressionErrorStage,
  PlaybackContext,
  withExpressionErrorHandling
} from '../expressionErrorHandler';

// Mock dependencies
vi.mock('../logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../expressionMetrics', () => ({
  expressionMetrics: {
    errorCount: { inc: vi.fn() },
    errorRate: { inc: vi.fn() },
    sessionErrors: { set: vi.fn() },
    networkRetrySuccess: { inc: vi.fn() },
    sessionDisabled: { inc: vi.fn() }
  }
}));

describe('ExpressionErrorHandler', () => {
  let errorHandler: ExpressionErrorHandler;
  let mockContext: PlaybackContext;

  beforeEach(() => {
    errorHandler = new ExpressionErrorHandler();
    mockContext = {
      sessionId: 'test-session',
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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createError', () => {
    it('should create a properly formatted error object', () => {
      const error = errorHandler.createError(
        ExpressionErrorType.NETWORK_ERROR,
        ExpressionErrorStage.LOADING,
        'Test error message',
        {
          expressionId: 'test-expression',
          ownerId: 'test-user',
          originalError: new Error('Original error')
        }
      );

      expect(error).toMatchObject({
        type: ExpressionErrorType.NETWORK_ERROR,
        stage: ExpressionErrorStage.LOADING,
        message: 'Test error message',
        expressionId: 'test-expression',
        ownerId: 'test-user'
      });
      expect(error.timestamp).toBeTypeOf('number');
      expect(error.originalError).toBeInstanceOf(Error);
    });
  });

  describe('handleExpressionFailure', () => {
    it('should handle network errors by skipping expressions for current turn', async () => {
      const error = errorHandler.createError(
        ExpressionErrorType.NETWORK_ERROR,
        ExpressionErrorStage.LOADING,
        'Network request failed'
      );

      await errorHandler.handleExpressionFailure(error, mockContext);

      expect(mockContext.skipExpressions).toBe(true);
    });

    it('should handle buffer not ready by removing specific expression', async () => {
      const error = errorHandler.createError(
        ExpressionErrorType.BUFFER_NOT_READY,
        ExpressionErrorStage.PLAYBACK,
        'Buffer not ready',
        { expressionId: 'test-expression' }
      );

      await errorHandler.handleExpressionFailure(error, mockContext);

      expect(mockContext.removeExpression).toHaveBeenCalledWith('test-expression');
    });

    it('should handle audio context errors by disabling expressions', async () => {
      const error = errorHandler.createError(
        ExpressionErrorType.AUDIO_CONTEXT_ERROR,
        ExpressionErrorStage.INITIALIZATION,
        'Audio context failed'
      );

      await errorHandler.handleExpressionFailure(error, mockContext);

      expect(mockContext.disableExpressions).toHaveBeenCalled();
    });

    it('should handle duration exceeded by removing expression', async () => {
      const error = errorHandler.createError(
        ExpressionErrorType.DURATION_EXCEEDED,
        ExpressionErrorStage.SCHEDULING,
        'Expression too long',
        { expressionId: 'long-expression' }
      );

      await errorHandler.handleExpressionFailure(error, mockContext);

      expect(mockContext.removeExpression).toHaveBeenCalledWith('long-expression');
    });
  });

  describe('handleNetworkError', () => {
    beforeEach(() => {
      // Mock fetch for retry tests
      global.fetch = vi.fn();
    });

    it('should retry network requests with exponential backoff', async () => {
      const mockResponse = new Response('test', { status: 200 });
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockResponse);

      const result = await errorHandler.handleNetworkError(
        'https://example.com/test.mp3',
        new Error('Network error'),
        mockContext,
        0
      );

      expect(result).toBe(mockResponse);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should return null after max retries exceeded', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const result = await errorHandler.handleNetworkError(
        'https://example.com/test.mp3',
        new Error('Network error'),
        mockContext,
        0
      );

      expect(result).toBeNull();
      expect(global.fetch).toHaveBeenCalledTimes(3); // Max retries is 3, so 3 attempts total
    });

    it('should not retry on 404 errors', async () => {
      const error = new Error('HTTP 404');
      
      const result = await errorHandler.handleNetworkError(
        'https://example.com/test.mp3',
        error,
        mockContext,
        3 // Start at max retries to avoid retrying
      );

      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('handleDecodeError', () => {
    it('should handle decode errors and remove expression', async () => {
      await errorHandler.handleDecodeError(
        'test-expression',
        new Error('Decode failed'),
        mockContext
      );

      expect(mockContext.removeExpression).toHaveBeenCalledWith('test-expression');
    });
  });

  describe('handleDurationExceeded', () => {
    it('should handle duration exceeded and remove expression', async () => {
      await errorHandler.handleDurationExceeded(
        'long-expression',
        500,
        300,
        mockContext
      );

      expect(mockContext.removeExpression).toHaveBeenCalledWith('long-expression');
    });
  });

  describe('session error tracking', () => {
    it('should disable expressions after error threshold exceeded', async () => {
      const errorHandler = new ExpressionErrorHandler({ maxErrorsPerSession: 2 });
      
      // Create multiple errors to exceed threshold
      for (let i = 0; i < 3; i++) {
        const error = errorHandler.createError(
          ExpressionErrorType.NETWORK_ERROR,
          ExpressionErrorStage.LOADING,
          `Error ${i}`
        );
        await errorHandler.handleExpressionFailure(error, mockContext);
      }

      expect(mockContext.disableExpressions).toHaveBeenCalled();
    });

    it('should track errors per session correctly', async () => {
      const error1 = errorHandler.createError(
        ExpressionErrorType.NETWORK_ERROR,
        ExpressionErrorStage.LOADING,
        'Error 1'
      );
      const error2 = errorHandler.createError(
        ExpressionErrorType.BUFFER_NOT_READY,
        ExpressionErrorStage.PLAYBACK,
        'Error 2'
      );

      await errorHandler.handleExpressionFailure(error1, mockContext);
      await errorHandler.handleExpressionFailure(error2, mockContext);

      const stats = errorHandler.getErrorStats();
      expect(stats.sessionErrorCounts[mockContext.sessionId]).toBe(2);
    });
  });

  describe('getErrorStats', () => {
    it('should return comprehensive error statistics', async () => {
      const error1 = errorHandler.createError(
        ExpressionErrorType.NETWORK_ERROR,
        ExpressionErrorStage.LOADING,
        'Network error'
      );
      const error2 = errorHandler.createError(
        ExpressionErrorType.DECODE_ERROR,
        ExpressionErrorStage.PRELOADING,
        'Decode error'
      );

      await errorHandler.handleExpressionFailure(error1, mockContext);
      await errorHandler.handleExpressionFailure(error2, mockContext);

      const stats = errorHandler.getErrorStats();
      
      expect(stats.totalErrors).toBe(2);
      expect(stats.errorsByType[ExpressionErrorType.NETWORK_ERROR]).toBe(1);
      expect(stats.errorsByType[ExpressionErrorType.DECODE_ERROR]).toBe(1);
      expect(stats.errorsByStage[ExpressionErrorStage.LOADING]).toBe(1);
      expect(stats.errorsByStage[ExpressionErrorStage.PRELOADING]).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('should remove old session data', async () => {
      // Create an error with old timestamp
      const oldError = errorHandler.createError(
        ExpressionErrorType.NETWORK_ERROR,
        ExpressionErrorStage.LOADING,
        'Old error'
      );
      oldError.timestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago

      await errorHandler.handleExpressionFailure(oldError, mockContext);
      
      errorHandler.cleanup();
      
      const stats = errorHandler.getErrorStats();
      expect(stats.sessionErrorCounts[mockContext.sessionId]).toBeUndefined();
    });
  });
});

describe('withExpressionErrorHandling', () => {
  let mockContext: PlaybackContext;

  beforeEach(() => {
    mockContext = {
      sessionId: 'test-session',
      ownerId: 'test-user',
      ownerType: 'user',
      skipExpressions: false,
      disabledExpressions: new Set(),
      temporaryDisableUntil: 0,
      isExpressionsEnabled: true,
      removeExpression: vi.fn(),
      disableExpressions: vi.fn(),
      temporaryDisable: vi.fn()
    };
  });

  it('should return result on successful operation', async () => {
    const operation = vi.fn().mockResolvedValue('success');
    
    const result = await withExpressionErrorHandling(
      operation,
      mockContext,
      ExpressionErrorType.NETWORK_ERROR,
      ExpressionErrorStage.LOADING,
      'test-expression'
    );

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalled();
  });

  it('should return null and handle error on operation failure', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('Operation failed'));
    
    const result = await withExpressionErrorHandling(
      operation,
      mockContext,
      ExpressionErrorType.NETWORK_ERROR,
      ExpressionErrorStage.LOADING,
      'test-expression'
    );

    expect(result).toBeNull();
    expect(operation).toHaveBeenCalled();
  });
});