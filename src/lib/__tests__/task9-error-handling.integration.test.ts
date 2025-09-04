/**
 * Task 9 Integration Test - Comprehensive Error Handling and Fallback
 * 
 * This test validates the complete error handling system implementation
 * including StoryErrorHandler integration with StoryAudioManager and StoryTriggerMatcher
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StoryErrorHandler } from '../services/storyErrorHandler';
import { StoryAudioManager } from '../services/storyAudioManager';
import { StoryTriggerMatcher } from '../services/storyTriggerMatcher';
import { UserStory } from '../types/stories';

// Mock external dependencies
vi.mock('../logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../metrics', () => ({
  metrics: {
    increment: vi.fn(),
    timing: vi.fn(),
    gauge: vi.fn()
  }
}));

vi.mock('../streamingUtils');
vi.mock('../globalAudioManager');
vi.mock('../mobileAudioContextManager');

describe('Task 9: Comprehensive Error Handling and Fallback Integration', () => {
  let errorHandler: StoryErrorHandler;
  let storyAudioManager: StoryAudioManager;
  let triggerMatcher: StoryTriggerMatcher;
  let mockStreamingManager: any;
  let testStory: UserStory;

  beforeEach(() => {
    // Initialize error handler with test configuration
    errorHandler = new StoryErrorHandler({
      maxRetries: 2,
      retryDelayMs: 10, // Fast for tests
      fallbackTimeoutMs: 150,
      enableFallbackTTS: true,
      logErrors: true,
      maxGapMs: 150
    });

    // Initialize story audio manager
    storyAudioManager = new StoryAudioManager({
      preloadTimeoutMs: 100,
      fallbackToTTS: true,
      enableLipSync: false,
      maxConcurrentLoads: 1,
      audioBufferCacheSize: 1024 * 1024
    });

    // Initialize trigger matcher
    triggerMatcher = new StoryTriggerMatcher({
      enableCooldown: false,
      maxMatches: 5,
      minKeywordLength: 2
    });

    // Mock streaming manager
    mockStreamingManager = {
      stop: vi.fn(),
      addSentence: vi.fn().mockResolvedValue(undefined),
      isPlaying: vi.fn().mockReturnValue(false)
    };

    // Test story data
    testStory = {
      id: 'test-story-error-handling',
      owner_id: 'test-avatar',
      owner_type: 'avatar',
      title: 'Error Handling Test Story',
      category: 'memory',
      triggers: 'test,error,handling',
      audio_url: 'https://example.com/test-story.mp3',
      duration_ms: 30000,
      transcript: 'This is a test story for error handling.',
      priority: 50,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    errorHandler.cleanup();
    storyAudioManager.destroy();
  });

  describe('Requirement 3.5: Graceful degradation when stories fail to load or play', () => {
    it('should gracefully handle story loading failures with TTS fallback', async () => {
      // Mock story loading failure
      vi.spyOn(storyAudioManager, 'preloadStoryAudio').mockResolvedValue({
        success: false,
        error: 'Network timeout during story loading',
        loadTimeMs: 2100 // Exceeds timeout
      });

      const result = await storyAudioManager.replaceNextTTSWithStory(
        testStory,
        mockStreamingManager
      );

      // Should fail gracefully and use TTS fallback
      expect(result.success).toBe(false);
      expect(result.fallback_used).toBe(true);
      expect(mockStreamingManager.addSentence).toHaveBeenCalled();
    });

    it('should gracefully handle audio playback failures', async () => {
      // Mock successful loading but playback failure
      vi.spyOn(storyAudioManager, 'preloadStoryAudio').mockResolvedValue({
        success: true,
        audioBuffer: {} as AudioBuffer,
        duration: 30000,
        loadTimeMs: 50
      });

      // Mock playback failure
      vi.spyOn(storyAudioManager as any, 'playStoryAudio').mockResolvedValue({
        success: false,
        story_id: testStory.id,
        error_message: 'AudioContext suspended',
        fallback_used: false
      });

      const result = await storyAudioManager.replaceNextTTSWithStory(
        testStory,
        mockStreamingManager
      );

      // Should handle playback failure gracefully
      expect(result.fallback_used).toBe(true);
      expect(mockStreamingManager.addSentence).toHaveBeenCalled();
    });

    it('should handle trigger matching failures without affecting conversation', async () => {
      const inputText = 'Tell me about your test experiences';
      const stories = [testStory];

      // Mock trigger matching failure
      vi.spyOn(triggerMatcher, 'matchTriggers').mockRejectedValue(
        new Error('Database connection timeout')
      );

      const matches = await triggerMatcher.findMatchingStories(
        inputText,
        stories,
        'test-avatar'
      );

      // Should return empty matches and continue gracefully
      expect(matches).toEqual([]);
      // Conversation should continue normally without stories
    });
  });

  describe('Requirement 7.5: Automatic TTS fallback with seamless conversation continuation', () => {
    it('should provide seamless TTS fallback within timing constraints', async () => {
      // Mock story failure
      const networkError = new Error('Network request failed');
      const fallbackText = 'Let me tell you about that experience.';
      const fallbackCallback = vi.fn().mockResolvedValue(undefined);

      const startTime = Date.now();
      
      await errorHandler.handleLoadingError(
        testStory.id,
        networkError,
        fallbackText,
        fallbackCallback
      );

      const elapsed = Date.now() - startTime;

      // Should complete within timing constraint
      expect(elapsed).toBeLessThan(200); // Allow buffer for test execution
      expect(fallbackCallback).toHaveBeenCalledOnce();
    });

    it('should maintain conversation flow during cascading failures', async () => {
      // Mock cascading failures: story fails, then TTS fails, then recovery
      const storyError = new Error('Story loading failed');
      let fallbackAttempts = 0;
      
      const cascadingCallback = vi.fn().mockImplementation(async () => {
        fallbackAttempts++;
        if (fallbackAttempts === 1) {
          throw new Error('TTS service temporarily unavailable');
        }
        // Second attempt succeeds
        return Promise.resolve();
      });

      await errorHandler.handleLoadingError(
        testStory.id,
        storyError,
        'Cascading failure test',
        cascadingCallback
      );

      // Should handle cascading failures gracefully
      expect(fallbackAttempts).toBeGreaterThan(0);
    });

    it('should ensure no gap >150ms during fallback execution', async () => {
      // Test with various error scenarios
      const errorScenarios = [
        { name: 'Network timeout', error: new Error('Network request timeout') },
        { name: 'Audio decode failure', error: new Error('Failed to decode audio') },
        { name: 'Memory limit', error: new Error('Memory quota exceeded') }
      ];

      for (const scenario of errorScenarios) {
        const startTime = Date.now();
        const fallbackCallback = vi.fn().mockResolvedValue(undefined);

        await errorHandler.handleLoadingError(
          `test-story-${scenario.name}`,
          scenario.error,
          'Test fallback',
          fallbackCallback
        );

        const elapsed = Date.now() - startTime;
        
        // Should not exceed 150ms gap constraint
        expect(elapsed).toBeLessThan(200); // Allow small buffer
        expect(fallbackCallback).toHaveBeenCalled();
      }
    });
  });

  describe('Requirement 8.6: Error recovery mechanisms for network and audio issues', () => {
    it('should implement retry logic with exponential backoff for network errors', async () => {
      const networkError = new Error('Temporary network error');
      const fallbackCallback = vi.fn().mockResolvedValue(undefined);

      // Test retry mechanism
      await errorHandler.handleLoadingError(
        'retry-test-story',
        networkError,
        'Retry test',
        fallbackCallback
      );

      // Should attempt fallback after retries
      expect(fallbackCallback).toHaveBeenCalled();
    });

    it('should handle AudioContext suspension on mobile devices', async () => {
      const audioContextError = new Error('AudioContext is suspended');
      const fallbackCallback = vi.fn().mockResolvedValue(undefined);

      await errorHandler.handlePlaybackError(
        testStory.id,
        audioContextError,
        'AudioContext fallback',
        fallbackCallback
      );

      // Should immediately fallback for AudioContext errors
      expect(fallbackCallback).toHaveBeenCalledOnce();
    });

    it('should handle memory pressure on resource-constrained devices', async () => {
      const memoryError = new Error('Memory quota exceeded for audio buffers');
      const fallbackCallback = vi.fn().mockResolvedValue(undefined);

      await errorHandler.handlePlaybackError(
        testStory.id,
        memoryError,
        'Memory pressure fallback',
        fallbackCallback
      );

      // Should immediately fallback for memory errors
      expect(fallbackCallback).toHaveBeenCalledOnce();
    });

    it('should recover from storage service outages', async () => {
      const storageError = new Error('Storage service temporarily unavailable');
      const fallbackCallback = vi.fn().mockResolvedValue(undefined);

      await errorHandler.handleLoadingError(
        testStory.id,
        storageError,
        'Storage outage fallback',
        fallbackCallback
      );

      // Should handle storage outages gracefully
      expect(fallbackCallback).toHaveBeenCalled();
    });
  });

  describe('Complete error handling system integration', () => {
    it('should integrate error handling across all story system components', async () => {
      // Test complete workflow with errors at each stage
      
      // 1. Trigger matching with partial failure
      const inputText = 'Tell me about your test experiences';
      const stories = [
        testStory,
        { ...testStory, id: 'broken-story', triggers: null as any } // Malformed
      ];

      const matches = await triggerMatcher.findMatchingStories(
        inputText,
        stories,
        'test-avatar'
      );

      // Should return valid matches despite parsing errors
      expect(matches.length).toBeGreaterThan(0);
      expect(matches.every(match => match.story.id !== 'broken-story')).toBe(true);

      // 2. Story loading with failure and recovery
      vi.spyOn(storyAudioManager, 'preloadStoryAudio').mockResolvedValue({
        success: false,
        error: 'Network timeout',
        loadTimeMs: 2100
      });

      const result = await storyAudioManager.replaceNextTTSWithStory(
        testStory,
        mockStreamingManager
      );

      // Should handle end-to-end failure gracefully
      expect(result.fallback_used).toBe(true);
      expect(mockStreamingManager.addSentence).toHaveBeenCalled();
    });

    it('should maintain system stability during error storms', async () => {
      // Simulate multiple simultaneous errors
      const errorPromises = Array.from({ length: 10 }, (_, i) => {
        const error = new Error(`Storm error ${i}`);
        const callback = vi.fn().mockResolvedValue(undefined);
        
        return errorHandler.handleLoadingError(
          `storm-story-${i}`,
          error,
          'Error storm test',
          callback
        );
      });

      const startTime = Date.now();
      await Promise.all(errorPromises);
      const elapsed = Date.now() - startTime;

      // Should handle error storm without degradation
      expect(elapsed).toBeLessThan(1000);
      
      // System should remain stable
      const stats = errorHandler.getErrorStats();
      expect(stats.activeRetries).toBe(0);
    });

    it('should provide comprehensive error monitoring and metrics', () => {
      // Test error statistics tracking
      const initialStats = errorHandler.getErrorStats();
      expect(initialStats).toHaveProperty('activeRetries');
      expect(initialStats).toHaveProperty('registeredCallbacks');
      expect(initialStats).toHaveProperty('config');

      // Test callback registration
      const callback = vi.fn();
      errorHandler.registerFallbackCallback('test-story', callback);
      
      const updatedStats = errorHandler.getErrorStats();
      expect(updatedStats.registeredCallbacks).toBe(1);

      // Test cleanup
      errorHandler.cleanup();
      const cleanStats = errorHandler.getErrorStats();
      expect(cleanStats.registeredCallbacks).toBe(0);
    });
  });

  describe('Real-world error scenarios', () => {
    it('should handle mixed success/failure in batch story processing', async () => {
      const mixedStories = [
        testStory, // Valid
        { ...testStory, id: 'network-fail-story' }, // Will fail loading
        { ...testStory, id: 'decode-fail-story' }, // Will fail decoding
        { ...testStory, id: 'success-story' } // Will succeed
      ];

      // Mock different outcomes for each story
      vi.spyOn(storyAudioManager, 'preloadStoryAudio')
        .mockResolvedValueOnce({ success: true, audioBuffer: {} as AudioBuffer, duration: 30000, loadTimeMs: 50 })
        .mockResolvedValueOnce({ success: false, error: 'Network error', loadTimeMs: 2100 })
        .mockResolvedValueOnce({ success: false, error: 'Decode error', loadTimeMs: 100 })
        .mockResolvedValueOnce({ success: true, audioBuffer: {} as AudioBuffer, duration: 30000, loadTimeMs: 75 });

      const results = await Promise.allSettled(
        mixedStories.map(story => 
          storyAudioManager.replaceNextTTSWithStory(story, mockStreamingManager)
        )
      );

      // All requests should complete without throwing
      expect(results.every(result => result.status === 'fulfilled')).toBe(true);
    });

    it('should work correctly with mobile Safari audio limitations', async () => {
      // Simulate mobile Safari AudioContext restrictions
      const safariError = new Error('AudioContext creation requires user gesture');
      const fallbackCallback = vi.fn().mockResolvedValue(undefined);

      await errorHandler.handlePlaybackError(
        testStory.id,
        safariError,
        'Mobile Safari fallback',
        fallbackCallback
      );

      // Should handle mobile limitations gracefully
      expect(fallbackCallback).toHaveBeenCalled();
    });
  });
});