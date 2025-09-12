// src/lib/services/__tests__/storyAnalyticsService.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StoryAnalyticsService } from '../storyAnalyticsService';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: null, error: null })),
          gte: vi.fn(() => ({ data: [], error: null })),
          eq: vi.fn(() => ({ data: [], error: null })),
        })),
        in: vi.fn(() => ({ data: [], error: null })),
      })),
    })),
  },
}));

describe('StoryAnalyticsService', () => {
  let analyticsService: StoryAnalyticsService;
  let mockSupabase: any;

  beforeEach(async () => {
    const { supabase } = await import('@/lib/supabase');
    mockSupabase = supabase;
    analyticsService = StoryAnalyticsService.getInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('recordStoryTrigger', () => {
    it('should record story trigger analytics successfully', async () => {
      const mockInsert = vi.fn(() => ({ error: null }));
      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
      });

      const analytics = {
        storyId: 'story-123',
        sessionId: 'session-456',
        triggerText: 'tell me about your childhood',
        matchedKeywords: ['childhood', 'tell'],
        confidenceScore: 0.85,
        playedSuccessfully: true,
        playbackDurationMs: 45000,
        errorMessage: null,
      };

      await analyticsService.recordStoryTrigger(analytics);

      expect(mockSupabase.from).toHaveBeenCalledWith('story_usage_analytics');
      expect(mockInsert).toHaveBeenCalledWith({
        story_id: analytics.storyId,
        session_id: analytics.sessionId,
        trigger_text: analytics.triggerText,
        matched_keywords: analytics.matchedKeywords,
        confidence_score: analytics.confidenceScore,
        played_successfully: analytics.playedSuccessfully,
        playback_duration_ms: analytics.playbackDurationMs,
        error_message: analytics.errorMessage,
      });
    });

    it('should handle database errors gracefully', async () => {
      const mockInsert = vi.fn(() => ({ error: new Error('Database error') }));
      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
      });

      const analytics = {
        storyId: 'story-123',
        sessionId: 'session-456',
        triggerText: 'test trigger',
        matchedKeywords: ['test'],
        confidenceScore: 0.5,
        playedSuccessfully: false,
        playbackDurationMs: null,
        errorMessage: 'Playback failed',
      };

      // Should not throw error
      await expect(analyticsService.recordStoryTrigger(analytics)).resolves.toBeUndefined();
    });
  });

  describe('getStoryUsageReport', () => {
    it('should return usage report for existing story', async () => {
      const mockStory = {
        title: 'My Childhood Story',
        category: 'memory',
        created_at: '2024-01-01T00:00:00Z',
      };

      const mockAnalytics = [
        {
          story_id: 'story-123',
          trigger_text: 'childhood',
          matched_keywords: ['childhood'],
          confidence_score: 0.8,
          played_successfully: true,
          playback_duration_ms: 45000,
          created_at: '2024-01-01T12:00:00Z',
        },
        {
          story_id: 'story-123',
          trigger_text: 'growing up',
          matched_keywords: ['growing'],
          confidence_score: 0.6,
          played_successfully: false,
          playback_duration_ms: null,
          created_at: '2024-01-01T13:00:00Z',
        },
      ];

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'user_stories') {
          return {
            select: () => ({
              eq: () => ({
                single: () => ({ data: mockStory, error: null }),
              }),
            }),
          };
        } else if (table === 'story_usage_analytics') {
          return {
            select: () => ({
              eq: () => ({ data: mockAnalytics, error: null }),
            }),
          };
        }
      });

      const report = await analyticsService.getStoryUsageReport('story-123');

      expect(report).toEqual({
        storyId: 'story-123',
        title: 'My Childhood Story',
        category: 'memory',
        totalTriggers: 2,
        successfulPlays: 1,
        failedPlays: 1,
        successRate: 50,
        avgPlaybackDuration: 45000,
        avgConfidenceScore: 0.7,
        topTriggerKeywords: [
          { keyword: 'childhood', count: 1 },
          { keyword: 'growing', count: 1 },
        ],
        lastTriggered: '2024-01-01T13:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
      });
    });

    it('should return null for non-existent story', async () => {
      mockSupabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: () => ({ data: null, error: new Error('Story not found') }),
          }),
        }),
      });

      await expect(analyticsService.getStoryUsageReport('non-existent')).rejects.toThrow('Story not found');
    });

    it('should handle story with no analytics data', async () => {
      const mockStory = {
        title: 'Unused Story',
        category: 'advice',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'user_stories') {
          return {
            select: () => ({
              eq: () => ({
                single: () => ({ data: mockStory, error: null }),
              }),
            }),
          };
        } else if (table === 'story_usage_analytics') {
          return {
            select: () => ({
              eq: () => ({ data: [], error: null }),
            }),
          };
        }
      });

      const report = await analyticsService.getStoryUsageReport('story-123');

      expect(report).toEqual({
        storyId: 'story-123',
        title: 'Unused Story',
        category: 'advice',
        totalTriggers: 0,
        successfulPlays: 0,
        failedPlays: 0,
        successRate: 0,
        avgPlaybackDuration: 0,
        avgConfidenceScore: 0,
        topTriggerKeywords: [],
        lastTriggered: null,
        createdAt: '2024-01-01T00:00:00Z',
      });
    });
  });

  describe('getStoryEffectivenessMetrics', () => {
    it('should calculate effectiveness metrics correctly', async () => {
      const mockStories = [
        {
          id: 'story-1',
          title: 'High Performance Story',
          category: 'memory',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'story-2',
          title: 'Low Performance Story',
          category: 'advice',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      const mockAnalytics = [
        // High performance story analytics
        {
          story_id: 'story-1',
          played_successfully: true,
          playback_duration_ms: 45000,
          confidence_score: 0.9,
          created_at: '2024-01-15T00:00:00Z',
        },
        {
          story_id: 'story-1',
          played_successfully: true,
          playback_duration_ms: 50000,
          confidence_score: 0.8,
          created_at: '2024-01-16T00:00:00Z',
        },
        // Low performance story analytics
        {
          story_id: 'story-2',
          played_successfully: false,
          playback_duration_ms: null,
          confidence_score: 0.3,
          created_at: '2024-01-15T00:00:00Z',
        },
      ];

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'user_stories') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({ data: mockStories, error: null }),
                }),
              }),
            }),
          };
        } else if (table === 'story_usage_analytics') {
          return {
            select: () => ({
              eq: (field: string, value: string) => ({
                gte: () => ({
                  data: mockAnalytics.filter(a => a.story_id === value),
                  error: null,
                }),
              }),
            }),
          };
        }
      });

      const metrics = await analyticsService.getStoryEffectivenessMetrics('user-123', 'user');

      expect(metrics).toHaveLength(2);
      
      // High performance story should be first (sorted by engagement score)
      expect(metrics[0]).toMatchObject({
        storyId: 'story-1',
        title: 'High Performance Story',
        category: 'memory',
        engagementScore: expect.any(Number),
        userSatisfactionScore: expect.any(Number),
        recommendedActions: expect.arrayContaining([expect.any(String)]),
      });

      // High performance story should have better scores
      expect(metrics[0].engagementScore).toBeGreaterThan(metrics[1].engagementScore);
    });
  });

  describe('getAggregatedAnalytics', () => {
    it('should return aggregated analytics for owner with stories', async () => {
      const mockStories = [
        {
          id: 'story-1',
          category: 'memory',
          duration_ms: 45000,
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'story-2',
          category: 'advice',
          duration_ms: 60000,
          created_at: '2024-01-02T00:00:00Z',
        },
      ];

      const mockAnalytics = [
        {
          story_id: 'story-1',
          played_successfully: true,
          created_at: '2024-01-15T00:00:00Z',
        },
        {
          story_id: 'story-1',
          played_successfully: false,
          created_at: '2024-01-16T00:00:00Z',
        },
        {
          story_id: 'story-2',
          played_successfully: true,
          created_at: '2024-01-17T00:00:00Z',
        },
      ];

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'user_stories') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({ data: mockStories, error: null }),
              }),
            }),
          };
        } else if (table === 'story_usage_analytics') {
          return {
            select: () => ({
              in: () => ({ data: mockAnalytics, error: null }),
            }),
          };
        }
      });

      const analytics = await analyticsService.getAggregatedAnalytics('user-123', 'user');

      expect(analytics).toMatchObject({
        totalStories: 2,
        totalTriggers: 3,
        totalSuccessfulPlays: 2,
        overallSuccessRate: expect.closeTo(66.67, 1),
        avgStoryDuration: 52500,
        topCategories: expect.arrayContaining([
          expect.objectContaining({
            category: expect.any(String),
            count: expect.any(Number),
            successRate: expect.any(Number),
          }),
        ]),
        triggerTrends: expect.arrayContaining([
          expect.objectContaining({
            date: expect.any(String),
            triggers: expect.any(Number),
            successes: expect.any(Number),
          }),
        ]),
        performanceMetrics: expect.objectContaining({
          avgMatchLatency: expect.any(Number),
          avgStartLatency: expect.any(Number),
          slaCompliance: expect.any(Number),
        }),
      });
    });

    it('should return empty analytics for owner with no stories', async () => {
      mockSupabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({ data: [], error: null }),
          }),
        }),
      });

      const analytics = await analyticsService.getAggregatedAnalytics('user-123', 'user');

      expect(analytics).toMatchObject({
        totalStories: 0,
        totalTriggers: 0,
        totalSuccessfulPlays: 0,
        overallSuccessRate: 0,
        avgStoryDuration: 0,
        topCategories: [],
        triggerTrends: expect.any(Array),
        performanceMetrics: {
          avgMatchLatency: 0,
          avgStartLatency: 0,
          slaCompliance: 0,
        },
      });
    });
  });

  describe('getAdminAnalytics', () => {
    it('should return admin-level analytics', async () => {
      const mockStories = [
        {
          id: 'story-1',
          title: 'Story 1',
          category: 'memory',
          owner_id: 'user-1',
          owner_type: 'user',
          status: 'active',
        },
        {
          id: 'story-2',
          title: 'Story 2',
          category: 'advice',
          owner_id: 'avatar-1',
          owner_type: 'avatar',
          status: 'active',
        },
      ];

      const mockAnalytics = [
        { story_id: 'story-1', played_successfully: true },
        { story_id: 'story-1', played_successfully: false },
        { story_id: 'story-2', played_successfully: true },
      ];

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'user_stories') {
          return {
            select: () => ({ data: mockStories, error: null }),
          };
        } else if (table === 'story_usage_analytics') {
          return {
            select: () => ({ data: mockAnalytics, error: null }),
          };
        }
      });

      const adminAnalytics = await analyticsService.getAdminAnalytics();

      expect(adminAnalytics).toMatchObject({
        totalUsers: 1,
        totalAvatars: 1,
        totalStories: 2,
        totalTriggers: 3,
        globalSuccessRate: expect.closeTo(66.67, 1),
        topPerformingStories: expect.arrayContaining([
          expect.objectContaining({
            storyId: expect.any(String),
            title: expect.any(String),
            ownerType: expect.any(String),
            ownerId: expect.any(String),
            successRate: expect.any(Number),
            totalTriggers: expect.any(Number),
          }),
        ]),
        categoryBreakdown: expect.arrayContaining([
          expect.objectContaining({
            category: expect.any(String),
            storyCount: expect.any(Number),
            triggerCount: expect.any(Number),
            successRate: expect.any(Number),
          }),
        ]),
      });
    });
  });
});