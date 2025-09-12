// src/lib/services/__tests__/hybridRetrieval.test.ts
// Tests for hybrid retrieval infrastructure and feature flags

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  HybridRetriever, 
  parseHybridRetrievalConfig, 
  HybridRetrievalConfig,
  RetrievalResult,
  RetrievalMetrics,
  HealthStatus
} from '../hybridRetrieval';
import { FactbookService, FactbookSnippet } from '../factbookService';

// Mock environment variables
const mockEnv = (env: Record<string, string>) => {
  Object.keys(env).forEach(key => {
    process.env[key] = env[key];
  });
};

const clearEnv = () => {
  delete process.env.RETRIEVAL_EMBEDDINGS;
  delete process.env.RETRIEVAL_EXPANSION;
  delete process.env.RETRIEVAL_RERANK;
  delete process.env.RETRIEVAL_EXPANSION_THRESHOLD;
  delete process.env.RETRIEVAL_MAX_RESULTS;
  delete process.env.RETRIEVAL_FUSION_K;
  delete process.env.RETRIEVAL_TIMEOUT_MS;
  delete process.env.RETRIEVAL_BM25_K1;
  delete process.env.RETRIEVAL_BM25_B;
  delete process.env.RETRIEVAL_VECTOR_THRESHOLD;
  delete process.env.RETRIEVAL_VECTOR_MAX_RESULTS;
  delete process.env.RETRIEVAL_BM25_WEIGHT;
  delete process.env.RETRIEVAL_VECTOR_WEIGHT;
};

describe('HybridRetrieval Configuration', () => {
  beforeEach(() => {
    clearEnv();
  });

  describe('parseHybridRetrievalConfig', () => {
    it('should use safe defaults when no environment variables are set', () => {
      const config = parseHybridRetrievalConfig();
      
      expect(config).toEqual({
        enableEmbeddings: true,
        enableExpansion: 'auto',
        enableReranking: false,
        expansionThreshold: 0.3,
        maxResults: 10,
        fusionK: 60,
        timeoutMs: 500,
        bm25K1: 1.2,
        bm25B: 0.75,
        vectorSimilarityThreshold: 0.3,
        vectorMaxResults: 20,
        bm25Weight: 0.6,
        vectorWeight: 0.4,
        expansionTimeoutMs: 200,
        lowConfidenceThreshold: 0.35,
        minResultsThreshold: 2,
        rerankTimeoutMs: 150
      });
    });

    it('should parse RETRIEVAL_EMBEDDINGS environment variable correctly', () => {
      mockEnv({ RETRIEVAL_EMBEDDINGS: 'off' });
      const config = parseHybridRetrievalConfig();
      expect(config.enableEmbeddings).toBe(false);

      mockEnv({ RETRIEVAL_EMBEDDINGS: 'on' });
      const config2 = parseHybridRetrievalConfig();
      expect(config2.enableEmbeddings).toBe(true);

      mockEnv({ RETRIEVAL_EMBEDDINGS: 'invalid' });
      const config3 = parseHybridRetrievalConfig();
      expect(config3.enableEmbeddings).toBe(true); // Default to true for invalid values
    });

    it('should parse RETRIEVAL_EXPANSION environment variable correctly', () => {
      mockEnv({ RETRIEVAL_EXPANSION: 'off' });
      const config = parseHybridRetrievalConfig();
      expect(config.enableExpansion).toBe('off');

      mockEnv({ RETRIEVAL_EXPANSION: 'auto' });
      const config2 = parseHybridRetrievalConfig();
      expect(config2.enableExpansion).toBe('auto');

      mockEnv({ RETRIEVAL_EXPANSION: 'invalid' });
      const config3 = parseHybridRetrievalConfig();
      expect(config3.enableExpansion).toBe('auto'); // Default to auto for invalid values
    });

    it('should parse RETRIEVAL_RERANK environment variable correctly', () => {
      mockEnv({ RETRIEVAL_RERANK: 'on' });
      const config = parseHybridRetrievalConfig();
      expect(config.enableReranking).toBe(true);

      mockEnv({ RETRIEVAL_RERANK: 'off' });
      const config2 = parseHybridRetrievalConfig();
      expect(config2.enableReranking).toBe(false);

      mockEnv({ RETRIEVAL_RERANK: 'invalid' });
      const config3 = parseHybridRetrievalConfig();
      expect(config3.enableReranking).toBe(false); // Default to false for invalid values
    });

    it('should parse numeric configuration values correctly', () => {
      mockEnv({
        RETRIEVAL_EXPANSION_THRESHOLD: '0.5',
        RETRIEVAL_MAX_RESULTS: '15',
        RETRIEVAL_FUSION_K: '80',
        RETRIEVAL_TIMEOUT_MS: '1000',
        RETRIEVAL_BM25_K1: '1.5',
        RETRIEVAL_BM25_B: '0.8',
        RETRIEVAL_VECTOR_THRESHOLD: '0.4',
        RETRIEVAL_VECTOR_MAX_RESULTS: '25',
        RETRIEVAL_BM25_WEIGHT: '0.7',
        RETRIEVAL_VECTOR_WEIGHT: '0.3'
      });

      const config = parseHybridRetrievalConfig();
      
      expect(config.expansionThreshold).toBe(0.5);
      expect(config.maxResults).toBe(15);
      expect(config.fusionK).toBe(80);
      expect(config.timeoutMs).toBe(1000);
      expect(config.bm25K1).toBe(1.5);
      expect(config.bm25B).toBe(0.8);
      expect(config.vectorSimilarityThreshold).toBe(0.4);
      expect(config.vectorMaxResults).toBe(25);
      expect(config.bm25Weight).toBe(0.7);
      expect(config.vectorWeight).toBe(0.3);
    });

    it('should handle invalid numeric values gracefully', () => {
      mockEnv({
        RETRIEVAL_EXPANSION_THRESHOLD: 'invalid',
        RETRIEVAL_MAX_RESULTS: 'not_a_number',
        RETRIEVAL_TIMEOUT_MS: ''
      });

      const config = parseHybridRetrievalConfig();
      
      expect(config.expansionThreshold).toBeNaN();
      expect(config.maxResults).toBeNaN();
      expect(config.timeoutMs).toBe(500); // Falls back to default for empty string
    });
  });
});

describe('HybridRetriever', () => {
  let hybridRetriever: HybridRetriever;
  let mockFactbookService: FactbookService;
  let config: HybridRetrievalConfig;

  const mockFactbookData = {
    pets: {
      olive: {
        id: 'pets.olive',
        text: 'Olive is a Puerto Rican street dog who loves adventures and treats.',
        topics: ['pets', 'dogs', 'olive'],
        keywords: ['olive', 'puerto', 'rican', 'street', 'dog', 'adventures', 'treats']
      },
      romeo: {
        id: 'pets.romeo', 
        text: 'Romeo is a playful cat who enjoys sunny windowsills.',
        topics: ['pets', 'cats', 'romeo'],
        keywords: ['romeo', 'cat', 'playful', 'sunny', 'windowsills']
      }
    },
    places: {
      morocco: {
        id: 'places.morocco',
        text: 'In Morocco, I encountered a cobra during a desert expedition.',
        topics: ['places', 'morocco', 'travel'],
        keywords: ['morocco', 'cobra', 'desert', 'expedition', 'snake']
      }
    }
  };

  beforeEach(async () => {
    clearEnv();
    
    // Create default config
    config = parseHybridRetrievalConfig();
    
    // Create mock factbook service
    mockFactbookService = FactbookService.getInstance();
    await mockFactbookService.loadFactbook(mockFactbookData);
    
    // Create hybrid retriever
    hybridRetriever = new HybridRetriever(config, mockFactbookService);
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with provided config and factbook service', () => {
      const customConfig: HybridRetrievalConfig = {
        ...config,
        enableEmbeddings: false,
        enableExpansion: 'off',
        maxResults: 5
      };

      const retriever = new HybridRetriever(customConfig, mockFactbookService);
      
      expect(retriever.getConfig()).toEqual(customConfig);
    });

    it('should use singleton factbook service when none provided', () => {
      const retriever = new HybridRetriever(config);
      expect(retriever).toBeDefined();
    });

    it('should initialize health status correctly', () => {
      const healthStatus = hybridRetriever.getHealthStatus();
      
      expect(healthStatus.status).toBe('unhealthy'); // Because BM25 index not built yet
      expect(healthStatus.components.bm25).toBe('unhealthy'); // Index not built
      expect(healthStatus.components.vector).toBe('unhealthy'); // Enabled but not initialized (missing embedding cache)
      expect(healthStatus.components.expansion).toBe('unhealthy'); // Auto mode but not initialized (missing OpenAI API key)
      expect(healthStatus.components.reranking).toBe('degraded'); // Disabled
      expect(healthStatus.lastCheck).toBeGreaterThan(0);
      expect(Array.isArray(healthStatus.details)).toBe(true);
    });
  });

  describe('Basic Retrieval', () => {
    beforeEach(async () => {
      // Warmup to build BM25 index
      await hybridRetriever.warmup();
    });

    it('should perform BM25 retrieval successfully', async () => {
      const result = await hybridRetriever.retrieve('olive dog');
      
      expect(result.results).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].snippet.id).toBe('pets.olive');
      expect(result.results[0].source).toBe('bm25');
      expect(result.metrics.methodsUsed).toContain('bm25');
      expect(result.metrics.bm25TimeMs).toBeGreaterThanOrEqual(0);
      expect(result.metrics.totalTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty query gracefully', async () => {
      const result = await hybridRetriever.retrieve('');
      
      expect(result.results).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.metrics.errors.length).toBe(0);
    });

    it('should handle query with no matches', async () => {
      const result = await hybridRetriever.retrieve('nonexistent topic');
      
      expect(result.results).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.results.length).toBe(0);
      expect(result.metrics.confidenceScore).toBeLessThan(0.5);
    });

    it('should respect maxResults configuration', async () => {
      const customConfig = { ...config, maxResults: 1 };
      const retriever = new HybridRetriever(customConfig, mockFactbookService);
      
      const result = await retriever.retrieve('pets');
      
      expect(result.results.length).toBeLessThanOrEqual(1);
    });

    it('should include proper metadata in results', async () => {
      const result = await hybridRetriever.retrieve('olive');
      
      expect(result.results.length).toBeGreaterThan(0);
      const firstResult = result.results[0];
      
      expect(firstResult.snippet).toBeDefined();
      expect(firstResult.score).toBeDefined();
      expect(firstResult.source).toBe('bm25');
      expect(firstResult.confidence).toBeDefined();
      expect(firstResult.metadata).toBeDefined();
      expect(firstResult.metadata?.bm25Score).toBeDefined();
    });
  });

  describe('Metrics Collection', () => {
    beforeEach(async () => {
      // Warmup to build BM25 index
      await hybridRetriever.warmup();
    });

    it('should collect comprehensive metrics', async () => {
      const result = await hybridRetriever.retrieve('olive dog');
      const metrics = result.metrics;
      
      expect(metrics.totalTimeMs).toBeGreaterThanOrEqual(0);
      expect(metrics.bm25TimeMs).toBeGreaterThanOrEqual(0);
      expect(metrics.methodsUsed).toContain('bm25');
      expect(metrics.resultCount).toBe(result.results.length);
      expect(typeof metrics.confidenceScore).toBe('number');
      expect(typeof metrics.expansionTriggered).toBe('boolean');
      expect(typeof metrics.rerankingApplied).toBe('boolean');
      expect(typeof metrics.fallbackUsed).toBe('boolean');
      expect(Array.isArray(metrics.errors)).toBe(true);
      expect(Array.isArray(metrics.warnings)).toBe(true);
    });

    it('should track errors in metrics when retrieval fails', async () => {
      // Mock factbook service to throw error
      const errorFactbookService = {
        ...mockFactbookService,
        querySnippets: vi.fn().mockImplementation(() => {
          throw new Error('Mock factbook error');
        }),
        isLoaded: vi.fn().mockReturnValue(true),
        validateIndex: vi.fn().mockReturnValue(true)
      } as any;

      const retriever = new HybridRetriever(config, errorFactbookService);
      const result = await retriever.retrieve('test query');
      
      expect(result.metrics.errors.length).toBeGreaterThan(0);
      expect(result.metrics.fallbackUsed).toBe(true);
      expect(result.results.length).toBe(0);
    });
  });

  describe('Health Monitoring', () => {
    it('should provide health status', () => {
      const healthStatus = hybridRetriever.getHealthStatus();
      
      expect(healthStatus.status).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(healthStatus.components).toBeDefined();
      expect(healthStatus.components.bm25).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(healthStatus.components.vector).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(healthStatus.components.expansion).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(healthStatus.components.reranking).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(healthStatus.lastCheck).toBeGreaterThan(0);
      expect(Array.isArray(healthStatus.details)).toBe(true);
    });

    it('should update health status when factbook is not loaded', () => {
      const unloadedFactbookService = {
        ...mockFactbookService,
        isLoaded: vi.fn().mockReturnValue(false),
        validateIndex: vi.fn().mockReturnValue(false)
      } as any;

      const retriever = new HybridRetriever(config, unloadedFactbookService);
      const healthStatus = retriever.getHealthStatus();
      
      expect(healthStatus.status).toBe('unhealthy');
      expect(healthStatus.components.bm25).toBe('unhealthy');
    });

    it('should refresh health status after timeout', async () => {
      const healthStatus1 = hybridRetriever.getHealthStatus();
      const firstCheck = healthStatus1.lastCheck;
      
      // Wait a bit and force refresh by mocking time
      const originalNow = Date.now;
      Date.now = vi.fn().mockReturnValue(firstCheck + 31000); // 31 seconds later
      
      const healthStatus2 = hybridRetriever.getHealthStatus();
      
      expect(healthStatus2.lastCheck).toBeGreaterThan(firstCheck);
      
      // Restore original Date.now
      Date.now = originalNow;
    });
  });

  describe('Warmup', () => {
    it('should warmup successfully when factbook is loaded', async () => {
      await expect(hybridRetriever.warmup()).resolves.not.toThrow();
    });

    it('should fail warmup when factbook is not loaded', async () => {
      const unloadedFactbookService = {
        ...mockFactbookService,
        isLoaded: vi.fn().mockReturnValue(false)
      } as any;

      const retriever = new HybridRetriever(config, unloadedFactbookService);
      
      await expect(retriever.warmup()).rejects.toThrow('FactbookService not loaded');
    });

    it('should fail warmup when factbook index is invalid', async () => {
      const invalidFactbookService = {
        ...mockFactbookService,
        isLoaded: vi.fn().mockReturnValue(true),
        validateIndex: vi.fn().mockReturnValue(false)
      } as any;

      const retriever = new HybridRetriever(config, invalidFactbookService);
      
      await expect(retriever.warmup()).rejects.toThrow('index validation failed');
    });
  });

  describe('Configuration Management', () => {
    it('should return current configuration', () => {
      const currentConfig = hybridRetriever.getConfig();
      expect(currentConfig).toEqual(config);
    });

    it('should update configuration at runtime', () => {
      const updates = {
        maxResults: 15,
        enableReranking: true,
        timeoutMs: 1000
      };

      hybridRetriever.updateConfig(updates);
      const updatedConfig = hybridRetriever.getConfig();
      
      expect(updatedConfig.maxResults).toBe(15);
      expect(updatedConfig.enableReranking).toBe(true);
      expect(updatedConfig.timeoutMs).toBe(1000);
      
      // Other config values should remain unchanged
      expect(updatedConfig.enableEmbeddings).toBe(config.enableEmbeddings);
      expect(updatedConfig.enableExpansion).toBe(config.enableExpansion);
    });

    it('should update health status after configuration change', () => {
      const initialHealth = hybridRetriever.getHealthStatus();
      
      hybridRetriever.updateConfig({ enableReranking: true });
      
      const updatedHealth = hybridRetriever.getHealthStatus();
      expect(updatedHealth.lastCheck).toBeGreaterThanOrEqual(initialHealth.lastCheck);
    });
  });

  describe('Keyword Extraction', () => {
    beforeEach(async () => {
      // Warmup to build BM25 index
      await hybridRetriever.warmup();
    });

    it('should extract keywords from simple queries', async () => {
      // Test keyword extraction indirectly through retrieval
      const result = await hybridRetriever.retrieve('olive dog adventures');
      
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].snippet.id).toBe('pets.olive');
    });

    it('should handle queries with special characters', async () => {
      const result = await hybridRetriever.retrieve('Olivé\'s adventures!');
      
      expect(result.results).toBeDefined();
      expect(result.metrics.errors.length).toBe(0);
    });

    it('should filter short words', async () => {
      const result = await hybridRetriever.retrieve('a an the olive dog');
      
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].snippet.id).toBe('pets.olive');
    });
  });

  describe('Logging and Monitoring', () => {
    beforeEach(async () => {
      // Warmup to build BM25 index
      await hybridRetriever.warmup();
    });

    it('should log retrieval operations', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await hybridRetriever.retrieve('olive');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'hybrid_retrieval_start',
        expect.objectContaining({
          query: 'olive',
          config: expect.any(Object)
        })
      );
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'hybrid_retrieval_complete',
        expect.objectContaining({
          query: 'olive',
          result_count: expect.any(Number),
          methods_used: expect.arrayContaining(['bm25']),
          total_time_ms: expect.any(Number)
        })
      );
      
      consoleSpy.mockRestore();
    });

    it('should log errors appropriately', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock factbook service to throw error during BM25 search
      const errorFactbookService = {
        ...mockFactbookService,
        isLoaded: vi.fn().mockReturnValue(true),
        validateIndex: vi.fn().mockReturnValue(true),
        getAllSnippets: vi.fn().mockImplementation(() => {
          throw new Error('Mock error');
        })
      } as any;

      const retriever = new HybridRetriever(config, errorFactbookService);
      
      try {
        await retriever.warmup(); // This will fail during BM25 index building
      } catch (error) {
        // Expected to throw
      }
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'hybrid_retrieval_warmup_error',
        expect.objectContaining({
          error: 'Mock error'
        })
      );
      
      consoleErrorSpy.mockRestore();
    });
  });
});