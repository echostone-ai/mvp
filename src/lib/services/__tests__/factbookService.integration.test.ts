// src/lib/services/__tests__/factbookService.integration.test.ts
// Integration tests for FactbookService.retrieve() method with hybrid retrieval

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FactbookService } from '../factbookService';
import type { Fact } from '@/lib/factbook/buildIndex';

// Mock the hybrid retrieval module
vi.mock('../hybridRetrieval', () => ({
  hybridRetriever: {
    retrieve: vi.fn(),
    getHealthStatus: vi.fn()
  }
}));

describe('FactbookService Integration', () => {
  let factbookService: FactbookService;
  let mockHybridRetriever: any;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Get fresh instance
    factbookService = FactbookService.getInstance();
    
    // Load test factbook data
    const testFactbook = {
      pets: {
        olive: {
          id: 'pets.olive',
          text: 'Olive is a Puerto Rican street dog who loves adventures and has a playful personality.',
          topics: ['pets', 'dogs', 'olive'],
          keywords: ['olive', 'puerto', 'rican', 'street', 'dog', 'adventures', 'playful']
        }
      },
      places: {
        austin: {
          id: 'places.austin',
          text: 'I lived in Austin, Texas from 2018 to 2022 and loved the music scene.',
          topics: ['places', 'austin', 'texas'],
          keywords: ['austin', 'texas', 'lived', 'music', 'scene']
        }
      }
    };
    
    await factbookService.loadFactbook(testFactbook);
    
    // Get the mocked hybrid retriever
    const { hybridRetriever } = await import('../hybridRetrieval');
    mockHybridRetriever = hybridRetriever;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('retrieve() method', () => {
    it('should use hybrid retrieval when system is healthy', async () => {
      // Mock healthy hybrid retriever
      mockHybridRetriever.getHealthStatus.mockReturnValue({
        status: 'healthy',
        components: {
          bm25: 'healthy',
          vector: 'healthy',
          expansion: 'healthy',
          reranking: 'healthy'
        }
      });

      mockHybridRetriever.retrieve.mockResolvedValue({
        results: [
          {
            snippet: {
              id: 'pets.olive',
              path: 'pets.olive',
              text: 'Olive is a Puerto Rican street dog who loves adventures and has a playful personality.',
              topics: ['pets', 'dogs', 'olive'],
              keywords: ['olive', 'puerto', 'rican', 'street', 'dog', 'adventures', 'playful']
            },
            score: 0.85,
            source: 'both',
            confidence: 0.8
          }
        ],
        metrics: {
          totalTimeMs: 150,
          bm25TimeMs: 50,
          vectorTimeMs: 75,
          methodsUsed: ['bm25', 'vector', 'fusion'],
          resultCount: 1,
          confidenceScore: 0.8,
          expansionTriggered: false,
          rerankingApplied: false,
          fallbackUsed: false,
          bm25Available: true,
          vectorAvailable: true,
          expansionAvailable: true,
          rerankingAvailable: true,
          cacheHit: false,
          errors: [],
          warnings: []
        }
      });

      const results = await factbookService.retrieve('olive dog adventures');

      expect(mockHybridRetriever.retrieve).toHaveBeenCalledWith('olive dog adventures');
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: 'pets.olive',
        text: 'Olive is a Puerto Rican street dog who loves adventures and has a playful personality.',
        type: 'both',
        weight: 0.8
      });
    });

    it('should use hybrid retrieval when system is degraded', async () => {
      // Mock degraded hybrid retriever
      mockHybridRetriever.getHealthStatus.mockReturnValue({
        status: 'degraded',
        components: {
          bm25: 'healthy',
          vector: 'degraded',
          expansion: 'degraded',
          reranking: 'degraded'
        }
      });

      mockHybridRetriever.retrieve.mockResolvedValue({
        results: [
          {
            snippet: {
              id: 'pets.olive',
              path: 'pets.olive',
              text: 'Olive is a Puerto Rican street dog who loves adventures and has a playful personality.',
              topics: ['pets', 'dogs', 'olive'],
              keywords: ['olive', 'puerto', 'rican', 'street', 'dog', 'adventures', 'playful']
            },
            score: 0.75,
            source: 'bm25',
            confidence: 0.7
          }
        ],
        metrics: {
          totalTimeMs: 100,
          bm25TimeMs: 50,
          methodsUsed: ['bm25'],
          resultCount: 1,
          confidenceScore: 0.7,
          expansionTriggered: false,
          rerankingApplied: false,
          fallbackUsed: true,
          bm25Available: true,
          vectorAvailable: false,
          expansionAvailable: false,
          rerankingAvailable: false,
          cacheHit: false,
          errors: [],
          warnings: ['Vector retrieval unavailable']
        }
      });

      const results = await factbookService.retrieve('olive dog');

      expect(mockHybridRetriever.retrieve).toHaveBeenCalledWith('olive dog');
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('bm25');
    });

    it('should fallback to legacy retrieval when hybrid system is unhealthy', async () => {
      // Mock unhealthy hybrid retriever
      mockHybridRetriever.getHealthStatus.mockReturnValue({
        status: 'unhealthy',
        components: {
          bm25: 'unhealthy',
          vector: 'unhealthy',
          expansion: 'unhealthy',
          reranking: 'unhealthy'
        },
        details: ['BM25 index not built', 'Vector retriever not initialized']
      });

      const results = await factbookService.retrieve('olive dog adventures');

      expect(mockHybridRetriever.retrieve).not.toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: 'pets.olive',
        type: 'legacy',
        weight: 0.5
      });
    });

    it('should fallback to legacy retrieval when hybrid retrieval throws error', async () => {
      // Mock healthy status but retrieval throws error
      mockHybridRetriever.getHealthStatus.mockReturnValue({
        status: 'healthy'
      });

      mockHybridRetriever.retrieve.mockRejectedValue(new Error('Hybrid retrieval failed'));

      const results = await factbookService.retrieve('olive dog');

      expect(mockHybridRetriever.retrieve).toHaveBeenCalledWith('olive dog');
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('legacy');
    });

    it('should handle empty query gracefully', async () => {
      mockHybridRetriever.getHealthStatus.mockReturnValue({
        status: 'healthy'
      });

      mockHybridRetriever.retrieve.mockResolvedValue({
        results: [],
        metrics: {
          totalTimeMs: 10,
          bm25TimeMs: 5,
          methodsUsed: ['bm25'],
          resultCount: 0,
          confidenceScore: 0,
          expansionTriggered: false,
          rerankingApplied: false,
          fallbackUsed: false,
          bm25Available: true,
          vectorAvailable: true,
          expansionAvailable: true,
          rerankingAvailable: true,
          cacheHit: false,
          errors: [],
          warnings: []
        }
      });

      const results = await factbookService.retrieve('');

      expect(results).toHaveLength(0);
    });

    it('should maintain backward compatibility with Fact[] return type', async () => {
      mockHybridRetriever.getHealthStatus.mockReturnValue({
        status: 'healthy'
      });

      mockHybridRetriever.retrieve.mockResolvedValue({
        results: [
          {
            snippet: {
              id: 'pets.olive',
              path: 'pets.olive',
              text: 'Olive is a Puerto Rican street dog.',
              topics: ['pets', 'dogs'],
              keywords: ['olive', 'dog']
            },
            score: 0.9,
            source: 'vector',
            confidence: 0.85
          }
        ],
        metrics: {
          totalTimeMs: 200,
          methodsUsed: ['bm25', 'vector', 'fusion'],
          resultCount: 1,
          confidenceScore: 0.85,
          expansionTriggered: false,
          rerankingApplied: false,
          fallbackUsed: false,
          bm25Available: true,
          vectorAvailable: true,
          expansionAvailable: true,
          rerankingAvailable: true,
          cacheHit: false,
          errors: [],
          warnings: []
        }
      });

      const results: Fact[] = await factbookService.retrieve('olive');

      // Verify it returns Fact[] type with proper structure
      expect(Array.isArray(results)).toBe(true);
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('path');
      expect(results[0]).toHaveProperty('text');
      expect(results[0]).toHaveProperty('topics');
      expect(results[0]).toHaveProperty('keywords');
      expect(results[0]).toHaveProperty('type');
      expect(results[0]).toHaveProperty('weight');
      
      expect(results[0].type).toBe('vector');
      expect(results[0].weight).toBe(0.85);
    });
  });

  describe('legacy retrieval fallback', () => {
    it('should extract keywords correctly', async () => {
      // Force legacy retrieval by making hybrid unhealthy
      mockHybridRetriever.getHealthStatus.mockReturnValue({
        status: 'unhealthy'
      });

      const results = await factbookService.retrieve('I love my dog Olive and her adventures');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('pets.olive');
      expect(results[0].type).toBe('legacy');
    });

    it('should handle special characters in query', async () => {
      mockHybridRetriever.getHealthStatus.mockReturnValue({
        status: 'unhealthy'
      });

      const results = await factbookService.retrieve('Olivé\'s adventures!!! @#$%');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('pets.olive');
    });

    it('should filter stop words', async () => {
      mockHybridRetriever.getHealthStatus.mockReturnValue({
        status: 'unhealthy'
      });

      const results = await factbookService.retrieve('the dog and the adventures of olive');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('pets.olive');
    });

    it('should return empty array when no matches found', async () => {
      mockHybridRetriever.getHealthStatus.mockReturnValue({
        status: 'unhealthy'
      });

      const results = await factbookService.retrieve('nonexistent topic');

      expect(results).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle factbook not loaded gracefully', async () => {
      // Create new instance without loading factbook
      const emptyFactbookService = new (FactbookService as any)();
      
      const results = await emptyFactbookService.retrieve('test query');

      expect(results).toHaveLength(0);
    });

    it('should log comprehensive metrics', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      mockHybridRetriever.getHealthStatus.mockReturnValue({
        status: 'healthy'
      });

      mockHybridRetriever.retrieve.mockResolvedValue({
        results: [],
        metrics: {
          totalTimeMs: 100,
          bm25TimeMs: 50,
          vectorTimeMs: 30,
          expansionTimeMs: 20,
          methodsUsed: ['bm25', 'vector', 'expansion'],
          resultCount: 0,
          confidenceScore: 0.2,
          expansionTriggered: true,
          rerankingApplied: false,
          fallbackUsed: false,
          bm25Available: true,
          vectorAvailable: true,
          expansionAvailable: true,
          rerankingAvailable: false,
          cacheHit: false,
          errors: [],
          warnings: []
        }
      });

      await factbookService.retrieve('test query');

      expect(consoleSpy).toHaveBeenCalledWith(
        'factbook_hybrid_retrieve',
        expect.objectContaining({
          query: 'test query',
          result_count: 0,
          methods_used: ['bm25', 'vector', 'expansion'],
          expansion_triggered: true,
          reranking_applied: false,
          fallback_used: false
        })
      );

      consoleSpy.mockRestore();
    });
  });
});