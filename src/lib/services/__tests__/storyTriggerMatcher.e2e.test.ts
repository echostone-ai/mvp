/**
 * End-to-End Unit Tests for Story Trigger Matching
 * Tests exact keyword hit verification as required by task 11
 * Requirements: 8.1, 8.2, 8.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StoryTriggerMatcher } from '../storyTriggerMatcher';
import type { UserStory, ConversationContext } from '../../types/stories';

describe('StoryTriggerMatcher - E2E Unit Tests', () => {
  let matcher: StoryTriggerMatcher;
  let mockStories: UserStory[];

  beforeEach(() => {
    matcher = new StoryTriggerMatcher();
    
    mockStories = [
      {
        id: 'story-1',
        owner_id: 'avatar-1',
        owner_type: 'avatar',
        title: 'College Memory',
        category: 'memory',
        triggers: 'college, university, graduation',
        audio_url: 'https://example.com/story1.mp3',
        duration_ms: 120000,
        priority: 80,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'story-2',
        owner_id: 'avatar-1',
        owner_type: 'avatar',
        title: 'Travel Adventure',
        category: 'experience',
        triggers: 'travel, adventure, backpacking',
        audio_url: 'https://example.com/story2.mp3',
        duration_ms: 180000,
        priority: 60,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'story-3',
        owner_id: 'avatar-1',
        owner_type: 'avatar',
        title: 'Career Advice',
        category: 'advice',
        triggers: 'career, job, work advice',
        audio_url: 'https://example.com/story3.mp3',
        duration_ms: 90000,
        priority: 90,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
  });

  describe('Exact Keyword Hit Verification', () => {
    it('should match exact single keyword case-insensitive', async () => {
      const matches = await matcher.matchTriggers(['college'], mockStories);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].story.id).toBe('story-1');
      expect(matches[0].matched_keywords).toContain('college');
      expect(matches[0].confidence).toBeGreaterThan(0.2);
    });

    it('should match exact keyword with different case', async () => {
      const matches = await matcher.matchTriggers(['COLLEGE'], mockStories);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].story.id).toBe('story-1');
      expect(matches[0].matched_keywords).toContain('college');
    });

    it('should match multiple exact keywords from same story', async () => {
      const matches = await matcher.matchTriggers(['college', 'university'], mockStories);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].story.id).toBe('story-1');
      expect(matches[0].matched_keywords).toEqual(expect.arrayContaining(['college', 'university']));
      expect(matches[0].confidence).toBeGreaterThan(0.5); // Higher confidence for multiple matches
    });

    it('should match exact phrase triggers', async () => {
      const matches = await matcher.matchTriggers(['work advice'], mockStories);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].story.id).toBe('story-3');
      expect(matches[0].matched_keywords).toContain('work advice');
    });

    it('should not match partial keywords', async () => {
      const matches = await matcher.matchTriggers(['coll'], mockStories);
      
      expect(matches).toHaveLength(0);
    });

    it('should not match similar but different words', async () => {
      const matches = await matcher.matchTriggers(['colleges'], mockStories);
      
      expect(matches).toHaveLength(0);
    });

    it('should match multiple stories with different keywords', async () => {
      const matches = await matcher.matchTriggers(['college', 'travel'], mockStories);
      
      expect(matches).toHaveLength(2);
      const storyIds = matches.map(m => m.story.id);
      expect(storyIds).toContain('story-1');
      expect(storyIds).toContain('story-2');
    });

    it('should sort stories by upload order (created_at)', async () => {
      const matches = await matcher.matchTriggers(['career', 'college'], mockStories);
      
      expect(matches).toHaveLength(2);
      // Stories are sorted by created_at (upload order) in MVP implementation
      expect(matches[0].story.id).toBe('story-1'); // First uploaded story
      expect(matches[1].story.id).toBe('story-3'); // Second uploaded story
    });

    it('should handle empty keyword list', async () => {
      const matches = await matcher.matchTriggers([], mockStories);
      
      expect(matches).toHaveLength(0);
    });

    it('should handle empty stories list', async () => {
      const matches = await matcher.matchTriggers(['college'], []);
      
      expect(matches).toHaveLength(0);
    });

    it('should only match active stories', async () => {
      const inactiveStory = { ...mockStories[0], status: 'inactive' as const };
      const matches = await matcher.matchTriggers(['college'], [inactiveStory]);
      
      expect(matches).toHaveLength(0);
    });
  });

  describe('Performance Requirements (8.1, 8.2)', () => {
    it('should complete keyword matching within 100ms', async () => {
      const startTime = performance.now();
      
      await matcher.matchTriggers(['college', 'travel', 'career'], mockStories);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(100); // Requirement 8.2: ≤ 100ms p95
    });

    it('should handle large keyword lists efficiently', async () => {
      const largeKeywordList = Array.from({ length: 50 }, (_, i) => `keyword${i}`);
      
      const startTime = performance.now();
      await matcher.matchTriggers(largeKeywordList, mockStories);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle large story collections efficiently', async () => {
      const largeStoryList = Array.from({ length: 100 }, (_, i) => ({
        ...mockStories[0],
        id: `story-${i}`,
        triggers: [`trigger${i}`, `keyword${i}`]
      }));
      
      const startTime = performance.now();
      await matcher.matchTriggers(['trigger50'], largeStoryList);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Context Relevance Calculation', () => {
    it('should include context relevance in match results', async () => {
      const matches = await matcher.matchTriggers(['college'], mockStories);
      
      expect(matches).toHaveLength(1);
      expect(matches[0]).toHaveProperty('context_relevance');
      expect(matches[0].context_relevance).toBeGreaterThan(0);
    });

    it('should calculate confidence based on matched keywords', async () => {
      const matches = await matcher.matchTriggers(['college', 'university'], mockStories);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].confidence).toBeGreaterThan(0.5); // 2 out of 3 triggers matched
    });
  });

  describe('Throttling and Cooldown', () => {
    const testAvatarId = 'test-avatar-1';

    beforeEach(() => {
      matcher.clearAllCooldowns();
    });

    it('should apply throttling to prevent story spam', async () => {
      const matches = await matcher.matchTriggers(['college'], mockStories);
      
      // First call should return matches (no cooldown)
      const throttledMatches1 = await matcher.applyThrottling(matches, testAvatarId);
      expect(throttledMatches1).toHaveLength(1);
      
      // Record the trigger to start cooldown
      matcher.recordTrigger(testAvatarId);
      
      // Immediate second call should be throttled (30s cooldown)
      const throttledMatches2 = await matcher.applyThrottling(matches, testAvatarId);
      expect(throttledMatches2).toHaveLength(0);
    });

    it('should allow matches after cooldown period', async () => {
      // Mock timer to simulate cooldown period
      vi.useFakeTimers();
      
      const matches = await matcher.matchTriggers(['college'], mockStories);
      
      // First call
      const throttledMatches1 = await matcher.applyThrottling(matches, testAvatarId);
      expect(throttledMatches1).toHaveLength(1);
      
      // Record trigger and check cooldown
      matcher.recordTrigger(testAvatarId);
      expect(matcher.isInCooldown(testAvatarId)).toBe(true);
      
      // Advance time by 31 seconds (past 30s cooldown)
      vi.advanceTimersByTime(31000);
      
      // Should allow matches again
      expect(matcher.isInCooldown(testAvatarId)).toBe(false);
      const throttledMatches2 = await matcher.applyThrottling(matches, testAvatarId);
      expect(throttledMatches2).toHaveLength(1);
      
      vi.useRealTimers();
    });
  });
});