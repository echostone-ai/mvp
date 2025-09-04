/**
 * Tests for Stories API endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

// Mock dependencies
vi.mock('@/lib/featureFlags', () => ({
  requireFeatureFlag: (flag: string) => (handler: Function) => handler,
}));

vi.mock('@/lib/services/userStoryService', () => ({
  UserStoryService: {
    getStoriesByOwner: vi.fn(),
  },
}));

vi.mock('@/lib/services/userStoryStorageService', () => ({
  UserStoryStorageService: {
    uploadStory: vi.fn(),
  },
}));

vi.mock('@/lib/api/auth', () => ({
  getAuthenticatedUser: vi.fn(),
  checkAvatarAccess: vi.fn(),
}));

vi.mock('@/lib/rateLimiter', () => ({
  createRateLimiter: () => ({
    check: () => ({ success: true, remaining: 99, resetAt: Date.now() + 60000 }),
  }),
}));

import { UserStoryService } from '@/lib/services/userStoryService';
import { UserStoryStorageService } from '@/lib/services/userStoryStorageService';
import { getAuthenticatedUser, checkAvatarAccess } from '@/lib/api/auth';

const mockUserStoryService = UserStoryService as any;
const mockUserStoryStorageService = UserStoryStorageService as any;
const mockGetAuthenticatedUser = getAuthenticatedUser as any;
const mockCheckAvatarAccess = checkAvatarAccess as any;

describe('/api/stories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/stories', () => {
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
  });

  describe('POST /api/stories', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockStory = {
      id: 'story-1',
      title: 'Test Story',
      category: 'memory' as const,
      triggers: ['test', 'story'],
      duration: 30000,
      audioUrl: 'https://example.com/story.mp3',
      status: 'active' as const,
      createdAt: new Date().toISOString(),
    };

    beforeEach(() => {
      mockGetAuthenticatedUser.mockResolvedValue(mockUser);
      mockCheckAvatarAccess.mockResolvedValue(true);
      mockUserStoryService.getStoriesByOwner.mockResolvedValue([]); // No existing stories
      mockUserStoryStorageService.uploadStory.mockResolvedValue(mockStory);
    });

    it('should upload story successfully', async () => {
      const formData = new FormData();
      formData.append('file', new File(['audio data'], 'story.mp3', { type: 'audio/mpeg' }));
      formData.append('title', 'Test Story');
      formData.append('category', 'memory');
      formData.append('triggers', 'test,story,memory');
      formData.append('avatarId', 'avatar-123');

      const request = new NextRequest('http://localhost/api/stories', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe('story-1');
      expect(data.data.title).toBe('Test Story');
    });

    it('should return 401 if user is not authenticated', async () => {
      mockGetAuthenticatedUser.mockResolvedValue(null);

      const formData = new FormData();
      formData.append('file', new File(['audio data'], 'story.mp3', { type: 'audio/mpeg' }));
      formData.append('title', 'Test Story');
      formData.append('category', 'memory');
      formData.append('triggers', 'test,story');

      const request = new NextRequest('http://localhost/api/stories', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Authentication required');
    });

    it('should return 400 if required fields are missing', async () => {
      const formData = new FormData();
      formData.append('file', new File(['audio data'], 'story.mp3', { type: 'audio/mpeg' }));
      // Missing title, category, triggers

      const request = new NextRequest('http://localhost/api/stories', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Story title is required');
    });

    it('should return 400 for invalid category', async () => {
      const formData = new FormData();
      formData.append('file', new File(['audio data'], 'story.mp3', { type: 'audio/mpeg' }));
      formData.append('title', 'Test Story');
      formData.append('category', 'invalid-category');
      formData.append('triggers', 'test,story');

      const request = new NextRequest('http://localhost/api/stories', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid category');
    });

    it('should return 403 if avatar story limit is reached', async () => {
      // Mock 5 existing stories (limit reached)
      const existingStories = Array(5).fill(mockStory);
      mockUserStoryService.getStoriesByOwner.mockResolvedValue(existingStories);

      const formData = new FormData();
      formData.append('file', new File(['audio data'], 'story.mp3', { type: 'audio/mpeg' }));
      formData.append('title', 'Test Story');
      formData.append('category', 'memory');
      formData.append('triggers', 'test,story');
      formData.append('avatarId', 'avatar-123');

      const request = new NextRequest('http://localhost/api/stories', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain('maximum story limit');
    });

    it('should validate trigger keywords limit', async () => {
      const formData = new FormData();
      formData.append('file', new File(['audio data'], 'story.mp3', { type: 'audio/mpeg' }));
      formData.append('title', 'Test Story');
      formData.append('category', 'memory');
      // 21 triggers (exceeds limit of 20)
      const tooManyTriggers = Array(21).fill('trigger').join(',');
      formData.append('triggers', tooManyTriggers);

      const request = new NextRequest('http://localhost/api/stories', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Maximum 20 trigger keywords');
    });
  });
});