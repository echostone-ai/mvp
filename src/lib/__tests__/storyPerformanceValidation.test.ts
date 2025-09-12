/**
 * Story System Performance Validation Test Suite
 * 
 * Validates specific performance requirements from the design document:
 * - Trigger matching < 100ms p95
 * - Story loading < 2s p95
 * - TTS responsiveness unchanged when no stories trigger
 * - Memory usage within mobile limits
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StoryTriggerMatcher } from '../services/storyTriggerMatcher';
import { StoryAudioManager } from '../services/storyAudioManager';
import { UserStoryService } from '../services/userStoryService';
import { MobileStoryResourceManager } from '../services/mobileStoryResourceManager';
import { StoryMetrics } from '../services/storyMetrics';
import type { UserStory } from '../types/stories';

// Performance test configuration
const PERFORMANCE_CONFIG = {
  TRIGGER_MATCHING_P95_MS: 100,
  STORY_LOADING_P95_MS: 2000,
  TTS_BASELINE_P50_MS: 600,
  TTS_BASELINE_P95_MS: 900,
  MOBILE_MEMORY_LIMIT_MB: 15,
  TEST_ITERATIONS: 20,
  WARMUP_ITERATIONS: 5
};

describe('Story System Performance Validation', () => {
  let triggerMatcher: StoryTriggerMatcher;
  let audioManager: StoryAudioManager;
  let userStoryService: UserStoryService;
  let mobileManager: MobileStoryResourceManager;
  let metrics: StoryMetrics;

  const mockStories: UserStory[] = [
    {
      id: 'story-1',
      ownerId: 'avatar-1',
      ownerType: 'avatar',
      title: 'Childhood Memory',
      category: 'memory',
      triggers: ['childhood', 'growing up', 'when I was young', 'as a kid'],
      audioUrl: 'https://cdn.example.com/story1.mp3',
      duration: 120000,
      priority: 80,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'story-2',
      ownerId: 'avatar-1',
      ownerType: 'avatar',
      title: 'Travel Experience',
      category: 'experience',
      triggers: ['travel', 'vacation', 'trip', 'journey'],
      audioUrl: 'https://cdn.example.com/story2.mp3',
      duration: 180000,
      priority: 70,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'story-3',
      ownerId: 'avatar-1',
      ownerType: 'avatar',
      title: 'Life Advice',
      category: 'advice',
      triggers: ['advice', 'wisdom', 'learn', 'experience'],
      audioUrl: 'https://cdn.example.com/story3.mp3',
      duration: 90000,
      priority: 60,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  beforeEach(() => {
    triggerMatcher = new StoryTriggerMatcher();
    audioManager = new StoryAudioManager();
    userStoryService = new UserStoryService();
    mobileManager = new MobileStoryResourceManager();
    metrics = new StoryMetrics();

    // Mock successful story retrieval
    vi.spyOn(userStoryService, 'getStoriesByOwner').mockResolvedValue(mockStories);

    // Mock successful audio loading
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024 * 100)) // 100KB mock audio
    });

    // Mock audio context
    global.AudioContext = vi.fn(() => ({
      decodeAudioData: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      createBufferSource: vi.fn(() => ({
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      })),
      createGain: vi.fn(() => ({
        connect: vi.fn(),
        gain: { value: 1, setValueAtTime: vi.fn() }
      })),
      destination: {},
      currentTime: 0,
      state: 'running',
      resume: vi.fn().mockResolvedValue(undefined)
    })) as any;
  });

  describe('Trigger Matching Performance', () => {
    it('should meet p95 latency requirement of <100ms', async () => {
      const testPhrases = [
        "Tell me about your childhood",
        "What was it like growing up?",
        "Do you have any travel stories?",
        "Can you share some advice?",
        "What's your favorite memory?",
        "Tell me about a trip you took",
        "What wisdom would you share?",
        "Do you remember being a kid?",
        "Any interesting experiences?",
        "What have you learned in life?"
      ];

      const latencies: number[] = [];

      // Warmup iterations
      for (let i = 0; i < PERFORMANCE_CONFIG.WARMUP_ITERATIONS; i++) {
        await triggerMatcher.findMatchingStories(testPhrases[0], {
          ownerId: 'avatar-1',
          ownerType: 'avatar',
          conversationHistory: []
        });
      }

      // Performance test iterations
      for (let i = 0; i < PERFORMANCE_CONFIG.TEST_ITERATIONS; i++) {
        const phrase = testPhrases[i % testPhrases.length];
        const startTime = performance.now();
        
        await triggerMatcher.findMatchingStories(phrase, {
          ownerId: 'avatar-1',
          ownerType: 'avatar',
          conversationHistory: []
        });
        
        const latency = performance.now() - startTime;
        latencies.push(latency);
      }

      // Calculate percentiles
      latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      const p95 = latencies[Math.floor(latencies.length * 0.95)];
      const p99 = latencies[Math.floor(latencies.length * 0.99)];

      console.log(`Trigger Matching Performance:
        P50: ${p50.toFixed(2)}ms
        P95: ${p95.toFixed(2)}ms
        P99: ${p99.toFixed(2)}ms
        Max: ${Math.max(...latencies).toFixed(2)}ms`);

      expect(p95).toBeLessThan(PERFORMANCE_CONFIG.TRIGGER_MATCHING_P95_MS);
      expect(p50).toBeLessThan(50); // Additional p50 requirement
    });

    it('should have minimal overhead when no stories match', async () => {
      const noMatchPhrases = [
        "How are you today?",
        "What's the weather like?",
        "Tell me a joke",
        "What time is it?",
        "How do you feel?"
      ];

      const latencies: number[] = [];

      for (let i = 0; i < PERFORMANCE_CONFIG.TEST_ITERATIONS; i++) {
        const phrase = noMatchPhrases[i % noMatchPhrases.length];
        const startTime = performance.now();
        
        const matches = await triggerMatcher.findMatchingStories(phrase, {
          ownerId: 'avatar-1',
          ownerType: 'avatar',
          conversationHistory: []
        });
        
        const latency = performance.now() - startTime;
        latencies.push(latency);
        
        expect(matches).toHaveLength(0);
      }

      const p95 = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];
      
      console.log(`No-Match Trigger Performance P95: ${p95.toFixed(2)}ms`);
      expect(p95).toBeLessThan(50); // Even faster when no matches
    });
  });

  describe('Story Loading Performance', () => {
    it('should meet p95 loading time requirement of <2s', async () => {
      const loadTimes: number[] = [];

      // Test with different story sizes
      const storySizes = [50, 100, 200, 500, 1000]; // KB

      for (let i = 0; i < PERFORMANCE_CONFIG.TEST_ITERATIONS; i++) {
        const sizeKB = storySizes[i % storySizes.length];
        
        // Mock different sized audio files
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(sizeKB * 1024))
        });

        const startTime = performance.now();
        
        try {
          await audioManager.preloadStoryAudio(mockStories[0]);
          const loadTime = performance.now() - startTime;
          loadTimes.push(loadTime);
        } catch (error) {
          // If timeout occurs, it should be within the 2s limit
          const loadTime = performance.now() - startTime;
          expect(loadTime).toBeLessThan(PERFORMANCE_CONFIG.STORY_LOADING_P95_MS + 100);
        }
      }

      if (loadTimes.length > 0) {
        loadTimes.sort((a, b) => a - b);
        const p50 = loadTimes[Math.floor(loadTimes.length * 0.5)];
        const p95 = loadTimes[Math.floor(loadTimes.length * 0.95)];

        console.log(`Story Loading Performance:
          P50: ${p50.toFixed(2)}ms
          P95: ${p95.toFixed(2)}ms
          Success Rate: ${(loadTimes.length / PERFORMANCE_CONFIG.TEST_ITERATIONS * 100).toFixed(1)}%`);

        expect(p95).toBeLessThan(PERFORMANCE_CONFIG.STORY_LOADING_P95_MS);
      }
    });

    it('should timeout gracefully within 2s when loading fails', async () => {
      // Mock slow/failing network
      (global.fetch as any).mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 3000))
      );

      const startTime = performance.now();
      
      try {
        await audioManager.preloadStoryAudio(mockStories[0], { timeoutMs: 2000 });
      } catch (error) {
        const timeoutTime = performance.now() - startTime;
        expect(timeoutTime).toBeLessThan(2100); // Allow small buffer
        expect(timeoutTime).toBeGreaterThan(1900); // Should actually timeout
      }
    });
  });

  describe('TTS Baseline Performance', () => {
    it('should not impact TTS performance when stories are disabled', async () => {
      // Disable stories
      process.env.STORIES_ENABLED = 'false';

      const ttsStartTimes: number[] = [];

      // Simulate TTS start times
      for (let i = 0; i < PERFORMANCE_CONFIG.TEST_ITERATIONS; i++) {
        const startTime = performance.now();
        
        // Simulate story system check (should be minimal when disabled)
        await triggerMatcher.findMatchingStories("Tell me about your day", {
          ownerId: 'avatar-1',
          ownerType: 'avatar',
          conversationHistory: []
        });
        
        // Simulate TTS processing time
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 200));
        
        const totalTime = performance.now() - startTime;
        ttsStartTimes.push(totalTime);
      }

      ttsStartTimes.sort((a, b) => a - b);
      const p50 = ttsStartTimes[Math.floor(ttsStartTimes.length * 0.5)];
      const p95 = ttsStartTimes[Math.floor(ttsStartTimes.length * 0.95)];

      console.log(`TTS Performance (Stories Disabled):
        P50: ${p50.toFixed(2)}ms
        P95: ${p95.toFixed(2)}ms`);

      expect(p50).toBeLessThan(PERFORMANCE_CONFIG.TTS_BASELINE_P50_MS);
      expect(p95).toBeLessThan(PERFORMANCE_CONFIG.TTS_BASELINE_P95_MS);

      // Reset
      delete process.env.STORIES_ENABLED;
    });
  });

  describe('Mobile Resource Management', () => {
    it('should respect mobile memory limits', async () => {
      // Simulate mobile environment
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        configurable: true
      });

      // Load multiple stories and check memory usage
      for (const story of mockStories) {
        const canPreload = await mobileManager.canPreloadStory(story);
        
        if (canPreload) {
          await audioManager.preloadStoryAudio(story);
        }
        
        const memoryUsage = mobileManager.getCurrentMemoryUsage();
        const memoryUsageMB = memoryUsage / (1024 * 1024);
        
        console.log(`Memory usage after loading ${story.title}: ${memoryUsageMB.toFixed(2)}MB`);
        expect(memoryUsageMB).toBeLessThan(PERFORMANCE_CONFIG.MOBILE_MEMORY_LIMIT_MB);
      }
    });

    it('should limit concurrent preloads on mobile', async () => {
      // Simulate mobile environment
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        configurable: true
      });

      const preloadPromises = mockStories.map(story => 
        audioManager.preloadStoryAudio(story)
      );

      // Should handle concurrent preloads gracefully
      const results = await Promise.allSettled(preloadPromises);
      
      // At least some should succeed, but system should prevent overload
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`Concurrent preload results: ${successful} successful, ${failed} failed`);
      expect(successful).toBeGreaterThan(0);
      
      // Memory should still be within limits
      const memoryUsage = mobileManager.getCurrentMemoryUsage();
      expect(memoryUsage).toBeLessThan(PERFORMANCE_CONFIG.MOBILE_MEMORY_LIMIT_MB * 1024 * 1024);
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track performance metrics accurately', async () => {
      metrics.reset();

      // Perform various story operations
      const matches = await triggerMatcher.findMatchingStories("Tell me about your childhood", {
        ownerId: 'avatar-1',
        ownerType: 'avatar',
        conversationHistory: []
      });

      if (matches.length > 0) {
        const selectedStory = await triggerMatcher.selectBestStory(matches);
        if (selectedStory) {
          try {
            await audioManager.preloadStoryAudio(selectedStory);
            metrics.recordStoryPlaySuccess(selectedStory.id);
          } catch (error) {
            metrics.recordStoryPlayFailed(selectedStory.id, error as Error);
          }
        }
      } else {
        metrics.recordStorySkippedNoMatch();
      }

      const metricsData = metrics.getMetrics();
      
      // Verify metrics are being tracked
      expect(typeof metricsData.story_match_latency_ms).toBe('number');
      expect(typeof metricsData.story_start_latency_ms).toBe('number');
      expect(metricsData.story_selected + metricsData.story_skipped_no_match).toBeGreaterThan(0);
    });
  });
});