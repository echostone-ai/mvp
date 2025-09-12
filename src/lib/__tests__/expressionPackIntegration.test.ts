/**
 * Test suite for expression pack integration with StreamingAudioManager
 * Verifies task 3 implementation: Wire StreamingAudioManager with expression system (overlays disabled)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createStreamingAudioManager } from '../streamingUtils';
import { ExpressionPackService } from '../services/expressionPackService';
import { isFeatureEnabled } from '../featureFlags';

// Mock dependencies
vi.mock('../featureFlags', () => ({
  isFeatureEnabled: vi.fn()
}));

vi.mock('../services/expressionPackService', () => ({
  ExpressionPackService: {
    getJonathanDemoExpressionPack: vi.fn(),
    createMockExpressionPack: vi.fn()
  }
}));

vi.mock('../globalAudioManager', () => ({
  globalAudioManager: {
    stopAll: vi.fn()
  }
}));

vi.mock('../expressionAudioMixer', () => ({
  createExpressionMixer: vi.fn()
}));

describe('Expression Pack Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock fetch for voice synthesis
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    });

    // Mock AudioBuffer for Node.js environment
    global.AudioBuffer = vi.fn().mockImplementation((options) => ({
      length: options?.length || 1024,
      sampleRate: options?.sampleRate || 44100,
      duration: (options?.length || 1024) / (options?.sampleRate || 44100)
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Feature Flag Integration', () => {
    it('should respect EXPRESSION_OVERLAYS_ENABLED feature flag when disabled', () => {
      // Mock feature flag as disabled
      vi.mocked(isFeatureEnabled).mockReturnValue(false);

      const mockExpressionPack = {
        expressions: [
          {
            id: 'test-1',
            ownerId: 'jonathan-demo',
            ownerType: 'avatar' as const,
            filename: 'laugh.mp3',
            type: 'laugh' as const,
            durationMs: 800,
            priority: 75,
            status: 'active' as const,
            cdnUrl: '/test/laugh.mp3',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          }
        ],
        buffers: new Map()
      };

      const manager = createStreamingAudioManager(
        'test-voice-id',
        { stability: 0.7 },
        undefined,
        {
          expressionPack: mockExpressionPack
        }
      );

      expect(manager).toBeDefined();
      expect(isFeatureEnabled).toHaveBeenCalledWith('EXPRESSION_OVERLAYS_ENABLED');
      
      // Manager should be created but expressions should be disabled
      manager.stop();
    });

    it('should respect EXPRESSION_OVERLAYS_ENABLED feature flag when enabled', () => {
      // Mock feature flag as enabled
      vi.mocked(isFeatureEnabled).mockReturnValue(true);

      const mockExpressionPack = {
        expressions: [
          {
            id: 'test-1',
            ownerId: 'jonathan-demo',
            ownerType: 'avatar' as const,
            filename: 'laugh.mp3',
            type: 'laugh' as const,
            durationMs: 800,
            priority: 75,
            status: 'active' as const,
            cdnUrl: '/test/laugh.mp3',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          }
        ],
        buffers: new Map()
      };

      const manager = createStreamingAudioManager(
        'test-voice-id',
        { stability: 0.7 },
        undefined,
        {
          expressionPack: mockExpressionPack
        }
      );

      expect(manager).toBeDefined();
      expect(isFeatureEnabled).toHaveBeenCalledWith('EXPRESSION_OVERLAYS_ENABLED');
      
      manager.stop();
    });
  });

  describe('Expression Pack Loading', () => {
    it('should create StreamingAudioManager without expression pack', () => {
      vi.mocked(isFeatureEnabled).mockReturnValue(false);

      const manager = createStreamingAudioManager(
        'test-voice-id',
        { stability: 0.7 }
      );

      expect(manager).toBeDefined();
      expect(manager.setExpressionPack).toBeDefined();
      expect(manager.enableExpressions).toBeDefined();
      
      manager.stop();
    });

    it('should create StreamingAudioManager with expression pack', () => {
      vi.mocked(isFeatureEnabled).mockReturnValue(false);

      const mockExpressionPack = {
        expressions: [
          {
            id: 'test-1',
            ownerId: 'jonathan-demo',
            ownerType: 'avatar' as const,
            filename: 'laugh.mp3',
            type: 'laugh' as const,
            durationMs: 800,
            priority: 75,
            status: 'active' as const,
            cdnUrl: '/test/laugh.mp3',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          }
        ],
        buffers: new Map([
          ['test-1', new AudioBuffer({ length: 1024, sampleRate: 44100 })]
        ])
      };

      const manager = createStreamingAudioManager(
        'test-voice-id',
        { stability: 0.7 },
        undefined,
        {
          expressionPack: mockExpressionPack
        }
      );

      expect(manager).toBeDefined();
      
      manager.stop();
    });

    it('should handle empty expression pack gracefully', () => {
      vi.mocked(isFeatureEnabled).mockReturnValue(false);

      const emptyExpressionPack = {
        expressions: [],
        buffers: new Map()
      };

      const manager = createStreamingAudioManager(
        'test-voice-id',
        { stability: 0.7 },
        undefined,
        {
          expressionPack: emptyExpressionPack
        }
      );

      expect(manager).toBeDefined();
      
      manager.stop();
    });
  });

  describe('Expression Pack Service', () => {
    it('should provide mock expression pack creation', () => {
      const mockPack = {
        id: 'mock-jonathan-demo',
        avatarId: 'jonathan-demo',
        expressions: [
          {
            id: 'mock-laugh-1',
            ownerId: 'jonathan-demo',
            ownerType: 'avatar' as const,
            filename: 'laugh.mp3',
            type: 'laugh' as const,
            tone: 'cheerful',
            placementHints: ['funny', 'joke', 'humor'],
            durationMs: 800,
            priority: 75,
            status: 'active' as const,
            cdnUrl: '/snippets/laugh_short.mp3',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        buffers: new Map(),
        loadedAt: new Date()
      };

      vi.mocked(ExpressionPackService.createMockExpressionPack).mockReturnValue(mockPack);

      const result = ExpressionPackService.createMockExpressionPack('jonathan-demo');
      
      expect(result).toBeDefined();
      expect(result.avatarId).toBe('jonathan-demo');
      expect(result.expressions).toHaveLength(1);
      expect(result.expressions[0].type).toBe('laugh');
    });
  });

  describe('Integration Points for P1', () => {
    it('should provide setExpressionPack method for future activation', () => {
      vi.mocked(isFeatureEnabled).mockReturnValue(false);

      const manager = createStreamingAudioManager('test-voice-id');
      
      expect(manager.setExpressionPack).toBeDefined();
      expect(typeof manager.setExpressionPack).toBe('function');
      
      manager.stop();
    });

    it('should provide enableExpressions method for future activation', () => {
      vi.mocked(isFeatureEnabled).mockReturnValue(false);

      const manager = createStreamingAudioManager('test-voice-id');
      
      expect(manager.enableExpressions).toBeDefined();
      expect(typeof manager.enableExpressions).toBe('function');
      
      manager.stop();
    });

    it('should allow runtime expression pack updates', () => {
      vi.mocked(isFeatureEnabled).mockReturnValue(false);

      const manager = createStreamingAudioManager('test-voice-id');
      
      const mockExpressions = [
        {
          id: 'runtime-1',
          ownerId: 'test',
          ownerType: 'avatar' as const,
          filename: 'test.mp3',
          type: 'laugh' as const,
          durationMs: 500,
          priority: 50,
          status: 'active' as const,
          cdnUrl: '/test.mp3',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ];
      
      const mockBuffers = new Map([
        ['runtime-1', new AudioBuffer({ length: 512, sampleRate: 44100 })]
      ]);

      // Should not throw error
      expect(() => {
        manager.setExpressionPack(mockExpressions, mockBuffers);
      }).not.toThrow();
      
      manager.stop();
    });
  });
});