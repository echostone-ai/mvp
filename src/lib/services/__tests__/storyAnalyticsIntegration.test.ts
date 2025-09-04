// src/lib/services/__tests__/storyAnalyticsIntegration.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StoryAnalyticsIntegration } from '../storyAnalyticsIntegration';
import { UserStory, StoryTriggerMatch } from '../../types/stories';

// Mock the analytics service
const mockAnalyticsService = {
  recordStoryTrigger: vi.fn(),
  getStoryUsageReport: vi.fn(),
  getStoryEffectivenessMetrics: vi.fn(),
  getAggregatedAnalytics: vi.fn(),
};

vi.mock('../storyAnalyticsService', () => ({
  StoryAnalyticsService: {
    getInstance: () => mockAnalyticsService,
  },
}));

describe('StoryAnalyticsIntegration', () => {
  let integration: StoryAnalyticsIntegration;
  let mockStory: UserStory;
  let mockMatch: StoryTriggerMatch;

  beforeEach(() => {
    integration = StoryAnalyticsIntegration.getInstance();
    vi.clearAllMocks();

    mockStory = {
      id: 'story-123',
      owner_id: 'user-456',
      owner_type: 'user',
      title: 'Test Story',
      category: 'memory',
      triggers: 'childhood,family,growing up',
      audio_url: 'https://example.com/story.mp3',
      duration_ms: 45000,
      transcript: 'This is a test story about my childhood...',
      priority: 50,
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    mockMatch = {
      story: mockStory,
      confidence: 0.85,
      matched_keywords: ['childhood', 'family'],
      context_relevance: 0.8,
    };
  });

  describe('recordStoryTrigger', () => {
    it('should record story trigger with all parameters', async () => {
      mockAnalyticsService.recordStoryTrigger.mockResolvedValue(undefined);

      await integration.recordStoryTrigger(
        mockStory,
        'session-123',
        'tell me about your childhood',
        ['childhood', 'tell'],
        0.85,
        true,
        45000,
        undefined
      );

      expect(mockAnalyticsService.recordStoryTrigger).toHaveBeenCalledWith({
        storyId: 'story-123',
        sessionId: 'session-123',
        triggerText: 'tell me about your childhood',
        matchedKeywords: ['childhood', 'tell'],
        confidenceScore: 0.85,
        playedSuccessfully: true,
        playbackDurationMs: 45000,
        errorMessage: null,
      });
    });

    it('should handle analytics service errors gracefully', async () => {
      mockAnalyticsService.recordStoryTrigger.mockRejectedValue(new Error('Database error'));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Should not throw error
      await expect(integration.recordStoryTrigger(
        mockStory,
        'session-123',
        'test trigger',
        ['test'],
        0.5,
        false,
        undefined,
        'Playback failed'
      )).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith('Failed to record story analytics:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('recordStoryTriggerFromMatch', () => {
    it('should record story trigger from match result', async () => {
      mockAnalyticsService.recordStoryTrigger.mockResolvedValue(undefined);

      await integration.recordStoryTriggerFromMatch(
        mockMatch,
        'session-123',
        'tell me about your childhood',
        true,
        45000,
        undefined
      );

      expect(mockAnalyticsService.recordStoryTrigger).toHaveBeenCalledWith({
        storyId: 'story-123',
        sessionId: 'session-123',
        triggerText: 'tell me about your childhood',
        matchedKeywords: ['childhood', 'family'],
        confidenceScore: 0.85,
        playedSuccessfully: true,
        playbackDurationMs: 45000,
        errorMessage: null,
      });
    });
  });

  describe('recordStoryPlaybackSuccess', () => {
    it('should record successful playback', async () => {
      mockAnalyticsService.recordStoryTrigger.mockResolvedValue(undefined);

      await integration.recordStoryPlaybackSuccess(
        mockStory,
        'session-123',
        'childhood memories',
        ['childhood', 'memories'],
        0.9,
        47000
      );

      expect(mockAnalyticsService.recordStoryTrigger).toHaveBeenCalledWith({
        storyId: 'story-123',
        sessionId: 'session-123',
        triggerText: 'childhood memories',
        matchedKeywords: ['childhood', 'memories'],
        confidenceScore: 0.9,
        playedSuccessfully: true,
        playbackDurationMs: 47000,
        errorMessage: null,
      });
    });
  });

  describe('recordStoryPlaybackFailure', () => {
    it('should record failed playback', async () => {
      mockAnalyticsService.recordStoryTrigger.mockResolvedValue(undefined);

      await integration.recordStoryPlaybackFailure(
        mockStory,
        'session-123',
        'childhood memories',
        ['childhood', 'memories'],
        0.9,
        'Audio loading timeout'
      );

      expect(mockAnalyticsService.recordStoryTrigger).toHaveBeenCalledWith({
        storyId: 'story-123',
        sessionId: 'session-123',
        triggerText: 'childhood memories',
        matchedKeywords: ['childhood', 'memories'],
        confidenceScore: 0.9,
        playedSuccessfully: false,
        playbackDurationMs: null,
        errorMessage: 'Audio loading timeout',
      });
    });
  });

  describe('generateSessionId', () => {
    it('should generate unique session IDs', () => {
      const sessionId1 = integration.generateSessionId();
      const sessionId2 = integration.generateSessionId();

      expect(sessionId1).toMatch(/^session_\d+_[a-z0-9]+$/);
      expect(sessionId2).toMatch(/^session_\d+_[a-z0-9]+$/);
      expect(sessionId1).not.toBe(sessionId2);
    });
  });

  describe('getStoryAnalytics', () => {
    it('should return story analytics', async () => {
      const mockReport = {
        storyId: 'story-123',
        title: 'Test Story',
        totalTriggers: 10,
        successfulPlays: 8,
        successRate: 80,
      };

      mockAnalyticsService.getStoryUsageReport.mockResolvedValue(mockReport);

      const result = await integration.getStoryAnalytics('story-123');

      expect(result).toBe(mockReport);
      expect(mockAnalyticsService.getStoryUsageReport).toHaveBeenCalledWith('story-123');
    });

    it('should handle errors gracefully', async () => {
      mockAnalyticsService.getStoryUsageReport.mockRejectedValue(new Error('Database error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await integration.getStoryAnalytics('story-123');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get story analytics:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('getEffectivenessMetrics', () => {
    it('should return effectiveness metrics', async () => {
      const mockMetrics = [
        {
          storyId: 'story-1',
          title: 'Story 1',
          engagementScore: 85,
          userSatisfactionScore: 90,
        },
      ];

      mockAnalyticsService.getStoryEffectivenessMetrics.mockResolvedValue(mockMetrics);

      const result = await integration.getEffectivenessMetrics('user-123', 'user');

      expect(result).toBe(mockMetrics);
      expect(mockAnalyticsService.getStoryEffectivenessMetrics).toHaveBeenCalledWith('user-123', 'user');
    });

    it('should handle errors gracefully', async () => {
      mockAnalyticsService.getStoryEffectivenessMetrics.mockRejectedValue(new Error('Database error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await integration.getEffectivenessMetrics('user-123', 'user');

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get effectiveness metrics:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('getAggregatedAnalytics', () => {
    it('should return aggregated analytics', async () => {
      const mockAnalytics = {
        totalStories: 5,
        totalTriggers: 25,
        overallSuccessRate: 80,
      };

      mockAnalyticsService.getAggregatedAnalytics.mockResolvedValue(mockAnalytics);

      const result = await integration.getAggregatedAnalytics('user-123', 'user');

      expect(result).toBe(mockAnalytics);
      expect(mockAnalyticsService.getAggregatedAnalytics).toHaveBeenCalledWith('user-123', 'user');
    });

    it('should handle errors gracefully', async () => {
      mockAnalyticsService.getAggregatedAnalytics.mockRejectedValue(new Error('Database error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await integration.getAggregatedAnalytics('user-123', 'user');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get aggregated analytics:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});