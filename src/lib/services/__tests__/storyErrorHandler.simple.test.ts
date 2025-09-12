/**
 * Simplified integration tests for StoryErrorHandler
 * Tests core error handling functionality without complex timing constraints
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StoryErrorHandler, StoryErrorType } from '../storyErrorHandler';

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

describe('StoryErrorHandler Simple Integration Tests', () => {
  let errorHandler: StoryErrorHandler;

  beforeEach(() => {
    errorHandler = new StoryErrorHandler({
      maxRetries: 1,
      retryDelayMs: 10,
      fallbackTimeoutMs: 100,
      enableFallbackTTS: true,
      logErrors: true,
      maxGapMs: 100
    });
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    errorHandler.cleanup();
  });

  describe('Basic error handling', () => {
    it('should handle loading errors with fallback', async () => {
      const storyId = 'test-story';
      const error = new Error('Loading failed');
      const fallbackText = 'Fallback text';
      const fallbackCallback = vi.fn().mockResolvedValue(undefined);

      await errorHandler.handleLoadingError(storyId, error, fallbackText, fallbackCallback);

      expect(fallbackCallback).toHaveBeenCalled();
    });

    it('should handle playback errors with fallback', async () => {
      const storyId = 'test-story';
      const error = new Error('Playback failed');
      const fallbackText = 'Fallback text';
      const fallbackCallback = vi.fn().mockResolvedValue(undefined);

      await errorHandler.handlePlaybackError(storyId, error, fallbackText, fallbackCallback);

      expect(fallbackCallback).toHaveBeenCalled();
    });

    it('should handle trigger matching errors', async () => {
      const error = new Error('Trigger matching failed');
      const fallbackText = 'Fallback text';
      const fallbackCallback = vi.fn().mockResolvedValue(undefined);

      await errorHandler.handleTriggerMatchingError(error, fallbackText, fallbackCallback);

      expect(fallbackCallback).toHaveBeenCalled();
    });
  });

  describe('Error classification', () => {
    it('should classify audio context errors correctly', () => {
      const error = new Error('AudioContext suspended');
      const errorType = errorHandler['classifyPlaybackError'](error);
      expect(errorType).toBe(StoryErrorType.AUDIO_CONTEXT_ERROR);
    });

    it('should classify memory errors correctly', () => {
      const error = new Error('Memory quota exceeded');
      const errorType = errorHandler['classifyPlaybackError'](error);
      expect(errorType).toBe(StoryErrorType.MEMORY_LIMIT_EXCEEDED);
    });

    it('should classify decode errors correctly', () => {
      const error = new Error('Failed to decode audio');
      const errorType = errorHandler['classifyPlaybackError'](error);
      expect(errorType).toBe(StoryErrorType.AUDIO_DECODE_ERROR);
    });
  });

  describe('Resource management', () => {
    it('should track error statistics', () => {
      const stats = errorHandler.getErrorStats();
      expect(stats).toHaveProperty('activeRetries');
      expect(stats).toHaveProperty('registeredCallbacks');
      expect(stats).toHaveProperty('config');
    });

    it('should clean up resources', () => {
      errorHandler.registerFallbackCallback('test-story', vi.fn());
      errorHandler['retryAttempts'].set('test-retry', 1);

      errorHandler.cleanup();

      const stats = errorHandler.getErrorStats();
      expect(stats.activeRetries).toBe(0);
      expect(stats.registeredCallbacks).toBe(0);
    });
  });

  describe('Fallback callback registration', () => {
    it('should register and manage fallback callbacks', () => {
      const callback = vi.fn();
      errorHandler.registerFallbackCallback('test-story', callback);

      const stats = errorHandler.getErrorStats();
      expect(stats.registeredCallbacks).toBe(1);
    });
  });
});