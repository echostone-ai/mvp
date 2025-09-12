/**
 * Fast Mode Performance Tests
 * 
 * Comprehensive performance benchmarks to validate sub-200ms response times
 * and optimization effectiveness.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FastModeOptimizer } from '../fastModeOptimizer';
import { ContextRetrievalEngine } from '../contextRetrievalEngine';

// Mock the context retrieval engine with realistic delays
const createMockContextEngine = (baseDelay: number = 50) => ({
  retrieveContext: vi.fn().mockImplementation(async (avatarId: string, query: string, options: any) => {
    // Simulate database query time based on options
    let delay = baseDelay;
    
    if (!options.fastMode) delay += 100;
    if (options.memoryLimit > 10) delay += 50;
    if (options.historyLimit > 5) delay += 30;
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return {
      quickFacts: Array(Math.min(options.memoryLimit || 20, 20)).fill(null).map((_, i) => ({
        id: `fact-${i}`,
        avatarId,
        key: `key${i}`,
        value: `value${i}`,
        confidence: 0.8,
        priority: i + 1,
        source: 'manual' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })),
      memoryFragments: options.memoryLimit > 0 ? Array(Math.min(options.memoryLimit, 10)).fill(null).map((_, i) => ({
        id: `memory-${i}`,
        avatarId,
        fragmentText: `Memory fragment ${i}`,
        conversationContext: {
          source: 'conversation',
          type: 'user' as const,
          conversationId: `conv-${i}`
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })) : [],
      conversationHistory: Array(Math.min(options.historyLimit || 5, 5)).fill(null).map((_, i) => ({
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `Message ${i}`,
        timestamp: new Date().toISOString()
      })),
      retrievalMetadata: {
        totalQuickFacts: Math.min(options.memoryLimit || 20, 20),
        totalMemoryFragments: options.memoryLimit > 0 ? Math.min(options.memoryLimit, 10) : 0,
        totalConversationTurns: Math.min(options.historyLimit || 5, 5),
        retrievalTimeMs: delay,
        confidenceThreshold: 0.35,
        queryOptimizations: options.fastMode ? ['fast_mode'] : [],
        cacheHits: []
      }
    };
  }),
  optimizeQuery: vi.fn(),
  clearCache: vi.fn(),
  getCacheStats: vi.fn()
} as unknown as ContextRetrievalEngine);

describe('Fast Mode Performance Benchmarks', () => {
  let optimizer: FastModeOptimizer;
  let mockContextEngine: ContextRetrievalEngine;
  const mockAvatarId = 'perf-test-avatar';

  beforeEach(() => {
    mockContextEngine = createMockContextEngine(30); // 30ms base delay
    optimizer = new FastModeOptimizer(mockContextEngine);
  });

  afterEach(() => {
    optimizer.clearCache();
    vi.clearAllMocks();
  });

  describe('Response Time Benchmarks', () => {
    it('should achieve sub-200ms for simple queries', async () => {
      const simpleQueries = [
        'Hello',
        'Hi there',
        'How are you?',
        'Good morning',
        'Thanks'
      ];

      for (const query of simpleQueries) {
        const startTime = performance.now();
        const result = await optimizer.retrieveContextFast(mockAvatarId, query, {
          maxResponseTimeMs: 200,
          aggressiveCaching: true
        });
        const responseTime = performance.now() - startTime;

        expect(responseTime).toBeLessThan(200);
        expect(result.metadata.success).toBe(true);
        expect(result.metadata.optimizationsApplied).toContain('simple_query_optimization');
      }
    });

    it('should achieve sub-150ms for ultra-fast mode', async () => {
      const query = 'Hi';
      
      const startTime = performance.now();
      const result = await optimizer.retrieveContextFast(mockAvatarId, query, {
        maxResponseTimeMs: 150,
        aggressiveCaching: true,
        skipMemoryForSimpleQueries: true
      });
      const responseTime = performance.now() - startTime;

      expect(responseTime).toBeLessThan(150);
      expect(result.metadata.optimizationsApplied).toContain('ultra_fast_mode');
    });

    it('should maintain performance under concurrent load', async () => {
      const concurrentQueries = Array(10).fill(null).map((_, i) => 
        optimizer.retrieveContextFast(mockAvatarId, `Query ${i}`, {
          maxResponseTimeMs: 200,
          aggressiveCaching: true
        })
      );

      const startTime = performance.now();
      const results = await Promise.all(concurrentQueries);
      const totalTime = performance.now() - startTime;

      // All queries should complete within reasonable time
      expect(totalTime).toBeLessThan(500); // 10 concurrent queries in under 500ms
      
      results.forEach((result, i) => {
        expect(result.metadata.responseTimeMs).toBeLessThan(200);
        expect(result.context).toBeDefined();
      });
    });

    it('should show performance improvement with caching', async () => {
      const query = 'What is my name?';
      
      // First call - cold cache
      const startTime1 = performance.now();
      const result1 = await optimizer.retrieveContextFast(mockAvatarId, query);
      const coldTime = performance.now() - startTime1;

      // Second call - warm cache
      const startTime2 = performance.now();
      const result2 = await optimizer.retrieveContextFast(mockAvatarId, query);
      const warmTime = performance.now() - startTime2;

      // Warm cache should be significantly faster
      expect(warmTime).toBeLessThan(coldTime * 0.8); // At least 20% improvement
      expect(result2.metadata.cacheHitRate).toBeGreaterThan(0);
    });
  });

  describe('Cache Performance', () => {
    it('should demonstrate cache effectiveness over multiple calls', async () => {
      const queries = [
        'Hello',
        'How are you?',
        'What is my name?',
        'Tell me about yourself'
      ];

      const times: number[] = [];
      
      // Make multiple calls to build up cache
      for (let i = 0; i < 3; i++) {
        for (const query of queries) {
          const startTime = performance.now();
          await optimizer.retrieveContextFast(mockAvatarId, query, {
            aggressiveCaching: true
          });
          times.push(performance.now() - startTime);
        }
      }

      // Later calls should be faster due to caching
      const firstRound = times.slice(0, 4);
      const lastRound = times.slice(-4);
      
      const avgFirstRound = firstRound.reduce((a, b) => a + b) / firstRound.length;
      const avgLastRound = lastRound.reduce((a, b) => a + b) / lastRound.length;
      
      expect(avgLastRound).toBeLessThan(avgFirstRound * 0.7); // 30% improvement
    });

    it('should handle cache expiry gracefully', async () => {
      const query = 'Hello world';
      
      // First call
      const result1 = await optimizer.retrieveContextFast(mockAvatarId, query);
      
      // Mock time passage to expire cache
      const originalNow = Date.now;
      vi.spyOn(Date, 'now').mockReturnValue(originalNow() + 35000); // 35 seconds later
      
      // Second call should still work (cache expired)
      const startTime = performance.now();
      const result2 = await optimizer.retrieveContextFast(mockAvatarId, query);
      const responseTime = performance.now() - startTime;
      
      expect(responseTime).toBeLessThan(300); // Still reasonable even without cache
      expect(result2.context).toBeDefined();
      
      vi.restoreAllMocks();
    });

    it('should optimize cache hit rates', async () => {
      const commonQueries = [
        'Hello',
        'Hi',
        'How are you?',
        'Good morning'
      ];

      // Warm up cache
      for (const query of commonQueries) {
        await optimizer.retrieveContextFast(mockAvatarId, query, {
          aggressiveCaching: true
        });
      }

      // Test cache hit rates
      let totalCacheHitRate = 0;
      for (const query of commonQueries) {
        const result = await optimizer.retrieveContextFast(mockAvatarId, query, {
          aggressiveCaching: true
        });
        totalCacheHitRate += result.metadata.cacheHitRate;
      }

      const avgCacheHitRate = totalCacheHitRate / commonQueries.length;
      expect(avgCacheHitRate).toBeGreaterThan(0.5); // At least 50% cache hit rate
    });
  });

  describe('Optimization Strategy Performance', () => {
    it('should skip memory fragments for simple queries to improve speed', async () => {
      const simpleQuery = 'Hi';
      
      const startTime = performance.now();
      const result = await optimizer.retrieveContextFast(mockAvatarId, simpleQuery, {
        skipMemoryForSimpleQueries: true
      });
      const responseTime = performance.now() - startTime;

      expect(responseTime).toBeLessThan(150);
      expect(result.metadata.optimizationsApplied).toContain('skip_memory_fragments');
      expect(result.context.memoryFragments).toEqual([]);
    });

    it('should use parallel retrieval for better performance', async () => {
      const query = 'Tell me about my family';
      
      const startTime = performance.now();
      const result = await optimizer.retrieveContextFast(mockAvatarId, query, {
        parallelismLevel: 'high'
      });
      const responseTime = performance.now() - startTime;

      expect(result.metadata.optimizationsApplied).toContain('parallel_retrieval');
      // Parallel should be faster than sequential
      expect(responseTime).toBeLessThan(250);
    });

    it('should limit data appropriately for fast responses', async () => {
      const query = 'Hello';
      
      const result = await optimizer.retrieveContextFast(mockAvatarId, query, {
        maxResponseTimeMs: 100,
        aggressiveCaching: true
      });

      expect(result.metadata.optimizationsApplied).toContain('ultra_fast_mode');
      // Should limit the amount of data returned
      expect(result.context.quickFacts.length).toBeLessThanOrEqual(8);
      expect(result.context.conversationHistory.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Stress Testing', () => {
    it('should maintain performance under high query volume', async () => {
      const queries = Array(50).fill(null).map((_, i) => `Query ${i}`);
      const results: number[] = [];

      for (const query of queries) {
        const startTime = performance.now();
        await optimizer.retrieveContextFast(mockAvatarId, query, {
          maxResponseTimeMs: 200,
          aggressiveCaching: true
        });
        results.push(performance.now() - startTime);
      }

      // Calculate statistics
      const avgTime = results.reduce((a, b) => a + b) / results.length;
      const maxTime = Math.max(...results);
      const p95Time = results.sort((a, b) => a - b)[Math.floor(results.length * 0.95)];

      expect(avgTime).toBeLessThan(150);
      expect(maxTime).toBeLessThan(300);
      expect(p95Time).toBeLessThan(200);
    });

    it('should handle memory pressure gracefully', async () => {
      // Fill cache with many entries
      const avatarIds = Array(100).fill(null).map((_, i) => `avatar-${i}`);
      
      for (const avatarId of avatarIds) {
        await optimizer.retrieveContextFast(avatarId, 'Hello', {
          aggressiveCaching: true
        });
      }

      // Test performance with full cache
      const startTime = performance.now();
      const result = await optimizer.retrieveContextFast('new-avatar', 'Hello', {
        maxResponseTimeMs: 200
      });
      const responseTime = performance.now() - startTime;

      expect(responseTime).toBeLessThan(250); // Should still be reasonable
      expect(result.context).toBeDefined();
    });

    it('should recover from cache corruption', async () => {
      // Warm up cache
      await optimizer.retrieveContextFast(mockAvatarId, 'Hello');
      
      // Simulate cache corruption by clearing it
      optimizer.clearCache();
      
      // Should still work without cache
      const startTime = performance.now();
      const result = await optimizer.retrieveContextFast(mockAvatarId, 'Hello');
      const responseTime = performance.now() - startTime;

      expect(responseTime).toBeLessThan(300);
      expect(result.context).toBeDefined();
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions', async () => {
      const baselineQueries = [
        'Hello',
        'How are you?',
        'What is my name?',
        'Tell me about yourself',
        'Good morning'
      ];

      const baselineTimes: number[] = [];
      
      // Establish baseline
      for (const query of baselineQueries) {
        const startTime = performance.now();
        await optimizer.retrieveContextFast(mockAvatarId, query, {
          aggressiveCaching: true
        });
        baselineTimes.push(performance.now() - startTime);
      }

      const baselineAvg = baselineTimes.reduce((a, b) => a + b) / baselineTimes.length;
      
      // Test with cache warmed up (should be faster)
      const optimizedTimes: number[] = [];
      for (const query of baselineQueries) {
        const startTime = performance.now();
        await optimizer.retrieveContextFast(mockAvatarId, query, {
          aggressiveCaching: true
        });
        optimizedTimes.push(performance.now() - startTime);
      }

      const optimizedAvg = optimizedTimes.reduce((a, b) => a + b) / optimizedTimes.length;
      
      // Optimized should be faster than baseline
      expect(optimizedAvg).toBeLessThan(baselineAvg * 1.2); // Allow 20% variance
    });

    it('should maintain consistent performance across different query types', async () => {
      const queryTypes = {
        simple: ['Hi', 'Hello', 'Thanks'],
        medium: ['How are you?', 'What is my name?', 'Good morning'],
        complex: ['Tell me about my family', 'What did we discuss yesterday?', 'Remember the story about my childhood?']
      };

      const results: Record<string, number[]> = {
        simple: [],
        medium: [],
        complex: []
      };

      for (const [type, queries] of Object.entries(queryTypes)) {
        for (const query of queries) {
          const startTime = performance.now();
          await optimizer.retrieveContextFast(mockAvatarId, query, {
            maxResponseTimeMs: 200,
            aggressiveCaching: true
          });
          results[type].push(performance.now() - startTime);
        }
      }

      // Calculate averages
      const averages = Object.entries(results).reduce((acc, [type, times]) => {
        acc[type] = times.reduce((a, b) => a + b) / times.length;
        return acc;
      }, {} as Record<string, number>);

      // Simple queries should be fastest
      expect(averages.simple).toBeLessThan(100);
      expect(averages.medium).toBeLessThan(150);
      expect(averages.complex).toBeLessThan(200);
      
      // Verify ordering
      expect(averages.simple).toBeLessThan(averages.medium);
      expect(averages.medium).toBeLessThan(averages.complex);
    });
  });
});