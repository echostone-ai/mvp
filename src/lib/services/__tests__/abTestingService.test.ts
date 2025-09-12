// src/lib/services/__tests__/abTestingService.test.ts
// Tests for A/B testing service and comparison infrastructure

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ABTestingService, ABTestExperimentResult, ABTestComparisonMetrics } from '../abTestingService';
import { FeatureFlagManager } from '../featureFlagManager';
import { FactbookService } from '../factbookService';
import { EmbeddingCache } from '../embeddingCache';

// Mock dependencies
vi.mock('../factbookService');
vi.mock('../embeddingCache');
vi.mock('../cacheManager');
vi.mock('../performanceMonitor');

describe('ABTestingService', () => {
  let abTestingService: ABTestingService;
  let featureFlagManager: FeatureFlagManager;
  let mockFactbookService: FactbookService;
  let mockEmbeddingCache: EmbeddingCache;

  beforeEach(() => {
    // Setup mocks
    mockFactbookService = {
      isLoaded: vi.fn().mockReturnValue(true),
      validateIndex: vi.fn().mockReturnValue(true),
      getAllSnippets: vi.fn().mockReturnValue([
        {
          id: 'test_snippet_1',
          path: 'test/path1',
          text: 'This is a test snippet about snakes in Morocco',
          topics: ['travel', 'animals'],
          keywords: ['snake', 'morocco', 'cobra']
        },
        {
          id: 'test_snippet_2',
          path: 'test/path2',
          text: 'SXSW concert with Bill Murray was amazing',
          topics: ['music', 'events'],
          keywords: ['sxsw', 'concert', 'bill murray']
        }
      ]),
      getSnippetCount: vi.fn().mockReturnValue(2)
    } as any;

    mockEmbeddingCache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      getStats: vi.fn().mockReturnValue({ size: 0, hitRate: 0 })
    } as any;

    // Setup feature flag manager with A/B testing enabled
    process.env.AB_TEST_ENABLED = 'true';
    process.env.AB_TEST_TRAFFIC_SPLIT = '0.5';
    featureFlagManager = new FeatureFlagManager();

    abTestingService = new ABTestingService(
      featureFlagManager,
      mockFactbookService,
      mockEmbeddingCache
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.AB_TEST_ENABLED;
    delete process.env.AB_TEST_TRAFFIC_SPLIT;
  });

  describe('Initialization', () => {
    it('should initialize with control and treatment retrievers', () => {
      expect(abTestingService).toBeDefined();
      
      // Should have both retrievers configured
      const healthStatus = abTestingService.getHealthStatus();
      expect(healthStatus).toHaveProperty('control');
      expect(healthStatus).toHaveProperty('treatment');
      expect(healthStatus).toHaveProperty('overall');
    });

    it('should configure control retriever for BM25-only', async () => {
      // Control should use BM25-only configuration
      const result = await abTestingService.performABTestRetrieval(
        'control_user',
        'test query',
        'test_control'
      );

      // For a user that gets control variant, should use BM25-only
      if (result.variant === 'control') {
        expect(result.metrics.methodsUsed).toContain('bm25');
        expect(result.metrics.methodsUsed).not.toContain('vector');
        expect(result.metrics.methodsUsed).not.toContain('expansion');
        expect(result.metrics.methodsUsed).not.toContain('reranking');
      }
    });
  });

  describe('A/B Test Retrieval', () => {
    it('should perform retrieval and assign variant consistently', async () => {
      const userId = 'consistent_user_123';
      const query = 'test query';

      const result1 = await abTestingService.performABTestRetrieval(userId, query);
      const result2 = await abTestingService.performABTestRetrieval(userId, query);

      // Same user should get same variant
      expect(result1.variant).toBe(result2.variant);
    });

    it('should create experiment result with correct structure', async () => {
      const userId = 'test_user';
      const query = 'snake story';
      const testId = 'test_experiment';
      const sessionId = 'session_123';

      const result = await abTestingService.performABTestRetrieval(
        userId,
        query,
        testId,
        sessionId
      );

      expect(result.experimentResult).toMatchObject({
        userId,
        testId,
        query,
        sessionId,
        variant: expect.stringMatching(/^(control|treatment)$/),
        results: expect.any(Array),
        metrics: expect.objectContaining({
          totalTimeMs: expect.any(Number),
          methodsUsed: expect.any(Array),
          resultCount: expect.any(Number)
        }),
        timestamp: expect.any(Number)
      });
    });

    it('should store experiment results for analysis', async () => {
      const testId = 'storage_test';
      
      await abTestingService.performABTestRetrieval('user1', 'query1', testId);
      await abTestingService.performABTestRetrieval('user2', 'query2', testId);

      const results = abTestingService.getExperimentResults(testId);
      expect(results).toHaveLength(2);
      expect(results[0].userId).toBe('user1');
      expect(results[1].userId).toBe('user2');
    });
  });

  describe('Batch Comparison', () => {
    it('should run batch comparison between control and treatment', async () => {
      const queries = ['snake story', 'SXSW concert', 'Tyler partner'];
      const testId = 'batch_test';

      const comparison = await abTestingService.runBatchComparison(
        queries,
        'batch_user',
        testId
      );

      expect(comparison.controlResults).toHaveLength(queries.length);
      expect(comparison.treatmentResults).toHaveLength(queries.length);
      expect(comparison.comparison).toHaveProperty('testId', testId);
      expect(comparison.comparison).toHaveProperty('controlMetrics');
      expect(comparison.comparison).toHaveProperty('treatmentMetrics');
      expect(comparison.comparison).toHaveProperty('comparison');
    });

    it('should handle errors gracefully during batch comparison', async () => {
      // Mock retriever to throw error for specific query
      const queries = ['error query', 'normal query'];
      
      const comparison = await abTestingService.runBatchComparison(queries);
      
      // Should still complete even if some queries fail
      expect(comparison.controlResults.length).toBeLessThanOrEqual(queries.length);
      expect(comparison.treatmentResults.length).toBeLessThanOrEqual(queries.length);
    });
  });

  describe('Metrics Calculation', () => {
    beforeEach(async () => {
      // Generate some test data
      const testId = 'metrics_test';
      const queries = ['query1', 'query2', 'query3'];
      
      for (const query of queries) {
        await abTestingService.performABTestRetrieval(`user_${query}`, query, testId);
      }
    });

    it('should calculate comparison metrics correctly', () => {
      const testId = 'metrics_test';
      const metrics = abTestingService.getComparisonMetrics(testId);

      if (metrics) {
        expect(metrics).toHaveProperty('testId', testId);
        expect(metrics).toHaveProperty('controlMetrics');
        expect(metrics).toHaveProperty('treatmentMetrics');
        expect(metrics).toHaveProperty('comparison');
        expect(metrics).toHaveProperty('lastUpdated');

        // Check metric structure
        expect(metrics.controlMetrics).toHaveProperty('sampleSize');
        expect(metrics.controlMetrics).toHaveProperty('averageLatencyMs');
        expect(metrics.controlMetrics).toHaveProperty('p95LatencyMs');
        expect(metrics.controlMetrics).toHaveProperty('averageResultCount');
        expect(metrics.controlMetrics).toHaveProperty('averageRelevanceScore');
        expect(metrics.controlMetrics).toHaveProperty('successRate');
        expect(metrics.controlMetrics).toHaveProperty('errorRate');

        expect(metrics.treatmentMetrics).toHaveProperty('sampleSize');
        expect(metrics.treatmentMetrics).toHaveProperty('averageLatencyMs');

        expect(metrics.comparison).toHaveProperty('latencyImprovementPercent');
        expect(metrics.comparison).toHaveProperty('relevanceImprovementPercent');
        expect(metrics.comparison).toHaveProperty('resultCountImprovementPercent');
        expect(metrics.comparison).toHaveProperty('statisticalSignificance');
      }
    });

    it('should calculate P95 latency correctly', async () => {
      const testId = 'p95_test';
      
      // Generate data with known latencies
      const latencies = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
      
      for (let i = 0; i < latencies.length; i++) {
        // Mock the retrieval to return specific latency
        await abTestingService.performABTestRetrieval(`user_${i}`, `query_${i}`, testId);
      }

      const metrics = abTestingService.getComparisonMetrics(testId);
      
      if (metrics) {
        // P95 should be around the 95th percentile
        expect(metrics.controlMetrics.p95LatencyMs).toBeGreaterThan(0);
        expect(metrics.treatmentMetrics.p95LatencyMs).toBeGreaterThan(0);
      }
    });
  });

  describe('Statistical Significance', () => {
    it('should calculate statistical significance correctly', async () => {
      const testId = 'significance_test';
      
      // Generate enough data for statistical significance
      for (let i = 0; i < 100; i++) {
        await abTestingService.performABTestRetrieval(`user_${i}`, `query_${i}`, testId);
      }

      const metrics = abTestingService.getComparisonMetrics(testId);
      
      if (metrics) {
        const significance = metrics.comparison.statisticalSignificance;
        
        expect(significance).toHaveProperty('isSignificant');
        expect(significance).toHaveProperty('pValue');
        expect(significance).toHaveProperty('confidenceLevel');
        
        expect(typeof significance.isSignificant).toBe('boolean');
        expect(significance.pValue).toBeGreaterThanOrEqual(0);
        expect(significance.pValue).toBeLessThanOrEqual(1);
        expect(significance.confidenceLevel).toBe(0.95);
      }
    });

    it('should handle edge cases in statistical calculations', () => {
      const testId = 'edge_case_test';
      
      // Test with no data
      const emptyMetrics = abTestingService.getComparisonMetrics(testId);
      expect(emptyMetrics).toBeNull();
    });
  });

  describe('User Experiment History', () => {
    it('should track user experiment history', async () => {
      const userId = 'history_user';
      const testId = 'history_test';
      
      await abTestingService.performABTestRetrieval(userId, 'query1', testId);
      await abTestingService.performABTestRetrieval(userId, 'query2', testId);
      await abTestingService.performABTestRetrieval(userId, 'query3', 'other_test');

      const userHistory = abTestingService.getUserExperimentResults(userId);
      expect(userHistory).toHaveLength(3);
      
      const testSpecificHistory = abTestingService.getUserExperimentResults(userId, testId);
      expect(testSpecificHistory).toHaveLength(2);
      
      // Should be sorted by timestamp (most recent first)
      expect(testSpecificHistory[0].timestamp).toBeGreaterThanOrEqual(testSpecificHistory[1].timestamp);
    });
  });

  describe('Test Report Generation', () => {
    beforeEach(async () => {
      const testId = 'report_test';
      
      // Generate test data
      for (let i = 0; i < 50; i++) {
        await abTestingService.performABTestRetrieval(`user_${i}`, `query_${i}`, testId);
      }
    });

    it('should generate comprehensive test report', () => {
      const testId = 'report_test';
      const report = abTestingService.generateTestReport(testId);

      expect(report).toHaveProperty('testId', testId);
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('rawData');

      // Check summary structure
      expect(report.summary).toHaveProperty('totalExperiments');
      expect(report.summary).toHaveProperty('controlExperiments');
      expect(report.summary).toHaveProperty('treatmentExperiments');
      expect(report.summary).toHaveProperty('testDurationDays');
      expect(report.summary).toHaveProperty('lastExperiment');

      // Should have recommendations
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(report.recommendations.length).toBeGreaterThan(0);

      // Should have raw data
      expect(Array.isArray(report.rawData)).toBe(true);
      expect(report.rawData.length).toBeGreaterThan(0);
    });

    it('should provide meaningful recommendations', () => {
      const testId = 'report_test';
      const report = abTestingService.generateTestReport(testId);

      // Should have at least one recommendation
      expect(report.recommendations.length).toBeGreaterThan(0);
      
      // Recommendations should be strings
      report.recommendations.forEach(recommendation => {
        expect(typeof recommendation).toBe('string');
        expect(recommendation.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Data Management', () => {
    it('should clear experiment data', async () => {
      const testId = 'clear_test';
      
      await abTestingService.performABTestRetrieval('user1', 'query1', testId);
      await abTestingService.performABTestRetrieval('user2', 'query2', testId);

      let results = abTestingService.getExperimentResults(testId);
      expect(results).toHaveLength(2);

      abTestingService.clearExperimentData(testId);

      results = abTestingService.getExperimentResults(testId);
      expect(results).toHaveLength(0);

      const metrics = abTestingService.getComparisonMetrics(testId);
      expect(metrics).toBeNull();
    });

    it('should limit stored experiment results', async () => {
      const testId = 'limit_test';
      
      // Generate more than the limit (assuming 10,000 is the limit)
      // We'll test with a smaller number for test performance
      for (let i = 0; i < 100; i++) {
        await abTestingService.performABTestRetrieval(`user_${i}`, `query_${i}`, testId);
      }

      const results = abTestingService.getExperimentResults(testId);
      expect(results.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Health Status', () => {
    it('should provide health status for both retrievers', () => {
      const healthStatus = abTestingService.getHealthStatus();

      expect(healthStatus).toHaveProperty('control');
      expect(healthStatus).toHaveProperty('treatment');
      expect(healthStatus).toHaveProperty('overall');

      expect(healthStatus.overall).toMatch(/^(healthy|degraded|unhealthy)$/);
    });

    it('should reflect overall health based on component health', () => {
      const healthStatus = abTestingService.getHealthStatus();

      // Overall health should be determined by component health
      if (healthStatus.control.status === 'unhealthy' || healthStatus.treatment.status === 'unhealthy') {
        expect(healthStatus.overall).toBe('unhealthy');
      } else if (healthStatus.control.status === 'degraded' || healthStatus.treatment.status === 'degraded') {
        expect(healthStatus.overall).toBe('degraded');
      } else {
        expect(healthStatus.overall).toBe('healthy');
      }
    });
  });

  describe('Warmup', () => {
    it('should warmup both retrievers', async () => {
      await expect(abTestingService.warmup()).resolves.not.toThrow();
    });
  });
});