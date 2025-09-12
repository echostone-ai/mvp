// src/lib/services/__tests__/resultFuser.integration.test.ts
// Integration tests for ResultFuser with BM25 and Vector results

import { describe, it, expect, beforeEach } from 'vitest';
import { ResultFuser, FusionConfig } from '../resultFuser';
import { BM25Result } from '../bm25Retriever';
import { VectorResult } from '../vectorRetriever';
import { FactbookSnippet } from '../factbookService';

describe('ResultFuser Integration', () => {
  let fuser: ResultFuser;
  let config: FusionConfig;

  // Test data representing real factbook snippets
  const snippets: FactbookSnippet[] = [
    {
      id: 'morocco_cobra',
      path: 'travel/morocco_cobra',
      text: 'I encountered a dangerous cobra snake in Morocco during my travels. The snake was coiled and ready to strike.',
      topics: ['travel', 'animals', 'danger'],
      keywords: ['cobra', 'snake', 'Morocco', 'dangerous', 'travel']
    },
    {
      id: 'tyler_cansu',
      path: 'family/tyler_cansu',
      text: 'My brother Tyler is married to his wonderful partner Cansu. They make a great couple.',
      topics: ['family', 'relationships'],
      keywords: ['Tyler', 'brother', 'Cansu', 'married', 'partner']
    },
    {
      id: 'sxsw_concerts',
      path: 'events/sxsw_concerts',
      text: 'I attended amazing concerts at SXSW including Bill Murray and GZA performances. The music was incredible.',
      topics: ['music', 'events', 'entertainment'],
      keywords: ['SXSW', 'concerts', 'Bill Murray', 'GZA', 'music']
    },
    {
      id: 'pets_olive_george',
      path: 'pets/olive_george',
      text: 'My pets Olive and George are very important to me. They bring so much joy to my life.',
      topics: ['pets', 'family', 'animals'],
      keywords: ['Olive', 'George', 'pets', 'animals', 'joy']
    },
    {
      id: 'snake_general',
      path: 'animals/snake_general',
      text: 'Snakes are fascinating reptiles with unique characteristics. Some are venomous while others are harmless.',
      topics: ['animals', 'education'],
      keywords: ['snakes', 'reptiles', 'venomous', 'characteristics']
    }
  ];

  beforeEach(() => {
    config = {
      method: 'reciprocal_rank',
      k: 60,
      bm25Weight: 0.6,
      vectorWeight: 0.4
    };
    fuser = new ResultFuser(config);
  });

  describe('semantic connection scenarios', () => {
    it('should connect "snake story" to cobra memory through fusion', () => {
      // Simulate BM25 results for "snake story" query
      const bm25Results: BM25Result[] = [
        { snippet: snippets[4], score: 2.1, termMatches: ['snake'] }, // snake_general (exact match)
        { snippet: snippets[0], score: 1.8, termMatches: ['snake'] }  // morocco_cobra (partial match)
      ];

      // Simulate vector results showing semantic similarity
      const vectorResults: VectorResult[] = [
        { snippet: snippets[0], similarity: 0.85, embedding: [] }, // morocco_cobra (high semantic similarity)
        { snippet: snippets[4], similarity: 0.72, embedding: [] }  // snake_general (moderate similarity)
      ];

      const fusedResults = fuser.fuse(bm25Results, vectorResults);

      expect(fusedResults).toHaveLength(2);
      
      // The cobra story should rank highly due to both BM25 and vector signals
      const cobraResult = fusedResults.find(r => r.snippet.id === 'morocco_cobra');
      expect(cobraResult).toBeDefined();
      expect(cobraResult?.source).toBe('both');
      expect(cobraResult?.metadata.bm25Score).toBe(1.8);
      expect(cobraResult?.metadata.vectorSimilarity).toBe(0.85);
      
      // Should have similar fusion scores due to RRF algorithm
      const generalResult = fusedResults.find(r => r.snippet.id === 'snake_general');
      expect(cobraResult!.score).toBeGreaterThanOrEqual(generalResult!.score);
    });

    it('should connect "Tyler partner" to Cansu information', () => {
      // BM25 finds Tyler mention
      const bm25Results: BM25Result[] = [
        { snippet: snippets[1], score: 3.2, termMatches: ['Tyler', 'partner'] }
      ];

      // Vector search finds semantic relationship
      const vectorResults: VectorResult[] = [
        { snippet: snippets[1], similarity: 0.92, embedding: [] } // High semantic match
      ];

      const fusedResults = fuser.fuse(bm25Results, vectorResults);

      expect(fusedResults).toHaveLength(1);
      expect(fusedResults[0].snippet.id).toBe('tyler_cansu');
      expect(fusedResults[0].source).toBe('both');
      expect(fusedResults[0].metadata.termMatches).toContain('Tyler');
      expect(fusedResults[0].metadata.termMatches).toContain('partner');
    });

    it('should handle "meetings at SXSW" to find concert memories', () => {
      // BM25 finds SXSW mention
      const bm25Results: BM25Result[] = [
        { snippet: snippets[2], score: 2.8, termMatches: ['SXSW'] }
      ];

      // Vector search understands "meetings" ≈ "concerts/events"
      const vectorResults: VectorResult[] = [
        { snippet: snippets[2], similarity: 0.78, embedding: [] }
      ];

      const fusedResults = fuser.fuse(bm25Results, vectorResults);

      expect(fusedResults).toHaveLength(1);
      expect(fusedResults[0].snippet.id).toBe('sxsw_concerts');
      expect(fusedResults[0].source).toBe('both');
      
      // Should boost the score through fusion
      expect(fusedResults[0].score).toBeGreaterThan(0);
    });

    it('should find pets when searching for "Olive" or "George"', () => {
      // BM25 finds exact name matches
      const bm25Results: BM25Result[] = [
        { snippet: snippets[3], score: 4.1, termMatches: ['Olive'] }
      ];

      // Vector search finds semantic pet context
      const vectorResults: VectorResult[] = [
        { snippet: snippets[3], similarity: 0.88, embedding: [] }
      ];

      const fusedResults = fuser.fuse(bm25Results, vectorResults);

      expect(fusedResults).toHaveLength(1);
      expect(fusedResults[0].snippet.id).toBe('pets_olive_george');
      expect(fusedResults[0].source).toBe('both');
      expect(fusedResults[0].metadata.termMatches).toContain('Olive');
    });
  });

  describe('fusion algorithm behavior', () => {
    it('should prefer results found by both methods', () => {
      const bm25Results: BM25Result[] = [
        { snippet: snippets[0], score: 2.0, termMatches: ['test'] },
        { snippet: snippets[1], score: 1.5, termMatches: ['test'] }
      ];

      const vectorResults: VectorResult[] = [
        { snippet: snippets[0], similarity: 0.8, embedding: [] },
        { snippet: snippets[2], similarity: 0.7, embedding: [] } // Only in vector
      ];

      const fusedResults = fuser.fuse(bm25Results, vectorResults);

      expect(fusedResults).toHaveLength(3);
      
      // Result found by both methods should rank highest
      expect(fusedResults[0].snippet.id).toBe('morocco_cobra');
      expect(fusedResults[0].source).toBe('both');
    });

    it('should handle vector-only results correctly', () => {
      const bm25Results: BM25Result[] = [
        { snippet: snippets[0], score: 2.0, termMatches: ['test'] }
      ];

      const vectorResults: VectorResult[] = [
        { snippet: snippets[1], similarity: 0.9, embedding: [] }, // Vector only
        { snippet: snippets[0], similarity: 0.7, embedding: [] }  // Both methods
      ];

      const fusedResults = fuser.fuse(bm25Results, vectorResults);

      expect(fusedResults).toHaveLength(2);
      
      // Check that vector-only result is included
      const vectorOnlyResult = fusedResults.find(r => r.snippet.id === 'tyler_cansu');
      expect(vectorOnlyResult).toBeDefined();
      expect(vectorOnlyResult?.source).toBe('vector');
      expect(vectorOnlyResult?.metadata.vectorSimilarity).toBe(0.9);
      expect(vectorOnlyResult?.metadata.bm25Score).toBeUndefined();
    });

    it('should handle BM25-only results correctly', () => {
      const bm25Results: BM25Result[] = [
        { snippet: snippets[0], score: 3.0, termMatches: ['test'] },
        { snippet: snippets[1], score: 2.0, termMatches: ['test'] } // BM25 only
      ];

      const vectorResults: VectorResult[] = [
        { snippet: snippets[0], similarity: 0.8, embedding: [] }
      ];

      const fusedResults = fuser.fuse(bm25Results, vectorResults);

      expect(fusedResults).toHaveLength(2);
      
      // Check that BM25-only result is included
      const bm25OnlyResult = fusedResults.find(r => r.snippet.id === 'tyler_cansu');
      expect(bm25OnlyResult).toBeDefined();
      expect(bm25OnlyResult?.source).toBe('bm25');
      expect(bm25OnlyResult?.metadata.bm25Score).toBe(2.0);
      expect(bm25OnlyResult?.metadata.vectorSimilarity).toBeUndefined();
    });
  });

  describe('different fusion methods', () => {
    it('should produce different rankings with weighted sum', () => {
      fuser.updateConfig({ method: 'weighted_sum' });

      const bm25Results: BM25Result[] = [
        { snippet: snippets[0], score: 3.0, termMatches: ['test'] },
        { snippet: snippets[1], score: 1.0, termMatches: ['test'] }
      ];

      const vectorResults: VectorResult[] = [
        { snippet: snippets[0], similarity: 0.6, embedding: [] },
        { snippet: snippets[1], similarity: 0.9, embedding: [] }
      ];

      const fusedResults = fuser.fuse(bm25Results, vectorResults);

      expect(fusedResults).toHaveLength(2);
      
      // With weighted sum, the first result should still win due to higher BM25 weight
      expect(fusedResults[0].snippet.id).toBe('morocco_cobra');
      
      // But scores should be different from RRF
      expect(fusedResults[0].score).toBeCloseTo(0.84, 2); // (1.0 * 0.6) + (0.6 * 0.4)
      expect(fusedResults[1].score).toBeCloseTo(0.36, 2); // (0.0 * 0.6) + (0.9 * 0.4)
    });

    it('should produce different rankings with borda count', () => {
      fuser.updateConfig({ method: 'borda_count' });

      const bm25Results: BM25Result[] = [
        { snippet: snippets[0], score: 3.0, termMatches: ['test'] }, // 2 points
        { snippet: snippets[1], score: 1.0, termMatches: ['test'] }  // 1 point
      ];

      const vectorResults: VectorResult[] = [
        { snippet: snippets[1], similarity: 0.9, embedding: [] }, // 2 points
        { snippet: snippets[0], similarity: 0.6, embedding: [] }  // 1 point
      ];

      const fusedResults = fuser.fuse(bm25Results, vectorResults);

      expect(fusedResults).toHaveLength(2);
      
      // Both should have 3 points, tie-breaking is lexicographic by ID
      expect(fusedResults[0].score).toBe(3); // 2 + 1 or 1 + 2
      expect(fusedResults[1].score).toBe(3); // 1 + 2 or 2 + 1
      // Verify both results are present
      const resultIds = fusedResults.map(r => r.snippet.id);
      expect(resultIds).toContain('morocco_cobra');
      expect(resultIds).toContain('tyler_cansu');
    });
  });

  describe('configuration and weights', () => {
    it('should respect different fusion weights', () => {
      fuser.updateConfig({ 
        method: 'weighted_sum',
        bm25Weight: 0.8,
        vectorWeight: 0.2
      });

      const bm25Results: BM25Result[] = [
        { snippet: snippets[0], score: 2.0, termMatches: ['test'] }
      ];

      const vectorResults: VectorResult[] = [
        { snippet: snippets[0], similarity: 0.5, embedding: [] }
      ];

      const fusedResults = fuser.fuse(bm25Results, vectorResults);

      expect(fusedResults).toHaveLength(1);
      // Score should be (1.0 * 0.8) + (0.5 * 0.2) = 0.9
      expect(fusedResults[0].score).toBeCloseTo(0.9, 2);
    });

    it('should respect different RRF k values', () => {
      const originalK = fuser.getConfig().k;
      fuser.updateConfig({ k: 30 }); // Lower k = higher scores

      const bm25Results: BM25Result[] = [
        { snippet: snippets[0], score: 2.0, termMatches: ['test'] }
      ];

      const vectorResults: VectorResult[] = [
        { snippet: snippets[0], similarity: 0.8, embedding: [] }
      ];

      const fusedResults = fuser.fuse(bm25Results, vectorResults);
      const scoreWithK30 = fusedResults[0].score;

      // Reset to original k and compare
      fuser.updateConfig({ k: originalK });
      const fusedResults2 = fuser.fuse(bm25Results, vectorResults);
      const scoreWithOriginalK = fusedResults2[0].score;

      // Lower k should produce higher scores
      expect(scoreWithK30).toBeGreaterThan(scoreWithOriginalK);
    });
  });

  describe('edge cases and robustness', () => {
    it('should handle empty result sets gracefully', () => {
      const emptyBM25: BM25Result[] = [];
      const emptyVector: VectorResult[] = [];

      const fusedResults = fuser.fuse(emptyBM25, emptyVector);
      expect(fusedResults).toHaveLength(0);
    });

    it('should handle single result sets', () => {
      const singleBM25: BM25Result[] = [
        { snippet: snippets[0], score: 2.0, termMatches: ['test'] }
      ];

      const fusedResults = fuser.fuse(singleBM25, []);
      expect(fusedResults).toHaveLength(1);
      expect(fusedResults[0].source).toBe('bm25');
    });

    it('should maintain deterministic ordering', () => {
      const bm25Results: BM25Result[] = [
        { snippet: snippets[0], score: 2.0, termMatches: ['test'] },
        { snippet: snippets[1], score: 2.0, termMatches: ['test'] }
      ];

      const vectorResults: VectorResult[] = [
        { snippet: snippets[0], similarity: 0.8, embedding: [] },
        { snippet: snippets[1], similarity: 0.8, embedding: [] }
      ];

      const fusedResults1 = fuser.fuse(bm25Results, vectorResults);
      const fusedResults2 = fuser.fuse(bm25Results, vectorResults);

      // Should produce identical results
      expect(fusedResults1.map(r => r.snippet.id)).toEqual(
        fusedResults2.map(r => r.snippet.id)
      );
    });
  });
});