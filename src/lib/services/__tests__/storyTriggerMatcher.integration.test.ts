/**
 * Integration tests for StoryTriggerMatcher with UserStoryService
 * Tests the complete trigger matching workflow including database integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UserStoryService } from '../userStoryService';
import { StoryTriggerMatcher } from '../storyTriggerMatcher';
import { StoryUploadRequest } from '../../types/stories';

// Mock Supabase for testing
const mockSupabase = {
  from: () => ({
    insert: () => ({ select: () => ({ single: () => ({ data: null, error: null }) }) }),
    select: () => ({
      eq: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              order: () => ({
                range: () => ({ data: [], error: null, count: 0 })
              })
            })
          })
        })
      })
    }),
    update: () => ({ eq: () => ({ select: () => ({ single: () => ({ data: null, error: null }) }) }) }),
    delete: () => ({ eq: () => ({ error: null }) })
  })
};

// Mock the Supabase client creation
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabase
}));

describe('StoryTriggerMatcher Integration', () => {
  let storyService: UserStoryService;
  let triggerMatcher: StoryTriggerMatcher;

  beforeEach(() => {
    storyService = new UserStoryService('mock-url', 'mock-key');
    triggerMatcher = new StoryTriggerMatcher();
  });

  afterEach(async () => {
    triggerMatcher.clearAllCooldowns();
    // Also clear the default matcher's cooldowns
    const { defaultTriggerMatcher } = await import('../storyTriggerMatcher');
    defaultTriggerMatcher.clearAllCooldowns();
  });

  describe('Service Integration', () => {
    it('should integrate trigger matching with story service', async () => {
      // Mock stories data
      const mockStories = [
        {
          id: 'story-1',
          owner_id: 'avatar-1',
          owner_type: 'avatar' as const,
          title: 'Family Memory',
          category: 'memory' as const,
          triggers: 'family, childhood, memories',
          audio_url: 'https://test.com/story1.mp3',
          duration_ms: 120000,
          priority: 50,
          status: 'active' as const,
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z'
        },
        {
          id: 'story-2',
          owner_id: 'avatar-1',
          owner_type: 'avatar' as const,
          title: 'Work Experience',
          category: 'experience' as const,
          triggers: 'work, career, job',
          audio_url: 'https://test.com/story2.mp3',
          duration_ms: 180000,
          priority: 60,
          status: 'active' as const,
          created_at: '2024-01-01T11:00:00Z',
          updated_at: '2024-01-01T11:00:00Z'
        }
      ];

      // Mock the getStories method to return our test data
      vi.spyOn(storyService, 'getStories').mockResolvedValue({
        stories: mockStories,
        total: 2,
        limit: 50,
        offset: 0
      });

      // Test finding matching stories
      const matches = await storyService.findMatchingStories(
        'Tell me about your family memories',
        'avatar-1',
        'avatar'
      );

      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe('story-1');
      expect(matches[0].title).toBe('Family Memory');
    });

    it('should return detailed match information', async () => {
      const mockStories = [
        {
          id: 'story-1',
          owner_id: 'avatar-1',
          owner_type: 'avatar' as const,
          title: 'Family Memory',
          category: 'memory' as const,
          triggers: 'family, childhood, memories',
          audio_url: 'https://test.com/story1.mp3',
          duration_ms: 120000,
          priority: 50,
          status: 'active' as const,
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z'
        }
      ];

      vi.spyOn(storyService, 'getStories').mockResolvedValue({
        stories: mockStories,
        total: 1,
        limit: 50,
        offset: 0
      });

      const matches = await storyService.findMatchingStoriesWithDetails(
        'Tell me about your family memories',
        'avatar-1',
        'avatar'
      );

      expect(matches).toHaveLength(1);
      expect(matches[0]).toHaveProperty('story');
      expect(matches[0]).toHaveProperty('confidence');
      expect(matches[0]).toHaveProperty('matched_keywords');
      expect(matches[0]).toHaveProperty('context_relevance');
      
      expect(matches[0].story.id).toBe('story-1');
      expect(matches[0].matched_keywords).toContain('family');
      expect(matches[0].matched_keywords).toContain('memories');
      expect(matches[0].confidence).toBeGreaterThan(0);
    });

    it('should select best story using upload order', async () => {
      const mockStories = [
        {
          id: 'newer-story',
          owner_id: 'avatar-1',
          owner_type: 'avatar' as const,
          title: 'Newer Story',
          category: 'memory' as const,
          triggers: 'family, test',
          audio_url: 'https://test.com/newer.mp3',
          duration_ms: 120000,
          priority: 80, // Higher priority
          status: 'active' as const,
          created_at: '2024-01-01T12:00:00Z', // Newer
          updated_at: '2024-01-01T12:00:00Z'
        },
        {
          id: 'older-story',
          owner_id: 'avatar-1',
          owner_type: 'avatar' as const,
          title: 'Older Story',
          category: 'memory' as const,
          triggers: 'family, test',
          audio_url: 'https://test.com/older.mp3',
          duration_ms: 120000,
          priority: 50, // Lower priority
          status: 'active' as const,
          created_at: '2024-01-01T10:00:00Z', // Older
          updated_at: '2024-01-01T10:00:00Z'
        }
      ];

      vi.spyOn(storyService, 'getStories').mockResolvedValue({
        stories: mockStories,
        total: 2,
        limit: 50,
        offset: 0
      });

      const bestStory = await storyService.selectBestMatchingStory(
        'Tell me about your family',
        'avatar-1',
        'avatar'
      );

      // Should select older story (upload order) despite lower priority
      expect(bestStory?.id).toBe('older-story');
    });

    it('should handle cooldown functionality', async () => {
      const mockStories = [
        {
          id: 'story-1',
          owner_id: 'avatar-1',
          owner_type: 'avatar' as const,
          title: 'Test Story',
          category: 'memory' as const,
          triggers: 'family, test',
          audio_url: 'https://test.com/story1.mp3',
          duration_ms: 120000,
          priority: 50,
          status: 'active' as const,
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z'
        }
      ];

      vi.spyOn(storyService, 'getStories').mockResolvedValue({
        stories: mockStories,
        total: 1,
        limit: 50,
        offset: 0
      });

      // Initially not in cooldown
      expect(await storyService.isAvatarInCooldown('avatar-1')).toBe(false);

      // Should find matches when not in cooldown
      const matches1 = await storyService.findMatchingStories(
        'Tell me about your family',
        'avatar-1',
        'avatar'
      );
      expect(matches1).toHaveLength(1);

      // Record trigger to start cooldown
      await storyService.recordStoryTrigger('avatar-1');
      expect(await storyService.isAvatarInCooldown('avatar-1')).toBe(true);

      // Should not find matches when in cooldown
      const matches2 = await storyService.findMatchingStories(
        'Tell me about your family',
        'avatar-1',
        'avatar'
      );
      expect(matches2).toHaveLength(0);
    });

    it('should handle no matching stories gracefully', async () => {
      const mockStories = [
        {
          id: 'story-1',
          owner_id: 'avatar-1',
          owner_type: 'avatar' as const,
          title: 'Unrelated Story',
          category: 'memory' as const,
          triggers: 'cooking, recipe, food',
          audio_url: 'https://test.com/story1.mp3',
          duration_ms: 120000,
          priority: 50,
          status: 'active' as const,
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z'
        }
      ];

      vi.spyOn(storyService, 'getStories').mockResolvedValue({
        stories: mockStories,
        total: 1,
        limit: 50,
        offset: 0
      });

      const matches = await storyService.findMatchingStories(
        'Tell me about your work experience',
        'avatar-1',
        'avatar'
      );

      expect(matches).toEqual([]);

      const bestStory = await storyService.selectBestMatchingStory(
        'Tell me about your work experience',
        'avatar-1',
        'avatar'
      );

      expect(bestStory).toBeNull();
    });

    it('should handle empty story list', async () => {
      vi.spyOn(storyService, 'getStories').mockResolvedValue({
        stories: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      const matches = await storyService.findMatchingStories(
        'Tell me about anything',
        'avatar-1',
        'avatar'
      );

      expect(matches).toEqual([]);
    });

    it('should only match active stories', async () => {
      const mockStories = [
        {
          id: 'active-story',
          owner_id: 'avatar-1',
          owner_type: 'avatar' as const,
          title: 'Active Story',
          category: 'memory' as const,
          triggers: 'family, test',
          audio_url: 'https://test.com/active.mp3',
          duration_ms: 120000,
          priority: 50,
          status: 'active' as const,
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z'
        },
        {
          id: 'inactive-story',
          owner_id: 'avatar-1',
          owner_type: 'avatar' as const,
          title: 'Inactive Story',
          category: 'memory' as const,
          triggers: 'family, test',
          audio_url: 'https://test.com/inactive.mp3',
          duration_ms: 120000,
          priority: 50,
          status: 'inactive' as const,
          created_at: '2024-01-01T11:00:00Z',
          updated_at: '2024-01-01T11:00:00Z'
        }
      ];

      // Mock getStories to only return active stories (as it should)
      vi.spyOn(storyService, 'getStories').mockResolvedValue({
        stories: [mockStories[0]], // Only active story
        total: 1,
        limit: 50,
        offset: 0
      });

      const matches = await storyService.findMatchingStories(
        'Tell me about your family',
        'avatar-1',
        'avatar'
      );

      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe('active-story');
      expect(matches[0].status).toBe('active');
    });
  });

  describe('Performance Integration', () => {
    it('should handle multiple concurrent trigger checks efficiently', async () => {
      const mockStories = Array(50).fill(0).map((_, i) => ({
        id: `story-${i}`,
        owner_id: 'avatar-1',
        owner_type: 'avatar' as const,
        title: `Story ${i}`,
        category: 'memory' as const,
        triggers: `trigger${i}, common, test`,
        audio_url: `https://test.com/story${i}.mp3`,
        duration_ms: 120000,
        priority: 50,
        status: 'active' as const,
        created_at: `2024-01-01T${10 + Math.floor(i / 60)}:${i % 60}:00Z`,
        updated_at: `2024-01-01T${10 + Math.floor(i / 60)}:${i % 60}:00Z`
      }));

      vi.spyOn(storyService, 'getStories').mockResolvedValue({
        stories: mockStories,
        total: 50,
        limit: 50,
        offset: 0
      });

      const startTime = performance.now();
      
      // Run multiple concurrent searches
      const promises = Array(10).fill(0).map((_, i) =>
        storyService.findMatchingStories(
          `Tell me about common trigger${i}`,
          'avatar-1',
          'avatar'
        )
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();

      // Should complete all searches within reasonable time
      expect(endTime - startTime).toBeLessThan(200);
      
      // Each search should find at least one match
      results.forEach(matches => {
        expect(matches.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      // Mock getStories to throw an error
      vi.spyOn(storyService, 'getStories').mockRejectedValue(new Error('Database error'));

      // Should not throw, but return empty results
      await expect(
        storyService.findMatchingStories('test', 'avatar-1', 'avatar')
      ).rejects.toThrow('Database error');
    });

    it('should handle malformed story data', async () => {
      const malformedStories = [
        {
          id: 'story-1',
          owner_id: 'avatar-1',
          owner_type: 'avatar' as const,
          title: 'Test Story',
          category: 'memory' as const,
          triggers: '', // Empty triggers
          audio_url: 'https://test.com/story1.mp3',
          duration_ms: 120000,
          priority: 50,
          status: 'active' as const,
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z'
        },
        {
          id: 'story-2',
          owner_id: 'avatar-1',
          owner_type: 'avatar' as const,
          title: 'Test Story 2',
          category: 'memory' as const,
          triggers: 'valid, trigger', // Valid triggers
          audio_url: 'https://test.com/story2.mp3',
          duration_ms: 120000,
          priority: 50,
          status: 'active' as const,
          created_at: '2024-01-01T11:00:00Z',
          updated_at: '2024-01-01T11:00:00Z'
        }
      ];

      vi.spyOn(storyService, 'getStories').mockResolvedValue({
        stories: malformedStories,
        total: 2,
        limit: 50,
        offset: 0
      });

      const matches = await storyService.findMatchingStories(
        'Tell me about valid trigger',
        'avatar-1',
        'avatar'
      );

      // Should only match the story with valid triggers
      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe('story-2');
    });
  });
});