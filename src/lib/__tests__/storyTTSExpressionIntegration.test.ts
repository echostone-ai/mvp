/**
 * Story System Integration with TTS and Expression Overlays
 * 
 * Tests the complete integration between:
 * - Story system
 * - ElevenLabs TTS pipeline
 * - Expression overlay system
 * - StreamingAudioManager
 * - SimpleExpressionPlayer
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StoryAudioManager } from '../services/storyAudioManager';
import { StoryTriggerMatcher } from '../services/storyTriggerMatcher';
import { UserStoryService } from '../services/userStoryService';
import { StreamingAudioManager } from '../streamingUtils';
import { SimpleExpressionPlayer } from '../simpleExpressionPlayer';
import { StoryMetrics } from '../services/storyMetrics';
import type { UserStory, ConversationContext } from '../types/stories';

// Mock TTS service
class MockTTSService {
  private isStreaming = false;
  private currentStream: any = null;

  async startStreaming(text: string): Promise<ReadableStream> {
    this.isStreaming = true;
    
    // Simulate TTS streaming with chunks
    const stream = new ReadableStream({
      start(controller) {
        // Simulate audio chunks
        const chunks = ['chunk1', 'chunk2', 'chunk3'];
        chunks.forEach((chunk, index) => {
          setTimeout(() => {
            controller.enqueue(new Uint8Array([index]));
            if (index === chunks.length - 1) {
              controller.close();
            }
          }, index * 100);
        });
      }
    });

    this.currentStream = stream;
    return stream;
  }

  stopStreaming(): void {
    this.isStreaming = false;
    if (this.currentStream) {
      this.currentStream.cancel();
      this.currentStream = null;
    }
  }

  isCurrentlyStreaming(): boolean {
    return this.isStreaming;
  }

  getLatency(): number {
    return Math.random() * 200 + 400; // 400-600ms baseline
  }
}

// Mock Expression Player
class MockExpressionPlayer {
  private isPlaying = false;
  private currentExpression: string | null = null;
  private queue: string[] = [];

  async playExpression(expression: string): Promise<void> {
    this.isPlaying = true;
    this.currentExpression = expression;
    
    // Simulate expression playback
    return new Promise(resolve => {
      setTimeout(() => {
        this.isPlaying = false;
        this.currentExpression = null;
        resolve();
      }, 500);
    });
  }

  pause(): void {
    this.isPlaying = false;
  }

  resume(): void {
    if (this.currentExpression) {
      this.isPlaying = true;
    }
  }

  getState() {
    return {
      isPlaying: this.isPlaying,
      currentExpression: this.currentExpression,
      queue: [...this.queue]
    };
  }

  queueExpression(expression: string): void {
    this.queue.push(expression);
  }

  clearQueue(): void {
    this.queue = [];
  }
}

describe('Story System Integration with TTS and Expressions', () => {
  let storyAudioManager: StoryAudioManager;
  let storyTriggerMatcher: StoryTriggerMatcher;
  let userStoryService: UserStoryService;
  let streamingAudioManager: StreamingAudioManager;
  let expressionPlayer: MockExpressionPlayer;
  let ttsService: MockTTSService;
  let storyMetrics: StoryMetrics;

  const mockStory: UserStory = {
    id: 'integration-story-1',
    ownerId: 'test-avatar',
    ownerType: 'avatar',
    title: 'Integration Test Story',
    category: 'memory',
    triggers: ['childhood', 'growing up', 'school days'],
    audioUrl: 'https://cdn.example.com/integration-story.mp3',
    duration: 90000, // 1.5 minutes
    priority: 80,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const mockConversationContext: ConversationContext = {
    ownerId: 'test-avatar',
    ownerType: 'avatar',
    conversationHistory: [
      { role: 'user', content: 'Tell me about yourself' },
      { role: 'assistant', content: 'I\'d be happy to share some stories with you.' }
    ]
  };

  beforeEach(() => {
    // Initialize services
    storyAudioManager = new StoryAudioManager();
    storyTriggerMatcher = new StoryTriggerMatcher();
    userStoryService = new UserStoryService();
    streamingAudioManager = new StreamingAudioManager();
    expressionPlayer = new MockExpressionPlayer();
    ttsService = new MockTTSService();
    storyMetrics = new StoryMetrics();

    // Mock audio context
    global.AudioContext = vi.fn(() => ({
      createBufferSource: vi.fn(() => ({
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        buffer: null,
        onended: null
      })),
      createGain: vi.fn(() => ({
        connect: vi.fn(),
        gain: { value: 1, setValueAtTime: vi.fn() }
      })),
      destination: {},
      currentTime: 0,
      state: 'running',
      resume: vi.fn().mockResolvedValue(undefined),
      decodeAudioData: vi.fn().mockResolvedValue(new ArrayBuffer(1024))
    })) as any;

    // Mock successful story fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    });

    // Mock story service
    vi.spyOn(userStoryService, 'getStoriesByOwner').mockResolvedValue([mockStory]);

    // Reset metrics
    storyMetrics.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Integration Flow', () => {
    it('should integrate story playback with TTS pipeline seamlessly', async () => {
      const conversationText = "Tell me about your childhood and growing up";
      
      // 1. Start TTS streaming (baseline)
      const ttsStartTime = performance.now();
      const ttsStream = await ttsService.startStreaming("I'd love to share a story about my childhood...");
      const ttsLatency = performance.now() - ttsStartTime;
      
      expect(ttsLatency).toBeLessThan(600); // Baseline TTS performance
      expect(ttsService.isCurrentlyStreaming()).toBe(true);

      // 2. Trigger story matching
      const triggerStartTime = performance.now();
      const matches = await storyTriggerMatcher.findMatchingStories(
        conversationText,
        mockConversationContext
      );
      const triggerLatency = performance.now() - triggerStartTime;

      expect(triggerLatency).toBeLessThan(100); // Trigger matching requirement
      expect(matches).toHaveLength(1);
      expect(matches[0].matchedKeywords).toContain('childhood');

      // 3. Select and load story
      const selectedStory = await storyTriggerMatcher.selectBestStory(matches);
      expect(selectedStory).toBeTruthy();

      const storyLoadStartTime = performance.now();
      const audioBuffer = await storyAudioManager.preloadStoryAudio(selectedStory!);
      const storyLoadLatency = performance.now() - storyLoadStartTime;

      expect(storyLoadLatency).toBeLessThan(2000); // Story loading requirement
      expect(audioBuffer).toBeTruthy();

      // 4. Replace TTS with story
      ttsService.stopStreaming();
      expect(ttsService.isCurrentlyStreaming()).toBe(false);

      const replacementSuccess = await storyAudioManager.replaceNextTTSWithStory(
        selectedStory!,
        streamingAudioManager
      );
      expect(replacementSuccess).toBe(true);

      // 5. Verify metrics
      const metrics = storyMetrics.getMetrics();
      expect(metrics.story_selected).toBe(1);
      expect(metrics.story_play_success).toBe(1);
    });

    it('should coordinate with expression system during story playback', async () => {
      // 1. Start expression playback
      await expressionPlayer.playExpression('smile');
      expect(expressionPlayer.getState().isPlaying).toBe(true);

      // 2. Trigger story
      const matches = await storyTriggerMatcher.findMatchingStories(
        "Tell me about your school days",
        mockConversationContext
      );

      const selectedStory = await storyTriggerMatcher.selectBestStory(matches);
      expect(selectedStory).toBeTruthy();

      // 3. Story should coordinate with expressions
      const audioBuffer = await storyAudioManager.preloadStoryAudio(selectedStory!);
      
      await storyAudioManager.handleStoryPlayback(audioBuffer, {
        enableExpressionCoordination: true,
        onStart: () => {
          // Should pause expressions during story
          expressionPlayer.pause();
        },
        onComplete: () => {
          // Should resume expressions after story
          expressionPlayer.resume();
        }
      });

      // Verify expression coordination
      expect(expressionPlayer.getState().isPlaying).toBe(false); // Paused during story
    });

    it('should maintain TTS performance when no stories match', async () => {
      const noMatchText = "What's the weather like today?";
      
      // 1. Measure baseline TTS performance
      const baselineTimes: number[] = [];
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        await ttsService.startStreaming("The weather is nice today.");
        const latency = performance.now() - startTime;
        baselineTimes.push(latency);
        ttsService.stopStreaming();
      }

      const baselineP50 = baselineTimes.sort((a, b) => a - b)[Math.floor(baselineTimes.length * 0.5)];

      // 2. Measure TTS performance with story system active
      const withStoryTimes: number[] = [];
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        
        // Check for story matches (should find none)
        const matches = await storyTriggerMatcher.findMatchingStories(
          noMatchText,
          mockConversationContext
        );
        expect(matches).toHaveLength(0);
        
        // Start TTS
        await ttsService.startStreaming("The weather is nice today.");
        const totalLatency = performance.now() - startTime;
        withStoryTimes.push(totalLatency);
        ttsService.stopStreaming();
      }

      const withStoryP50 = withStoryTimes.sort((a, b) => a - b)[Math.floor(withStoryTimes.length * 0.5)];

      // 3. Verify minimal impact
      const performanceImpact = withStoryP50 - baselineP50;
      expect(performanceImpact).toBeLessThan(50); // < 50ms additional latency
      expect(withStoryP50).toBeLessThan(600); // Still meets TTS requirement
    });
  });

  describe('Error Handling and Fallback Integration', () => {
    it('should fallback to TTS when story loading fails', async () => {
      // Mock story loading failure
      (global.fetch as any).mockRejectedValueOnce(new Error('Network timeout'));

      const conversationText = "Tell me about your childhood";
      const fallbackText = "I'd love to share a story about my childhood...";

      // 1. Trigger story matching
      const matches = await storyTriggerMatcher.findMatchingStories(
        conversationText,
        mockConversationContext
      );
      expect(matches).toHaveLength(1);

      const selectedStory = await storyTriggerMatcher.selectBestStory(matches);

      // 2. Story loading should fail and fallback to TTS
      const fallbackStartTime = performance.now();
      
      try {
        await storyAudioManager.preloadStoryAudio(selectedStory!, { timeoutMs: 2000 });
      } catch (error) {
        // Should fallback to TTS within timeout
        const fallbackTime = performance.now() - fallbackStartTime;
        expect(fallbackTime).toBeLessThan(2100);

        // Start TTS fallback
        const ttsStream = await ttsService.startStreaming(fallbackText);
        expect(ttsStream).toBeTruthy();
        expect(ttsService.isCurrentlyStreaming()).toBe(true);
      }

      // 3. Verify fallback metrics
      const metrics = storyMetrics.getMetrics();
      expect(metrics.story_fallback_tts).toBe(1);
    });

    it('should handle concurrent story and expression requests', async () => {
      // 1. Start expression
      const expressionPromise = expressionPlayer.playExpression('laugh');

      // 2. Trigger story simultaneously
      const matches = await storyTriggerMatcher.findMatchingStories(
        "Tell me about growing up",
        mockConversationContext
      );

      const selectedStory = await storyTriggerMatcher.selectBestStory(matches);
      const storyPromise = storyAudioManager.preloadStoryAudio(selectedStory!);

      // 3. Both should complete without interference
      const [expressionResult, storyResult] = await Promise.allSettled([
        expressionPromise,
        storyPromise
      ]);

      expect(expressionResult.status).toBe('fulfilled');
      expect(storyResult.status).toBe('fulfilled');
    });

    it('should handle TTS interruption gracefully', async () => {
      // 1. Start TTS streaming
      const ttsStream = await ttsService.startStreaming("I was just about to tell you...");
      expect(ttsService.isCurrentlyStreaming()).toBe(true);

      // 2. Trigger story that should interrupt TTS
      const matches = await storyTriggerMatcher.findMatchingStories(
        "Tell me about your childhood",
        mockConversationContext
      );

      const selectedStory = await storyTriggerMatcher.selectBestStory(matches);
      const audioBuffer = await storyAudioManager.preloadStoryAudio(selectedStory!);

      // 3. Replace TTS with story
      const replacementSuccess = await storyAudioManager.replaceNextTTSWithStory(
        selectedStory!,
        streamingAudioManager
      );

      expect(replacementSuccess).toBe(true);
      
      // TTS should be stopped
      ttsService.stopStreaming();
      expect(ttsService.isCurrentlyStreaming()).toBe(false);
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance with multiple concurrent operations', async () => {
      const concurrentOperations = 5;
      const operations: Promise<any>[] = [];

      // Start multiple concurrent operations
      for (let i = 0; i < concurrentOperations; i++) {
        const operation = async () => {
          // Mix of TTS and story operations
          if (i % 2 === 0) {
            // TTS operation
            const stream = await ttsService.startStreaming(`Message ${i}`);
            await new Promise(resolve => setTimeout(resolve, 100));
            ttsService.stopStreaming();
            return { type: 'tts', index: i };
          } else {
            // Story operation
            const matches = await storyTriggerMatcher.findMatchingStories(
              `Tell me about your childhood story ${i}`,
              mockConversationContext
            );
            if (matches.length > 0) {
              const story = await storyTriggerMatcher.selectBestStory(matches);
              await storyAudioManager.preloadStoryAudio(story!);
            }
            return { type: 'story', index: i };
          }
        };

        operations.push(operation());
      }

      // Wait for all operations to complete
      const startTime = performance.now();
      const results = await Promise.allSettled(operations);
      const totalTime = performance.now() - startTime;

      // Verify all operations completed successfully
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBe(concurrentOperations);

      // Verify reasonable performance under load
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`Concurrent operations completed in ${totalTime.toFixed(2)}ms`);
    });

    it('should handle rapid story trigger requests', async () => {
      const rapidRequests = 10;
      const requestTimes: number[] = [];

      for (let i = 0; i < rapidRequests; i++) {
        const startTime = performance.now();
        
        const matches = await storyTriggerMatcher.findMatchingStories(
          `Rapid request ${i} about childhood`,
          mockConversationContext
        );
        
        const requestTime = performance.now() - startTime;
        requestTimes.push(requestTime);

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Verify all requests completed quickly
      const maxRequestTime = Math.max(...requestTimes);
      const avgRequestTime = requestTimes.reduce((a, b) => a + b, 0) / requestTimes.length;

      expect(maxRequestTime).toBeLessThan(100); // Max 100ms per request
      expect(avgRequestTime).toBeLessThan(50); // Average < 50ms

      console.log(`Rapid requests: avg ${avgRequestTime.toFixed(2)}ms, max ${maxRequestTime.toFixed(2)}ms`);
    });
  });

  describe('Feature Flag Integration', () => {
    it('should respect global feature flag', async () => {
      // Disable stories globally
      process.env.STORIES_ENABLED = 'false';

      const conversationText = "Tell me about your childhood";
      
      // Should skip story processing entirely
      const matches = await storyTriggerMatcher.findMatchingStories(
        conversationText,
        mockConversationContext
      );

      expect(matches).toHaveLength(0);

      // TTS should work normally
      const ttsStream = await ttsService.startStreaming("I'd be happy to chat with you.");
      expect(ttsStream).toBeTruthy();

      // Reset
      delete process.env.STORIES_ENABLED;
    });

    it('should allow instant rollback during active conversation', async () => {
      // Start with stories enabled
      const conversationText = "Tell me about your childhood";
      
      // 1. Trigger story normally
      let matches = await storyTriggerMatcher.findMatchingStories(
        conversationText,
        mockConversationContext
      );
      expect(matches).toHaveLength(1);

      // 2. Disable stories mid-conversation
      process.env.STORIES_ENABLED = 'false';

      // 3. Next trigger should skip stories
      matches = await storyTriggerMatcher.findMatchingStories(
        conversationText,
        mockConversationContext
      );
      expect(matches).toHaveLength(0);

      // 4. TTS should continue working
      const ttsStream = await ttsService.startStreaming("Let me tell you about that...");
      expect(ttsStream).toBeTruthy();

      // Reset
      delete process.env.STORIES_ENABLED;
    });
  });
});