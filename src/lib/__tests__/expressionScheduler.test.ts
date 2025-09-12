/**
 * Tests for Expression Overlay Scheduler
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  scheduleOverlays, 
  convertStoredExpressionToClip,
  convertStoredExpressionsToClips,
  ExpressionClip,
  OverlaySchedule,
  ScheduleOverlaysOptions 
} from '../expressionScheduler';
import { StoredExpression, ExpressionType } from '../services/expressionStorageService';

// Mock expression clips for testing
const mockClips: ExpressionClip[] = [
  {
    id: '1',
    type: 'laugh',
    cdnUrl: 'https://example.com/laugh.mp3',
    durationMs: 800,
    priority: 5
  },
  {
    id: '2',
    type: 'affirmation',
    tone: 'enthusiastic',
    cdnUrl: 'https://example.com/yes.mp3',
    durationMs: 600,
    priority: 3
  },
  {
    id: '3',
    type: 'sigh',
    cdnUrl: 'https://example.com/sigh.mp3',
    durationMs: 1200,
    priority: 4
  },
  {
    id: '4',
    type: 'breath',
    cdnUrl: 'https://example.com/breath.mp3',
    durationMs: 400,
    priority: 2
  },
  {
    id: '5',
    type: 'greeting',
    cdnUrl: 'https://example.com/hello.mp3',
    durationMs: 700,
    priority: 6
  },
  {
    id: '6',
    type: 'catchphrase',
    cdnUrl: 'https://example.com/catchphrase.mp3',
    durationMs: 900,
    priority: 1
  }
];

describe('scheduleOverlays', () => {
  describe('text analysis and expression selection', () => {
    it('should select laugh expressions for funny text', () => {
      const text = "That's hilarious! I can't stop laughing at that joke.";
      const result = scheduleOverlays(text, mockClips);
      
      expect(result.some(schedule => schedule.clip.type === 'laugh')).toBe(true);
    });

    it('should select affirmation expressions for agreement text', () => {
      const text = "Yes, absolutely! That's exactly right and I definitely agree.";
      const result = scheduleOverlays(text, mockClips);
      
      expect(result.some(schedule => schedule.clip.type === 'affirmation')).toBe(true);
    });

    it('should select sigh expressions for disappointing text', () => {
      const text = "Unfortunately, that's sadly not going to work. Oh well.";
      const result = scheduleOverlays(text, mockClips);
      
      expect(result.some(schedule => schedule.clip.type === 'sigh')).toBe(true);
    });

    it('should select greeting expressions for greeting text', () => {
      const text = "Hello there! Welcome to our conversation.";
      const result = scheduleOverlays(text, mockClips);
      
      expect(result.some(schedule => schedule.clip.type === 'greeting')).toBe(true);
    });

    it('should select breath expressions for long text', () => {
      const longText = "This is a very long piece of text that goes on and on with lots of details and explanations that would naturally require some breathing pauses during speech delivery to make it sound more natural and human-like.";
      const result = scheduleOverlays(longText, mockClips);
      
      expect(result.some(schedule => schedule.clip.type === 'breath')).toBe(true);
    });

    it('should not select expressions for neutral text', () => {
      const text = "The weather is nice today.";
      const result = scheduleOverlays(text, mockClips);
      
      // Should have very few or no matches for neutral text
      expect(result.length).toBeLessThanOrEqual(1);
    });
  });

  describe('overlay limits and constraints', () => {
    it('should enforce maximum 2 overlays per turn by default', () => {
      const text = "Hello! That's absolutely hilarious and I'm laughing so hard. Unfortunately, this is sadly disappointing.";
      const result = scheduleOverlays(text, mockClips);
      
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('should respect custom maxOverlays option', () => {
      const text = "Hello! That's absolutely hilarious and I'm laughing so hard. Unfortunately, this is sadly disappointing.";
      const options: ScheduleOverlaysOptions = { maxOverlays: 1 };
      const result = scheduleOverlays(text, mockClips, options);
      
      expect(result.length).toBeLessThanOrEqual(1);
    });

    it('should enforce minimum 4-second spacing by default', () => {
      const text = "Hello! That's absolutely hilarious and I'm laughing so hard.";
      const result = scheduleOverlays(text, mockClips);
      
      if (result.length > 1) {
        const timeDiff = result[1].startTimeMs - result[0].startTimeMs;
        expect(timeDiff).toBeGreaterThanOrEqual(4000);
      }
    });

    it('should respect custom minSpacingMs option', () => {
      const text = "Hello! That's absolutely hilarious and I'm laughing so hard.";
      const options: ScheduleOverlaysOptions = { minSpacingMs: 6000 };
      const result = scheduleOverlays(text, mockClips, options);
      
      if (result.length > 1) {
        const timeDiff = result[1].startTimeMs - result[0].startTimeMs;
        expect(timeDiff).toBeGreaterThanOrEqual(6000);
      }
    });

    it('should avoid duplicate expression types in same turn', () => {
      const clipsWithDuplicates: ExpressionClip[] = [
        ...mockClips,
        {
          id: '7',
          type: 'laugh', // Duplicate type
          cdnUrl: 'https://example.com/laugh2.mp3',
          durationMs: 700,
          priority: 4
        }
      ];
      
      const text = "That's hilarious! So funny and amusing!";
      const result = scheduleOverlays(text, clipsWithDuplicates);
      
      const types = result.map(schedule => schedule.clip.type);
      const uniqueTypes = new Set(types);
      expect(types.length).toBe(uniqueTypes.size);
    });
  });

  describe('timing and scheduling', () => {
    it('should return schedules sorted by start time', () => {
      const text = "Hello! That's absolutely hilarious and I'm laughing so hard.";
      const result = scheduleOverlays(text, mockClips);
      
      for (let i = 1; i < result.length; i++) {
        expect(result[i].startTimeMs).toBeGreaterThanOrEqual(result[i - 1].startTimeMs);
      }
    });

    it('should set appropriate ducking level', () => {
      const text = "That's hilarious!";
      const result = scheduleOverlays(text, mockClips);
      
      result.forEach(schedule => {
        expect(schedule.duckingLevel).toBe(0.4); // Default ducking amount
      });
    });

    it('should respect custom ducking amount', () => {
      const text = "That's hilarious!";
      const options: ScheduleOverlaysOptions = { duckingAmount: 0.6 };
      const result = scheduleOverlays(text, mockClips, options);
      
      result.forEach(schedule => {
        expect(schedule.duckingLevel).toBe(0.6);
      });
    });

    it('should distribute expressions across estimated duration', () => {
      const longText = "This is a very long text that should have expressions distributed across its duration rather than clustered at the beginning or end of the speech.";
      const result = scheduleOverlays(longText, mockClips);
      
      if (result.length > 1) {
        const estimatedDuration = longText.length * 50;
        const lastStartTime = result[result.length - 1].startTimeMs;
        
        // Last expression should start well before the end
        expect(lastStartTime).toBeLessThan(estimatedDuration * 0.9);
        // But not too early either
        expect(lastStartTime).toBeGreaterThan(estimatedDuration * 0.3);
      }
    });

    it('should handle empty clips array gracefully', () => {
      const text = "Hello world!";
      const result = scheduleOverlays(text, []);
      
      expect(result).toEqual([]);
    });

    it('should handle empty text gracefully', () => {
      const text = "";
      const result = scheduleOverlays(text, mockClips);
      
      expect(result).toEqual([]);
    });
  });

  describe('priority handling', () => {
    it('should prioritize higher priority expressions', () => {
      const text = "Hello! That's absolutely hilarious!"; // Matches both greeting and laugh
      const result = scheduleOverlays(text, mockClips, { maxOverlays: 1 });
      
      if (result.length > 0) {
        // Should select greeting (priority 6) over laugh (priority 5)
        expect(result[0].clip.type).toBe('greeting');
      }
    });

    it('should use type preference as secondary sort', () => {
      const clipsWithSamePriority: ExpressionClip[] = [
        {
          id: '1',
          type: 'laugh',
          cdnUrl: 'https://example.com/laugh.mp3',
          durationMs: 800,
          priority: 5
        },
        {
          id: '2',
          type: 'affirmation',
          cdnUrl: 'https://example.com/yes.mp3',
          durationMs: 600,
          priority: 5 // Same priority as laugh
        }
      ];
      
      const text = "Yes, that's absolutely hilarious!"; // Matches both
      const result = scheduleOverlays(text, clipsWithSamePriority, { maxOverlays: 1 });
      
      if (result.length > 0) {
        // Should prefer laugh over affirmation based on type order
        expect(result[0].clip.type).toBe('laugh');
      }
    });
  });
});

describe('convertStoredExpressionToClip', () => {
  it('should convert StoredExpression to ExpressionClip correctly', () => {
    const stored: StoredExpression = {
      id: 'test-id',
      ownerId: 'user-123',
      ownerType: 'user',
      filename: 'laugh.mp3',
      type: 'laugh',
      tone: 'cheerful',
      placementHints: ['mid-sentence'],
      durationMs: 800,
      priority: 5,
      status: 'active',
      cdnUrl: 'https://example.com/laugh.mp3',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };

    const clip = convertStoredExpressionToClip(stored);

    expect(clip).toEqual({
      id: 'test-id',
      type: 'laugh',
      tone: 'cheerful',
      placementHints: ['mid-sentence'],
      cdnUrl: 'https://example.com/laugh.mp3',
      durationMs: 800,
      priority: 5
    });
  });

  it('should handle missing optional fields', () => {
    const stored: StoredExpression = {
      id: 'test-id',
      ownerId: 'user-123',
      ownerType: 'user',
      filename: 'breath.mp3',
      type: 'breath',
      durationMs: 400,
      status: 'active',
      cdnUrl: 'https://example.com/breath.mp3',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };

    const clip = convertStoredExpressionToClip(stored);

    expect(clip).toEqual({
      id: 'test-id',
      type: 'breath',
      tone: undefined,
      placementHints: undefined,
      cdnUrl: 'https://example.com/breath.mp3',
      durationMs: 400,
      priority: 0 // Default priority
    });
  });
});

describe('convertStoredExpressionsToClips', () => {
  it('should convert array of StoredExpressions to ExpressionClips', () => {
    const stored: StoredExpression[] = [
      {
        id: '1',
        ownerId: 'user-123',
        ownerType: 'user',
        filename: 'laugh.mp3',
        type: 'laugh',
        durationMs: 800,
        priority: 5,
        status: 'active',
        cdnUrl: 'https://example.com/laugh.mp3',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      },
      {
        id: '2',
        ownerId: 'user-123',
        ownerType: 'user',
        filename: 'sigh.mp3',
        type: 'sigh',
        durationMs: 600,
        priority: 3,
        status: 'active',
        cdnUrl: 'https://example.com/sigh.mp3',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }
    ];

    const clips = convertStoredExpressionsToClips(stored);

    expect(clips).toHaveLength(2);
    expect(clips[0].id).toBe('1');
    expect(clips[0].type).toBe('laugh');
    expect(clips[1].id).toBe('2');
    expect(clips[1].type).toBe('sigh');
  });

  it('should filter out inactive expressions', () => {
    const stored: StoredExpression[] = [
      {
        id: '1',
        ownerId: 'user-123',
        ownerType: 'user',
        filename: 'laugh.mp3',
        type: 'laugh',
        durationMs: 800,
        priority: 5,
        status: 'active',
        cdnUrl: 'https://example.com/laugh.mp3',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      },
      {
        id: '2',
        ownerId: 'user-123',
        ownerType: 'user',
        filename: 'sigh.mp3',
        type: 'sigh',
        durationMs: 600,
        priority: 3,
        status: 'inactive', // Should be filtered out
        cdnUrl: 'https://example.com/sigh.mp3',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }
    ];

    const clips = convertStoredExpressionsToClips(stored);

    expect(clips).toHaveLength(1);
    expect(clips[0].id).toBe('1');
  });

  it('should handle empty array', () => {
    const clips = convertStoredExpressionsToClips([]);
    expect(clips).toEqual([]);
  });
});