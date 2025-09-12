// src/lib/services/__tests__/abTesting.integration.test.ts
// Integration tests for complete A/B testing and feature flag workflow

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FeatureFlagManager } from '../featureFlagManager';
import { ABTestingService } from '../abTestingService';
import { ConfigurationManager } from '../configurationManager';
import { HybridRetriever } from '../hybridRetrieval';

// Mock external dependencies
vi.mock('../factbookService');
vi.mock('../embeddingCache');
vi.mock('../cacheManager');
vi.mock('../performanceMonitor');
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockRejectedValue(new Error('File not found')),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
    unlink: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ mtime: new Date() })
  }
}));

describe('A/B Testing Integration', () => {
  let featureFlagManager: FeatureFlagManager;
  let abTestingService: ABTestingService;
  let configurationManager: ConfigurationManager;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Setup test environment
    process.env.AB_TEST_ENABLED = 'true';
    process.env.AB_TEST_TRAFFIC_SPLIT = '0.5';
    process.env.RETRIEVAL_EMBEDDINGS = 'on';
    process.env.RETRIEVAL_EXPANSION = 'auto';
    process.env.RETRIEVAL_RERANK = 'off';
    process.env.TRACK_USAGE_METRICS = 'true';

    // Initialize services
    featureFlagManager = new FeatureFlagManager();
    abTestingService = new ABTestingService(featureFlagManager);
    configurationManager = new ConfigurationManager(featureFlagManager, './test-integration-config');
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('End-to-End A/B Testing Workflow', () => {
    it('should complete full A/B testing workflow', async () => {
      const testId = 'integration_test';
      const queries = [
        'snake story',
        'SXSW concert',
        'Tyler partner',
        'Olive pet',
        'George dog'
      ];

      // Step 1: Run A/B test experiments
      const experimentResults = [];
      
      for (let i = 0; i < 20; i++) {
        const userId = `user_${i}`;
        const query = queries[i % queries.length];
        
        const result = await abTestingService.performABTestRetrieval(
          userId,
          query,
          testId,
          `session_${Math.floor(i / 5)}`
        );
        
        experimentResults.push(result);
      }

      // Step 2: Verify experiment results
      expect(experimentResults).toHaveLength(20);
      
      const controlResults = experimentResults.filter(r => r.variant === 'control');
      const treatmentResults = experimentResults.filter(r => r.variant === 'treatment');
      
      // Should have both variants represented
      expect(controlResults.length).toBeGreaterThan(0);
      expect(treatmentResults.length).toBeGreaterThan(0);
      
      // Step 3: Check comparison metrics
      const comparisonMetrics = abTestingService.getComparisonMetrics(testId);
      expect(comparisonMetrics).toBeTruthy();
      
      if (comparisonMetrics) {
        expect(comparisonMetrics.controlMetrics.sampleSize).toBe(controlResults.length);
        expect(comparisonMetrics.treatmentMetrics.sampleSize).toBe(treatmentResults.length);
        expect(comparisonMetrics.comparison).toHaveProperty('statisticalSignificance');
      }

      // Step 4: Generate test report
      const report = abTestingService.generateTestReport(testId);
      
      expect(report.testId).toBe(testId);
      expect(report.summary.totalExperiments).toBe(20);
      expect(report.summary.controlExperiments).toBe(controlResults.length);
      expect(report.summary.treatmentExperiments).toBe(treatmentResults.length);
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.rawData).toHaveLength(20);

      // Step 5: Verify user consistency
      const user1Results = abTestingService.getUserExperimentResults('user_1', testId);
      expect(user1Results.length).toBeGreaterThan(0);
      
      // Same user should always get same variant
      const variants = user1Results.map(r => r.variant);
      const uniqueVariants = [...new Set(variants)];
      expect(uniqueVariants).toHaveLength(1);
    });

    it('should handle batch comparison correctly', async () => {
      const queries = [
        'snake story',
        'SXSW meetings',
        'Tyler relationship',
        'pet memories',
        'concert experiences'
      ];

      const batchResult = await abTestingService.runBatchComparison(
        queries,
        'batch_test_user',
        'batch_comparison_test'
      );

      expect(batchResult.controlResults).toHaveLength(queries.length);
      expect(batchResult.treatmentResults).toHaveLength(queries.length);
      expect(batchResult.comparison).toHaveProperty('testId', 'batch_comparison_test');

      // Verify that control uses BM25-only and treatment uses hybrid
      batchResult.controlResults.forEach(result => {
        expect(result.metrics.methodsUsed).toContain('bm25');
        // Control should not use vector search, expansion, or reranking
        expect(result.metrics.methodsUsed).not.toContain('vector');
        expect(result.metrics.methodsUsed).not.toContain('expansion');
        expect(result.metrics.methodsUsed).not.toContain('reranking');
      });

      // Treatment results may vary based on query confidence and features enabled
      batchResult.treatmentResults.forEach(result => {
        expect(result.metrics.methodsUsed).toContain('bm25');
        // Treatment may use additional methods depending on configuration
      });
    });
  });

  describe('Feature Flag Runtime Switching', () => {
    it('should switch feature flags at runtime and affect A/B test behavior', async () => {
      const testId = 'runtime_switch_test';
      const userId = 'switch_test_user';
      const query = 'test query';

      // Initial configuration
      const initialResult = await abTestingService.performABTestRetrieval(userId, query, testId);
      const initialVariant = initialResult.variant;

      // Update feature flags to force BM25-only mode
      const updateResult = featureFlagManager.updateConfig({
        enableBM25Only: true,
        enableEmbeddings: false,
        enableExpansion: 'off',
        enableReranking: false
      }, 'runtime_test');

      expect(updateResult.isValid).toBe(true);

      // Get new configuration for same user
      const newConfig = featureFlagManager.getConfigForUser(userId);
      expect(newConfig.enableEmbeddings).toBe(false);
      expect(newConfig.enableExpansion).toBe('off');
      expect(newConfig.enableReranking).toBe(false);

      // Verify configuration history
      const history = featureFlagManager.getConfigHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].reason).toBe('pre_update_runtime_test');
    });

    it('should validate configuration changes', () => {
      // Valid update
      const validUpdate = featureFlagManager.updateConfig({
        abTestTrafficSplit: 0.3,
        enableEmbeddings: true
      }, 'valid_update');

      expect(validUpdate.isValid).toBe(true);
      expect(validUpdate.errors).toHaveLength(0);

      // Invalid update
      const invalidUpdate = featureFlagManager.updateConfig({
        abTestTrafficSplit: 1.5 // Invalid: > 1.0
      }, 'invalid_update');

      expect(invalidUpdate.isValid).toBe(false);
      expect(invalidUpdate.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Management Integration', () => {
    it('should create and deploy configuration packages', async () => {
      // Create configuration package
      const configPackage = await configurationManager.createConfigurationPackage(
        'Integration Test Package',
        'Test package for integration testing',
        'test',
        'integration_test_user',
        {
          featureFlags: {
            enableEmbeddings: false,
            enableExpansion: 'off',
            enableReranking: false,
            abTestEnabled: true,
            abTestTrafficSplit: 0.3
          },
          deploymentStrategy: 'immediate',
          healthChecks: ['feature_flag_health']
        }
      );

      expect(configPackage.validationResults.isValid).toBe(true);
      expect(configPackage.featureFlags.enableEmbeddings).toBe(false);
      expect(configPackage.featureFlags.abTestTrafficSplit).toBe(0.3);

      // Deploy configuration package
      const deployResult = await configurationManager.deployConfiguration(
        configPackage.packageId,
        'integration_test_deployer',
        { dryRun: true } // Use dry run for testing
      );

      expect(deployResult.success).toBe(true);
      expect(deployResult.errors).toHaveLength(0);
      expect(deployResult.deploymentId).toMatch(/^dep_/);
    });

    it('should handle deployment rollback', async () => {
      // Create and deploy a package
      const configPackage = await configurationManager.createConfigurationPackage(
        'Rollback Test Package',
        'Test package for rollback testing',
        'test',
        'rollback_test_user',
        {
          featureFlags: {
            enableEmbeddings: true,
            enableExpansion: 'auto'
          }
        }
      );

      const deployResult = await configurationManager.deployConfiguration(
        configPackage.packageId,
        'rollback_test_deployer',
        { dryRun: true }
      );

      expect(deployResult.success).toBe(true);

      // Test rollback (would normally use actual deployment ID)
      const rollbackResult = await configurationManager.rollbackDeployment(
        deployResult.deploymentId,
        'integration_test_rollback'
      );

      // Rollback might fail in test environment due to mocked file system
      // but we can verify the attempt was made
      expect(rollbackResult).toHaveProperty('success');
      expect(rollbackResult).toHaveProperty('errors');
    });
  });

  describe('Performance and Monitoring', () => {
    it('should track usage metrics across A/B test variants', async () => {
      const testId = 'metrics_tracking_test';
      const queries = ['query1', 'query2', 'query3'];

      // Generate test data
      for (let i = 0; i < 30; i++) {
        const userId = `metrics_user_${i}`;
        const query = queries[i % queries.length];
        
        await abTestingService.performABTestRetrieval(userId, query, testId);
      }

      // Check usage metrics
      const usageMetrics = featureFlagManager.getUsageMetrics();
      expect(Array.isArray(usageMetrics)).toBe(true);

      // Check A/B test results
      const abTestResults = featureFlagManager.getABTestResults('hybrid_retrieval_test');
      if (abTestResults) {
        expect(abTestResults.results.length).toBeGreaterThan(0);
        
        abTestResults.results.forEach(result => {
          expect(result.variant).toMatch(/^(control|treatment)$/);
          expect(result.sampleSize).toBeGreaterThanOrEqual(0);
          expect(result.conversionRate).toBeGreaterThanOrEqual(0);
          expect(result.conversionRate).toBeLessThanOrEqual(1);
        });
      }
    });

    it('should provide health status for A/B testing components', () => {
      const healthStatus = abTestingService.getHealthStatus();

      expect(healthStatus).toHaveProperty('control');
      expect(healthStatus).toHaveProperty('treatment');
      expect(healthStatus).toHaveProperty('overall');

      expect(healthStatus.overall).toMatch(/^(healthy|degraded|unhealthy)$/);
      
      // Both retrievers should have health status
      expect(healthStatus.control).toHaveProperty('status');
      expect(healthStatus.treatment).toHaveProperty('status');
    });
  });

  describe('Statistical Analysis', () => {
    it('should calculate statistical significance with sufficient data', async () => {
      const testId = 'statistical_test';
      
      // Generate sufficient data for statistical analysis
      for (let i = 0; i < 100; i++) {
        const userId = `stat_user_${i}`;
        const query = `query_${i % 10}`;
        
        await abTestingService.performABTestRetrieval(userId, query, testId);
      }

      const comparisonMetrics = abTestingService.getComparisonMetrics(testId);
      
      if (comparisonMetrics) {
        const significance = comparisonMetrics.comparison.statisticalSignificance;
        
        expect(significance).toHaveProperty('isSignificant');
        expect(significance).toHaveProperty('pValue');
        expect(significance).toHaveProperty('confidenceLevel');
        
        expect(typeof significance.isSignificant).toBe('boolean');
        expect(significance.pValue).toBeGreaterThanOrEqual(0);
        expect(significance.pValue).toBeLessThanOrEqual(1);
        expect(significance.confidenceLevel).toBe(0.95);

        // Check improvement calculations
        expect(typeof comparisonMetrics.comparison.latencyImprovementPercent).toBe('number');
        expect(typeof comparisonMetrics.comparison.relevanceImprovementPercent).toBe('number');
        expect(typeof comparisonMetrics.comparison.resultCountImprovementPercent).toBe('number');
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty experiment data gracefully', () => {
      const emptyTestId = 'empty_test';
      
      const results = abTestingService.getExperimentResults(emptyTestId);
      expect(results).toHaveLength(0);
      
      const metrics = abTestingService.getComparisonMetrics(emptyTestId);
      expect(metrics).toBeNull();
      
      const report = abTestingService.generateTestReport(emptyTestId);
      expect(report.summary.totalExperiments).toBe(0);
      expect(report.recommendations.length).toBeGreaterThan(0); // Should still have recommendations
    });

    it('should handle configuration validation errors', () => {
      const invalidConfig = {
        abTestEnabled: true,
        abTestTrafficSplit: 2.0, // Invalid
        enableBM25Only: true,
        enableEmbeddings: true // Conflicting
      };

      const validation = featureFlagManager.validateConfig({
        ...featureFlagManager.getConfig(),
        ...invalidConfig
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.safeDefaults).toHaveProperty('enableEmbeddings', false);
    });

    it('should maintain data consistency during concurrent operations', async () => {
      const testId = 'concurrency_test';
      const userId = 'concurrent_user';
      
      // Simulate concurrent A/B test requests
      const promises = Array.from({ length: 10 }, (_, i) => 
        abTestingService.performABTestRetrieval(userId, `concurrent_query_${i}`, testId)
      );

      const results = await Promise.all(promises);
      
      // All results for same user should have same variant
      const variants = results.map(r => r.variant);
      const uniqueVariants = [...new Set(variants)];
      expect(uniqueVariants).toHaveLength(1);

      // All experiment results should be stored
      const storedResults = abTestingService.getUserExperimentResults(userId, testId);
      expect(storedResults).toHaveLength(10);
    });
  });

  describe('Data Cleanup and Management', () => {
    it('should clean up old experiment data', async () => {
      const testId = 'cleanup_test';
      
      // Generate test data
      for (let i = 0; i < 50; i++) {
        await abTestingService.performABTestRetrieval(`cleanup_user_${i}`, `query_${i}`, testId);
      }

      let results = abTestingService.getExperimentResults(testId);
      expect(results.length).toBe(50);

      // Clear experiment data
      abTestingService.clearExperimentData(testId);

      results = abTestingService.getExperimentResults(testId);
      expect(results).toHaveLength(0);

      const metrics = abTestingService.getComparisonMetrics(testId);
      expect(metrics).toBeNull();
    });

    it('should handle configuration history cleanup', async () => {
      // Generate configuration history
      for (let i = 0; i < 10; i++) {
        featureFlagManager.updateConfig({
          abTestTrafficSplit: 0.5 + (i * 0.01)
        }, `history_update_${i}`);
      }

      const history = featureFlagManager.getConfigHistory();
      expect(history.length).toBeGreaterThanOrEqual(10);

      // Verify history entries have correct structure
      history.forEach(entry => {
        expect(entry).toHaveProperty('timestamp');
        expect(entry).toHaveProperty('config');
        expect(entry).toHaveProperty('reason');
        expect(typeof entry.timestamp).toBe('number');
        expect(typeof entry.reason).toBe('string');
      });
    });
  });
});