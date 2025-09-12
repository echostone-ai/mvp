// src/lib/services/__tests__/resultReranker.test.ts
// Unit tests for ResultReranker class

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import OpenAI from 'openai';
import { ResultReranker, RerankConfig, RerankRequest } from '../resultReranker';
import { RetrievalResult } from '../hybridRetrieval';
import { FactbookSnippet } from '../factbookService';

// Mock OpenAI
vi.mock('openai');

describe('ResultReranker', () => {
  let reranker: ResultReranker;
  let mockOpenAI: {
    chat: {
      completions: {
        create: Mock;
      };
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

  const mockCandidates: RetrievalResult[] = mockSnippets.map((snippet, index) => ({
    snippet,
    score: 0.8 - (index * 0.1), // Decreasing scores: 0.8, 0.7, 0.6
    source: 'bm25' as const,
    confidence: 0.7,
    metadata: {
      bm25Score: 0.8 - (index * 0.1),
      rank: index + 1
    }
  }));

  beforeEach(() => {
    // Set up environment variable
    process.env.OPENAI_API_KEY = 'test-api-key';

    // Create mock OpenAI instance
    mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn()
        }
      }
    };

    // Mock the OpenAI constructor
    (OpenAI as any).mockImplementation(() => mockOpenAI);

    // Create reranker with test config
    const config: Partial<RerankConfig> = {
      model: 'gpt-3.5-turbo',
      maxCandidates: 10,
      timeoutMs: 150,
      enableCache: true,
      temperature: 0.1
    };

    reranker = new ResultReranker(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const config = reranker.getConfig();
      expect(config.model).toBe('gpt-3.5-turbo');
      expect(config.maxCandidates).toBe(10);
      expect(config.timeoutMs).toBe(150);
      expect(config.enableCache).toBe(true);
      expect(config.temperature).toBe(0.1);
    });

    it('should throw error without OpenAI API key', () => {
      delete process.env.OPENAI_API_KEY;
      expect(() => new ResultReranker()).toThrow('OPENAI_API_KEY environment variable is required');
    });

    it('should accept custom config', () => {
      const customConfig: Partial<RerankConfig> = {
        model: 'gpt-4',
        maxCandidates: 5,
        timeoutMs: 200,
        enableCache: false
      };

      const customReranker = new ResultReranker(customConfig);
      const config = customReranker.getConfig();
      
      expect(config.model).toBe('gpt-4');
      expect(config.maxCandidates).toBe(5);
      expect(config.timeoutMs).toBe(200);
      expect(config.enableCache).toBe(false);
    });
  });

  describe('rerank', () => {
    it('should rerank candidates successfully', async () => {
      // Mock successful LLM response
      const mockResponse = JSON.stringify([
        { id: 'snippet1', relevanceScore: 0.95 },
        { id: 'snippet2', relevanceScore: 0.85 },
        { id: 'snippet3', relevanceScore: 0.75 }
      ]);

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }]
      });

      const request: RerankRequest = {
        query: 'snake story',
        candidates: mockCandidates,
        maxResults: 3
      };

      const results = await reranker.rerank(request);

      expect(results).toHaveLength(3);
      expect(results[0].snippet.id).toBe('snippet1');
      expect(results[0].score).toBe(0.95);
      expect(results[1].snippet.id).toBe('snippet2');
      expect(results[1].score).toBe(0.85);
      expect(results[2].snippet.id).toBe('snippet3');
      expect(results[2].score).toBe(0.75);

      // Check metadata preservation
      expect(results[0].metadata?.originalScore).toBe(0.8);
      expect(results[0].metadata?.rerankScore).toBe(0.95);
    });

    it('should limit candidates to maxCandidates', async () => {
      // Create reranker with maxCandidates = 2
      const limitedReranker = new ResultReranker({ maxCandidates: 2 });

      const mockResponse = JSON.stringify([
        { id: 'snippet1', relevanceScore: 0.95 },
        { id: 'snippet2', relevanceScore: 0.85 }
      ]);

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }]
      });

      const request: RerankRequest = {
        query: 'test query',
        candidates: mockCandidates, // 3 candidates
        maxResults: 3
      };

      await limitedReranker.rerank(request);

      // Should only call LLM with 2 candidates (limited by maxCandidates)
      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const prompt = callArgs.messages[0].content;
      
      // Count snippets in prompt (should be 2)
      const snippetMatches = prompt.match(/\d+\. ID:/g);
      expect(snippetMatches).toHaveLength(2);
    });

    it('should handle timeout gracefully', async () => {
      // Mock slow LLM response that will timeout
      mockOpenAI.chat.completions.create.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200)) // Longer than 150ms timeout
      );

      const request: RerankRequest = {
        query: 'test query',
        candidates: mockCandidates,
        maxResults: 3
      };

      const results = await reranker.rerank(request);

      // Should fallback to original fusion scores
      expect(results).toHaveLength(3);
      expect(results[0].score).toBeCloseTo(0.8, 5); // Original score
      expect(results[1].score).toBeCloseTo(0.7, 5);
      expect(results[2].score).toBeCloseTo(0.6, 5);

      const stats = reranker.getStats();
      expect(stats.timeouts).toBe(1);
      expect(stats.errors).toBe(1);
    });

    it('should handle LLM errors gracefully', async () => {
      // Mock LLM error
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const request: RerankRequest = {
        query: 'test query',
        candidates: mockCandidates,
        maxResults: 3
      };

      const results = await reranker.rerank(request);

      // Should fallback to original fusion scores
      expect(results).toHaveLength(3);
      expect(results[0].score).toBe(0.8);

      const stats = reranker.getStats();
      expect(stats.errors).toBe(1);
    });

    it('should handle empty candidates', async () => {
      const request: RerankRequest = {
        query: 'test query',
        candidates: [],
        maxResults: 3
      };

      const results = await reranker.rerank(request);
      expect(results).toHaveLength(0);
    });

    it('should respect maxResults parameter', async () => {
      const mockResponse = JSON.stringify([
        { id: 'snippet1', relevanceScore: 0.95 },
        { id: 'snippet2', relevanceScore: 0.85 },
        { id: 'snippet3', relevanceScore: 0.75 }
      ]);

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }]
      });

      const request: RerankRequest = {
        query: 'test query',
        candidates: mockCandidates,
        maxResults: 2 // Limit to 2 results
      };

      const results = await reranker.rerank(request);
      expect(results).toHaveLength(2);
    });
  });

  describe('caching', () => {
    it('should cache reranking results', async () => {
      const mockResponse = JSON.stringify([
        { id: 'snippet1', relevanceScore: 0.95 },
        { id: 'snippet2', relevanceScore: 0.85 },
        { id: 'snippet3', relevanceScore: 0.75 }
      ]);

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }]
      });

      const request: RerankRequest = {
        query: 'snake story',
        candidates: mockCandidates,
        maxResults: 3
      };

      // First call
      await reranker.rerank(request);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);

      // Second call with same query and candidates
      await reranker.rerank(request);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1); // No additional call

      const stats = reranker.getStats();
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheHitRate).toBe(0.5); // 1 hit out of 2 requests
    });

    it('should not use cache when disabled', async () => {
      const noCacheReranker = new ResultReranker({ enableCache: false });

      const mockResponse = JSON.stringify([
        { id: 'snippet1', relevanceScore: 0.95 }
      ]);

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }]
      });

      const request: RerankRequest = {
        query: 'test query',
        candidates: [mockCandidates[0]],
        maxResults: 1
      };

      // Two identical calls
      await noCacheReranker.rerank(request);
      await noCacheReranker.rerank(request);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
    });

    it('should clear cache', () => {
      reranker.clearCache();
      const cacheStats = reranker.getCacheStats();
      expect(cacheStats.size).toBe(0);
    });
  });

  describe('response parsing', () => {
    it('should parse valid JSON response', async () => {
      const mockResponse = JSON.stringify([
        { id: 'snippet1', relevanceScore: 0.95 },
        { id: 'snippet2', relevanceScore: 0.85 }
      ]);

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }]
      });

      const request: RerankRequest = {
        query: 'test query',
        candidates: mockCandidates.slice(0, 2),
        maxResults: 2
      };

      const results = await reranker.rerank(request);
      expect(results[0].score).toBe(0.95);
      expect(results[1].score).toBe(0.85);
    });

    it('should handle JSON with markdown formatting', async () => {
      const mockResponse = '```json\n' + JSON.stringify([
        { id: 'snippet1', relevanceScore: 0.95 }
      ]) + '\n```';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }]
      });

      const request: RerankRequest = {
        query: 'test query',
        candidates: [mockCandidates[0]],
        maxResults: 1
      };

      const results = await reranker.rerank(request);
      expect(results[0].score).toBe(0.95);
    });

    it('should clamp relevance scores to 0-1 range', async () => {
      const mockResponse = JSON.stringify([
        { id: 'snippet1', relevanceScore: 1.5 }, // Above 1
        { id: 'snippet2', relevanceScore: -0.2 } // Below 0
      ]);

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }]
      });

      const request: RerankRequest = {
        query: 'test query',
        candidates: mockCandidates.slice(0, 2),
        maxResults: 2
      };

      const results = await reranker.rerank(request);
      expect(results).toHaveLength(2);
      
      // Results are sorted by score, so 1.0 comes first, 0.0 comes second
      const snippet1Result = results.find(r => r.snippet.id === 'snippet1');
      const snippet2Result = results.find(r => r.snippet.id === 'snippet2');
      
      expect(snippet1Result?.score).toBe(1.0); // Clamped to 1.0
      expect(snippet2Result?.score).toBe(0.0); // Clamped to 0.0
    });

    it('should handle missing scores with fallback', async () => {
      const mockResponse = JSON.stringify([
        { id: 'snippet1', relevanceScore: 0.95 }
        // Missing snippet2
      ]);

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }]
      });

      const request: RerankRequest = {
        query: 'test query',
        candidates: mockCandidates.slice(0, 2),
        maxResults: 2
      };

      const results = await reranker.rerank(request);
      expect(results).toHaveLength(2);
      expect(results.find(r => r.snippet.id === 'snippet1')?.score).toBe(0.95);
      expect(results.find(r => r.snippet.id === 'snippet2')?.score).toBe(0.5); // Fallback
    });

    it('should handle invalid JSON with fallback scores', async () => {
      const mockResponse = 'Invalid JSON response';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }]
      });

      const request: RerankRequest = {
        query: 'test query',
        candidates: mockCandidates.slice(0, 2),
        maxResults: 2
      };

      const results = await reranker.rerank(request);
      expect(results).toHaveLength(2);
      expect(results[0].score).toBe(0.5); // Fallback score
      expect(results[1].score).toBe(0.5);
    });
  });

  describe('statistics', () => {
    it('should track performance statistics', async () => {
      const mockResponse = JSON.stringify([
        { id: 'snippet1', relevanceScore: 0.95 }
      ]);

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }]
      });

      const request: RerankRequest = {
        query: 'test query',
        candidates: [mockCandidates[0]],
        maxResults: 1
      };

      await reranker.rerank(request);

      const stats = reranker.getStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.errors).toBe(0);
      expect(stats.timeouts).toBe(0);
      expect(stats.averageLatencyMs).toBeGreaterThanOrEqual(0); // Can be 0 in tests due to fast mocks
    });

    it('should track cache statistics', async () => {
      const mockResponse = JSON.stringify([
        { id: 'snippet1', relevanceScore: 0.95 }
      ]);

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }]
      });

      const request: RerankRequest = {
        query: 'test query',
        candidates: [mockCandidates[0]],
        maxResults: 1
      };

      // First call
      await reranker.rerank(request);
      
      // Second call (cache hit)
      await reranker.rerank(request);

      const cacheStats = reranker.getCacheStats();
      expect(cacheStats.size).toBe(1);
      expect(cacheStats.hitRate).toBe(0.5);
    });
  });

  describe('configuration', () => {
    it('should update configuration at runtime', () => {
      const newConfig = {
        maxCandidates: 5,
        timeoutMs: 200
      };

      reranker.updateConfig(newConfig);
      const config = reranker.getConfig();
      
      expect(config.maxCandidates).toBe(5);
      expect(config.timeoutMs).toBe(200);
      expect(config.model).toBe('gpt-3.5-turbo'); // Unchanged
    });
  });

  describe('prompt building', () => {
    it('should build proper reranking prompt', async () => {
      const mockResponse = JSON.stringify([
        { id: 'snippet1', relevanceScore: 0.95 }
      ]);

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }]
      });

      const request: RerankRequest = {
        query: 'snake story',
        candidates: [mockCandidates[0]],
        maxResults: 1
      };

      await reranker.rerank(request);

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const prompt = callArgs.messages[0].content;

      expect(prompt).toContain('snake story');
      expect(prompt).toContain('snippet1');
      expect(prompt).toContain('snakes and cobras');
      expect(prompt).toContain('JSON array');
      expect(prompt).toContain('relevanceScore');
    });

    it('should truncate long snippet text', async () => {
      const longSnippet: FactbookSnippet = {
        id: 'long_snippet',
        path: 'test/long',
        text: 'A'.repeat(300), // 300 characters
        topics: ['test'],
        keywords: ['long']
      };

      const longCandidate: RetrievalResult = {
        snippet: longSnippet,
        score: 0.8,
        source: 'bm25',
        confidence: 0.7
      };

      const mockResponse = JSON.stringify([
        { id: 'long_snippet', relevanceScore: 0.95 }
      ]);

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }]
      });

      const request: RerankRequest = {
        query: 'test query',
        candidates: [longCandidate],
        maxResults: 1
      };

      await reranker.rerank(request);

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const prompt = callArgs.messages[0].content;

      // Should be truncated to 200 chars + "..."
      expect(prompt).toContain('A'.repeat(200) + '...');
    });
  });
});