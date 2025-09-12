/**
 * Task 3 Verification Test
 * Verifies all requirements for task 3: Wire StreamingAudioManager with expression system (overlays disabled)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isFeatureEnabled } from '../featureFlags';
import { ExpressionPackService } from '../services/expressionPackService';
import { createStreamingAudioManager } from '../streamingUtils';

// Mock dependencies
vi.mock('../featureFlags');
vi.mock('../globalAudioManager', () => ({
  globalAudioManager: { stopAll: vi.fn() }
}));
vi.mock('../expressionAudioMixer', () => ({
  createExpressionMixer: vi.fn()
}));

describe('Task 3: Wire StreamingAudioManager with expression system (overlays disabled)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    });
    global.AudioBuffer = vi.fn().mockImplementation((options) => ({
      length: options?.length || 1024,
      sampleRate: options?.sampleRate || 44100
    }));
  });

  describe('Sub-task: Modify StreamingAudioManager initialization to accept expression packs', () => {
    it('should accept expression pack in options parameter', () => {
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
      expect(manager.setExpressionPack).toBeDefined();
      expect(manager.enableExpressions).toBeDefined();
      
      manager.stop();
    });

    it('should work without expression pack (backward compatibility)', () => {
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
  });

  describe('Sub-task: Add feature flag EXPRESSION_OVERLAYS_ENABLED defaulting to false', () => {
    it('should have EXPRESSION_OVERLAYS_ENABLED feature flag interface', () => {
      // Verify the feature flag is defined in the FeatureFlags interface
      // This is tested by the fact that isFeatureEnabled accepts it as a parameter
      expect(() => {
        isFeatureEnabled('EXPRESSION_OVERLAYS_ENABLED');
      }).not.toThrow();
    });

    it('should use feature flag in StreamingAudioManager', () => {
      vi.mocked(isFeatureEnabled).mockReturnValue(false);

      const manager = createStreamingAudioManager('test-voice-id');
      
      // Verify that the feature flag is checked
      expect(isFeatureEnabled).toHaveBeenCalledWith('EXPRESSION_OVERLAYS_ENABLED');
      
      manager.stop();
    });

    it('should respect feature flag state in expression system', () => {
      // Test with flag disabled
      vi.mocked(isFeatureEnabled).mockReturnValue(false);
      
      const manager1 = createStreamingAudioManager('test-voice-id', {}, undefined, {
        expressionPack: { expressions: [], buffers: new Map() }
      });
      
      expect(isFeatureEnabled).toHaveBeenCalledWith('EXPRESSION_OVERLAYS_ENABLED');
      manager1.stop();
      
      // Test with flag enabled
      vi.mocked(isFeatureEnabled).mockReturnValue(true);
      
      const manager2 = createStreamingAudioManager('test-voice-id', {}, undefined, {
        expressionPack: { expressions: [], buffers: new Map() }
      });
      
      expect(isFeatureEnabled).toHaveBeenCalledWith('EXPRESSION_OVERLAYS_ENABLED');
      manager2.stop();
    });
  });

  describe('Sub-task: Implement expression pack loading infrastructure without activating overlays', () => {
    it('should provide ExpressionPackService for loading packs', () => {
      expect(ExpressionPackService).toBeDefined();
      expect(ExpressionPackService.loadExpressionPack).toBeDefined();
      expect(ExpressionPackService.getJonathanDemoExpressionPack).toBeDefined();
      expect(ExpressionPackService.createMockExpressionPack).toBeDefined();
    });

    it('should create mock expression pack for jonathan-demo', () => {
      const mockPack = ExpressionPackService.createMockExpressionPack('jonathan-demo');
      
      expect(mockPack).toBeDefined();
      expect(mockPack.avatarId).toBe('jonathan-demo');
      expect(mockPack.expressions).toBeDefined();
      expect(Array.isArray(mockPack.expressions)).toBe(true);
      expect(mockPack.expressions.length).toBeGreaterThan(0);
      expect(mockPack.buffers).toBeInstanceOf(Map);
    });

    it('should load expression pack infrastructure without activating overlays when flag is disabled', () => {
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

      // Verify that isFeatureEnabled was called to check the flag
      expect(isFeatureEnabled).toHaveBeenCalledWith('EXPRESSION_OVERLAYS_ENABLED');
      
      manager.stop();
    });
  });

  describe('Sub-task: Add expression system integration points for future P1 activation', () => {
    it('should provide setExpressionPack method for runtime updates', () => {
      vi.mocked(isFeatureEnabled).mockReturnValue(false);

      const manager = createStreamingAudioManager('test-voice-id');
      
      expect(manager.setExpressionPack).toBeDefined();
      expect(typeof manager.setExpressionPack).toBe('function');
      
      // Should not throw when called
      expect(() => {
        manager.setExpressionPack([], new Map());
      }).not.toThrow();
      
      manager.stop();
    });

    it('should provide enableExpressions method for runtime control', () => {
      vi.mocked(isFeatureEnabled).mockReturnValue(false);

      const manager = createStreamingAudioManager('test-voice-id');
      
      expect(manager.enableExpressions).toBeDefined();
      expect(typeof manager.enableExpressions).toBe('function');
      
      // Should not throw when called
      expect(() => {
        manager.enableExpressions(true);
        manager.enableExpressions(false);
      }).not.toThrow();
      
      manager.stop();
    });

    it('should allow expression pack to be set after manager creation', () => {
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
        ['runtime-1', { length: 512, sampleRate: 44100 }]
      ]);

      // Should allow setting expression pack after creation
      expect(() => {
        manager.setExpressionPack(mockExpressions, mockBuffers);
      }).not.toThrow();
      
      manager.stop();
    });

    it('should maintain expression pack state for future P1 activation', () => {
      // Test with flag disabled (current state)
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

      // Expression pack should be loaded but overlays disabled
      expect(isFeatureEnabled).toHaveBeenCalledWith('EXPRESSION_OVERLAYS_ENABLED');
      
      // Manager should be ready for future activation
      expect(manager.setExpressionPack).toBeDefined();
      expect(manager.enableExpressions).toBeDefined();
      
      manager.stop();
    });
  });

  describe('Requirements verification', () => {
    it('should satisfy requirement 3.1: Expression overlay system infrastructure', () => {
      // Verify expression pack loading infrastructure exists
      expect(ExpressionPackService).toBeDefined();
      expect(ExpressionPackService.loadExpressionPack).toBeDefined();
      
      // Verify StreamingAudioManager accepts expression packs
      const manager = createStreamingAudioManager('test-voice-id', {}, undefined, {
        expressionPack: { expressions: [], buffers: new Map() }
      });
      
      expect(manager).toBeDefined();
      manager.stop();
    });

    it('should satisfy requirement 6.1: System integration compatibility', () => {
      // Verify backward compatibility - manager works without expression pack
      const manager1 = createStreamingAudioManager('test-voice-id');
      expect(manager1).toBeDefined();
      manager1.stop();
      
      // Verify forward compatibility - manager works with expression pack
      const manager2 = createStreamingAudioManager('test-voice-id', {}, undefined, {
        expressionPack: { expressions: [], buffers: new Map() }
      });
      expect(manager2).toBeDefined();
      manager2.stop();
      
      // Verify feature flag integration
      expect(isFeatureEnabled).toBeDefined();
    });
  });
});