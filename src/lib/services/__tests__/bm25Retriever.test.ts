// src/lib/services/__tests__/bm25Retriever.test.ts
// Unit tests for BM25 text retrieval component

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BM25Retriever, BM25Config, BM25Result, BM25Index } from '../bm25Retriever';
import { FactbookService, FactbookSnippet } from '../factbookService';

describe('BM25Retriever', () => {
  let bm25Retriever: BM25Retriever;
  let mockFactbookService: FactbookService;
  let config: BM25Config;

  const mockFactbookData = {
    pets: {
      olive: {
        id: 'pets.olive',
        text: 'Olive is a Puerto Rican street dog who loves adventures and treats. She is very energetic and playful.',
        topics: ['pets', 'dogs', 'olive'],
        keywords: ['olive', 'puerto', 'rican', 'street', 'dog', 'adventures', 'treats', 'energetic', 'playful']
      },
      romeo: {
        id: 'pets.romeo',
        text: 'Romeo is a playful cat who enjoys sunny windowsills and afternoon naps.',
        topics: ['pets', 'cats', 'romeo'],
        keywords: ['romeo', 'cat', 'playful', 'sunny', 'windowsills', 'afternoon', 'naps']
      }
    },
    places: {
      morocco: {
        id: 'places.morocco',
        text: 'In Morocco, I encountered a cobra during a desert expedition. The snake was coiled near an oasis.',
        topics: ['places', 'morocco', 'travel'],
        keywords: ['morocco', 'cobra', 'desert', 'expedition', 'snake', 'coiled', 'oasis']
      },
      austin: {
        id: 'places.austin',
        text: 'Austin, Texas is my home base. The city has great music venues and food trucks.',
        topics: ['places', 'austin', 'texas'],
        keywords: ['austin', 'texas', 'home', 'base', 'city', 'music', 'venues', 'food', 'trucks']
      }
    },
    people: {
      tyler: {
        id: 'people.tyler',
        text: 'Tyler is my brother who lives in Maine. He works in software development.',
        topics: ['people', 'relationships', 'tyler'],
        keywords: ['tyler', 'brother', 'maine', 'software', 'development']
      }
    }
  };

  beforeEach(async () => {
    // Create default BM25 config
    config = {
      k1: 1.2,
      b: 0.75,
      maxResults: 20
    };

    // Create mock factbook service
    mockFactbookService = FactbookService.getInstance();
    await mockFactbookService.loadFactbook(mockFactbookData);

    // Create BM25 retriever
    bm25Retriever = new BM25Retriever(mockFactbookService, config);
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with provided config and factbook service', () => {
      const customConfig: BM25Config = {
        k1: 1.5,
        b: 0.8,
        maxResults: 10
      };

      const retriever = new BM25Retriever(mockFactbookService, customConfig);
      
      expect(retriever.getConfig()).toEqual(customConfig);
      expect(retriever.isReady()).toBe(false); // Index not built yet
    });

    it('should allow config updates at runtime', () => {
      const updates = {
        k1: 1.5,
        maxResults: 15
      };

      bm25Retriever.updateConfig(updates);
      const updatedConfig = bm25Retriever.getConfig();

      expect(updatedConfig.k1).toBe(1.5);
      expect(updatedConfig.maxResults).toBe(15);
      expect(updatedConfig.b).toBe(0.75); // Unchanged
    });

    it('should provide index statistics', () => {
      const stats = bm25Retriever.getIndexStats();
      
      expect(stats.isBuilt).toBe(false);
      expect(stats.totalDocs).toBe(0);
      expect(stats.uniqueTerms).toBe(0);
      expect(stats.avgDocLength).toBe(0);
    });
  });

  describe('Index Building', () => {
    it('should build index successfully from factbook snippets', async () => {
      await bm25Retriever.buildIndex();
      
      expect(bm25Retriever.isReady()).toBe(true);
      
      const stats = bm25Retriever.getIndexStats();
      expect(stats.isBuilt).toBe(true);
      expect(stats.totalDocs).toBe(5); // 5 snippets in mock data
      expect(stats.uniqueTerms).toBeGreaterThan(0);
      expect(stats.avgDocLength).toBeGreaterThan(0);
    });

    it('should fail to build index when factbook service is not loaded', async () => {
      const unloadedFactbookService = {
        ...mockFactbookService,
        isLoaded: vi.fn().mockReturnValue(false)
      } as any;

      const retriever = new BM25Retriever(unloadedFactbookService, config);
      
      await expect(retriever.buildIndex()).rejects.toThrow('FactbookService not loaded');
    });

    it('should fail to build index when no snippets are available', async () => {
      const emptyFactbookService = {
        ...mockFactbookService,
        isLoaded: vi.fn().mockReturnValue(true),
        getAllSnippets: vi.fn().mockReturnValue([])
      } as any;

      const retriever = new BM25Retriever(emptyFactbookService, config);
      
      await expect(retriever.buildIndex()).rejects.toThrow('No snippets available');
    });

    it('should log performance warnings for slow index building', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Mock slow index building by adding delay
      const originalGetAllSnippets = mockFactbookService.getAllSnippets;
      mockFactbookService.getAllSnippets = vi.fn().mockImplementation(() => {
        // Simulate slow operation
        const start = Date.now();
        while (Date.now() - start < 150) {
          // Busy wait to simulate slow operation
        }
        return originalGetAllSnippets.call(mockFactbookService);
      });

      await bm25Retriever.buildIndex();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'bm25_index_build_slow',
        expect.objectContaining({
          elapsed_ms: expect.any(Number),
          target_ms: 100
        })
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('BM25 Scoring Algorithm', () => {
    beforeEach(async () => {
      await bm25Retriever.buildIndex();
    });

    it('should calculate correct BM25 scores for exact term matches', () => {
      const results = bm25Retriever.search('olive');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].snippet.id).toBe('pets.olive');
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].termMatches).toContain('olive');
    });

    it('should handle multi-term queries with proper scoring', () => {
      const results = bm25Retriever.search('olive dog adventures');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].snippet.id).toBe('pets.olive');
      expect(results[0].termMatches.length).toBeGreaterThan(1);
      expect(results[0].termMatches).toContain('olive');
      expect(results[0].termMatches).toContain('dog');
      expect(results[0].termMatches).toContain('adventures');
    });

    it('should rank results by BM25 score correctly', () => {
      const results = bm25Retriever.search('playful');
      
      expect(results.length).toBe(2); // Both olive and romeo have 'playful'
      
      // Scores should be in descending order
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should apply deterministic tie-breaking for equal scores', () => {
      // Create a query that might produce tied scores
      const results = bm25Retriever.search('pets');
      
      expect(results.length).toBeGreaterThan(1);
      
      // Check that results with equal scores are ordered deterministically
      for (let i = 1; i < results.length; i++) {
        if (results[i - 1].score === results[i].score) {
          // Should be ordered by text length, then by ID
          if (results[i - 1].snippet.text.length === results[i].snippet.text.length) {
            expect(results[i - 1].snippet.id.localeCompare(results[i].snippet.id)).toBeLessThan(0);
          } else {
            expect(results[i - 1].snippet.text.length).toBeLessThan(results[i].snippet.text.length);
          }
        }
      }
    });

    it('should handle queries with no matches gracefully', () => {
      const results = bm25Retriever.search('nonexistent term');
      
      expect(results).toEqual([]);
    });

    it('should handle empty queries gracefully', () => {
      const results = bm25Retriever.search('');
      
      expect(results).toEqual([]);
    });

    it('should handle queries with only stop words', () => {
      const results = bm25Retriever.search('the and or but');
      
      expect(results).toEqual([]);
    });

    it('should respect maxResults parameter', () => {
      const results = bm25Retriever.search('pets', 1);
      
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('should use config maxResults when no parameter provided', () => {
      const customConfig = { ...config, maxResults: 2 };
      const retriever = new BM25Retriever(mockFactbookService, customConfig);
      
      // Need to build index for new retriever
      return retriever.buildIndex().then(() => {
        const results = retriever.search('pets');
        expect(results.length).toBeLessThanOrEqual(2);
      });
    });
  });

  describe('Term Extraction and Processing', () => {
    beforeEach(async () => {
      await bm25Retriever.buildIndex();
    });

    it('should extract terms from text content', () => {
      const results = bm25Retriever.search('puerto rican street');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].snippet.id).toBe('pets.olive');
    });

    it('should extract terms from keywords with higher weight', () => {
      const results = bm25Retriever.search('cobra');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].snippet.id).toBe('places.morocco');
      expect(results[0].termMatches).toContain('cobra');
    });

    it('should extract terms from topics', () => {
      const results = bm25Retriever.search('relationships');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].snippet.id).toBe('people.tyler');
    });

    it('should normalize terms correctly', () => {
      // Test with accented characters and mixed case
      const results = bm25Retriever.search('OLIVÉ');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].snippet.id).toBe('pets.olive');
    });

    it('should filter stop words', () => {
      // Query with stop words should still find relevant results
      const results = bm25Retriever.search('the olive and the dog');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].snippet.id).toBe('pets.olive');
      expect(results[0].termMatches).toContain('olive');
      expect(results[0].termMatches).toContain('dog');
      expect(results[0].termMatches).not.toContain('the');
      expect(results[0].termMatches).not.toContain('and');
    });

    it('should filter short terms', () => {
      const results = bm25Retriever.search('a is to olive');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].snippet.id).toBe('pets.olive');
      expect(results[0].termMatches).toContain('olive');
      expect(results[0].termMatches).not.toContain('a');
      expect(results[0].termMatches).not.toContain('is');
      expect(results[0].termMatches).not.toContain('to');
    });

    it('should limit query terms to prevent excessive processing', () => {
      // Create a very long query
      const longQuery = Array(30).fill('olive').join(' ');
      const results = bm25Retriever.search(longQuery);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].snippet.id).toBe('pets.olive');
    });
  });

  describe('Performance Requirements', () => {
    beforeEach(async () => {
      await bm25Retriever.buildIndex();
    });

    it('should complete typical queries within reasonable time', async () => {
      const queries = [
        'olive dog',
        'morocco cobra',
        'tyler brother',
        'austin texas',
        'playful cat'
      ];

      for (const query of queries) {
        const startTime = Date.now();
        const results = bm25Retriever.search(query);
        const elapsedMs = Date.now() - startTime;

        // Allow more time in test environment, but still reasonable
        expect(elapsedMs).toBeLessThan(500);
        expect(results).toBeDefined();
      }
    });

    it('should log performance warnings for slow searches', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Mock slow search by overriding getAllSnippets to add delay
      const originalGetAllSnippets = mockFactbookService.getAllSnippets;
      mockFactbookService.getAllSnippets = vi.fn().mockImplementation(() => {
        const start = Date.now();
        while (Date.now() - start < 60) {
          // Busy wait to simulate slow operation
        }
        return originalGetAllSnippets.call(mockFactbookService);
      });

      bm25Retriever.search('olive');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'bm25_search_slow',
        expect.objectContaining({
          elapsed_ms: expect.any(Number),
          target_ms: 50
        })
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle large result sets efficiently', () => {
      // Search for a common term that appears in multiple documents
      const startTime = Date.now();
      const results = bm25Retriever.search('pets');
      const elapsedMs = Date.now() - startTime;

      // Allow more time in test environment, but still reasonable
      expect(elapsedMs).toBeLessThan(500);
      expect(results.length).toBeGreaterThan(1);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when searching without built index', () => {
      const retriever = new BM25Retriever(mockFactbookService, config);
      
      expect(() => retriever.search('test')).toThrow('BM25 index not built');
    });

    it('should handle malformed snippets gracefully', async () => {
      // Mock factbook service with malformed snippet
      const malformedFactbookService = {
        isLoaded: vi.fn().mockReturnValue(true),
        getAllSnippets: vi.fn().mockReturnValue([
          {
            id: 'malformed.snippet',
            text: null, // Malformed text
            topics: ['test'],
            keywords: ['test']
          }
        ])
      } as any;

      const retriever = new BM25Retriever(malformedFactbookService, config);
      
      // Should not throw during index building
      await expect(retriever.buildIndex()).resolves.not.toThrow();
      
      // Should handle search gracefully
      const results = retriever.search('test');
      expect(results).toBeDefined();
    });
  });

  describe('Logging and Monitoring', () => {
    beforeEach(async () => {
      await bm25Retriever.buildIndex();
    });

    it('should log index building operations', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const retriever = new BM25Retriever(mockFactbookService, config);
      await retriever.buildIndex();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'bm25_index_build_start',
        expect.objectContaining({
          snippet_count: expect.any(Number),
          config: expect.any(Object)
        })
      );
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'bm25_index_build_complete',
        expect.objectContaining({
          snippet_count: expect.any(Number),
          unique_terms: expect.any(Number),
          avg_doc_length: expect.any(String),
          build_time_ms: expect.any(Number)
        })
      );
      
      consoleSpy.mockRestore();
    });

    it('should log search operations with detailed metrics', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const results = bm25Retriever.search('olive dog');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'bm25_search_start',
        expect.objectContaining({
          query: 'olive dog',
          query_terms: expect.any(Array),
          max_results: expect.any(Number)
        })
      );
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'bm25_search_complete',
        expect.objectContaining({
          query: 'olive dog',
          query_terms: expect.any(Array),
          result_count: expect.any(Number),
          top_scores: expect.any(Array),
          search_time_ms: expect.any(Number)
        })
      );
      
      consoleSpy.mockRestore();
    });

    it('should include term matches in search results', () => {
      const results = bm25Retriever.search('olive adventures');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].termMatches).toBeDefined();
      expect(Array.isArray(results[0].termMatches)).toBe(true);
      expect(results[0].termMatches.length).toBeGreaterThan(0);
    });

    it('should provide detailed top scores in logs', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      bm25Retriever.search('pets');
      
      const searchCompleteCall = consoleSpy.mock.calls.find(
        call => call[0] === 'bm25_search_complete'
      );
      
      expect(searchCompleteCall).toBeDefined();
      expect(searchCompleteCall![1]).toHaveProperty('top_scores');
      expect(Array.isArray(searchCompleteCall![1].top_scores)).toBe(true);
      
      if (searchCompleteCall![1].top_scores.length > 0) {
        const topScore = searchCompleteCall![1].top_scores[0];
        expect(topScore).toHaveProperty('id');
        expect(topScore).toHaveProperty('score');
        expect(topScore).toHaveProperty('term_matches');
      }
      
      consoleSpy.mockRestore();
    });
  });

  describe('Integration with FactbookService', () => {
    beforeEach(async () => {
      await bm25Retriever.buildIndex();
    });

    it('should work with real factbook data structure', () => {
      const results = bm25Retriever.search('snake story');
      
      // Should find Morocco cobra story through semantic connection
      expect(results.length).toBeGreaterThan(0);
      const moroccoResult = results.find(r => r.snippet.id === 'places.morocco');
      expect(moroccoResult).toBeDefined();
      expect(moroccoResult!.termMatches).toContain('snake');
    });

    it('should handle factbook topic and keyword structure', () => {
      const results = bm25Retriever.search('relationships');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].snippet.topics).toContain('relationships');
    });

    it('should preserve factbook snippet structure in results', () => {
      const results = bm25Retriever.search('olive');
      
      expect(results.length).toBeGreaterThan(0);
      const result = results[0];
      
      expect(result.snippet).toHaveProperty('id');
      expect(result.snippet).toHaveProperty('text');
      expect(result.snippet).toHaveProperty('topics');
      expect(result.snippet).toHaveProperty('keywords');
      expect(Array.isArray(result.snippet.topics)).toBe(true);
      expect(Array.isArray(result.snippet.keywords)).toBe(true);
    });
  });
});