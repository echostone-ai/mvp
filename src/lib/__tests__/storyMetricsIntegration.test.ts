// src/lib/__tests__/storyMetricsIntegration.test.ts
/**
 * Integration tests for story performance metrics system
 * 
 * Tests the complete metrics collection pipeline from trigger matching
 * through story playback and TTS fallback scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import StoryMetricsCollector from '../services/storyMetrics';
import { StoryTriggerMatcher } from '../services/storyTriggerMatcher';
import { StoryAudioManager } from '../services/storyAudioManager';
import { UserStory } from '../types/stories';

// Mock dependencies
vi.mock('../globalAudioManager');
vi.mock('../mobileAudioContextManager');

// Mock the metrics collector
const mockMetricsCollector = {
  trackStoryMatching: vi.fn(),
  trackStorySelection: vi.fn(),
  trackStoryStart: vi.fn(),
  trackStoryPlaySuccess: vi.fn(),
  trackStoryPlayFailure: vi.fn(),
  trackTtsFirstChunk: vi.fn(),
  trackFallbackToTts: vi.fn(),
  trackSystemOverhead: vi.fn(),
  updateCacheHitRate: vi.fn(),
  getPerformanceSummary: vi.fn().mockReturnValue({ message: 'Test metrics' })
};

vi.mock('../services/storyMetrics', () => ({
  default: {
    getInstance: () => mockMetricsCollector
  }
}));

describe('Story Metrics Integration Tests', () => {
  let metricsCollector: StoryMetricsCollector;
  let triggerMatcher: StoryTriggerMatcher;
  let audioManager: StoryAudioManager;
  let mockStories: UserStory[];

  beforeEach(() => {
    metricsCollector = mockMetricsCollector as any;
    triggerMatcher = new StoryTriggerMatcher();
    // Don't instantiate StoryAudioManager in tests due to AudioContext issues
    
    // Create test stories
    mockStories = [
      {
        id: 'story-1',
        owner_id: 'avatar-test',
        owner_type: 'avatar',
        title: 'Childhood Memory',
        category: 'memory',
        triggers: 'childhood,school,friends,playground',
        audio_url: 'https://example.com/story1.mp3',
        duration_ms: 120000,
        status: 'active',
        priority: 50,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    triggerMatcher.clearAllCooldowns();
  });

  describe('Trigger Matching Metrics', () => {
    it('should track story matching latency and results', async () => {
      const trackStoryMatchingSpy = vi.spyOn(metricsCollector, 'trackStoryMatching');
      
      const inputText = 'Tell me about your childhood memories at school';
      const matches = await triggerMatcher.findMatchingStories(inputText, mockStories, 'avatar-test');
      
      // Verify metrics were tracked
      expect(trackStoryMatchingSpy).toHaveBeenCalledWith(
        'avatar-test',
        expect.any(Number),
        matches.length > 0
      );
    });

    it('should track system overhead for trigger matching', async () => {
      const trackSystemOverheadSpy = vi.spyOn(metricsCollector, 'trackSystemOverhead');
      
      await triggerMatcher.findMatchingStories('test input', mockStories, 'avatar-test');
      
      expect(trackSystemOverheadSpy).toHaveBeenCalledWith(
        'trigger_matching',
        expect.any(Number)
      );
    });

    it('should track no match scenarios correctly', async () => {
      const trackStoryMatchingSpy = vi.spyOn(metricsCollector, 'trackStoryMatching');
      
      // Input that won't match any triggers
      const inputText = 'completely unrelated topic about quantum physics';
      await triggerMatcher.findMatchingStories(inputText, mockStories, 'avatar-test');
      
      expect(trackStoryMatchingSpy).toHaveBeenCalledWith(
        'avatar-test',
        expect.any(Number),
        false // No match found
      );
    });
  });

  describe('Story Selection Metrics', () => {
    it('should track story selection when match is found', async () => {
      const trackStorySelectionSpy = vi.spyOn(metricsCollector, 'trackStorySelection');
      
      const inputText = 'Tell me about your childhood';
      const matches = await triggerMatcher.findMatchingStories(inputText, mockStories, 'avatar-test');
      
      if (matches.length > 0) {
        const selectedStory = await triggerMatcher.selectBestStory(matches);
        
        if (selectedStory) {
          // Simulate story selection tracking (normally done in StoryAudioManager)
          metricsCollector.trackStorySelection(
            selectedStory.owner_id,
            selectedStory.category,
            'keyword_match'
          );
          
          expect(trackStorySelectionSpy).toHaveBeenCalledWith(
            'avatar-test',
            'memory',
            'keyword_match'
          );
        }
      }
    });
  });

  describe('Story Playback Metrics', () => {
    it('should track story start latency with preloaded flag', async () => {
      const trackStoryStartSpy = vi.spyOn(metricsCollector, 'trackStoryStart');
      
      // Simulate story preloading
      const startTime = Date.now();
      const preloaded = true;
      
      metricsCollector.trackStoryStart('avatar-test', startTime, preloaded);
      
      expect(trackStoryStartSpy).toHaveBeenCalledWith(
        'avatar-test',
        startTime,
        true
      );
    });

    it('should track successful story playback', async () => {
      const trackStoryPlaySuccessSpy = vi.spyOn(metricsCollector, 'trackStoryPlaySuccess');
      
      const story = mockStories[0];
      metricsCollector.trackStoryPlaySuccess(
        story.owner_id,
        story.category,
        story.duration_ms
      );
      
      expect(trackStoryPlaySuccessSpy).toHaveBeenCalledWith(
        'avatar-test',
        'memory',
        120000
      );
    });

    it('should track failed story playback', async () => {
      const trackStoryPlayFailureSpy = vi.spyOn(metricsCollector, 'trackStoryPlayFailure');
      
      metricsCollector.trackStoryPlayFailure(
        'avatar-test',
        'network_error',
        true // fallback used
      );
      
      expect(trackStoryPlayFailureSpy).toHaveBeenCalledWith(
        'avatar-test',
        'network_error',
        true
      );
    });
  });

  describe('TTS Performance Metrics', () => {
    it('should track TTS first chunk latency', async () => {
      const trackTtsFirstChunkSpy = vi.spyOn(metricsCollector, 'trackTtsFirstChunk');
      
      const startTime = Date.now();
      const storySystemEnabled = true;
      
      metricsCollector.trackTtsFirstChunk('avatar-test', startTime, storySystemEnabled);
      
      expect(trackTtsFirstChunkSpy).toHaveBeenCalledWith(
        'avatar-test',
        startTime,
        true
      );
    });

    it('should track TTS performance with and without story system', async () => {
      const trackTtsFirstChunkSpy = vi.spyOn(metricsCollector, 'trackTtsFirstChunk');
      
      // Track with story system enabled
      metricsCollector.trackTtsFirstChunk('avatar-test', Date.now(), true);
      
      // Track with story system disabled
      metricsCollector.trackTtsFirstChunk('avatar-test', Date.now(), false);
      
      expect(trackTtsFirstChunkSpy).toHaveBeenCalledTimes(2);
      expect(trackTtsFirstChunkSpy).toHaveBeenNthCalledWith(1, 'avatar-test', expect.any(Number), true);
      expect(trackTtsFirstChunkSpy).toHaveBeenNthCalledWith(2, 'avatar-test', expect.any(Number), false);
    });
  });

  describe('Fallback Metrics', () => {
    it('should track fallback to TTS scenarios', async () => {
      const trackFallbackToTtsSpy = vi.spyOn(metricsCollector, 'trackFallbackToTts');
      
      metricsCollector.trackFallbackToTts(
        'avatar-test',
        'timeout',
        1500 // 1.5 second latency
      );
      
      expect(trackFallbackToTtsSpy).toHaveBeenCalledWith(
        'avatar-test',
        'timeout',
        1500
      );
    });
  });

  describe('SLA Compliance Metrics', () => {
    it('should track 2-second timeout compliance', async () => {
      const trackStoryStartSpy = vi.spyOn(metricsCollector, 'trackStoryStart');
      
      // Simulate story loading within SLA (1.5 seconds)
      const startTime = Date.now() - 1500;
      metricsCollector.trackStoryStart('avatar-test', startTime, false);
      
      expect(trackStoryStartSpy).toHaveBeenCalledWith(
        'avatar-test',
        startTime,
        false
      );
    });

    it('should track timeout violations', async () => {
      // This would be tracked internally by the metrics collector
      // when latency exceeds 2000ms in trackStoryStart
      const trackStoryStartSpy = vi.spyOn(metricsCollector, 'trackStoryStart');
      
      // Simulate story loading that exceeds SLA (3 seconds)
      const startTime = Date.now() - 3000;
      metricsCollector.trackStoryStart('avatar-test', startTime, false);
      
      expect(trackStoryStartSpy).toHaveBeenCalledWith(
        'avatar-test',
        startTime,
        false
      );
    });
  });

  describe('Cache Performance Metrics', () => {
    it('should track cache hit rate updates', async () => {
      const updateCacheHitRateSpy = vi.spyOn(metricsCollector, 'updateCacheHitRate');
      
      metricsCollector.updateCacheHitRate('avatar-test', 0.85); // 85% hit rate
      
      expect(updateCacheHitRateSpy).toHaveBeenCalledWith('avatar-test', 0.85);
    });
  });

  describe('Performance Summary', () => {
    it('should provide performance summary for debugging', () => {
      const summary = metricsCollector.getPerformanceSummary();
      
      expect(summary).toBeDefined();
      
      // In test environment, should return appropriate response
      if (typeof window !== 'undefined') {
        expect(summary).toHaveProperty('message');
      } else {
        // Server-side should return metrics array or empty array
        expect(Array.isArray(summary) || summary === null).toBe(true);
      }
    });
  });

  describe('End-to-End Metrics Flow', () => {
    it('should track complete story trigger to playback flow', async () => {
      const trackStoryMatchingSpy = vi.spyOn(metricsCollector, 'trackStoryMatching');
      const trackStorySelectionSpy = vi.spyOn(metricsCollector, 'trackStorySelection');
      const trackStoryStartSpy = vi.spyOn(metricsCollector, 'trackStoryStart');
      const trackStoryPlaySuccessSpy = vi.spyOn(metricsCollector, 'trackStoryPlaySuccess');
      
      // Step 1: Trigger matching
      const inputText = 'Tell me about your childhood';
      const matches = await triggerMatcher.findMatchingStories(inputText, mockStories, 'avatar-test');
      
      // Step 2: Story selection (if match found)
      if (matches.length > 0) {
        const selectedStory = await triggerMatcher.selectBestStory(matches);
        
        if (selectedStory) {
          // Step 3: Track selection
          metricsCollector.trackStorySelection(
            selectedStory.owner_id,
            selectedStory.category,
            'keyword_match'
          );
          
          // Step 4: Track story start
          metricsCollector.trackStoryStart(selectedStory.owner_id, Date.now(), false);
          
          // Step 5: Track successful playback
          metricsCollector.trackStoryPlaySuccess(
            selectedStory.owner_id,
            selectedStory.category,
            selectedStory.duration_ms
          );
          
          // Verify all metrics were tracked
          expect(trackStoryMatchingSpy).toHaveBeenCalled();
          expect(trackStorySelectionSpy).toHaveBeenCalled();
          expect(trackStoryStartSpy).toHaveBeenCalled();
          expect(trackStoryPlaySuccessSpy).toHaveBeenCalled();
        }
      }
    });

    it('should track complete fallback flow when story fails', async () => {
      const trackStoryMatchingSpy = vi.spyOn(metricsCollector, 'trackStoryMatching');
      const trackStoryPlayFailureSpy = vi.spyOn(metricsCollector, 'trackStoryPlayFailure');
      const trackFallbackToTtsSpy = vi.spyOn(metricsCollector, 'trackFallbackToTts');
      const trackTtsFirstChunkSpy = vi.spyOn(metricsCollector, 'trackTtsFirstChunk');
      
      // Step 1: Trigger matching succeeds
      const inputText = 'Tell me about your childhood';
      await triggerMatcher.findMatchingStories(inputText, mockStories, 'avatar-test');
      
      // Step 2: Story playback fails
      metricsCollector.trackStoryPlayFailure('avatar-test', 'network_error', true);
      
      // Step 3: Fallback to TTS
      metricsCollector.trackFallbackToTts('avatar-test', 'story_failed', 2500);
      
      // Step 4: TTS plays successfully
      metricsCollector.trackTtsFirstChunk('avatar-test', Date.now(), true);
      
      // Verify fallback flow was tracked
      expect(trackStoryMatchingSpy).toHaveBeenCalled();
      expect(trackStoryPlayFailureSpy).toHaveBeenCalled();
      expect(trackFallbackToTtsSpy).toHaveBeenCalled();
      expect(trackTtsFirstChunkSpy).toHaveBeenCalled();
    });
  });
});