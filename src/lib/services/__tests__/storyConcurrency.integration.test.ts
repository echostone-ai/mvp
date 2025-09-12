/**
 * Task 13: Story Concurrency Integration Tests
 * 
 * End-to-end tests for concurrent story trigger scenarios:
 * - Multiple rapid triggers during active playback
 * - Queue processing with real timing
 * - Concurrency behavior under load
 * - Performance monitoring for queued stories
 * 
 * Requirements: 3.6, 4.6
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StoryAudioManager } from '../storyAudioManager';
import { StoryTriggerMatcher } from '../storyTriggerMatcher';
import { UserStory } from '../../types/stories';
import { StreamingAudioManager } from '../../streamingUtils';

// Mock dependencies with more realistic behavior
vi.mock('../../globalAudioManager', () => ({
  globalAudioManager: {
    stopAll: vi.fn().mockResolvedValue(undefined),
    playAudio: vi.fn().mockImplementation((audio) => {
      // Simulate realistic audio playback timing
      return new Promise((resolve) => {
        setTimeout(() => {
          if (audio.onended) audio.onended();
          resolve(undefined);
        }, 100); // 100ms simulated playback
      });
    }),
    createOptimizedAudio: vi.fn().mockImplementation((src) => ({
      src,
      volume: 1.0,
      preload: 'auto',
      playsInline: true,
      muted: false,
      onended: null as any,
      onerror: null as any,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      currentTime: 0
    }))
  }
}));

vi.mock('../../mobileAudioContextManager', () => ({
  mobileAudioContextManager: {
    ensureReady: vi.fn().mockResolvedValue(true),
    getAudioContext: vi.fn().mockReturnValue({
      state: 'running',
      sampleRate: 44100,
      currentTime: 0,
      resume: vi.fn().mockResolvedValue(undefined),
      decodeAudioData: vi.fn().mockResolvedValue({
        duration: 3.5,
        length: 154000,
        numberOfChannels: 2,
        sampleRate: 44100
      }),
      createBufferSource: vi.fn().mockReturnValue({
        buffer: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn().mockImplementation(function() {
          // Simulate realistic audio completion
          setTimeout(() => {
            if (this.onended) this.onended();
          }, 150); // 150ms simulated audio
        }),
        onended: null as any
      }),
      createGain: vi.fn().mockReturnValue({
        gain: {
          value: 1.0,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn()
        },
        connect: vi.fn(),
        disconnect: vi.fn()
      }),
      destination: {}
    }),
    createOptimizedBuffer: vi.fn().mockResolvedValue({
      duration: 3.5,
      length: 154000,
      numberOfChannels: 2,
      sampleRate: 44100
    })
  },
  isMobileSafari: vi.fn().mockReturnValue(false)
}));

vi.mock('../storyErrorHandler', () => ({
  storyErrorHandler: {
    handleLoadingError: vi.fn().mockResolvedValue(undefined),
    handlePlaybackError: vi.fn().mockResolvedValue(undefined),
    registerFallbackCallback: vi.fn()
  },
  StoryErrorHandler: vi.fn().mockImplementation(() => ({
    handleLoadingError: vi.fn().mockResolvedValue(undefined),
    handlePlaybackError: vi.fn().mockResolvedValue(undefined),
    registerFallbackCallback: vi.fn()
  }))
}));

// Mock metrics with tracking
const mockMetrics = {
  trackStorySelection: vi.fn(),
  trackStoryQueued: vi.fn(),
  trackStoryReplaced: vi.fn(),
  trackStoryExpired: vi.fn(),
  trackQueueProcessing: vi.fn(),
  trackStoryStart: vi.fn(),
  trackStoryPlaySuccess: vi.fn(),
  trackStoryPlayFailure: vi.fn(),
  trackStoryMatching: vi.fn(),
  trackSystemOverhead: vi.fn()
};

vi.mock('../storyMetrics', () => ({
  default: {
    getInstance: () => mockMetrics
  }
}));

vi.mock('../mobileStoryResourceManager', () => ({
  globalMobileStoryResourceManager: {
    canPreloadStory: vi.fn().mockReturnValue({ shouldPreload: true, reason: 'test' }),
    requestStoryPreload: vi.fn().mockResolvedValue(undefined),
    getPreloadedBuffer: vi.fn().mockReturnValue(null)
  }
}));

// Mock fetch for audio loading
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
});

// Test data
const createTestStory = (id: string, title: string, triggers: string, category: string = 'memory'): UserStory => ({
  id,
  owner_id: 'test-avatar-1',
  owner_type: 'avatar',
  title,
  category: category as any,
  triggers,
  audio_url: `https://example.com/story-${id}.mp3`,
  duration_ms: 3500,
  transcript: `Test transcript for ${title}`,
  priority: 50,
  status: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});

const createMockStreamingManager = (): StreamingAudioManager => ({
  stop: vi.fn(),
  addSentence: vi.fn().mockResolvedValue(undefined)
} as any);

describe('Story Concurrency Integration Tests', () => {
  let storyManager: StoryAudioManager;
  let triggerMatcher: StoryTriggerMatcher;
  let mockStreamingManager: StreamingAudioManager;
  let testStories: UserStory[];

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Create test instances
    storyManager = new StoryAudioManager({
      preloadTimeoutMs: 1000, // Shorter for tests
      fallbackToTTS: true,
      enableLipSync: false,
      maxConcurrentLoads: 1
    });

    triggerMatcher = new StoryTriggerMatcher({
      enableCooldown: true,
      cooldownMs: 5000, // 5 seconds for tests
      maxMatches: 5
    });

    mockStreamingManager = createMockStreamingManager();

    // Create test stories with different triggers
    testStories = [
      createTestStory('story-1', 'Family Memory', 'family,childhood,parents', 'memory'),
      createTestStory('story-2', 'Travel Adventure', 'travel,adventure,journey', 'experience'),
      createTestStory('story-3', 'Career Advice', 'career,work,job', 'advice'),
      createTestStory('story-4', 'Funny Incident', 'funny,humor,laugh', 'anecdote'),
      createTestStory('story-5', 'Learning Experience', 'learning,education,school', 'experience')
    ];

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 10));
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Concurrent Trigger Scenarios', () => {
    it('should handle rapid successive triggers correctly', async () => {
      const triggerTexts = [
        'Tell me about your family',
        'What about travel adventures?',
        'Any career advice?'
      ];

      const expectedStories = [
        testStories[0], // family trigger
        testStories[1], // travel trigger  
        testStories[2]  // career trigger
      ];

      // Find matching stories for each trigger
      const matches = await Promise.all(
        triggerTexts.map(text => 
          triggerMatcher.findMatchingStories(text, testStories, 'test-avatar-1')
        )
      );

      // Verify matches found
      expect(matches[0]).toHaveLength(1);
      expect(matches[0][0].story.id).toBe(expectedStories[0].id);
      expect(matches[1]).toHaveLength(1);
      expect(matches[1][0].story.id).toBe(expectedStories[1].id);
      expect(matches[2]).toHaveLength(1);
      expect(matches[2][0].story.id).toBe(expectedStories[2].id);

      // Trigger stories in rapid succession
      const results = await Promise.all([
        storyManager.replaceNextTTSWithStory(expectedStories[0], mockStreamingManager),
        storyManager.replaceNextTTSWithStory(expectedStories[1], mockStreamingManager),
        storyManager.replaceNextTTSWithStory(expectedStories[2], mockStreamingManager)
      ]);

      // First story should play
      expect(results[0].success).toBe(true);
      expect(results[0].error_message).toBeUndefined();

      // Second and third should be queued/replaced
      expect(results[1].success).toBe(true);
      expect(results[1].error_message).toBe('Story queued for playback');
      expect(results[2].success).toBe(true);
      expect(results[2].error_message).toBe('Story queued for playback');

      // Only the last story should be in queue
      const queueStatus = storyManager.getQueueStatus();
      expect(queueStatus.hasQueue).toBe(true);
      expect(queueStatus.queuedStoryId).toBe(expectedStories[2].id);

      // Verify metrics were tracked
      expect(mockMetrics.trackStoryQueued).toHaveBeenCalledTimes(2);
      expect(mockMetrics.trackStoryReplaced).toHaveBeenCalledTimes(1);
    });

    it('should process queue after story completion', async () => {
      vi.useFakeTimers();

      // Trigger first story
      const firstResult = await storyManager.replaceNextTTSWithStory(
        testStories[0],
        mockStreamingManager
      );
      expect(firstResult.success).toBe(true);

      // Queue second story
      const secondResult = await storyManager.replaceNextTTSWithStory(
        testStories[1],
        mockStreamingManager
      );
      expect(secondResult.success).toBe(true);
      expect(secondResult.error_message).toBe('Story queued for playback');

      // Verify queue exists
      expect(storyManager.getQueueStatus().hasQueue).toBe(true);

      // Wait for first story to complete and queue processing
      vi.advanceTimersByTime(200); // Allow audio to complete
      await vi.runAllTimersAsync();

      // Verify queue was processed
      expect(storyManager.getQueueStatus().hasQueue).toBe(false);
      expect(mockMetrics.trackQueueProcessing).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should handle queue expiration correctly', async () => {
      vi.useFakeTimers();

      // Start long-running story
      const mockAudioContext = (storyManager as any).audioContext;
      const originalCreateBufferSource = mockAudioContext.createBufferSource;
      
      mockAudioContext.createBufferSource = vi.fn().mockReturnValue({
        buffer: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(), // Don't auto-complete
        onended: null as any
      });

      // Start first story (won't complete)
      await storyManager.replaceNextTTSWithStory(testStories[0], mockStreamingManager);

      // Queue second story
      await storyManager.replaceNextTTSWithStory(testStories[1], mockStreamingManager);

      // Verify story is queued
      expect(storyManager.getQueueStatus().hasQueue).toBe(true);

      // Advance time beyond queue expiration (10+ seconds)
      vi.advanceTimersByTime(11000);

      // Restore original behavior and complete first story
      mockAudioContext.createBufferSource = originalCreateBufferSource;
      
      // Manually trigger queue processing by simulating story completion
      await (storyManager as any).processQueuedStory();

      // Verify expired story was removed
      expect(storyManager.getQueueStatus().hasQueue).toBe(false);
      expect(mockMetrics.trackStoryExpired).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance with multiple concurrent triggers', async () => {
      const startTime = Date.now();
      const numTriggers = 10;
      
      // Create multiple rapid triggers
      const triggerPromises = Array.from({ length: numTriggers }, (_, i) => 
        storyManager.replaceNextTTSWithStory(
          testStories[i % testStories.length],
          mockStreamingManager
        )
      );

      const results = await Promise.all(triggerPromises);
      const totalTime = Date.now() - startTime;

      // Verify all triggers were handled
      expect(results).toHaveLength(numTriggers);
      
      // First should play, others should be queued/ignored
      expect(results[0].success).toBe(true);
      
      // Performance should be reasonable (< 100ms per trigger)
      expect(totalTime).toBeLessThan(numTriggers * 100);

      // Should never have more than 1 queued story
      const queueStatus = storyManager.getQueueStatus();
      expect(queueStatus.hasQueue).toBe(true); // Last trigger should be queued
    });

    it('should track system overhead correctly', async () => {
      const triggerText = 'Tell me about your family';
      
      // Perform trigger matching
      await triggerMatcher.findMatchingStories(triggerText, testStories, 'test-avatar-1');

      // Verify overhead tracking was called
      expect(mockMetrics.trackSystemOverhead).toHaveBeenCalledWith(
        'trigger_matching',
        expect.any(Number)
      );
    });
  });

  describe('Error Recovery in Concurrent Scenarios', () => {
    it('should handle errors during queue processing gracefully', async () => {
      vi.useFakeTimers();

      // Mock preload to fail for queued story
      const originalPreload = storyManager.preloadStoryAudio;
      storyManager.preloadStoryAudio = vi.fn().mockImplementation((story) => {
        if (story.id === testStories[1].id) {
          return Promise.resolve({
            success: false,
            error: 'Network error'
          });
        }
        return originalPreload.call(storyManager, story);
      });

      // Start first story
      await storyManager.replaceNextTTSWithStory(testStories[0], mockStreamingManager);

      // Queue second story (will fail)
      await storyManager.replaceNextTTSWithStory(testStories[1], mockStreamingManager);

      // Wait for first story completion and queue processing
      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();

      // Verify system recovered gracefully
      expect(storyManager.getQueueStatus().hasQueue).toBe(false);
      expect(storyManager.isPlaying()).toBe(false);

      vi.useRealTimers();
    });

    it('should handle concurrent stop operations', async () => {
      // Start story
      await storyManager.replaceNextTTSWithStory(testStories[0], mockStreamingManager);

      // Queue another story
      await storyManager.replaceNextTTSWithStory(testStories[1], mockStreamingManager);

      // Verify both playing and queued
      expect(storyManager.isPlaying()).toBe(true);
      expect(storyManager.getQueueStatus().hasQueue).toBe(true);

      // Stop everything
      await storyManager.stopCurrentStory();

      // Verify clean state
      expect(storyManager.isPlaying()).toBe(false);
      expect(storyManager.getQueueStatus().hasQueue).toBe(false);
    });
  });

  describe('Cooldown Integration with Queue', () => {
    it('should respect cooldown when processing queue', async () => {
      vi.useFakeTimers();

      // Complete first story to start cooldown
      const firstResult = await storyManager.replaceNextTTSWithStory(
        testStories[0],
        mockStreamingManager
      );
      expect(firstResult.success).toBe(true);

      // Wait for story completion
      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();

      // Try to trigger another story (should be blocked by cooldown)
      const secondResult = await storyManager.replaceNextTTSWithStory(
        testStories[1],
        mockStreamingManager
      );

      expect(secondResult.success).toBe(false);
      expect(secondResult.error_message).toContain('cooldown');

      vi.useRealTimers();
    });

    it('should allow queue for different avatars during cooldown', async () => {
      // Complete story for first avatar
      const firstResult = await storyManager.replaceNextTTSWithStory(
        testStories[0],
        mockStreamingManager
      );
      expect(firstResult.success).toBe(true);

      // Create story for different avatar
      const differentAvatarStory = {
        ...testStories[1],
        owner_id: 'different-avatar'
      };

      // Should work for different avatar (no cooldown)
      const secondResult = await storyManager.replaceNextTTSWithStory(
        differentAvatarStory,
        mockStreamingManager
      );

      expect(secondResult.success).toBe(true);
    });
  });

  describe('Logging and Monitoring', () => {
    it('should log concurrency decisions appropriately', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Start first story
      await storyManager.replaceNextTTSWithStory(testStories[0], mockStreamingManager);

      // Queue second story (should log)
      await storyManager.replaceNextTTSWithStory(testStories[1], mockStreamingManager);

      // Replace queued story (should log)
      await storyManager.replaceNextTTSWithStory(testStories[2], mockStreamingManager);

      // Verify appropriate logging occurred
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('queueing new story')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Replacing queued story')
      );

      consoleSpy.mockRestore();
    });

    it('should provide accurate queue status information', async () => {
      // Initially no queue
      expect(storyManager.getQueueStatus().hasQueue).toBe(false);

      // Start story
      await storyManager.replaceNextTTSWithStory(testStories[0], mockStreamingManager);

      // Queue story
      await storyManager.replaceNextTTSWithStory(testStories[1], mockStreamingManager);

      // Check queue status
      const queueStatus = storyManager.getQueueStatus();
      expect(queueStatus.hasQueue).toBe(true);
      expect(queueStatus.queuedStoryId).toBe(testStories[1].id);
      expect(queueStatus.queueAge).toBeGreaterThan(0);

      // Check story info
      const storyInfo = storyManager.getCurrentStoryInfo();
      expect(storyInfo.storyId).toBe(testStories[0].id);
      expect(storyInfo.queuedStoryId).toBe(testStories[1].id);
      expect(storyInfo.queueAge).toBeGreaterThan(0);
    });
  });
});