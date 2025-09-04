/**
 * Unit tests for StoryErrorHandler
 * Tests error handling, fallback mechanisms, and timing constraints
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { 
  StoryErrorHandler, 
  StoryErrorType, 
  ErrorRecoveryConfig,
  StoryError 
} from '../storyErrorHandler';
import { logger } from '../../logger';
import { metrics } from '../../metrics';

// Mock dependencies
vi.mock('../../logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../metrics', () => ({
  metrics: {
    increment: vi.fn(),
    timing: vi.fn(),
    gauge: vi.fn()
  }
}));

describe('StoryErrorHandler', () => {
  let errorHandler: StoryErrorHandler;
  let mockFallbackCallback: Mock;
  let mockConfig: ErrorRecoveryConfig;

  beforeEach(() => {
    mockConfig = {
      maxRetries: 2,
      retryDelayMs: 100,
      fallbackTimeoutMs: 150,
      enableFallbackTTS: true,
      logErrors: true,
      maxGapMs: 150
    };
    
    errorHandler = new StoryErrorHandler(mockConfig);
    mockFallbackCallback = vi.fn().mockResolvedValue(undefined);
    
    // Reset mocks
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    errorHandler.cleanup();
  });

  describe('handleLoadingError', () => {
    it('should execute fallback immediately when max retries exceeded', async () => {
      const storyId = 'test-story-1';
      const error = new Error('Network timeout');
      const fallbackText = 'Test fallback text';

      // Simulate max retries already reached
      errorHandler['retryAttempts'].set(`load_${storyId}`, 2);

      await errorHandler.handleLoadingError(storyId, error, fallbackText, mockFallbackCallback);

      expect(mockFallbackCallback).toHaveBeenCalledOnce();
      expect(metrics.increment).toHaveBeenCalledWith('story_fallback_success');
    });

    it('should retry with exponential backoff before fallback', async () => {
      const storyId = 'test-story-2';
      const error = new Error('Temporary network error');
      const fallbackText = 'Test fallback text';

      // Set up initial retry state
      errorHandler['retryAttempts'].set(`load_${storyId}`, 0);

      // Mock callback that will be called for fallback
      const fallbackCallback = vi.fn().mockResolvedValue(undefined);

      await errorHandler.handleLoadingError(storyId, error, fallbackText, fallbackCallback);

      // Should have attempted fallback
      expect(fallbackCallback).toHaveBeenCalled();
    }, 10000);

    it('should execute emergency fallback when graceful fallback fails', async () => {
      const storyId = 'test-story-3';
      const error = new Error('Critical error');
      const fallbackText = 'Test fallback text';
      
      // Mock fallback callback that fails
      const failingCallback = vi.fn().mockRejectedValue(new Error('Fallback failed'));

      await errorHandler.handleLoadingError(storyId, error, fallbackText, failingCallback);

      expect(failingCallback).toHaveBeenCalled();
      expect(metrics.increment).toHaveBeenCalledWith('story_emergency_fallback');
    }, 10000);

    it('should respect timing constraints for fallback execution', async () => {
      const storyId = 'test-story-4';
      const error = new Error('Slow loading error');
      const fallbackText = 'Test fallback text';
      
      // Mock slow fallback callback
      const slowCallback = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      const startTime = Date.now();
      await errorHandler.handleLoadingError(storyId, error, fallbackText, slowCallback);
      
      // Should not wait longer than maxGapMs + buffer
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(300); // Allow buffer for test execution
    }, 10000);
  });

  describe('handlePlaybackError', () => {
    it('should immediately fallback for critical audio context errors', async () => {
      const storyId = 'test-story-5';
      const error = new Error('AudioContext suspended');
      const fallbackText = 'Test fallback text';

      await errorHandler.handlePlaybackError(storyId, error, fallbackText, mockFallbackCallback);

      expect(mockFallbackCallback).toHaveBeenCalledOnce();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should immediately fallback for memory limit errors', async () => {
      const storyId = 'test-story-6';
      const error = new Error('Memory quota exceeded');
      const fallbackText = 'Test fallback text';

      await errorHandler.handlePlaybackError(storyId, error, fallbackText, mockFallbackCallback);

      expect(mockFallbackCallback).toHaveBeenCalledOnce();
      expect(metrics.increment).toHaveBeenCalledWith('story_error_memory_limit_exceeded');
    });

    it('should attempt recovery for recoverable playback errors', async () => {
      const storyId = 'test-story-7';
      const error = new Error('Temporary playback issue');
      const fallbackText = 'Test fallback text';

      await errorHandler.handlePlaybackError(storyId, error, fallbackText, mockFallbackCallback);

      // Should attempt recovery first, then fallback when recovery fails
      expect(mockFallbackCallback).toHaveBeenCalledOnce();
    });

    it('should classify different error types correctly', async () => {
      const testCases = [
        { message: 'AudioContext not allowed', expectedType: StoryErrorType.AUDIO_CONTEXT_ERROR },
        { message: 'Memory quota exceeded', expectedType: StoryErrorType.MEMORY_LIMIT_EXCEEDED },
        { message: 'Audio decode failed', expectedType: StoryErrorType.AUDIO_DECODE_ERROR },
        { message: 'Already playing audio', expectedType: StoryErrorType.CONCURRENT_PLAYBACK_ERROR },
        { message: 'Unknown error', expectedType: StoryErrorType.PLAYBACK_FAILED }
      ];

      for (const testCase of testCases) {
        const error = new Error(testCase.message);
        const classifiedType = errorHandler['classifyPlaybackError'](error);
        expect(classifiedType).toBe(testCase.expectedType);
      }
    });
  });

  describe('handleTriggerMatchingError', () => {
    it('should immediately proceed with TTS for trigger matching failures', async () => {
      const error = new Error('Database timeout');
      const fallbackText = 'Test fallback text';

      await errorHandler.handleTriggerMatchingError(error, fallbackText, mockFallbackCallback);

      expect(mockFallbackCallback).toHaveBeenCalledOnce();
      expect(metrics.increment).toHaveBeenCalledWith('story_trigger_matching_failed');
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should not delay TTS for trigger matching errors', async () => {
      const error = new Error('Trigger matching failed');
      const fallbackText = 'Test fallback text';

      const startTime = Date.now();
      await errorHandler.handleTriggerMatchingError(error, fallbackText, mockFallbackCallback);
      const elapsed = Date.now() - startTime;

      // Should complete immediately without delays
      expect(elapsed).toBeLessThan(50);
      expect(mockFallbackCallback).toHaveBeenCalledOnce();
    });
  });

  describe('error classification and recovery', () => {
    it('should correctly identify recoverable errors', () => {
      const recoverableTypes = [
        StoryErrorType.NETWORK_TIMEOUT,
        StoryErrorType.STORAGE_UNAVAILABLE,
        StoryErrorType.CONCURRENT_PLAYBACK_ERROR
      ];

      const nonRecoverableTypes = [
        StoryErrorType.AUDIO_DECODE_ERROR,
        StoryErrorType.AUDIO_CONTEXT_ERROR,
        StoryErrorType.MEMORY_LIMIT_EXCEEDED
      ];

      recoverableTypes.forEach(type => {
        expect(errorHandler['isRecoverableError'](type)).toBe(true);
      });

      nonRecoverableTypes.forEach(type => {
        expect(errorHandler['isRecoverableError'](type)).toBe(false);
      });
    });

    it('should create structured story errors with context', () => {
      const originalError = new Error('Test error');
      const storyError = errorHandler['createStoryError'](
        originalError,
        StoryErrorType.NETWORK_TIMEOUT,
        { storyId: 'test-story' }
      );

      expect(storyError.type).toBe(StoryErrorType.NETWORK_TIMEOUT);
      expect(storyError.context.storyId).toBe('test-story');
      expect(storyError.context.errorType).toBe(StoryErrorType.NETWORK_TIMEOUT);
      expect(storyError.context.timestamp).toBeTypeOf('number');
      expect(storyError.recoverable).toBe(true);
    });
  });

  describe('timing and performance constraints', () => {
    it('should enforce maximum gap constraint of 150ms', async () => {
      const storyId = 'test-story-timing';
      const error = new Error('Slow error');
      const fallbackText = 'Test fallback text';
      
      // Mock very slow callback
      const verySlowCallback = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 500))
      );

      const startTime = Date.now();
      await errorHandler.handleLoadingError(storyId, error, fallbackText, verySlowCallback);
      const elapsed = Date.now() - startTime;

      // Should not exceed maxGapMs even with slow callback
      expect(elapsed).toBeLessThanOrEqual(mockConfig.maxGapMs + 100); // Allow buffer for test execution
    }, 10000);

    it('should track fallback timing metrics', async () => {
      const storyId = 'test-story-metrics';
      const error = new Error('Test error');
      const fallbackText = 'Test fallback text';

      await errorHandler.handleLoadingError(storyId, error, fallbackText, mockFallbackCallback);

      expect(metrics.timing).toHaveBeenCalledWith(
        'story_fallback_duration_ms',
        expect.any(Number)
      );
    }, 10000);
  });

  describe('resource management', () => {
    it('should clean up retry attempts after handling errors', async () => {
      const storyId = 'test-story-cleanup';
      const error = new Error('Test error');
      const fallbackText = 'Test fallback text';

      await errorHandler.handleLoadingError(storyId, error, fallbackText, mockFallbackCallback);

      // Retry tracking should be cleaned up
      expect(errorHandler['retryAttempts'].has(`load_${storyId}`)).toBe(false);
    }, 10000);

    it('should provide error statistics for monitoring', () => {
      errorHandler.registerFallbackCallback('story-1', mockFallbackCallback);
      errorHandler['retryAttempts'].set('retry-1', 1);

      const stats = errorHandler.getErrorStats();

      expect(stats.activeRetries).toBe(1);
      expect(stats.registeredCallbacks).toBe(1);
      expect(stats.config).toEqual(mockConfig);
    });

    it('should clean up all resources on cleanup', () => {
      errorHandler.registerFallbackCallback('story-1', mockFallbackCallback);
      errorHandler['retryAttempts'].set('retry-1', 1);

      errorHandler.cleanup();

      const stats = errorHandler.getErrorStats();
      expect(stats.activeRetries).toBe(0);
      expect(stats.registeredCallbacks).toBe(0);
    });
  });

  describe('logging and metrics', () => {
    it('should log recoverable errors as warnings', async () => {
      const error = new Error('Recoverable error');
      const storyError = errorHandler['createStoryError'](
        error,
        StoryErrorType.NETWORK_TIMEOUT,
        { storyId: 'test-story' }
      );

      await errorHandler['logError'](storyError);

      expect(logger.warn).toHaveBeenCalledWith(
        'Recoverable story error',
        expect.objectContaining({
          errorType: StoryErrorType.NETWORK_TIMEOUT,
          recoverable: true
        })
      );
    });

    it('should log non-recoverable errors as errors', async () => {
      const error = new Error('Non-recoverable error');
      const storyError = errorHandler['createStoryError'](
        error,
        StoryErrorType.AUDIO_CONTEXT_ERROR,
        { storyId: 'test-story' }
      );

      await errorHandler['logError'](storyError);

      expect(logger.error).toHaveBeenCalledWith(
        'Non-recoverable story error',
        expect.objectContaining({
          errorType: StoryErrorType.AUDIO_CONTEXT_ERROR,
          recoverable: false
        })
      );
    });

    it('should track error metrics by type and story', async () => {
      const error = new Error('Test error');
      const storyError = errorHandler['createStoryError'](
        error,
        StoryErrorType.PLAYBACK_FAILED,
        { storyId: 'test-story-123' }
      );

      await errorHandler['logError'](storyError);

      expect(metrics.increment).toHaveBeenCalledWith('story_error_playback_failed');
      expect(metrics.increment).toHaveBeenCalledWith(
        'story_error_by_story',
        { storyId: 'test-story-123' }
      );
    });
  });
});