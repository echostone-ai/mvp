// src/lib/services/__tests__/vectorRetriever.test.ts
// Unit tests for VectorRetriever with semantic similarity accuracy tests

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { VectorRetriever, VectorConfig } from '../vectorRetriever';
import { EmbeddingCache } from '../embeddingCache';
import { FactbookSnippet } from '../factbookService';

// Mock the EmbeddingService completely
vi.mock('../embeddingService', () => ({
  EmbeddingService: vi.fn().mockImplementation(() => ({
    generateEmbedding: vi.fn(),
    generateBatchEmbeddings: vi.fn(),
    getHealthStatus: vi.fn().mockResolvedValue({
      status: 'healthy',
      details: ['Service operational']
    })
  }))
}));

// Mock embedding cache
const mockCache: EmbeddingCache = {
  get: vi.fn(),
  set: vi.fn(),
  clear: vi.fn(),
  getStats: vi.fn().mockReturnValue({
    size: 0,
    hitRate: 0,
    totalRequests: 0
  })
};

describe('VectorRetriever', () => {
  let vectorRetriever: VectorRetriever;
  let config: VectorConfig;
  let mockEmbeddingService: any;

  // Test data - factbook snippets with known relationships
  const testSnippets: FactbookSnippet[] = [
    {
      id: 'snake_morocco',
      path: 'experiences.morocco_cobra',
      text: 'I encountered a cobra in Morocco during my travels. The snake was coiled and ready to strike.',
      topics: ['travel', 'animals', 'morocco'],
      keywords: ['cobra', 'snake', 'morocco', 'travel']
    },
    {
      id: 'sxsw_bill_murray',
      path: 'experiences.sxsw_bill_murray',
      text: 'Met Bill Murray at SXSW music festival. He was incredibly funny and down to earth.',
      topics: ['music', 'festivals', 'celebrities'],
      keywords: ['bill', 'murray', 'sxsw', 'music', 'festival']
    },
    {
      id: 'sxsw_gza_concert',
      path: 'experiences.sxsw_gza',
      text: 'Attended GZA concert at SXSW. The Wu-Tang member put on an amazing show.',
      topics: ['music', 'festivals', 'concerts'],
      keywords: ['gza', 'wu-tang', 'sxsw', 'concert', 'music']
    },
    {
      id: 'tyler_info',
      path: 'relationships.tyler',
      text: 'Tyler is my close friend from college. We studied computer science together.',
      topics: ['friends', 'college', 'relationships'],
      keywords: ['tyler', 'friend', 'college', 'computer', 'science']
    },
    {
      id: 'tyler_cansu',
      path: 'relationships.tyler_partner',
      text: 'Tyler is dating Cansu, who is a talented artist from Turkey.',
      topics: ['relationships', 'friends'],
      keywords: ['tyler', 'cansu', 'partner', 'artist', 'turkey']
    },
    {
      id: 'olive_pet',
      path: 'pets.olive',
      text: 'Olive is my rescue dog, a Puerto Rican street dog with lots of personality.',
      topics: ['pets', 'dogs'],
      keywords: ['olive', 'dog', 'rescue', 'puerto', 'rican', 'street']
    },
    {
      id: 'george_pet',
      path: 'pets.george',
      text: 'George is my cat, a fluffy orange tabby who loves to sleep in sunny spots.',
      topics: ['pets', 'cats'],
      keywords: ['george', 'cat', 'orange', 'tabby', 'fluffy']
    }
  ];

  // Mock embeddings that simulate semantic relationships
  const mockEmbeddings = new Map<string, number[]>([
    // Snake/cobra related - high similarity
    ['I encountered a cobra in Morocco during my travels. The snake was coiled and ready to strike.', 
     [0.8, 0.6, 0.2, 0.1, 0.0, 0.0, 0.0]],
    ['snake story', [0.9, 0.7, 0.1, 0.0, 0.0, 0.0, 0.0]],
    ['cobra encounter', [0.85, 0.65, 0.15, 0.05, 0.0, 0.0, 0.0]],
    
    // SXSW/music related - high similarity
    ['Met Bill Murray at SXSW music festival. He was incredibly funny and down to earth.',
     [0.1, 0.8, 0.7, 0.6, 0.0, 0.0, 0.0]],
    ['Attended GZA concert at SXSW. The Wu-Tang member put on an amazing show.',
     [0.0, 0.85, 0.75, 0.65, 0.0, 0.0, 0.0]],
    ['meetings at SXSW', [0.05, 0.9, 0.8, 0.7, 0.0, 0.0, 0.0]],
    ['SXSW concert', [0.0, 0.9, 0.85, 0.8, 0.0, 0.0, 0.0]],
    
    // Tyler/relationship related - high similarity
    ['Tyler is my close friend from college. We studied computer science together.',
     [0.0, 0.0, 0.1, 0.8, 0.7, 0.0, 0.0]],
    ['Tyler is dating Cansu, who is a talented artist from Turkey.',
     [0.0, 0.0, 0.0, 0.85, 0.8, 0.0, 0.0]],
    ['Who is Tyler?', [0.0, 0.0, 0.0, 0.9, 0.6, 0.0, 0.0]],
    ['Tyler partner', [0.0, 0.0, 0.0, 0.8, 0.9, 0.0, 0.0]],
    
    // Pet related - high similarity
    ['Olive is my rescue dog, a Puerto Rican street dog with lots of personality.',
     [0.0, 0.0, 0.0, 0.0, 0.0, 0.8, 0.6]],
    ['George is my cat, a fluffy orange tabby who loves to sleep in sunny spots.',
     [0.0, 0.0, 0.0, 0.0, 0.0, 0.6, 0.8]],
    ['Olive', [0.0, 0.0, 0.0, 0.0, 0.0, 0.9, 0.5]],
    ['George', [0.0, 0.0, 0.0, 0.0, 0.0, 0.5, 0.9]],
    
    // Test queries
    ['test query', [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]]
  ]);

  beforeEach(async () => {
    vi.clearAllMocks();
    
    config = VectorRetriever.getLinearConfig(); // Use linear for consistent test behavior
    config.dimensions = 7; // Use smaller dimensions for testing
    
    vectorRetriever = new VectorRetriever(config, mockCache);
    
    // Get the mocked embedding service instance
    mockEmbeddingService = (vectorRetriever as any).embeddingService;
    
    // Mock embedding generation
    if (mockEmbeddingService && mockEmbeddingService.generateEmbedding) {
      mockEmbeddingService.generateEmbedding.mockImplementation(async (text: string) => {
        const embedding = mockEmbeddings.get(text) || [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
        return {
          text,
          embedding,
          model: config.model,
          dimensions: config.dimensions
        };
      });
    }
    
    if (mockEmbeddingService && mockEmbeddingService.generateBatchEmbeddings) {
      mockEmbeddingService.generateBatchEmbeddings.mockImplementation(async (texts: string[]) => {
        const results = texts.map(text => ({
          text,
          embedding: mockEmbeddings.get(text) || [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
          model: config.model,
          dimensions: config.dimensions
        }));
        
        return {
          results,
          totalTokens: texts.length * 10,
          processingTimeMs: 100,
          errors: []
        };
      });
    }
    
    // Mock cache to return null (no cached embeddings)
    vi.mocked(mockCache.get).mockResolvedValue(null);
    vi.mocked(mockCache.set).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default config (HNSW)', () => {
      const defaultConfig = VectorRetriever.getDefaultConfig();
      const retriever = new VectorRetriever(defaultConfig, mockCache);
      
      expect(retriever.getConfig()).toEqual(defaultConfig);
      expect(retriever.getConfig().indexType).toBe('hnsw');
    });

    it('should initialize with linear config', () => {
      const linearConfig = VectorRetriever.getLinearConfig();
      const retriever = new VectorRetriever(linearConfig, mockCache);
      
      expect(retriever.getConfig().indexType).toBe('linear');
    });

    it('should initialize with large model config', () => {
      const largeConfig = VectorRetriever.getLargeModelConfig();
      const retriever = new VectorRetriever(largeConfig, mockCache);
      
      expect(retriever.getConfig().model).toBe('text-embedding-3-large');
      expect(retriever.getConfig().dimensions).toBe(3072);
      expect(retriever.getConfig().indexType).toBe('hnsw');
    });

    it('should initialize with small dataset config', () => {
      const smallConfig = VectorRetriever.getSmallDatasetConfig();
      const retriever = new VectorRetriever(smallConfig, mockCache);
      
      expect(retriever.getConfig().indexType).toBe('hnsw');
      expect(retriever.getConfig().hnswConfig).toBeDefined();
    });

    it('should initialize with large dataset config', () => {
      const largeConfig = VectorRetriever.getLargeDatasetConfig();
      const retriever = new VectorRetriever(largeConfig, mockCache);
      
      expect(retriever.getConfig().indexType).toBe('hnsw');
      expect(retriever.getConfig().hnswConfig).toBeDefined();
    });

    it('should update configuration', () => {
      const newConfig = { maxResults: 50, similarityThreshold: 0.5 };
      vectorRetriever.updateConfig(newConfig);
      
      const updatedConfig = vectorRetriever.getConfig();
      expect(updatedConfig.maxResults).toBe(50);
      expect(updatedConfig.similarityThreshold).toBe(0.5);
    });
  });

  describe('Index Building', () => {
    it('should build index from factbook snippets', async () => {
      await vectorRetriever.buildIndex(testSnippets);
      
      const stats = vectorRetriever.getIndexStats();
      expect(stats.size).toBe(testSnippets.length);
      expect(stats.dimensions).toBe(config.dimensions);
      expect(stats.model).toBe(config.model);
    });

    it('should handle empty snippet array', async () => {
      await vectorRetriever.buildIndex([]);
      
      const stats = vectorRetriever.getIndexStats();
      expect(stats.size).toBe(0);
    });

    it('should call embedding service for batch generation', async () => {
      await vectorRetriever.buildIndex(testSnippets);
      
      expect(mockEmbeddingService.generateBatchEmbeddings).toHaveBeenCalledWith(
        testSnippets.map(s => s.text)
      );
    });

    it('should use cached embeddings when available', async () => {
      // Mock cache to return embeddings for some texts
      vi.mocked(mockCache.get).mockImplementation(async (text: string) => {
        if (text === testSnippets[0].text) {
          return mockEmbeddings.get(text) || null;
        }
        return null;
      });

      await vectorRetriever.buildIndex(testSnippets);
      
      // Should still call batch generation for missing embeddings
      expect(mockEmbeddingService.generateBatchEmbeddings).toHaveBeenCalled();
    });
  });

  describe('Vector Search', () => {
    beforeEach(async () => {
      await vectorRetriever.buildIndex(testSnippets);
    });

    it('should return empty results for empty index', async () => {
      const emptyRetriever = new VectorRetriever(config, mockCache);
      const results = await emptyRetriever.search('test query');
      
      expect(results).toEqual([]);
    });

    it('should find semantically similar snippets', async () => {
      const results = await vectorRetriever.search('snake story');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].snippet.id).toBe('snake_morocco');
      expect(results[0].similarity).toBeGreaterThan(config.similarityThreshold);
    });

    it('should respect similarity threshold', async () => {
      // Set high threshold
      vectorRetriever.updateConfig({ similarityThreshold: 0.9 });
      
      const results = await vectorRetriever.search('unrelated query');
      
      // Should return fewer or no results due to high threshold
      expect(results.length).toBeLessThanOrEqual(testSnippets.length);
      results.forEach(result => {
        expect(result.similarity).toBeGreaterThanOrEqual(0.9);
      });
    });

    it('should respect max results limit', async () => {
      const maxResults = 2;
      const results = await vectorRetriever.search('test query', maxResults);
      
      expect(results.length).toBeLessThanOrEqual(maxResults);
    });

    it('should return results sorted by similarity', async () => {
      const results = await vectorRetriever.search('snake story');
      
      for (let i = 1; i < results.length; i++) {
        expect(results[i-1].similarity).toBeGreaterThanOrEqual(results[i].similarity);
      }
    });

    it('should include embedding in results', async () => {
      const results = await vectorRetriever.search('test query');
      
      if (results.length > 0) {
        expect(results[0].embedding).toBeDefined();
        expect(Array.isArray(results[0].embedding)).toBe(true);
        expect(results[0].embedding.length).toBe(config.dimensions);
      }
    });
  });

  describe('Semantic Connection Tests', () => {
    beforeEach(async () => {
      await vectorRetriever.buildIndex(testSnippets);
    });

    it('should connect "snake story" to Morocco cobra memory', async () => {
      const results = await vectorRetriever.search('snake story');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].snippet.id).toBe('snake_morocco');
      expect(results[0].similarity).toBeGreaterThan(0.7);
    });

    it('should connect "meetings at SXSW" to SXSW experiences', async () => {
      const results = await vectorRetriever.search('meetings at SXSW');
      
      const sxswResults = results.filter(r => 
        r.snippet.id === 'sxsw_bill_murray' || r.snippet.id === 'sxsw_gza_concert'
      );
      
      expect(sxswResults.length).toBeGreaterThan(0);
      sxswResults.forEach(result => {
        expect(result.similarity).toBeGreaterThan(0.6);
      });
    });

    it('should connect "SXSW concert" to GZA concert entry', async () => {
      const results = await vectorRetriever.search('SXSW concert');
      
      const gzaResult = results.find(r => r.snippet.id === 'sxsw_gza_concert');
      expect(gzaResult).toBeDefined();
      expect(gzaResult!.similarity).toBeGreaterThan(0.7);
    });

    it('should connect "Who is Tyler?" to Tyler facts', async () => {
      const results = await vectorRetriever.search('Who is Tyler?');
      
      const tylerResult = results.find(r => r.snippet.id === 'tyler_info');
      expect(tylerResult).toBeDefined();
      expect(tylerResult!.similarity).toBeGreaterThan(0.6);
    });

    it('should connect "Tyler partner" to Cansu information', async () => {
      const results = await vectorRetriever.search('Tyler partner');
      
      const cansuResult = results.find(r => r.snippet.id === 'tyler_cansu');
      expect(cansuResult).toBeDefined();
      expect(cansuResult!.similarity).toBeGreaterThan(0.7);
    });

    it('should find precise pet memories for "Olive"', async () => {
      const results = await vectorRetriever.search('Olive');
      
      const oliveResult = results.find(r => r.snippet.id === 'olive_pet');
      expect(oliveResult).toBeDefined();
      expect(oliveResult!.similarity).toBeGreaterThan(0.8);
    });

    it('should find precise pet memories for "George"', async () => {
      const results = await vectorRetriever.search('George');
      
      const georgeResult = results.find(r => r.snippet.id === 'george_pet');
      expect(georgeResult).toBeDefined();
      expect(georgeResult!.similarity).toBeGreaterThan(0.8);
    });
  });

  describe('Query Embedding Caching', () => {
    beforeEach(async () => {
      await vectorRetriever.buildIndex(testSnippets);
    });

    it('should cache query embeddings in memory', async () => {
      const query = 'test query';
      
      // First call
      await vectorRetriever.search(query);
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(query);
      
      // Second call should use cache
      vi.clearAllMocks();
      await vectorRetriever.search(query);
      expect(mockEmbeddingService.generateEmbedding).not.toHaveBeenCalled();
    });

    it('should use persistent cache when available', async () => {
      const query = 'cached query';
      const cachedEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
      
      // Mock persistent cache hit
      vi.mocked(mockCache.get).mockResolvedValueOnce(cachedEmbedding);
      
      await vectorRetriever.search(query);
      
      expect(mockCache.get).toHaveBeenCalledWith(query);
      expect(mockEmbeddingService.generateEmbedding).not.toHaveBeenCalledWith(query);
    });

    it('should clear query cache', async () => {
      await vectorRetriever.search('test query');
      
      vectorRetriever.clearQueryCache();
      
      // Next search should generate embedding again
      vi.clearAllMocks();
      await vectorRetriever.search('test query');
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalled();
    });
  });

  describe('Cosine Similarity Calculation', () => {
    it('should calculate correct cosine similarity', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      const similarity = vectorRetriever.cosineSimilarity(a, b);
      
      expect(similarity).toBe(0);
    });

    it('should handle identical vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3];
      const similarity = vectorRetriever.cosineSimilarity(a, b);
      
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should handle zero vectors', () => {
      const a = [0, 0, 0];
      const b = [1, 2, 3];
      const similarity = vectorRetriever.cosineSimilarity(a, b);
      
      expect(similarity).toBe(0);
    });

    it('should throw error for mismatched dimensions', () => {
      const a = [1, 2];
      const b = [1, 2, 3];
      
      expect(() => vectorRetriever.cosineSimilarity(a, b)).toThrow('Vector dimension mismatch');
    });
  });

  describe('Health Status', () => {
    it('should report degraded status for empty index', async () => {
      const health = await vectorRetriever.getHealthStatus();
      
      expect(health.status).toBe('degraded');
      expect(health.details[0]).toContain('Vector index is empty');
    });

    it('should report healthy status with built index', async () => {
      await vectorRetriever.buildIndex(testSnippets);
      
      const health = await vectorRetriever.getHealthStatus();
      
      expect(health.status).toBe('healthy');
      expect(health.details).toContain('Vector retriever operational');
    });

    it('should report degraded status when embedding service is unhealthy', async () => {
      mockEmbeddingService.getHealthStatus.mockResolvedValueOnce({
        status: 'unhealthy',
        details: ['Service error']
      });
      
      await vectorRetriever.buildIndex(testSnippets);
      const health = await vectorRetriever.getHealthStatus();
      
      expect(health.status).toBe('degraded');
      expect(health.details[0]).toContain('Embedding service unhealthy');
    });

    it('should report unhealthy status on search error', async () => {
      await vectorRetriever.buildIndex(testSnippets);
      
      // Mock search to throw error
      mockEmbeddingService.generateEmbedding.mockRejectedValueOnce(new Error('API error'));
      
      const health = await vectorRetriever.getHealthStatus();
      
      expect(health.status).toBe('unhealthy');
      expect(health.details[0]).toContain('Vector retriever error');
    });
  });

  describe('Error Handling', () => {
    it('should handle embedding generation errors', async () => {
      mockEmbeddingService.generateEmbedding.mockRejectedValueOnce(new Error('API error'));
      
      await vectorRetriever.buildIndex(testSnippets);
      
      await expect(vectorRetriever.search('test query')).rejects.toThrow('Vector search failed');
    });

    it('should handle batch embedding errors during index building', async () => {
      mockEmbeddingService.generateBatchEmbeddings.mockRejectedValueOnce(new Error('Batch error'));
      
      await expect(vectorRetriever.buildIndex(testSnippets)).rejects.toThrow('Batch error');
    });

    it('should handle cache errors gracefully', async () => {
      vi.mocked(mockCache.get).mockRejectedValue(new Error('Cache error'));
      vi.mocked(mockCache.set).mockRejectedValue(new Error('Cache error'));
      
      // Should still work without cache
      await vectorRetriever.buildIndex(testSnippets);
      const results = await vectorRetriever.search('test query');
      
      expect(results).toBeDefined();
    });
  });

  describe('Index Type Specific Tests', () => {
    it('should work with HNSW index', async () => {
      const hnswConfig = VectorRetriever.getDefaultConfig();
      hnswConfig.dimensions = 7;
      const hnswRetriever = new VectorRetriever(hnswConfig, mockCache);
      
      // Setup mock for HNSW retriever
      const hnswEmbeddingService = (hnswRetriever as any).embeddingService;
      hnswEmbeddingService.generateBatchEmbeddings.mockImplementation(mockEmbeddingService.generateBatchEmbeddings);
      hnswEmbeddingService.generateEmbedding.mockImplementation(mockEmbeddingService.generateEmbedding);
      hnswEmbeddingService.getHealthStatus.mockImplementation(mockEmbeddingService.getHealthStatus);
      
      await hnswRetriever.buildIndex(testSnippets);
      const results = await hnswRetriever.search('snake story');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].snippet.id).toBe('snake_morocco');
      
      const stats = hnswRetriever.getIndexStats();
      expect(stats.indexType).toBe('hnsw');
      expect(stats.hnswStats).toBeDefined();
    });

    it('should provide memory usage information', async () => {
      await vectorRetriever.buildIndex(testSnippets);
      
      const memoryUsage = vectorRetriever.getMemoryUsage();
      
      expect(memoryUsage.totalMB).toBeGreaterThan(0);
      expect(memoryUsage.indexMB).toBeGreaterThan(0);
      expect(memoryUsage.cacheMB).toBeGreaterThanOrEqual(0);
      expect(memoryUsage.snippetsMB).toBeGreaterThan(0);
    });

    it('should handle index persistence for HNSW', async () => {
      const hnswConfig = VectorRetriever.getDefaultConfig();
      hnswConfig.dimensions = 7;
      const hnswRetriever = new VectorRetriever(hnswConfig, mockCache);
      
      // Mock fs module
      const mockFs = {
        writeFile: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn().mockResolvedValue('{"test": "data"}')
      };
      
      vi.doMock('fs/promises', () => mockFs);
      
      // Test save (should not throw for HNSW)
      await expect(hnswRetriever.saveIndex('/tmp/test.json')).resolves.not.toThrow();
      
      // Test load (should not throw for HNSW)
      await expect(hnswRetriever.loadIndex('/tmp/test.json')).resolves.not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should complete search within reasonable time', async () => {
      await vectorRetriever.buildIndex(testSnippets);
      
      const startTime = Date.now();
      await vectorRetriever.search('test query');
      const elapsedMs = Date.now() - startTime;
      
      // Should complete within 100ms (mocked, so should be very fast)
      expect(elapsedMs).toBeLessThan(100);
    });

    it('should handle large result sets efficiently', async () => {
      // Create many test snippets
      const manySnippets = Array.from({ length: 100 }, (_, i) => ({
        id: `snippet_${i}`,
        path: `test.snippet_${i}`,
        text: `Test snippet number ${i} with some content`,
        topics: ['test'],
        keywords: [`snippet${i}`, 'test']
      }));
      
      await vectorRetriever.buildIndex(manySnippets);
      
      const startTime = Date.now();
      const results = await vectorRetriever.search('test query', 10);
      const elapsedMs = Date.now() - startTime;
      
      expect(results.length).toBeLessThanOrEqual(10);
      expect(elapsedMs).toBeLessThan(200); // Should handle 100 snippets quickly
    });

    it('should meet sub-100ms target with HNSW for typical dataset', async () => {
      const hnswConfig = VectorRetriever.getDefaultConfig();
      hnswConfig.dimensions = 7;
      const hnswRetriever = new VectorRetriever(hnswConfig, mockCache);
      
      // Setup mock
      const hnswEmbeddingService = (hnswRetriever as any).embeddingService;
      hnswEmbeddingService.generateBatchEmbeddings.mockImplementation(mockEmbeddingService.generateBatchEmbeddings);
      hnswEmbeddingService.generateEmbedding.mockImplementation(mockEmbeddingService.generateEmbedding);
      hnswEmbeddingService.getHealthStatus.mockImplementation(mockEmbeddingService.getHealthStatus);
      
      await hnswRetriever.buildIndex(testSnippets);
      
      const startTime = Date.now();
      const results = await hnswRetriever.search('test query');
      const elapsedMs = Date.now() - startTime;
      
      expect(results).toBeDefined();
      expect(elapsedMs).toBeLessThan(50); // HNSW should be faster
    });
  });
});