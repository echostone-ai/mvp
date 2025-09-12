// src/lib/services/__tests__/vectorRetriever.performance.comparison.test.ts
// Performance comparison tests between linear search and HNSW

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VectorRetriever, VectorConfig } from '../vectorRetriever';
import { EmbeddingCache } from '../embeddingCache';
import { FactbookSnippet } from '../factbookService';

// Mock the EmbeddingService
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
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
  getStats: vi.fn().mockReturnValue({
    size: 0,
    hitRate: 0,
    totalRequests: 0
  })
};

describe('VectorRetriever Performance Comparison', () => {
  let linearRetriever: VectorRetriever;
  let hnswRetriever: VectorRetriever;
  let testSnippets: FactbookSnippet[];
  let mockEmbeddingService: any;

  // Generate test data with various sizes
  const generateTestSnippets = (count: number): FactbookSnippet[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `snippet_${i}`,
      path: `test.snippet_${i}`,
      text: `Test snippet number ${i} with some meaningful content about topic ${i % 10}`,
      topics: [`topic_${i % 10}`],
      keywords: [`keyword_${i}`, `topic_${i % 10}`]
    }));
  };

  // Generate mock embeddings with some structure
  const generateMockEmbedding = (index: number, dimensions: number = 128): number[] => {
    const embedding = new Array(dimensions);
    const seed = index * 0.1;
    
    for (let i = 0; i < dimensions; i++) {
      // Create some structure in embeddings based on index
      embedding[i] = Math.sin(seed + i * 0.1) * 0.5 + Math.cos(seed * 2 + i * 0.05) * 0.3;
    }
    
    // Normalize the vector
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / norm);
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Use smaller dimensions for faster testing
    const dimensions = 128;

    const linearConfig: VectorConfig = {
      model: 'text-embedding-3-small',
      dimensions,
      maxResults: 20,
      similarityThreshold: 0.3,
      cacheEnabled: false, // Disable cache for pure performance testing
      indexType: 'linear'
    };

    const hnswConfig: VectorConfig = {
      model: 'text-embedding-3-small',
      dimensions,
      maxResults: 20,
      similarityThreshold: 0.3,
      cacheEnabled: false, // Disable cache for pure performance testing
      indexType: 'hnsw',
      hnswConfig: {
        maxConnections: 16,
        efConstruction: 200,
        efSearch: 50,
        maxLayers: 16,
        levelGenerationFactor: 1 / Math.log(2),
        seed: 42 // For reproducible results
      }
    };

    linearRetriever = new VectorRetriever(linearConfig, mockCache);
    hnswRetriever = new VectorRetriever(hnswConfig, mockCache);

    // Mock embedding generation for both retrievers
    const setupMockEmbedding = (retriever: VectorRetriever) => {
      const embeddingService = (retriever as any).embeddingService;
      
      embeddingService.generateEmbedding.mockImplementation(async (text: string) => {
        // Generate embedding based on text hash for consistency
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
          hash = ((hash << 5) - hash + text.charCodeAt(i)) & 0xffffffff;
        }
        
        const embedding = generateMockEmbedding(Math.abs(hash) % 10000, dimensions);
        return {
          text,
          embedding,
          model: linearConfig.model,
          dimensions
        };
      });

      embeddingService.generateBatchEmbeddings.mockImplementation(async (texts: string[]) => {
        const results = texts.map((text, index) => {
          const embedding = generateMockEmbedding(index, dimensions);
          return {
            text,
            embedding,
            model: linearConfig.model,
            dimensions
          };
        });

        return {
          results,
          totalTokens: texts.length * 10,
          processingTimeMs: 100,
          errors: []
        };
      });
    };

    setupMockEmbedding(linearRetriever);
    setupMockEmbedding(hnswRetriever);
  });

  describe('Index Building Performance', () => {
    it('should compare index building time for small dataset (100 snippets)', async () => {
      testSnippets = generateTestSnippets(100);

      // Test linear index building
      const linearStartTime = Date.now();
      await linearRetriever.buildIndex(testSnippets);
      const linearBuildTime = Date.now() - linearStartTime;

      // Test HNSW index building
      const hnswStartTime = Date.now();
      await hnswRetriever.buildIndex(testSnippets);
      const hnswBuildTime = Date.now() - hnswStartTime;

      console.log('Index Building Performance (100 snippets):', {
        linear_build_ms: linearBuildTime,
        hnsw_build_ms: hnswBuildTime,
        hnsw_overhead_ms: hnswBuildTime - linearBuildTime,
        hnsw_overhead_ratio: (hnswBuildTime / linearBuildTime).toFixed(2)
      });

      // Both should complete successfully
      expect(linearRetriever.getIndexStats().size).toBe(100);
      expect(hnswRetriever.getIndexStats().size).toBe(100);

      // HNSW might be slower to build but should be reasonable
      expect(hnswBuildTime).toBeLessThan(5000); // Should build within 5 seconds
    });

    it('should compare index building time for medium dataset (500 snippets)', async () => {
      testSnippets = generateTestSnippets(500);

      // Test linear index building
      const linearStartTime = Date.now();
      await linearRetriever.buildIndex(testSnippets);
      const linearBuildTime = Date.now() - linearStartTime;

      // Test HNSW index building
      const hnswStartTime = Date.now();
      await hnswRetriever.buildIndex(testSnippets);
      const hnswBuildTime = Date.now() - hnswStartTime;

      console.log('Index Building Performance (500 snippets):', {
        linear_build_ms: linearBuildTime,
        hnsw_build_ms: hnswBuildTime,
        hnsw_overhead_ms: hnswBuildTime - linearBuildTime,
        hnsw_overhead_ratio: (hnswBuildTime / linearBuildTime).toFixed(2)
      });

      // Both should complete successfully
      expect(linearRetriever.getIndexStats().size).toBe(500);
      expect(hnswRetriever.getIndexStats().size).toBe(500);

      // HNSW build time should scale better than quadratic
      expect(hnswBuildTime).toBeLessThan(15000); // Should build within 15 seconds
    });
  });

  describe('Search Performance', () => {
    beforeEach(async () => {
      // Use medium dataset for search performance tests
      testSnippets = generateTestSnippets(500);
      await linearRetriever.buildIndex(testSnippets);
      await hnswRetriever.buildIndex(testSnippets);
    });

    it('should compare single search performance', async () => {
      const testQuery = 'test query about topic 5';
      const searchCount = 10;

      // Warm up both retrievers
      await linearRetriever.search(testQuery, 5);
      await hnswRetriever.search(testQuery, 5);

      // Test linear search performance
      const linearTimes: number[] = [];
      for (let i = 0; i < searchCount; i++) {
        const startTime = Date.now();
        await linearRetriever.search(testQuery, 10);
        linearTimes.push(Date.now() - startTime);
      }

      // Test HNSW search performance
      const hnswTimes: number[] = [];
      for (let i = 0; i < searchCount; i++) {
        const startTime = Date.now();
        await hnswRetriever.search(testQuery, 10);
        hnswTimes.push(Date.now() - startTime);
      }

      const linearAvg = linearTimes.reduce((a, b) => a + b, 0) / linearTimes.length;
      const hnswAvg = hnswTimes.reduce((a, b) => a + b, 0) / hnswTimes.length;
      const speedup = linearAvg / hnswAvg;

      console.log('Single Search Performance:', {
        linear_avg_ms: linearAvg.toFixed(2),
        hnsw_avg_ms: hnswAvg.toFixed(2),
        speedup_ratio: speedup.toFixed(2),
        linear_p95_ms: linearTimes.sort()[Math.floor(linearTimes.length * 0.95)],
        hnsw_p95_ms: hnswTimes.sort()[Math.floor(hnswTimes.length * 0.95)]
      });

      // HNSW should be faster for this dataset size
      expect(hnswAvg).toBeLessThan(100); // Should be under 100ms
      
      // For 500 snippets, HNSW should show some benefit
      if (linearAvg > 50) { // Only expect speedup if linear is slow enough
        expect(speedup).toBeGreaterThan(1.2); // At least 20% faster
      }
    });

    it('should compare batch search performance', async () => {
      const testQueries = [
        'test query about topic 1',
        'another query about topic 2',
        'search for topic 3 content',
        'find information about topic 4',
        'query related to topic 5'
      ];

      // Test linear search batch performance
      const linearStartTime = Date.now();
      const linearResults = await Promise.all(
        testQueries.map(query => linearRetriever.search(query, 5))
      );
      const linearBatchTime = Date.now() - linearStartTime;

      // Test HNSW search batch performance
      const hnswStartTime = Date.now();
      const hnswResults = await Promise.all(
        testQueries.map(query => hnswRetriever.search(query, 5))
      );
      const hnswBatchTime = Date.now() - hnswStartTime;

      const speedup = linearBatchTime / hnswBatchTime;

      console.log('Batch Search Performance:', {
        linear_batch_ms: linearBatchTime,
        hnsw_batch_ms: hnswBatchTime,
        speedup_ratio: speedup.toFixed(2),
        queries_count: testQueries.length
      });

      // Both should return results
      expect(linearResults.every(r => Array.isArray(r))).toBe(true);
      expect(hnswResults.every(r => Array.isArray(r))).toBe(true);

      // HNSW should be faster for batch operations
      expect(hnswBatchTime).toBeLessThan(500); // Should complete batch within 500ms
    });

    it('should compare search accuracy between methods', async () => {
      const testQuery = 'test query about topic 3';
      const k = 10;

      const linearResults = await linearRetriever.search(testQuery, k);
      const hnswResults = await hnswRetriever.search(testQuery, k);

      console.log('Search Accuracy Comparison:', {
        linear_results_count: linearResults.length,
        hnsw_results_count: hnswResults.length,
        linear_top_similarity: linearResults[0]?.similarity.toFixed(3),
        hnsw_top_similarity: hnswResults[0]?.similarity.toFixed(3)
      });

      // Both should return similar number of results
      expect(Math.abs(linearResults.length - hnswResults.length)).toBeLessThanOrEqual(2);

      // Top results should have reasonable similarity scores
      if (linearResults.length > 0) {
        expect(linearResults[0].similarity).toBeGreaterThan(0);
      }
      if (hnswResults.length > 0) {
        expect(hnswResults[0].similarity).toBeGreaterThan(0);
      }

      // Check overlap in top results (should have some common results)
      if (linearResults.length > 0 && hnswResults.length > 0) {
        const linearIds = new Set(linearResults.slice(0, 5).map(r => r.snippet.id));
        const hnswIds = new Set(hnswResults.slice(0, 5).map(r => r.snippet.id));
        const overlap = [...linearIds].filter(id => hnswIds.has(id)).length;
        const overlapRatio = overlap / Math.min(5, linearResults.length, hnswResults.length);
        
        console.log('Top-5 Results Overlap:', {
          overlap_count: overlap,
          overlap_ratio: overlapRatio.toFixed(2)
        });

        // Should have reasonable overlap (HNSW is approximate)
        expect(overlapRatio).toBeGreaterThan(0.4); // At least 40% overlap
      }
    });
  });

  describe('Memory Usage Comparison', () => {
    it('should compare memory usage for different dataset sizes', async () => {
      const sizes = [100, 300, 500];
      
      for (const size of sizes) {
        const snippets = generateTestSnippets(size);
        
        // Build linear index
        const linearRetriever = new VectorRetriever({
          model: 'text-embedding-3-small',
          dimensions: 128,
          maxResults: 20,
          similarityThreshold: 0.3,
          cacheEnabled: false,
          indexType: 'linear'
        }, mockCache);
        
        // Setup mock for this retriever
        const linearEmbeddingService = (linearRetriever as any).embeddingService;
        linearEmbeddingService.generateBatchEmbeddings.mockImplementation(async (texts: string[]) => {
          const results = texts.map((text, index) => ({
            text,
            embedding: generateMockEmbedding(index, 128),
            model: 'text-embedding-3-small',
            dimensions: 128
          }));
          return { results, totalTokens: texts.length * 10, processingTimeMs: 100, errors: [] };
        });

        await linearRetriever.buildIndex(snippets);
        const linearMemory = linearRetriever.getMemoryUsage();

        // Build HNSW index
        const hnswRetriever = new VectorRetriever({
          model: 'text-embedding-3-small',
          dimensions: 128,
          maxResults: 20,
          similarityThreshold: 0.3,
          cacheEnabled: false,
          indexType: 'hnsw',
          hnswConfig: { seed: 42 }
        }, mockCache);

        // Setup mock for this retriever
        const hnswEmbeddingService = (hnswRetriever as any).embeddingService;
        hnswEmbeddingService.generateBatchEmbeddings.mockImplementation(async (texts: string[]) => {
          const results = texts.map((text, index) => ({
            text,
            embedding: generateMockEmbedding(index, 128),
            model: 'text-embedding-3-small',
            dimensions: 128
          }));
          return { results, totalTokens: texts.length * 10, processingTimeMs: 100, errors: [] };
        });

        await hnswRetriever.buildIndex(snippets);
        const hnswMemory = hnswRetriever.getMemoryUsage();

        console.log(`Memory Usage Comparison (${size} snippets):`, {
          linear_total_mb: linearMemory.totalMB.toFixed(2),
          hnsw_total_mb: hnswMemory.totalMB.toFixed(2),
          linear_index_mb: linearMemory.indexMB.toFixed(2),
          hnsw_index_mb: hnswMemory.indexMB.toFixed(2),
          memory_overhead_ratio: (hnswMemory.totalMB / linearMemory.totalMB).toFixed(2)
        });

        // Both should use reasonable memory
        expect(linearMemory.totalMB).toBeGreaterThan(0);
        expect(hnswMemory.totalMB).toBeGreaterThan(0);

        // HNSW might use more memory due to graph structure
        expect(hnswMemory.totalMB).toBeLessThan(100); // Should be under 100MB for test data
      }
    });
  });

  describe('Scalability Analysis', () => {
    it('should demonstrate HNSW scalability benefits', async () => {
      const sizes = [100, 200, 400];
      const results: Array<{
        size: number;
        linearSearchTime: number;
        hnswSearchTime: number;
        speedup: number;
      }> = [];

      for (const size of sizes) {
        const snippets = generateTestSnippets(size);
        
        // Create fresh retrievers for each size
        const linearConfig: VectorConfig = {
          model: 'text-embedding-3-small',
          dimensions: 64, // Smaller for faster testing
          maxResults: 20,
          similarityThreshold: 0.3,
          cacheEnabled: false,
          indexType: 'linear'
        };

        const hnswConfig: VectorConfig = {
          ...linearConfig,
          indexType: 'hnsw',
          hnswConfig: { seed: 42 }
        };

        const linearRet = new VectorRetriever(linearConfig, mockCache);
        const hnswRet = new VectorRetriever(hnswConfig, mockCache);

        // Setup mocks
        [linearRet, hnswRet].forEach(retriever => {
          const embeddingService = (retriever as any).embeddingService;
          embeddingService.generateBatchEmbeddings.mockImplementation(async (texts: string[]) => {
            const results = texts.map((text, index) => ({
              text,
              embedding: generateMockEmbedding(index, 64),
              model: 'text-embedding-3-small',
              dimensions: 64
            }));
            return { results, totalTokens: texts.length * 10, processingTimeMs: 100, errors: [] };
          });
          embeddingService.generateEmbedding.mockImplementation(async (text: string) => ({
            text,
            embedding: generateMockEmbedding(text.length, 64),
            model: 'text-embedding-3-small',
            dimensions: 64
          }));
        });

        // Build indices
        await linearRet.buildIndex(snippets);
        await hnswRet.buildIndex(snippets);

        // Measure search performance
        const testQuery = 'scalability test query';
        const searchRuns = 5;

        // Linear search timing
        const linearTimes: number[] = [];
        for (let i = 0; i < searchRuns; i++) {
          const start = Date.now();
          await linearRet.search(testQuery, 10);
          linearTimes.push(Date.now() - start);
        }

        // HNSW search timing
        const hnswTimes: number[] = [];
        for (let i = 0; i < searchRuns; i++) {
          const start = Date.now();
          await hnswRet.search(testQuery, 10);
          hnswTimes.push(Date.now() - start);
        }

        const linearAvg = linearTimes.reduce((a, b) => a + b, 0) / linearTimes.length;
        const hnswAvg = hnswTimes.reduce((a, b) => a + b, 0) / hnswTimes.length;
        const speedup = linearAvg / hnswAvg;

        results.push({
          size,
          linearSearchTime: linearAvg,
          hnswSearchTime: hnswAvg,
          speedup
        });
      }

      console.log('Scalability Analysis Results:', results);

      // HNSW should show better scaling characteristics
      expect(results.length).toBe(sizes.length);
      
      // For larger datasets, HNSW should be faster
      const largestResult = results[results.length - 1];
      expect(largestResult.hnswSearchTime).toBeLessThan(100); // Should be fast
      
      // Speedup should generally increase with dataset size
      if (results.length >= 2) {
        const firstSpeedup = results[0].speedup;
        const lastSpeedup = results[results.length - 1].speedup;
        
        console.log('Speedup Trend:', {
          first_speedup: firstSpeedup.toFixed(2),
          last_speedup: lastSpeedup.toFixed(2),
          improvement: (lastSpeedup / firstSpeedup).toFixed(2)
        });
      }
    });
  });

  describe('Sub-100ms Performance Target', () => {
    it('should achieve sub-100ms search with HNSW for typical factbook size', async () => {
      // Simulate typical factbook size (around 200-300 snippets)
      const factbookSize = 250;
      testSnippets = generateTestSnippets(factbookSize);

      await hnswRetriever.buildIndex(testSnippets);

      // Test multiple queries to get reliable timing
      const testQueries = [
        'snake story',
        'meetings at SXSW',
        'Tyler partner',
        'Olive pet',
        'George cat',
        'Morocco travel',
        'concert experience',
        'college friend',
        'rescue dog',
        'music festival'
      ];

      const searchTimes: number[] = [];

      for (const query of testQueries) {
        const startTime = Date.now();
        const results = await hnswRetriever.search(query, 10);
        const elapsedMs = Date.now() - startTime;
        
        searchTimes.push(elapsedMs);
        
        // Each search should return results
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
      }

      const avgSearchTime = searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length;
      const p95SearchTime = searchTimes.sort()[Math.floor(searchTimes.length * 0.95)];
      const maxSearchTime = Math.max(...searchTimes);

      console.log('Sub-100ms Performance Target Results:', {
        factbook_size: factbookSize,
        avg_search_ms: avgSearchTime.toFixed(2),
        p95_search_ms: p95SearchTime,
        max_search_ms: maxSearchTime,
        queries_tested: testQueries.length,
        sub_100ms_count: searchTimes.filter(t => t < 100).length
      });

      // Performance targets
      expect(avgSearchTime).toBeLessThan(100); // Average should be under 100ms
      expect(p95SearchTime).toBeLessThan(150); // P95 should be reasonable
      
      // At least 80% of searches should be under 100ms
      const sub100msRatio = searchTimes.filter(t => t < 100).length / searchTimes.length;
      expect(sub100msRatio).toBeGreaterThan(0.8);
    });
  });
});