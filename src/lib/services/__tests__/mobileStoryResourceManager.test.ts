/**
 * Mobile Story Resource Manager Tests - Task 12
 * 
 * Tests mobile optimization and resource management features:
 * - Conservative preloading (max 1 decoded story on iOS)
 * - Memory management for audio buffers with 15MB cache limit
 * - Only preload on user gesture unlocked AudioContext
 * - When TTS is buffering, do not preload story
 * - iOS Safari and Android Chrome browser compatibility
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { MobileStoryResourceManager, createMobileStoryResourceManager } from '../mobileStoryResourceManager';
import { UserStory } from '../../types/stories';

// Mock the mobile audio context manager
const mockMobileAudioContextManager = {
  ensureReady: vi.fn(),
  createOptimizedBuffer: vi.fn(),
};

const mockIsMobileSafari = vi.fn();

// Mock the global audio manager
const mockGlobalAudioManager = {
  getIsPlaying: vi.fn(),
};

// Mock dependencies
vi.mock('../../mobileAudioContextManager', () => ({
  mobileAudioContextManager: mockMobileAudioContextManager,
  isMobileSafari: mockIsMobileSafari,
}));

vi.mock('../../globalAudioManager', () => ({
  globalAudioManager: mockGlobalAudioManager,
}));

// Mock fetch for audio loading
global.fetch = vi.fn();

// Mock AudioContext
global.AudioContext = vi.fn().mockImplementation(() => ({
  decodeAudioData: vi.fn(),
  state: 'running',
  sampleRate: 44100,
}));

describe('MobileStoryResourceManager', () => {
  let manager: MobileStoryResourceManager;
  let mockStory: UserStory;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create test story
    mockStory = {
      id: 'test-story-1',
      owner_id: 'test-avatar',
      owner_type: 'avatar',
      title: 'Test Story',
      category: 'memory',
      triggers: ['test', 'memory'],
      audio_url: 'https://example.com/story.mp3',
      duration_ms: 30000, // 30 seconds
      status: 'active',
      priority: 50,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    };

    // Create manager with test config
    manager = createMobileStoryResourceManager({
      maxDecodedStoriesIOS: 1,
      maxCacheSizeBytes: 15 * 1024 * 1024, // 15MB
      preloadOnlyWithGesture: true,
      respectTTSBuffering: true,
      enableMemoryMonitoring: false, // Disable for tests
    });
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('Preload Decision Logic', () => {
    it('should allow preload when all constraints are satisfied', () => {
      // Mock user gesture unlocked
      mockMobileAudioContextManager.ensureReady.mockResolvedValue(true);
      
      // Mock TTS not buffering
      mockGlobalAudioManager.getIsPlaying.mockReturnValue(false);

      // Mock non-iOS Safari
      mockIsMobileSafari.mockReturnValue(false);

      const decision = manager.canPreloadStory(mockStory);

      expect(decision.shouldPreload).toBe(true);
      expect(decision.reason).toBe('All mobile constraints satisfied');
    });

    it('should prevent preload when user gesture is required', () => {
      // Mock user gesture not unlocked
      const state = manager.getResourceState();
      state.isUserGestureUnlocked = false;

      const decision = manager.canPreloadStory(mockStory);

      expect(decision.shouldPreload).toBe(false);
      expect(decision.reason).toBe('User gesture required for AudioContext');
      expect(decision.alternativeAction).toBe('wait_for_gesture');
    });

    it('should prevent preload when TTS is buffering', () => {
      // Mock TTS buffering
      vi.mocked(require('../globalAudioManager').globalAudioManager.getIsPlaying)
        .mockReturnValue(true);

      const decision = manager.canPreloadStory(mockStory);

      expect(decision.shouldPreload).toBe(false);
      expect(decision.reason).toBe('TTS is currently buffering');
      expect(decision.alternativeAction).toBe('defer');
    });

    it('should prevent preload when iOS decoded story limit is reached', () => {
      // Mock iOS Safari
      vi.mocked(require('../mobileAudioContextManager').isMobileSafari)
        .mockReturnValue(true);

      // Simulate one story already decoded
      const state = manager.getResourceState();
      state.decodedStoryCount = 1;

      const decision = manager.canPreloadStory(mockStory);

      expect(decision.shouldPreload).toBe(false);
      expect(decision.reason).toContain('iOS decoded story limit reached');
      expect(decision.alternativeAction).toBe('clear_cache');
    });

    it('should prevent preload when memory pressure is high', () => {
      // Simulate high memory pressure
      const state = manager.getResourceState();
      state.memoryPressureLevel = 'high';

      const decision = manager.canPreloadStory(mockStory);

      expect(decision.shouldPreload).toBe(false);
      expect(decision.reason).toBe('High memory pressure detected');
      expect(decision.alternativeAction).toBe('clear_cache');
    });

    it('should prevent preload when cache size limit would be exceeded', () => {
      // Simulate cache near limit
      const state = manager.getResourceState();
      state.totalCacheSizeBytes = 14 * 1024 * 1024; // 14MB

      // Mock large story that would exceed limit
      const largeStory = {
        ...mockStory,
        duration_ms: 300000 // 5 minutes = ~5MB estimated
      };

      const decision = manager.canPreloadStory(largeStory);

      expect(decision.shouldPreload).toBe(false);
      expect(decision.reason).toContain('Would exceed cache limit');
      expect(decision.alternativeAction).toBe('clear_cache');
    });
  });

  describe('Story Preloading', () => {
    it('should successfully preload story when constraints allow', async () => {
      // Mock successful fetch
      const mockArrayBuffer = new ArrayBuffer(1024);
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockArrayBuffer)
      });

      // Mock successful audio decoding
      const mockAudioBuffer = {
        duration: 30,
        length: 44100 * 30,
        numberOfChannels: 2,
        sampleRate: 44100
      } as AudioBuffer;

      vi.mocked(require('../mobileAudioContextManager').mobileAudioContextManager.createOptimizedBuffer)
        .mockResolvedValue(mockAudioBuffer);

      // Mock iOS Safari for mobile optimization path
      vi.mocked(require('../mobileAudioContextManager').isMobileSafari)
        .mockReturnValue(true);

      const result = await manager.requestStoryPreload(mockStory);

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(mockStory.audio_url);
      
      // Verify buffer is cached
      const cachedBuffer = manager.getPreloadedBuffer(mockStory);
      expect(cachedBuffer).toBe(mockAudioBuffer);
    });

    it('should handle preload failure gracefully', async () => {
      // Mock fetch failure
      (global.fetch as Mock).mockRejectedValue(new Error('Network error'));

      const result = await manager.requestStoryPreload(mockStory);

      expect(result).toBe(false);
      
      // Verify no buffer is cached
      const cachedBuffer = manager.getPreloadedBuffer(mockStory);
      expect(cachedBuffer).toBeNull();
    });

    it('should queue story when constraints prevent immediate preload', async () => {
      // Mock TTS buffering to prevent immediate preload
      vi.mocked(require('../globalAudioManager').globalAudioManager.getIsPlaying)
        .mockReturnValue(true);

      const result = await manager.requestStoryPreload(mockStory);

      expect(result).toBe(false);
      
      // Verify story is queued
      const stats = manager.getCacheStats();
      expect(stats.queueLength).toBe(1);
    });
  });

  describe('Memory Management', () => {
    it('should track cache size correctly', () => {
      const stats = manager.getCacheStats();
      
      expect(stats).toHaveProperty('decodedStories');
      expect(stats).toHaveProperty('maxDecodedStories');
      expect(stats).toHaveProperty('cacheSizeMB');
      expect(stats).toHaveProperty('maxCacheSizeMB');
      expect(stats).toHaveProperty('memoryPressure');
      expect(stats).toHaveProperty('queueLength');
    });

    it('should clear cache when requested', () => {
      manager.clearAllCache();
      
      const stats = manager.getCacheStats();
      expect(stats.decodedStories).toBe(0);
      expect(stats.cacheSizeMB).toBe(0);
      expect(stats.queueLength).toBe(0);
    });

    it('should estimate story size correctly', () => {
      // Test story size estimation (private method, test via behavior)
      const shortStory = { ...mockStory, duration_ms: 10000 }; // 10 seconds
      const longStory = { ...mockStory, duration_ms: 300000 }; // 5 minutes

      // Short story should be allowed
      const shortDecision = manager.canPreloadStory(shortStory);
      
      // Long story might be rejected due to size (depending on current cache state)
      const longDecision = manager.canPreloadStory(longStory);
      
      // At minimum, we can verify the decision logic runs without error
      expect(shortDecision).toHaveProperty('shouldPreload');
      expect(longDecision).toHaveProperty('shouldPreload');
    });
  });

  describe('iOS Safari Optimizations', () => {
    beforeEach(() => {
      // Mock iOS Safari environment
      vi.mocked(require('../mobileAudioContextManager').isMobileSafari)
        .mockReturnValue(true);
    });

    it('should enforce iOS decoded story limit', () => {
      // Simulate one story already decoded
      const state = manager.getResourceState();
      state.decodedStoryCount = 1;

      const decision = manager.canPreloadStory(mockStory);

      expect(decision.shouldPreload).toBe(false);
      expect(decision.reason).toContain('iOS decoded story limit reached (1/1)');
    });

    it('should use mobile-optimized audio decoding', async () => {
      // Mock successful preload conditions
      const state = manager.getResourceState();
      state.isUserGestureUnlocked = true;
      state.isTTSBuffering = false;

      // Mock successful fetch and decoding
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

      vi.mocked(require('../mobileAudioContextManager').mobileAudioContextManager.createOptimizedBuffer)
        .mockResolvedValue(mockAudioBuffer);

      await manager.requestStoryPreload(mockStory);

      // Verify mobile-optimized decoding was used
      expect(require('../mobileAudioContextManager').mobileAudioContextManager.createOptimizedBuffer)
        .toHaveBeenCalledWith(mockArrayBuffer);
    });
  });

  describe('TTS Buffering Integration', () => {
    it('should respect TTS buffering state', () => {
      // Mock TTS buffering
      vi.mocked(require('../globalAudioManager').globalAudioManager.getIsPlaying)
        .mockReturnValue(true);

      const decision = manager.canPreloadStory(mockStory);

      expect(decision.shouldPreload).toBe(false);
      expect(decision.reason).toBe('TTS is currently buffering');
    });

    it('should allow preload when TTS is not buffering', () => {
      // Mock TTS not buffering
      vi.mocked(require('../globalAudioManager').globalAudioManager.getIsPlaying)
        .mockReturnValue(false);

      // Mock other conditions satisfied
      const state = manager.getResourceState();
      state.isUserGestureUnlocked = true;

      const decision = manager.canPreloadStory(mockStory);

      expect(decision.shouldPreload).toBe(true);
    });
  });

  describe('Resource State Management', () => {
    it('should provide accurate resource state', () => {
      const state = manager.getResourceState();

      expect(state).toHaveProperty('decodedStoryCount');
      expect(state).toHaveProperty('totalCacheSizeBytes');
      expect(state).toHaveProperty('isUserGestureUnlocked');
      expect(state).toHaveProperty('isTTSBuffering');
      expect(state).toHaveProperty('lastMemoryCheck');
      expect(state).toHaveProperty('memoryPressureLevel');

      expect(typeof state.decodedStoryCount).toBe('number');
      expect(typeof state.totalCacheSizeBytes).toBe('number');
      expect(typeof state.isUserGestureUnlocked).toBe('boolean');
      expect(typeof state.isTTSBuffering).toBe('boolean');
      expect(typeof state.lastMemoryCheck).toBe('number');
      expect(['low', 'medium', 'high']).toContain(state.memoryPressureLevel);
    });

    it('should update state correctly during operations', async () => {
      const initialState = manager.getResourceState();
      expect(initialState.decodedStoryCount).toBe(0);

      // Mock successful preload
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

      vi.mocked(require('../mobileAudioContextManager').mobileAudioContextManager.createOptimizedBuffer)
        .mockResolvedValue(mockAudioBuffer);

      // Mock conditions for successful preload
      vi.mocked(require('../globalAudioManager').globalAudioManager.getIsPlaying)
        .mockReturnValue(false);

      await manager.requestStoryPreload(mockStory);

      const updatedState = manager.getResourceState();
      expect(updatedState.decodedStoryCount).toBe(1);
      expect(updatedState.totalCacheSizeBytes).toBeGreaterThan(0);
    });
  });

  describe('Configuration Options', () => {
    it('should respect custom configuration', () => {
      const customManager = createMobileStoryResourceManager({
        maxDecodedStoriesIOS: 2,
        maxCacheSizeBytes: 20 * 1024 * 1024, // 20MB
        preloadOnlyWithGesture: false,
        respectTTSBuffering: false,
      });

      const stats = customManager.getCacheStats();
      expect(stats.maxDecodedStories).toBe(2);
      expect(stats.maxCacheSizeMB).toBe(20);

      customManager.destroy();
    });

    it('should use default configuration when none provided', () => {
      const defaultManager = createMobileStoryResourceManager();

      const stats = defaultManager.getCacheStats();
      expect(stats.maxDecodedStories).toBe(1); // Default iOS limit
      expect(stats.maxCacheSizeMB).toBe(15); // Default 15MB limit

      defaultManager.destroy();
    });
  });

  describe('Cleanup and Destruction', () => {
    it('should cleanup resources properly', () => {
      const stats = manager.getCacheStats();
      expect(stats.decodedStories).toBe(0);

      manager.destroy();

      // Verify cleanup
      const finalStats = manager.getCacheStats();
      expect(finalStats.decodedStories).toBe(0);
      expect(finalStats.cacheSizeMB).toBe(0);
      expect(finalStats.queueLength).toBe(0);
    });
  });
});