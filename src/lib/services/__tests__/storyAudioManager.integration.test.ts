/**
 * StoryAudioManager Integration Tests with StreamingAudioManager
 * 
 * Tests the complete integration flow between story playback and TTS streaming:
 * - Story trigger → TTS replacement → story playback → TTS resume
 * - Error scenarios and fallback behavior
 * - Performance requirements (2s timeout, <150ms gap)
 * - Mobile Safari compatibility
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { StoryAudioManager, createStoryAudioManager } from '../storyAudioManager';
import { createStreamingAudioManager, StreamingAudioManager } from '../../streamingUtils';
import { UserStory } from '../../types/stories';

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
    getAudioContext: vi.fn().mockReturnValue(null)
  },
  isMobileSafari: vi.fn().mockReturnValue(false)
}));

vi.mock('../../featureFlags', () => ({
  isFeatureEnabled: vi.fn().mockReturnValue(false) // Disable expressions for cleaner tests
}));

// Mock fetch for both story audio and TTS
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

Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn().mockImplementation(() => mockAudioContext)
});

describe('StoryAudioManager Integration Tests', () => {
  let storyAudioManager: StoryAudioManager;
  let streamingManager: StreamingAudioManager;
  let sampleStory: UserStory;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup AudioContext mocks
    mockAudioContext.decodeAudioData.mockResolvedValue(mockAudioBuffer);
    mockAudioContext.createBufferSource.mockReturnValue(mockAudioBufferSource);
    mockAudioContext.createGain.mockReturnValue(mockGainNode);
    
    // Create managers
    storyAudioManager = createStoryAudioManager({
      preloadTimeoutMs: 2000,
      fallbackToTTS: true
    });

    streamingManager = createStreamingAudioManager('test-voice-id', {}, undefined, {
      conversationId: 'test-conversation'
    });

    // Sample story
    sampleStory = {
      id: 'integration-story-1',
      owner_id: 'test-avatar',
      owner_type: 'avatar',
      title: 'Integration Test Story',
      category: 'memory',
      triggers: 'integration, test, memory',
      audio_url: 'https://example.com/integration-story.mp3',
      duration_ms: 3500,
      transcript: 'This is an integration test story.',
      priority: 80,
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    };

    // Setup fetch mocks
    setupFetchMocks();
  });

  afterEach(() => {
    storyAudioManager.destroy();
    streamingManager.stop();
  });

  function setupFetchMocks() {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('integration-story.mp3')) {
        // Story audio fetch
        return Promise.resolve({
          ok: true,
          status: 200,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
        });
      } else if (url.includes('/api/voice-stream')) {
        // TTS synthesis fetch
        return Promise.resolve({
          ok: true,
          status: 200,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(512))
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  }

  describe('Complete Story Playback Flow', () => {
    it('should complete full story → TTS resume flow successfully', async () => {
      const startTime = Date.now();

      // Step 1: Replace TTS with story
      const storyResult = await storyAudioManager.replaceNextTTSWithStory(
        sampleStory,
        streamingManager
      );

      expect(storyResult.success).toBe(true);
      expect(storyResult.story_id).toBe(sampleStory.id);
      expect(streamingManager.stop).toHaveBeenCalled();

      // Step 2: Simulate story completion
      if (mockAudioBufferSource.onended) {
        mockAudioBufferSource.onended();
      }

      // Step 3: Resume TTS conversation
      await streamingManager.addSentence('Continuing the conversation after the story.');

      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(5000); // Should complete quickly

      // Verify TTS was called for continuation
      expect(mockFetch).toHaveBeenCalledWith('/api/voice-stream', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Continuing the conversation')
      }));
    });

    it('should handle story loading timeout with seamless TTS fallback', async () => {
      // Mock slow story loading (exceeds 2s timeout)
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('integration-story.mp3')) {
          return new Promise(resolve => setTimeout(resolve, 3000));
        } else if (url.includes('/api/voice-stream')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(512))
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const startTime = Date.now();

      const result = await storyAudioManager.replaceNextTTSWithStory(
        sampleStory,
        streamingManager
      );

      const fallbackTime = Date.now() - startTime;

      expect(result.success).toBe(false);
      expect(result.fallback_used).toBe(true);
      expect(result.error_message).toContain('timeout');
      expect(fallbackTime).toBeGreaterThanOrEqual(2000);
      expect(fallbackTime).toBeLessThan(2200); // Should fallback quickly after timeout

      // Verify TTS fallback was triggered
      expect(mockFetch).toHaveBeenCalledWith('/api/voice-stream', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('memory about integration test story')
      }));
    });

    it('should maintain conversation flow during story playback errors', async () => {
      // Mock story audio fetch failure
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('integration-story.mp3')) {
          return Promise.reject(new Error('Network error'));
        } else if (url.includes('/api/voice-stream')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(512))
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const result = await storyAudioManager.replaceNextTTSWithStory(
        sampleStory,
        streamingManager
      );

      expect(result.success).toBe(false);
      expect(result.fallback_used).toBe(true);
      expect(result.error_message).toContain('Network error');

      // Should continue conversation with TTS
      await streamingManager.addSentence('The conversation continues normally.');

      expect(mockFetch).toHaveBeenCalledWith('/api/voice-stream', expect.objectContaining({
        method: 'POST'
      }));
    });
  });

  describe('Performance Requirements', () => {
    it('should meet 2-second story loading timeout requirement', async () => {
      // Mock exactly 2-second loading time
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('integration-story.mp3')) {
          return new Promise(resolve => 
            setTimeout(() => resolve({
              ok: true,
              status: 200,
              arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
            }), 1900) // Just under 2 seconds
          );
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(512))
        });
      });

      const startTime = Date.now();
      const result = await storyAudioManager.replaceNextTTSWithStory(
        sampleStory,
        streamingManager
      );
      const loadTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(loadTime).toBeLessThan(2000);
      expect(loadTime).toBeGreaterThan(1800);
    });

    it('should ensure TTS fallback gap is less than 150ms', async () => {
      // Mock story loading failure
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('integration-story.mp3')) {
          return Promise.reject(new Error('Immediate failure'));
        } else if (url.includes('/api/voice-stream')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(512))
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const startTime = Date.now();
      
      await storyAudioManager.replaceNextTTSWithStory(
        sampleStory,
        streamingManager
      );

      const fallbackTime = Date.now() - startTime;

      // Should fallback very quickly when story fails immediately
      expect(fallbackTime).toBeLessThan(150);
    });

    it('should handle concurrent story requests efficiently', async () => {
      const promises = [];
      const startTime = Date.now();

      // Try to trigger multiple stories simultaneously
      for (let i = 0; i < 3; i++) {
        const story = { ...sampleStory, id: `concurrent-story-${i}` };
        promises.push(
          storyAudioManager.replaceNextTTSWithStory(story, streamingManager)
        );
      }

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // First should succeed, others should be rejected due to concurrency
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(false);
      expect(results[1].error_message).toContain('already playing');
      expect(results[2].error_message).toContain('already playing');

      // Should handle concurrency efficiently
      expect(totalTime).toBeLessThan(3000);
    });
  });

  describe('Cooldown Integration', () => {
    it('should integrate cooldown with streaming manager conversation flow', async () => {
      const avatarId = sampleStory.owner_id;

      // First story should succeed
      const result1 = await storyAudioManager.replaceNextTTSWithStory(
        sampleStory,
        streamingManager
      );
      expect(result1.success).toBe(true);

      // Simulate story completion to clear concurrency lock
      if (mockAudioBufferSource.onended) {
        mockAudioBufferSource.onended();
      }

      // Second story should be rejected due to cooldown
      const result2 = await storyAudioManager.replaceNextTTSWithStory(
        { ...sampleStory, id: 'cooldown-story-2' },
        streamingManager
      );
      expect(result2.success).toBe(false);
      expect(result2.error_message).toContain('cooldown');

      // But TTS should continue working normally
      await streamingManager.addSentence('Normal conversation continues during cooldown.');
      
      expect(mockFetch).toHaveBeenCalledWith('/api/voice-stream', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Normal conversation continues')
      }));
    });
  });

  describe('Error Recovery Integration', () => {
    it('should recover gracefully from AudioContext errors', async () => {
      // Mock AudioContext failure
      mockAudioContext.decodeAudioData.mockRejectedValue(new Error('AudioContext error'));

      const result = await storyAudioManager.replaceNextTTSWithStory(
        sampleStory,
        streamingManager
      );

      // Should fallback to HTML Audio and still work
      expect(result.success).toBe(true);
      expect(result.fallback_used).toBe(true);

      // TTS should continue working after error
      await streamingManager.addSentence('Conversation continues after audio error.');
      
      expect(mockFetch).toHaveBeenCalledWith('/api/voice-stream', expect.any(Object));
    });

    it('should handle streaming manager errors during fallback', async () => {
      // Mock story failure
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('integration-story.mp3')) {
          return Promise.reject(new Error('Story load failed'));
        } else if (url.includes('/api/voice-stream')) {
          return Promise.reject(new Error('TTS also failed'));
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const result = await storyAudioManager.replaceNextTTSWithStory(
        sampleStory,
        streamingManager
      );

      expect(result.success).toBe(false);
      expect(result.fallback_used).toBe(false);
      expect(result.error_message).toContain('TTS fallback also failed');
    });
  });

  describe('Mobile Safari Integration', () => {
    beforeEach(() => {
      const { isMobileSafari } = require('../../mobileAudioContextManager');
      (isMobileSafari as Mock).mockReturnValue(true);
    });

    it('should handle mobile Safari audio context requirements', async () => {
      const { mobileAudioContextManager } = require('../../mobileAudioContextManager');
      
      const result = await storyAudioManager.replaceNextTTSWithStory(
        sampleStory,
        streamingManager
      );

      expect(mobileAudioContextManager.ensureReady).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should fallback gracefully when mobile audio context fails', async () => {
      const { mobileAudioContextManager } = require('../../mobileAudioContextManager');
      mobileAudioContextManager.ensureReady.mockResolvedValue(false);

      const result = await storyAudioManager.replaceNextTTSWithStory(
        sampleStory,
        streamingManager
      );

      // Should still work with HTML Audio fallback
      expect(result.success).toBe(true);
      expect(result.fallback_used).toBe(true);
    });
  });

  describe('Memory Management Integration', () => {
    it('should manage memory efficiently during long conversations', async () => {
      const initialStats = storyAudioManager.getCacheStats();
      
      // Simulate multiple story triggers over time
      for (let i = 0; i < 5; i++) {
        const story = { 
          ...sampleStory, 
          id: `memory-story-${i}`,
          audio_url: `https://example.com/story-${i}.mp3`
        };
        
        await storyAudioManager.preloadStoryAudio(story);
        
        // Simulate some TTS activity
        await streamingManager.addSentence(`This is sentence ${i} in the conversation.`);
      }

      const finalStats = storyAudioManager.getCacheStats();
      
      expect(finalStats.entries).toBeGreaterThan(initialStats.entries);
      expect(finalStats.sizeMB).toBeLessThan(15); // Should stay within 15MB limit
    });

    it('should cleanup resources properly when managers are destroyed', async () => {
      await storyAudioManager.preloadStoryAudio(sampleStory);
      
      const statsBeforeDestroy = storyAudioManager.getCacheStats();
      expect(statsBeforeDestroy.entries).toBeGreaterThan(0);

      storyAudioManager.destroy();
      streamingManager.stop();

      const statsAfterDestroy = storyAudioManager.getCacheStats();
      expect(statsAfterDestroy.entries).toBe(0);
      expect(statsAfterDestroy.sizeBytes).toBe(0);
    });
  });

  describe('Real-world Conversation Scenarios', () => {
    it('should handle rapid conversation with story interruptions', async () => {
      // Start normal conversation
      await streamingManager.addSentence('Tell me about your childhood.');
      
      // Trigger story mid-conversation
      const storyResult = await storyAudioManager.replaceNextTTSWithStory(
        sampleStory,
        streamingManager
      );
      expect(storyResult.success).toBe(true);

      // Simulate story completion
      if (mockAudioBufferSource.onended) {
        mockAudioBufferSource.onended();
      }

      // Continue conversation
      await streamingManager.addSentence('That was a beautiful memory.');
      await streamingManager.addSentence('Tell me more about that time.');

      // Verify all TTS calls were made
      const ttsCallCount = mockFetch.mock.calls.filter(call => 
        call[0].includes('/api/voice-stream')
      ).length;
      
      expect(ttsCallCount).toBeGreaterThanOrEqual(3); // Initial + fallback + continuations
    });

    it('should maintain conversation quality during story system failures', async () => {
      // Mock intermittent story failures
      let failureCount = 0;
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('integration-story.mp3')) {
          failureCount++;
          if (failureCount % 2 === 1) {
            return Promise.reject(new Error('Intermittent failure'));
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
          });
        } else if (url.includes('/api/voice-stream')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(512))
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      // Try multiple story triggers with failures
      const results = [];
      for (let i = 0; i < 4; i++) {
        const story = { ...sampleStory, id: `failure-story-${i}` };
        
        // Wait for cooldown between attempts
        if (i > 0) {
          const originalNow = Date.now;
          Date.now = vi.fn().mockReturnValue(originalNow() + 31000);
        }
        
        const result = await storyAudioManager.replaceNextTTSWithStory(
          story,
          streamingManager
        );
        results.push(result);

        // Simulate story completion if successful
        if (result.success && mockAudioBufferSource.onended) {
          mockAudioBufferSource.onended();
        }

        // Continue conversation regardless of story success
        await streamingManager.addSentence(`Continuing conversation after attempt ${i}.`);
      }

      // Should have mix of successes and failures, but conversation continues
      const successes = results.filter(r => r.success).length;
      const failures = results.filter(r => !r.success).length;
      
      expect(successes).toBeGreaterThan(0);
      expect(failures).toBeGreaterThan(0);
      
      // All TTS continuations should have worked
      const ttsCallCount = mockFetch.mock.calls.filter(call => 
        call[0].includes('/api/voice-stream')
      ).length;
      expect(ttsCallCount).toBeGreaterThanOrEqual(4);
    });
  });
});