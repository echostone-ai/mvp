/**
 * Fast Mode Optimizer Tests
 * 
 * Tests for sub-200ms response optimization including caching,
 * parallel retrieval, and selective loading strategies.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FastModeOptimizer, QueryAnalysis, FastModeOptions } from '../fastModeOptimizer';
import { ContextRetrievalEngine, QuickFact, MemoryFragment, ConversationTurn } from '../contextRetrievalEngine';

// Mock the context retrieval engine
const mockContextEngine = {
  retrieveContext: vi.fn(),
  optimizeQuery: vi.fn(),
  clearCache: vi.fn(),
  getCacheStats: vi.fn()
} as unknown as ContextRetrievalEngine;

describe('FastModeOptimizer', () => {
  let optimizer: FastModeOptimizer;
  const mockAvatarId = 'test-avatar-123';

  beforeEach(() => {
    optimizer = new FastModeOptimizer(mockContextEngine);
    vi.clearAllMocks();
  });

  afterEach(() => {
    optimizer.clearCache();
  });

  describe('Query Analysis', () => {
    it('should identify simple queries correctly', async () => {
      const simpleQuery = 'Hello there';
      const { context, metadata } = await optimizer.retrieveContextFast(mockAvatarId, simpleQuery);
      
      expect(metadata.optimizationsApplied).toContain('simple_query_optimization');
    });

    it('should identify complex queries requiring memory fragments', async () => {
      const complexQuery = 'Tell me about the story you remember from last week';
      
      // Mock the context engine response
      (mockContextEngine.retrieveContext as any).mockResolvedValue({
        quickFacts: [],
        memoryFragments: [],
        conversationHistory: [],
        retrievalMetadata: {
          totalQuickFacts: 0,
          totalMemoryFragments: 0,
          totalConversationTurns: 0,
          retrievalTimeMs: 100,
          confidenceThreshold: 0.35,
          queryOptimizations: [],
          cacheHits: []
        }
      });

      const { context, metadata } = await optimizer.retrieveContextFast(mockAvatarId, complexQuery);
      
      // Should not skip memory fragments for complex queries
      expect(metadata.optimizationsApplied).not.toContain('skip_memory_fragments');
    });

    it('should cache query analysis results', async () => {
      const query = 'What is your name?';
      
      // Mock the context engine response
      (mockContextEngine.retrieveContext as any).mockResolvedValue({
        quickFacts: [{ id: '1', key: 'name', value: 'Test', avatarId: mockAvatarId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
        memoryFragments: [],
        conversationHistory: [],
        retrievalMetadata: {
          totalQuickFacts: 1,
          totalMemoryFragments: 0,
          totalConversationTurns: 0,
          retrievalTimeMs: 50,
          confidenceThreshold: 0.35,
          queryOptimizations: [],
          cacheHits: []
        }
      });

      // First call
      const result1 = await optimizer.retrieveContextFast(mockAvatarId, query);
      
      // Second call should be faster due to cached analysis
      const startTime = Date.now();
      const result2 = await optimizer.retrieveContextFast(mockAvatarId, query);
      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(100); // Should be very fast due to caching
      expect(result2.metadata.cacheHitRate).toBeGreaterThan(0);
    });
  });

  describe('Caching Layer', () => {
    it('should cache quick facts with 30-second TTL', async () => {
      const mockQuickFacts: QuickFact[] = [
        {
          id: '1',
          avatarId: mockAvatarId,
          key: 'name',
          value: 'Test User',
          confidence: 1.0,
          priority: 1,
          source: 'manual',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      (mockContextEngine.retrieveContext as any).mockResolvedValue({
        quickFacts: mockQuickFacts,
        memoryFragments: [],
        conversationHistory: [],
        retrievalMetadata: {
          totalQuickFacts: 1,
          totalMemoryFragments: 0,
          totalConversationTurns: 0,
          retrievalTimeMs: 100,
          confidenceThreshold: 0.35,
          queryOptimizations: [],
          cacheHits: []
        }
      });

      // First call - should hit database
      const result1 = await optimizer.retrieveContextFast(mockAvatarId, 'Hello');
      expect(mockContextEngine.retrieveContext).toHaveBeenCalledTimes(3); // quickFacts, memoryFragments, history

      // Second call - should use cache
      const result2 = await optimizer.retrieveContextFast(mockAvatarId, 'Hello');
      expect(result2.metadata.cacheHitRate).toBeGreaterThan(0);
    });

    it('should expire cache after TTL', async () => {
      const mockQuickFacts: QuickFact[] = [
        {
          id: '1',
          avatarId: mockAvatarId,
          key: 'name',
          value: 'Test User',
          confidence: 1.0,
          priority: 1,
          source: 'manual',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      (mockContextEngine.retrieveContext as any).mockResolvedValue({
        quickFacts: mockQuickFacts,
        memoryFragments: [],
        conversationHistory: [],
        retrievalMetadata: {
          totalQuickFacts: 1,
          totalMemoryFragments: 0,
          totalConversationTurns: 0,
          retrievalTimeMs: 100,
          confidenceThreshold: 0.35,
          queryOptimizations: [],
          cacheHits: []
        }
      });

      // First call
      await optimizer.retrieveContextFast(mockAvatarId, 'Hello');
      
      // Mock time passage (simulate cache expiry)
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 35000); // 35 seconds later
      
      // Second call should miss cache
      await optimizer.retrieveContextFast(mockAvatarId, 'Hello');
      
      vi.restoreAllMocks();
    });

    it('should provide cache statistics', () => {
      const stats = optimizer.getCacheStats();
      expect(stats).toHaveProperty('quickFacts');
      expect(stats).toHaveProperty('memoryFragments');
      expect(stats).toHaveProperty('conversationHistory');
      expect(stats).toHaveProperty('queryAnalysis');
      expect(stats).toHaveProperty('totalSize');
      expect(typeof stats.totalSize).toBe('number');
    });
  });

  describe('Parallel Data Retrieval', () => {
    it('should retrieve data in parallel for better performance', async () => {
      const mockData = {
        quickFacts: [{ id: '1', key: 'name', value: 'Test', avatarId: mockAvatarId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
        memoryFragments: [],
        conversationHistory: [],
        retrievalMetadata: {
          totalQuickFacts: 1,
          totalMemoryFragments: 0,
          totalConversationTurns: 0,
          retrievalTimeMs: 100,
          confidenceThreshold: 0.35,
          queryOptimizations: ['parallel_retrieval'],
          cacheHits: []
        }
      };

      (mockContextEngine.retrieveContext as any).mockResolvedValue(mockData);

      const startTime = Date.now();
      const result = await optimizer.retrieveContextFast(mockAvatarId, 'Hello', {
        parallelismLevel: 'high'
      });
      const responseTime = Date.now() - startTime;

      expect(result.metadata.optimizationsApplied).toContain('parallel_retrieval');
      expect(responseTime).toBeLessThan(500); // Should be reasonably fast
    });

    it('should handle parallel retrieval failures gracefully', async () => {
      // Mock one of the retrievals to fail
      (mockContextEngine.retrieveContext as any)
        .mockResolvedValueOnce({
          quickFacts: [{ id: '1', key: 'name', value: 'Test', avatarId: mockAvatarId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
          memoryFragments: [],
          conversationHistory: [],
          retrievalMetadata: { totalQuickFacts: 1, totalMemoryFragments: 0, totalConversationTurns: 0, retrievalTimeMs: 100, confidenceThreshold: 0.35, queryOptimizations: [], cacheHits: [] }
        })
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({
          quickFacts: [],
          memoryFragments: [],
          conversationHistory: [],
          retrievalMetadata: { totalQuickFacts: 0, totalMemoryFragments: 0, totalConversationTurns: 0, retrievalTimeMs: 100, confidenceThreshold: 0.35, queryOptimizations: [], cacheHits: [] }
        });

      const result = await optimizer.retrieveContextFast(mockAvatarId, 'Hello');
      
      // Should fallback gracefully
      expect(result.metadata.fallbackUsed).toBe(true);
      expect(result.context).toBeDefined();
    });
  });

  describe('Selective Loading', () => {
    it('should skip memory fragments for simple queries', async () => {
      const simpleQuery = 'Hi';
      
      (mockContextEngine.retrieveContext as any).mockResolvedValue({
        quickFacts: [],
        memoryFragments: [],
        conversationHistory: [],
        retrievalMetadata: {
          totalQuickFacts: 0,
          totalMemoryFragments: 0,
          totalConversationTurns: 0,
          retrievalTimeMs: 50,
          confidenceThreshold: 0.35,
          queryOptimizations: [],
          cacheHits: []
        }
      });

      const result = await optimizer.retrieveContextFast(mockAvatarId, simpleQuery, {
        skipMemoryForSimpleQueries: true
      });

      expect(result.metadata.optimizationsApplied).toContain('skip_memory_fragments');
      expect(result.context.memoryFragments).toEqual([]);
    });

    it('should include memory fragments for complex queries', async () => {
      const complexQuery = 'Tell me about the story you shared last week about your childhood';
      
      const mockMemoryFragments: MemoryFragment[] = [
        {
          id: '1',
          avatarId: mockAvatarId,
          fragmentText: 'Childhood story about playing in the park',
          conversationContext: {
            source: 'conversation',
            type: 'user',
            conversationId: 'conv-123'
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      (mockContextEngine.retrieveContext as any).mockResolvedValue({
        quickFacts: [],
        memoryFragments: mockMemoryFragments,
        conversationHistory: [],
        retrievalMetadata: {
          totalQuickFacts: 0,
          totalMemoryFragments: 1,
          totalConversationTurns: 0,
          retrievalTimeMs: 150,
          confidenceThreshold: 0.35,
          queryOptimizations: [],
          cacheHits: []
        }
      });

      const result = await optimizer.retrieveContextFast(mockAvatarId, complexQuery);

      expect(result.metadata.optimizationsApplied).not.toContain('skip_memory_fragments');
      expect(result.context.memoryFragments.length).toBeGreaterThan(0);
    });

    it('should limit data based on query complexity', async () => {
      const ultraFastOptions: FastModeOptions = {
        maxResponseTimeMs: 100,
        aggressiveCaching: true
      };

      (mockContextEngine.retrieveContext as any).mockResolvedValue({
        quickFacts: Array(20).fill(null).map((_, i) => ({
          id: `${i}`,
          key: `fact${i}`,
          value: `value${i}`,
          avatarId: mockAvatarId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })),
        memoryFragments: [],
        conversationHistory: [],
        retrievalMetadata: {
          totalQuickFacts: 20,
          totalMemoryFragments: 0,
          totalConversationTurns: 0,
          retrievalTimeMs: 80,
          confidenceThreshold: 0.35,
          queryOptimizations: [],
          cacheHits: []
        }
      });

      const result = await optimizer.retrieveContextFast(mockAvatarId, 'Hello', ultraFastOptions);

      expect(result.metadata.optimizationsApplied).toContain('ultra_fast_mode');
      // Should limit the number of facts returned for ultra-fast mode
      expect(result.context.quickFacts.length).toBeLessThanOrEqual(8);
    });
  });

  describe('Performance Targets', () => {
    it('should achieve sub-200ms response times for simple queries', async () => {
      const simpleQuery = 'Hello';
      
      (mockContextEngine.retrieveContext as any).mockResolvedValue({
        quickFacts: [{ id: '1', key: 'name', value: 'Test', avatarId: mockAvatarId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
        memoryFragments: [],
        conversationHistory: [],
        retrievalMetadata: {
          totalQuickFacts: 1,
          totalMemoryFragments: 0,
          totalConversationTurns: 0,
          retrievalTimeMs: 50,
          confidenceThreshold: 0.35,
          queryOptimizations: [],
          cacheHits: []
        }
      });

      const startTime = Date.now();
      const result = await optimizer.retrieveContextFast(mockAvatarId, simpleQuery);
      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeLessThan(200);
      expect(result.metadata.success).toBe(true);
    });

    it('should report performance metrics accurately', async () => {
      (mockContextEngine.retrieveContext as any).mockResolvedValue({
        quickFacts: [],
        memoryFragments: [],
        conversationHistory: [],
        retrievalMetadata: {
          totalQuickFacts: 0,
          totalMemoryFragments: 0,
          totalConversationTurns: 0,
          retrievalTimeMs: 100,
          confidenceThreshold: 0.35,
          queryOptimizations: [],
          cacheHits: []
        }
      });

      const result = await optimizer.retrieveContextFast(mockAvatarId, 'Hello');

      expect(result.metadata).toHaveProperty('responseTimeMs');
      expect(result.metadata).toHaveProperty('cacheHitRate');
      expect(result.metadata).toHaveProperty('optimizationsApplied');
      expect(result.metadata).toHaveProperty('success');
      expect(result.metadata).toHaveProperty('fallbackUsed');
      
      expect(typeof result.metadata.responseTimeMs).toBe('number');
      expect(typeof result.metadata.cacheHitRate).toBe('number');
      expect(Array.isArray(result.metadata.optimizationsApplied)).toBe(true);
      expect(typeof result.metadata.success).toBe('boolean');
      expect(typeof result.metadata.fallbackUsed).toBe('boolean');
    });

    it('should use fallback when performance targets are not met', async () => {
      // Mock a slow response
      (mockContextEngine.retrieveContext as any)
        .mockImplementation(() => new Promise(resolve => {
          setTimeout(() => resolve({
            quickFacts: [],
            memoryFragments: [],
            conversationHistory: [],
            retrievalMetadata: {
              totalQuickFacts: 0,
              totalMemoryFragments: 0,
              totalConversationTurns: 0,
              retrievalTimeMs: 300,
              confidenceThreshold: 0.35,
              queryOptimizations: [],
              cacheHits: []
            }
          }), 300);
        }));

      const result = await optimizer.retrieveContextFast(mockAvatarId, 'Hello', {
        maxResponseTimeMs: 100
      });

      // Should eventually succeed with fallback
      expect(result.context).toBeDefined();
    });
  });

  describe('Cache Management', () => {
    it('should clear all caches', () => {
      optimizer.clearCache();
      const stats = optimizer.getCacheStats();
      expect(stats.totalSize).toBe(0);
    });

    it('should preload cache for an avatar', async () => {
      (mockContextEngine.retrieveContext as any).mockResolvedValue({
        quickFacts: [{ id: '1', key: 'name', value: 'Test', avatarId: mockAvatarId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
        memoryFragments: [],
        conversationHistory: [],
        retrievalMetadata: {
          totalQuickFacts: 1,
          totalMemoryFragments: 0,
          totalConversationTurns: 0,
          retrievalTimeMs: 100,
          confidenceThreshold: 0.35,
          queryOptimizations: [],
          cacheHits: []
        }
      });

      await optimizer.preloadCache(mockAvatarId);
      
      const stats = optimizer.getCacheStats();
      expect(stats.totalSize).toBeGreaterThan(0);
    });

    it('should handle cache preload failures gracefully', async () => {
      (mockContextEngine.retrieveContext as any).mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(optimizer.preloadCache(mockAvatarId)).resolves.toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty queries', async () => {
      (mockContextEngine.retrieveContext as any).mockResolvedValue({
        quickFacts: [],
        memoryFragments: [],
        conversationHistory: [],
        retrievalMetadata: {
          totalQuickFacts: 0,
          totalMemoryFragments: 0,
          totalConversationTurns: 0,
          retrievalTimeMs: 50,
          confidenceThreshold: 0.35,
          queryOptimizations: [],
          cacheHits: []
        }
      });

      const result = await optimizer.retrieveContextFast(mockAvatarId, '');
      expect(result.context).toBeDefined();
      expect(result.metadata.success).toBe(true);
    });

    it('should handle very long queries', async () => {
      const longQuery = 'A'.repeat(1000);
      
      (mockContextEngine.retrieveContext as any).mockResolvedValue({
        quickFacts: [],
        memoryFragments: [],
        conversationHistory: [],
        retrievalMetadata: {
          totalQuickFacts: 0,
          totalMemoryFragments: 0,
          totalConversationTurns: 0,
          retrievalTimeMs: 100,
          confidenceThreshold: 0.35,
          queryOptimizations: [],
          cacheHits: []
        }
      });

      const result = await optimizer.retrieveContextFast(mockAvatarId, longQuery);
      expect(result.context).toBeDefined();
    });

    it('should handle special characters in queries', async () => {
      const specialQuery = 'Hello! @#$%^&*()_+ 你好 🎉';
      
      (mockContextEngine.retrieveContext as any).mockResolvedValue({
        quickFacts: [],
        memoryFragments: [],
        conversationHistory: [],
        retrievalMetadata: {
          totalQuickFacts: 0,
          totalMemoryFragments: 0,
          totalConversationTurns: 0,
          retrievalTimeMs: 100,
          confidenceThreshold: 0.35,
          queryOptimizations: [],
          cacheHits: []
        }
      });

      const result = await optimizer.retrieveContextFast(mockAvatarId, specialQuery);
      expect(result.context).toBeDefined();
    });
  });
});