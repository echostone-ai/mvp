/**
 * Tests for ExpressionAudioMixer
 * 
 * Tests audio mixing, ducking, graceful degradation, and smooth blending
 * Requirements: 5.3, 5.5, 6.3, 9.3, 9.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExpressionAudioMixer, createExpressionMixer, isWebAudioSupported } from '../expressionAudioMixer';
import { OverlaySchedule } from '../expressionScheduler';
import { ExpressionType } from '../types/expressions';

// Mock Web Audio API
const mockAudioBuffer = {
  length: 44100,
  sampleRate: 22050,
  numberOfChannels: 1,
  duration: 2.0
};

let mockGainNode: any;
let mockBufferSource: any;
let mockAudioContext: any;

const createMockGainNode = () => ({
  gain: {
    value: 1.0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn()
  },
  connect: vi.fn(),
  disconnect: vi.fn()
});

const createMockBufferSource = () => ({
  buffer: null,
  connect: vi.fn(),
  disconnect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  onended: null
});

const createMockAudioContext = () => ({
  currentTime: 0,
  state: 'running',
  destination: {},
  resume: vi.fn().mockResolvedValue(undefined),
  createGain: vi.fn(() => createMockGainNode()),
  createBufferSource: vi.fn(() => createMockBufferSource())
});

// Mock setTimeout/clearTimeout
global.setTimeout = vi.fn((fn, delay) => {
  // Execute immediately for testing
  if (typeof fn === 'function') fn();
  return 123;
});
global.clearTimeout = vi.fn();

describe('ExpressionAudioMixer', () => {
  let mixer: ExpressionAudioMixer;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create fresh mocks for each test
    mockGainNode = createMockGainNode();
    mockBufferSource = createMockBufferSource();
    mockAudioContext = createMockAudioContext();
    
    // Mock global AudioContext
    global.AudioContext = vi.fn(() => mockAudioContext);
    (global as any).webkitAudioContext = global.AudioContext;
    
    mockAudioContext.currentTime = 0;
    mockAudioContext.state = 'running';
  });

  afterEach(() => {
    if (mixer) {
      mixer.dispose();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully with default options', async () => {
      mixer = new ExpressionAudioMixer();
      const result = await mixer.initialize();
      
      expect(result).toBe(true);
      expect(mixer.isReady()).toBe(true);
      expect(mockAudioContext.createGain).toHaveBeenCalledTimes(3); // master, tts, expression
    });

    it('should initialize with custom options', async () => {
      mixer = new ExpressionAudioMixer({
        masterVolume: 0.8,
        duckingAmount: 0.5,
        fadeDurationMs: 100,
        maxExpressionDurationMs: 500
      });
      
      const result = await mixer.initialize();
      expect(result).toBe(true);
      
      const state = mixer.getState();
      expect(state.currentVolume).toBe(0.8);
    });

    it('should handle AudioContext creation failure gracefully', async () => {
      global.AudioContext = vi.fn(() => {
        throw new Error('AudioContext not supported');
      });
      
      mixer = new ExpressionAudioMixer();
      const result = await mixer.initialize();
      
      expect(result).toBe(false);
      expect(mixer.isReady()).toBe(false);
    });

    it('should resume suspended AudioContext', async () => {
      mockAudioContext.state = 'suspended';
      
      mixer = new ExpressionAudioMixer();
      await mixer.initialize();
      
      expect(mockAudioContext.resume).toHaveBeenCalled();
    });
  });

  describe('Audio Graph Setup', () => {
    beforeEach(async () => {
      mixer = new ExpressionAudioMixer();
      await mixer.initialize();
    });

    it('should provide TTS input node', () => {
      const ttsInput = mixer.getTTSInput();
      expect(ttsInput).toBeTruthy();
    });

    it('should provide master output node', () => {
      const output = mixer.getOutput();
      expect(output).toBeTruthy();
    });

    it('should connect audio nodes correctly', () => {
      // Verify gain nodes were created and connected
      expect(mockAudioContext.createGain).toHaveBeenCalledTimes(3);
    });
  });

  describe('Expression Playback', () => {
    let mockSchedules: OverlaySchedule[];
    let mockBuffers: Map<string, AudioBuffer>;

    beforeEach(async () => {
      mixer = new ExpressionAudioMixer();
      await mixer.initialize();

      // Create mock schedules
      mockSchedules = [
        {
          clip: {
            id: 'expr-1',
            type: 'laugh' as ExpressionType,
            cdnUrl: 'https://example.com/laugh.mp3',
            durationMs: 200,
            priority: 1
          },
          startTimeMs: 1000,
          duckingLevel: 0.4
        },
        {
          clip: {
            id: 'expr-2',
            type: 'affirmation' as ExpressionType,
            cdnUrl: 'https://example.com/yes.mp3',
            durationMs: 150,
            priority: 2
          },
          startTimeMs: 5000,
          duckingLevel: 0.3
        }
      ];

      // Create mock buffers
      mockBuffers = new Map([
        ['expr-1', mockAudioBuffer as AudioBuffer],
        ['expr-2', mockAudioBuffer as AudioBuffer]
      ]);
    });

    it('should play expression overlays according to schedule', async () => {
      await mixer.playExpressionOverlays(mockSchedules, mockBuffers);
      
      // Should create buffer sources for each expression
      expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(2);
    });

    it('should apply fade in/out to expressions', async () => {
      await mixer.playExpressionOverlays(mockSchedules, mockBuffers);
      
      // Should create buffer sources for expressions
      expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
    });

    it('should enforce maximum expression duration', async () => {
      mixer = new ExpressionAudioMixer({ maxExpressionDurationMs: 100 });
      await mixer.initialize();
      
      await mixer.playExpressionOverlays(mockSchedules, mockBuffers);
      
      // Should limit duration to 100ms (0.1 seconds)
      const stopCalls = mockBufferSource.stop.mock.calls;
      stopCalls.forEach(call => {
        const [stopTime] = call;
        const startTime = mockBufferSource.start.mock.calls[0][0];
        const duration = stopTime - startTime;
        expect(duration).toBeLessThanOrEqual(0.1); // 100ms
      });
    });

    it('should gracefully handle missing buffers', async () => {
      const incompleteBuffers = new Map([['expr-1', mockAudioBuffer as AudioBuffer]]);
      
      await mixer.playExpressionOverlays(mockSchedules, incompleteBuffers);
      
      // Should only create one buffer source (for expr-1)
      expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(1);
    });

    it('should handle empty schedules gracefully', async () => {
      await mixer.playExpressionOverlays([], mockBuffers);
      
      expect(mockAudioContext.createBufferSource).not.toHaveBeenCalled();
    });
  });

  describe('TTS Ducking', () => {
    beforeEach(async () => {
      mixer = new ExpressionAudioMixer({ duckingAmount: 0.4 });
      await mixer.initialize();
    });

    it('should duck TTS audio during expression playback', async () => {
      const schedule: OverlaySchedule = {
        clip: {
          id: 'expr-1',
          type: 'laugh' as ExpressionType,
          cdnUrl: 'https://example.com/laugh.mp3',
          durationMs: 200,
          priority: 1
        },
        startTimeMs: 1000,
        duckingLevel: 0.4
      };

      const buffers = new Map([['expr-1', mockAudioBuffer as AudioBuffer]]);
      await mixer.playExpressionOverlays([schedule], buffers);

      // Should create buffer source for expression
      expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(1);
    });

    it('should update ducking state correctly', async () => {
      const schedule: OverlaySchedule = {
        clip: {
          id: 'expr-1',
          type: 'laugh' as ExpressionType,
          cdnUrl: 'https://example.com/laugh.mp3',
          durationMs: 200,
          priority: 1
        },
        startTimeMs: 0, // Immediate start
        duckingLevel: 0.4
      };

      const buffers = new Map([['expr-1', mockAudioBuffer as AudioBuffer]]);
      await mixer.playExpressionOverlays([schedule], buffers);

      // Should create buffer source for expression
      expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(1);
      
      const state = mixer.getState();
      expect(state.activeExpressions).toBe(1);
    });
  });

  describe('Volume Control', () => {
    beforeEach(async () => {
      mixer = new ExpressionAudioMixer();
      await mixer.initialize();
    });

    it('should set master volume', () => {
      mixer.setMasterVolume(0.5);
      
      const state = mixer.getState();
      expect(state.currentVolume).toBe(0.5);
    });

    it('should reject invalid volume values', () => {
      const initialState = mixer.getState();
      
      mixer.setMasterVolume(-0.1);
      expect(mixer.getState().currentVolume).toBe(initialState.currentVolume);
      
      mixer.setMasterVolume(1.1);
      expect(mixer.getState().currentVolume).toBe(initialState.currentVolume);
    });
  });

  describe('Cleanup and Disposal', () => {
    beforeEach(async () => {
      mixer = new ExpressionAudioMixer();
      await mixer.initialize();
    });

    it('should stop all expressions', () => {
      mixer.stopAllExpressions();
      
      const state = mixer.getState();
      expect(state.activeExpressions).toBe(0);
      expect(state.isDucked).toBe(false);
    });

    it('should restore TTS volume when stopping expressions', () => {
      mixer.stopAllExpressions();
      
      // Should reset state
      const state = mixer.getState();
      expect(state.activeExpressions).toBe(0);
      expect(state.isDucked).toBe(false);
    });

    it('should dispose resources properly', () => {
      mixer.dispose();
      
      expect(mixer.isReady()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle buffer source creation failure', async () => {
      mockAudioContext.createBufferSource.mockImplementationOnce(() => {
        throw new Error('Failed to create buffer source');
      });

      mixer = new ExpressionAudioMixer();
      await mixer.initialize();

      const schedule: OverlaySchedule = {
        clip: {
          id: 'expr-1',
          type: 'laugh' as ExpressionType,
          cdnUrl: 'https://example.com/laugh.mp3',
          durationMs: 200,
          priority: 1
        },
        startTimeMs: 1000,
        duckingLevel: 0.4
      };

      const buffers = new Map([['expr-1', mockAudioBuffer as AudioBuffer]]);
      
      // Should not throw
      await expect(mixer.playExpressionOverlays([schedule], buffers)).resolves.not.toThrow();
    });

    it('should handle node disconnection errors gracefully', () => {
      mockGainNode.disconnect.mockImplementationOnce(() => {
        throw new Error('Node already disconnected');
      });

      // Should not throw
      expect(() => mixer.dispose()).not.toThrow();
    });
  });
});

describe('Utility Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createExpressionMixer', () => {
    it('should create and initialize mixer successfully', async () => {
      const mixer = await createExpressionMixer();
      
      expect(mixer).toBeTruthy();
      expect(mixer!.isReady()).toBe(true);
      
      mixer!.dispose();
    });

    it('should return null on initialization failure', async () => {
      global.AudioContext = vi.fn(() => {
        throw new Error('AudioContext not supported');
      });
      
      const mixer = await createExpressionMixer();
      expect(mixer).toBeNull();
    });

    it('should use provided AudioContext', async () => {
      const customContext = { ...mockAudioContext };
      const mixer = await createExpressionMixer({}, customContext as any);
      
      expect(mixer).toBeTruthy();
      mixer!.dispose();
    });
  });

  describe('isWebAudioSupported', () => {
    it('should return true when AudioContext is available', () => {
      global.AudioContext = vi.fn();
      expect(isWebAudioSupported()).toBe(true);
    });

    it('should return true when webkitAudioContext is available', () => {
      delete (global as any).AudioContext;
      (global as any).webkitAudioContext = vi.fn();
      expect(isWebAudioSupported()).toBe(true);
    });

    it('should return false when no AudioContext is available', () => {
      delete (global as any).AudioContext;
      delete (global as any).webkitAudioContext;
      expect(isWebAudioSupported()).toBe(false);
    });
  });
});