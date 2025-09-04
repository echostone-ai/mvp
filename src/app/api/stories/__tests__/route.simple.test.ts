/**
 * Simplified tests for Stories API endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

// Mock dependencies
vi.mock('@/lib/featureFlags', () => ({
  requireFeatureFlag: (flag: string) => (handler: Function) => handler,
}));

vi.mock('@/lib/services/userStoryService', () => ({
  UserStoryService: {
    getStoriesByOwner: vi.fn(),
  },
}));

vi.mock('@/lib/rateLimiter', () => ({
  createRateLimiter: () => ({
    check: () => ({ success: true, remaining: 99, resetAt: Date.now() + 60000 }),
  }),
}));

import { UserStoryService } from '@/lib/services/userStoryService';

const mockUserStoryService = UserStoryService as any;

describe('/api/stories GET endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return stories for valid avatarId', async () => {
    const mockStories = [
      {
        id: 'story-1',
        title: 'Test Story',
        category: 'memory' as const,
        triggers: ['test', 'story'],
        duration: 30000,
        audioUrl: 'https://example.com/story.mp3',
        status: 'active' as const,
        createdAt: new Date().toISOString(),
      },
    ];

    mockUserStoryService.getStoriesByOwner.mockResolvedValue(mockStories);

    const request = new NextRequest('http://localhost/api/stories?avatarId=avatar-123');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.stories).toEqual(mockStories);
    expect(data.count).toBe(1);
    expect(mockUserStoryService.getStoriesByOwner).toHaveBeenCalledWith('avatar-123', 'avatar');
  });

  it('should return 400 if avatarId is missing', async () => {
    const request = new NextRequest('http://localhost/api/stories');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('avatarId is required');
  });

  it('should handle service errors gracefully', async () => {
    mockUserStoryService.getStoriesByOwner.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost/api/stories?avatarId=avatar-123');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Database error');
  });

  it('should support user ownerType', async () => {
    const mockStories = [];
    mockUserStoryService.getStoriesByOwner.mockResolvedValue(mockStories);

    const request = new NextRequest('http://localhost/api/stories?avatarId=user-123&ownerType=user');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockUserStoryService.getStoriesByOwner).toHaveBeenCalledWith('user-123', 'user');
  });

  it('should include rate limit headers', async () => {
    mockUserStoryService.getStoriesByOwner.mockResolvedValue([]);

    const request = new NextRequest('http://localhost/api/stories?avatarId=avatar-123');
    const response = await GET(request);

    expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('99');
    expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
  });
});