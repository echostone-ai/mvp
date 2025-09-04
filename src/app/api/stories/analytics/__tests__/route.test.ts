// src/app/api/stories/analytics/__tests__/route.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

// Mock the analytics service
const mockAnalyticsService = {
  getStoryUsageReport: vi.fn(),
  getStoryEffectivenessMetrics: vi.fn(),
  getAggregatedAnalytics: vi.fn(),
  recordStoryTrigger: vi.fn(),
};

vi.mock('@/lib/services/storyAnalyticsService', () => ({
  StoryAnalyticsService: {
    getInstance: () => mockAnalyticsService,
  },
}));

describe('/api/stories/analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET', () => {
    it('should return aggregated analytics by default', async () => {
      const mockAggregatedData = {
        totalStories: 5,
        totalTriggers: 25,
        totalSuccessfulPlays: 20,
        overallSuccessRate: 80,
        avgStoryDuration: 45000,
        topCategories: [
          { category: 'memory', count: 3, successRate: 85 },
          { category: 'advice', count: 2, successRate: 75 },
        ],
        triggerTrends: [],
        performanceMetrics: {
          avgMatchLatency: 45,
          avgStartLatency: 1200,
          slaCompliance: 0.95,
        },
      };

      mockAnalyticsService.getAggregatedAnalytics.mockResolvedValue(mockAggregatedData);

      const request = new NextRequest('http://localhost/api/stories/analytics?ownerId=user-123&ownerType=user');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ analytics: mockAggregatedData });
      expect(mockAnalyticsService.getAggregatedAnalytics).toHaveBeenCalledWith('user-123', 'user');
    });

    it('should return story-specific analytics when storyId is provided', async () => {
      const mockStoryReport = {
        storyId: 'story-123',
        title: 'My Story',
        category: 'memory',
        totalTriggers: 10,
        successfulPlays: 8,
        failedPlays: 2,
        successRate: 80,
        avgPlaybackDuration: 45000,
        avgConfidenceScore: 0.85,
        topTriggerKeywords: [
          { keyword: 'childhood', count: 5 },
          { keyword: 'family', count: 3 },
        ],
        lastTriggered: '2024-01-15T12:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
      };

      mockAnalyticsService.getStoryUsageReport.mockResolvedValue(mockStoryReport);

      const request = new NextRequest('http://localhost/api/stories/analytics?ownerId=user-123&ownerType=user&type=story&storyId=story-123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ report: mockStoryReport });
      expect(mockAnalyticsService.getStoryUsageReport).toHaveBeenCalledWith('story-123');
    });

    it('should return effectiveness metrics when type is effectiveness', async () => {
      const mockEffectivenessMetrics = [
        {
          storyId: 'story-1',
          title: 'High Performance Story',
          category: 'memory',
          triggerFrequency: 2.5,
          engagementScore: 85,
          userSatisfactionScore: 90,
          recommendedActions: ['Story is performing well - no immediate actions needed'],
        },
        {
          storyId: 'story-2',
          title: 'Low Performance Story',
          category: 'advice',
          triggerFrequency: 0.1,
          engagementScore: 45,
          userSatisfactionScore: 50,
          recommendedActions: [
            'Consider adding more trigger keywords to increase discoverability',
            'Review audio quality and file format for better playback reliability',
          ],
        },
      ];

      mockAnalyticsService.getStoryEffectivenessMetrics.mockResolvedValue(mockEffectivenessMetrics);

      const request = new NextRequest('http://localhost/api/stories/analytics?ownerId=user-123&ownerType=user&type=effectiveness');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ metrics: mockEffectivenessMetrics });
      expect(mockAnalyticsService.getStoryEffectivenessMetrics).toHaveBeenCalledWith('user-123', 'user');
    });

    it('should return 400 for missing required parameters', async () => {
      const request = new NextRequest('http://localhost/api/stories/analytics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required parameters: ownerId and ownerType');
    });

    it('should return 400 for story type without storyId', async () => {
      const request = new NextRequest('http://localhost/api/stories/analytics?ownerId=user-123&ownerType=user&type=story');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('storyId required for story analytics');
    });

    it('should handle service errors gracefully', async () => {
      mockAnalyticsService.getAggregatedAnalytics.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost/api/stories/analytics?ownerId=user-123&ownerType=user');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch analytics');
      expect(data.message).toBe('Database connection failed');
    });
  });

  describe('POST', () => {
    it('should record story analytics successfully', async () => {
      mockAnalyticsService.recordStoryTrigger.mockResolvedValue(undefined);

      const analyticsData = {
        storyId: 'story-123',
        sessionId: 'session-456',
        triggerText: 'tell me about your childhood',
        matchedKeywords: ['childhood', 'tell'],
        confidenceScore: 0.85,
        playedSuccessfully: true,
        playbackDurationMs: 45000,
        errorMessage: null,
      };

      const request = new NextRequest('http://localhost/api/stories/analytics', {
        method: 'POST',
        body: JSON.stringify(analyticsData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(mockAnalyticsService.recordStoryTrigger).toHaveBeenCalledWith({
        storyId: 'story-123',
        sessionId: 'session-456',
        triggerText: 'tell me about your childhood',
        matchedKeywords: ['childhood', 'tell'],
        confidenceScore: 0.85,
        playedSuccessfully: true,
        playbackDurationMs: 45000,
        errorMessage: null,
      });
    });

    it('should handle missing required fields', async () => {
      const incompleteData = {
        storyId: 'story-123',
        // Missing sessionId and triggerText
      };

      const request = new NextRequest('http://localhost/api/stories/analytics', {
        method: 'POST',
        body: JSON.stringify(incompleteData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: storyId, sessionId, triggerText');
    });

    it('should handle optional fields correctly', async () => {
      mockAnalyticsService.recordStoryTrigger.mockResolvedValue(undefined);

      const minimalData = {
        storyId: 'story-123',
        sessionId: 'session-456',
        triggerText: 'test trigger',
      };

      const request = new NextRequest('http://localhost/api/stories/analytics', {
        method: 'POST',
        body: JSON.stringify(minimalData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(mockAnalyticsService.recordStoryTrigger).toHaveBeenCalledWith({
        storyId: 'story-123',
        sessionId: 'session-456',
        triggerText: 'test trigger',
        matchedKeywords: [],
        confidenceScore: 0,
        playedSuccessfully: false,
        playbackDurationMs: null,
        errorMessage: null,
      });
    });

    it('should handle service errors gracefully', async () => {
      mockAnalyticsService.recordStoryTrigger.mockRejectedValue(new Error('Database write failed'));

      const analyticsData = {
        storyId: 'story-123',
        sessionId: 'session-456',
        triggerText: 'test trigger',
      };

      const request = new NextRequest('http://localhost/api/stories/analytics', {
        method: 'POST',
        body: JSON.stringify(analyticsData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to record analytics');
      expect(data.message).toBe('Database write failed');
    });

    it('should handle malformed JSON gracefully', async () => {
      const request = new NextRequest('http://localhost/api/stories/analytics', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to record analytics');
    });
  });
});