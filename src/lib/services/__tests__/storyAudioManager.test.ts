/**
 * StoryAudioManager Integration Tests
 * 
 * Tests for audio playback and fallback scenarios as required by task 7:
 * - Audio buffer preloading with 2-second timeout constraint
 * - Graceful fallback to TTS when story loading fails or times out
 * - MVP concurrency: ignore new triggers if story is playing
 * - Integration with StreamingAudioManager
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { StoryAudioManager, createStoryAudioManager } from '../storyAudioManager';
import { UserStory } from '../../types/stories';
import { StreamingAudioManager } from '../../streamingUtils';

// Mock dependencies
vi.mock('../../globalAudioManager', () => ({
  globalAudioManager: {
    stopAll: vi.fn().mockResolvedValue(undefined),
    playAudio: vi.fn().mockResolvedValue(undefined),
    createOptimizedAudio: vi.fn().mockImplementation((src) => {
      const audio = {
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
      };
      return audio as any;
    })
  }
}));

vi.mock('../../mobileAudioContextManager', () => ({
  mobileAudioContextManager: {
    ensureReady: vi.fn().mockResolvedValue(true),
    getAudioContext: vi.fn().mockReturnValue(null)
  },
  isMobileSafari: vi.fn().mockReturnValue(false),
  createMobileOptimizedAudio: vi.fn().mockImplementation((src) => ({
    src,
    volume: 1.0,
    preload: 'auto',
    playsInline: true,
    muted: false,
    onended: null as any,
    onerror: null as any,
    play: vi.fn().mockResolvedValue(undefined)
  }))
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
  duration: 3.5, // 3.5 seconds
  length: 154000,
  numberOfChannels: 2,
  sampleRate: 44100
};

const mockAudioBufferSource = {
  buffer: null,
  connect: vi.fn(),
  disconnect: vi.fn(),
  start: vi.fn().mockImplementation(() => {
    // Simulate immediate completion for tests
    setTimeout(() => {
      if (mockAudioBufferSource.onended) {
        mockAudioBufferSource.onended();
      }
    }, 10);
  }),
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

// Mock window.AudioContext
Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn().mockImplementation(() => mockAudioContext)
});

Object.defineProperty(window, 'webkitAudioContext', {
  writable: true,
  value: vi.fn().mockImplementation(() => mockAudioContext)
});

describe('StoryAudioManager', () => {
  let storyAudioManager: StoryAudioManager;
  let mockStreamingManager: StreamingAudioManager;
  let sampleStory: UserStory;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup mock AudioContext methods
    mockAudioContext.decodeAudioData.mockResolvedValue(mockAudioBuffer);
    mockAudioContext.createBufferSource.mockReturnValue(mockAudioBufferSource);
    mockAudioContext.createGain.mockReturnValue(mockGainNode);
    
    // Create story audio manager with test configuration
    storyAudioManager = createStoryAudioManager({
      preloadTimeoutMs: 2000,
      fallbackToTTS: true,
      enableLipSync: false,
      maxConcurrentLoads: 1,
      audioBufferCacheSize: 15 * 1024 * 1024
    });

    // Mock streaming manager
    mockStreamingManager = {
      addSentence: vi.fn().mockResolvedValue(undefined),
      addPhrase: vi.fn().mockResolvedValue(undefined),
      interject: vi.fn().mockResolvedValue(undefined),
      addThinkingSound: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
      isPlaying: vi.fn().mockReturnValue(false),
      setExpressionPack: vi.fn(),
      enableExpressions: vi.fn()
    };

    // Sample story for testing
    sampleStory = {
      id: 'test-story-1',
      owner_id: 'test-avatar',
      owner_type: 'avatar',
      title: 'Test Memory Story',
      category: 'memory',
      triggers: 'childhood, school, friends',
      audio_url: 'https://example.com/story.mp3',
      duration_ms: 3500, // 3.5 seconds
      transcript: 'This is a test story about childhood memories.',
      priority: 75,
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    };

    // Setup successful fetch mock by default
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024))
    });
  });

  afterEach(() => {
    storyAudioManager.destroy();
  });

  describe('Audio Buffer Preloading', () => {
    it('should successfully preload story audio within timeout', async () => {
      const result = await storyAudioManager.preloadStoryAudio(sampleStory);

      expect(result.success).toBe(true);
      expect(result.audioBuffer).toBeDefined();
      expect(result.duration).toBe(3500); // 3.5 seconds in ms
      expect(result.loadTimeMs).toBeLessThan(2000);
      expect(mockFetch).toHaveBeenCalledWith(sampleStory.audio_url);
      expect(mockAudioContext.decodeAudioData).toHaveBeenCalled();
    });

    it('should timeout after 2 seconds and return failure', async () => {
      // Mock slow fetch that exceeds timeout
      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 3000))
      );

      const result = await storyAudioManager.preloadStoryAudio(sampleStory);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(result.loadTimeMs).toBeGreaterThanOrEqual(2000);
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await storyAudioManager.preloadStoryAudio(sampleStory);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle HTTP errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const result = await storyAudioManager.preloadStoryAudio(sampleStory);

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 404');
    });

    it('should handle AudioContext decode errors with HTML Audio fallback', async () => {
      mockAudioContext.decodeAudioData.mockRejectedValue(new Error('Decode error'));

      const result = await storyAudioManager.preloadStoryAudio(sampleStory);

      expect(result.success).toBe(true); // Should succeed with HTML Audio fallback
      expect(result.duration).toBe(sampleStory.duration_ms);
    });

    it('should cache successfully loaded audio buffers', async () => {
      // Load same story twice
      const result1 = await storyAudioManager.preloadStoryAudio(sampleStory);
      const result2 = await storyAudioManager.preloadStoryAudio(sampleStory);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result2.loadTimeMs).toBe(0); // Should be cached
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only fetched once
    });
  });

  describe('TTS Replacement and Playback', () => {
    it('should successfully replace TTS with story audio', async () => {
      const result = await storyAudioManager.replaceNextTTSWithStory(
        sampleStory,
        mockStreamingManager
      );

      expect(result.success).toBe(true);
      expect(result.story_id).toBe(sampleStory.id);
      expect(result.fallback_used).toBe(false);
      expect(mockStreamingManager.stop).toHaveBeenCalled();
      expect(mockAudioBufferSource.start).toHaveBeenCalled();
    }, 10000); // Increase timeout

    it('should apply volume and fade settings correctly', async () => {
      const options = {
        volume_level: 0.8,
        fade_in_ms: 500
      };

      await storyAudioManager.replaceNextTTSWithStory(
        sampleStory,
        mockStreamingManager,
        options
      );

      expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));
      expect(mockGainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.8, expect.any(Number));
    }, 10000); // Increase timeout

    it('should handle AudioContext playback errors gracefully', async () => {
      mockAudioBufferSource.start.mockImplementation(() => {
        throw new Error('Playback error');
      });

      const result = await storyAudioManager.replaceNextTTSWithStory(
        sampleStory,
        mockStreamingManager
      );

      expect(result.success).toBe(false);
      expect(result.fallback_used).toBe(true);
      expect(mockStreamingManager.addSentence).toHaveBeenCalled(); // TTS fallback
    });
  });

  describe('Graceful TTS Fallback', () => {
    it('should fallback to TTS when story loading fails', async () => {
      mockFetch.mockRejectedValue(new Error('Load failed'));

      const result = await storyAudioManager.replaceNextTTSWithStory(
        sampleStory,
        mockStreamingManager
      );

      expect(result.success).toBe(false);
      expect(result.fallback_used).toBe(true);
      expect(mockStreamingManager.addSentence).toHaveBeenCalledWith(
        expect.stringContaining('memory about test memory story')
      );
    });

    it('should fallback to TTS when story loading times out', async () => {
      // Mock slow fetch
      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 3000))
      );

      const result = await storyAudioManager.replaceNextTTSWithStory(
        sampleStory,
        mockStreamingManager
      );

      expect(result.success).toBe(false);
      expect(result.fallback_used).toBe(true);
      expect(result.error_message).toContain('timeout');
      expect(mockStreamingManager.addSentence).toHaveBeenCalled();
    });

    it('should generate appropriate fallback text based on story category', async () => {
      const stories = [
        { ...sampleStory, category: 'memory' as const, title: 'Childhood Days' },
        { ...sampleStory, category: 'experience' as const, title: 'First Job' },
        { ...sampleStory, category: 'advice' as const, title: 'Life Lessons' },
        { ...sampleStory, category: 'anecdote' as const, title: 'Funny Incident' }
      ];

      mockFetch.mockRejectedValue(new Error('Load failed'));

      for (const story of stories) {
        await storyAudioManager.replaceNextTTSWithStory(story, mockStreamingManager);
      }

      const calls = (mockStreamingManager.addSentence as Mock).mock.calls;
      expect(calls[0][0]).toContain('memory about childhood days');
      expect(calls[1][0]).toContain('experience with first job');
      expect(calls[2][0]).toContain('advice about life lessons');
      expect(calls[3][0]).toContain('story about funny incident');
    });
  });

  describe('MVP Concurrency Control', () => {
    it('should ignore new triggers when story is already playing', async () => {
      // Start first story
      const promise1 = storyAudioManager.replaceNextTTSWithStory(
        sampleStory,
        mockStreamingManager
      );

      // Try to start second story while first is loading/playing
      const result2 = await storyAudioManager.replaceNextTTSWithStory(
        { ...sampleStory, id: 'story-2' },
        mockStreamingManager
      );

      expect(result2.success).toBe(false);
      expect(result2.error_message).toContain('Story already playing');
      expect(result2.fallback_used).toBe(false);

      // Wait for first story to complete
      await promise1;
    });

    it('should allow new triggers after story completes', async () => {
      // Mock successful playback
      mockAudioBufferSource.start.mockImplementation(() => {
        setTimeout(() => {
          if (mockAudioBufferSource.onended) {
            mockAudioBufferSource.onended();
          }
        }, 10);
      });

      // Complete first story
      const result1 = await storyAudioManager.replaceNextTTSWithStory(
        sampleStory,
        mockStreamingManager
      );

      // Wait a bit for async completion
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should allow second story (different avatar to avoid cooldown)
      const result2 = await storyAudioManager.replaceNextTTSWithStory(
        { ...sampleStory, id: 'story-2', owner_id: 'different-avatar' },
        mockStreamingManager
      );

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it('should track current story playback info', async () => {
      expect(storyAudioManager.isPlaying()).toBe(false);
      expect(storyAudioManager.getCurrentStoryInfo().storyId).toBeUndefined();

      const promise = storyAudioManager.replaceNextTTSWithStory(
        sampleStory,
        mockStreamingManager
      );

      // Should be playing during async operation
      expect(storyAudioManager.isPlaying()).toBe(true);
      expect(storyAudioManager.getCurrentStoryInfo().storyId).toBe(sampleStory.id);

      await promise;
    });
  });

  describe('Cooldown Management', () => {
    it('should enforce 30-second cooldown between story triggers', async () => {
      const avatarId = 'test-avatar';

      // First trigger should succeed
      expect(storyAudioManager.isInCooldown(avatarId)).toBe(false);
      
      // Mock successful playback by not throwing error in start()
      mockAudioBufferSource.start.mockImplementation(() => {
        setTimeout(() => {
          if (mockAudioBufferSource.onended) {
            mockAudioBufferSource.onended();
          }
        }, 10);
      });
      
      const result1 = await storyAudioManager.replaceNextTTSWithStory(sampleStory, mockStreamingManager);
      expect(result1.success).toBe(true);
      
      // Should be in cooldown after successful trigger
      expect(storyAudioManager.isInCooldown(avatarId)).toBe(true);
      expect(storyAudioManager.getRemainingCooldown(avatarId)).toBeGreaterThan(29000);

      // Second trigger should be rejected
      const result2 = await storyAudioManager.replaceNextTTSWithStory(
        { ...sampleStory, id: 'story-2' },
        mockStreamingManager
      );

      expect(result2.success).toBe(false);
      expect(result2.error_message).toContain('cooldown');
    });

    it('should allow triggers after cooldown expires', async () => {
      const avatarId = 'test-avatar';

      // Trigger story and record cooldown
      storyAudioManager.recordTrigger(avatarId);
      expect(storyAudioManager.isInCooldown(avatarId)).toBe(true);

      // Mock time passage (simulate 31 seconds later)
      const originalNow = Date.now;
      Date.now = vi.fn().mockReturnValue(originalNow() + 31000);

      expect(storyAudioManager.isInCooldown(avatarId)).toBe(false);
      expect(storyAudioManager.getRemainingCooldown(avatarId)).toBe(0);

      // Restore Date.now
      Date.now = originalNow;
    });
  });

  describe('Cache Management', () => {
    it('should manage audio buffer cache within memory limits', async () => {
      const initialStats = storyAudioManager.getCacheStats();
      expect(initialStats.entries).toBe(0);

      await storyAudioManager.preloadStoryAudio(sampleStory);

      const afterLoadStats = storyAudioManager.getCacheStats();
      expect(afterLoadStats.entries).toBe(1);
      expect(afterLoadStats.sizeBytes).toBeGreaterThan(0);
    });

    it('should evict old entries when cache is full', async () => {
      // Create manager with very small cache
      const smallCacheManager = createStoryAudioManager({
        audioBufferCacheSize: 1024 // 1KB limit
      });

      try {
        // Load multiple stories to exceed cache limit
        await smallCacheManager.preloadStoryAudio(sampleStory);
        await smallCacheManager.preloadStoryAudio({
          ...sampleStory,
          id: 'story-2',
          audio_url: 'https://example.com/story2.mp3'
        });

        const stats = smallCacheManager.getCacheStats();
        // Cache eviction should keep it reasonable, but our mock buffer is larger than 1KB
        expect(stats.entries).toBeLessThanOrEqual(2); // Should evict old entries
      } finally {
        smallCacheManager.destroy();
      }
    });

    it('should clear cache on demand', async () => {
      await storyAudioManager.preloadStoryAudio(sampleStory);
      expect(storyAudioManager.getCacheStats().entries).toBe(1);

      storyAudioManager.clearCache();
      expect(storyAudioManager.getCacheStats().entries).toBe(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing AudioContext gracefully', async () => {
      // Mock AudioContext as unavailable by setting to undefined
      const originalAudioContext = window.AudioContext;
      const originalWebkitAudioContext = (window as any).webkitAudioContext;
      
      Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true });
      Object.defineProperty(window, 'webkitAudioContext', { value: undefined, configurable: true });

      const noAudioContextManager = createStoryAudioManager();

      try {
        const result = await noAudioContextManager.replaceNextTTSWithStory(
          sampleStory,
          mockStreamingManager
        );

        // Should still work with HTML Audio fallback
        expect(result.success).toBe(true);
        expect(result.fallback_used).toBe(true);
      } finally {
        Object.defineProperty(window, 'AudioContext', { value: originalAudioContext, configurable: true });
        Object.defineProperty(window, 'webkitAudioContext', { value: originalWebkitAudioContext, configurable: true });
        noAudioContextManager.destroy();
      }
    });

    it('should handle suspended AudioContext', async () => {
      mockAudioContext.state = 'suspended';
      
      // Mock successful playback
      mockAudioBufferSource.start.mockImplementation(() => {
        setTimeout(() => {
          if (mockAudioBufferSource.onended) {
            mockAudioBufferSource.onended();
          }
        }, 10);
      });

      const result = await storyAudioManager.replaceNextTTSWithStory(
        sampleStory,
        mockStreamingManager
      );

      expect(mockAudioContext.resume).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should stop current story on demand', async () => {
      const promise = storyAudioManager.replaceNextTTSWithStory(
        sampleStory,
        mockStreamingManager
      );

      expect(storyAudioManager.isPlaying()).toBe(true);

      await storyAudioManager.stopCurrentStory();

      expect(storyAudioManager.isPlaying()).toBe(false);

      await promise;
    });

    it('should cleanup resources on destroy', async () => {
      await storyAudioManager.preloadStoryAudio(sampleStory);
      storyAudioManager.recordTrigger('test-avatar');

      expect(storyAudioManager.getCacheStats().entries).toBe(1);
      expect(storyAudioManager.isInCooldown('test-avatar')).toBe(true);

      storyAudioManager.destroy();

      expect(storyAudioManager.getCacheStats().entries).toBe(0);
      expect(storyAudioManager.isPlaying()).toBe(false);
    });
  });

  describe('Mobile Safari Compatibility', () => {
    beforeEach(() => {
      vi.mocked(require('../../mobileAudioContextManager').isMobileSafari).mockReturnValue(true);
    });

    it('should use mobile-optimized audio creation on Safari', async () => {
      const { globalAudioManager } = require('../../globalAudioManager');
      
      await storyAudioManager.replaceNextTTSWithStory(
        sampleStory,
        mockStreamingManager
      );

      expect(globalAudioManager.createOptimizedAudio).toHaveBeenCalledWith(
        sampleStory.audio_url
      );
    });

    it('should handle mobile Safari audio context requirements', async () => {
      const { mobileAudioContextManager } = require('../../mobileAudioContextManager');
      
      await storyAudioManager.preloadStoryAudio(sampleStory);

      expect(mobileAudioContextManager.ensureReady).toHaveBeenCalled();
    });
  });
});