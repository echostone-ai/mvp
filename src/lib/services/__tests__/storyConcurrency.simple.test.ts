/**
 * Simple Story Concurrency Tests
 * Debugging the queue functionality step by step
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
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
        start: vi.fn(),
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
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
});

// Test data
const createTestStory = (id: string, title: string): UserStory => ({
  id,
  owner_id: 'test-avatar-1',
  owner_type: 'avatar',
  title,
  category: 'memory',
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

describe('Simple Story Concurrency Tests', () => {
  let storyManager: StoryAudioManager;
  let mockStreamingManager: StreamingAudioManager;
  let story1: UserStory;
  let story2: UserStory;

  beforeEach(() => {
    vi.clearAllMocks();
    
    storyManager = new StoryAudioManager({
      preloadTimeoutMs: 2000,
      fallbackToTTS: true,
      enableLipSync: false,
      maxConcurrentLoads: 1
    });

    mockStreamingManager = createMockStreamingManager();
    story1 = createTestStory('story-1', 'First Story');
    story2 = createTestStory('story-2', 'Second Story');
  });

  it('should have empty queue initially', () => {
    const queueStatus = storyManager.getQueueStatus();
    expect(queueStatus.hasQueue).toBe(false);
    expect(queueStatus.queuedStoryId).toBeUndefined();
  });

  it('should not be playing initially', () => {
    expect(storyManager.isPlaying()).toBe(false);
  });

  it('should make correct concurrency decision when nothing is playing', () => {
    const decision = (storyManager as any).decideConcurrencyAction(story1);
    expect(decision.action).toBe('play');
    expect(decision.shouldLog).toBe(false);
  });

  it('should make correct concurrency decision when story is playing', async () => {
    // Simulate story playing
    (storyManager as any).concurrencyState.isPlaying = true;
    (storyManager as any).concurrencyState.currentStoryId = story1.id;

    const decision = (storyManager as any).decideConcurrencyAction(story2);
    expect(decision.action).toBe('queue');
    expect(decision.shouldLog).toBe(true);
    expect(decision.reason).toContain('queueing new story');
  });

  it('should make correct concurrency decision when replacing queue', async () => {
    // Simulate story playing and another queued
    (storyManager as any).concurrencyState.isPlaying = true;
    (storyManager as any).concurrencyState.currentStoryId = story1.id;
    (storyManager as any).storyQueue = {
      story: story2,
      options: {},
      streamingManager: mockStreamingManager,
      queuedAt: Date.now()
    };

    const story3 = createTestStory('story-3', 'Third Story');
    const decision = (storyManager as any).decideConcurrencyAction(story3);
    expect(decision.action).toBe('replace_queue');
    expect(decision.shouldLog).toBe(true);
    expect(decision.reason).toContain('Replacing queued story');
  });

  it('should queue story correctly', async () => {
    const decision = {
      action: 'queue' as const,
      reason: 'Test queue',
      shouldLog: true
    };

    const result = await (storyManager as any).queueStory(
      story1,
      mockStreamingManager,
      {},
      vi.fn(),
      decision
    );

    expect(result.success).toBe(true);
    expect(result.story_id).toBe(story1.id);
    expect(result.error_message).toBe('Story queued for playback');

    // Check queue status
    const queueStatus = storyManager.getQueueStatus();
    expect(queueStatus.hasQueue).toBe(true);
    expect(queueStatus.queuedStoryId).toBe(story1.id);
  });

  it('should clear queue correctly', () => {
    // Set up queue
    (storyManager as any).storyQueue = {
      story: story1,
      options: {},
      streamingManager: mockStreamingManager,
      queuedAt: Date.now()
    };
    (storyManager as any).concurrencyState.queuedStoryId = story1.id;

    // Clear queue
    (storyManager as any).clearQueue();

    // Verify queue is cleared
    const queueStatus = storyManager.getQueueStatus();
    expect(queueStatus.hasQueue).toBe(false);
    expect(queueStatus.queuedStoryId).toBeUndefined();
  });

  it('should handle queue replacement correctly', async () => {
    // Queue first story
    const decision1 = {
      action: 'queue' as const,
      reason: 'Test queue',
      shouldLog: true
    };

    await (storyManager as any).queueStory(
      story1,
      mockStreamingManager,
      {},
      vi.fn(),
      decision1
    );

    // Verify first story is queued
    expect(storyManager.getQueueStatus().queuedStoryId).toBe(story1.id);

    // Replace with second story
    const decision2 = {
      action: 'replace_queue' as const,
      reason: 'Test replace',
      shouldLog: true
    };

    await (storyManager as any).queueStory(
      story2,
      mockStreamingManager,
      {},
      vi.fn(),
      decision2
    );

    // Verify second story replaced first
    expect(storyManager.getQueueStatus().queuedStoryId).toBe(story2.id);
  });
});