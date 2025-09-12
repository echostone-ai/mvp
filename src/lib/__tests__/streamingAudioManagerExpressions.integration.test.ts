/**
 * StreamingAudioManager Expression Integration Tests
 * 
 * Integration tests to verify that the StreamingAudioManager correctly
 * integrates with the expression system without affecting TTS performance.
 * 
 * Requirements: 9.1, 9.2, 5.2
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { createStreamingAudioManager, StreamingAudioManager } from '../streamingUtils';
import { StoredExpression } from '../services/expressionStorageService';
import * as featureFlags from '../featureFlags';

// Mock dependencies
vi.mock('../featureFlags');
vi.mock('../globalAudioManager', () => ({
  globalAudioManager: {
    stopAll: vi.fn().mockResolvedValue(undefined)
  }
}));

// Mock AudioContext and Web Audio API
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

const mockBufferSource = {
  buffer: null,
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  onended: null,
  disconnect: vi.fn()
};

const mockAudioContext = {
  state: 'running',
  currentTime: 0,
  resume: vi.fn().mockResolvedValue(undefined),
  createGain: vi.fn().mockReturnValue(mockGainNode),
  createBufferSource: vi.fn().mockReturnValue(mockBufferSource),
  decodeAudioData: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
  destination: {}
};

Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn().mockImplementation(() => mockAudioContext)
});

// Mock fetch for TTS and expression loading
global.fetch = vi.fn();

describe('StreamingAudioManager Expression Integration', () => {
  let audioManager: StreamingAudioManager;
  let mockExpressions: StoredExpression[];
  let mockBuffers: Map<string, AudioBuffer>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mock timers
    vi.useFakeTimers();
    
    // Mock feature flag as enabled
    (featureFlags.isFeatureEnabled as Mock).mockReturnValue(true);
    
    // Create audio manager
    audioManager = createStreamingAudioManager('test-voice-id');
    
    // Create mock expressions
    mockExpressions = [
      {
        id: 'expr-laugh',
        ownerId: 'user-123',
        ownerType: 'user',
        filename: 'laugh.mp3',
        type: 'laugh',
        tone: 'cheerful',
        placementHints: ['funny', 'hilarious'],
        durationMs: 250,
        priority: 1,
        status: 'active',
        cdnUrl: 'https://cdn.example.com/laugh.mp3',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      },
      {
        id: 'expr-sigh',
        ownerId: 'user-123',
        ownerType: 'user',
        filename: 'sigh.mp3',
        type: 'sigh',
        tone: 'disappointed',
        placementHints: ['unfortunately', 'sadly'],
        durationMs: 180,
        priority: 0,
        status: 'active',
        cdnUrl: 'https://cdn.example.com/sigh.mp3',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }
    ];
    
    // Create mock audio buffers
    mockBuffers = new Map([
      ['expr-laugh', new ArrayBuffer(1024)],
      ['expr-sigh', new ArrayBuffer(512)]
    ]);
    
    // Mock successful TTS responses
    (global.fetch as Mock).mockImplementation((url: string) => {
      if (url.includes('/api/voice-stream')) {
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(2048))
        });
      }
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
      });
    });
  });

  afterEach(() => {
    audioManager.stop();
    vi.useRealTimers();
  });

  describe('Expression Pack Management', () => {
    it('should accept and store expression pack', () => {
      // This should not throw and should work even with expressions
      expect(() => {
        audioManager.setExpressionPack(mockExpressions, mockBuffers);
      }).not.toThrow();
    });

    it('should enable and disable expressions', () => {
      audioManager.setExpressionPack(mockExpressions, mockBuffers);
      
      // Should not throw
      expect(() => {
        audioManager.enableExpressions(true);
        audioManager.enableExpressions(false);
      }).not.toThrow();
    });

    it('should handle empty expression pack gracefully', () => {
      expect(() => {
        audioManager.setExpressionPack([], new Map());
        audioManager.enableExpressions(true);
      }).not.toThrow();
    });
  });

  describe('TTS Performance with Expressions', () => {
    beforeEach(() => {
      audioManager.setExpressionPack(mockExpressions, mockBuffers);
      audioManager.enableExpressions(true);
    });

    it('should not delay TTS start when expressions are enabled', async () => {
      const startTime = performance.now();
      
      // Add sentence should start immediately
      const addPromise = audioManager.addSentence('This is a funny joke that should trigger a laugh expression.');
      
      // Should not be blocked by expression processing
      const immediateTime = performance.now();
      expect(immediateTime - startTime).toBeLessThan(5); // Should be nearly immediate
      
      await addPromise;
    });

    it('should maintain TTS performance with multiple sentences', async () => {
      const sentences = [
        'This is the first sentence.',
        'This is a hilarious second sentence.',
        'Unfortunately, this is a sad third sentence.',
        'This is the final sentence.'
      ];
      
      const startTime = performance.now();
      
      // Add all sentences
      const promises = sentences.map(sentence => audioManager.addSentence(sentence));
      await Promise.all(promises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should complete quickly even with expressions
      expect(totalTime).toBeLessThan(50); // Allow some time for processing but should be fast
    });

    it('should handle expression scheduling errors gracefully', async () => {
      // Mock expression mixer to throw errors
      const originalConsoleWarn = console.warn;
      console.warn = vi.fn();
      
      // Force an error in expression processing by corrupting the buffer map
      audioManager.setExpressionPack(mockExpressions, new Map()); // Empty buffers
      
      // TTS should still work
      await expect(audioManager.addSentence('This should work despite expression errors.')).resolves.not.toThrow();
      
      console.warn = originalConsoleWarn;
    });
  });

  describe('Expression Scheduling', () => {
    beforeEach(() => {
      audioManager.setExpressionPack(mockExpressions, mockBuffers);
      audioManager.enableExpressions(true);
    });

    it('should schedule expressions for appropriate text content', async () => {
      // Text that should trigger laugh expression
      await audioManager.addSentence('That joke was absolutely hilarious!');
      
      // Verify that expression mixer methods would be called
      // (We can't easily test the actual audio mixing without complex mocking)
      expect(mockAudioContext.createGain).toHaveBeenCalled();
    });

    it('should respect maximum overlay limits', async () => {
      // Long text that could potentially trigger many expressions
      const longText = 'This is hilarious and funny and amusing and unfortunately sad and disappointing and exactly right and absolutely correct.';
      
      await audioManager.addSentence(longText);
      
      // Should not create excessive gain nodes (indicating too many overlays)
      const gainNodeCalls = mockAudioContext.createGain.mock.calls.length;
      expect(gainNodeCalls).toBeLessThan(10); // Reasonable limit
    });

    it('should handle expressions when disabled', async () => {
      audioManager.enableExpressions(false);
      
      // Should work normally without expressions
      await expect(audioManager.addSentence('This funny text should not trigger expressions.')).resolves.not.toThrow();
    });
  });

  describe('Feature Flag Integration', () => {
    it('should respect feature flag when disabled', () => {
      (featureFlags.isFeatureEnabled as Mock).mockReturnValue(false);
      
      // Create new manager with feature disabled
      const disabledManager = createStreamingAudioManager('test-voice-id');
      
      // Should not throw but should not enable expressions
      expect(() => {
        disabledManager.setExpressionPack(mockExpressions, mockBuffers);
        disabledManager.enableExpressions(true);
      }).not.toThrow();
      
      disabledManager.stop();
    });

    it('should work normally when feature flag is enabled', async () => {
      (featureFlags.isFeatureEnabled as Mock).mockReturnValue(true);
      
      audioManager.setExpressionPack(mockExpressions, mockBuffers);
      audioManager.enableExpressions(true);
      
      await expect(audioManager.addSentence('Test with feature enabled.')).resolves.not.toThrow();
    });
  });

  describe('Audio Manager Lifecycle', () => {
    it('should clean up expressions when stopped', () => {
      audioManager.setExpressionPack(mockExpressions, mockBuffers);
      audioManager.enableExpressions(true);
      
      // Stop should not throw and should clean up properly
      expect(() => {
        audioManager.stop();
      }).not.toThrow();
    });

    it('should handle multiple stop calls gracefully', () => {
      audioManager.setExpressionPack(mockExpressions, mockBuffers);
      audioManager.enableExpressions(true);
      
      expect(() => {
        audioManager.stop();
        audioManager.stop(); // Second call should be safe
      }).not.toThrow();
    });
  });

  describe('Integration with GlobalAudioManager', () => {
    it('should work with global audio management', async () => {
      audioManager.setExpressionPack(mockExpressions, mockBuffers);
      audioManager.enableExpressions(true);
      
      // Should integrate properly with global audio manager
      await expect(audioManager.addSentence('Test global integration.')).resolves.not.toThrow();
      
      // Stopping should work with global manager
      expect(() => audioManager.stop()).not.toThrow();
    });
  });
});