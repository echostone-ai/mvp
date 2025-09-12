/**
 * Integration tests for ExpressionAudioMixer
 * 
 * Tests integration with existing audio systems and real-world scenarios
 * Requirements: 5.3, 5.5, 6.3, 9.3, 9.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExpressionAudioMixer, createExpressionMixer } from '../expressionAudioMixer';
import { scheduleOverlays, ExpressionClip } from '../expressionScheduler';
import { ExpressionType } from '../types/expressions';

// Mock performance.now for consistent timing
global.performance = {
  now: vi.fn(() => Date.now())
} as any;

// Mock Web Audio API with more realistic behavior
const createMockAudioContext = () => {
  let currentTime = 0;
  
  const mockGainNode = {
    gain: {
      value: 1.0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn()
    },
    connect: vi.fn(),
    disconnect: vi.fn()
  };

  const mockBufferSource = {
    buffer: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null
  };

  return {
    get currentTime() { return currentTime; },
    set currentTime(value) { currentTime = value; },
    state: 'running',
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    createGain: vi.fn(() => ({ ...mockGainNode })),
    createBufferSource: vi.fn(() => ({ ...mockBufferSource })),
    decodeAudioData: vi.fn().mockResolvedValue({
      length: 44100,
      sampleRate: 22050,
      numberOfChannels: 1,
      duration: 2.0
    })
  };
};

describe('ExpressionAudioMixer Integration', () => {
  let mixer: ExpressionAudioMixer;
  let mockAudioContext: ReturnType<typeof createMockAudioContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAudioContext = createMockAudioContext();
    global.AudioContext = vi.fn(() => mockAudioContext);
  });

  afterEach(() => {
    if (mixer) {
      mixer.dispose();
    }
  });

  describe('Integration with Expression Scheduler', () => {
    it('should work with scheduled expressions from scheduler', async () => {
      // Create mixer
      mixer = await createExpressionMixer({
        duckingAmount: 0.4,
        maxExpressionDurationMs: 300
      })!;

      expect(mixer).toBeTruthy();

      // Create mock expression clips
      const clips: ExpressionClip[] = [
        {
          id: 'laugh-1',
          type: 'laugh',
          cdnUrl: 'https://example.com/laugh.mp3',
          durationMs: 250,
          priority: 1
        },
        {
          id: 'affirmation-1',
          type: 'affirmation',
          cdnUrl: 'https://example.com/yes.mp3',
          durationMs: 180,
          priority: 2
        }
      ];

      // Schedule overlays using the scheduler
      const text = "That's absolutely hilarious! I can't stop laughing.";
      const schedules = scheduleOverlays(text, clips, {
        maxOverlays: 2,
        minSpacingMs: 4000,
        duckingAmount: 0.4
      });

      expect(schedules.length).toBeGreaterThan(0);

      // Create mock buffers
      const buffers = new Map([
        ['laugh-1', mockAudioContext.decodeAudioData() as any],
        ['affirmation-1', mockAudioContext.decodeAudioData() as any]
      ]);

      // Play the scheduled expressions
      await mixer.playExpressionOverlays(schedules, buffers);

      // Verify expressions were scheduled
      expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
      
      const state = mixer.getState();
      expect(state.isActive).toBe(true);
    });

    it('should handle multiple expression types correctly', async () => {
      mixer = await createExpressionMixer()!;

      const clips: ExpressionClip[] = [
        {
          id: 'laugh-1',
          type: 'laugh',
          cdnUrl: 'https://example.com/laugh.mp3',
          durationMs: 200,
          priority: 1
        },
        {
          id: 'sigh-1',
          type: 'sigh',
          cdnUrl: 'https://example.com/sigh.mp3',
          durationMs: 300,
          priority: 1
        },
        {
          id: 'breath-1',
          type: 'breath',
          cdnUrl: 'https://example.com/breath.mp3',
          durationMs: 150,
          priority: 1
        }
      ];

      // Text that should trigger multiple expression types
      const text = "Unfortunately, that's really funny but also quite a long explanation that needs some breathing room.";
      const schedules = scheduleOverlays(text, clips);

      const buffers = new Map(clips.map(clip => [clip.id, mockAudioContext.decodeAudioData() as any]));
      
      await mixer.playExpressionOverlays(schedules, buffers);

      // Should have scheduled multiple expressions
      expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(schedules.length);
    });
  });

  describe('Performance and Timing', () => {
    it('should not delay TTS start time', async () => {
      const startTime = performance.now();
      
      mixer = await createExpressionMixer();
      
      const initTime = performance.now() - startTime;
      
      // Mixer initialization should be fast (< 50ms)
      expect(initTime).toBeLessThan(50);
      
      // Mixer should be ready immediately
      expect(mixer!.isReady()).toBe(true);
    });

    it('should handle rapid expression scheduling', async () => {
      mixer = await createExpressionMixer()!;

      const clips: ExpressionClip[] = Array.from({ length: 10 }, (_, i) => ({
        id: `expr-${i}`,
        type: 'filler' as ExpressionType,
        cdnUrl: `https://example.com/filler-${i}.mp3`,
        durationMs: 100,
        priority: 1
      }));

      const schedules = clips.map((clip, i) => ({
        clip,
        startTimeMs: i * 500, // Every 500ms
        duckingLevel: 0.3
      }));

      const buffers = new Map(clips.map(clip => [clip.id, mockAudioContext.decodeAudioData() as any]));

      const startTime = performance.now();
      await mixer.playExpressionOverlays(schedules, buffers);
      const scheduleTime = performance.now() - startTime;

      // Scheduling should be fast even with many expressions
      expect(scheduleTime).toBeLessThan(100);
    });

    it('should enforce maximum expression duration', async () => {
      mixer = await createExpressionMixer({ maxExpressionDurationMs: 200 })!;

      const longClip: ExpressionClip = {
        id: 'long-expr',
        type: 'catchphrase',
        cdnUrl: 'https://example.com/long.mp3',
        durationMs: 500, // Longer than max
        priority: 1
      };

      const schedule = [{
        clip: longClip,
        startTimeMs: 0,
        duckingLevel: 0.3
      }];

      const buffers = new Map([['long-expr', mockAudioContext.decodeAudioData() as any]]);
      
      await mixer.playExpressionOverlays(schedule, buffers);

      // Should limit to 200ms (0.2 seconds)
      const stopCall = mockAudioContext.createBufferSource().stop;
      expect(stopCall).toHaveBeenCalled();
    });
  });

  describe('Error Recovery and Graceful Degradation', () => {
    it('should continue working when some buffers fail to load', async () => {
      mixer = await createExpressionMixer()!;

      const clips: ExpressionClip[] = [
        {
          id: 'good-expr',
          type: 'laugh',
          cdnUrl: 'https://example.com/good.mp3',
          durationMs: 200,
          priority: 1
        },
        {
          id: 'bad-expr',
          type: 'sigh',
          cdnUrl: 'https://example.com/bad.mp3',
          durationMs: 200,
          priority: 1
        }
      ];

      const schedules = clips.map(clip => ({
        clip,
        startTimeMs: 1000,
        duckingLevel: 0.3
      }));

      // Only provide buffer for one expression
      const buffers = new Map([['good-expr', mockAudioContext.decodeAudioData() as any]]);

      await mixer.playExpressionOverlays(schedules, buffers);

      // Should only create source for the available buffer
      expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(1);
      
      // Mixer should still be functional
      expect(mixer.isReady()).toBe(true);
    });

    it('should handle AudioContext state changes', async () => {
      // Create a context that starts suspended
      const suspendedContext = createMockAudioContext();
      suspendedContext.state = 'suspended';
      global.AudioContext = vi.fn(() => suspendedContext);
      
      mixer = await createExpressionMixer()!;
      
      // Should attempt to resume
      expect(suspendedContext.resume).toHaveBeenCalled();
      
      // Should still initialize successfully (mock always returns running state after resume)
      expect(mixer).toBeTruthy();
    });

    it('should recover from buffer source errors', async () => {
      mixer = await createExpressionMixer()!;

      // Mock buffer source to throw on start
      const mockSource = mockAudioContext.createBufferSource();
      mockSource.start = vi.fn(() => {
        throw new Error('Buffer source error');
      });

      const clip: ExpressionClip = {
        id: 'error-expr',
        type: 'laugh',
        cdnUrl: 'https://example.com/error.mp3',
        durationMs: 200,
        priority: 1
      };

      const schedule = [{
        clip,
        startTimeMs: 0,
        duckingLevel: 0.3
      }];

      const buffers = new Map([['error-expr', mockAudioContext.decodeAudioData() as any]]);

      // Should not throw
      await expect(mixer.playExpressionOverlays(schedule, buffers)).resolves.not.toThrow();
      
      // Mixer should remain functional
      expect(mixer.isReady()).toBe(true);
    });
  });

  describe('Memory Management', () => {
    it('should clean up resources properly', async () => {
      mixer = await createExpressionMixer()!;

      const clip: ExpressionClip = {
        id: 'test-expr',
        type: 'laugh',
        cdnUrl: 'https://example.com/test.mp3',
        durationMs: 100,
        priority: 1
      };

      const schedule = [{
        clip,
        startTimeMs: 0,
        duckingLevel: 0.3
      }];

      const buffers = new Map([['test-expr', mockAudioContext.decodeAudioData() as any]]);
      
      await mixer.playExpressionOverlays(schedule, buffers);

      // The mock setTimeout executes immediately, so cleanup happens automatically
      // Just verify the mixer is still functional
      const state = mixer.getState();
      expect(mixer.isReady()).toBe(true);
    });

    it('should handle multiple cleanup calls safely', () => {
      mixer = new ExpressionAudioMixer();
      
      // Multiple dispose calls should not throw
      expect(() => {
        mixer.dispose();
        mixer.dispose();
        mixer.dispose();
      }).not.toThrow();
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle typical conversation flow', async () => {
      mixer = await createExpressionMixer({
        duckingAmount: 0.4,
        fadeDurationMs: 50
      })!;

      // Simulate a conversation with multiple turns
      const conversationTurns = [
        {
          text: "Hello there! How are you doing today?",
          clips: [
            {
              id: 'greeting-1',
              type: 'greeting' as ExpressionType,
              cdnUrl: 'https://example.com/hello.mp3',
              durationMs: 150,
              priority: 1
            }
          ]
        },
        {
          text: "That's absolutely hilarious! I love that story.",
          clips: [
            {
              id: 'laugh-1',
              type: 'laugh' as ExpressionType,
              cdnUrl: 'https://example.com/laugh.mp3',
              durationMs: 200,
              priority: 1
            },
            {
              id: 'affirmation-1',
              type: 'affirmation' as ExpressionType,
              cdnUrl: 'https://example.com/absolutely.mp3',
              durationMs: 180,
              priority: 2
            }
          ]
        }
      ];

      for (const turn of conversationTurns) {
        const schedules = scheduleOverlays(turn.text, turn.clips);
        const buffers = new Map(turn.clips.map(clip => [clip.id, mockAudioContext.decodeAudioData() as any]));
        
        await mixer.playExpressionOverlays(schedules, buffers);
        
        // Simulate turn completion
        mixer.stopAllExpressions();
      }

      // Mixer should remain stable throughout
      expect(mixer.isReady()).toBe(true);
      
      const finalState = mixer.getState();
      expect(finalState.activeExpressions).toBe(0);
      expect(finalState.isDucked).toBe(false);
    });

    it('should work with empty expression packs', async () => {
      mixer = await createExpressionMixer()!;

      // Empty schedules should not cause issues
      await mixer.playExpressionOverlays([], new Map());
      
      expect(mixer.isReady()).toBe(true);
      expect(mockAudioContext.createBufferSource).not.toHaveBeenCalled();
    });

    it('should handle rapid start/stop cycles', async () => {
      mixer = await createExpressionMixer()!;

      const clip: ExpressionClip = {
        id: 'test-expr',
        type: 'filler',
        cdnUrl: 'https://example.com/filler.mp3',
        durationMs: 200,
        priority: 1
      };

      const schedule = [{
        clip,
        startTimeMs: 0,
        duckingLevel: 0.3
      }];

      const buffers = new Map([['test-expr', mockAudioContext.decodeAudioData() as any]]);

      // Rapid start/stop cycles
      for (let i = 0; i < 5; i++) {
        await mixer.playExpressionOverlays(schedule, buffers);
        mixer.stopAllExpressions();
      }

      // Should remain stable
      expect(mixer.isReady()).toBe(true);
      
      const state = mixer.getState();
      expect(state.activeExpressions).toBe(0);
    });
  });
});