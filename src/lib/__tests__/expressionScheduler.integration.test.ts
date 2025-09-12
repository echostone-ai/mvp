/**
 * Integration tests for Expression Scheduler with Storage Service
 */

import { describe, it, expect, vi } from 'vitest';
import { 
  scheduleOverlays, 
  convertStoredExpressionsToClips 
} from '../expressionScheduler';
import { StoredExpression } from '../services/expressionStorageService';

// Mock stored expressions that would come from the database
const mockStoredExpressions: StoredExpression[] = [
  {
    id: 'expr-1',
    ownerId: 'user-123',
    ownerType: 'user',
    filename: 'laugh-cheerful.mp3',
    type: 'laugh',
    tone: 'cheerful',
    placementHints: ['mid-sentence', 'after-joke'],
    durationMs: 850,
    priority: 8,
    status: 'active',
    cdnUrl: 'https://cdn.example.com/expressions/users/user-123/laugh-cheerful.mp3',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z'
  },
  {
    id: 'expr-2',
    ownerId: 'user-123',
    ownerType: 'user',
    filename: 'affirmation-strong.mp3',
    type: 'affirmation',
    tone: 'confident',
    placementHints: ['beginning', 'emphasis'],
    durationMs: 650,
    priority: 6,
    status: 'active',
    cdnUrl: 'https://cdn.example.com/expressions/users/user-123/affirmation-strong.mp3',
    createdAt: '2024-01-01T10:05:00Z',
    updatedAt: '2024-01-01T10:05:00Z'
  },
  {
    id: 'expr-3',
    ownerId: 'user-123',
    ownerType: 'user',
    filename: 'breath-natural.mp3',
    type: 'breath',
    durationMs: 400,
    priority: 3,
    status: 'active',
    cdnUrl: 'https://cdn.example.com/expressions/users/user-123/breath-natural.mp3',
    createdAt: '2024-01-01T10:10:00Z',
    updatedAt: '2024-01-01T10:10:00Z'
  },
  {
    id: 'expr-4',
    ownerId: 'user-123',
    ownerType: 'user',
    filename: 'sigh-disappointed.mp3',
    type: 'sigh',
    tone: 'disappointed',
    durationMs: 1100,
    priority: 5,
    status: 'inactive', // This should be filtered out
    cdnUrl: 'https://cdn.example.com/expressions/users/user-123/sigh-disappointed.mp3',
    createdAt: '2024-01-01T10:15:00Z',
    updatedAt: '2024-01-01T10:15:00Z'
  }
];

describe('Expression Scheduler Integration', () => {
  describe('end-to-end scheduling workflow', () => {
    it('should convert stored expressions and schedule overlays for conversation text', () => {
      // Simulate getting expressions from storage service
      const clips = convertStoredExpressionsToClips(mockStoredExpressions);
      
      // Should filter out inactive expressions
      expect(clips).toHaveLength(3);
      expect(clips.find(c => c.id === 'expr-4')).toBeUndefined();
      
      // Test conversation text that should trigger multiple expression types
      const conversationText = "Absolutely! That's hilarious and I completely agree with your point. This is a longer response that should naturally include some breathing pauses to make the speech sound more natural and human-like.";
      
      const schedule = scheduleOverlays(conversationText, clips, {
        maxOverlays: 2,
        minSpacingMs: 4000
      });
      
      // Should select appropriate expressions
      expect(schedule.length).toBeLessThanOrEqual(2);
      
      // Should include laugh (for "hilarious") and affirmation (for "absolutely", "agree")
      const types = schedule.map(s => s.clip.type);
      expect(types).toContain('laugh');
      expect(types).toContain('affirmation');
      
      // Should respect timing constraints
      if (schedule.length > 1) {
        const timeDiff = schedule[1].startTimeMs - schedule[0].startTimeMs;
        expect(timeDiff).toBeGreaterThanOrEqual(4000);
      }
      
      // Should have proper ducking levels
      schedule.forEach(s => {
        expect(s.duckingLevel).toBe(0.4);
        expect(s.clip.cdnUrl).toMatch(/^https:\/\/cdn\.example\.com/);
      });
    });

    it('should handle avatar expressions with higher priorities', () => {
      const avatarExpressions: StoredExpression[] = [
        {
          id: 'avatar-expr-1',
          ownerId: 'jonathan-demo',
          ownerType: 'avatar',
          filename: 'jonathan-laugh.mp3',
          type: 'laugh',
          tone: 'warm',
          placementHints: ['natural-pause'],
          durationMs: 750,
          priority: 10, // Higher priority than user expressions
          status: 'active',
          cdnUrl: 'https://cdn.example.com/expressions/avatars/jonathan-demo/jonathan-laugh.mp3',
          createdAt: '2024-01-01T09:00:00Z',
          updatedAt: '2024-01-01T09:00:00Z'
        },
        ...mockStoredExpressions.filter(e => e.status === 'active')
      ];

      const clips = convertStoredExpressionsToClips(avatarExpressions);
      const text = "That's really funny and hilarious!";
      
      const schedule = scheduleOverlays(text, clips, { maxOverlays: 1 });
      
      // Should prefer avatar expression due to higher priority
      expect(schedule).toHaveLength(1);
      expect(schedule[0].clip.id).toBe('avatar-expr-1');
      expect(schedule[0].clip.tone).toBe('warm');
    });

    it('should handle empty expression list gracefully', () => {
      const clips = convertStoredExpressionsToClips([]);
      const text = "Hello world, this is a test message.";
      
      const schedule = scheduleOverlays(text, clips);
      
      expect(schedule).toEqual([]);
    });

    it('should respect feature constraints in real-world scenario', () => {
      const clips = convertStoredExpressionsToClips(mockStoredExpressions);
      
      // Test with various conversation scenarios
      const scenarios = [
        {
          text: "Hi there! Welcome to our chat.",
          expectedTypes: ['greeting']
        },
        {
          text: "Unfortunately, that's not going to work. Oh well, we'll figure something else out.",
          expectedTypes: ['sigh'] // Note: sigh expression is inactive, so should not appear
        },
        {
          text: "Yes, exactly! That's absolutely correct and I definitely agree with your assessment.",
          expectedTypes: ['affirmation']
        }
      ];

      scenarios.forEach(scenario => {
        const schedule = scheduleOverlays(scenario.text, clips, {
          maxOverlays: 2,
          minSpacingMs: 4000
        });
        
        // Should respect overlay limits
        expect(schedule.length).toBeLessThanOrEqual(2);
        
        // Should have proper timing
        schedule.forEach((s, index) => {
          expect(s.startTimeMs).toBeGreaterThanOrEqual(0);
          if (index > 0) {
            const timeDiff = s.startTimeMs - schedule[index - 1].startTimeMs;
            expect(timeDiff).toBeGreaterThanOrEqual(4000);
          }
        });
        
        // Should have valid clip data
        schedule.forEach(s => {
          expect(s.clip.id).toBeTruthy();
          expect(s.clip.cdnUrl).toMatch(/^https:\/\//);
          expect(s.clip.durationMs).toBeGreaterThan(0);
          expect(s.duckingLevel).toBe(0.4);
        });
      });
    });

    it('should handle performance requirements for long text', () => {
      const clips = convertStoredExpressionsToClips(mockStoredExpressions);
      
      // Generate a long conversation text (simulate ~30 second speech)
      const longText = "This is a very long conversation that goes on and on with lots of details and explanations. ".repeat(20);
      
      const startTime = performance.now();
      const schedule = scheduleOverlays(longText, clips, {
        maxOverlays: 2,
        minSpacingMs: 4000
      });
      const endTime = performance.now();
      
      // Scheduling should be fast (under 10ms for performance)
      expect(endTime - startTime).toBeLessThan(10);
      
      // Should still respect constraints
      expect(schedule.length).toBeLessThanOrEqual(2);
      
      // Should distribute across the long duration
      if (schedule.length > 1) {
        const estimatedDuration = longText.length * 50;
        const lastStartTime = schedule[schedule.length - 1].startTimeMs;
        expect(lastStartTime).toBeLessThan(estimatedDuration * 0.9);
      }
    });
  });
});