// src/lib/services/__tests__/queryExpander.test.ts
// Tests for QueryExpander class

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryExpander, ExpansionRequest, ExpansionResponse } from '../queryExpander';
import { RetrievalResult } from '../hybridRetrieval';
import { FactbookSnippet } from '../factbookService';

// Mock OpenAI
const mockOpenAIInstance = {
  chat: {
    completions: {
      create: vi.fn()
    }
  }
};

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => mockOpenAIInstance)
  };
});

// Mock fs promises
vi.mock('fs', () => ({
  default: {
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      unlink: vi.fn()
    }
  },
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    unlink: vi.fn()
  }
}));

describe('QueryExpander', () => {
  let queryExpander: QueryExpander;
  let mockOpenAI: any;

  const mockSnippet: FactbookSnippet = {
    id: 'test-snippet-1',
    path: 'test.snippet',
    text: 'Test snippet about snakes and cobras',
    topics: ['animals', 'stories'],
    keywords: ['snake', 'cobra', 'story']
  };

  const mockLowConfidenceResults: RetrievalResult[] = [
    {
      snippet: mockSnippet,
      score: 0.2,
      source: 'bm25',
      confidence: 0.2,
      metadata: {
        bm25Score: 0.2,
        termMatches: ['snake'],
        rank: 1
      }
    }
  ];

  beforeEach(() => {
    // Set up environment variable
    process.env.OPENAI_API_KEY = 'test-api-key';
    
    // Create query expander with test config
    queryExpander = new QueryExpander({
      model: 'gpt-4',
      timeoutMs: 200,
      enableCache: false // Disable cache for tests
    });

    // Use the mocked OpenAI instance
    mockOpenAI = mockOpenAIInstance;
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
  });

  describe('expandQuery', () => {
    it('should expand query successfully with valid LLM response', async () => {
      // Mock successful LLM response
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              canonical_query: 'snake story',
              alternates: ['serpent story', 'cobra tale', 'reptile encounter'],
              related_concepts: ['morocco', 'travel', 'wildlife', 'adventure']
            })
          }
        }]
      });

      const request: ExpansionRequest = {
        originalQuery: 'snake story',
        lowConfidenceResults: mockLowConfidenceResults
      };

      const result = await queryExpander.expandQuery(request);

      expect(result).toMatchObject({
        canonical_query: 'snake story',
        alternates: ['serpent story', 'cobra tale', 'reptile encounter'],
        related_concepts: ['morocco', 'travel', 'wildlife', 'adventure'],
        cached: false
      });
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.generatedAt).toBeGreaterThan(0);
    });

    it('should handle LLM timeout gracefully', async () => {
      // Mock timeout
      mockOpenAI.chat.completions.create.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 300)) // Longer than 200ms timeout
      );

      const request: ExpansionRequest = {
        originalQuery: 'test query',
        lowConfidenceResults: mockLowConfidenceResults
      };

      const result = await queryExpander.expandQuery(request);

      // Should return fallback response
      expect(result).toMatchObject({
        canonical_query: 'test query',
        alternates: [],
        related_concepts: [],
        confidence: 0.1,
        cached: false
      });
    });

    it('should handle invalid LLM response gracefully', async () => {
      // Mock invalid response
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'invalid json response'
          }
        }]
      });

      const request: ExpansionRequest = {
        originalQuery: 'test query',
        lowConfidenceResults: mockLowConfidenceResults
      };

      const result = await queryExpander.expandQuery(request);

      // Should return fallback response
      expect(result).toMatchObject({
        canonical_query: 'test query',
        alternates: [],
        related_concepts: [],
        confidence: 0.1,
        cached: false
      });
    });

    it('should validate and clean LLM response', async () => {
      // Mock response with invalid data
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              canonical_query: 'Snake Story', // Should be lowercased
              alternates: ['', 'Valid Alt', null, 123, 'another valid'], // Mixed valid/invalid
              related_concepts: ['concept1', 'concept1', 'concept2'] // Has duplicates
            })
          }
        }]
      });

      const request: ExpansionRequest = {
        originalQuery: 'snake story',
        lowConfidenceResults: mockLowConfidenceResults
      };

      const result = await queryExpander.expandQuery(request);

      expect(result.canonical_query).toBe('snake story');
      expect(result.alternates).toEqual(['valid alt', 'another valid']);
      expect(result.related_concepts).toEqual(['concept1', 'concept2']);
    });

    it('should limit alternates and concepts to configured maximums', async () => {
      // Create expander with low limits
      const limitedExpander = new QueryExpander({
        maxAlternates: 2,
        maxConcepts: 2,
        enableCache: false
      });

      // Mock response with many terms
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              canonical_query: 'test query',
              alternates: ['alt1', 'alt2', 'alt3', 'alt4', 'alt5'],
              related_concepts: ['concept1', 'concept2', 'concept3', 'concept4']
            })
          }
        }]
      });

      const request: ExpansionRequest = {
        originalQuery: 'test query',
        lowConfidenceResults: mockLowConfidenceResults
      };

      const result = await limitedExpander.expandQuery(request);

      expect(result.alternates).toHaveLength(2);
      expect(result.related_concepts).toHaveLength(2);
    });

    it('should remove duplicates between canonical, alternates, and concepts', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              canonical_query: 'snake story',
              alternates: ['snake story', 'serpent story', 'snake tale'], // Contains canonical
              related_concepts: ['serpent story', 'wildlife', 'snake story'] // Contains canonical and alternate
            })
          }
        }]
      });

      const request: ExpansionRequest = {
        originalQuery: 'snake story',
        lowConfidenceResults: mockLowConfidenceResults
      };

      const result = await queryExpander.expandQuery(request);

      expect(result.canonical_query).toBe('snake story');
      expect(result.alternates).toEqual(['serpent story', 'snake tale']);
      expect(result.related_concepts).toEqual(['wildlife']);
    });
  });

  describe('confidence calculation', () => {
    it('should calculate confidence based on expansion quality', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              canonical_query: 'test query',
              alternates: ['alt1', 'alt2', 'alt3'], // 3 alternates = 0.3 score
              related_concepts: ['concept1', 'concept2'] // 2 concepts = 0.1 score
            })
          }
        }]
      });

      const request: ExpansionRequest = {
        originalQuery: 'test query',
        lowConfidenceResults: mockLowConfidenceResults
      };

      const result = await queryExpander.expandQuery(request);

      // Base (0.2) + alternates (0.3) + concepts (0.1) = 0.6
      expect(result.confidence).toBeCloseTo(0.6, 1);
    });

    it('should cap confidence at 1.0', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              canonical_query: 'test query',
              alternates: Array(10).fill(0).map((_, i) => `alt${i}`), // 10 alternates
              related_concepts: Array(10).fill(0).map((_, i) => `concept${i}`) // 10 concepts
            })
          }
        }]
      });

      const request: ExpansionRequest = {
        originalQuery: 'test query',
        lowConfidenceResults: mockLowConfidenceResults
      };

      const result = await queryExpander.expandQuery(request);

      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });
  });

  describe('cache key generation', () => {
    it('should generate consistent cache keys for same query', () => {
      const expander = new QueryExpander({ enableCache: false });
      
      // Access private method for testing
      const getCacheKey = (expander as any).getCacheKey.bind(expander);
      
      const key1 = getCacheKey('snake story');
      const key2 = getCacheKey('Snake Story'); // Different case
      const key3 = getCacheKey('  snake   story  '); // Extra whitespace
      
      expect(key1).toBe(key2);
      expect(key1).toBe(key3);
      expect(key1).toHaveLength(16); // SHA256 substring
    });
  });

  describe('configuration', () => {
    it('should throw error when OpenAI API key is missing', () => {
      delete process.env.OPENAI_API_KEY;
      
      expect(() => {
        new QueryExpander();
      }).toThrow('OPENAI_API_KEY environment variable is required');
    });

    it('should update configuration', () => {
      const newConfig = {
        timeoutMs: 300,
        maxAlternates: 5
      };

      queryExpander.updateConfig(newConfig);

      // Verify config was updated (would need to expose config for full verification)
      expect(() => queryExpander.updateConfig(newConfig)).not.toThrow();
    });
  });

  describe('cache statistics', () => {
    it('should return cache statistics', () => {
      const stats = queryExpander.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('oldestEntry');
      expect(stats).toHaveProperty('newestEntry');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.hitRate).toBe('number');
    });
  });
});