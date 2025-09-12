// src/lib/services/__tests__/resultFuser.test.ts
// Unit tests for ResultFuser class

import { describe, it, expect, beforeEach } from 'vitest';
import { ResultFuser, FusionConfig, FusedResult } from '../resultFuser';
import { BM25Result } from '../bm25Retriever';
import { VectorResult } from '../vectorRetriever';
import { FactbookSnippet } from '../factbookService';

describe('ResultFuser', () => {
  let fuser: ResultFuser;
  let defaultConfig: FusionConfig;

  // Test data
  const snippet1: FactbookSnippet = {
    id: 'snippet1',
    path: 'test/snippet1',
    text: 'This is the first test snippet about cats',
    topics: ['pets', 'animals'],
    keywords: ['cats', 'pets']
  };

  const snippet2: FactbookSnippet = {
    id: 'snippet2', 
    path: 'test/snippet2',
    text: 'This is the second test snippet about dogs',
    topics: ['pets', 'animals'],
    keywords: ['dogs', 'pets']
  };

  const snippet3: FactbookSnippet = {
    id: 'snippet3',
    path: 'test/snippet3', 
    text: 'This is the third test snippet about birds',
    topics: ['pets', 'animals'],
    keywords: ['birds', 'pets']
  };

  const snippet4: FactbookSnippet = {
    id: 'snippet4',
    path: 'test/snippet4',
    text: 'This is the fourth test snippet about fish',
    topics: ['pets', 'animals'],
    keywords: ['fish', 'pets']
  };

  beforeEach(() => {
    defaultConfig = {
      method: 'reciprocal_rank',
      k: 60,
      bm25Weight: 0.6,
      vectorWeight: 0.4
    };
    fuser = new ResultFuser(defaultConfig);
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      const config = fuser.getConfig();
      expect(config).toEqual(defaultConfig);
    });

    it('should validate weights on creation', () => {
      expect(fuser.validateWeights()).toBe(true);
    });
  });

  describe('reciprocal rank fusion', () => {
    it('should correctly implement RRF algorithm', () => {
      const bm25Results: BM25Result[] = [
        { snippet: snippet1, score: 2.5, termMatches: ['cats'] },
        { snippet: snippet2, score: 1.8, termMatches: ['dogs'] },
        { snippet: snippet3, score: 1.2, termMatches: ['birds'] }
      ];

      const vectorResults: VectorResult[] = [
        { snippet: snippet2, similarity: 0.9, embedding: [] },
        { snippet: snippet4, similarity: 0.7, embedding: [] },
        { snippet: snippet1, similarity: 0.6, embedding: [] }
      ];

      const results = fuser.fuse(bm25Results, vectorResults);

      // Verify RRF scores are calculated correctly
      // snippet1: 1/(60+1) + 1/(60+3) = 1/61 + 1/63 ≈ 0.0322
      // snippet2: 1/(60+2) + 1/(60+1) = 1/62 + 1/61 ≈ 0.0325
      // snippet3: 1/(60+3) = 1/63 ≈ 0.0159
      // snippet4: 1/(60+2) = 1/62 ≈ 0.0161

      expect(results).toHaveLength(4);
      expect(results[0].snippet.id).toBe('snippet2'); // Highest RRF score
      expect(results[0].source).toBe('both');
      expect(results[0].metadata.bm25Score).toBe(1.8);
      expect(results[0].metadata.vectorSimilarity).toBe(0.9);
    });

    it('should handle empty BM25 results', () => {
      const bm25Results: BM25Result[] = [];
      const vectorResults: VectorResult[] = [
        { snippet: snippet1, similarity: 0.8, embedding: [] }
      ];

      const results = fuser.fuse(bm25Results, vectorResults);

      expect(results).toHaveLength(1);
      expect(results[0].snippet.id).toBe('snippet1');
      expect(results[0].source).toBe('vector');
      expect(results[0].metadata.bm25Score).toBeUndefined();
      expect(results[0].metadata.vectorSimilarity).toBe(0.8);
    });

    it('should handle empty vector results', () => {
      const bm25Results: BM25Result[] = [
        { snippet: snippet1, score: 2.5, termMatches: ['cats'] }
      ];
      const vectorResults: VectorResult[] = [];

      const results = fuser.fuse(bm25Results, vectorResults);

      expect(results).toHaveLength(1);
      expect(results[0].snippet.id).toBe('snippet1');
      expect(results[0].source).toBe('bm25');
      expect(results[0].metadata.bm25Score).toBe(2.5);
      expect(results[0].metadata.vectorSimilarity).toBeUndefined();
    });

    it('should handle both empty result sets', () => {
      const results = fuser.fuse([], []);
      expect(results).toHaveLength(0);
    });

    it('should provide deterministic ranking with tie-breaking', () => {
      // Create results with identical RRF scores to test tie-breaking
      const bm25Results: BM25Result[] = [
        { snippet: snippet1, score: 1.0, termMatches: ['test'] },
        { snippet: snippet2, score: 1.0, termMatches: ['test'] }
      ];

      const vectorResults: VectorResult[] = [
        { snippet: snippet1, similarity: 0.5, embedding: [] },
        { snippet: snippet2, similarity: 0.5, embedding: [] }
      ];

      const results1 = fuser.fuse(bm25Results, vectorResults);
      const results2 = fuser.fuse(bm25Results, vectorResults);

      // Results should be identical across multiple runs
      expect(results1.map(r => r.snippet.id)).toEqual(results2.map(r => r.snippet.id));
      
      // Both should be marked as 'both' source
      expect(results1[0].source).toBe('both');
      expect(results1[1].source).toBe('both');
    });

    it('should correctly set metadata fields', () => {
      const bm25Results: BM25Result[] = [
        { snippet: snippet1, score: 2.5, termMatches: ['cats', 'pets'] }
      ];

      const vectorResults: VectorResult[] = [
        { snippet: snippet1, similarity: 0.8, embedding: [] }
      ];

      const results = fuser.fuse(bm25Results, vectorResults);

      expect(results).toHaveLength(1);
      const result = results[0];
      
      expect(result.metadata.bm25Score).toBe(2.5);
      expect(result.metadata.vectorSimilarity).toBe(0.8);
      expect(result.metadata.fusionScore).toBeGreaterThan(0);
      expect(result.metadata.rank).toBe(1);
      expect(result.metadata.termMatches).toEqual(['cats', 'pets']);
    });
  });

  describe('weighted sum fusion', () => {
    beforeEach(() => {
      fuser.updateConfig({ method: 'weighted_sum' });
    });

    it('should correctly implement weighted sum algorithm', () => {
      const bm25Results: BM25Result[] = [
        { snippet: snippet1, score: 3.0, termMatches: ['cats'] }, // Will be normalized to 1.0
        { snippet: snippet2, score: 1.0, termMatches: ['dogs'] }  // Will be normalized to 0.0
      ];

      const vectorResults: VectorResult[] = [
        { snippet: snippet1, similarity: 0.6, embedding: [] },
        { snippet: snippet2, similarity: 0.8, embedding: [] }
      ];

      const results = fuser.fuse(bm25Results, vectorResults);

      expect(results).toHaveLength(2);
      
      // snippet1: (1.0 * 0.6) + (0.6 * 0.4) = 0.6 + 0.24 = 0.84
      // snippet2: (0.0 * 0.6) + (0.8 * 0.4) = 0.0 + 0.32 = 0.32
      expect(results[0].snippet.id).toBe('snippet1');
      expect(results[0].score).toBeCloseTo(0.84, 2);
      expect(results[1].snippet.id).toBe('snippet2');
      expect(results[1].score).toBeCloseTo(0.32, 2);
    });

    it('should handle single score normalization', () => {
      const bm25Results: BM25Result[] = [
        { snippet: snippet1, score: 5.0, termMatches: ['cats'] }
      ];

      const vectorResults: VectorResult[] = [
        { snippet: snippet1, similarity: 0.7, embedding: [] }
      ];

      const results = fuser.fuse(bm25Results, vectorResults);

      expect(results).toHaveLength(1);
      // Single score should normalize to 1.0
      // Score: (1.0 * 0.6) + (0.7 * 0.4) = 0.6 + 0.28 = 0.88
      expect(results[0].score).toBeCloseTo(0.88, 2);
    });
  });

  describe('borda count fusion', () => {
    beforeEach(() => {
      fuser.updateConfig({ method: 'borda_count' });
    });

    it('should correctly implement borda count algorithm', () => {
      const bm25Results: BM25Result[] = [
        { snippet: snippet1, score: 3.0, termMatches: ['cats'] },  // 3 points (1st place)
        { snippet: snippet2, score: 2.0, termMatches: ['dogs'] },  // 2 points (2nd place)
        { snippet: snippet3, score: 1.0, termMatches: ['birds'] }  // 1 point (3rd place)
      ];

      const vectorResults: VectorResult[] = [
        { snippet: snippet2, similarity: 0.9, embedding: [] },  // 2 points (1st place)
        { snippet: snippet1, similarity: 0.7, embedding: [] }   // 1 point (2nd place)
      ];

      const results = fuser.fuse(bm25Results, vectorResults);

      expect(results).toHaveLength(3);
      
      // snippet1: 3 + 1 = 4 points
      // snippet2: 2 + 2 = 4 points (tie, but snippet1 comes first lexicographically)
      // snippet3: 1 + 0 = 1 point
      expect(results[0].snippet.id).toBe('snippet1'); // Tie-broken by ID
      expect(results[0].score).toBe(4);
      expect(results[1].snippet.id).toBe('snippet2');
      expect(results[1].score).toBe(4);
      expect(results[2].snippet.id).toBe('snippet3');
      expect(results[2].score).toBe(1);
    });
  });

  describe('configuration management', () => {
    it('should update configuration correctly', () => {
      const newConfig = { k: 30, bm25Weight: 0.7, vectorWeight: 0.3 };
      fuser.updateConfig(newConfig);

      const config = fuser.getConfig();
      expect(config.k).toBe(30);
      expect(config.bm25Weight).toBe(0.7);
      expect(config.vectorWeight).toBe(0.3);
      expect(config.method).toBe('reciprocal_rank'); // Should preserve unchanged values
    });

    it('should validate weights correctly', () => {
      fuser.updateConfig({ bm25Weight: 0.5, vectorWeight: 0.5 });
      expect(fuser.validateWeights()).toBe(true);

      fuser.updateConfig({ bm25Weight: 0.1, vectorWeight: 0.1 });
      expect(fuser.validateWeights()).toBe(false);

      fuser.updateConfig({ bm25Weight: 0.8, vectorWeight: 0.8 });
      expect(fuser.validateWeights()).toBe(false);
    });

    it('should create default config correctly', () => {
      const defaultConfig = ResultFuser.getDefaultConfig();
      expect(defaultConfig.method).toBe('reciprocal_rank');
      expect(defaultConfig.k).toBe(60);
      expect(defaultConfig.bm25Weight).toBe(0.6);
      expect(defaultConfig.vectorWeight).toBe(0.4);
    });

    it('should create config from environment variables', () => {
      // Mock environment variables
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        RETRIEVAL_FUSION_METHOD: 'weighted_sum',
        RETRIEVAL_FUSION_K: '30',
        RETRIEVAL_BM25_WEIGHT: '0.7',
        RETRIEVAL_VECTOR_WEIGHT: '0.3'
      };

      const config = ResultFuser.fromEnvironment();
      expect(config.method).toBe('weighted_sum');
      expect(config.k).toBe(30);
      expect(config.bm25Weight).toBe(0.7);
      expect(config.vectorWeight).toBe(0.3);

      // Restore environment
      process.env = originalEnv;
    });
  });

  describe('error handling', () => {
    it('should throw error for unsupported fusion method', () => {
      fuser.updateConfig({ method: 'invalid_method' as any });
      
      expect(() => {
        fuser.fuse([], []);
      }).toThrow('Unsupported fusion method: invalid_method');
    });

    it('should handle malformed input gracefully', () => {
      const bm25Results: BM25Result[] = [
        { snippet: snippet1, score: NaN, termMatches: [] }
      ];

      const vectorResults: VectorResult[] = [
        { snippet: snippet1, similarity: Infinity, embedding: [] }
      ];

      // Should not throw, but may produce unexpected results
      expect(() => {
        fuser.fuse(bm25Results, vectorResults);
      }).not.toThrow();
    });
  });

  describe('performance and determinism', () => {
    it('should produce consistent results across multiple runs', () => {
      const bm25Results: BM25Result[] = [
        { snippet: snippet1, score: 2.5, termMatches: ['cats'] },
        { snippet: snippet2, score: 1.8, termMatches: ['dogs'] },
        { snippet: snippet3, score: 1.2, termMatches: ['birds'] }
      ];

      const vectorResults: VectorResult[] = [
        { snippet: snippet2, similarity: 0.9, embedding: [] },
        { snippet: snippet4, similarity: 0.7, embedding: [] },
        { snippet: snippet1, similarity: 0.6, embedding: [] }
      ];

      const results1 = fuser.fuse(bm25Results, vectorResults);
      const results2 = fuser.fuse(bm25Results, vectorResults);
      const results3 = fuser.fuse(bm25Results, vectorResults);

      // All runs should produce identical results
      expect(results1.map(r => r.snippet.id)).toEqual(results2.map(r => r.snippet.id));
      expect(results2.map(r => r.snippet.id)).toEqual(results3.map(r => r.snippet.id));
      
      // Scores should be identical
      expect(results1.map(r => r.score)).toEqual(results2.map(r => r.score));
      expect(results2.map(r => r.score)).toEqual(results3.map(r => r.score));
    });

    it('should handle large result sets efficiently', () => {
      // Create large test datasets
      const bm25Results: BM25Result[] = [];
      const vectorResults: VectorResult[] = [];

      for (let i = 0; i < 100; i++) {
        const snippet: FactbookSnippet = {
          id: `snippet${i}`,
          path: `test/snippet${i}`,
          text: `Test snippet ${i}`,
          topics: ['test'],
          keywords: ['test']
        };

        bm25Results.push({
          snippet,
          score: Math.random() * 10,
          termMatches: ['test']
        });

        vectorResults.push({
          snippet,
          similarity: Math.random(),
          embedding: []
        });
      }

      const startTime = Date.now();
      const results = fuser.fuse(bm25Results, vectorResults);
      const elapsedMs = Date.now() - startTime;

      expect(results).toHaveLength(100);
      expect(elapsedMs).toBeLessThan(100); // Should complete in under 100ms
    });
  });

  describe('edge cases', () => {
    it('should handle duplicate snippets correctly', () => {
      const bm25Results: BM25Result[] = [
        { snippet: snippet1, score: 2.0, termMatches: ['cats'] },
        { snippet: snippet1, score: 1.5, termMatches: ['pets'] } // Duplicate
      ];

      const vectorResults: VectorResult[] = [
        { snippet: snippet1, similarity: 0.8, embedding: [] }
      ];

      const results = fuser.fuse(bm25Results, vectorResults);

      // Should only have one result for snippet1
      expect(results).toHaveLength(1);
      expect(results[0].snippet.id).toBe('snippet1');
      expect(results[0].source).toBe('both');
    });

    it('should handle zero scores correctly', () => {
      const bm25Results: BM25Result[] = [
        { snippet: snippet1, score: 0, termMatches: [] }
      ];

      const vectorResults: VectorResult[] = [
        { snippet: snippet1, similarity: 0, embedding: [] }
      ];

      const results = fuser.fuse(bm25Results, vectorResults);

      expect(results).toHaveLength(1);
      expect(results[0].score).toBeGreaterThan(0); // RRF should still give positive score
    });

    it('should handle very small differences in scores', () => {
      const bm25Results: BM25Result[] = [
        { snippet: snippet1, score: 1.0000001, termMatches: ['test'] },
        { snippet: snippet2, score: 1.0000000, termMatches: ['test'] }
      ];

      const vectorResults: VectorResult[] = [];

      const results = fuser.fuse(bm25Results, vectorResults);

      expect(results).toHaveLength(2);
      // Should maintain relative ordering despite tiny differences
      expect(results[0].snippet.id).toBe('snippet1');
      expect(results[1].snippet.id).toBe('snippet2');
    });
  });
});