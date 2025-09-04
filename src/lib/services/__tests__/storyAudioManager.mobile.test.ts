/**
 * StoryAudioManager Mobile Integration Tests - Task 12
 * 
 * Tests mobile optimization integration in StoryAudioManager:
 * - Mobile resource manager integration
 * - Conservative preloading behavior
 * - Memory management integration
 * - iOS Safari compatibility
 * - TTS buffering respect
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { StoryAudioManager, createStoryAudioManager } from '../storyAudioManager';
import { UserStory } from '../../types/stories';

// Mock dependencies
vi.mock('../../mobileAudioContextManager', () => ({
  mobileAudioContextManager: {
    ensureReady: vi.fn(),
    createOptimizedBuffer: vi.fn(),
    getAudioContext: vi.fn(),
  },
  isMobileSafari: vi.fn(),
}));

vi.mock('../../globalAudioManager', () => ({
  globalAudioManager: {
    getIsPlaying: vi.fn(),
    createOptimizedAudio: vi.fn(),
    playAudio: vi.fn(),
    stopAll: vi.fn(),
  },
}));

vi.mock('./storyErrorHandler', () => ({
  StoryErrorHandler: vi.fn().mockImplementation(() => ({
    registerFallbackCallback: vi.fn(),
    handleLoadingError: vi.fn(),
    handlePlaybackError: vi.fn(),
    cleanup: vi.fn(),
  })),
}));

vi.mock('./storyMetrics', () => ({
  default: {
    getInstance: () => ({
      trackStoryStart: vi.fn(),
      trackStorySelection: vi.fn(),
      trackStoryPlaySuccess: vi.fn(),
      trackStoryPlayFailure: vi.fn(),
    }),
  },
}));

vi.mock('./mobileStoryResourceManager', () => ({
  globalMobileStoryResourceManager: {
    getPreloadedBuffer: vi.fn(),
    canPreloadStory: vi.fn(),
    requestStoryPreload: vi.fn(),
    getCacheStats: vi.fn(),
    clearAllCache: vi.fn(),
    destroy: vi.fn(),
  },
  MobileStoryResourceManager: vi.fn(),
}));

// Mock fetch for audio loading
global.fetch = vi.fn();

// Mock AudioContext
global.AudioContext = vi.fn().mockImplementation(() => ({
  decodeAudioData: vi.fn(),
  createBufferSource: vi.fn(() => ({
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    onended: null,
  })),
  createGain: vi.fn(() => ({
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      value: 1,
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  destination: {},
  currentTime: 0,
  state: 'running',
  resume: vi.fn(),
}));

describe('StoryAudioManager Mobile Integration', () => {
  let manager: StoryAudioManager;
  let mockStory: UserStory;
  let mockStreamingManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create test story
    mockStory = {
      id: 'test-story-1',
      owner_id: 'test-avatar',
      owner_type: 'avatar',
      title: 'Test Mobile Story',
      category: 'memory',
      triggers: ['mobile', 'test'],
      audio_url: 'https://example.com/mobile-story.mp3',
      duration_ms: 30000,
      status: 'active',
      priority: 50,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    };

    // Mock streaming manager
    mockStreamingManager = {
      stop: vi.fn(),
      isPlaying: vi.fn().mockReturnValue(false),
      addSentence: vi.fn(),
    };

    // Create manager with mobile-optimized config
    manager = createStoryAudioManager({
      preloadTimeoutMs: 2000,
      fallbackToTTS: true,
      enableLipSync: false,
      maxConcurrentLoads: 1,
      audioBufferCacheSize: 15 * 1024 * 1024, // 15MB
    });
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('Mobile Resource Manager Integration', () => {
    it('should check mobile resource manager for preloaded buffers first', async () => {
      const mockAudioBuffer = {
        duration: 30,
        length: 44100 * 30,
        numberOfChannels: 2,
        sampleRate: 44100
      } as AudioBuffer;

      // Mock mobile resource manager has preloaded buffer
      vi.mocked(require('./mobileStoryResourceManager').globalMobileStoryResourceManager.getPreloadedBuffer)
        .mockReturnValue(mockAudioBuffer);

      const result = await manager.preloadStoryAudio(mockStory);

      expect(result.success).toBe(true);
      expect(result.audioBuffer).toBe(mockAudioBuffer);
      expect(result.loadTimeMs).toBe(0); // Preloaded
      
      // Verify mobile resource manager was checked
      expect(require('./mobileStoryResourceManager').globalMobileStoryResourceManager.getPreloadedBuffer)
        .toHaveBeenCalledWith(mockStory);
    });

    it('should respect mobile constraints when preloading', async () => {
      // Mock mobile resource manager prevents preload
      vi.mocked(require('./mobileStoryResourceManager').globalMobileStoryResourceManager.getPreloadedBuffer)
        .mockReturnValue(null);
      
      vi.mocked(require('./mobileStoryResourceManager').globalMobileStoryResourceManager.canPreloadStory)
        .mockReturnValue({
          shouldPreload: false,
          reason: 'iOS decoded story limit reached',
          alternativeAction: 'clear_cache'
        });

      const result = await manager.preloadStoryAudio(mockStory);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Mobile constraint');
      
      // Verify mobile resource manager was consulted
      expect(require('./mobileStoryResourceManager').globalMobileStoryResourceManager.canPreloadStory)
        .toHaveBeenCalledWith(mockStory);
      
      // Verify story was queued for later preload
      expect(require('./mobileStoryResourceManager').globalMobileStoryResourceManager.requestStoryPreload)
        .toHaveBeenCalledWith(mockStory);
    });

    it('should use mobile-optimized audio decoding on iOS Safari', async () => {
      // Mock iOS Safari environment
      vi.mocked(require('../../mobileAudioContextManager').isMobileSafari)
        .mockReturnValue(true);

      // Mock mobile resource manager allows preload
      vi.mocked(require('./mobileStoryResourceManager').globalMobileStoryResourceManager.getPreloadedBuffer)
        .mockReturnValue(null);
      
      vi.mocked(require('./mobileStoryResourceManager').globalMobileStoryResourceManager.canPreloadStory)
        .mockReturnValue({
          shouldPreload: true,
          reason: 'All mobile constraints satisfied'
        });

      // Mock successful fetch
      const mockArrayBuffer = new ArrayBuffer(1024);
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockArrayBuffer)
      });

      // Mock mobile-optimized decoding
      const mockAudioBuffer = {
        duration: 30,
        length: 44100 * 30,
        numberOfChannels: 2,
        sampleRate: 44100
      } as AudioBuffer;

      vi.mocked(require('../../mobileAudioContextManager').mobileAudioContextManager.createOptimizedBuffer)
        .mockResolvedValue(mockAudioBuffer);

      const result = await manager.preloadStoryAudio(mockStory);

      expect(result.success).toBe(true);
      
      // Verify mobile-optimized decoding was used
      expect(require('../../mobileAudioContextManager').mobileAudioContextManager.createOptimizedBuffer)
        .toHaveBeenCalledWith(mockArrayBuffer);
    });
  });

  describe('Conservative Preloading Behavior', () => {
    it('should limit concurrent preloads based on mobile constraints', async () => {
      // Mock mobile resource manager enforces iOS limit
      vi.mocked(require('./mobileStoryResourceManager').globalMobileStoryResourceManager.canPreloadStory)
        .mockReturnValueOnce({
          shouldPreload: true,
          reason: 'All constraints satisfied'
        })
        .mockReturnValueOnce({
          shouldPreload: false,
          reason: 'iOS decoded story limit reached (1/1)',
          alternativeAction: 'clear_cache'
        });

      // First story should preload
      const result1 = await manager.preloadStoryAudio(mockStory);
      expect(result1.success).toBe(true);

      // Second story should be blocked by mobile constraints
      const story2 = { ...mockStory, id: 'test-story-2' };
      const result2 = await manager.preloadStoryAudio(story2);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Mobile constraint');
    });

    it('should queue stories when constraints prevent immediate preload', async () => {
      // Mock TTS buffering prevents preload
      vi.mocked(require('./mobileStoryResourceManager').globalMobileStoryResourceManager.canPreloadStory)
        .mockReturnValue({
          shouldPreload: false,
          reason: 'TTS is currently buffering',
          alternativeAction: 'defer'
        });

      await manager.preloadStoryAudio(mockStory);

      // Verify story was queued
      expect(require('./mobileStoryResourceManager').globalMobileStoryResourceManager.requestStoryPreload)
        .toHaveBeenCalledWith(mockStory);
    });
  });

  describe('Memory Management Integration', () => {
    it('should use mobile-aware caching for successful loads', async () => {
      // Mock successful preload conditions
      vi.mocked(require('./mobileStoryResourceManager').globalMobileStoryResourceManager.getPreloadedBuffer)
        .mockReturnValue(null);
      
      vi.mocked(require('./mobileStoryResourceManager').globalMobileStoryResourceManager.canPreloadStory)
        .mockReturnValue({
          shouldPreload: true,
          reason: 'All constraints satisfied'
        });

      // Mock successful fetch and decode
      const mockArrayBuffer = new ArrayBuffer(1024);
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockArrayBuffer)
      });

      const mockAudioBuffer = {
        duration: 30,
        length: 44100 * 30,
        numberOfChannels: 2,
        sampleRate: 44100
      } as AudioBuffer;

      const mockAudioContext = new AudioContext();
      vi.mocked(mockAudioContext.decodeAudioData).mockResolvedValue(mockAudioBuffer);

      await manager.preloadStoryAudio(mockStory);

      // Verify mobile resource manager was used for caching
      expect(require('./mobileStoryResourceManager').globalMobileStoryResourceManager.requestStoryPreload)
        .toHaveBeenCalledWith(mockStory);
    });

    it('should include mobile stats in cache statistics', () => {
      const mockMobileStats = {
        decodedStories: 1,
        maxDecodedStories: 1,
        cacheSizeMB: 5.2,
        maxCacheSizeMB: 15,
        memoryPressure: 'low',
        queueLength: 0
      };

      vi.mocked(require('./mobileStoryResourceManager').globalMobileStoryResourceManager.getCacheStats)
        .mockReturnValue(mockMobileStats);

      const stats = manager.getCacheStats();

      expect(stats.mobile).toEqual(mockMobileStats);
    });

    it('should clear mobile cache when clearing all caches', () => {
      manager.clearCache();

      expect(require('./mobileStoryResourceManager').globalMobileStoryResourceManager.clearAllCache)
        .toHaveBeenCalled();
    });
  });

  describe('Story Playback with Mobile Optimizations', () => {
    it('should successfully play story using mobile-preloaded buffer', async () => {
      const mockAudioBuffer = {
        duration: 30,
        length: 44100 * 30,
        numberOfChannels: 2,
        sampleRate: 44100
      } as AudioBuffer;

      // Mock mobile resource manager has preloaded buffer
      vi.mocked(require('./mobileStoryResourceManager').globalMobileStoryResourceManager.getPreloadedBuffer)
        .mockReturnValue(mockAudioBuffer);

      // Mock AudioContext for playback
      const mockSource = {
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        onended: null,
      };

      const mockGain = {
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          value: 1,
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };

      const mockAudioContext = new AudioContext();
      vi.mocked(mockAudioContext.createBufferSource).mockReturnValue(mockSource);
      vi.mocked(mockAudioContext.createGain).mockReturnValue(mockGain);

      const result = await manager.replaceNextTTSWithStory(
        mockStory,
        mockStreamingManager,
        { volume_level: 1.0 }
      );

      expect(result.success).toBe(true);
      expect(mockStreamingManager.stop).toHaveBeenCalled();
    });

    it('should handle mobile playback failures gracefully', async () => {
      // Mock mobile resource manager has no preloaded buffer
      vi.mocked(require('./mobileStoryResourceManager').globalMobileStoryResourceManager.getPreloadedBuffer)
        .mockReturnValue(null);

      // Mock mobile constraints prevent preload
      vi.mocked(require('./mobileStoryResourceManager').globalMobileStoryResourceManager.canPreloadStory)
        .mockReturnValue({
          shouldPreload: false,
          reason: 'High memory pressure detected',
          alternativeAction: 'clear_cache'
        });

      const result = await manager.replaceNextTTSWithStory(
        mockStory,
        mockStreamingManager
      );

      expect(result.success).toBe(false);
      expect(result.fallback_used).toBe(true);
      expect(result.error_message).toContain('Mobile constraint');
    });
  });

  describe('iOS Safari Specific Behavior', () => {
    beforeEach(() => {
      // Mock iOS Safari environment
      vi.mocked(require('../../mobileAudioContextManager').isMobileSafari)
        .mockReturnValue(true);
    });

    it('should enforce iOS Safari audio context requirements', async () => {
      // Mock audio context not ready
      vi.mocked(require('../../mobileAudioContextManager').mobileAudioContextManager.ensureReady)
        .mockResolvedValue(false);

      const result = await manager.replaceNextTTSWithStory(
        mockStory,
        mockStreamingManager
      );

      // Should fail gracefully when audio context not ready
      expect(result.success).toBe(false);
      expect(result.fallback_used).toBe(true);
    });

    it('should use mobile-optimized audio elements for HTML Audio fallback', async () => {
      // Mock mobile resource manager prevents AudioContext preload
      vi.mocked(require('./mobileStoryResourceManager').globalMobileStoryResourceManager.getPreloadedBuffer)
        .mockReturnValue(null);

      // Mock mobile-optimized audio element
      const mockAudio = {
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        onended: null,
        onerror: null,
        volume: 1,
        playsInline: true,
        muted: false,
      };

      vi.mocked(require('../../globalAudioManager').globalAudioManager.createOptimizedAudio)
        .mockReturnValue(mockAudio);

      vi.mocked(require('../../globalAudioManager').globalAudioManager.playAudio)
        .mockResolvedValue(undefined);

      // Force HTML Audio fallback by making AudioContext unavailable
      const result = await manager.replaceNextTTSWithStory(
        mockStory,
        mockStreamingManager
      );

      // Verify mobile-optimized audio was used
      expect(require('../../globalAudioManager').globalAudioManager.createOptimizedAudio)
        .toHaveBeenCalledWith(mockStory.audio_url);
    });
  });

  describe('Resource Cleanup', () => {
    it('should cleanup mobile resources on destroy', () => {
      manager.destroy();

      expect(require('./mobileStoryResourceManager').globalMobileStoryResourceManager.destroy)
        .toHaveBeenCalled();
    });

    it('should handle destroy gracefully when mobile manager is unavailable', () => {
      // Create manager without mobile resource manager
      const managerWithoutMobile = new (require('../storyAudioManager').StoryAudioManager)({
        preloadTimeoutMs: 1000,
      });

      // Should not throw when destroying
      expect(() => managerWithoutMobile.destroy()).not.toThrow();
    });
  });

  describe('Performance Monitoring', () => {
    it('should track mobile-specific metrics', async () => {
      const mockAudioBuffer = {
        duration: 30,
        length: 44100 * 30,
        numberOfChannels: 2,
        sampleRate: 44100
      } as AudioBuffer;

      // Mock mobile preloaded buffer
      vi.mocked(require('./mobileStoryResourceManager').globalMobileStoryResourceManager.getPreloadedBuffer)
        .mockReturnValue(mockAudioBuffer);

      await manager.preloadStoryAudio(mockStory);

      // Verify metrics were tracked with preloaded flag
      const metricsInstance = require('./storyMetrics').default.getInstance();
      expect(metricsInstance.trackStoryStart).toHaveBeenCalledWith(
        mockStory.owner_id,
        expect.any(Number),
        true // preloaded flag
      );
    });
  });
});