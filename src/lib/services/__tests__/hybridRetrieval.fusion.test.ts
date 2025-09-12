// src/lib/services/__tests__/hybridRetrieval.fusion.test.ts
// Integration tests for hybrid retrieval with result fusion

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HybridRetriever, HybridRetrievalConfig, parseHybridRetrievalConfig } from '../hybridRetrieval';
import { FactbookService, FactbookSnippet } from '../factbookService';
import { EmbeddingCache } from '../embeddingCache';

// Mock the embedding cache
class MockEmbeddingCache implements EmbeddingCache {
  private cache = new Map<string, number[]>();

  async get(text: string): Promise<number[] | null> {
    return this.cache.get(text) || null;
  }

  async set(text: string, embedding: number[]): Promise<void> {
    this.cache.set(text, embedding);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async size(): Promise<number> {
    return this.cache.size;
  }
}

describe('HybridRetriever with Result Fusion', () => {
  let hybridRetriever: HybridRetriever;
  let factbookService: FactbookService;
  let embeddingCache: MockEmbeddingCache;
  let config: HybridRetrievalConfig;

  // Test data
  const testSnippets: FactbookSnippet[] = [
    {
      id: 'snippet1',
      path: 'test/snippet1',
      text: 'I encountered a dangerous cobra snake in Morocco during my travels',
      topics: ['travel', 'animals'],
      keywords: ['cobra', 'snake', 'Morocco', 'dangerous']
    },
    {
      id: 'snippet2',
      path: 'test/snippet2',
      text: 'My brother Tyler is married to his partner Cansu',
      topics: ['family', 'relationships'],
      keywords: ['Tyler', 'brother', 'Cansu', 'married']
    },
    {
      id: 'snippet3',
      path: 'test/snippet3',
      text: 'I attended amazing concerts at SXSW including Bill Murray and GZA performances',
      topics: ['music', 'events'],
      keywords: ['SXSW', 'concerts', 'Bill Murray', 'GZA']
    },
    {
      id: 'snippet4',
      path: 'test/snippet4',
      text: 'My pets Olive and George are very important to me',
      topics: ['pets', 'family'],
      keywords: ['Olive', 'George', 'pets']
    }
  ];

  beforeEach(async () => {
    // Mock environment variables for testing
    vi.stubEnv('RETRIEVAL_EMBEDDINGS', 'on');
    vi.stubEnv('RETRIEVAL_EXPANSION', 'off');
    vi.stubEnv('RETRIEVAL_RERANK', 'off');
    vi.stubEnv('RETRIEVAL_FUSION_K', '60');
    vi.stubEnv('RETRIEVAL_BM25_WEIGHT', '0.6');
    vi.stubEnv('RETRIEVAL_VECTOR_WEIGHT', '0.4');

    config = parseHybridRetrievalConfig();
    
    // Create mock factbook service
    factbookService = new FactbookService();
    
    // Mock the factbook service methods
    vi.spyOn(factbookService, 'isLoaded').mockReturnValue(true);
    vi.spyOn(factbookService, 'validateIndex').mockReturnValue(true);
    vi.spyOn(factbookService, 'getAllSnippets').mockReturnValue(testSnippets);
    vi.spyOn(factbookService, 'getSnippetCount').mockReturnValue(testSnippets.length);

    // Create embedding cache
    embeddingCache = new MockEmbeddingCache();

    // Pre-populate cache with mock embeddings for consistent testing
    await embeddingCache.set(testSnippets[0].text, [0.1, 0.2, 0.3, 0.4]); // cobra snippet
    await embeddingCache.set(testSnippets[1].text, [0.5, 0.6, 0.7, 0.8]); // Tyler snippet
    await embeddingCache.set(testSnippets[2].text, [0.2, 0.4, 0.6, 0.8]); // SXSW snippet
    await embeddingCache.set(testSnippets[3].text, [0.3, 0.6, 0.9, 0.1]); // pets snippet

    // Create hybrid retriever
    hybridRetriever = new HybridRetriever(config, factbookService, embeddingCache);
  });

  describe('initialization', () => {
    it('should initialize with fusion capabilities', () => {
      const retrievedConfig = hybridRetriever.getConfig();
      expect(retrievedConfig.enableEmbeddings).toBe(true);
      expect(retrievedConfig.fusionK).toBe(60);
      expect(retrievedConfig.bm25Weight).toBe(0.6);
      expect(retrievedConfig.vectorWeight).toBe(0.4);
    });

    it('should initialize all components during warmup', async () => {
      await hybridRetriever.warmup();
      
      const healthStatus = hybridRetriever.getHealthStatus();
      expect(healthStatus.components.bm25).toBe('healthy');
      // Vector component should be healthy if embeddings are enabled and cache is available
      expect(['healthy', 'degraded']).toContain(healthStatus.components.vector);
    });
  });

  describe('BM25-only retrieval (fallback)', () => {
    beforeEach(async () => {
      // Disable embeddings for BM25-only testing
      config.enableEmbeddings = false;
      hybridRetriever = new HybridRetriever(config, factbookService);
      await hybridRetriever.warmup();
    });

    it('should perform BM25-only retrieval when embeddings disabled', async () => {
      const result = await hybridRetriever.retrieve('snake story');
      
      expect(result.results).toHaveLength(1);
      expect(result.results[0].snippet.id).toBe('snippet1'); // cobra snippet
      expect(result.results[0].source).toBe('bm25');
      expect(result.metrics.methodsUsed).toContain('bm25');
      expect(result.metrics.methodsUsed).not.toContain('vector');
      expect(result.metrics.methodsUsed).not.toContain('fusion');
      expect(result.metrics.fallbackUsed).toBe(true);
    });

    it('should handle queries with no matches gracefully', async () => {
      const result = await hybridRetriever.retrieve('nonexistent topic');
      
      expect(result.results).toHaveLength(0);
      expect(result.metrics.methodsUsed).toContain('bm25');
      expect(result.metrics.fallbackUsed).toBe(true);
    });
  });

  describe('hybrid retrieval with fusion', () => {
    beforeEach(async () => {
      // Mock OpenAI API calls for embedding generation
      vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
        if (url.includes('openai.com/v1/embeddings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              data: [
                { embedding: [0.1, 0.2, 0.3, 0.4] } // Mock embedding
              ]
            })
          });
        }
        return Promise.reject(new Error('Unexpected fetch call'));
      }));

      await hybridRetriever.warmup();
    });

    it('should perform hybrid retrieval with fusion', async () => {
      const result = await hybridRetriever.retrieve('snake story');
      
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.metrics.methodsUsed).toContain('bm25');
      expect(result.metrics.methodsUsed).toContain('vector');
      expect(result.metrics.methodsUsed).toContain('fusion');
      expect(result.metrics.fallbackUsed).toBe(false);
      
      // Should find the cobra snippet
      const cobraResult = result.results.find(r => r.snippet.id === 'snippet1');
      expect(cobraResult).toBeDefined();
      expect(cobraResult?.source).toBe('both'); // Should be found by both methods
    });

    it('should include fusion metadata in results', async () => {
      const result = await hybridRetriever.retrieve('Tyler partner');
      
      expect(result.results.length).toBeGreaterThan(0);
      const firstResult = result.results[0];
      
      expect(firstResult.metadata).toBeDefined();
      expect(firstResult.metadata?.fusionScore).toBeDefined();
      expect(firstResult.metadata?.rank).toBeDefined();
      expect(typeof firstResult.metadata?.fusionScore).toBe('number');
      expect(typeof firstResult.metadata?.rank).toBe('number');
    });

    it('should handle vector retrieval failures gracefully', async () => {
      // Mock vector retrieval to fail
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('API Error')));

      const result = await hybridRetriever.retrieve('test query');
      
      // Should fallback to BM25-only
      expect(result.metrics.methodsUsed).toContain('bm25');
      expect(result.metrics.methodsUsed).not.toContain('vector');
      expect(result.metrics.warnings.length).toBeGreaterThan(0);
      expect(result.metrics.fallbackUsed).toBe(true);
    });

    it('should respect maxResults configuration', async () => {
      // Update config to limit results
      hybridRetriever.updateConfig({ maxResults: 2 });
      
      const result = await hybridRetriever.retrieve('pets animals');
      
      expect(result.results.length).toBeLessThanOrEqual(2);
    });

    it('should provide different results than BM25-only', async () => {
      // Get BM25-only results
      const bm25OnlyRetriever = new HybridRetriever(
        { ...config, enableEmbeddings: false },
        factbookService
      );
      await bm25OnlyRetriever.warmup();
      const bm25Result = await bm25OnlyRetriever.retrieve('music events');
      
      // Get hybrid results
      const hybridResult = await hybridRetriever.retrieve('music events');
      
      // Results should potentially be different due to semantic understanding
      // At minimum, the scoring should be different
      if (bm25Result.results.length > 0 && hybridResult.results.length > 0) {
        expect(hybridResult.results[0].score).not.toBe(bm25Result.results[0].score);
      }
    });
  });

  describe('configuration updates', () => {
    beforeEach(async () => {
      await hybridRetriever.warmup();
    });

    it('should update fusion weights at runtime', () => {
      const newWeights = { bm25Weight: 0.8, vectorWeight: 0.2 };
      hybridRetriever.updateConfig(newWeights);
      
      const updatedConfig = hybridRetriever.getConfig();
      expect(updatedConfig.bm25Weight).toBe(0.8);
      expect(updatedConfig.vectorWeight).toBe(0.2);
    });

    it('should update fusion K parameter', () => {
      hybridRetriever.updateConfig({ fusionK: 30 });
      
      const updatedConfig = hybridRetriever.getConfig();
      expect(updatedConfig.fusionK).toBe(30);
    });

    it('should maintain health status after config updates', () => {
      hybridRetriever.updateConfig({ maxResults: 5 });
      
      const healthStatus = hybridRetriever.getHealthStatus();
      expect(['healthy', 'degraded']).toContain(healthStatus.status);
    });
  });

  describe('performance and metrics', () => {
    beforeEach(async () => {
      await hybridRetriever.warmup();
    });

    it('should collect comprehensive metrics', async () => {
      const result = await hybridRetriever.retrieve('test query');
      
      expect(result.metrics.totalTimeMs).toBeGreaterThan(0);
      expect(result.metrics.bm25TimeMs).toBeGreaterThan(0);
      expect(result.metrics.methodsUsed.length).toBeGreaterThan(0);
      expect(typeof result.metrics.confidenceScore).toBe('number');
      expect(typeof result.metrics.resultCount).toBe('number');
    });

    it('should complete retrieval within reasonable time', async () => {
      const startTime = Date.now();
      await hybridRetriever.retrieve('quick test');
      const elapsedMs = Date.now() - startTime;
      
      // Should complete within 1 second for test data
      expect(elapsedMs).toBeLessThan(1000);
    });
  });
});