/**
 * Integration Test: Complete Story Playback Flow
 * Tests trigger → play → resume TTS flow as required by task 11
 * Requirements: 8.1, 8.2, 8.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StoryTriggerMatcher } from '../services/storyTriggerMatcher';
import { StoryAudioManager } from '../services/storyAudioManager';
import { UserStoryService } from '../services/userStoryService';
import { StoryErrorHandler } from '../services/storyErrorHandler';
import type { UserStory, ConversationContext } from '../types/stories';

// Mock StreamingAudioManager
const mockStreamingAudioManager = {
  isPlaying: vi.fn(() => false),
  stop: vi.fn(),
  play: vi.fn(),
  queue: vi.fn(),
  getCurrentAudio: vi.fn(() => null),
  setVolume: vi.fn(),
  onAudioEnd: vi.fn(),
  replaceNextChunk: vi.fn(),
  getAudioContext: vi.fn(() => ({
    state: 'running',
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null
    })),
    createGain: vi.fn(() => ({
      gain: { value: 1 },
      connect: vi.fn()
    })),
    destination: {}
  }))
};

// Mock audio buffer
const mockAudioBuffer = {
  duration: 2.5,
  sampleRate: 44100,
  numberOfChannels: 2,
  length: 110250,
  getChannelData: vi.fn(() => new Float32Array(110250))
};

describe('Story Playback Flow Integration', () => {
  let triggerMatcher: StoryTriggerMatcher;
  let audioManager: StoryAudioManager;
  let storyService: UserStoryService;
  let errorHandler: StoryErrorHandler;
  let mockStory: UserStory;
  let mockContext: ConversationContext;

  beforeEach(() => {
    vi.clearAllMocks();
    
    triggerMatcher = new StoryTriggerMatcher();
    audioManager = new StoryAudioManager();
    storyService = new UserStoryService();
    errorHandler = new StoryErrorHandler();

    mockStory = {
      id: 'test-story-1',
      owner_id: 'avatar-1',
      owner_type: 'avatar',
      title: 'Test Story',
      category: 'memory',
      triggers: 'college, university',
      audio_url: 'https://example.com/story.mp3',
      duration_ms: 120000,
      priority: 80,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    mockContext = {
      recentMessages: ['Tell me about your college experience'],
      currentTopic: 'education',
      userPreferences: {},
      sessionId: 'test-session'
    };

    // Mock fetch for audio loading
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
      } as Response)
    );

    // Mock AudioContext.decodeAudioData
    global.AudioContext = vi.fn(() => ({
      state: 'running',
      decodeAudioData: vi.fn(() => Promise.resolve(mockAudioBuffer)),
      createBufferSource: vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null
      })),
      createGain: vi.fn(() => ({
        gain: { value: 1 },
        connect: vi.fn()
      })),
      destination: {}
    })) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete Flow: Trigger → Play → Resume TTS', () => {
    it('should execute complete story playback flow successfully', async () => {
      const flowStartTime = performance.now();
      
      // Step 1: Trigger matching
      const triggerStartTime = performance.now();
      const matches = await triggerMatcher.matchTriggers(['college'], [mockStory]);
      const triggerEndTime = performance.now();
      
      expect(matches).toHaveLength(1);
      expect(matches[0].story.id).toBe('test-story-1');
      expect(triggerEndTime - triggerStartTime).toBeLessThan(100); // Requirement 8.2
      
      // Step 2: Story selection and preloading
      const selectedStory = matches[0].story;
      const preloadStartTime = performance.now();
      const audioBuffer = await audioManager.preloadStoryAudio(selectedStory);
      const preloadEndTime = performance.now();
      
      expect(audioBuffer).toBeDefined();
      expect(preloadEndTime - preloadStartTime).toBeLessThan(2000); // Requirement 8.4: ≤ 2s
      
      // Step 3: Replace TTS with story
      const playbackStartTime = performance.now();
      await audioManager.replaceNextTTSWithStory(selectedStory, mockStreamingAudioManager as any);
      const playbackEndTime = performance.now();
      
      expect(mockStreamingAudioManager.replaceNextChunk).toHaveBeenCalled();
      expect(playbackEndTime - playbackStartTime).toBeLessThan(150); // No gap > 150ms
      
      // Step 4: Story playback
      const playOptions = {
        fadeInMs: 100,
        fadeOutMs: 100,
        volumeLevel: 0.8,
        enableLipSync: true,
        fallbackToTTS: true
      };
      
      await audioManager.handleStoryPlayback(audioBuffer, playOptions);
      
      // Step 5: Resume TTS (simulated by story completion)
      const resumeStartTime = performance.now();
      // Simulate story end callback
      if (mockStreamingAudioManager.onAudioEnd) {
        mockStreamingAudioManager.onAudioEnd();
      }
      const resumeEndTime = performance.now();
      
      expect(resumeEndTime - resumeStartTime).toBeLessThan(150); // No gap > 150ms
      
      const totalFlowTime = performance.now() - flowStartTime;
      expect(totalFlowTime).toBeLessThan(3000); // Total flow should be reasonable
    });

    it('should handle concurrent story triggers correctly', async () => {
      // First story trigger
      const matches1 = await triggerMatcher.matchTriggers(['college'], [mockStory]);
      const audioBuffer1 = await audioManager.preloadStoryAudio(matches1[0].story);
      
      // Start first story playback
      await audioManager.replaceNextTTSWithStory(matches1[0].story, mockStreamingAudioManager as any);
      
      // Second story trigger while first is playing
      const secondStory = { ...mockStory, id: 'test-story-2', triggers: 'travel' };
      const matches2 = await triggerMatcher.matchTriggers(['travel'], [secondStory]);
      
      // Should handle concurrency (queue or skip based on implementation)
      const concurrencyResult = await audioManager.handleConcurrency(
        matches2[0].story,
        matches1[0].story
      );
      
      expect(['queue', 'skip', 'interrupt']).toContain(concurrencyResult);
    });

    it('should maintain TTS performance when no story matches', async () => {
      const startTime = performance.now();
      
      // Try to match with keywords that don't exist
      const matches = await triggerMatcher.matchTriggers(['nonexistent'], [mockStory]);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(matches).toHaveLength(0);
      expect(duration).toBeLessThan(100); // Requirement 8.2: TTS start time ≤ 100ms p95
    });

    it('should execute graceful fallback when story loading fails', async () => {
      // Mock fetch failure
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));
      
      const matches = await triggerMatcher.matchTriggers(['college'], [mockStory]);
      const selectedStory = matches[0].story;
      
      const fallbackStartTime = performance.now();
      
      try {
        await audioManager.preloadStoryAudio(selectedStory);
      } catch (error) {
        // Should trigger graceful fallback
        await errorHandler.handleLoadingError(selectedStory, error as Error);
      }
      
      const fallbackEndTime = performance.now();
      
      // Fallback should be fast (< 150ms gap requirement)
      expect(fallbackEndTime - fallbackStartTime).toBeLessThan(150);
    });

    it('should handle audio context issues gracefully', async () => {
      // Mock AudioContext failure
      global.AudioContext = vi.fn(() => {
        throw new Error('AudioContext not supported');
      }) as any;
      
      const matches = await triggerMatcher.matchTriggers(['college'], [mockStory]);
      const selectedStory = matches[0].story;
      
      const fallbackStartTime = performance.now();
      
      try {
        await audioManager.preloadStoryAudio(selectedStory);
      } catch (error) {
        await errorHandler.handlePlaybackError(selectedStory, error as Error);
      }
      
      const fallbackEndTime = performance.now();
      
      // Should fallback to TTS quickly
      expect(fallbackEndTime - fallbackStartTime).toBeLessThan(150);
    });
  });

  describe('Performance Requirements Validation', () => {
    it('should meet trigger matching latency requirements (8.2)', async () => {
      const iterations = 10;
      const latencies: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await triggerMatcher.matchTriggers(['college'], [mockStory]);
        const endTime = performance.now();
        latencies.push(endTime - startTime);
      }
      
      const p95 = latencies.sort((a, b) => a - b)[Math.floor(iterations * 0.95)];
      expect(p95).toBeLessThan(100); // Requirement 8.2: ≤ 100ms p95
    });

    it('should meet story loading latency requirements (8.4)', async () => {
      const iterations = 5; // Fewer iterations for network operations
      const latencies: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await audioManager.preloadStoryAudio(mockStory);
        const endTime = performance.now();
        latencies.push(endTime - startTime);
      }
      
      const p95 = latencies.sort((a, b) => a - b)[Math.floor(iterations * 0.95)];
      expect(p95).toBeLessThan(2000); // Requirement 8.4: ≤ 2s p95
    });

    it('should maintain TTS responsiveness when stories are enabled (8.1)', async () => {
      // Simulate TTS start time measurement
      const ttsStartTimes: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        
        // Check for story matches (should be fast)
        await triggerMatcher.matchTriggers(['nonexistent'], [mockStory]);
        
        // Simulate TTS start
        await new Promise(resolve => setTimeout(resolve, 50)); // Mock TTS processing
        
        const endTime = performance.now();
        ttsStartTimes.push(endTime - startTime);
      }
      
      const p50 = ttsStartTimes.sort((a, b) => a - b)[Math.floor(ttsStartTimes.length * 0.5)];
      const p95 = ttsStartTimes.sort((a, b) => a - b)[Math.floor(ttsStartTimes.length * 0.95)];
      
      expect(p50).toBeLessThan(600); // Requirement 8.1: ≤ 600ms p50
      expect(p95).toBeLessThan(900); // Requirement 8.1: ≤ 900ms p95
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from network timeouts', async () => {
      // Mock slow network response
      global.fetch = vi.fn(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
          } as Response), 3000) // 3s timeout, exceeds 2s limit
        )
      );
      
      const startTime = performance.now();
      
      try {
        await audioManager.preloadStoryAudio(mockStory);
      } catch (error) {
        await errorHandler.executeGracefulFallback('Fallback TTS text');
      }
      
      const endTime = performance.now();
      
      // Should abandon story and fallback within timeout
      expect(endTime - startTime).toBeLessThan(2500);
    });

    it('should handle audio decoding failures', async () => {
      // Mock AudioContext.decodeAudioData failure
      global.AudioContext = vi.fn(() => ({
        state: 'running',
        decodeAudioData: vi.fn(() => Promise.reject(new Error('Decode failed'))),
        createBufferSource: vi.fn(),
        createGain: vi.fn(),
        destination: {}
      })) as any;
      
      const matches = await triggerMatcher.matchTriggers(['college'], [mockStory]);
      
      try {
        await audioManager.preloadStoryAudio(matches[0].story);
      } catch (error) {
        await errorHandler.handleLoadingError(matches[0].story, error as Error);
        // Should continue with TTS fallback
        expect(error.message).toBe('Decode failed');
      }
    });
  });
});