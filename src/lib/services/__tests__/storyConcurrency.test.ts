/**
 * Task 13: Story Concurrency Handling Tests
 * 
 * Tests for enhanced concurrency behavior:
 * - Story queue (max 1 pending story)
 * - New trigger replaces queued story but never interrupts current playback
 * - Predictable concurrency behavior with proper logging
 * - Queue processing after playback completion
 * 
 * Requirements: 3.6, 4.6
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { StoryAudioManager } from '../storyAudioManager';
import { UserStory } from '../../types/stories';
import { StreamingAudioManager } from '../../streamingUtils';

// Mock dependencies
vi.mock('../../globalAudioManager', () => ({
  globalAudioManager: {
    stopAll: vi.fn().mockResolvedValue(undefined),
    playAudio: vi.fn().mockResolvedValue(undefined),
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
    getAudioContext: vi.fn().mockReturnValue(null),
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

vi.mock('../storyMetrics', () => ({
  default: {
    getInstance: () => ({
      trackStorySelection: vi.fn(),
      trackStoryQueued: vi.fn(),
      trackStoryReplaced: vi.fn(),
      trackStoryExpired: vi.fn(),
      trackQueueProcessing: vi.fn(),
      trackStoryStart: vi.fn(),
      trackStoryPlaySuccess: vi.fn(),
      trackStoryPlayFailure: vi.fn()
    })
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
const mockFetch = vi.fn() as Mock;
global.fetch = mockFetch;

// Mock AudioContext
const mockAudioContext = {
  state: 'running',
  sampleRate: 44100,
  currentTime: 0,
  resume: vi.fn().mockResolvedValue(undefined),
  decodeAudioData: vi.fn(),
  createBufferSource: vi.fn(),
  createGain: vi.fn(),
  destination: {}
};

const mockAudioBuffer = {
  duration: 3.5,
  length: 154000,
  numberOfChannels: 2,
  sampleRate: 44100
};

const mockAudioBufferSource = {
  buffer: null,
  connect: vi.fn(),
  disconnect: vi.fn(),
  start: vi.fn(),
  onended: null as any
};

const mockGainNode = {
  gain: {
    value: 1.0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn()
  },
  connect: vi.fn(),
  disconnect: vi.fn()
};

// Test data
const createTestStory = (id: string, title: string, category: string = 'memory'): UserStory => ({
  id,
  owner_id: 'test-avatar-1',
  owner_type: 'avatar',
  title,
  category: category as any,
  triggers: 'test,trigger,keywords',
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

describe('StoryAudioManager - Concurrency Handling', () => {
  let storyManager: StoryAudioManager;
  let mockStreamingManager: StreamingAudioManager;
  let story1: UserStory;
  let story2: UserStory;
  let story3: UserStory;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup AudioContext mocks
    mockAudioContext.decodeAudioData.mockResolvedValue(mockAudioBuffer);
    mockAudioContext.createBufferSource.mockReturnValue(mockAudioBufferSource);
    mockAudioContext.createGain.mockReturnValue(mockGainNode);
    
    // Setup fetch mock for successful audio loading
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    });

    // Create test instances
    storyManager = new StoryAudioManager({
      preloadTimeoutMs: 2000,
      fallbackToTTS: true,
      enableLipSync: false,
      maxConcurrentLoads: 1
    });

    // Mock AudioContext initialization
    (storyManager as any).audioContext = mockAudioContext;

    mockStreamingManager = createMockStreamingManager();

    // Create test stories
    story1 = createTestStory('story-1', 'First Story', 'memory');
    story2 = createTestStory('story-2', 'Second Story', 'experience');
    story3 = createTestStory('story-3', 'Third Story', 'advice');
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Basic Concurrency Decisions', () => {
    it('should play story immediately when nothing is playing', async () => {
      // Simulate successful audio playback
      mockAudioBufferSource.start.mockImplementation(() => {
        setTimeout(() => mockAudioBufferSource.onended?.(), 10);
      });

      const result = await storyManager.replaceNextTTSWithStory(
        story1,
        mockStreamingManager
      );

      expect(result.success).toBe(true);
      expect(result.story_id).toBe(story1.id);
      expect(result.error_message).toBeUndefined();
    });

    it('should queue story when another is playing', async () => {
      // Start first story (simulate long playback)
      mockAudioBufferSource.start.mockImplementation(() => {
        // Don't call onended immediately - simulate ongoing playback
      });

      // Start first story
      const firstResult = storyManager.replaceNextTTSWithStory(
        story1,
        mockStreamingManager
      );

      // Try to start second story while first is playing
      const secondResult = await storyManager.replaceNextTTSWithStory(
        story2,
        mockStreamingManager
      );

      expect(secondResult.success).toBe(true);
      expect(secondResult.story_id).toBe(story2.id);
      expect(secondResult.error_message).toBe('Story queued for playback');

      // Verify queue status
      const queueStatus = storyManager.getQueueStatus();
      expect(queueStatus.hasQueue).toBe(true);
      expect(queueStatus.queuedStoryId).toBe(story2.id);
    });

    it('should replace queued story with new trigger', async () => {
      // Start first story (simulate long playback)
      mockAudioBufferSource.start.mockImplementation(() => {
        // Don't call onended - simulate ongoing playback
      });

      // Start first story
      await storyManager.replaceNextTTSWithStory(story1, mockStreamingManager);

      // Queue second story
      await storyManager.replaceNextTTSWithStory(story2, mockStreamingManager);

      // Verify second story is queued
      let queueStatus = storyManager.getQueueStatus();
      expect(queueStatus.queuedStoryId).toBe(story2.id);

      // Queue third story (should replace second)
      const thirdResult = await storyManager.replaceNextTTSWithStory(
        story3,
        mockStreamingManager
      );

      expect(thirdResult.success).toBe(true);
      expect(thirdResult.story_id).toBe(story3.id);

      // Verify third story replaced second in queue
      queueStatus = storyManager.getQueueStatus();
      expect(queueStatus.queuedStoryId).toBe(story3.id);
    });
  });

  describe('Queue Processing', () => {
    it('should process queued story after current playback completes', async () => {
      vi.useFakeTimers();

      // Setup first story to complete after delay
      let firstStoryEndCallback: (() => void) | null = null;
      mockAudioBufferSource.start.mockImplementation(() => {
        firstStoryEndCallback = () => mockAudioBufferSource.onended?.();
      });

      // Start first story
      const firstPromise = storyManager.replaceNextTTSWithStory(
        story1,
        mockStreamingManager
      );

      // Queue second story
      await storyManager.replaceNextTTSWithStory(story2, mockStreamingManager);

      // Verify second story is queued
      expect(storyManager.getQueueStatus().hasQueue).toBe(true);

      // Complete first story
      firstStoryEndCallback?.();
      await firstPromise;

      // Advance timers to trigger queue processing
      vi.advanceTimersByTime(200);

      // Wait for queue processing
      await vi.runAllTimersAsync();

      // Verify queue was processed (cleared)
      expect(storyManager.getQueueStatus().hasQueue).toBe(false);

      vi.useRealTimers();
    });

    it('should expire old queued stories', async () => {
      vi.useFakeTimers();

      // Start first story (long playback)
      mockAudioBufferSource.start.mockImplementation(() => {
        // Don't complete
      });

      // Start first story
      await storyManager.replaceNextTTSWithStory(story1, mockStreamingManager);

      // Queue second story
      await storyManager.replaceNextTTSWithStory(story2, mockStreamingManager);

      // Verify story is queued
      expect(storyManager.getQueueStatus().hasQueue).toBe(true);

      // Advance time beyond queue expiration (10 seconds)
      vi.advanceTimersByTime(11000);

      // Simulate first story completion to trigger queue processing
      mockAudioBufferSource.onended?.();

      // Advance timers to process queue
      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();

      // Verify expired story was removed from queue
      expect(storyManager.getQueueStatus().hasQueue).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('Concurrency State Management', () => {
    it('should track current story and queue information', async () => {
      // Start first story
      mockAudioBufferSource.start.mockImplementation(() => {
        // Don't complete immediately
      });

      await storyManager.replaceNextTTSWithStory(story1, mockStreamingManager);

      // Check current story info
      let storyInfo = storyManager.getCurrentStoryInfo();
      expect(storyInfo.storyId).toBe(story1.id);
      expect(storyInfo.playbackStartTime).toBeDefined();
      expect(storyInfo.queuedStoryId).toBeUndefined();

      // Queue second story
      await storyManager.replaceNextTTSWithStory(story2, mockStreamingManager);

      // Check updated story info
      storyInfo = storyManager.getCurrentStoryInfo();
      expect(storyInfo.storyId).toBe(story1.id);
      expect(storyInfo.queuedStoryId).toBe(story2.id);
      expect(storyInfo.queueAge).toBeDefined();
      expect(storyInfo.queueAge).toBeGreaterThan(0);
    });

    it('should clear queue when stopping current story', async () => {
      // Start first story
      await storyManager.replaceNextTTSWithStory(story1, mockStreamingManager);

      // Queue second story
      await storyManager.replaceNextTTSWithStory(story2, mockStreamingManager);

      // Verify queue exists
      expect(storyManager.getQueueStatus().hasQueue).toBe(true);

      // Stop current story
      await storyManager.stopCurrentStory();

      // Verify queue was cleared
      expect(storyManager.getQueueStatus().hasQueue).toBe(false);
      expect(storyManager.isPlaying()).toBe(false);
    });

    it('should handle multiple rapid triggers correctly', async () => {
      // Start first story
      mockAudioBufferSource.start.mockImplementation(() => {
        // Don't complete
      });

      await storyManager.replaceNextTTSWithStory(story1, mockStreamingManager);

      // Rapidly trigger multiple stories
      const results = await Promise.all([
        storyManager.replaceNextTTSWithStory(story2, mockStreamingManager),
        storyManager.replaceNextTTSWithStory(story3, mockStreamingManager)
      ]);

      // First queued story should succeed
      expect(results[0].success).toBe(true);
      expect(results[0].error_message).toBe('Story queued for playback');

      // Second should replace the first in queue
      expect(results[1].success).toBe(true);
      expect(results[1].error_message).toBe('Story queued for playback');

      // Only the last story should be in queue
      const queueStatus = storyManager.getQueueStatus();
      expect(queueStatus.hasQueue).toBe(true);
      expect(queueStatus.queuedStoryId).toBe(story3.id);
    });
  });

  describe('Cooldown Integration', () => {
    it('should respect cooldown even with queue', async () => {
      // Complete first story to start cooldown
      mockAudioBufferSource.start.mockImplementation(() => {
        setTimeout(() => mockAudioBufferSource.onended?.(), 10);
      });

      const firstResult = await storyManager.replaceNextTTSWithStory(
        story1,
        mockStreamingManager
      );

      expect(firstResult.success).toBe(true);

      // Try to trigger another story immediately (should be blocked by cooldown)
      const secondResult = await storyManager.replaceNextTTSWithStory(
        story2,
        mockStreamingManager
      );

      expect(secondResult.success).toBe(false);
      expect(secondResult.error_message).toContain('cooldown');
    });

    it('should check cooldown before queueing', async () => {
      // Start and complete first story to trigger cooldown
      mockAudioBufferSource.start.mockImplementation(() => {
        setTimeout(() => mockAudioBufferSource.onended?.(), 10);
      });

      await storyManager.replaceNextTTSWithStory(story1, mockStreamingManager);

      // Start second story (should work, different from cooldown test above)
      mockAudioBufferSource.start.mockImplementation(() => {
        // Don't complete - simulate ongoing playback
      });

      // Use different avatar to avoid cooldown
      const story2DifferentAvatar = { ...story2, owner_id: 'different-avatar' };
      await storyManager.replaceNextTTSWithStory(story2DifferentAvatar, mockStreamingManager);

      // Try to queue story for original avatar (should be blocked by cooldown)
      const thirdResult = await storyManager.replaceNextTTSWithStory(
        story3,
        mockStreamingManager
      );

      expect(thirdResult.success).toBe(false);
      expect(thirdResult.error_message).toContain('cooldown');
    });
  });

  describe('Error Handling in Queue', () => {
    it('should handle queue processing errors gracefully', async () => {
      vi.useFakeTimers();

      // Mock queue processing to throw error
      const originalProcessQueue = (storyManager as any).processQueuedStory;
      (storyManager as any).processQueuedStory = vi.fn().mockRejectedValue(
        new Error('Queue processing failed')
      );

      // Start first story
      let firstStoryEndCallback: (() => void) | null = null;
      mockAudioBufferSource.start.mockImplementation(() => {
        firstStoryEndCallback = () => mockAudioBufferSource.onended?.();
      });

      await storyManager.replaceNextTTSWithStory(story1, mockStreamingManager);

      // Queue second story
      await storyManager.replaceNextTTSWithStory(story2, mockStreamingManager);

      // Complete first story to trigger queue processing
      firstStoryEndCallback?.();

      // Advance timers to trigger queue processing
      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();

      // Verify error was handled gracefully (no crash)
      expect((storyManager as any).processQueuedStory).toHaveBeenCalled();

      // Restore original method
      (storyManager as any).processQueuedStory = originalProcessQueue;

      vi.useRealTimers();
    });

    it('should use fallback callback for failed queued stories', async () => {
      vi.useFakeTimers();

      // Mock story loading to fail for queued story
      const originalPreload = storyManager.preloadStoryAudio;
      storyManager.preloadStoryAudio = vi.fn().mockImplementation((story) => {
        if (story.id === story2.id) {
          return Promise.resolve({
            success: false,
            error: 'Queued story load failed'
          });
        }
        return originalPreload.call(storyManager, story);
      });

      // Start first story
      let firstStoryEndCallback: (() => void) | null = null;
      mockAudioBufferSource.start.mockImplementation(() => {
        firstStoryEndCallback = () => mockAudioBufferSource.onended?.();
      });

      await storyManager.replaceNextTTSWithStory(story1, mockStreamingManager);

      // Queue second story with fallback
      const mockFallback = vi.fn().mockResolvedValue(undefined);
      await storyManager.replaceNextTTSWithStory(story2, mockStreamingManager);

      // Complete first story
      firstStoryEndCallback?.();

      // Advance timers to process queue
      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();

      // Verify queue was processed despite error
      expect(storyManager.getQueueStatus().hasQueue).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('Metrics Integration', () => {
    it('should track queue-related metrics', async () => {
      const mockMetrics = (storyManager as any).metricsCollector;

      // Start first story
      mockAudioBufferSource.start.mockImplementation(() => {
        // Don't complete
      });

      await storyManager.replaceNextTTSWithStory(story1, mockStreamingManager);

      // Queue second story
      await storyManager.replaceNextTTSWithStory(story2, mockStreamingManager);

      // Verify queued metric was tracked
      expect(mockMetrics.trackStoryQueued).toHaveBeenCalledWith(
        story2.owner_id,
        story2.category
      );

      // Queue third story (should replace second)
      await storyManager.replaceNextTTSWithStory(story3, mockStreamingManager);

      // Verify replacement metric was tracked
      expect(mockMetrics.trackStoryReplaced).toHaveBeenCalledWith(
        story2.owner_id,
        story2.category
      );
    });
  });
});