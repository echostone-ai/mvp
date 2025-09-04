// src/components/__tests__/StoryAnalyticsDashboard.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StoryAnalyticsDashboard from '../StoryAnalyticsDashboard';

// Mock fetch
global.fetch = vi.fn();

const mockAggregatedAnalytics = {
  totalStories: 5,
  totalTriggers: 25,
  totalSuccessfulPlays: 20,
  overallSuccessRate: 80,
  avgStoryDuration: 45000,
  topCategories: [
    { category: 'memory', count: 3, successRate: 85 },
    { category: 'advice', count: 2, successRate: 75 },
  ],
  triggerTrends: [
    { date: '2024-01-15', triggers: 5, successes: 4 },
    { date: '2024-01-16', triggers: 3, successes: 3 },
    { date: '2024-01-17', triggers: 7, successes: 5 },
  ],
  performanceMetrics: {
    avgMatchLatency: 45,
    avgStartLatency: 1200,
    slaCompliance: 0.95,
  },
};

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

const mockStoryReport = {
  storyId: 'story-1',
  title: 'High Performance Story',
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

describe('StoryAnalyticsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render loading state initially', () => {
    (global.fetch as any).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<StoryAnalyticsDashboard ownerId="user-123" ownerType="user" />);

    expect(screen.getByText('Loading story analytics...')).toBeInTheDocument();
  });

  it('should render overview tab with aggregated analytics', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ analytics: mockAggregatedAnalytics }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ metrics: mockEffectivenessMetrics }),
      });

    render(<StoryAnalyticsDashboard ownerId="user-123" ownerType="user" />);

    await waitFor(() => {
      expect(screen.getByText('Story Analytics Dashboard')).toBeInTheDocument();
    });

    // Check overview stats
    expect(screen.getByText('5')).toBeInTheDocument(); // Total Stories
    expect(screen.getByText('25')).toBeInTheDocument(); // Total Triggers
    expect(screen.getByText('20')).toBeInTheDocument(); // Successful Plays
    expect(screen.getByText('80.0%')).toBeInTheDocument(); // Success Rate
    expect(screen.getByText('0:45')).toBeInTheDocument(); // Avg Duration

    // Check categories
    expect(screen.getByText('memory')).toBeInTheDocument();
    expect(screen.getByText('advice')).toBeInTheDocument();
    expect(screen.getByText('3 stories')).toBeInTheDocument();
    expect(screen.getByText('85.0%')).toBeInTheDocument();
  });

  it('should switch to effectiveness tab and display metrics', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ analytics: mockAggregatedAnalytics }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ metrics: mockEffectivenessMetrics }),
      });

    render(<StoryAnalyticsDashboard ownerId="user-123" ownerType="user" />);

    await waitFor(() => {
      expect(screen.getByText('Story Analytics Dashboard')).toBeInTheDocument();
    });

    // Click effectiveness tab
    fireEvent.click(screen.getByText('Effectiveness'));

    // Check effectiveness metrics
    expect(screen.getByText('High Performance Story')).toBeInTheDocument();
    expect(screen.getByText('Low Performance Story')).toBeInTheDocument();
    expect(screen.getByText('2.5/day')).toBeInTheDocument(); // Trigger frequency
    expect(screen.getByText('85')).toBeInTheDocument(); // Engagement score
    expect(screen.getByText('90')).toBeInTheDocument(); // Satisfaction score

    // Check recommendations
    expect(screen.getByText('Story is performing well - no immediate actions needed')).toBeInTheDocument();
    expect(screen.getByText('Consider adding more trigger keywords to increase discoverability')).toBeInTheDocument();
  });

  it('should fetch and display story details when clicking on story title', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ analytics: mockAggregatedAnalytics }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ metrics: mockEffectivenessMetrics }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ report: mockStoryReport }),
      });

    render(<StoryAnalyticsDashboard ownerId="user-123" ownerType="user" />);

    await waitFor(() => {
      expect(screen.getByText('Story Analytics Dashboard')).toBeInTheDocument();
    });

    // Switch to effectiveness tab
    fireEvent.click(screen.getByText('Effectiveness'));

    // Click on story title
    fireEvent.click(screen.getByText('High Performance Story'));

    await waitFor(() => {
      expect(screen.getByText('Story Details')).toBeInTheDocument();
    });

    // Check story details
    expect(screen.getByText('Total Triggers:')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Successful Plays:')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('Failed Plays:')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    // Check trigger keywords
    expect(screen.getByText('childhood')).toBeInTheDocument();
    expect(screen.getByText('family')).toBeInTheDocument();
  });

  it('should handle API errors gracefully', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    render(<StoryAnalyticsDashboard ownerId="user-123" ownerType="user" />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Analytics')).toBeInTheDocument();
    });

    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('should refresh data when refresh button is clicked', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ analytics: mockAggregatedAnalytics }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ metrics: mockEffectivenessMetrics }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ analytics: { ...mockAggregatedAnalytics, totalStories: 6 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ metrics: mockEffectivenessMetrics }),
      });

    render(<StoryAnalyticsDashboard ownerId="user-123" ownerType="user" />);

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument(); // Initial total stories
    });

    // Click refresh button
    fireEvent.click(screen.getByText('Refresh'));

    await waitFor(() => {
      expect(screen.getByText('6')).toBeInTheDocument(); // Updated total stories
    });

    expect(global.fetch).toHaveBeenCalledTimes(4); // Initial 2 calls + refresh 2 calls
  });

  it('should handle HTTP error responses', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    render(<StoryAnalyticsDashboard ownerId="user-123" ownerType="user" />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Analytics')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to fetch aggregated analytics: Internal Server Error')).toBeInTheDocument();
  });

  it('should format durations correctly', async () => {
    const analyticsWithLongDuration = {
      ...mockAggregatedAnalytics,
      avgStoryDuration: 125000, // 2:05
    };

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ analytics: analyticsWithLongDuration }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ metrics: mockEffectivenessMetrics }),
      });

    render(<StoryAnalyticsDashboard ownerId="user-123" ownerType="user" />);

    await waitFor(() => {
      expect(screen.getByText('2:05')).toBeInTheDocument(); // Formatted duration
    });
  });

  it('should apply correct CSS classes for score colors', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ analytics: mockAggregatedAnalytics }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ metrics: mockEffectivenessMetrics }),
      });

    render(<StoryAnalyticsDashboard ownerId="user-123" ownerType="user" />);

    await waitFor(() => {
      expect(screen.getByText('Story Analytics Dashboard')).toBeInTheDocument();
    });

    // Switch to effectiveness tab to see score colors
    fireEvent.click(screen.getByText('Effectiveness'));

    // High performance story should have good scores (85, 90)
    const highEngagementScore = screen.getByText('85');
    const highSatisfactionScore = screen.getByText('90');
    
    expect(highEngagementScore).toHaveClass('good');
    expect(highSatisfactionScore).toHaveClass('good');

    // Low performance story should have poor scores (45, 50)
    const lowEngagementScore = screen.getByText('45');
    const lowSatisfactionScore = screen.getByText('50');
    
    expect(lowEngagementScore).toHaveClass('poor');
    expect(lowSatisfactionScore).toHaveClass('poor');
  });
});