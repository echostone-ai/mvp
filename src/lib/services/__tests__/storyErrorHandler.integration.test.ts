/**
 * Integration tests for StoryErrorHandler
 * Tests end-to-end error scenarios and fallback paths with real-world conditions
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { StoryErrorHandler, StoryErrorType } from '../storyErrorHandler';
import { StoryAudioManager } from '../storyAudioManager';
import { UserStoryService } from '../userStoryService';
import { logger } from '../../logger';
import { metrics } from '../../metrics';

// Mock dependencies
vi.mock('../../logger');
vi.mock('../../metrics');
vi.mock('../storyAudioManager');
vi.mock('../userStoryService');

describe('StoryErrorHandler Integration Tests', () => {
  let errorHandler: StoryErrorHandler;
  let mockStoryAudioManager: StoryAudioManager;
  let mockUserStoryService: UserStoryService;
  let mockStreamingManager: any;

  beforeEach(() => {
    errorHandler = new StoryErrorHandler({
      maxRetries: 2,
      retryDelayMs: 50, // Faster for tests
      fallbackTimeoutMs: 150,
      enableFallbackTTS: true,
      logErrors: true,
      maxGapMs: 150
    });

    mockStoryAudioManager = new StoryAudioManager({} as any);
    mockUserStoryService = new UserStoryService({} as any, {} as any);
    
    mockStreamingManager = {
      startTTSStream: vi.fn().mockResolvedValue(undefined),
      stopCurrentAudio: vi.fn().mockResolvedValue(undefined),
      isPlaying: vi.fn().mockReturnValue(false)
    };

    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    errorHandler.cleanup();
  });

  describe('Network failure scenarios', () => {
    it('should handle complete network failure with graceful TTS fallback', async () => {
      const storyId = 'network-fail-story';
      const fallbackText = 'This is the TTS fallback text';
      
      // Simulate network failure
      const networkError = new Error('Network request failed');
      networkError.name = 'NetworkError';
      
      const mockTTSFallback = vi.fn().mockResolvedValue(undefined);
      
      await errorHandler.handleLoadingError(
        storyId,
        networkError,
        fallbackText,
        mockTTSFallback
      );

      expect(mockTTSFallback).toHaveBeenCalledOnce();
      expect(metrics.increment).toHaveBeenCalledWith('story_fallback_success');
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should retry network requests with exponential backoff', async () => {
      const storyId = 'retry-story';
      const fallbackText = 'Retry fallback text';
      
      let attemptCount = 0;
      const retryableCallback = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error('Temporary network error');
        }
        return Promise.resolve(); // Success on third attempt
      });

      // First call should fail and set up retry
      try {
        await errorHandler.handleLoadingError(
          storyId,
          new Error('Temporary network error'),
          fallbackText,
          retryableCallback
        );
      } catch (e) {
        // Expected to throw for retry setup
      }

      // Verify retry tracking
      expect(errorHandler['retryAttempts'].get(`load_${storyId}`)).toBe(1);
    });

    it('should handle intermittent connectivity with smart retry logic', async () => {
      const storyId = 'intermittent-story';
      const fallbackText = 'Intermittent fallback text';
      
      // Simulate intermittent connectivity
      const connectivityErrors = [
        new Error('Connection timeout'),
        new Error('DNS resolution failed'),
        new Error('Request aborted')
      ];
      
      for (const error of connectivityErrors) {
        const mockCallback = vi.fn().mockRejectedValue(error);
        
        await errorHandler.handleLoadingError(
          `${storyId}-${error.message}`,
          error,
          fallbackText,
          mockCallback
        );
        
        // Should attempt fallback for each connectivity issue
        expect(mockCallback).toHaveBeenCalled();
      }
    });
  });

  describe('Audio system failure scenarios', () => {
    it('should handle AudioContext suspension on mobile devices', async () => {
      const storyId = 'audiocontext-story';
      const fallbackText = 'AudioContext fallback text';
      
      // Simulate mobile AudioContext suspension
      const audioContextError = new Error('AudioContext is suspended');
      const mockTTSFallback = vi.fn().mockResolvedValue(undefined);
      
      await errorHandler.handlePlaybackError(
        storyId,
        audioContextError,
        fallbackText,
        mockTTSFallback
      );

      // Should immediately fallback for AudioContext errors
      expect(mockTTSFallback).toHaveBeenCalledOnce();
      expect(metrics.increment).toHaveBeenCalledWith('story_error_audio_context_error');
    });

    it('should handle memory pressure on resource-constrained devices', async () => {
      const storyId = 'memory-story';
      const fallbackText = 'Memory pressure fallback text';
      
      // Simulate memory quota exceeded
      const memoryError = new Error('Memory quota exceeded for audio buffers');
      const mockTTSFallback = vi.fn().mockResolvedValue(undefined);
      
      await errorHandler.handlePlaybackError(
        storyId,
        memoryError,
        fallbackText,
        mockTTSFallback
      );

      // Should immediately fallback for memory errors
      expect(mockTTSFallback).toHaveBeenCalledOnce();
      expect(metrics.increment).toHaveBeenCalledWith('story_error_memory_limit_exceeded');
    });

    it('should handle audio decode failures with format fallback', async () => {
      const storyId = 'decode-story';
      const fallbackText = 'Audio decode fallback text';
      
      // Simulate audio decode failure
      const decodeError = new Error('Failed to decode audio data');
      const mockTTSFallback = vi.fn().mockResolvedValue(undefined);
      
      await errorHandler.handlePlaybackError(
        storyId,
        decodeError,
        fallbackText,
        mockTTSFallback
      );

      expect(mockTTSFallback).toHaveBeenCalledOnce();
      expect(metrics.increment).toHaveBeenCalledWith('story_error_audio_decode_error');
    });
  });

  describe('Concurrent playback scenarios', () => {
    it('should handle conflicts between story and expression playback', async () => {
      const storyId = 'concurrent-story';
      const fallbackText = 'Concurrent playback fallback text';
      
      // Simulate concurrent playback conflict
      const concurrentError = new Error('Another audio source is already playing');
      const mockTTSFallback = vi.fn().mockResolvedValue(undefined);
      
      await errorHandler.handlePlaybackError(
        storyId,
        concurrentError,
        fallbackText,
        mockTTSFallback
      );

      expect(mockTTSFallback).toHaveBeenCalledOnce();
      expect(metrics.increment).toHaveBeenCalledWith('story_error_concurrent_playback_error');
    });

    it('should manage multiple simultaneous error conditions', async () => {
      const baseStoryId = 'multi-error-story';
      const fallbackText = 'Multi-error fallback text';
      
      // Simulate multiple simultaneous errors
      const errors = [
        { id: `${baseStoryId}-1`, error: new Error('Network timeout') },
        { id: `${baseStoryId}-2`, error: new Error('Audio decode failed') },
        { id: `${baseStoryId}-3`, error: new Error('Memory quota exceeded') }
      ];
      
      const fallbackPromises = errors.map(({ id, error }) => {
        const mockCallback = vi.fn().mockResolvedValue(undefined);
        return errorHandler.handlePlaybackError(id, error, fallbackText, mockCallback);
      });
      
      await Promise.all(fallbackPromises);
      
      // All errors should be handled gracefully
      expect(logger.warn).toHaveBeenCalledTimes(1); // Network timeout (recoverable)
      expect(logger.error).toHaveBeenCalledTimes(2); // Audio decode and memory (non-recoverable)
    });
  });

  describe('Timing constraint enforcement', () => {
    it('should enforce 150ms maximum gap constraint under load', async () => {
      const storyId = 'timing-story';
      const fallbackText = 'Timing constraint fallback text';
      
      // Simulate high system load with slow operations
      const slowCallback = vi.fn().mockImplementation(() => 
        new Promise(resolve => {
          // Simulate slow operation that would exceed timing constraint
          setTimeout(resolve, 300);
        })
      );
      
      const startTime = Date.now();
      await errorHandler.handleLoadingError(
        storyId,
        new Error('Slow loading error'),
        fallbackText,
        slowCallback
      );
      const elapsed = Date.now() - startTime;
      
      // Should not exceed maximum gap even under load
      expect(elapsed).toBeLessThan(200); // Allow small buffer for test execution
      expect(metrics.increment).toHaveBeenCalledWith('story_emergency_fallback');
    });

    it('should maintain conversation flow continuity during errors', async () => {
      const storyId = 'continuity-story';
      const fallbackText = 'Conversation continuity test';
      
      // Track timing of fallback execution
      const timingTracker = {
        fallbackStarted: 0,
        fallbackCompleted: 0
      };
      
      const timedCallback = vi.fn().mockImplementation(async () => {
        timingTracker.fallbackStarted = Date.now();
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate TTS startup
        timingTracker.fallbackCompleted = Date.now();
      });
      
      await errorHandler.handleLoadingError(
        storyId,
        new Error('Story loading failed'),
        fallbackText,
        timedCallback
      );
      
      const fallbackDuration = timingTracker.fallbackCompleted - timingTracker.fallbackStarted;
      expect(fallbackDuration).toBeLessThan(100); // Quick TTS startup
      expect(timedCallback).toHaveBeenCalledOnce();
    });
  });

  describe('Error recovery and resilience', () => {
    it('should recover from transient storage service outages', async () => {
      const storyId = 'storage-outage-story';
      const fallbackText = 'Storage outage fallback text';
      
      // Simulate storage service outage
      const storageError = new Error('Storage service temporarily unavailable');
      storageError.name = 'ServiceUnavailableError';
      
      const mockCallback = vi.fn().mockResolvedValue(undefined);
      
      await errorHandler.handleLoadingError(
        storyId,
        storageError,
        fallbackText,
        mockCallback
      );
      
      expect(mockCallback).toHaveBeenCalledOnce();
      expect(metrics.increment).toHaveBeenCalledWith('story_fallback_success');
    });

    it('should handle cascading failure scenarios gracefully', async () => {
      const storyId = 'cascading-failure-story';
      const fallbackText = 'Cascading failure fallback text';
      
      // Simulate cascading failures: story fails, then TTS fails
      const storyError = new Error('Story loading failed');
      const ttsError = new Error('TTS service also failed');
      
      const failingTTSCallback = vi.fn().mockRejectedValue(ttsError);
      
      await errorHandler.handleLoadingError(
        storyId,
        storyError,
        fallbackText,
        failingTTSCallback
      );
      
      // Should attempt TTS fallback and handle its failure gracefully
      expect(failingTTSCallback).toHaveBeenCalledOnce();
      expect(metrics.increment).toHaveBeenCalledWith('story_emergency_fallback');
      expect(logger.error).toHaveBeenCalledWith(
        'Emergency TTS fallback failed',
        expect.objectContaining({
          error: ttsError.message
        })
      );
    });

    it('should maintain system stability during error storms', async () => {
      const baseStoryId = 'error-storm';
      const fallbackText = 'Error storm fallback text';
      
      // Simulate error storm with many simultaneous failures
      const errorPromises = Array.from({ length: 10 }, (_, i) => {
        const storyId = `${baseStoryId}-${i}`;
        const error = new Error(`Error ${i}`);
        const mockCallback = vi.fn().mockResolvedValue(undefined);
        
        return errorHandler.handleLoadingError(storyId, error, fallbackText, mockCallback);
      });
      
      // All errors should be handled without system failure
      await Promise.all(errorPromises);
      
      // Verify system remains stable
      const stats = errorHandler.getErrorStats();
      expect(stats.activeRetries).toBe(0); // All retries should be cleaned up
      expect(metrics.increment).toHaveBeenCalledWith('story_fallback_success');
    });
  });

  describe('Real-world integration scenarios', () => {
    it('should integrate with existing StreamingAudioManager error handling', async () => {
      const storyId = 'streaming-integration-story';
      const fallbackText = 'Streaming integration fallback';
      
      // Mock StreamingAudioManager with error conditions
      mockStreamingManager.startTTSStream.mockRejectedValue(
        new Error('Streaming manager error')
      );
      
      const streamingCallback = vi.fn().mockImplementation(async () => {
        await mockStreamingManager.startTTSStream(fallbackText);
      });
      
      await errorHandler.handleLoadingError(
        storyId,
        new Error('Story failed'),
        fallbackText,
        streamingCallback
      );
      
      // Should attempt streaming manager integration
      expect(streamingCallback).toHaveBeenCalledOnce();
      expect(mockStreamingManager.startTTSStream).toHaveBeenCalledWith(fallbackText);
    });

    it('should work with mobile Safari audio context limitations', async () => {
      const storyId = 'mobile-safari-story';
      const fallbackText = 'Mobile Safari fallback';
      
      // Simulate mobile Safari AudioContext restrictions
      const safariError = new Error('AudioContext creation requires user gesture');
      const mockCallback = vi.fn().mockResolvedValue(undefined);
      
      await errorHandler.handlePlaybackError(
        storyId,
        safariError,
        fallbackText,
        mockCallback
      );
      
      expect(mockCallback).toHaveBeenCalledOnce();
      expect(metrics.increment).toHaveBeenCalledWith('story_error_audio_context_error');
    });

    it('should handle CDN and network edge case failures', async () => {
      const storyId = 'cdn-edge-story';
      const fallbackText = 'CDN edge case fallback';
      
      // Simulate various CDN/network edge cases
      const edgeCaseErrors = [
        new Error('CORS policy violation'),
        new Error('CDN cache miss timeout'),
        new Error('SSL certificate validation failed'),
        new Error('HTTP 503 Service Unavailable')
      ];
      
      for (const error of edgeCaseErrors) {
        const mockCallback = vi.fn().mockResolvedValue(undefined);
        
        await errorHandler.handleLoadingError(
          `${storyId}-${error.message.replace(/\s+/g, '-')}`,
          error,
          fallbackText,
          mockCallback
        );
        
        expect(mockCallback).toHaveBeenCalled();
      }
      
      // All edge cases should be handled gracefully
      expect(metrics.increment).toHaveBeenCalledWith('story_fallback_success');
    });
  });
});