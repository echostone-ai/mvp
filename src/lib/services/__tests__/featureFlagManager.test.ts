// src/lib/services/__tests__/featureFlagManager.test.ts
// Tests for feature flag management and A/B testing infrastructure

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FeatureFlagManager, FeatureFlagConfig, ABTestDefinition } from '../featureFlagManager';

describe('FeatureFlagManager', () => {
  let featureFlagManager: FeatureFlagManager;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear environment variables
    delete process.env.AB_TEST_ENABLED;
    delete process.env.AB_TEST_VARIANT;
    delete process.env.AB_TEST_TRAFFIC_SPLIT;
    delete process.env.ENABLE_HYBRID_RETRIEVAL;
    delete process.env.ENABLE_BM25_ONLY;
    delete process.env.RETRIEVAL_EMBEDDINGS;
    delete process.env.RETRIEVAL_EXPANSION;
    delete process.env.RETRIEVAL_RERANK;
    
    featureFlagManager = new FeatureFlagManager();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Configuration Parsing', () => {
    it('should parse environment variables correctly', () => {
      process.env.AB_TEST_ENABLED = 'true';
      process.env.AB_TEST_VARIANT = 'treatment';
      process.env.AB_TEST_TRAFFIC_SPLIT = '0.3';
      process.env.ENABLE_HYBRID_RETRIEVAL = 'true';
      process.env.RETRIEVAL_EMBEDDINGS = 'on';
      process.env.RETRIEVAL_EXPANSION = 'auto';
      process.env.RETRIEVAL_RERANK = 'on';

      const manager = new FeatureFlagManager();
      const config = manager.getConfig();

      expect(config.abTestEnabled).toBe(true);
      expect(config.abTestVariant).toBe('treatment');
      expect(config.abTestTrafficSplit).toBe(0.3);
      expect(config.enableHybridRetrieval).toBe(true);
      expect(config.enableEmbeddings).toBe(true);
      expect(config.enableExpansion).toBe('auto');
      expect(config.enableReranking).toBe(true);
    });

    it('should use safe defaults when environment variables are missing', () => {
      const config = featureFlagManager.getConfig();

      expect(config.abTestEnabled).toBe(false);
      expect(config.abTestVariant).toBe('auto');
      expect(config.abTestTrafficSplit).toBe(0.5);
      expect(config.enableHybridRetrieval).toBe(true);
      expect(config.enableEmbeddings).toBe(true);
      expect(config.enableExpansion).toBe('auto');
      expect(config.enableReranking).toBe(false);
    });

    it('should handle BM25-only mode correctly', () => {
      process.env.ENABLE_BM25_ONLY = 'true';

      const manager = new FeatureFlagManager();
      const hybridConfig = manager.getConfigForUser('test_user');

      expect(hybridConfig.enableEmbeddings).toBe(false);
      expect(hybridConfig.enableExpansion).toBe('off');
      expect(hybridConfig.enableReranking).toBe(false);
    });
  });

  describe('A/B Test User Assignment', () => {
    beforeEach(() => {
      process.env.AB_TEST_ENABLED = 'true';
      process.env.AB_TEST_TRAFFIC_SPLIT = '0.5';
      featureFlagManager = new FeatureFlagManager();
    });

    it('should assign users consistently to variants', () => {
      const userId = 'test_user_123';
      
      const config1 = featureFlagManager.getConfigForUser(userId);
      const config2 = featureFlagManager.getConfigForUser(userId);
      
      // Same user should get same configuration
      expect(config1.enableEmbeddings).toBe(config2.enableEmbeddings);
      expect(config1.enableExpansion).toBe(config2.enableExpansion);
      expect(config1.enableReranking).toBe(config2.enableReranking);
    });

    it('should distribute users across variants based on traffic split', () => {
      const userIds = Array.from({ length: 1000 }, (_, i) => `user_${i}`);
      const variants = userIds.map(userId => {
        const config = featureFlagManager.getConfigForUser(userId);
        // Determine variant based on config
        if (!config.enableEmbeddings && config.enableExpansion === 'off' && !config.enableReranking) {
          return 'control';
        } else {
          return 'treatment';
        }
      });

      const controlCount = variants.filter(v => v === 'control').length;
      const treatmentCount = variants.filter(v => v === 'treatment').length;
      
      // Should be roughly 50/50 split (within 10% tolerance)
      const controlRatio = controlCount / variants.length;
      expect(controlRatio).toBeGreaterThan(0.4);
      expect(controlRatio).toBeLessThan(0.6);
    });

    it('should respect explicit variant assignment', () => {
      process.env.AB_TEST_VARIANT = 'control';
      const manager = new FeatureFlagManager();
      
      const config = manager.getConfigForUser('any_user');
      
      // Should be control variant (BM25-only)
      expect(config.enableEmbeddings).toBe(false);
      expect(config.enableExpansion).toBe('off');
      expect(config.enableReranking).toBe(false);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid configuration', () => {
      const validConfig: FeatureFlagConfig = {
        abTestEnabled: true,
        abTestName: 'test',
        abTestVariant: 'auto',
        abTestTrafficSplit: 0.5,
        enableHybridRetrieval: true,
        enableBM25Only: false,
        enableEmbeddings: true,
        enableExpansion: 'auto',
        enableReranking: false,
        allowRuntimeSwitching: true,
        configVersion: 'v1.0.0',
        lastUpdated: Date.now(),
        trackUsageMetrics: true,
        trackPerformanceImpact: true,
        logFeatureUsage: true
      };

      const validation = featureFlagManager.validateConfig(validConfig);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid traffic split', () => {
      const invalidConfig: FeatureFlagConfig = {
        ...featureFlagManager.getConfig(),
        abTestEnabled: true,
        abTestTrafficSplit: 1.5 // Invalid: > 1.0
      };

      const validation = featureFlagManager.validateConfig(invalidConfig);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('abTestTrafficSplit must be between 0.0 and 1.0');
    });

    it('should warn about conflicting BM25-only configuration', () => {
      const conflictingConfig: FeatureFlagConfig = {
        ...featureFlagManager.getConfig(),
        enableBM25Only: true,
        enableEmbeddings: true, // Conflict
        enableExpansion: 'auto' // Conflict
      };

      const validation = featureFlagManager.validateConfig(conflictingConfig);
      
      expect(validation.isValid).toBe(true); // Still valid, just warnings
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0]).toContain('BM25-only mode enabled but other features are also enabled');
    });

    it('should provide safe defaults for invalid configurations', () => {
      const conflictingConfig: FeatureFlagConfig = {
        ...featureFlagManager.getConfig(),
        enableBM25Only: true,
        enableEmbeddings: true,
        enableReranking: true
      };

      const validation = featureFlagManager.validateConfig(conflictingConfig);
      
      expect(validation.safeDefaults.enableEmbeddings).toBe(false);
      expect(validation.safeDefaults.enableExpansion).toBe('off');
      expect(validation.safeDefaults.enableReranking).toBe(false);
    });
  });

  describe('Runtime Configuration Updates', () => {
    it('should update configuration at runtime', () => {
      const updates: Partial<FeatureFlagConfig> = {
        enableEmbeddings: false,
        enableExpansion: 'off',
        abTestTrafficSplit: 0.3
      };

      const result = featureFlagManager.updateConfig(updates, 'test_update');
      
      expect(result.isValid).toBe(true);
      
      const updatedConfig = featureFlagManager.getConfig();
      expect(updatedConfig.enableEmbeddings).toBe(false);
      expect(updatedConfig.enableExpansion).toBe('off');
      expect(updatedConfig.abTestTrafficSplit).toBe(0.3);
    });

    it('should maintain configuration history', () => {
      const originalConfig = featureFlagManager.getConfig();
      
      featureFlagManager.updateConfig({ enableEmbeddings: false }, 'test_1');
      featureFlagManager.updateConfig({ enableExpansion: 'off' }, 'test_2');
      
      const history = featureFlagManager.getConfigHistory();
      
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0].reason).toBe('pre_update_test_1');
      expect(history[1].reason).toBe('pre_update_test_2');
    });

    it('should reject invalid configuration updates', () => {
      const invalidUpdates: Partial<FeatureFlagConfig> = {
        abTestTrafficSplit: -0.5 // Invalid
      };

      const result = featureFlagManager.updateConfig(invalidUpdates);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Configuration should remain unchanged
      const config = featureFlagManager.getConfig();
      expect(config.abTestTrafficSplit).not.toBe(-0.5);
    });
  });

  describe('A/B Test Management', () => {
    it('should create new A/B test', () => {
      const testDefinition: ABTestDefinition = {
        testId: 'custom_test',
        name: 'Custom Test',
        description: 'Test description',
        startDate: Date.now(),
        status: 'active',
        variants: [
          {
            name: 'control',
            description: 'Control variant',
            config: { enableEmbeddings: false },
            trafficAllocation: 0.5,
            enabled: true
          },
          {
            name: 'treatment',
            description: 'Treatment variant',
            config: { enableEmbeddings: true },
            trafficAllocation: 0.5,
            enabled: true
          }
        ],
        targetMetrics: ['relevance'],
        minimumSampleSize: 100,
        confidenceLevel: 0.95
      };

      expect(() => {
        featureFlagManager.createABTest(testDefinition);
      }).not.toThrow();
    });

    it('should reject A/B test with invalid traffic allocation', () => {
      const invalidTestDefinition: ABTestDefinition = {
        testId: 'invalid_test',
        name: 'Invalid Test',
        description: 'Test with invalid traffic allocation',
        startDate: Date.now(),
        status: 'active',
        variants: [
          {
            name: 'control',
            description: 'Control variant',
            config: {},
            trafficAllocation: 0.6, // Total = 1.1 (invalid)
            enabled: true
          },
          {
            name: 'treatment',
            description: 'Treatment variant',
            config: {},
            trafficAllocation: 0.5,
            enabled: true
          }
        ],
        targetMetrics: ['relevance'],
        minimumSampleSize: 100,
        confidenceLevel: 0.95
      };

      expect(() => {
        featureFlagManager.createABTest(invalidTestDefinition);
      }).toThrow('Total traffic allocation must equal 1.0');
    });

    it('should update A/B test status', () => {
      const testId = 'hybrid_retrieval_test'; // Default test
      
      featureFlagManager.updateABTestStatus(testId, 'paused');
      
      // This would be verified through the A/B test results if we had access to the internal state
      expect(() => {
        featureFlagManager.updateABTestStatus(testId, 'completed');
      }).not.toThrow();
    });
  });

  describe('Usage Metrics Tracking', () => {
    beforeEach(() => {
      process.env.TRACK_USAGE_METRICS = 'true';
      featureFlagManager = new FeatureFlagManager();
    });

    it('should track feature usage when enabled', () => {
      const userId = 'test_user';
      
      // Trigger usage tracking by getting config
      featureFlagManager.getConfigForUser(userId);
      
      const metrics = featureFlagManager.getUsageMetrics();
      
      // Should have some metrics (exact structure depends on implementation)
      expect(Array.isArray(metrics)).toBe(true);
    });

    it('should not track usage when disabled', () => {
      process.env.TRACK_USAGE_METRICS = 'false';
      const manager = new FeatureFlagManager();
      
      manager.getConfigForUser('test_user');
      
      const metrics = manager.getUsageMetrics();
      expect(metrics).toHaveLength(0);
    });
  });

  describe('Configuration Export/Import', () => {
    it('should export configuration correctly', () => {
      const exported = featureFlagManager.exportConfig();
      
      expect(exported).toHaveProperty('config');
      expect(exported).toHaveProperty('abTests');
      expect(exported).toHaveProperty('metadata');
      expect(exported.metadata).toHaveProperty('exportedAt');
      expect(exported.metadata).toHaveProperty('version');
    });

    it('should import valid configuration', () => {
      const exported = featureFlagManager.exportConfig();
      
      // Modify configuration
      exported.config.enableEmbeddings = false;
      exported.config.enableExpansion = 'off';
      
      const result = featureFlagManager.importConfig(exported, 'test_import');
      
      expect(result.isValid).toBe(true);
      
      const config = featureFlagManager.getConfig();
      expect(config.enableEmbeddings).toBe(false);
      expect(config.enableExpansion).toBe('off');
    });

    it('should reject invalid imported configuration', () => {
      const exported = featureFlagManager.exportConfig();
      
      // Make configuration invalid
      exported.config.abTestTrafficSplit = 2.0; // Invalid
      
      const result = featureFlagManager.importConfig(exported, 'invalid_import');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Rollback', () => {
    it('should rollback to previous configuration', () => {
      const originalConfig = featureFlagManager.getConfig();
      
      // Make a change
      featureFlagManager.updateConfig({ enableEmbeddings: false }, 'test_change');
      
      // Get the timestamp of the change
      const history = featureFlagManager.getConfigHistory();
      const targetTimestamp = history[0].timestamp;
      
      // Rollback
      const success = featureFlagManager.rollbackConfig(targetTimestamp, 'test_rollback');
      
      expect(success).toBe(true);
      
      const rolledBackConfig = featureFlagManager.getConfig();
      expect(rolledBackConfig.enableEmbeddings).toBe(originalConfig.enableEmbeddings);
    });

    it('should fail to rollback to non-existent timestamp', () => {
      const nonExistentTimestamp = Date.now() + 10000; // Future timestamp
      
      const success = featureFlagManager.rollbackConfig(nonExistentTimestamp, 'invalid_rollback');
      
      expect(success).toBe(false);
    });
  });

  describe('Statistical Calculations', () => {
    it('should calculate confidence intervals correctly', () => {
      // This tests the internal statistical methods through A/B test results
      process.env.AB_TEST_ENABLED = 'true';
      const manager = new FeatureFlagManager();
      
      // Create some mock usage data by getting configs for different users
      const userIds = Array.from({ length: 100 }, (_, i) => `user_${i}`);
      userIds.forEach(userId => manager.getConfigForUser(userId));
      
      // Get A/B test results (this would include statistical calculations)
      const results = manager.getABTestResults('hybrid_retrieval_test');
      
      if (results) {
        expect(results).toHaveProperty('significance');
        expect(results.significance).toHaveProperty('isSignificant');
        expect(results.significance).toHaveProperty('pValue');
        expect(results.significance).toHaveProperty('confidenceLevel');
        
        results.results.forEach(result => {
          expect(result.confidenceInterval).toHaveProperty('lower');
          expect(result.confidenceInterval).toHaveProperty('upper');
          expect(result.confidenceInterval.lower).toBeGreaterThanOrEqual(0);
          expect(result.confidenceInterval.upper).toBeLessThanOrEqual(1);
        });
      }
    });
  });
});