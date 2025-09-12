/**
 * Unit tests for StoryTriggerMatcher
 * Tests trigger matching accuracy, performance, and cooldown functionality
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  StoryTriggerMatcher, 
  analyzeTextQuick, 
  hasExactMatch, 
  calculateConfidence 
} from '../storyTriggerMatcher';
import { UserStory, StoryTriggerMatch } from '../../types/stories';

// Mock stories for testing
const createMockStory = (
  id: string, 
  triggers: string, 
  createdAt: string = new Date().toISOString(),
  status: 'active' | 'inactive' = 'active'
): UserStory => ({
  id,
  owner_id: 'test-avatar-1',
  owner_type: 'avatar',
  title: `Test Story ${id}`,
  category: 'memory',
  triggers,
  audio_url: `https://test.com/${id}.mp3`,
  duration_ms: 120000,
  priority: 50,
  status,
  created_at: createdAt,
  updated_at: createdAt
});

describe('StoryTriggerMatcher', () => {
  let matcher: StoryTriggerMatcher;
  let mockStories: UserStory[];

  beforeEach(() => {
    matcher = new StoryTriggerMatcher();
    
    // Create test stories with different creation times to test upload order
    mockStories = [
      createMockStory('story-1', 'family, childhood, memories', '2024-01-01T10:00:00Z'),
      createMockStory('story-2', 'work, career, success', '2024-01-01T11:00:00Z'),
      createMockStory('story-3', 'travel, adventure, europe', '2024-01-01T12:00:00Z'),
      createMockStory('story-4', 'cooking, recipe, grandmother', '2024-01-01T13:00:00Z'),
      createMockStory('story-5', 'music, guitar, band', '2024-01-01T14:00:00Z'),
    ];
  });

  afterEach(() => {
    matcher.clearAllCooldowns();
  });

  describe('Text Analysis', () => {
    it('should extract keywords from simple text', () => {
      const text = 'I love spending time with my family';
      const keywords = matcher.analyzeText(text);
      
      expect(keywords).toContain('love');
      expect(keywords).toContain('spending');
      expect(keywords).toContain('time');
      expect(keywords).toContain('family');
    });

    it('should normalize text to lowercase', () => {
      const text = 'FAMILY Childhood MEMORIES';
      const keywords = matcher.analyzeText(text);
      
      expect(keywords).toEqual(['family', 'childhood', 'memories']);
    });

    it('should filter out short words', () => {
      const text = 'I am a big fan of music';
      const keywords = matcher.analyzeText(text);
      
      expect(keywords).not.toContain('i');
      expect(keywords).not.toContain('am');
      expect(keywords).not.toContain('a');
      expect(keywords).toContain('big');
      expect(keywords).toContain('fan');
      expect(keywords).toContain('music');
    });

    it('should handle punctuation correctly', () => {
      const text = 'Hello, world! How are you? I\'m fine.';
      const keywords = matcher.analyzeText(text);
      
      expect(keywords).toContain('hello');
      expect(keywords).toContain('world');
      expect(keywords).toContain('how');
      expect(keywords).toContain('are');
      expect(keywords).toContain('you');
      expect(keywords).toContain('fine');
    });

    it('should remove duplicates', () => {
      const text = 'family family family memories';
      const keywords = matcher.analyzeText(text);
      
      expect(keywords.filter(k => k === 'family')).toHaveLength(1);
      expect(keywords).toContain('memories');
    });

    it('should handle empty or invalid input', () => {
      expect(matcher.analyzeText('')).toEqual([]);
      expect(matcher.analyzeText('   ')).toEqual([]);
      expect(matcher.analyzeText(null as any)).toEqual([]);
      expect(matcher.analyzeText(undefined as any)).toEqual([]);
    });

    it('should limit number of keywords for performance', () => {
      const longText = Array(50).fill('word').map((w, i) => `${w}${i}`).join(' ');
      const keywords = matcher.analyzeText(longText);
      
      expect(keywords.length).toBeLessThanOrEqual(20);
    });
  });

  describe('Trigger Matching', () => {
    it('should find exact case-insensitive matches', async () => {
      const inputKeywords = ['family', 'memories'];
      const matches = await matcher.matchTriggers(inputKeywords, mockStories);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].story.id).toBe('story-1');
      expect(matches[0].matched_keywords).toContain('family');
      expect(matches[0].matched_keywords).toContain('memories');
    });

    it('should handle case variations', async () => {
      const inputKeywords = ['FAMILY', 'Childhood'];
      const matches = await matcher.matchTriggers(inputKeywords, mockStories);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].story.id).toBe('story-1');
    });

    it('should match multiple stories', async () => {
      const inputKeywords = ['family', 'work'];
      const matches = await matcher.matchTriggers(inputKeywords, mockStories);
      
      expect(matches).toHaveLength(2);
      const storyIds = matches.map(m => m.story.id);
      expect(storyIds).toContain('story-1');
      expect(storyIds).toContain('story-2');
    });

    it('should calculate confidence correctly', async () => {
      const inputKeywords = ['family', 'childhood']; // 2 out of 3 triggers for story-1
      const matches = await matcher.matchTriggers(inputKeywords, mockStories);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].confidence).toBeCloseTo(2/3, 2);
    });

    it('should sort by upload order (created_at ascending)', async () => {
      // Add keywords that match multiple stories
      const story1 = createMockStory('newer', 'test, keyword', '2024-01-01T20:00:00Z');
      const story2 = createMockStory('older', 'test, keyword', '2024-01-01T10:00:00Z');
      const stories = [story1, story2];
      
      const inputKeywords = ['test'];
      const matches = await matcher.matchTriggers(inputKeywords, stories);
      
      expect(matches).toHaveLength(2);
      expect(matches[0].story.id).toBe('older'); // Older story first
      expect(matches[1].story.id).toBe('newer');
    });

    it('should skip inactive stories', async () => {
      const inactiveStory = createMockStory('inactive', 'family, test', '2024-01-01T10:00:00Z', 'inactive');
      const stories = [...mockStories, inactiveStory];
      
      const inputKeywords = ['test'];
      const matches = await matcher.matchTriggers(inputKeywords, stories);
      
      expect(matches.every(m => m.story.status === 'active')).toBe(true);
    });

    it('should handle empty inputs gracefully', async () => {
      expect(await matcher.matchTriggers([], mockStories)).toEqual([]);
      expect(await matcher.matchTriggers(['family'], [])).toEqual([]);
    });

    it('should limit number of matches', async () => {
      const matcher = new StoryTriggerMatcher({ maxMatches: 2 });
      
      // Create many stories with same trigger
      const manyStories = Array(10).fill(0).map((_, i) => 
        createMockStory(`story-${i}`, 'common', `2024-01-01T${10 + i}:00:00Z`)
      );
      
      const matches = await matcher.matchTriggers(['common'], manyStories);
      expect(matches).toHaveLength(2);
    });
  });

  describe('Story Selection', () => {
    it('should select first match (oldest story)', async () => {
      const matches: StoryTriggerMatch[] = [
        {
          story: mockStories[0],
          confidence: 0.8,
          matched_keywords: ['family'],
          context_relevance: 0.8
        },
        {
          story: mockStories[1],
          confidence: 0.6,
          matched_keywords: ['work'],
          context_relevance: 0.6
        }
      ];
      
      const selected = await matcher.selectBestStory(matches);
      expect(selected?.id).toBe('story-1');
    });

    it('should return null for empty matches', async () => {
      const selected = await matcher.selectBestStory([]);
      expect(selected).toBeNull();
    });
  });

  describe('Cooldown Mechanism', () => {
    it('should not be in cooldown initially', () => {
      expect(matcher.isInCooldown('avatar-1')).toBe(false);
    });

    it('should be in cooldown after recording trigger', () => {
      matcher.recordTrigger('avatar-1');
      expect(matcher.isInCooldown('avatar-1')).toBe(true);
    });

    it('should calculate remaining cooldown time', () => {
      matcher.recordTrigger('avatar-1');
      const remaining = matcher.getRemainingCooldown('avatar-1');
      
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(30000); // 30 seconds
    });

    it('should exit cooldown after timeout', async () => {
      const shortCooldownMatcher = new StoryTriggerMatcher({ cooldownMs: 100 });
      
      shortCooldownMatcher.recordTrigger('avatar-1');
      expect(shortCooldownMatcher.isInCooldown('avatar-1')).toBe(true);
      
      // Wait for cooldown to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(shortCooldownMatcher.isInCooldown('avatar-1')).toBe(false);
    });

    it('should handle multiple avatars independently', () => {
      matcher.recordTrigger('avatar-1');
      matcher.recordTrigger('avatar-2');
      
      expect(matcher.isInCooldown('avatar-1')).toBe(true);
      expect(matcher.isInCooldown('avatar-2')).toBe(true);
      
      matcher.clearCooldown('avatar-1');
      expect(matcher.isInCooldown('avatar-1')).toBe(false);
      expect(matcher.isInCooldown('avatar-2')).toBe(true);
    });

    it('should allow disabling cooldown', () => {
      const noCooldownMatcher = new StoryTriggerMatcher({ enableCooldown: false });
      
      noCooldownMatcher.recordTrigger('avatar-1');
      expect(noCooldownMatcher.isInCooldown('avatar-1')).toBe(false);
    });
  });

  describe('Throttling', () => {
    it('should return matches when not in cooldown', async () => {
      const matches: StoryTriggerMatch[] = [
        {
          story: mockStories[0],
          confidence: 0.8,
          matched_keywords: ['family'],
          context_relevance: 0.8
        }
      ];
      
      const throttled = await matcher.applyThrottling(matches, 'avatar-1');
      expect(throttled).toEqual(matches);
    });

    it('should return empty array when in cooldown', async () => {
      matcher.recordTrigger('avatar-1');
      
      const matches: StoryTriggerMatch[] = [
        {
          story: mockStories[0],
          confidence: 0.8,
          matched_keywords: ['family'],
          context_relevance: 0.8
        }
      ];
      
      const throttled = await matcher.applyThrottling(matches, 'avatar-1');
      expect(throttled).toEqual([]);
    });
  });

  describe('Complete Workflow', () => {
    it('should handle complete matching workflow', async () => {
      const inputText = 'Tell me about your family memories';
      const matches = await matcher.findMatchingStories(inputText, mockStories, 'avatar-1');
      
      expect(matches).toHaveLength(1);
      expect(matches[0].story.id).toBe('story-1');
      expect(matches[0].matched_keywords).toContain('family');
      expect(matches[0].matched_keywords).toContain('memories');
    });

    it('should respect cooldown in complete workflow', async () => {
      const inputText = 'Tell me about your family memories';
      
      // First call should work
      const matches1 = await matcher.findMatchingStories(inputText, mockStories, 'avatar-1');
      expect(matches1).toHaveLength(1);
      
      // Record trigger to start cooldown
      matcher.recordTrigger('avatar-1');
      
      // Second call should be throttled
      const matches2 = await matcher.findMatchingStories(inputText, mockStories, 'avatar-1');
      expect(matches2).toEqual([]);
    });

    it('should handle no matches gracefully', async () => {
      const inputText = 'completely unrelated topic';
      const matches = await matcher.findMatchingStories(inputText, mockStories, 'avatar-1');
      
      expect(matches).toEqual([]);
    });
  });

  describe('Performance', () => {
    it('should handle large number of stories efficiently', async () => {
      // Create 1000 test stories
      const largeStorySet = Array(1000).fill(0).map((_, i) => 
        createMockStory(`story-${i}`, `trigger${i}, common`, `2024-01-01T${10}:${i % 60}:00Z`)
      );
      
      const startTime = performance.now();
      const matches = await matcher.findMatchingStories('common trigger', largeStorySet, 'avatar-1');
      const endTime = performance.now();
      
      // Should complete within reasonable time (< 100ms for 1000 stories)
      expect(endTime - startTime).toBeLessThan(100);
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should handle long input text efficiently', async () => {
      const longText = Array(100).fill('family memories childhood').join(' ');
      
      const startTime = performance.now();
      const matches = await matcher.findMatchingStories(longText, mockStories, 'avatar-1');
      const endTime = performance.now();
      
      // Should complete quickly even with long input
      expect(endTime - startTime).toBeLessThan(50);
      expect(matches).toHaveLength(1);
    });
  });

  describe('Configuration', () => {
    it('should allow updating options at runtime', () => {
      matcher.updateOptions({ cooldownMs: 60000, maxMatches: 5 });
      const options = matcher.getOptions();
      
      expect(options.cooldownMs).toBe(60000);
      expect(options.maxMatches).toBe(5);
    });

    it('should provide cooldown status for debugging', () => {
      matcher.recordTrigger('avatar-1');
      matcher.recordTrigger('avatar-2');
      
      const status = matcher.getCooldownStatus();
      expect(status).toHaveLength(2);
      expect(status.some(s => s.avatarId === 'avatar-1')).toBe(true);
      expect(status.some(s => s.avatarId === 'avatar-2')).toBe(true);
    });
  });
});

describe('Helper Functions', () => {
  describe('analyzeTextQuick', () => {
    it('should work without instantiating matcher', () => {
      const keywords = analyzeTextQuick('Hello world family memories');
      expect(keywords).toContain('hello');
      expect(keywords).toContain('world');
      expect(keywords).toContain('family');
      expect(keywords).toContain('memories');
    });

    it('should respect custom minimum length', () => {
      const keywords = analyzeTextQuick('I am big', 2);
      expect(keywords).toContain('am');
      expect(keywords).toContain('big');
    });
  });

  describe('hasExactMatch', () => {
    it('should detect exact matches', () => {
      expect(hasExactMatch(['family', 'work'], ['family', 'memories'])).toBe(true);
      expect(hasExactMatch(['family', 'work'], ['travel', 'adventure'])).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(hasExactMatch(['FAMILY'], ['family'])).toBe(true);
      expect(hasExactMatch(['family'], ['FAMILY'])).toBe(true);
    });

    it('should handle empty arrays', () => {
      expect(hasExactMatch([], ['family'])).toBe(false);
      expect(hasExactMatch(['family'], [])).toBe(false);
      expect(hasExactMatch([], [])).toBe(false);
    });
  });

  describe('calculateConfidence', () => {
    it('should calculate correct ratios', () => {
      expect(calculateConfidence(2, 4)).toBe(0.5);
      expect(calculateConfidence(3, 3)).toBe(1);
      expect(calculateConfidence(0, 5)).toBe(0);
    });

    it('should handle edge cases', () => {
      expect(calculateConfidence(5, 0)).toBe(0);
      expect(calculateConfidence(5, 3)).toBe(1); // Capped at 1
    });
  });
});