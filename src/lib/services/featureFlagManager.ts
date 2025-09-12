// src/lib/services/featureFlagManager.ts
// A/B testing and feature flag management for hybrid retrieval system

import { HybridRetrievalConfig } from './hybridRetrieval';

/**
 * Feature flag configuration for A/B testing
 */
export interface FeatureFlagConfig {
  // A/B test configuration
  abTestEnabled: boolean;
  abTestName: string;
  abTestVariant: 'control' | 'treatment' | 'auto';
  abTestTrafficSplit: number; // 0.0 to 1.0, percentage for treatment group
  
  // Feature flags
  enableHybridRetrieval: boolean;
  enableBM25Only: boolean;
  enableEmbeddings: boolean;
  enableExpansion: 'auto' | 'off';
  enableReranking: boolean;
  
  // Runtime switching
  allowRuntimeSwitching: boolean;
  configVersion: string;
  lastUpdated: number;
  
  // Monitoring
  trackUsageMetrics: boolean;
  trackPerformanceImpact: boolean;
  logFeatureUsage: boolean;
}

/**
 * A/B test variant configuration
 */
export interface ABTestVariant {
  name: 'control' | 'treatment';
  description: string;
  config: Partial<HybridRetrievalConfig>;
  trafficAllocation: number; // 0.0 to 1.0
  enabled: boolean;
}

/**
 * A/B test definition
 */
export interface ABTestDefinition {
  testId: string;
  name: string;
  description: string;
  startDate: number;
  endDate?: number;
  status: 'draft' | 'active' | 'paused' | 'completed';
  variants: ABTestVariant[];
  targetMetrics: string[];
  minimumSampleSize: number;
  confidenceLevel: number; // 0.95 for 95% confidence
}

/**
 * Feature usage metrics for monitoring
 */
export interface FeatureUsageMetrics {
  featureName: string;
  variant: string;
  usageCount: number;
  successCount: number;
  errorCount: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  lastUsed: number;
  performanceImpact: {
    baselineLatencyMs: number;
    currentLatencyMs: number;
    impactPercent: number;
  };
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  safeDefaults: Partial<HybridRetrievalConfig>;
}

/**
 * Feature flag manager for A/B testing and runtime configuration
 */
export class FeatureFlagManager {
  private config: FeatureFlagConfig;
  private abTests: Map<string, ABTestDefinition> = new Map();
  private usageMetrics: Map<string, FeatureUsageMetrics> = new Map();
  private userAssignments: Map<string, string> = new Map(); // userId -> variant
  private configHistory: Array<{ timestamp: number; config: FeatureFlagConfig; reason: string }> = [];
  
  constructor(initialConfig?: Partial<FeatureFlagConfig>) {
    this.config = this.parseFeatureFlagConfig(initialConfig);
    this.initializeABTests();
    
    console.log('feature_flag_manager_initialized', {
      ab_test_enabled: this.config.abTestEnabled,
      hybrid_retrieval_enabled: this.config.enableHybridRetrieval,
      config_version: this.config.configVersion
    });
  }
  
  /**
   * Parse environment variables and initial config into FeatureFlagConfig
   */
  private parseFeatureFlagConfig(initialConfig?: Partial<FeatureFlagConfig>): FeatureFlagConfig {
    const baseConfig: FeatureFlagConfig = {
      // A/B test configuration
      abTestEnabled: process.env.AB_TEST_ENABLED?.toLowerCase() === 'true',
      abTestName: process.env.AB_TEST_NAME || 'hybrid_retrieval_test',
      abTestVariant: this.parseABTestVariant(process.env.AB_TEST_VARIANT),
      abTestTrafficSplit: parseFloat(process.env.AB_TEST_TRAFFIC_SPLIT || '0.5'),
      
      // Feature flags with safe defaults
      enableHybridRetrieval: process.env.ENABLE_HYBRID_RETRIEVAL?.toLowerCase() !== 'false',
      enableBM25Only: process.env.ENABLE_BM25_ONLY?.toLowerCase() === 'true',
      enableEmbeddings: process.env.RETRIEVAL_EMBEDDINGS?.toLowerCase() !== 'off',
      enableExpansion: (process.env.RETRIEVAL_EXPANSION?.toLowerCase() === 'off') ? 'off' : 'auto',
      enableReranking: process.env.RETRIEVAL_RERANK?.toLowerCase() === 'on',
      
      // Runtime switching
      allowRuntimeSwitching: process.env.ALLOW_RUNTIME_SWITCHING?.toLowerCase() !== 'false',
      configVersion: process.env.CONFIG_VERSION || this.generateConfigVersion(),
      lastUpdated: Date.now(),
      
      // Monitoring
      trackUsageMetrics: process.env.TRACK_USAGE_METRICS?.toLowerCase() !== 'false',
      trackPerformanceImpact: process.env.TRACK_PERFORMANCE_IMPACT?.toLowerCase() !== 'false',
      logFeatureUsage: process.env.LOG_FEATURE_USAGE?.toLowerCase() !== 'false'
    };
    
    return { ...baseConfig, ...initialConfig };
  }
  
  /**
   * Parse A/B test variant from environment variable
   */
  private parseABTestVariant(variant?: string): 'control' | 'treatment' | 'auto' {
    switch (variant?.toLowerCase()) {
      case 'control':
        return 'control';
      case 'treatment':
        return 'treatment';
      default:
        return 'auto';
    }
  }
  
  /**
   * Generate a unique configuration version
   */
  private generateConfigVersion(): string {
    return `v${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Initialize default A/B tests
   */
  private initializeABTests(): void {
    // Default A/B test: BM25-only vs Hybrid retrieval
    const hybridRetrievalTest: ABTestDefinition = {
      testId: 'hybrid_retrieval_test',
      name: 'Hybrid Retrieval vs BM25-Only',
      description: 'Compare hybrid retrieval (BM25 + Vector + Expansion) against BM25-only baseline',
      startDate: Date.now(),
      status: 'active',
      variants: [
        {
          name: 'control',
          description: 'BM25-only retrieval (baseline)',
          config: {
            enableEmbeddings: false,
            enableExpansion: 'off',
            enableReranking: false
          },
          trafficAllocation: 0.5,
          enabled: true
        },
        {
          name: 'treatment',
          description: 'Full hybrid retrieval with all features',
          config: {
            enableEmbeddings: true,
            enableExpansion: 'auto',
            enableReranking: true
          },
          trafficAllocation: 0.5,
          enabled: true
        }
      ],
      targetMetrics: ['relevance_score', 'latency_p95', 'user_satisfaction'],
      minimumSampleSize: 1000,
      confidenceLevel: 0.95
    };
    
    this.abTests.set(hybridRetrievalTest.testId, hybridRetrievalTest);
  }
  
  /**
   * Get configuration for a specific user (handles A/B test assignment)
   */
  getConfigForUser(userId: string): HybridRetrievalConfig {
    // If A/B testing is disabled, return standard config
    if (!this.config.abTestEnabled) {
      return this.buildHybridRetrievalConfig();
    }
    
    // Get or assign user to A/B test variant
    const variant = this.getUserVariant(userId);
    const testConfig = this.getVariantConfig(variant);
    
    // Track usage
    if (this.config.trackUsageMetrics) {
      this.trackFeatureUsage(`ab_test_${variant}`, userId);
    }
    
    console.log('ab_test_config_assigned', {
      user_id: userId,
      variant,
      test_name: this.config.abTestName,
      config_version: this.config.configVersion
    });
    
    return testConfig;
  }
  
  /**
   * Get or assign user to A/B test variant
   */
  private getUserVariant(userId: string): 'control' | 'treatment' {
    // Check if user already has an assignment
    if (this.userAssignments.has(userId)) {
      return this.userAssignments.get(userId) as 'control' | 'treatment';
    }
    
    // If variant is explicitly set, use it
    if (this.config.abTestVariant !== 'auto') {
      this.userAssignments.set(userId, this.config.abTestVariant);
      return this.config.abTestVariant;
    }
    
    // Assign based on traffic split using consistent hashing
    const hash = this.hashUserId(userId);
    const variant = hash < this.config.abTestTrafficSplit ? 'treatment' : 'control';
    
    this.userAssignments.set(userId, variant);
    
    console.log('ab_test_user_assigned', {
      user_id: userId,
      variant,
      hash: hash.toFixed(3),
      traffic_split: this.config.abTestTrafficSplit
    });
    
    return variant;
  }
  
  /**
   * Hash user ID for consistent A/B test assignment
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Use a better normalization to ensure proper distribution
    return (Math.abs(hash) % 1000000) / 1000000; // Normalize to 0-1
  }
  
  /**
   * Get configuration for a specific variant
   */
  private getVariantConfig(variant: 'control' | 'treatment'): HybridRetrievalConfig {
    const activeTest = Array.from(this.abTests.values()).find(test => test.status === 'active');
    
    if (activeTest) {
      const variantConfig = activeTest.variants.find(v => v.name === variant);
      if (variantConfig && variantConfig.enabled) {
        return this.buildHybridRetrievalConfig(variantConfig.config);
      }
    }
    
    // Fallback to default config
    return this.buildHybridRetrievalConfig();
  }
  
  /**
   * Build HybridRetrievalConfig from feature flags
   */
  private buildHybridRetrievalConfig(overrides?: Partial<HybridRetrievalConfig>): HybridRetrievalConfig {
    const baseConfig: HybridRetrievalConfig = {
      // Feature flags
      enableEmbeddings: this.config.enableEmbeddings,
      enableExpansion: this.config.enableExpansion,
      enableReranking: this.config.enableReranking,
      
      // Performance settings with safe defaults
      expansionThreshold: parseFloat(process.env.RETRIEVAL_EXPANSION_THRESHOLD || '0.3'),
      maxResults: parseInt(process.env.RETRIEVAL_MAX_RESULTS || '10'),
      fusionK: parseInt(process.env.RETRIEVAL_FUSION_K || '60'),
      timeoutMs: parseInt(process.env.RETRIEVAL_TIMEOUT_MS || '500'),
      
      // BM25 parameters
      bm25K1: parseFloat(process.env.RETRIEVAL_BM25_K1 || '1.2'),
      bm25B: parseFloat(process.env.RETRIEVAL_BM25_B || '0.75'),
      
      // Vector search parameters
      vectorSimilarityThreshold: parseFloat(process.env.RETRIEVAL_VECTOR_THRESHOLD || '0.3'),
      vectorMaxResults: parseInt(process.env.RETRIEVAL_VECTOR_MAX_RESULTS || '20'),
      
      // Fusion weights
      bm25Weight: parseFloat(process.env.RETRIEVAL_BM25_WEIGHT || '0.6'),
      vectorWeight: parseFloat(process.env.RETRIEVAL_VECTOR_WEIGHT || '0.4'),
      
      // Query expansion parameters
      expansionTimeoutMs: parseInt(process.env.RETRIEVAL_EXPANSION_TIMEOUT_MS || '200'),
      lowConfidenceThreshold: parseFloat(process.env.RETRIEVAL_LOW_CONFIDENCE_THRESHOLD || '0.35'),
      minResultsThreshold: parseInt(process.env.RETRIEVAL_MIN_RESULTS_THRESHOLD || '2'),
      
      // Reranking parameters
      rerankTimeoutMs: parseInt(process.env.RETRIEVAL_RERANK_TIMEOUT_MS || '150')
    };
    
    // Apply BM25-only mode if enabled
    if (this.config.enableBM25Only) {
      baseConfig.enableEmbeddings = false;
      baseConfig.enableExpansion = 'off';
      baseConfig.enableReranking = false;
    }
    
    return { ...baseConfig, ...overrides };
  }
  
  /**
   * Update feature flag configuration at runtime
   */
  updateConfig(updates: Partial<FeatureFlagConfig>, reason: string = 'manual_update'): ConfigValidationResult {
    // Validate configuration
    const validation = this.validateConfig({ ...this.config, ...updates });
    
    if (!validation.isValid) {
      console.error('feature_flag_config_validation_failed', {
        errors: validation.errors,
        warnings: validation.warnings
      });
      return validation;
    }
    
    // Store previous config in history
    this.configHistory.push({
      timestamp: Date.now(),
      config: { ...this.config },
      reason: `pre_update_${reason}`
    });
    
    // Apply updates
    const previousConfig = { ...this.config };
    this.config = {
      ...this.config,
      ...updates,
      configVersion: this.generateConfigVersion(),
      lastUpdated: Date.now()
    };
    
    // Log configuration change
    console.log('feature_flag_config_updated', {
      reason,
      previous_version: previousConfig.configVersion,
      new_version: this.config.configVersion,
      changes: updates,
      runtime_switching_allowed: this.config.allowRuntimeSwitching
    });
    
    return validation;
  }
  
  /**
   * Validate feature flag configuration
   */
  validateConfig(config: FeatureFlagConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const safeDefaults: Partial<HybridRetrievalConfig> = {};
    
    // Validate A/B test configuration
    if (config.abTestEnabled) {
      if (config.abTestTrafficSplit < 0 || config.abTestTrafficSplit > 1) {
        errors.push('abTestTrafficSplit must be between 0.0 and 1.0');
      }
      
      if (!config.abTestName || config.abTestName.trim().length === 0) {
        warnings.push('abTestName is empty, using default');
      }
    }
    
    // Validate traffic split even when A/B testing is disabled
    if (config.abTestTrafficSplit < 0 || config.abTestTrafficSplit > 1) {
      errors.push('abTestTrafficSplit must be between 0.0 and 1.0');
    }
    
    // Validate feature flag combinations
    if (config.enableBM25Only && (config.enableEmbeddings || config.enableExpansion === 'auto' || config.enableReranking)) {
      warnings.push('BM25-only mode enabled but other features are also enabled - BM25-only will take precedence');
      safeDefaults.enableEmbeddings = false;
      safeDefaults.enableExpansion = 'off';
      safeDefaults.enableReranking = false;
    }
    
    if (config.enableExpansion === 'auto' && !process.env.OPENAI_API_KEY) {
      warnings.push('Query expansion enabled but OPENAI_API_KEY not found - expansion will be disabled');
      safeDefaults.enableExpansion = 'off';
    }
    
    if (config.enableReranking && !process.env.OPENAI_API_KEY) {
      warnings.push('Result reranking enabled but OPENAI_API_KEY not found - reranking will be disabled');
      safeDefaults.enableReranking = false;
    }
    
    // Validate monitoring configuration
    if (!config.trackUsageMetrics && config.abTestEnabled) {
      warnings.push('A/B testing enabled but usage metrics tracking is disabled - test results may be incomplete');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      safeDefaults
    };
  }
  
  /**
   * Track feature usage for monitoring
   */
  private trackFeatureUsage(featureName: string, userId: string, success: boolean = true, latencyMs?: number): void {
    if (!this.config.trackUsageMetrics) {
      return;
    }
    
    const existing = this.usageMetrics.get(featureName) || {
      featureName,
      variant: this.getUserVariant(userId),
      usageCount: 0,
      successCount: 0,
      errorCount: 0,
      averageLatencyMs: 0,
      p95LatencyMs: 0,
      lastUsed: 0,
      performanceImpact: {
        baselineLatencyMs: 0,
        currentLatencyMs: 0,
        impactPercent: 0
      }
    };
    
    existing.usageCount++;
    existing.lastUsed = Date.now();
    
    if (success) {
      existing.successCount++;
    } else {
      existing.errorCount++;
    }
    
    if (latencyMs !== undefined) {
      // Update running average
      const totalLatency = existing.averageLatencyMs * (existing.usageCount - 1) + latencyMs;
      existing.averageLatencyMs = totalLatency / existing.usageCount;
    }
    
    this.usageMetrics.set(featureName, existing);
    
    if (this.config.logFeatureUsage) {
      console.log('feature_usage_tracked', {
        feature: featureName,
        user_id: userId,
        success,
        latency_ms: latencyMs,
        total_usage: existing.usageCount
      });
    }
  }
  
  /**
   * Get current feature usage metrics
   */
  getUsageMetrics(): FeatureUsageMetrics[] {
    return Array.from(this.usageMetrics.values());
  }
  
  /**
   * Get A/B test results and statistics
   */
  getABTestResults(testId: string): {
    test: ABTestDefinition;
    results: {
      variant: string;
      sampleSize: number;
      metrics: FeatureUsageMetrics;
      conversionRate: number;
      confidenceInterval: { lower: number; upper: number };
    }[];
    significance: {
      isSignificant: boolean;
      pValue: number;
      confidenceLevel: number;
    };
  } | null {
    const test = this.abTests.get(testId);
    if (!test) {
      return null;
    }
    
    const results = test.variants.map(variant => {
      const metrics = this.usageMetrics.get(`ab_test_${variant.name}`) || {
        featureName: `ab_test_${variant.name}`,
        variant: variant.name,
        usageCount: 0,
        successCount: 0,
        errorCount: 0,
        averageLatencyMs: 0,
        p95LatencyMs: 0,
        lastUsed: 0,
        performanceImpact: {
          baselineLatencyMs: 0,
          currentLatencyMs: 0,
          impactPercent: 0
        }
      };
      
      const conversionRate = metrics.usageCount > 0 ? metrics.successCount / metrics.usageCount : 0;
      const confidenceInterval = this.calculateConfidenceInterval(metrics.successCount, metrics.usageCount, test.confidenceLevel);
      
      return {
        variant: variant.name,
        sampleSize: metrics.usageCount,
        metrics,
        conversionRate,
        confidenceInterval
      };
    });
    
    // Calculate statistical significance
    const significance = this.calculateStatisticalSignificance(results, test.confidenceLevel);
    
    return {
      test,
      results,
      significance
    };
  }
  
  /**
   * Calculate confidence interval for conversion rate
   */
  private calculateConfidenceInterval(successes: number, trials: number, confidenceLevel: number): { lower: number; upper: number } {
    if (trials === 0) {
      return { lower: 0, upper: 0 };
    }
    
    const p = successes / trials;
    const z = this.getZScore(confidenceLevel);
    const margin = z * Math.sqrt((p * (1 - p)) / trials);
    
    return {
      lower: Math.max(0, p - margin),
      upper: Math.min(1, p + margin)
    };
  }
  
  /**
   * Get Z-score for confidence level
   */
  private getZScore(confidenceLevel: number): number {
    // Common Z-scores for confidence levels
    const zScores: { [key: number]: number } = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576
    };
    
    return zScores[confidenceLevel] || 1.96; // Default to 95%
  }
  
  /**
   * Calculate statistical significance between variants
   */
  private calculateStatisticalSignificance(
    results: Array<{ variant: string; sampleSize: number; conversionRate: number }>,
    confidenceLevel: number
  ): { isSignificant: boolean; pValue: number; confidenceLevel: number } {
    if (results.length < 2) {
      return { isSignificant: false, pValue: 1.0, confidenceLevel };
    }
    
    // Simple two-proportion z-test for now
    const [control, treatment] = results;
    
    if (control.sampleSize === 0 || treatment.sampleSize === 0) {
      return { isSignificant: false, pValue: 1.0, confidenceLevel };
    }
    
    const p1 = control.conversionRate;
    const p2 = treatment.conversionRate;
    const n1 = control.sampleSize;
    const n2 = treatment.sampleSize;
    
    const pooledP = (p1 * n1 + p2 * n2) / (n1 + n2);
    const se = Math.sqrt(pooledP * (1 - pooledP) * (1/n1 + 1/n2));
    
    if (se === 0) {
      return { isSignificant: false, pValue: 1.0, confidenceLevel };
    }
    
    const z = Math.abs(p1 - p2) / se;
    const pValue = 2 * (1 - this.normalCDF(z)); // Two-tailed test
    
    return {
      isSignificant: pValue < (1 - confidenceLevel),
      pValue,
      confidenceLevel
    };
  }
  
  /**
   * Normal cumulative distribution function approximation
   */
  private normalCDF(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }
  
  /**
   * Error function approximation
   */
  private erf(x: number): number {
    // Abramowitz and Stegun approximation
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;
    
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return sign * y;
  }
  
  /**
   * Create a new A/B test
   */
  createABTest(testDefinition: ABTestDefinition): void {
    // Validate test definition
    if (this.abTests.has(testDefinition.testId)) {
      throw new Error(`A/B test with ID ${testDefinition.testId} already exists`);
    }
    
    // Validate traffic allocation
    const totalAllocation = testDefinition.variants.reduce((sum, v) => sum + v.trafficAllocation, 0);
    if (Math.abs(totalAllocation - 1.0) > 0.001) {
      throw new Error(`Total traffic allocation must equal 1.0, got ${totalAllocation}`);
    }
    
    this.abTests.set(testDefinition.testId, testDefinition);
    
    console.log('ab_test_created', {
      test_id: testDefinition.testId,
      name: testDefinition.name,
      variants: testDefinition.variants.length,
      status: testDefinition.status
    });
  }
  
  /**
   * Update A/B test status
   */
  updateABTestStatus(testId: string, status: ABTestDefinition['status']): void {
    const test = this.abTests.get(testId);
    if (!test) {
      throw new Error(`A/B test with ID ${testId} not found`);
    }
    
    test.status = status;
    
    console.log('ab_test_status_updated', {
      test_id: testId,
      new_status: status
    });
  }
  
  /**
   * Get current configuration
   */
  getConfig(): FeatureFlagConfig {
    return { ...this.config };
  }
  
  /**
   * Get configuration history for rollback
   */
  getConfigHistory(): Array<{ timestamp: number; config: FeatureFlagConfig; reason: string }> {
    return [...this.configHistory];
  }
  
  /**
   * Rollback to previous configuration
   */
  rollbackConfig(targetTimestamp: number, reason: string = 'rollback'): boolean {
    const targetConfig = this.configHistory.find(entry => entry.timestamp === targetTimestamp);
    
    if (!targetConfig) {
      console.error('rollback_target_not_found', { target_timestamp: targetTimestamp });
      return false;
    }
    
    // Store current config in history before rollback
    this.configHistory.push({
      timestamp: Date.now(),
      config: { ...this.config },
      reason: `pre_rollback_${reason}`
    });
    
    // Apply rollback
    this.config = {
      ...targetConfig.config,
      configVersion: this.generateConfigVersion(),
      lastUpdated: Date.now()
    };
    
    console.log('feature_flag_config_rolled_back', {
      reason,
      target_timestamp: targetTimestamp,
      new_version: this.config.configVersion
    });
    
    return true;
  }
  
  /**
   * Export configuration for deployment
   */
  exportConfig(): {
    config: FeatureFlagConfig;
    abTests: ABTestDefinition[];
    metadata: {
      exportedAt: number;
      version: string;
      environment: string;
    };
  } {
    return {
      config: { ...this.config },
      abTests: Array.from(this.abTests.values()),
      metadata: {
        exportedAt: Date.now(),
        version: this.config.configVersion,
        environment: process.env.NODE_ENV || 'development'
      }
    };
  }
  
  /**
   * Import configuration for deployment
   */
  importConfig(exportedData: {
    config: FeatureFlagConfig;
    abTests: ABTestDefinition[];
    metadata: any;
  }, reason: string = 'import'): ConfigValidationResult {
    // Validate imported configuration
    const validation = this.validateConfig(exportedData.config);
    
    if (!validation.isValid) {
      console.error('imported_config_validation_failed', {
        errors: validation.errors,
        warnings: validation.warnings
      });
      return validation;
    }
    
    // Store current state in history
    this.configHistory.push({
      timestamp: Date.now(),
      config: { ...this.config },
      reason: `pre_import_${reason}`
    });
    
    // Apply imported configuration
    this.config = {
      ...exportedData.config,
      configVersion: this.generateConfigVersion(),
      lastUpdated: Date.now()
    };
    
    // Import A/B tests
    this.abTests.clear();
    exportedData.abTests.forEach(test => {
      this.abTests.set(test.testId, test);
    });
    
    console.log('feature_flag_config_imported', {
      reason,
      imported_version: exportedData.metadata.version,
      new_version: this.config.configVersion,
      ab_tests_count: exportedData.abTests.length
    });
    
    return validation;
  }
}

/**
 * Create singleton instance with environment configuration
 */
export const featureFlagManager = new FeatureFlagManager();