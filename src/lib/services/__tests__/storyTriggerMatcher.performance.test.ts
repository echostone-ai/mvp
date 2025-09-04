/**
 * Performance tests for StoryTriggerMatcher
 * Verifies that trigger matching meets the performance requirements from task 6
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StoryTriggerMatcher } from '../storyTriggerMatcher';
import { UserStory } from '../../types/stories';

// Create mock stories for performance testing
const createMockStory = (
  id: string, 
  triggers: string, 
  createdAt: string = new Date().toISOString()
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
  status: 'active',
  created_at: createdAt,
  updated_at: createdAt
});

describe('StoryTriggerMatcher Performance', () => {
  let matcher: StoryTriggerMatcher;

  beforeEach(() => {
    matcher = new StoryTriggerMatcher();
  });

  describe('Requirement 8.2: Trigger matching performance', () => {
    it('should complete trigger matching in under 100ms for 100 stories', async () => {
      // Create 100 test stories with various triggers
      const stories = Array(100).fill(0).map((_, i) => 
        createMockStory(
          `story-${i}`, 
          `trigger${i}, common, keyword${i % 10}`,
          `2024-01-01T${10 + Math.floor(i / 60)}:${i % 60}:00Z`
        )
      );

      const inputText = 'Tell me about common keyword5 experiences';
      
      const startTime = performance.now();
      const matches = await matcher.findMatchingStories(inputText, stories, 'avatar-1');
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      // Should complete within 100ms as per requirement 8.2
      expect(duration).toBeLessThan(100);
      expect(matches.length).toBeGreaterThan(0);
      
      console.log(`Trigger matching for 100 stories completed in ${duration.toFixed(2)}ms`);
    });

    it('should complete trigger matching in under 50ms for 50 stories', async () => {
      // Create 50 test stories
      const stories = Array(50).fill(0).map((_, i) => 
        createMockStory(
          `story-${i}`, 
          `trigger${i}, family, memory${i % 5}`,
          `2024-01-01T${10 + Math.floor(i / 60)}:${i % 60}:00Z`
        )
      );

      const inputText = 'Tell me about family memory2';
      
      const startTime = performance.now();
      const matches = await matcher.findMatchingStories(inputText, stories, 'avatar-1');
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      // Should be well under 100ms for smaller datasets
      expect(duration).toBeLessThan(50);
      expect(matches.length).toBeGreaterThan(0);
      
      console.log(`Trigger matching for 50 stories completed in ${duration.toFixed(2)}ms`);
    });

    it('should handle text analysis efficiently for long input', async () => {
      // Create a long input text (500 words) with important keywords at the beginning
      const longText = 'family memories childhood ' + Array(500).fill(0)
        .map((_, i) => `word${i}`)
        .join(' ');

      const startTime = performance.now();
      const keywords = matcher.analyzeText(longText);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      // Text analysis should be very fast
      expect(duration).toBeLessThan(10);
      expect(keywords).toContain('family');
      expect(keywords).toContain('memories');
      expect(keywords).toContain('childhood');
      
      console.log(`Text analysis for 500-word input completed in ${duration.toFixed(2)}ms`);
    });

    it('should handle concurrent trigger matching efficiently', async () => {
      // Create test stories
      const stories = Array(50).fill(0).map((_, i) => 
        createMockStory(
          `story-${i}`, 
          `trigger${i}, common, test`,
          `2024-01-01T${10 + Math.floor(i / 60)}:${i % 60}:00Z`
        )
      );

      const inputTexts = [
        'Tell me about common experiences',
        'Share a test story',
        'What about trigger5',
        'Any common memories',
        'Tell me about trigger10'
      ];

      const startTime = performance.now();
      
      // Run concurrent matching operations
      const promises = inputTexts.map(text => 
        matcher.findMatchingStories(text, stories, 'avatar-1')
      );
      
      const results = await Promise.all(promises);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      // All concurrent operations should complete quickly
      expect(duration).toBeLessThan(100);
      
      // Each should find at least one match
      results.forEach(matches => {
        expect(matches.length).toBeGreaterThan(0);
      });
      
      console.log(`5 concurrent trigger matching operations completed in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Memory efficiency', () => {
    it('should not consume excessive memory with large story sets', async () => {
      // Create a large number of stories
      const stories = Array(1000).fill(0).map((_, i) => 
        createMockStory(
          `story-${i}`, 
          `trigger${i}, common, keyword${i % 100}`,
          `2024-01-01T${10 + Math.floor(i / 60)}:${i % 60}:00Z`
        )
      );

      const inputText = 'Tell me about common keyword50';
      
      // Measure memory usage (rough approximation)
      const initialMemory = process.memoryUsage().heapUsed;
      
      const matches = await matcher.findMatchingStories(inputText, stories, 'avatar-1');
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Should not use excessive memory (less than 10MB increase)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
      expect(matches.length).toBeGreaterThan(0);
      
      console.log(`Memory increase for 1000 stories: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should clean up resources properly', async () => {
      const stories = Array(100).fill(0).map((_, i) => 
        createMockStory(`story-${i}`, `trigger${i}, test`)
      );

      // Run multiple operations
      for (let i = 0; i < 10; i++) {
        await matcher.findMatchingStories(`test trigger${i}`, stories, 'avatar-1');
      }

      // Clear cooldowns to test cleanup
      matcher.clearAllCooldowns();
      
      // Should not throw or cause memory leaks
      expect(matcher.getCooldownStatus()).toEqual([]);
    });
  });

  describe('Cooldown performance', () => {
    it('should handle cooldown checks efficiently', async () => {
      // Record triggers for many avatars
      const avatarIds = Array(100).fill(0).map((_, i) => `avatar-${i}`);
      
      avatarIds.forEach(id => matcher.recordTrigger(id));
      
      const startTime = performance.now();
      
      // Check cooldown status for all avatars
      const results = avatarIds.map(id => matcher.isInCooldown(id));
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete quickly even with many avatars
      expect(duration).toBeLessThan(10);
      expect(results.every(result => result === true)).toBe(true);
      
      console.log(`Cooldown checks for 100 avatars completed in ${duration.toFixed(2)}ms`);
    });

    it('should handle cooldown cleanup efficiently', async () => {
      // Create many cooldown entries
      const avatarIds = Array(1000).fill(0).map((_, i) => `avatar-${i}`);
      avatarIds.forEach(id => matcher.recordTrigger(id));
      
      const startTime = performance.now();
      matcher.clearAllCooldowns();
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      // Cleanup should be fast
      expect(duration).toBeLessThan(5);
      expect(matcher.getCooldownStatus()).toEqual([]);
      
      console.log(`Cooldown cleanup for 1000 entries completed in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Edge case performance', () => {
    it('should handle empty inputs efficiently', async () => {
      const stories = Array(100).fill(0).map((_, i) => 
        createMockStory(`story-${i}`, `trigger${i}`)
      );

      const startTime = performance.now();
      
      // Test various empty inputs
      await matcher.findMatchingStories('', stories, 'avatar-1');
      await matcher.findMatchingStories('   ', stories, 'avatar-1');
      await matcher.findMatchingStories('a b', stories, 'avatar-1'); // Short words
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should handle empty inputs very quickly
      expect(duration).toBeLessThan(5);
      
      console.log(`Empty input handling completed in ${duration.toFixed(2)}ms`);
    });

    it('should handle stories with no triggers efficiently', async () => {
      const stories = Array(50).fill(0).map((_, i) => 
        createMockStory(`story-${i}`, '') // Empty triggers
      );

      const startTime = performance.now();
      const matches = await matcher.findMatchingStories('test input', stories, 'avatar-1');
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      // Should handle gracefully and quickly
      expect(duration).toBeLessThan(10);
      expect(matches).toEqual([]);
      
      console.log(`No-trigger stories handling completed in ${duration.toFixed(2)}ms`);
    });
  });
});