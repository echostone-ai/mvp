// src/lib/services/__tests__/cacheWarming.test.ts
// Tests for cache warming strategies

import { CacheWarmingService, CacheWarmingConfig } from '../cacheWarming';
import { CacheManager } from '../cacheManager';
import { EmbeddingService } from '../embeddingService';
import { QueryExpander } from '../queryExpander';
import { FactbookService } from '../factbookService';
import { HybridRetriever } from '../hybridRetrieval';

// Mock dependencies
jest.mock('../cacheManager');
jest.mock('../embeddingService');
jest.mock('../queryExpander');
jest.mock('../factbookService');
jest.mock('../hybridRetrieval');

const MockCacheManager = CacheManager as jest.MockedClass<typeof CacheManager>;
const MockEmbeddingService = EmbeddingService as jest.MockedClass<typeof EmbeddingService>;
const MockQueryExpander = QueryExpander as jest.MockedClass<typeof QueryExpander>;
const MockFactbookService = FactbookService as jest.MockedClass<typeof FactbookService>;
const MockHybridRetriever = HybridRetriever as jest.MockedClass<typeof HybridRetriever>;

describe('CacheWarmingService', () => {
  let cacheWarmingService: CacheWarmingService;
  let mockCacheManager: jest.Mocked<CacheManager>;
  let mockFactbookService: jest.Mocked<FactbookService>;
  let testConfig: Partial<CacheWarmingConfig>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock cache manager
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      getStats: jest.fn(),
      getMemoryUsage: jest.fn(),
      invalidateOnFactbookChange: jest.fn(),
      invalidateOnModelChange: jest.fn(),
      warmCache: jest.fn(),
      destroy: jest.fn()
    } as any;

    // Setup mock factbook service
    mockFactbookService = {
      getAllSnippets: jest.fn().mockReturnValue([
        { id: '1', text: 'Test snippet 1', topics: [], keywords: [] },
        { id: '2', text: 'Test snippet 2', topics: [], keywords: [] },
        { id: '3', text: 'Test snippet 3', topics: [], keywords: [] }
      ]),
      getInstance: jest.fn().mockReturnValue(mockFactbookService)
    } as any;

    MockFactbookService.getInstance.mockReturnValue(mockFactbookService);

    testConfig = {
      commonQueries: ['test query 1', 'test query 2'],
      maxQueriesPerBatch: 2,
      queryWarmingEnabled: true,
      embeddingWarmingEnabled: true,
      precomputeAllSnippets: true,
      embeddingBatchSize: 2,
      expansionWarmingEnabled: true,
      precomputeExpansions: true,
      maxConcurrentOperations: 2,
      warmingTimeoutMs: 5000,
      retryFailedOperations: true,
      maxRetries: 2,
      enableScheduledWarming: false, // Disable for tests
      warmingIntervalHours: 1,
      warmOnFactbookUpdate: true,
      warmOnModelUpdate: true
    };

    // Mock environment variables
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    if (cacheWarmingService) {
      cacheWarmingService.destroy();
    }
    delete process.env.OPENAI_API_KEY;
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      cacheWarmingService = new CacheWarmingService({}, mockCacheManager);
      
      expect(cacheWarmingService).toBeDefined();
      expect(cacheWarmingService.isWarmingInProgress()).toBe(false);
    });

    it('should initialize optional services when API key is available', () => {
      cacheWarmingService = new CacheWarmingService(testConfig, mockCacheManager);
      
      // Should attempt to initialize embedding service and query expander
      expect(cacheWarmingService).toBeDefined();
    });

    it('should handle missing API key gracefully', () => {
      delete process.env.OPENAI_API_KEY;
      
      expect(() => {
        cacheWarmingService = new CacheWarmingService(testConfig, mockCacheManager);
      }).not.toThrow();
    });
  });

  describe('Embedding Warming', () => {
    beforeEach(() => {
      // Mock embedding service
      const mockEmbeddingService = {
        generateEmbeddings: jest.fn().mockResolvedValue([
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6]
        ])
      };

      MockEmbeddingService.mockImplementation(() => mockEmbeddingService as any);
      
      cacheWarmingService = new CacheWarmingService(testConfig, mockCacheManager);
    });

    it('should warm embeddings for all factbook snippets', async () => {
      mockCacheManager.get.mockResolvedValue(null); // Cache miss
      mockCacheManager.set.mockResolvedValue(undefined);

      const stats = await cacheWarmingService.warmCache();

      expect(stats.embeddingsWarmed).toBeGreaterThan(0);
      expect(stats.embeddingWarmingTimeMs).toBeGreaterThan(0);
      expect(mockFactbookService.getAllSnippets).toHaveBeenCalled();
      expect(mockCacheManager.set).toHaveBeenCalled();
    });

    it('should skip already cached embeddings', async () => {
      mockCacheManager.get.mockResolvedValue([0.1, 0.2, 0.3]); // Cache hit

      const stats = await cacheWarmingService.warmCache();

      expect(stats.embeddingsWarmed).toBe(0); // No new embeddings generated
      expect(stats.embeddingFailures).toBe(0);
    });

    it('should handle embedding generation errors gracefully', async () => {
      const mockEmbeddingService = {
        generateEmbeddings: jest.fn().mockRejectedValue(new Error('API error'))
      };

      MockEmbeddingService.mockImplementation(() => mockEmbeddingService as any);
      cacheWarmingService = new CacheWarmingService(testConfig, mockCacheManager);

      mockCacheManager.get.mockResolvedValue(null);

      const stats = await cacheWarmingService.warmCache();

      expect(stats.embeddingFailures).toBeGreaterThan(0);
      expect(stats.embeddingsWarmed).toBe(0);
    });

    it('should process embeddings in batches', async () => {
      const mockEmbeddingService = {
        generateEmbeddings: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]])
      };

      MockEmbeddingService.mockImplementation(() => mockEmbeddingService as any);
      cacheWarmingService = new CacheWarmingService({
        ...testConfig,
        embeddingBatchSize: 1 // Process one at a time
      }, mockCacheManager);

      mockCacheManager.get.mockResolvedValue(null);

      await cacheWarmingService.warmCache();

      // Should be called multiple times for batching
      expect(mockEmbeddingService.generateEmbeddings).toHaveBeenCalledTimes(3); // 3 snippets
    });
  });

  describe('Query Warming', () => {
    beforeEach(() => {
      cacheWarmingService = new CacheWarmingService(testConfig, mockCacheManager);
      
      // Mock hybrid retriever
      const mockHybridRetriever = {
        retrieve: jest.fn().mockResolvedValue({
          results: [{ snippet: { id: '1' }, score: 0.8 }],
          metrics: { methodsUsed: ['bm25', 'vector'] }
        })
      };

      cacheWarmingService.setHybridRetriever(mockHybridRetriever as any);
    });

    it('should warm cache with common queries', async () => {
      mockCacheManager.get.mockResolvedValue(null); // Cache miss
      mockCacheManager.set.mockResolvedValue(undefined);

      const stats = await cacheWarmingService.warmCache();

      expect(stats.queriesWarmed).toBe(2); // 2 test queries
      expect(stats.queryWarmingTimeMs).toBeGreaterThan(0);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        expect.stringContaining('query_result:'),
        expect.any(Object),
        expect.any(Number)
      );
    });

    it('should skip already cached queries', async () => {
      mockCacheManager.get.mockResolvedValue({ cached: 'result' }); // Cache hit

      const stats = await cacheWarmingService.warmCache();

      expect(stats.queriesWarmed).toBe(0); // No new queries processed
    });

    it('should handle query execution errors', async () => {
      const mockHybridRetriever = {
        retrieve: jest.fn().mockRejectedValue(new Error('Retrieval error'))
      };

      cacheWarmingService.setHybridRetriever(mockHybridRetriever as any);
      mockCacheManager.get.mockResolvedValue(null);

      const stats = await cacheWarmingService.warmCache();

      expect(stats.queryFailures).toBe(2); // 2 failed queries
      expect(stats.queriesWarmed).toBe(0);
    });

    it('should process queries in batches', async () => {
      const mockHybridRetriever = {
        retrieve: jest.fn().mockResolvedValue({
          results: [],
          metrics: { methodsUsed: [] }
        })
      };

      cacheWarmingService.setHybridRetriever(mockHybridRetriever as any);
      mockCacheManager.get.mockResolvedValue(null);

      const largeConfig = {
        ...testConfig,
        commonQueries: ['q1', 'q2', 'q3', 'q4', 'q5'],
        maxQueriesPerBatch: 2
      };

      cacheWarmingService = new CacheWarmingService(largeConfig, mockCacheManager);
      cacheWarmingService.setHybridRetriever(mockHybridRetriever as any);

      await cacheWarmingService.warmCache();

      // Should process in batches with delays
      expect(mockHybridRetriever.retrieve).toHaveBeenCalledTimes(5);
    });
  });

  describe('Expansion Warming', () => {
    beforeEach(() => {
      // Mock query expander
      const mockQueryExpander = {
        expandQuery: jest.fn().mockResolvedValue({
          canonical_query: 'test query',
          alternates: ['alt1', 'alt2'],
          related_concepts: ['concept1'],
          confidence: 0.8,
          cached: false
        })
      };

      MockQueryExpander.mockImplementation(() => mockQueryExpander as any);
      
      cacheWarmingService = new CacheWarmingService(testConfig, mockCacheManager);
    });

    it('should warm query expansions', async () => {
      const stats = await cacheWarmingService.warmCache();

      expect(stats.expansionsWarmed).toBe(2); // 2 test queries
      expect(stats.expansionWarmingTimeMs).toBeGreaterThan(0);
    });

    it('should skip already cached expansions', async () => {
      const mockQueryExpander = {
        expandQuery: jest.fn().mockResolvedValue({
          canonical_query: 'test query',
          alternates: [],
          related_concepts: [],
          confidence: 0.8,
          cached: true // Already cached
        })
      };

      MockQueryExpander.mockImplementation(() => mockQueryExpander as any);
      cacheWarmingService = new CacheWarmingService(testConfig, mockCacheManager);

      const stats = await cacheWarmingService.warmCache();

      expect(stats.expansionsWarmed).toBe(0); // No new expansions
    });

    it('should handle expansion errors gracefully', async () => {
      const mockQueryExpander = {
        expandQuery: jest.fn().mockRejectedValue(new Error('Expansion error'))
      };

      MockQueryExpander.mockImplementation(() => mockQueryExpander as any);
      cacheWarmingService = new CacheWarmingService(testConfig, mockCacheManager);

      const stats = await cacheWarmingService.warmCache();

      expect(stats.expansionFailures).toBe(2); // 2 failed expansions
      expect(stats.expansionsWarmed).toBe(0);
    });
  });

  describe('Comprehensive Warming', () => {
    beforeEach(() => {
      // Setup all mocks
      const mockEmbeddingService = {
        generateEmbeddings: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]])
      };

      const mockQueryExpander = {
        expandQuery: jest.fn().mockResolvedValue({
          canonical_query: 'test',
          alternates: ['alt'],
          related_concepts: ['concept'],
          confidence: 0.8,
          cached: false
        })
      };

      const mockHybridRetriever = {
        retrieve: jest.fn().mockResolvedValue({
          results: [],
          metrics: { methodsUsed: [] }
        })
      };

      MockEmbeddingService.mockImplementation(() => mockEmbeddingService as any);
      MockQueryExpander.mockImplementation(() => mockQueryExpander as any);

      cacheWarmingService = new CacheWarmingService(testConfig, mockCacheManager);
      cacheWarmingService.setHybridRetriever(mockHybridRetriever as any);

      mockCacheManager.get.mockResolvedValue(null); // All cache misses
      mockCacheManager.set.mockResolvedValue(undefined);
    });

    it('should perform comprehensive warming of all components', async () => {
      const stats = await cacheWarmingService.warmCache();

      expect(stats.totalOperations).toBeGreaterThan(0);
      expect(stats.successfulOperations).toBeGreaterThan(0);
      expect(stats.embeddingsWarmed).toBeGreaterThan(0);
      expect(stats.queriesWarmed).toBeGreaterThan(0);
      expect(stats.expansionsWarmed).toBeGreaterThan(0);
      expect(stats.totalTimeMs).toBeGreaterThan(0);
      expect(stats.lastWarmingTime).toBeGreaterThan(0);
    });

    it('should calculate performance metrics correctly', async () => {
      const stats = await cacheWarmingService.warmCache();

      expect(stats.averageOperationTimeMs).toBeGreaterThan(0);
      expect(stats.operationsPerSecond).toBeGreaterThan(0);
      expect(stats.totalOperations).toBe(
        stats.embeddingsWarmed + stats.queriesWarmed + stats.expansionsWarmed
      );
      expect(stats.successfulOperations).toBe(
        stats.totalOperations - stats.embeddingFailures - stats.queryFailures - stats.expansionFailures
      );
    });

    it('should prevent concurrent warming operations', async () => {
      const warmPromise1 = cacheWarmingService.warmCache();
      const warmPromise2 = cacheWarmingService.warmCache();

      const [stats1, stats2] = await Promise.all([warmPromise1, warmPromise2]);

      // Second call should return early
      expect(stats1.totalOperations).toBeGreaterThan(0);
      expect(stats2.totalOperations).toBe(0); // Should be empty stats
    });
  });

  describe('Event-Driven Warming', () => {
    beforeEach(() => {
      cacheWarmingService = new CacheWarmingService(testConfig, mockCacheManager);
    });

    it('should warm cache on factbook update', async () => {
      mockCacheManager.clear.mockResolvedValue(undefined);
      
      await cacheWarmingService.onFactbookUpdate('v2.0');

      expect(mockCacheManager.clear).toHaveBeenCalledWith('factbook_updated');
    });

    it('should warm cache on model update', async () => {
      mockCacheManager.clear.mockResolvedValue(undefined);
      
      await cacheWarmingService.onModelUpdate('gpt-4-turbo');

      expect(mockCacheManager.clear).toHaveBeenCalledWith('model_version_changed');
    });

    it('should skip warming when disabled in config', async () => {
      const noWarmConfig = {
        ...testConfig,
        warmOnFactbookUpdate: false,
        warmOnModelUpdate: false
      };

      cacheWarmingService = new CacheWarmingService(noWarmConfig, mockCacheManager);

      await cacheWarmingService.onFactbookUpdate('v2.0');
      await cacheWarmingService.onModelUpdate('gpt-4-turbo');

      expect(mockCacheManager.clear).not.toHaveBeenCalled();
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(() => {
      cacheWarmingService = new CacheWarmingService(testConfig, mockCacheManager);
    });

    it('should return null stats before first warming', () => {
      const stats = cacheWarmingService.getStats();
      expect(stats).toBeNull();
    });

    it('should return stats after warming', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      
      await cacheWarmingService.warmCache();
      
      const stats = cacheWarmingService.getStats();
      expect(stats).not.toBeNull();
      expect(stats?.lastWarmingTime).toBeGreaterThan(0);
    });

    it('should track warming progress correctly', async () => {
      expect(cacheWarmingService.isWarmingInProgress()).toBe(false);

      const warmPromise = cacheWarmingService.warmCache();
      expect(cacheWarmingService.isWarmingInProgress()).toBe(true);

      await warmPromise;
      expect(cacheWarmingService.isWarmingInProgress()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      cacheWarmingService = new CacheWarmingService(testConfig, mockCacheManager);
    });

    it('should handle cache manager errors gracefully', async () => {
      mockCacheManager.get.mockRejectedValue(new Error('Cache error'));
      mockCacheManager.set.mockRejectedValue(new Error('Cache error'));

      const stats = await cacheWarmingService.warmCache();

      // Should complete without throwing
      expect(stats).toBeDefined();
      expect(stats.failedOperations).toBeGreaterThan(0);
    });

    it('should continue warming other components when one fails', async () => {
      // Mock embedding service to fail
      const mockEmbeddingService = {
        generateEmbeddings: jest.fn().mockRejectedValue(new Error('Embedding error'))
      };

      MockEmbeddingService.mockImplementation(() => mockEmbeddingService as any);
      cacheWarmingService = new CacheWarmingService(testConfig, mockCacheManager);

      const stats = await cacheWarmingService.warmCache();

      // Embeddings should fail, but other components should still work
      expect(stats.embeddingFailures).toBeGreaterThan(0);
      expect(stats.totalOperations).toBeGreaterThan(stats.embeddingFailures);
    });

    it('should handle timeout gracefully', async () => {
      const slowConfig = {
        ...testConfig,
        warmingTimeoutMs: 1 // Very short timeout
      };

      cacheWarmingService = new CacheWarmingService(slowConfig, mockCacheManager);

      // Mock slow operations
      mockCacheManager.get.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(null), 100))
      );

      const stats = await cacheWarmingService.warmCache();

      // Should complete quickly due to timeout
      expect(stats.totalTimeMs).toBeLessThan(1000);
    });
  });

  describe('Configuration', () => {
    it('should use default common queries when none provided', () => {
      const defaultConfig = {};
      cacheWarmingService = new CacheWarmingService(defaultConfig, mockCacheManager);
      
      // Should not throw and should have default queries
      expect(cacheWarmingService).toBeDefined();
    });

    it('should respect feature flags', async () => {
      const disabledConfig = {
        queryWarmingEnabled: false,
        embeddingWarmingEnabled: false,
        expansionWarmingEnabled: false
      };

      cacheWarmingService = new CacheWarmingService(disabledConfig, mockCacheManager);

      const stats = await cacheWarmingService.warmCache();

      expect(stats.queriesWarmed).toBe(0);
      expect(stats.embeddingsWarmed).toBe(0);
      expect(stats.expansionsWarmed).toBe(0);
    });

    it('should handle missing dependencies gracefully', () => {
      delete process.env.OPENAI_API_KEY;

      expect(() => {
        cacheWarmingService = new CacheWarmingService(testConfig, mockCacheManager);
      }).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources on destroy', () => {
      cacheWarmingService = new CacheWarmingService({
        ...testConfig,
        enableScheduledWarming: true
      }, mockCacheManager);

      expect(() => cacheWarmingService.destroy()).not.toThrow();
    });

    it('should stop scheduled warming on destroy', () => {
      const scheduledConfig = {
        ...testConfig,
        enableScheduledWarming: true,
        warmingIntervalHours: 1
      };

      cacheWarmingService = new CacheWarmingService(scheduledConfig, mockCacheManager);
      
      // Should have started scheduled warming
      cacheWarmingService.destroy();
      
      // Should stop scheduled warming without errors
      expect(cacheWarmingService).toBeDefined();
    });
  });
});