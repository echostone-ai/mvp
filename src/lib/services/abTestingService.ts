// src/lib/services/abTestingService.ts
// A/B testing service for hybrid retrieval system comparison

import { HybridRetriever, HybridRetrievalConfig, RetrievalResult, RetrievalMetrics } from './hybridRetrieval';
import { FeatureFlagManager, ABTestDefinition, FeatureUsageMetrics } from './featureFlagManager';
import { FactbookService } from './factbookService';
import { EmbeddingCache } from './embeddingCache';
import { CacheManager } from './cacheManager';
import { PerformanceMonitor } from './performanceMonitor';

/**
 * A/B test experiment result
 */
export interface ABTestExperimentResult {
  userId: string;
  testId: string;
  variant: 'control' | 'treatment';
  query: string;
  results: RetrievalResult[];
  metrics: RetrievalMetrics;
  timestamp: number;
  sessionId?: string;
}

/**
 * A/B test comparison metrics
 */
export interface ABTestComparisonMetrics {
  testId: string;
  controlMetrics: {
    sampleSize: number;
    averageLatencyMs: number;
    p95LatencyMs: number;
    averageResultCount: number;
    averageRelevanceScore: number;
    successRate: number;
    errorRate: number;
  };
  treatmentMetrics: {
    sampleSize: number;
    averageLatencyMs: number;
    p95LatencyMs: number;
    averageResultCount: number;
    averageRelevanceScore: number;
    successRate: number;
    errorRate: number;
  };
  comparison: {
    latencyImprovementPercent: number;
    relevanceImprovementPercent: number;
    resultCountImprovementPercent: number;
    statisticalSignificance: {
      isSignificant: boolean;
      pValue: number;
      confidenceLevel: number;
    };
  };
  lastUpdated: number;
}

/**
 * A/B testing service for comparing retrieval methods
 */
export class ABTestingService {
  private featureFlagManager: FeatureFlagManager;
  private controlRetriever: HybridRetriever;
  private treatmentRetriever: HybridRetriever;
  private experimentResults: Map<string, ABTestExperimentResult[]> = new Map();
  private comparisonMetrics: Map<string, ABTestComparisonMetrics> = new Map();
  private performanceMonitor: PerformanceMonitor | null = null;
  
  constructor(
    featureFlagManager: FeatureFlagManager,
    factbookService?: FactbookService,
    embeddingCache?: EmbeddingCache,
    cacheManager?: CacheManager,
    performanceMonitor?: PerformanceMonitor
  ) {
    this.featureFlagManager = featureFlagManager;
    this.performanceMonitor = performanceMonitor || null;
    
    // Initialize control retriever (BM25-only baseline)
    const controlConfig: HybridRetrievalConfig = {
      enableEmbeddings: false,
      enableExpansion: 'off',
      enableReranking: false,
      expansionThreshold: 0.3,
      maxResults: 10,
      fusionK: 60,
      timeoutMs: 500,
      bm25K1: 1.2,
      bm25B: 0.75,
      vectorSimilarityThreshold: 0.3,
      vectorMaxResults: 20,
      bm25Weight: 1.0, // Full weight to BM25 for control
      vectorWeight: 0.0,
      expansionTimeoutMs: 200,
      lowConfidenceThreshold: 0.35,
      minResultsThreshold: 2,
      rerankTimeoutMs: 150
    };
    
    this.controlRetriever = new HybridRetriever(
      controlConfig,
      factbookService,
      embeddingCache,
      cacheManager,
      performanceMonitor
    );
    
    // Initialize treatment retriever (full hybrid)
    const treatmentConfig: HybridRetrievalConfig = {
      enableEmbeddings: true,
      enableExpansion: 'auto',
      enableReranking: true,
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
    };
    
    this.treatmentRetriever = new HybridRetriever(
      treatmentConfig,
      factbookService,
      embeddingCache,
      cacheManager,
      performanceMonitor
    );
    
    console.log('ab_testing_service_initialized', {
      control_config: controlConfig,
      treatment_config: treatmentConfig
    });
  }
  
  /**
   * Perform A/B test retrieval for a user
   */
  async performABTestRetrieval(
    userId: string,
    query: string,
    testId: string = 'hybrid_retrieval_test',
    sessionId?: string
  ): Promise<{
    variant: 'control' | 'treatment';
    results: RetrievalResult[];
    metrics: RetrievalMetrics;
    experimentResult: ABTestExperimentResult;
  }> {
    // Get user's assigned variant
    const config = this.featureFlagManager.getConfigForUser(userId);
    const variant = this.determineVariant(userId, config);
    
    // Select appropriate retriever
    const retriever = variant === 'control' ? this.controlRetriever : this.treatmentRetriever;
    
    // Perform retrieval
    const startTime = Date.now();
    const { results, metrics } = await retriever.retrieve(query);
    
    // Create experiment result
    const experimentResult: ABTestExperimentResult = {
      userId,
      testId,
      variant,
      query,
      results,
      metrics,
      timestamp: startTime,
      sessionId
    };
    
    // Store experiment result
    this.storeExperimentResult(experimentResult);
    
    // Update comparison metrics
    this.updateComparisonMetrics(testId);
    
    // Log experiment
    console.log('ab_test_experiment_completed', {
      user_id: userId,
      test_id: testId,
      variant,
      query,
      result_count: results.length,
      total_time_ms: metrics.totalTimeMs,
      methods_used: metrics.methodsUsed
    });
    
    return {
      variant,
      results,
      metrics,
      experimentResult
    };
  }
  
  /**
   * Determine user's variant based on feature flag configuration
   */
  private determineVariant(userId: string, config: HybridRetrievalConfig): 'control' | 'treatment' {
    // If embeddings are disabled, it's control (BM25-only)
    if (!config.enableEmbeddings && config.enableExpansion === 'off' && !config.enableReranking) {
      return 'control';
    }
    
    // If any hybrid features are enabled, it's treatment
    if (config.enableEmbeddings || config.enableExpansion === 'auto' || config.enableReranking) {
      return 'treatment';
    }
    
    // Default to control
    return 'control';
  }
  
  /**
   * Store experiment result for analysis
   */
  private storeExperimentResult(result: ABTestExperimentResult): void {
    const testResults = this.experimentResults.get(result.testId) || [];
    testResults.push(result);
    this.experimentResults.set(result.testId, testResults);
    
    // Keep only recent results (last 10,000 per test)
    if (testResults.length > 10000) {
      testResults.splice(0, testResults.length - 10000);
    }
  }
  
  /**
   * Update comparison metrics for a test
   */
  private updateComparisonMetrics(testId: string): void {
    const results = this.experimentResults.get(testId) || [];
    
    if (results.length === 0) {
      return;
    }
    
    const controlResults = results.filter(r => r.variant === 'control');
    const treatmentResults = results.filter(r => r.variant === 'treatment');
    
    if (controlResults.length === 0 || treatmentResults.length === 0) {
      return;
    }
    
    // Calculate control metrics
    const controlMetrics = this.calculateVariantMetrics(controlResults);
    
    // Calculate treatment metrics
    const treatmentMetrics = this.calculateVariantMetrics(treatmentResults);
    
    // Calculate comparison
    const comparison = this.calculateComparison(controlMetrics, treatmentMetrics);
    
    // Store comparison metrics
    const comparisonMetrics: ABTestComparisonMetrics = {
      testId,
      controlMetrics,
      treatmentMetrics,
      comparison,
      lastUpdated: Date.now()
    };
    
    this.comparisonMetrics.set(testId, comparisonMetrics);
  }
  
  /**
   * Calculate metrics for a variant
   */
  private calculateVariantMetrics(results: ABTestExperimentResult[]): ABTestComparisonMetrics['controlMetrics'] {
    if (results.length === 0) {
      return {
        sampleSize: 0,
        averageLatencyMs: 0,
        p95LatencyMs: 0,
        averageResultCount: 0,
        averageRelevanceScore: 0,
        successRate: 0,
        errorRate: 0
      };
    }
    
    const latencies = results.map(r => r.metrics.totalTimeMs);
    const resultCounts = results.map(r => r.results.length);
    const relevanceScores = results.map(r => r.metrics.confidenceScore);
    const successCount = results.filter(r => r.metrics.errors.length === 0).length;
    
    // Calculate P95 latency
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p95LatencyMs = sortedLatencies[p95Index] || 0;
    
    return {
      sampleSize: results.length,
      averageLatencyMs: latencies.reduce((sum, l) => sum + l, 0) / latencies.length,
      p95LatencyMs,
      averageResultCount: resultCounts.reduce((sum, c) => sum + c, 0) / resultCounts.length,
      averageRelevanceScore: relevanceScores.reduce((sum, s) => sum + s, 0) / relevanceScores.length,
      successRate: successCount / results.length,
      errorRate: (results.length - successCount) / results.length
    };
  }
  
  /**
   * Calculate comparison between control and treatment
   */
  private calculateComparison(
    control: ABTestComparisonMetrics['controlMetrics'],
    treatment: ABTestComparisonMetrics['treatmentMetrics']
  ): ABTestComparisonMetrics['comparison'] {
    // Calculate improvement percentages
    const latencyImprovementPercent = control.averageLatencyMs > 0 
      ? ((control.averageLatencyMs - treatment.averageLatencyMs) / control.averageLatencyMs) * 100
      : 0;
    
    const relevanceImprovementPercent = control.averageRelevanceScore > 0
      ? ((treatment.averageRelevanceScore - control.averageRelevanceScore) / control.averageRelevanceScore) * 100
      : 0;
    
    const resultCountImprovementPercent = control.averageResultCount > 0
      ? ((treatment.averageResultCount - control.averageResultCount) / control.averageResultCount) * 100
      : 0;
    
    // Calculate statistical significance (simplified two-proportion z-test)
    const statisticalSignificance = this.calculateStatisticalSignificance(
      control.successRate,
      control.sampleSize,
      treatment.successRate,
      treatment.sampleSize
    );
    
    return {
      latencyImprovementPercent,
      relevanceImprovementPercent,
      resultCountImprovementPercent,
      statisticalSignificance
    };
  }
  
  /**
   * Calculate statistical significance between two proportions
   */
  private calculateStatisticalSignificance(
    p1: number,
    n1: number,
    p2: number,
    n2: number,
    confidenceLevel: number = 0.95
  ): { isSignificant: boolean; pValue: number; confidenceLevel: number } {
    if (n1 === 0 || n2 === 0) {
      return { isSignificant: false, pValue: 1.0, confidenceLevel };
    }
    
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
   * Get A/B test comparison metrics
   */
  getComparisonMetrics(testId: string): ABTestComparisonMetrics | null {
    return this.comparisonMetrics.get(testId) || null;
  }
  
  /**
   * Get all experiment results for a test
   */
  getExperimentResults(testId: string): ABTestExperimentResult[] {
    return this.experimentResults.get(testId) || [];
  }
  
  /**
   * Get experiment results for a specific user
   */
  getUserExperimentResults(userId: string, testId?: string): ABTestExperimentResult[] {
    const allResults: ABTestExperimentResult[] = [];
    
    for (const [currentTestId, results] of this.experimentResults.entries()) {
      if (testId && currentTestId !== testId) {
        continue;
      }
      
      const userResults = results.filter(r => r.userId === userId);
      allResults.push(...userResults);
    }
    
    return allResults.sort((a, b) => b.timestamp - a.timestamp);
  }
  
  /**
   * Run batch comparison between control and treatment
   */
  async runBatchComparison(
    queries: string[],
    userId: string = 'batch_test_user',
    testId: string = 'batch_comparison_test'
  ): Promise<{
    controlResults: Array<{ query: string; results: RetrievalResult[]; metrics: RetrievalMetrics }>;
    treatmentResults: Array<{ query: string; results: RetrievalResult[]; metrics: RetrievalMetrics }>;
    comparison: ABTestComparisonMetrics;
  }> {
    console.log('ab_test_batch_comparison_start', {
      query_count: queries.length,
      test_id: testId
    });
    
    const controlResults: Array<{ query: string; results: RetrievalResult[]; metrics: RetrievalMetrics }> = [];
    const treatmentResults: Array<{ query: string; results: RetrievalResult[]; metrics: RetrievalMetrics }> = [];
    
    // Run control queries
    for (const query of queries) {
      try {
        const { results, metrics } = await this.controlRetriever.retrieve(query);
        controlResults.push({ query, results, metrics });
        
        // Store as experiment result
        const experimentResult: ABTestExperimentResult = {
          userId: `${userId}_control`,
          testId,
          variant: 'control',
          query,
          results,
          metrics,
          timestamp: Date.now()
        };
        this.storeExperimentResult(experimentResult);
        
      } catch (error) {
        console.error('batch_comparison_control_error', {
          query,
          error: error instanceof Error ? error.message : error
        });
      }
    }
    
    // Run treatment queries
    for (const query of queries) {
      try {
        const { results, metrics } = await this.treatmentRetriever.retrieve(query);
        treatmentResults.push({ query, results, metrics });
        
        // Store as experiment result
        const experimentResult: ABTestExperimentResult = {
          userId: `${userId}_treatment`,
          testId,
          variant: 'treatment',
          query,
          results,
          metrics,
          timestamp: Date.now()
        };
        this.storeExperimentResult(experimentResult);
        
      } catch (error) {
        console.error('batch_comparison_treatment_error', {
          query,
          error: error instanceof Error ? error.message : error
        });
      }
    }
    
    // Update comparison metrics
    this.updateComparisonMetrics(testId);
    const comparison = this.comparisonMetrics.get(testId)!;
    
    console.log('ab_test_batch_comparison_complete', {
      control_results: controlResults.length,
      treatment_results: treatmentResults.length,
      comparison_metrics: comparison
    });
    
    return {
      controlResults,
      treatmentResults,
      comparison
    };
  }
  
  /**
   * Generate A/B test report
   */
  generateTestReport(testId: string): {
    testId: string;
    summary: {
      totalExperiments: number;
      controlExperiments: number;
      treatmentExperiments: number;
      testDurationDays: number;
      lastExperiment: number;
    };
    metrics: ABTestComparisonMetrics | null;
    recommendations: string[];
    rawData: ABTestExperimentResult[];
  } {
    const results = this.experimentResults.get(testId) || [];
    const metrics = this.comparisonMetrics.get(testId) || null;
    
    const controlCount = results.filter(r => r.variant === 'control').length;
    const treatmentCount = results.filter(r => r.variant === 'treatment').length;
    
    const timestamps = results.map(r => r.timestamp);
    const firstExperiment = Math.min(...timestamps);
    const lastExperiment = Math.max(...timestamps);
    const testDurationDays = (lastExperiment - firstExperiment) / (1000 * 60 * 60 * 24);
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    if (metrics) {
      if (metrics.comparison.statisticalSignificance.isSignificant) {
        if (metrics.comparison.relevanceImprovementPercent > 5) {
          recommendations.push('Treatment shows significant improvement in relevance - consider rolling out hybrid retrieval');
        } else if (metrics.comparison.relevanceImprovementPercent < -5) {
          recommendations.push('Treatment shows significant decrease in relevance - consider keeping BM25-only');
        }
        
        if (metrics.comparison.latencyImprovementPercent < -20) {
          recommendations.push('Treatment has significant latency impact - consider optimizing or reducing features');
        }
      } else {
        recommendations.push('Results are not statistically significant - continue testing or increase sample size');
      }
      
      if (controlCount < 1000 || treatmentCount < 1000) {
        recommendations.push('Sample size is small - continue collecting data for more reliable results');
      }
    } else {
      recommendations.push('No comparison metrics available - ensure both variants have sufficient data');
    }
    
    return {
      testId,
      summary: {
        totalExperiments: results.length,
        controlExperiments: controlCount,
        treatmentExperiments: treatmentCount,
        testDurationDays,
        lastExperiment
      },
      metrics,
      recommendations,
      rawData: results
    };
  }
  
  /**
   * Clear experiment data for a test
   */
  clearExperimentData(testId: string): void {
    this.experimentResults.delete(testId);
    this.comparisonMetrics.delete(testId);
    
    console.log('ab_test_data_cleared', { test_id: testId });
  }
  
  /**
   * Warmup both retrievers
   */
  async warmup(): Promise<void> {
    console.log('ab_testing_service_warmup_start');
    
    await Promise.all([
      this.controlRetriever.warmup(),
      this.treatmentRetriever.warmup()
    ]);
    
    console.log('ab_testing_service_warmup_complete');
  }
  
  /**
   * Get health status of both retrievers
   */
  getHealthStatus(): {
    control: any;
    treatment: any;
    overall: 'healthy' | 'degraded' | 'unhealthy';
  } {
    const controlHealth = this.controlRetriever.getHealthStatus();
    const treatmentHealth = this.treatmentRetriever.getHealthStatus();
    
    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (controlHealth.status === 'unhealthy' || treatmentHealth.status === 'unhealthy') {
      overall = 'unhealthy';
    } else if (controlHealth.status === 'degraded' || treatmentHealth.status === 'degraded') {
      overall = 'degraded';
    }
    
    return {
      control: controlHealth,
      treatment: treatmentHealth,
      overall
    };
  }
}

/**
 * Create singleton instance
 */
export const abTestingService = new ABTestingService(
  new (require('./featureFlagManager').FeatureFlagManager)()
);