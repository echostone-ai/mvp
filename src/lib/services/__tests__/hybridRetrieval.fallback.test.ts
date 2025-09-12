// src/lib/services/__tests__/hybridRetrieval.fallback.test.ts
// Comprehensive fallback behavior tests for hybrid retrieval system

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HybridRetriever, parseHybridRetrievalConfig } from '../hybridRetrieval';
import { FactbookService } from '../factbookService';

describe('Hybrid Retrieval Fallback Behavior Tests', () => {
  let hybridRetriever: HybridRetriever;
  let factbookService: FactbookService;
  let originalConsoleError: typeof console.error;
  let originalConsoleWarn: typeof console.warn;

  beforeEach(async () => {
    // Suppress console output during tests
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;
    console.error = vi.fn();
    console.warn = vi.fn();

    // Load test factbook data
    factbookService = FactbookService.getInstance();
    
    const testFactbook = {
      pets: {
        romeo: {
          id: 'pets.romeo',
          text: 'Romeo is a toy poodle born Valentine\'s Day 2024. Very energetic and fascinated by his poodle cousins.',
          topics: ['pets', 'dogs', 'romeo'],
          keywords: ['romeo', 'poodle', 'toy', 'valentine', '2024', 'energetic']
        },
        olive: {
          id: 'pets.olive',
          text: 'Olive, Puerto Rican street dog, came to Maine in 2003. The smartest animal Jonathan knew.',
          topics: ['pets', 'dogs', 'olive'],
          keywords: ['olive', 'puerto', 'rican', 'street', 'dog', 'maine', '2003', 'smartest']
        }
      },
      places: {
        morocco: {
          id: 'places.morocco',
          text: 'In Morocco, I encountered a cobra during a desert expedition. It was terrifying.',
          topics: ['places', 'morocco', 'travel', 'memories'],
          keywords: ['morocco', 'cobra', 'desert', 'expedition', 'snake', 'terrifying']
        }
      },
      relationships: {
        tyler: {
          id: 'relationships.tyler',
          text: 'Tyler McCoy, 46, originally from St. Louis, now in Austin. Yoga instructor, tech enthusiast.',
          topics: ['relationships', 'friends', 'tyler'],
          keywords: ['tyler', 'mccoy', 'st', 'louis', 'austin', 'yoga', 'instructor', 'tech']
        }
      }
    };
    
    await factbookService.loadFactbook(testFactbook);

    // Create hybrid retriever with default config
    const config = parseHybridRetrievalConfig();
    hybridRetriever = new HybridRetriever(config, factbookService);
    
    // Warmup the system
    await hybridRetriever.warmup();
  });

  afterEach(() => {
    // Restore console output
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    vi.clearAllMocks();
  });

  describe('Component Failure Scenarios', () => {
    it('should fallback when BM25 retriever fails', async () => {
      // Mock BM25 retriever to fail
      const originalBM25Retriever = (hybridRetriever as any).bm25Retriever;
      (hybridRetriever as any).bm25Retriever = {
        search: vi.fn().mockRejectedValue(new Error('BM25 search failed')),
        isHealthy: vi.fn().mockReturnValue(false),
        buildIndex: vi.fn().mockResolvedValue(undefined)
      };

      const result = await hybridRetriever.retrieve('romeo poodle');

      // Should handle failure gracefully
      expect(result.metrics.fallbackUsed).toBe(true);
      expect(result.metrics.errors.length).toBeGreaterThan(0);
      expect(result.metrics.errors[0]).toContain('BM25');

      // Should still attempt other methods if available
      if (result.results.length > 0) {
        expect(result.metrics.methodsUsed).not.toContain('bm25');
      }

      // Restore original
      (hybridRetriever as any).bm25Retriever = originalBM25Retriever;
    });

    it('should fallback when vector retriever fails', async () => {
      // Mock vector retriever to fail
      const originalVectorRetriever = (hybridRetriever as any).vectorRetriever;
      (hybridRetriever as any).vectorRetriever = {
        search: vi.fn().mockRejectedValue(new Error('Vector search failed')),
        isHealthy: vi.fn().mockReturnValue(false),
        buildIndex: vi.fn().mockResolvedValue(undefined)
      };

      const result = await hybridRetriever.retrieve('romeo poodle');

      // Should still return results using BM25
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.metrics.fallbackUsed).toBe(true);
      expect(result.metrics.methodsUsed).toContain('bm25');
      expect(result.metrics.methodsUsed).not.toContain('vector');
      expect(result.metrics.errors.length).toBeGreaterThan(0);

      // Restore original
      (hybridRetriever as any).vectorRetriever = originalVectorRetriever;
    });

    it('should fallback when query expansion fails', async () => {
      // Enable expansion
      hybridRetriever.updateConfig({ enableExpansion: 'auto' });

      // Mock query expander to fail
      const originalQueryExpander = (hybridRetriever as any).queryExpander;
      (hybridRetriever as any).queryExpander = {
        expandQuery: vi.fn().mockRejectedValue(new Error('Query expansion failed')),
        isHealthy: vi.fn().mockReturnValue(false)
      };

      // Use a query that would normally trigger expansion (low confidence)
      const result = await hybridRetriever.retrieve('very obscure topic that should not match anything');

      // Should handle expansion failure gracefully
      expect(result.metrics.fallbackUsed).toBe(true);
      expect(result.metrics.expansionTriggered).toBe(false);
      expect(result.metrics.errors.some(error => error.includes('expansion'))).toBe(true);

      // Should still use basic retrieval methods
      expect(result.metrics.methodsUsed.length).toBeGreaterThan(0);

      // Restore original
      (hybridRetriever as any).queryExpander = originalQueryExpander;
    });

    it('should fallback when result reranker fails', async () => {
      // Enable reranking
      hybridRetriever.updateConfig({ enableReranking: true });

      // Mock result reranker to fail
      const originalResultReranker = (hybridRetriever as any).resultReranker;
      (hybridRetriever as any).resultReranker = {
        rerank: vi.fn().mockRejectedValue(new Error('Reranking failed')),
        isHealthy: vi.fn().mockReturnValue(false)
      };

      const result = await hybridRetriever.retrieve('romeo poodle');

      // Should still return results without reranking
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.metrics.fallbackUsed).toBe(true);
      expect(result.metrics.rerankingApplied).toBe(false);
      expect(result.metrics.errors.some(error => error.includes('rerank'))).toBe(true);

      // Should use other methods successfully
      expect(result.metrics.methodsUsed.length).toBeGreaterThan(0);

      // Restore original
      (hybridRetriever as any).resultReranker = originalResultReranker;
    });

    it('should handle embedding service failures', async () => {
      // Mock embedding service to fail
      const originalVectorRetriever = (hybridRetriever as any).vectorRetriever;
      (hybridRetriever as any).vectorRetriever = {
        search: vi.fn().mockRejectedValue(new Error('Embedding generation failed')),
        isHealthy: vi.fn().mockReturnValue(false),
        buildIndex: vi.fn().mockRejectedValue(new Error('Embedding service unavailable'))
      };

      const result = await hybridRetriever.retrieve('romeo poodle');

      // Should fallback to BM25 only
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.metrics.fallbackUsed).toBe(true);
      expect(result.metrics.methodsUsed).toContain('bm25');
      expect(result.metrics.methodsUsed).not.toContain('vector');

      // Restore original
      (hybridRetriever as any).vectorRetriever = originalVectorRetriever;
    });
  });

  describe('Timeout Scenarios', () => {
    it('should handle BM25 search timeout', async () => {
      // Mock BM25 retriever to be very slow
      const originalBM25Retriever = (hybridRetriever as any).bm25Retriever;
      (hybridRetriever as any).bm25Retriever = {
        search: vi.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve([]), 2000)) // 2 second delay
        ),
        isHealthy: vi.fn().mockReturnValue(true),
        buildIndex: vi.fn().mockResolvedValue(undefined)
      };

      // Set a short timeout
      hybridRetriever.updateConfig({ timeoutMs: 100 });

      const result = await hybridRetriever.retrieve('romeo poodle');

      // Should timeout and fallback
      expect(result.metrics.totalTimeMs).toBeLessThan(200);
      expect(result.metrics.fallbackUsed).toBe(true);
      expect(result.metrics.errors.some(error => error.includes('timeout') || error.includes('Timeout'))).toBe(true);

      // Restore original
      (hybridRetriever as any).bm25Retriever = originalBM25Retriever;
    });

    it('should handle vector search timeout', async () => {
      // Mock vector retriever to be very slow
      const originalVectorRetriever = (hybridRetriever as any).vectorRetriever;
      (hybridRetriever as any).vectorRetriever = {
        search: vi.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve([]), 2000)) // 2 second delay
        ),
        isHealthy: vi.fn().mockReturnValue(true),
        buildIndex: vi.fn().mockResolvedValue(undefined)
      };

      // Set a short timeout
      hybridRetriever.updateConfig({ timeoutMs: 100 });

      const result = await hybridRetriever.retrieve('romeo poodle');

      // Should timeout vector search but continue with BM25
      expect(result.metrics.totalTimeMs).toBeLessThan(200);
      expect(result.metrics.fallbackUsed).toBe(true);

      // Restore original
      (hybridRetriever as any).vectorRetriever = originalVectorRetriever;
    });

    it('should handle query expansion timeout', async () => {
      // Enable expansion
      hybridRetriever.updateConfig({ 
        enableExpansion: 'auto',
        expansionTimeoutMs: 50 // Very short timeout
      });

      // Mock query expander to be slow
      const originalQueryExpander = (hybridRetriever as any).queryExpander;
      (hybridRetriever as any).queryExpander = {
        expandQuery: vi.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve({
            canonical_query: 'test',
            alternates: [],
            related_concepts: []
          }), 200)) // 200ms delay, longer than timeout
        ),
        isHealthy: vi.fn().mockReturnValue(true)
      };

      // Use a query that would trigger expansion
      const result = await hybridRetriever.retrieve('very obscure topic');

      // Should timeout expansion but continue with basic retrieval
      expect(result.metrics.expansionTriggered).toBe(false);
      expect(result.metrics.fallbackUsed).toBe(true);

      // Restore original
      (hybridRetriever as any).queryExpander = originalQueryExpander;
    });

    it('should handle reranking timeout', async () => {
      // Enable reranking with short timeout
      hybridRetriever.updateConfig({ 
        enableReranking: true,
        rerankTimeoutMs: 50 // Very short timeout
      });

      // Mock result reranker to be slow
      const originalResultReranker = (hybridRetriever as any).resultReranker;
      (hybridRetriever as any).resultReranker = {
        rerank: vi.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve([]), 200)) // 200ms delay
        ),
        isHealthy: vi.fn().mockReturnValue(true)
      };

      const result = await hybridRetriever.retrieve('romeo poodle');

      // Should timeout reranking but return fusion results
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.metrics.rerankingApplied).toBe(false);
      expect(result.metrics.fallbackUsed).toBe(true);

      // Restore original
      (hybridRetriever as any).resultReranker = originalResultReranker;
    });
  });

  describe('Cascading Failure Scenarios', () => {
    it('should handle multiple component failures gracefully', async () => {
      // Mock multiple components to fail
      const originalBM25Retriever = (hybridRetriever as any).bm25Retriever;
      const originalVectorRetriever = (hybridRetriever as any).vectorRetriever;
      const originalQueryExpander = (hybridRetriever as any).queryExpander;

      (hybridRetriever as any).bm25Retriever = {
        search: vi.fn().mockRejectedValue(new Error('BM25 failed')),
        isHealthy: vi.fn().mockReturnValue(false)
      };

      (hybridRetriever as any).vectorRetriever = {
        search: vi.fn().mockRejectedValue(new Error('Vector failed')),
        isHealthy: vi.fn().mockReturnValue(false)
      };

      (hybridRetriever as any).queryExpander = {
        expandQuery: vi.fn().mockRejectedValue(new Error('Expansion failed')),
        isHealthy: vi.fn().mockReturnValue(false)
      };

      const result = await hybridRetriever.retrieve('romeo poodle');

      // Should handle total failure gracefully
      expect(result.results.length).toBe(0);
      expect(result.metrics.fallbackUsed).toBe(true);
      expect(result.metrics.errors.length).toBeGreaterThan(0);
      expect(result.metrics.totalTimeMs).toBeGreaterThan(0);

      // Should not throw unhandled errors
      expect(result.metrics.errors.length).toBeGreaterThanOrEqual(2); // Multiple failures

      // Restore originals
      (hybridRetriever as any).bm25Retriever = originalBM25Retriever;
      (hybridRetriever as any).vectorRetriever = originalVectorRetriever;
      (hybridRetriever as any).queryExpander = originalQueryExpander;
    });

    it('should prioritize fallback methods correctly', async () => {
      // Mock vector retriever to fail but keep BM25 working
      const originalVectorRetriever = (hybridRetriever as any).vectorRetriever;
      (hybridRetriever as any).vectorRetriever = {
        search: vi.fn().mockRejectedValue(new Error('Vector search failed')),
        isHealthy: vi.fn().mockReturnValue(false)
      };

      const result = await hybridRetriever.retrieve('romeo poodle');

      // Should successfully use BM25 as fallback
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.metrics.methodsUsed).toContain('bm25');
      expect(result.metrics.methodsUsed).not.toContain('vector');
      expect(result.metrics.fallbackUsed).toBe(true);

      // Should find Romeo information using BM25
      const hasRomeoInfo = result.results.some(r => 
        r.snippet.text.toLowerCase().includes('romeo') ||
        r.snippet.keywords.includes('romeo')
      );
      expect(hasRomeoInfo).toBe(true);

      // Restore original
      (hybridRetriever as any).vectorRetriever = originalVectorRetriever;
    });

    it('should maintain partial functionality when some features are disabled', async () => {
      // Disable some features
      hybridRetriever.updateConfig({
        enableEmbeddings: false,
        enableExpansion: 'off',
        enableReranking: false
      });

      const result = await hybridRetriever.retrieve('romeo poodle');

      // Should still work with BM25 only
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.metrics.methodsUsed).toEqual(['bm25']);
      expect(result.metrics.expansionTriggered).toBe(false);
      expect(result.metrics.rerankingApplied).toBe(false);
      expect(result.metrics.fallbackUsed).toBe(false); // Not a fallback, just disabled features

      // Should find relevant results
      const hasRomeoInfo = result.results.some(r => 
        r.snippet.text.toLowerCase().includes('romeo')
      );
      expect(hasRomeoInfo).toBe(true);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from transient failures', async () => {
      let callCount = 0;
      
      // Mock BM25 retriever to fail first time, succeed second time
      const originalBM25Retriever = (hybridRetriever as any).bm25Retriever;
      (hybridRetriever as any).bm25Retriever = {
        search: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            throw new Error('Transient failure');
          }
          return originalBM25Retriever.search('romeo poodle');
        }),
        isHealthy: vi.fn().mockReturnValue(true),
        buildIndex: vi.fn().mockResolvedValue(undefined)
      };

      // First call should fail
      const firstResult = await hybridRetriever.retrieve('romeo poodle');
      expect(firstResult.metrics.errors.length).toBeGreaterThan(0);

      // Second call should succeed
      const secondResult = await hybridRetriever.retrieve('romeo poodle');
      expect(secondResult.results.length).toBeGreaterThan(0);
      expect(secondResult.metrics.errors.length).toBe(0);

      // Restore original
      (hybridRetriever as any).bm25Retriever = originalBM25Retriever;
    });

    it('should handle partial results gracefully', async () => {
      // Mock vector retriever to return empty results
      const originalVectorRetriever = (hybridRetriever as any).vectorRetriever;
      (hybridRetriever as any).vectorRetriever = {
        search: vi.fn().mockResolvedValue([]), // Empty results, not failure
        isHealthy: vi.fn().mockReturnValue(true),
        buildIndex: vi.fn().mockResolvedValue(undefined)
      };

      const result = await hybridRetriever.retrieve('romeo poodle');

      // Should still return BM25 results
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.metrics.methodsUsed).toContain('bm25');
      expect(result.metrics.fallbackUsed).toBe(false); // Not a failure, just no vector results

      // Restore original
      (hybridRetriever as any).vectorRetriever = originalVectorRetriever;
    });

    it('should provide detailed error context for debugging', async () => {
      // Mock components to fail with specific errors
      const originalBM25Retriever = (hybridRetriever as any).bm25Retriever;
      (hybridRetriever as any).bm25Retriever = {
        search: vi.fn().mockRejectedValue(new Error('Database connection timeout')),
        isHealthy: vi.fn().mockReturnValue(false)
      };

      const result = await hybridRetriever.retrieve('romeo poodle');

      // Should provide detailed error information
      expect(result.metrics.errors.length).toBeGreaterThan(0);
      expect(result.metrics.errors[0]).toContain('Database connection timeout');
      expect(result.metrics.fallbackUsed).toBe(true);

      // Should include component health status
      const health = hybridRetriever.getHealthStatus();
      expect(health.status).toBe('unhealthy');
      expect(health.details.length).toBeGreaterThan(0);

      // Restore original
      (hybridRetriever as any).bm25Retriever = originalBM25Retriever;
    });

    it('should maintain system stability under error conditions', async () => {
      // Simulate multiple rapid requests with failures
      const promises = [];
      
      // Mock random failures
      const originalBM25Retriever = (hybridRetriever as any).bm25Retriever;
      (hybridRetriever as any).bm25Retriever = {
        search: vi.fn().mockImplementation(() => {
          if (Math.random() < 0.5) {
            throw new Error('Random failure');
          }
          return originalBM25Retriever.search('romeo poodle');
        }),
        isHealthy: vi.fn().mockReturnValue(true),
        buildIndex: vi.fn().mockResolvedValue(undefined)
      };

      // Make multiple concurrent requests
      for (let i = 0; i < 10; i++) {
        promises.push(hybridRetriever.retrieve(`test query ${i}`));
      }

      const results = await Promise.all(promises);

      // All requests should complete without throwing
      expect(results.length).toBe(10);
      
      // Each result should have proper structure
      results.forEach(result => {
        expect(result.metrics).toBeDefined();
        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
        expect(Array.isArray(result.metrics.errors)).toBe(true);
      });

      // System should remain responsive
      const finalResult = await hybridRetriever.retrieve('final test');
      expect(finalResult.metrics.totalTimeMs).toBeLessThan(1000);

      // Restore original
      (hybridRetriever as any).bm25Retriever = originalBM25Retriever;
    });
  });

  describe('Configuration-Based Fallbacks', () => {
    it('should respect feature flags during failures', async () => {
      // Disable vector search via config
      hybridRetriever.updateConfig({ enableEmbeddings: false });

      // Mock vector retriever to fail (should not be called)
      const vectorSearchSpy = vi.fn().mockRejectedValue(new Error('Should not be called'));
      (hybridRetriever as any).vectorRetriever = {
        search: vectorSearchSpy,
        isHealthy: vi.fn().mockReturnValue(false)
      };

      const result = await hybridRetriever.retrieve('romeo poodle');

      // Should not attempt vector search
      expect(vectorSearchSpy).not.toHaveBeenCalled();
      expect(result.metrics.methodsUsed).not.toContain('vector');
      expect(result.metrics.methodsUsed).toContain('bm25');
    });

    it('should handle A/B testing scenarios', async () => {
      // Test BM25-only mode
      const bm25OnlyConfig = {
        ...parseHybridRetrievalConfig(),
        enableEmbeddings: false,
        enableExpansion: 'off' as const,
        enableReranking: false
      };

      const bm25Retriever = new HybridRetriever(bm25OnlyConfig, factbookService);
      await bm25Retriever.warmup();

      const bm25Result = await bm25Retriever.retrieve('romeo poodle');

      // Should work with BM25 only
      expect(bm25Result.results.length).toBeGreaterThan(0);
      expect(bm25Result.metrics.methodsUsed).toEqual(['bm25']);
      expect(bm25Result.metrics.fallbackUsed).toBe(false);

      // Test hybrid mode
      const hybridResult = await hybridRetriever.retrieve('romeo poodle');

      // Both should return valid results
      expect(hybridResult.results.length).toBeGreaterThan(0);
      expect(bm25Result.results.length).toBeGreaterThan(0);

      // Hybrid should use more methods (when available)
      expect(hybridResult.metrics.methodsUsed.length).toBeGreaterThanOrEqual(bm25Result.metrics.methodsUsed.length);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty factbook gracefully', async () => {
      // Create retriever with empty factbook
      const emptyFactbookService = new (FactbookService as any)();
      await emptyFactbookService.loadFactbook({});

      const emptyRetriever = new HybridRetriever(parseHybridRetrievalConfig(), emptyFactbookService);
      
      const result = await emptyRetriever.retrieve('any query');

      // Should handle gracefully
      expect(result.results.length).toBe(0);
      expect(result.metrics.totalTimeMs).toBeGreaterThan(0);
      expect(result.metrics.errors.length).toBeGreaterThan(0);
    });

    it('should handle extremely long queries', async () => {
      const longQuery = 'romeo poodle '.repeat(100); // Very long query

      const result = await hybridRetriever.retrieve(longQuery);

      // Should handle without crashing
      expect(result.metrics.totalTimeMs).toBeGreaterThan(0);
      expect(result.metrics.errors.length).toBe(0);
    });

    it('should handle special characters and encoding', async () => {
      const specialQuery = 'romëo pöödlé 🐕 émojí tëst';

      const result = await hybridRetriever.retrieve(specialQuery);

      // Should handle without crashing
      expect(result.metrics.totalTimeMs).toBeGreaterThan(0);
      expect(result.metrics.errors.length).toBe(0);
    });

    it('should handle concurrent failures', async () => {
      // Mock all components to fail
      const originalBM25Retriever = (hybridRetriever as any).bm25Retriever;
      const originalVectorRetriever = (hybridRetriever as any).vectorRetriever;

      (hybridRetriever as any).bm25Retriever = {
        search: vi.fn().mockRejectedValue(new Error('BM25 failed')),
        isHealthy: vi.fn().mockReturnValue(false)
      };

      (hybridRetriever as any).vectorRetriever = {
        search: vi.fn().mockRejectedValue(new Error('Vector failed')),
        isHealthy: vi.fn().mockReturnValue(false)
      };

      // Make multiple concurrent requests
      const promises = Array.from({ length: 5 }, (_, i) => 
        hybridRetriever.retrieve(`concurrent failure test ${i}`)
      );

      const results = await Promise.all(promises);

      // All should complete gracefully
      results.forEach(result => {
        expect(result.results.length).toBe(0);
        expect(result.metrics.fallbackUsed).toBe(true);
        expect(result.metrics.errors.length).toBeGreaterThan(0);
      });

      // Restore originals
      (hybridRetriever as any).bm25Retriever = originalBM25Retriever;
      (hybridRetriever as any).vectorRetriever = originalVectorRetriever;
    });
  });
});