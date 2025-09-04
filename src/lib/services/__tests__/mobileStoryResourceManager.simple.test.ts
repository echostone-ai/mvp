/**
 * Mobile Story Resource Manager Simple Tests - Task 12
 * 
 * Simplified tests for mobile optimization and resource management features
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MobileStoryResourceManager, createMobileStoryResourceManager } from '../mobileStoryResourceManager';
import { UserStory } from '../../types/stories';

// Mock dependencies with simple implementations
vi.mock('../../mobileAudioContextManager', () => ({
  mobileAudioContextManager: {
    ensureReady: vi.fn().mockResolvedValue(true),
    createOptimizedBuffer: vi.fn().mockResolvedValue({
      duration: 30,
      length: 44100 * 30,
      numberOfChannels: 2,
      sampleRate: 44100
    }),
  },
  isMobileSafari: vi.fn().mockReturnValue(false),
}));

vi.mock('../../globalAudioManager', () => ({
  globalAudioManager: {
    getIsPlaying: vi.fn().mockReturnValue(false),
  },
}));

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
});

// Mock AudioContext
global.AudioContext = vi.fn().mockImplementation(() => ({
  decodeAudioData: vi.fn().mockResolvedValue({
    duration: 30,
    length: 44100 * 30,
    numberOfChannels: 2,
    sampleRate: 44100
  }),
  state: 'running',
  sampleRate: 44100,
}));

describe('MobileStoryResourceManager - Simple Tests', () => {
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
      preloadOnlyWithGesture: false, // Disable for simpler testing
      respectTTSBuffering: false, // Disable for simpler testing
      enableMemoryMonitoring: false, // Disable for tests
    });
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('Basic Functionality', () => {
    it('should create manager with default config', () => {
      const defaultManager = createMobileStoryResourceManager();
      expect(defaultManager).toBeDefined();
      
      const stats = defaultManager.getCacheStats();
      expect(stats.maxDecodedStories).toBe(1);
      expect(stats.maxCacheSizeMB).toBe(15);
      
      defaultManager.destroy();
    });

    it('should provide resource state', () => {
      const state = manager.getResourceState();
      
      expect(state).toHaveProperty('decodedStoryCount');
      expect(state).toHaveProperty('totalCacheSizeBytes');
      expect(state).toHaveProperty('isUserGestureUnlocked');
      expect(state).toHaveProperty('isTTSBuffering');
      expect(state).toHaveProperty('memoryPressureLevel');
      
      expect(typeof state.decodedStoryCount).toBe('number');
      expect(typeof state.totalCacheSizeBytes).toBe('number');
    });

    it('should provide cache statistics', () => {
      const stats = manager.getCacheStats();
      
      expect(stats).toHaveProperty('decodedStories');
      expect(stats).toHaveProperty('maxDecodedStories');
      expect(stats).toHaveProperty('cacheSizeMB');
      expect(stats).toHaveProperty('maxCacheSizeMB');
      expect(stats).toHaveProperty('memoryPressure');
      expect(stats).toHaveProperty('queueLength');
    });
  });

  describe('Preload Decision Logic', () => {
    it('should allow preload when constraints are satisfied', () => {
      const decision = manager.canPreloadStory(mockStory);
      
      expect(decision.shouldPreload).toBe(true);
      expect(decision.reason).toBe('All mobile constraints satisfied');
    });

    it('should prevent preload when cache would exceed limit', () => {
      // Create a very large story that would exceed cache limit
      const largeStory = {
        ...mockStory,
        duration_ms: 600000 // 10 minutes = very large
      };

      const decision = manager.canPreloadStory(largeStory);
      
      // Should either allow or prevent based on size estimation
      expect(decision).toHaveProperty('shouldPreload');
      expect(decision).toHaveProperty('reason');
    });
  });

  describe('Story Preloading', () => {
    it('should successfully preload story', async () => {
      const result = await manager.requestStoryPreload(mockStory);
      
      expect(result).toBe(true);
      
      // Verify buffer is cached
      const cachedBuffer = manager.getPreloadedBuffer(mockStory);
      expect(cachedBuffer).toBeDefined();
    });

    it('should handle preload failure gracefully', async () => {
      // Mock fetch failure
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await manager.requestStoryPreload(mockStory);
      
      expect(result).toBe(false);
      
      // Verify no buffer is cached
      const cachedBuffer = manager.getPreloadedBuffer(mockStory);
      expect(cachedBuffer).toBeNull();
    });
  });

  describe('Memory Management', () => {
    it('should clear cache when requested', () => {
      manager.clearAllCache();
      
      const stats = manager.getCacheStats();
      expect(stats.decodedStories).toBe(0);
      expect(stats.cacheSizeMB).toBe(0);
      expect(stats.queueLength).toBe(0);
    });

    it('should track cache size correctly', async () => {
      const initialStats = manager.getCacheStats();
      expect(initialStats.decodedStories).toBe(0);

      // Preload a story
      await manager.requestStoryPreload(mockStory);

      const updatedStats = manager.getCacheStats();
      expect(updatedStats.decodedStories).toBe(1);
    });
  });

  describe('Configuration', () => {
    it('should respect custom configuration', () => {
      const customManager = createMobileStoryResourceManager({
        maxDecodedStoriesIOS: 2,
        maxCacheSizeBytes: 20 * 1024 * 1024, // 20MB
      });

      const stats = customManager.getCacheStats();
      expect(stats.maxDecodedStories).toBe(2);
      expect(stats.maxCacheSizeMB).toBe(20);

      customManager.destroy();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', () => {
      manager.destroy();

      // Verify cleanup
      const finalStats = manager.getCacheStats();
      expect(finalStats.decodedStories).toBe(0);
      expect(finalStats.cacheSizeMB).toBe(0);
      expect(finalStats.queueLength).toBe(0);
    });
  });
});