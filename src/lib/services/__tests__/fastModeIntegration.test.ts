/**
 * Fast Mode Integration Tests
 * 
 * Tests integration between FastModeOptimizer and ContextRetrievalEngine
 * to validate end-to-end fast mode functionality.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FastModeOptimizer, createFastModeOptimizer } from '../fastModeOptimizer';
import { ContextRetrievalEngine, createContextRetrievalEngine } from '../contextRetrievalEngine';

// Mock the Supabase client
vi.mock('@/lib/data/client', () => ({
  sbAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          lte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                or: vi.fn(() => Promise.resolve({
                  data: [
                    {
                      id: '1',
                      avatar_id: 'test-avatar',
                      key: 'name',
                      value: 'Test User',
                      confidence: 0.9,
                      priority: 1,
                      source: 'manual',
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    }
                  ],
                  error: null
                }))
              }))
            }))
          }))
        }))
      }))
    }))
  }
}));

// Mock the schema compatibility layer
vi.mock('../schemaCompatibilityLayer', () => ({
  getSchemaCompatibilityLayer: () => ({
    resolveTableName: (name: string) => name === 'avatars' ? 'avatar_profiles' : name,
    validateColumnExists: () => true,
    qualifyJoinColumns: (query: string) => query,
    validateConstraints: () => ({ isValid: true, errors: [] })
  })
}));

describe('Fast Mode Integration Tests', () => {
  let contextEngine: ContextRetrievalEngine;
  let fastOptimizer: FastModeOptimizer;
  const mockAvatarId = 'integration-test-avatar';

  beforeEach(() => {
    contextEngine = createContextRetrievalEngine();
    fastOptimizer = createFastModeOptimizer(contextEngine);
  });

  afterEach(() => {
    fastOptimizer.clearCache();
    vi.clearAllMocks();
  });

  describe('Basic Integration', () => {
    it('should integrate fast mode with context retrieval engine', async () => {
      const query = 'Hello world';
      
      const { context, metadata } = await fastOptimizer.retrieveContextFast(
        mockAvatarId,
        query,
        {
          maxResponseTimeMs: 200,
          aggressiveCaching: true
        }
      );

      expect(context).toBeDefined();
      expect(context.quickFacts).toBeDefined();
      expect(context.memoryFragments).toBeDefined();
      expect(context.conversationHistory).toBeDefined();
      expect(context.retrievalMetadata).toBeDefined();

      expect(metadata.responseTimeMs).toBeLessThan(300); // Allow some margin
      expect(metadata.success).toBe(true);
      expect(metadata.fallbackUsed).toBe(false);
    });

    it('should use fast mode through context engine', async () => {
      const query = 'Hi there';
      
      const context = await contextEngine.retrieveContextFast(
        mockAvatarId,
        query,
        {
          maxResponseTimeMs: 200,
          aggressiveCaching: true
        }
      );

      expect(context).toBeDefined();
      expect(context.quickFacts).toBeDefined();
      expect(Array.isArray(context.quickFacts)).toBe(true);
    });
  });

  describe('Performance Integration', () => {
    it('should achieve target performance in integrated environment', async () => {
      const queries = [
        'Hello',
        'How are you?',
        'What is my name?'
      ];

      const results = [];

      for (const query of queries) {
        const startTime = performance.now();
        
        const { context, metadata } = await fastOptimizer.retrieveContextFast(
          mockAvatarId,
          query,
          {
            maxResponseTimeMs: 200,
            aggressiveCaching: true
          }
        );
        
        const actualTime = performance.now() - startTime;
        
        results.push({
          query,
          actualTime,
          reportedTime: metadata.responseTimeMs,
          success: metadata.success
        });
      }

      // All queries should complete successfully
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.actualTime).toBeLessThan(300); // Allow margin for test environment
      });

      // Average should be reasonable
      const avgTime = results.reduce((sum, r) => sum + r.actualTime, 0) / results.length;
      expect(avgTime).toBeLessThan(250);
    });

    it('should show caching benefits in integrated environment', async () => {
      const query = 'What is my name?';
      
      // First call - cold
      const result1 = await fastOptimizer.retrieveContextFast(
        mockAvatarId,
        query,
        { aggressiveCaching: true }
      );

      // Second call - should use cache
      const result2 = await fastOptimizer.retrieveContextFast(
        mockAvatarId,
        query,
        { aggressiveCaching: true }
      );

      expect(result2.metadata.cacheHitRate).toBeGreaterThan(0);
      expect(result2.context.quickFacts).toEqual(result1.context.quickFacts);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle database errors gracefully', async () => {
      // Mock a database error
      const originalFrom = vi.mocked(require('@/lib/data/client').sbAdmin.from);
      vi.mocked(require('@/lib/data/client').sbAdmin.from).mockImplementationOnce(() => {
        throw new Error('Database connection failed');
      });

      const { context, metadata } = await fastOptimizer.retrieveContextFast(
        mockAvatarId,
        'Hello',
        { maxResponseTimeMs: 200 }
      );

      // Should fallback gracefully
      expect(context).toBeDefined();
      expect(metadata.fallbackUsed).toBe(true);

      // Restore original mock
      vi.mocked(require('@/lib/data/client').sbAdmin.from).mockImplementation(originalFrom);
    });

    it('should recover from cache corruption', async () => {
      // Warm up cache
      await fastOptimizer.retrieveContextFast(mockAvatarId, 'Hello');
      
      // Corrupt cache by clearing it
      fastOptimizer.clearCache();
      
      // Should still work
      const { context, metadata } = await fastOptimizer.retrieveContextFast(
        mockAvatarId,
        'Hello',
        { aggressiveCaching: true }
      );

      expect(context).toBeDefined();
      expect(metadata.success).toBe(true);
    });
  });

  describe('Optimization Strategy Integration', () => {
    it('should apply different strategies based on query complexity', async () => {
      const testCases = [
        {
          query: 'Hi',
          expectedOptimizations: ['simple_query_optimization', 'skip_memory_fragments']
        },
        {
          query: 'Tell me about my family history and childhood memories',
          expectedOptimizations: ['parallel_retrieval']
        }
      ];

      for (const testCase of testCases) {
        const { context, metadata } = await fastOptimizer.retrieveContextFast(
          mockAvatarId,
          testCase.query,
          {
            maxResponseTimeMs: 200,
            skipMemoryForSimpleQueries: true,
            parallelismLevel: 'high'
          }
        );

        expect(context).toBeDefined();
        
        // Check that at least some expected optimizations are applied
        const hasExpectedOptimization = testCase.expectedOptimizations.some(opt =>
          metadata.optimizationsApplied.includes(opt)
        );
        expect(hasExpectedOptimization).toBe(true);
      }
    });

    it('should limit data appropriately for ultra-fast mode', async () => {
      const { context, metadata } = await fastOptimizer.retrieveContextFast(
        mockAvatarId,
        'Hello',
        {
          maxResponseTimeMs: 100, // Ultra-fast
          aggressiveCaching: true
        }
      );

      expect(metadata.optimizationsApplied).toContain('ultra_fast_mode');
      expect(context.quickFacts.length).toBeLessThanOrEqual(8);
      expect(context.conversationHistory.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Cache Management Integration', () => {
    it('should manage cache lifecycle properly', async () => {
      const query = 'Hello world';
      
      // Initial state - empty cache
      let stats = fastOptimizer.getCacheStats();
      expect(stats.totalSize).toBe(0);

      // First call - should populate cache
      await fastOptimizer.retrieveContextFast(
        mockAvatarId,
        query,
        { aggressiveCaching: true }
      );

      stats = fastOptimizer.getCacheStats();
      expect(stats.totalSize).toBeGreaterThan(0);

      // Clear cache
      fastOptimizer.clearCache();
      stats = fastOptimizer.getCacheStats();
      expect(stats.totalSize).toBe(0);
    });

    it('should preload cache effectively', async () => {
      // Preload cache
      await fastOptimizer.preloadCache(mockAvatarId);
      
      const stats = fastOptimizer.getCacheStats();
      expect(stats.totalSize).toBeGreaterThan(0);

      // Subsequent calls should benefit from preloaded cache
      const { metadata } = await fastOptimizer.retrieveContextFast(
        mockAvatarId,
        'Hello',
        { aggressiveCaching: true }
      );

      expect(metadata.cacheHitRate).toBeGreaterThan(0);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle typical conversation flow', async () => {
      const conversationFlow = [
        'Hello',
        'How are you today?',
        'What is my name?',
        'Tell me about my family',
        'Thanks for the information'
      ];

      const results = [];

      for (const query of conversationFlow) {
        const { context, metadata } = await fastOptimizer.retrieveContextFast(
          mockAvatarId,
          query,
          {
            maxResponseTimeMs: 200,
            aggressiveCaching: true,
            skipMemoryForSimpleQueries: true
          }
        );

        results.push({
          query,
          responseTime: metadata.responseTimeMs,
          success: metadata.success,
          cacheHitRate: metadata.cacheHitRate,
          optimizations: metadata.optimizationsApplied
        });
      }

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Later queries should show cache benefits
      const laterResults = results.slice(2);
      const avgCacheHitRate = laterResults.reduce((sum, r) => sum + r.cacheHitRate, 0) / laterResults.length;
      expect(avgCacheHitRate).toBeGreaterThan(0);
    });

    it('should maintain performance under load', async () => {
      const concurrentQueries = Array(5).fill(null).map((_, i) => 
        fastOptimizer.retrieveContextFast(
          mockAvatarId,
          `Concurrent query ${i}`,
          {
            maxResponseTimeMs: 200,
            aggressiveCaching: true
          }
        )
      );

      const results = await Promise.all(concurrentQueries);

      results.forEach((result, i) => {
        expect(result.context).toBeDefined();
        expect(result.metadata.success).toBe(true);
      });
    });
  });
});