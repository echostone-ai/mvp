// src/lib/services/__tests__/hybridRetrieval.reranking.test.ts
// Integration tests for HybridRetriever with reranking

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import OpenAI from 'openai';
import { HybridRetriever, parseHybridRetrievalConfig } from '../hybridRetrieval';
import { FactbookService, FactbookSnippet } from '../factbookService';
import { EmbeddingCache } from '../embeddingCache';
import { ResultReranker, RerankRequest } from '../resultReranker';

// Mock OpenAI
vi.mock('openai');

describe('HybridRetriever with Reranking', () => {
  let hybridRetriever: HybridRetriever;
  let mockFactbookService: FactbookService;
  let mockEmbeddingCache: EmbeddingCache;
  let mockOpenAI: {
    chat: {
      completions: {
        create: Mock;
      };
    };
    embeddings: {
      create: Mock;
    };
  };

  const mockSnippets: FactbookSnippet[] = [
    {
      id: 'snippet1',
      path: 'test/snippet1',
      text: 'This is about snakes and cobras in Morocco',
      topics: ['travel', 'animals'],
      keywords: ['snake', 'cobra', 'morocco']
    },
    {
      id: 'snippet2',
      path: 'test/snippet2', 
      text: 'Concert experience at SXSW with Bill Murray',
      topics: ['music', 'events'],
      keywords: ['sxsw', 'concert', 'bill murray']
    },
    {
      id: 'snippet3',
      path: 'test/snippet3',
      text: 'Tyler and Cansu relationship details',
      topics: ['relationships'],
      keywords: ['tyler', 'cansu', 'relationship']
    }
  ];

  beforeEach(() => {
    // Set up environment variables
    process.env.OPENAI_API_KEY = 'test-api-key';
    process.env.RETRIEVAL_RERANK = 'on';
    process.env.RETRIEVAL_EMBEDDINGS = 'off'; // Disable embeddings for simpler testing
    process.env.RETRIEVAL_EXPANSION = 'off'; // Disable expansion for simpler testing

    // Create mock OpenAI instance
    mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn()
        }
      },
      embeddings: {
        create: vi.fn()
      }
    };

    // Mock the OpenAI constructor
    (OpenAI as any).mockImplementation(() => mockOpenAI);

    // Mock FactbookService
    mockFactbookService = {
      isLoaded: vi.fn().mockReturnValue(true),
      validateIndex: vi.fn().mockReturnValue(true),
      getAllSnippets: vi.fn().mockReturnValue(mockSnippets),
      getSnippetCount: vi.fn().mockReturnValue(mockSnippets.length),
      retrieve: vi.fn().mockReturnValue([])
    } as any;

    // Mock EmbeddingCache
    mockEmbeddingCache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      getStats: vi.fn().mockReturnValue({ size: 0, hitRate: 0 })
    } as any;

    // Create hybrid retriever with reranking enabled
    const config = parseHybridRetrievalConfig();
    hybridRetriever = new HybridRetriever(config, mockFactbookService, mockEmbeddingCache);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
    delete process.env.RETRIEVAL_RERANK;
    delete process.env.RETRIEVAL_EMBEDDINGS;
    delete process.env.RETRIEVAL_EXPANSION;
  });

  describe('reranking integration', () => {
    it('should apply reranking when enabled and improve result ordering', async () => {
      // Mock reranking response that reorders results
      const mockRerankResponse = JSON.stringify([
        { id: 'snippet3', relevanceScore: 0.95 }, // Tyler/Cansu becomes most relevant
        { id: 'snippet1', relevanceScore: 0.85 }, // Snake story second
        { id: 'snippet2', relevanceScore: 0.75 }  // SXSW third
      ]);

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: mockRerankResponse } }]
      });

      // Warmup the retriever
      await hybridRetriever.warmup();

      // Perform retrieval with a query that matches all snippets
      const { results, metrics } = await hybridRetriever.retrieve('snake concert tyler');

      // Should have applied reranking
      expect(metrics.rerankingApplied).toBe(true);
      expect(metrics.methodsUsed).toContain('reranking');
      expect(metrics.rerankTimeMs).toBeGreaterThanOrEqual(0);

      // Results should be reordered by reranking scores
      expect(results).toHaveLength(3);
      expect(results[0].snippet.id).toBe('snippet3'); // Tyler/Cansu most relevant
      expect(results[0].score).toBe(0.95);
      expect(results[1].snippet.id).toBe('snippet1'); // Snake story second
      expect(results[1].score).toBe(0.85);
      expect(results[2].snippet.id).toBe('snippet2'); // SXSW third
      expect(results[2].score).toBe(0.75);

      // Should preserve original scores in metadata
      expect(results[0].metadata?.originalScore).toBeDefined();
      expect(results[0].metadata?.rerankScore).toBe(0.95);
    });

    it('should fallback gracefully when reranking fails', async () => {
      // Mock reranking failure
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('Reranking API Error'));

      // Warmup the retriever
      await hybridRetriever.warmup();

      // Perform retrieval with a query that matches snippets
      const { results, metrics } = await hybridRetriever.retrieve('snake concert tyler');

      // Should have attempted reranking but fallen back
      expect(metrics.rerankingApplied).toBe(false);
      expect(metrics.warnings).toContain('Result reranking failed but fallback results were used');
      expect(metrics.methodsUsed).not.toContain('reranking');

      // Should still return BM25 results
      expect(results.length).toBeGreaterThan(0);
    });

    it('should skip reranking when disabled', async () => {
      // Create retriever with reranking disabled
      process.env.RETRIEVAL_RERANK = 'off';
      const config = parseHybridRetrievalConfig();
      const noRerankRetriever = new HybridRetriever(config, mockFactbookService, mockEmbeddingCache);

      // Warmup the retriever
      await noRerankRetriever.warmup();

      // Perform retrieval with a query that matches snippets
      const { results, metrics } = await noRerankRetriever.retrieve('snake concert tyler');

      // Should not have applied reranking
      expect(metrics.rerankingApplied).toBe(false);
      expect(metrics.methodsUsed).not.toContain('reranking');
      expect(metrics.rerankTimeMs).toBeUndefined();

      // Should not have called OpenAI for reranking
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });

    it('should handle reranking timeout gracefully', async () => {
      // Mock slow reranking response
      mockOpenAI.chat.completions.create.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200)) // Longer than 150ms timeout
      );

      // Warmup the retriever
      await hybridRetriever.warmup();

      // Perform retrieval with a query that matches snippets
      const { results, metrics } = await hybridRetriever.retrieve('snake concert tyler');

      // Should have attempted reranking but timed out
      expect(metrics.rerankingApplied).toBe(false);
      expect(metrics.warnings.some(w => w.includes('reranking failed'))).toBe(true);

      // Should still return results
      expect(results.length).toBeGreaterThan(0);
    });

    it('should limit candidates to maxCandidates for cost control', async () => {
      // Create a reranker with maxCandidates = 2 for easier testing
      const limitedReranker = new ResultReranker({ maxCandidates: 2 });

      // Create 5 mock candidates
      const manyCandidates: RetrievalResult[] = Array.from({ length: 5 }, (_, i) => ({
        snippet: {
          id: `snippet${i + 1}`,
          path: `test/snippet${i + 1}`,
          text: `Test snippet ${i + 1} content`,
          topics: ['test'],
          keywords: ['test']
        },
        score: 0.8 - (i * 0.1),
        source: 'bm25' as const,
        confidence: 0.7
      }));

      // Mock reranking response for only 2 candidates (maxCandidates)
      const mockRerankResponse = JSON.stringify([
        { id: 'snippet1', relevanceScore: 0.95 },
        { id: 'snippet2', relevanceScore: 0.85 }
      ]);

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: mockRerankResponse } }]
      });

      const request: RerankRequest = {
        query: 'test query',
        candidates: manyCandidates, // 5 candidates
        maxResults: 5
      };

      await limitedReranker.rerank(request);

      // Should only call LLM with 2 candidates (limited by maxCandidates)
      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const prompt = callArgs.messages[0].content;
      
      // Count snippets in prompt (should be 2)
      const snippetMatches = prompt.match(/\d+\. ID:/g);
      expect(snippetMatches).toHaveLength(2);
    });
  });

  describe('health status with reranking', () => {
    it('should report healthy reranking component when enabled and working', async () => {
      await hybridRetriever.warmup();
      
      const healthStatus = hybridRetriever.getHealthStatus();
      
      expect(healthStatus.components.reranking).toBe('healthy');
      expect(healthStatus.details.some(d => d.includes('Reranking: Ready'))).toBe(true);
    });

    it('should report degraded reranking component when disabled', async () => {
      process.env.RETRIEVAL_RERANK = 'off';
      const config = parseHybridRetrievalConfig();
      const noRerankRetriever = new HybridRetriever(config, mockFactbookService, mockEmbeddingCache);
      
      await noRerankRetriever.warmup();
      
      const healthStatus = noRerankRetriever.getHealthStatus();
      
      expect(healthStatus.components.reranking).toBe('degraded');
      expect(healthStatus.details.some(d => d.includes('Reranking: Disabled by configuration'))).toBe(true);
    });

    it('should report unhealthy reranking component when enabled but missing API key', async () => {
      delete process.env.OPENAI_API_KEY;
      
      const config = parseHybridRetrievalConfig();
      const brokenRetriever = new HybridRetriever(config, mockFactbookService, mockEmbeddingCache);
      
      await brokenRetriever.warmup();
      
      const healthStatus = brokenRetriever.getHealthStatus();
      
      expect(healthStatus.components.reranking).toBe('unhealthy');
      expect(healthStatus.details.some(d => d.includes('Reranking: Enabled but not initialized'))).toBe(true);
    });
  });
});