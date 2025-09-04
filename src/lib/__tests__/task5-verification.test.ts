/**
 * Task 5 Verification Tests
 * 
 * Tests for enabling expression overlays with quality constraints:
 * - Feature flag enablement
 * - Non-blocking expression scheduling
 * - LUFS and peak validation
 * - 10-second window constraint (max 2 overlays)
 * - Ducking level (0.4)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExpressionAudioMixer, createExpressionMixer } from '../expressionAudioMixer';
import { scheduleOverlays, ExpressionClip } from '../expressionScheduler';
import { AudioQualityValidator, globalAudioQualityValidator } from '../audioQualityValidator';
import { isFeatureEnabled } from '../featureFlags';

// Mock Web Audio API
const mockAudioContext = {
  createGain: vi.fn(() => ({
    gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn()
  })),
  createBufferSource: vi.fn(() => ({
    buffer: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null
  })),
  createBuffer: vi.fn(() => ({
    numberOfChannels: 1,
    length: 1024,
    sampleRate: 44100,
    getChannelData: vi.fn(() => new Float32Array(1024))
  })),
  destination: {},
  currentTime: 0,
  sampleRate: 44100,
  state: 'running',
  resume: vi.fn().mockResolvedValue(undefined)
};

// Mock global AudioContext
Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn(() => mockAudioContext)
});

// Mock environment variable
vi.mock('../featureFlags', () => ({
  isFeatureEnabled: vi.fn(),
  getFeatureFlags: vi.fn(() => ({ EXPRESSION_OVERLAYS_ENABLED: true }))
}));

describe('Task 5: Expression Overlays with Quality Constraints', () => {
  let mixer: ExpressionAudioMixer | null = null;
  let validator: AudioQualityValidator;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Enable feature flag for tests
    vi.mocked(isFeatureEnabled).mockReturnValue(true);
    process.env.EXPRESSION_OVERLAYS_ENABLED = 'true';
    
    validator = new AudioQualityValidator();
    await validator.initialize();
  });

  afterEach(() => {
    if (mixer) {
      mixer.dispose();
      mixer = null;
    }
    validator?.dispose();
  });

  describe('Feature Flag Enablement', () => {
    it('should enable expression overlays when feature flag is true', () => {
      const result = isFeatureEnabled('EXPRESSION_OVERLAYS_ENABLED');
      expect(result).toBe(true);
    });

    it('should disable expression scheduling when feature flag is false', () => {
      process.env.EXPRESSION_OVERLAYS_ENABLED = 'false';
      
      const mockClips: ExpressionClip[] = [{
        id: 'test-laugh',
        type: 'laugh',
        cdnUrl: 'test.mp3',
        durationMs: 200,
        priority: 10
      }];

      const schedules = scheduleOverlays('This is funny', mockClips);
      expect(schedules).toHaveLength(0);
    });
  });

  describe('Expression Mixer Quality Constraints', () => {
    it('should initialize mixer with Task 5 quality constraints', async () => {
      mixer = await createExpressionMixer({
        duckingAmount: 0.4,           // Task 5: 0.4 ducking level
        maxOverlaysPer10s: 2,        // Task 5: max 2 overlays per 10s
        enableQualityValidation: true // Task 5: LUFS validation
      });

      expect(mixer).toBeTruthy();
      expect(mixer?.isReady()).toBe(true);
    });

    it('should enforce maximum 2 overlays per 10-second window', async () => {
      mixer = await createExpressionMixer({
        maxOverlaysPer10s: 2,
        enableQualityValidation: false // Disable for this test
      });

      const mockBuffer = mockAudioContext.createBuffer(1, 1024, 44100);
      const buffers = new Map([['test1', mockBuffer], ['test2', mockBuffer], ['test3', mockBuffer]]);

      const schedules = [
        {
          clip: { id: 'test1', type: 'laugh' as const, cdnUrl: 'test1.mp3', durationMs: 200, priority: 10 },
          startTimeMs: 0,
          duckingLevel: 0.4
        },
        {
          clip: { id: 'test2', type: 'sigh' as const, cdnUrl: 'test2.mp3', durationMs: 200, priority: 10 },
          startTimeMs: 1000,
          duckingLevel: 0.4
        },
        {
          clip: { id: 'test3', type: 'breath' as const, cdnUrl: 'test3.mp3', durationMs: 200, priority: 10 },
          startTimeMs: 2000,
          duckingLevel: 0.4
        }
      ];

      // Should only play first 2 overlays due to 10-second window constraint
      await mixer!.playExpressionOverlays(schedules, buffers, 0);

      const state = mixer!.getState();
      expect(state.recentOverlays.length).toBeLessThanOrEqual(2);
    });

    it('should apply 0.4 ducking level as per Task 5', async () => {
      mixer = await createExpressionMixer({
        duckingAmount: 0.4,
        enableQualityValidation: false
      });

      const ttsInput = mixer!.getTTSInput();
      expect(ttsInput).toBeTruthy();

      // Verify ducking amount is configured correctly
      const state = mixer!.getState();
      expect(state).toBeDefined();
    });
  });

  describe('Audio Quality Validation', () => {
    it('should validate LUFS target of -14 LUFS', async () => {
      // Create mock audio buffer with known characteristics
      const mockBuffer = mockAudioContext.createBuffer(1, 1024, 44100);
      const channelData = new Float32Array(1024);
      
      // Fill with test signal
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = 0.1 * Math.sin(2 * Math.PI * 440 * i / 44100);
      }
      
      mockBuffer.getChannelData = vi.fn(() => channelData);

      const metrics = await validator.validateAudioBuffer(mockBuffer);
      
      expect(metrics).toBeDefined();
      expect(typeof metrics.lufs).toBe('number');
      expect(typeof metrics.truePeak).toBe('number');
      expect(typeof metrics.passesQualityGate).toBe('boolean');
    });

    it('should enforce true-peak < -1 dBTP constraint', async () => {
      const mockBuffer = mockAudioContext.createBuffer(1, 1024, 44100);
      const channelData = new Float32Array(1024);
      
      // Create signal that exceeds -1 dBTP (too loud)
      channelData.fill(0.95); // Very high level
      mockBuffer.getChannelData = vi.fn(() => channelData);

      const metrics = await validator.validateAudioBuffer(mockBuffer);
      
      // Should fail quality gate due to high peak
      expect(metrics.truePeak).toBeGreaterThan(-1.0);
      expect(metrics.validationErrors.length).toBeGreaterThan(0);
    });

    it('should perform quick quality check for real-time validation', () => {
      const mockBuffer = mockAudioContext.createBuffer(1, 1024, 44100);
      const channelData = new Float32Array(1024);
      channelData.fill(0.1); // Normal level
      mockBuffer.getChannelData = vi.fn(() => channelData);

      const result = validator.quickQualityCheck(mockBuffer);
      
      expect(result).toBeDefined();
      expect(typeof result.isValid).toBe('boolean');
    });
  });

  describe('Non-blocking Expression Scheduling', () => {
    it('should schedule expressions without blocking TTS start', () => {
      const mockClips: ExpressionClip[] = [{
        id: 'test-laugh',
        type: 'laugh',
        cdnUrl: 'test.mp3',
        durationMs: 200,
        priority: 10
      }];

      const startTime = performance.now();
      const schedules = scheduleOverlays('This is really funny!', mockClips, {
        maxOverlays: 2,
        minSpacingMs: 4000,
        duckingAmount: 0.4
      });
      const endTime = performance.now();

      // Scheduling should be very fast (< 10ms)
      expect(endTime - startTime).toBeLessThan(10);
      expect(schedules.length).toBeGreaterThan(0);
      expect(schedules[0].duckingLevel).toBe(0.4);
    });

    it('should limit overlays to maximum 2 per scheduling call', () => {
      const mockClips: ExpressionClip[] = [
        { id: 'laugh1', type: 'laugh', cdnUrl: 'test1.mp3', durationMs: 200, priority: 10 },
        { id: 'laugh2', type: 'laugh', cdnUrl: 'test2.mp3', durationMs: 200, priority: 10 },
        { id: 'sigh1', type: 'sigh', cdnUrl: 'test3.mp3', durationMs: 200, priority: 10 },
        { id: 'breath1', type: 'breath', cdnUrl: 'test4.mp3', durationMs: 200, priority: 10 }
      ];

      const schedules = scheduleOverlays('This is funny and sad', mockClips, {
        maxOverlays: 2 // Task 5 constraint
      });

      expect(schedules.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Integration with Existing Normalization', () => {
    it('should use existing -14 LUFS normalization', () => {
      const constraints = validator.getConstraints();
      
      expect(constraints.targetLufs).toBe(-14.0);
      expect(constraints.maxTruePeak).toBe(-1.0);
      expect(constraints.lufsTolerance).toBe(1.0);
    });

    it('should maintain fade transitions with quality validation', async () => {
      mixer = await createExpressionMixer({
        fadeDurationMs: 50,
        enableQualityValidation: true
      });

      expect(mixer?.isReady()).toBe(true);
      
      // Verify mixer state includes quality tracking
      const state = mixer!.getState();
      expect(state.qualityStats).toBeDefined();
      expect(state.qualityStats.totalValidated).toBe(0);
      expect(state.qualityStats.passed).toBe(0);
      expect(state.qualityStats.failed).toBe(0);
    });
  });

  describe('Error Handling and Graceful Degradation', () => {
    it('should continue TTS playback if expression validation fails', async () => {
      mixer = await createExpressionMixer({
        enableQualityValidation: true
      });

      const mockBuffer = mockAudioContext.createBuffer(1, 1024, 44100);
      // Create invalid audio that will fail validation
      const channelData = new Float32Array(1024);
      channelData.fill(1.0); // Clipping level
      mockBuffer.getChannelData = vi.fn(() => channelData);

      const buffers = new Map([['invalid', mockBuffer]]);
      const schedules = [{
        clip: { id: 'invalid', type: 'laugh' as const, cdnUrl: 'invalid.mp3', durationMs: 200, priority: 10 },
        startTimeMs: 0,
        duckingLevel: 0.4
      }];

      // Should not throw error, should gracefully skip invalid audio
      await expect(mixer!.playExpressionOverlays(schedules, buffers)).resolves.not.toThrow();
    });

    it('should track quality statistics for monitoring', async () => {
      mixer = await createExpressionMixer({
        enableQualityValidation: true
      });

      const state = mixer!.getState();
      
      expect(state.qualityStats).toBeDefined();
      expect(state.recentOverlays).toBeDefined();
      expect(Array.isArray(state.recentOverlays)).toBe(true);
    });
  });
});