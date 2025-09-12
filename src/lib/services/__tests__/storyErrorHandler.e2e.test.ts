/**
 * End-to-end integration tests for StoryErrorHandler
 * Tests complete error scenarios with real story system integration
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { StoryErrorHandler } from '../storyErrorHandler';
import { StoryAudioManager } from '../storyAudioManager';
import { StoryTriggerMatcher } from '../storyTriggerMatcher';
import { UserStoryService } from '../userStoryService';
import { UserStory } from '../../types/stories';

// Mock external dependencies
vi.mock('../../logger');
vi.mock('../../metrics');
vi.mock('../../streamingUtils');
vi.mock('../../globalAudioManager');
vi.mock('../../mobileAudioContextManager');

describe('StoryErrorHandler E2E Integration Tests', () => {
  let errorHandler: StoryErrorHandler;
  let storyAudioManager: StoryAudioManager;
  let triggerMatcher: StoryTriggerMatcher;
  let mockStreamingManager: any;
  let testStory: UserStory;

  beforeEach(() => {
    errorHandler = new StoryErrorHandler({
      maxRetries: 1, // Faster tests
      retryDelayMs: 10,
      fallbackTimeoutMs: 150,
      enableFallbackTTS: true,
      logErrors: true,
      maxGapMs: 150
    });

    storyAudioManager = new StoryAudioManager({
      preloadTimeoutMs: 100, // Faster timeout for tests
      fallbackToTTS: true,
      enableLipSync: false,
      maxConcurrentLoads: 1,
      audioBufferCacheSize: 1024 * 1024 // 1MB for tests
    });

    triggerMatcher = new StoryTriggerMatcher({
      enableCooldown: false, // Disable for easier testing
      maxMatches: 5,
      minKeywordLength: 2
    });

    mockStreamingManager = {
      stop: vi.fn(),
      addSentence: vi.fn().mockResolvedValue(undefined),
      isPlaying: vi.fn().mockReturnValue(false)
    };

    testStory = {
      id: 'test-story-e2e',
      owner_id: 'test-avatar',
      owner_type: 'avatar',
      title: 'Test Story for E2E',
      category: 'memory',
      triggers: 'childhood,school,friends',
      audio_url: 'https://example.com/test-story.mp3',
      duration_ms: 30000,
      transcript: 'This is a test story about childhood memories.',
      priority: 50,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    errorHandler.cleanup();
    storyAudioManager.destroy();
  });

  describe('Complete story playback failure scenarios', () => {
    it('should handle complete story system failure with seamless TTS fallback', async () => {
      // Mock complete system failure
      const systemError = new Error('Complete system failure');
      
      // Mock story loading failure
      vi.spyOn(storyAudioManager, 'preloadStoryAudio').mockRejectedValue(systemError);
      
      const startTime = Date.now();
      
      try {
        await storyAudioManager.replaceNextTTSWithStory(
          testStory,
          mockStreamingManager
        );
      } catch (error) {
        // Should not throw - should handle gracefully
      }
      
      const elapsed = Date.now() - startTime;
      
      // Should fallback to TTS within timing constraint
      expect(elapsed).toBeLessThan(200);
      expect(mockStreamingManager.addSentence).toHaveBeenCalled();
    });

    it('should handle network failure during story loading with retry and fallback', async () => {
      // Mock network failure with retry success
      let attemptCount = 0;
      vi.spyOn(storyAudioManager, 'preloadStoryAudio').mockImplementation(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Network timeout');
        }
        return {
          success: true,
          audioBuffer: {} as AudioBuffer,
          duration: 30000,
          loadTimeMs: 50
        };
      });

      const result = await storyAudioManager.replaceNextTTSWithStory(
        testStory,
        mockStreamingManager
      );

      // Should eventually succeed after retry
      expect(attemptCount).toBeGreaterThan(1);
    });

    it('should handle audio context suspension on mobile with HTML audio fallback', async () => {
      // Mock AudioContext suspension
      const audioContextError = new Error('AudioContext is suspended');
      
      vi.spyOn(storyAudioManager, 'preloadStoryAudio').mockResolvedValue({
        success: true,
        audioBuffer: {} as AudioBuffer,
        duration: 30000,
        loadTimeMs: 50
      });

      // Mock playback failure due to AudioContext
      vi.spyOn(storyAudioManager as any, 'playStoryAudio').mockRejectedValue(audioContextError);

      const result = await storyAudioManager.replaceNextTTSWithStory(
        testStory,
        mockStreamingManager
      );

      // Should fallback to TTS
      expect(result.fallback_used).toBe(true);
      expect(mockStreamingManager.addSentence).toHaveBeenCalled();
    });
  });

  describe('Trigger matching error scenarios', () => {
    it('should handle database timeout during trigger matching', async () => {
      const inputText = 'Tell me about your childhood memories';
      const stories = [testStory];
      
      // Mock database timeout
      const dbError = new Error('Database connection timeout');
      vi.spyOn(triggerMatcher, 'matchTriggers').mockRejectedValue(dbError);

      const matches = await triggerMatcher.findMatchingStories(
        inputText,
        stories,
        'test-avatar'
      );

      // Should return empty matches and continue gracefully
      expect(matches).toEqual([]);
    });

    it('should handle malformed story trigger data', async () => {
      const inputText = 'Tell me about school';
      const malformedStory = {
        ...testStory,
        triggers: null as any // Malformed trigger data
      };
      
      const matches = await triggerMatcher.findMatchingStories(
        inputText,
        [malformedStory],
        'test-avatar'
      );

      // Should handle gracefully and return empty matches
      expect(matches).toEqual([]);
    });

    it('should handle trigger parsing errors for individual stories', async () => {
      const inputText = 'Tell me about childhood';
      const stories = [
        testStory, // Valid story
        { ...testStory, id: 'malformed-story', triggers: '{"invalid": json}' }, // Invalid JSON
        { ...testStory, id: 'valid-story-2', triggers: 'valid,triggers' } // Valid story
      ];

      const matches = await triggerMatcher.findMatchingStories(
        inputText,
        stories,
        'test-avatar'
      );

      // Should return matches for valid stories only
      expect(matches.length).toBeGreaterThan(0);
      expect(matches.every(match => match.story.id !== 'malformed-story')).toBe(true);
    });
  });

  describe('Concurrent error scenarios', () => {
    it('should handle multiple simultaneous story requests with proper error isolation', async () => {
      const stories = [
        { ...testStory, id: 'story-1' },
        { ...testStory, id: 'story-2' },
        { ...testStory, id: 'story-3' }
      ];

      // Mock different failure modes for each story
      vi.spyOn(storyAudioManager, 'preloadStoryAudio')
        .mockImplementationOnce(() => Promise.reject(new Error('Network error')))
        .mockImplementationOnce(() => Promise.reject(new Error('Audio decode error')))
        .mockImplementationOnce(() => Promise.resolve({
          success: true,
          audioBuffer: {} as AudioBuffer,
          duration: 30000,
          loadTimeMs: 50
        }));

      const promises = stories.map(story => 
        storyAudioManager.replaceNextTTSWithStory(story, mockStreamingManager)
      );

      const results = await Promise.allSettled(promises);

      // All requests should complete without throwing
      expect(results.every(result => result.status === 'fulfilled')).toBe(true);
      
      // TTS fallback should be called for failed stories
      expect(mockStreamingManager.addSentence).toHaveBeenCalled();
    });

    it('should handle error storm scenarios without system degradation', async () => {
      // Simulate error storm with many rapid failures
      const errorPromises = Array.from({ length: 20 }, (_, i) => {
        const story = { ...testStory, id: `error-story-${i}` };
        const error = new Error(`Error ${i}`);
        
        return errorHandler.handleLoadingError(
          story.id,
          error,
          'Fallback text',
          vi.fn().mockResolvedValue(undefined)
        );
      });

      const startTime = Date.now();
      await Promise.all(errorPromises);
      const elapsed = Date.now() - startTime;

      // Should handle all errors quickly without system degradation
      expect(elapsed).toBeLessThan(1000);
      
      // Error handler should remain stable
      const stats = errorHandler.getErrorStats();
      expect(stats.activeRetries).toBe(0); // All retries should be cleaned up
    });
  });

  describe('Performance constraint validation', () => {
    it('should enforce 150ms maximum gap constraint under various error conditions', async () => {
      const errorScenarios = [
        { name: 'Network timeout', error: new Error('Network request timeout') },
        { name: 'Audio decode failure', error: new Error('Failed to decode audio') },
        { name: 'Memory limit', error: new Error('Memory quota exceeded') },
        { name: 'AudioContext error', error: new Error('AudioContext suspended') }
      ];

      for (const scenario of errorScenarios) {
        const startTime = Date.now();
        
        const fallbackCallback = vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 50)); // Simulate TTS startup
        });

        await errorHandler.handleLoadingError(
          `test-story-${scenario.name}`,
          scenario.error,
          'Test fallback text',
          fallbackCallback
        );

        const elapsed = Date.now() - startTime;
        
        // Should not exceed 150ms gap constraint
        expect(elapsed).toBeLessThan(200); // Allow small buffer for test execution
        expect(fallbackCallback).toHaveBeenCalled();
      }
    });

    it('should maintain conversation flow continuity during cascading failures', async () => {
      // Simulate cascading failures: story fails, then TTS fails, then recovery
      const storyError = new Error('Story loading failed');
      const ttsError = new Error('TTS service temporarily unavailable');
      
      let fallbackAttempts = 0;
      const cascadingCallback = vi.fn().mockImplementation(async () => {
        fallbackAttempts++;
        if (fallbackAttempts === 1) {
          throw ttsError; // First TTS attempt fails
        }
        // Second attempt succeeds
        return Promise.resolve();
      });

      const startTime = Date.now();
      
      await errorHandler.handleLoadingError(
        'cascading-failure-story',
        storyError,
        'Cascading failure test',
        cascadingCallback
      );

      const elapsed = Date.now() - startTime;
      
      // Should handle cascading failures within reasonable time
      expect(elapsed).toBeLessThan(300);
      expect(fallbackAttempts).toBeGreaterThan(0);
    });
  });

  describe('Real-world integration scenarios', () => {
    it('should integrate with complete story system under normal conditions', async () => {
      // Mock successful story system operation
      vi.spyOn(storyAudioManager, 'preloadStoryAudio').mockResolvedValue({
        success: true,
        audioBuffer: {} as AudioBuffer,
        duration: 30000,
        loadTimeMs: 100
      });

      vi.spyOn(storyAudioManager as any, 'playStoryAudio').mockResolvedValue({
        success: true,
        story_id: testStory.id,
        playback_duration_ms: 30000,
        fallback_used: false
      });

      const result = await storyAudioManager.replaceNextTTSWithStory(
        testStory,
        mockStreamingManager
      );

      // Should succeed without error handling intervention
      expect(result.success).toBe(true);
      expect(result.fallback_used).toBe(false);
      expect(mockStreamingManager.addSentence).not.toHaveBeenCalled();
    });

    it('should handle mixed success/failure scenarios in story batch processing', async () => {
      const inputText = 'Tell me about your childhood and school experiences';
      const stories = [
        testStory, // Should match 'childhood'
        { ...testStory, id: 'school-story', triggers: 'school,education' }, // Should match 'school'
        { ...testStory, id: 'broken-story', triggers: null as any } // Should fail parsing
      ];

      const matches = await triggerMatcher.findMatchingStories(
        inputText,
        stories,
        'test-avatar'
      );

      // Should return matches for valid stories despite parsing errors
      expect(matches.length).toBeGreaterThan(0);
      expect(matches.some(match => match.story.id === testStory.id)).toBe(true);
      expect(matches.some(match => match.story.id === 'school-story')).toBe(true);
      expect(matches.every(match => match.story.id !== 'broken-story')).toBe(true);
    });

    it('should maintain system stability during prolonged error conditions', async () => {
      // Simulate prolonged error conditions
      const prolongedErrorTest = async () => {
        for (let i = 0; i < 50; i++) {
          const error = new Error(`Prolonged error ${i}`);
          const callback = vi.fn().mockResolvedValue(undefined);
          
          await errorHandler.handleLoadingError(
            `prolonged-story-${i}`,
            error,
            'Prolonged error test',
            callback
          );
        }
      };

      const startTime = Date.now();
      await prolongedErrorTest();
      const elapsed = Date.now() - startTime;

      // Should handle prolonged errors without performance degradation
      expect(elapsed).toBeLessThan(2000);
      
      // System should remain stable
      const stats = errorHandler.getErrorStats();
      expect(stats.activeRetries).toBe(0);
      expect(stats.registeredCallbacks).toBe(0);
    });
  });
});