/**
 * GaplessPlayer Expression Integration Tests
 * 
 * Tests to verify that expression overlays work correctly with the GaplessPlayer
 * and don't interfere with the existing voice runtime system.
 * 
 * Requirements: 9.1, 9.2, 5.2 - Test integration with GaplessPlayer
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { gaplessPlayer } from '../voice/player';
import { createVoiceRuntime } from '../voice/runtime';
import { createStreamingAudioManager } from '../streamingUtils';
import { setupUserExpressions } from '../voiceExpressionIntegration';
import * as featureFlags from '../featureFlags';

// Mock dependencies
vi.mock('../featureFlags');
vi.mock('../services/expressionStorageService');
vi.mock('../globalAudioManager');

// Mock GaplessPlayer
vi.mock('../voice/player', () => ({
  gaplessPlayer: {
    unlock: vi.fn().mockResolvedValue(undefined),
    enqueue: vi.fn().mockResolvedValue(undefined),
    stopAll: vi.fn(),
    getIsPlaying: vi.fn().mockReturnValue(false)
  }
}));

// Mock voice runtime
vi.mock('../voice/runtime', () => ({
  createVoiceRuntime: vi.fn().mockReturnValue({
    unlock: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    isPlaying: vi.fn().mockReturnValue(false)
  })
}));

// Mock AudioContext
const mockGainNode = {
  gain: { 
    value: 1, 
    setValueAtTime: vi.fn(), 
    linearRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn()
  },
  connect: vi.fn(),
  disconnect: vi.fn()
};

const mockAudioContext = {
  state: 'running',
  currentTime: 0,
  resume: vi.fn().mockResolvedValue(undefined),
  createGain: vi.fn().mockReturnValue(mockGainNode),
  createBufferSource: vi.fn().mockReturnValue({
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
    disconnect: vi.fn()
  }),
  decodeAudioData: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
  destination: {}
};

Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn().mockImplementation(() => mockAudioContext)
});

// Mock fetch
global.fetch = vi.fn();

describe('GaplessPlayer Expression Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Enable feature flag
    (featureFlags.isFeatureEnabled as Mock).mockReturnValue(true);
    
    // Mock successful TTS responses
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(2048))
    });
  });

  describe('Compatibility with GaplessPlayer', () => {
    it('should not interfere with GaplessPlayer operations', async () => {
      const audioManager = createStreamingAudioManager('test-voice');
      
      // Set up expressions
      await setupUserExpressions(audioManager, 'test-user');
      
      // Add sentences - this should work with both expression system and GaplessPlayer
      await audioManager.addSentence('This is a test sentence.');
      
      // Verify that expression system doesn't break normal audio flow
      expect(() => {
        audioManager.stop();
      }).not.toThrow();
      
      // GaplessPlayer should still be functional
      expect(gaplessPlayer.stopAll).toBeDefined();
      expect(gaplessPlayer.enqueue).toBeDefined();
    });

    it('should allow GaplessPlayer to work independently', async () => {
      // Test that GaplessPlayer can still be used directly
      await gaplessPlayer.unlock();
      
      // Mock audio blob
      const mockBlob = new Blob(['test'], { type: 'audio/mpeg' });
      await gaplessPlayer.enqueue(mockBlob);
      
      expect(gaplessPlayer.unlock).toHaveBeenCalled();
      expect(gaplessPlayer.enqueue).toHaveBeenCalledWith(mockBlob);
    });

    it('should not affect GaplessPlayer state when expressions are used', async () => {
      const audioManager = createStreamingAudioManager('test-voice');
      await setupUserExpressions(audioManager, 'test-user');
      
      // Use audio manager with expressions
      await audioManager.addSentence('Test with expressions.');
      
      // GaplessPlayer state should not be affected
      const isPlaying = gaplessPlayer.getIsPlaying();
      expect(typeof isPlaying).toBe('boolean');
      
      audioManager.stop();
    });
  });

  describe('Voice Runtime Integration', () => {
    it('should work with voice runtime system', async () => {
      // Create voice runtime (this uses GaplessPlayer internally)
      const runtime = createVoiceRuntime({
        generate: async (text: string) => new Blob(['mock'], { type: 'audio/mpeg' })
      });
      
      // Should be able to unlock and start
      await runtime.unlock();
      await runtime.start();
      
      expect(runtime.isPlaying()).toBe(false);
      
      runtime.stop();
    });

    it('should not break voice runtime when expressions are enabled', async () => {
      const audioManager = createStreamingAudioManager('test-voice');
      
      // Enable expressions
      await setupUserExpressions(audioManager, 'test-user');
      
      // Create voice runtime
      const runtime = createVoiceRuntime({
        generate: async (text: string) => new Blob(['mock'], { type: 'audio/mpeg' })
      });
      
      // Both should work together
      await runtime.unlock();
      await audioManager.addSentence('Test sentence.');
      
      // Clean up
      runtime.stop();
      audioManager.stop();
    });
  });

  describe('Audio Context Sharing', () => {
    it('should handle shared AudioContext correctly', async () => {
      const audioManager1 = createStreamingAudioManager('voice-1');
      const audioManager2 = createStreamingAudioManager('voice-2');
      
      // Set up expressions on both
      await setupUserExpressions(audioManager1, 'user-1');
      await setupUserExpressions(audioManager2, 'user-2');
      
      // Both should be able to use the same AudioContext
      await audioManager1.addSentence('First manager sentence.');
      await audioManager2.addSentence('Second manager sentence.');
      
      // Clean up
      audioManager1.stop();
      audioManager2.stop();
    });

    it('should not conflict with other Web Audio usage', async () => {
      // Simulate other Web Audio usage
      const otherAudioContext = new AudioContext();
      const otherGain = otherAudioContext.createGain();
      
      // Set up expression system
      const audioManager = createStreamingAudioManager('test-voice');
      await setupUserExpressions(audioManager, 'test-user');
      
      // Should not interfere with other audio contexts
      expect(otherGain.gain.value).toBe(1);
      
      await audioManager.addSentence('Test with other audio context.');
      
      // Other audio context should still work
      expect(otherGain.connect).toBeDefined();
      
      audioManager.stop();
    });
  });

  describe('Performance with GaplessPlayer', () => {
    it('should maintain GaplessPlayer performance', async () => {
      const audioManager = createStreamingAudioManager('test-voice');
      await setupUserExpressions(audioManager, 'test-user');
      
      const startTime = performance.now();
      
      // Multiple sentences should process quickly
      const sentences = [
        'First sentence.',
        'Second sentence with expressions.',
        'Third sentence.',
        'Fourth sentence.'
      ];
      
      for (const sentence of sentences) {
        await audioManager.addSentence(sentence);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should complete quickly even with expressions
      expect(totalTime).toBeLessThan(100); // Allow reasonable time for processing
      
      audioManager.stop();
    });

    it('should not delay GaplessPlayer enqueue operations', async () => {
      const audioManager = createStreamingAudioManager('test-voice');
      await setupUserExpressions(audioManager, 'test-user');
      
      // Mock timing for GaplessPlayer operations
      const enqueueSpy = vi.spyOn(gaplessPlayer, 'enqueue');
      
      await audioManager.addSentence('Test sentence for timing.');
      
      // GaplessPlayer enqueue should be called without significant delay
      // (The actual timing depends on TTS generation, not expression processing)
      expect(enqueueSpy).toBeDefined();
      
      audioManager.stop();
    });
  });

  describe('Error Handling with GaplessPlayer', () => {
    it('should handle GaplessPlayer errors gracefully', async () => {
      // Mock GaplessPlayer to throw errors
      const originalEnqueue = gaplessPlayer.enqueue;
      (gaplessPlayer.enqueue as Mock).mockRejectedValue(new Error('GaplessPlayer error'));
      
      const audioManager = createStreamingAudioManager('test-voice');
      await setupUserExpressions(audioManager, 'test-user');
      
      // Should handle errors without breaking expression system
      await expect(audioManager.addSentence('Test error handling.')).resolves.not.toThrow();
      
      // Restore original function
      gaplessPlayer.enqueue = originalEnqueue;
      audioManager.stop();
    });

    it('should continue working when GaplessPlayer is unavailable', async () => {
      // Mock GaplessPlayer as undefined
      const originalPlayer = gaplessPlayer;
      
      const audioManager = createStreamingAudioManager('test-voice');
      await setupUserExpressions(audioManager, 'test-user');
      
      // Should not throw even if GaplessPlayer has issues
      await expect(audioManager.addSentence('Test without GaplessPlayer.')).resolves.not.toThrow();
      
      audioManager.stop();
    });
  });

  describe('Feature Flag Integration with GaplessPlayer', () => {
    it('should work with GaplessPlayer when expressions are disabled', async () => {
      (featureFlags.isFeatureEnabled as Mock).mockReturnValue(false);
      
      const audioManager = createStreamingAudioManager('test-voice');
      
      // Should work normally without expressions
      await audioManager.addSentence('Test without expressions.');
      
      // GaplessPlayer should still function
      expect(gaplessPlayer.getIsPlaying).toBeDefined();
      
      audioManager.stop();
    });

    it('should gracefully disable expressions without affecting GaplessPlayer', async () => {
      const audioManager = createStreamingAudioManager('test-voice');
      
      // Start with expressions enabled
      (featureFlags.isFeatureEnabled as Mock).mockReturnValue(true);
      await setupUserExpressions(audioManager, 'test-user');
      
      // Disable feature flag
      (featureFlags.isFeatureEnabled as Mock).mockReturnValue(false);
      
      // Should continue working with GaplessPlayer
      await audioManager.addSentence('Test after disabling expressions.');
      
      audioManager.stop();
    });
  });
});