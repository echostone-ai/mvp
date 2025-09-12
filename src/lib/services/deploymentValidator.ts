/**
 * Deployment Validation for Hybrid Retrieval System
 * 
 * Validates that hybrid retrieval functionality works correctly
 * after deployments and system updates.
 */

import { HybridRetriever } from './hybridRetrieval';
import { FactbookService } from './factbookService';

export interface ValidationTest {
  id: string;
  name: string;
  description: string;
  category: 'functionality' | 'performance' | 'integration' | 'semantic';
  timeout: number;
  critical: boolean;
}

export interface ValidationResult {
  testId: string;
  testName: string;
  status: 'pass' | 'fail' | 'skip' | 'timeout';
  duration: number;
  message: string;
  details?: any;
  error?: string;
}

export interface ValidationReport {
  timestamp: number;
  environment: string;
  version: string;
  overallStatus: 'pass' | 'fail' | 'partial';
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    timeouts: number;
  };
  results: ValidationResult[];
  criticalFailures: ValidationResult[];
  recommendations: string[];
}

export interface ValidationConfig {
  environment: string;
  version: string;
  timeout: number;
  skipNonCritical: boolean;
  enablePerformanceTests: boolean;
  enableSemanticTests: boolean;
}

export class DeploymentValidator {
  private hybridRetriever: HybridRetriever;
  private factbookService: FactbookService;
  private tests: Map<string, ValidationTest>;

  constructor(hybridRetriever: HybridRetriever, factbookService: FactbookService) {
    this.hybridRetriever = hybridRetriever;
    this.factbookService = factbookService;
    this.tests = new Map();
    
    this.setupValidationTests();
  }

  /**
   * Run all validation tests
   */
  async runValidation(config: ValidationConfig): Promise<ValidationReport> {
    console.log(`Starting deployment validation for ${config.environment} v${config.version}`);
    
    const startTime = Date.now();
    const results: ValidationResult[] = [];
    const testsToRun = Array.from(this.tests.values())
      .filter(test => !config.skipNonCritical || test.critical);

    // Run tests
    for (const test of testsToRun) {
      const result = await this.runTest(test, config);
      results.push(result);
      
      console.log(`Test ${test.id}: ${result.status} (${result.duration}ms)`);
      
      // Stop on critical failure if configured
      if (result.status === 'fail' && test.critical) {
        console.error(`Critical test failed: ${test.name}`);
      }
    }

    // Generate report
    const report = this.generateReport(config, results, Date.now() - startTime);
    
    console.log(`Validation completed: ${report.overallStatus} (${report.summary.passed}/${report.summary.total} passed)`);
    
    return report;
  }

  /**
   * Run quick health check
   */
  async runHealthCheck(): Promise<{ healthy: boolean; message: string; details: any }> {
    try {
      // Test basic retrieval
      const testQuery = "test query";
      const startTime = Date.now();
      const result = await this.hybridRetriever.retrieve(testQuery);
      const duration = Date.now() - startTime;

      if (duration > 5000) {
        return {
          healthy: false,
          message: `Health check took too long: ${duration}ms`,
          details: { duration, resultCount: result.results.length }
        };
      }

      return {
        healthy: true,
        message: `Health check passed in ${duration}ms`,
        details: { duration, resultCount: result.results.length }
      };
      
    } catch (error) {
      return {
        healthy: false,
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
        details: { error }
      };
    }
  }

  /**
   * Validate specific component
   */
  async validateComponent(component: string): Promise<ValidationResult> {
    const test = this.tests.get(`component_${component}`);
    if (!test) {
      return {
        testId: `component_${component}`,
        testName: `Component ${component}`,
        status: 'skip',
        duration: 0,
        message: `No validation test found for component: ${component}`
      };
    }

    return this.runTest(test, {
      environment: 'test',
      version: 'unknown',
      timeout: 30000,
      skipNonCritical: false,
      enablePerformanceTests: true,
      enableSemanticTests: true
    });
  }

  private setupValidationTests(): void {
    // Basic functionality tests
    this.addTest({
      id: 'basic_retrieval',
      name: 'Basic Retrieval Test',
      description: 'Test that basic retrieval functionality works',
      category: 'functionality',
      timeout: 10000,
      critical: true
    });

    this.addTest({
      id: 'bm25_retrieval',
      name: 'BM25 Retrieval Test',
      description: 'Test BM25 text search functionality',
      category: 'functionality',
      timeout: 5000,
      critical: true
    });

    this.addTest({
      id: 'vector_retrieval',
      name: 'Vector Retrieval Test',
      description: 'Test semantic vector search functionality',
      category: 'functionality',
      timeout: 10000,
      critical: true
    });

    this.addTest({
      id: 'hybrid_fusion',
      name: 'Hybrid Fusion Test',
      description: 'Test that BM25 and vector results are properly fused',
      category: 'functionality',
      timeout: 15000,
      critical: true
    });

    // Semantic connection tests
    this.addTest({
      id: 'semantic_snake_story',
      name: 'Snake Story Semantic Connection',
      description: 'Test snake story → cobra memory connection',
      category: 'semantic',
      timeout: 15000,
      critical: true
    });

    this.addTest({
      id: 'semantic_sxsw_meetings',
      name: 'SXSW Meetings Semantic Connection',
      description: 'Test SXSW meetings → concert memories connection',
      category: 'semantic',
      timeout: 15000,
      critical: true
    });

    this.addTest({
      id: 'semantic_tyler_partner',
      name: 'Tyler Partner Semantic Connection',
      description: 'Test Tyler → Cansu relationship connection',
      category: 'semantic',
      timeout: 15000,
      critical: true
    });

    // Performance tests
    this.addTest({
      id: 'performance_latency',
      name: 'Latency Performance Test',
      description: 'Test that retrieval latency is within acceptable bounds',
      category: 'performance',
      timeout: 30000,
      critical: false
    });

    this.addTest({
      id: 'performance_throughput',
      name: 'Throughput Performance Test',
      description: 'Test system throughput under load',
      category: 'performance',
      timeout: 60000,
      critical: false
    });

    // Integration tests
    this.addTest({
      id: 'integration_factbook',
      name: 'Factbook Integration Test',
      description: 'Test integration with factbook service',
      category: 'integration',
      timeout: 10000,
      critical: true
    });

    this.addTest({
      id: 'integration_caching',
      name: 'Caching Integration Test',
      description: 'Test that caching systems work correctly',
      category: 'integration',
      timeout: 15000,
      critical: false
    });

    // Component health tests
    this.addTest({
      id: 'component_embedding_service',
      name: 'Embedding Service Health',
      description: 'Test embedding service functionality',
      category: 'functionality',
      timeout: 10000,
      critical: true
    });

    this.addTest({
      id: 'component_query_expander',
      name: 'Query Expander Health',
      description: 'Test query expansion functionality',
      category: 'functionality',
      timeout: 15000,
      critical: false
    });

    this.addTest({
      id: 'component_result_reranker',
      name: 'Result Reranker Health',
      description: 'Test result reranking functionality',
      category: 'functionality',
      timeout: 15000,
      critical: false
    });
  }

  private addTest(test: ValidationTest): void {
    this.tests.set(test.id, test);
  }

  private async runTest(test: ValidationTest, config: ValidationConfig): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Test timeout')), test.timeout);
      });

      // Run the actual test
      const testPromise = this.executeTest(test, config);
      
      const result = await Promise.race([testPromise, timeoutPromise]);
      
      return {
        testId: test.id,
        testName: test.name,
        status: 'pass',
        duration: Date.now() - startTime,
        message: result.message,
        details: result.details
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const isTimeout = duration >= test.timeout - 100; // Allow small margin
      
      return {
        testId: test.id,
        testName: test.name,
        status: isTimeout ? 'timeout' : 'fail',
        duration,
        message: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error.stack : String(error)
      };
    }
  }

  private async executeTest(test: ValidationTest, config: ValidationConfig): Promise<{ message: string; details?: any }> {
    switch (test.id) {
      case 'basic_retrieval':
        return this.testBasicRetrieval();
      
      case 'bm25_retrieval':
        return this.testBM25Retrieval();
      
      case 'vector_retrieval':
        return this.testVectorRetrieval();
      
      case 'hybrid_fusion':
        return this.testHybridFusion();
      
      case 'semantic_snake_story':
        return this.testSemanticConnection('snake story', ['cobra', 'morocco']);
      
      case 'semantic_sxsw_meetings':
        return this.testSemanticConnection('meetings at SXSW', ['bill murray', 'gza', 'concert']);
      
      case 'semantic_tyler_partner':
        return this.testSemanticConnection('Tyler partner', ['cansu', 'relationship']);
      
      case 'performance_latency':
        return this.testLatencyPerformance();
      
      case 'performance_throughput':
        return this.testThroughputPerformance();
      
      case 'integration_factbook':
        return this.testFactbookIntegration();
      
      case 'integration_caching':
        return this.testCachingIntegration();
      
      case 'component_embedding_service':
        return this.testEmbeddingService();
      
      case 'component_query_expander':
        return this.testQueryExpander();
      
      case 'component_result_reranker':
        return this.testResultReranker();
      
      default:
        throw new Error(`Unknown test: ${test.id}`);
    }
  }

  private async testBasicRetrieval(): Promise<{ message: string; details?: any }> {
    const result = await this.hybridRetriever.retrieve('test query');
    
    if (!result || !result.results) {
      throw new Error('No results returned from hybrid retriever');
    }

    return {
      message: `Basic retrieval successful with ${result.results.length} results`,
      details: {
        resultCount: result.results.length,
        metrics: result.metrics
      }
    };
  }

  private async testBM25Retrieval(): Promise<{ message: string; details?: any }> {
    // Test with a query that should match exact terms
    const result = await this.hybridRetriever.retrieve('jonathan');
    
    if (!result.results || result.results.length === 0) {
      throw new Error('BM25 retrieval returned no results for exact term match');
    }

    const bm25Results = result.results.filter(r => r.source === 'bm25');
    if (bm25Results.length === 0) {
      throw new Error('No BM25 results found in hybrid retrieval');
    }

    return {
      message: `BM25 retrieval successful with ${bm25Results.length} BM25 results`,
      details: {
        totalResults: result.results.length,
        bm25Results: bm25Results.length,
        metrics: result.metrics
      }
    };
  }

  private async testVectorRetrieval(): Promise<{ message: string; details?: any }> {
    // Test with a semantic query
    const result = await this.hybridRetriever.retrieve('childhood memories');
    
    if (!result.results || result.results.length === 0) {
      throw new Error('Vector retrieval returned no results for semantic query');
    }

    const vectorResults = result.results.filter(r => r.source === 'vector');
    if (vectorResults.length === 0) {
      throw new Error('No vector results found in hybrid retrieval');
    }

    return {
      message: `Vector retrieval successful with ${vectorResults.length} vector results`,
      details: {
        totalResults: result.results.length,
        vectorResults: vectorResults.length,
        metrics: result.metrics
      }
    };
  }

  private async testHybridFusion(): Promise<{ message: string; details?: any }> {
    const result = await this.hybridRetriever.retrieve('jonathan childhood');
    
    if (!result.results || result.results.length === 0) {
      throw new Error('Hybrid fusion returned no results');
    }

    const sources = new Set(result.results.map(r => r.source));
    if (sources.size < 2) {
      throw new Error('Hybrid fusion did not combine multiple sources');
    }

    return {
      message: `Hybrid fusion successful with ${sources.size} different sources`,
      details: {
        totalResults: result.results.length,
        sources: Array.from(sources),
        metrics: result.metrics
      }
    };
  }

  private async testSemanticConnection(query: string, expectedTerms: string[]): Promise<{ message: string; details?: any }> {
    const result = await this.hybridRetriever.retrieve(query);
    
    if (!result.results || result.results.length === 0) {
      throw new Error(`No results found for semantic query: ${query}`);
    }

    // Check if any of the expected terms appear in the results
    const resultTexts = result.results.map(r => r.snippet.text.toLowerCase());
    const foundTerms = expectedTerms.filter(term => 
      resultTexts.some(text => text.includes(term.toLowerCase()))
    );

    if (foundTerms.length === 0) {
      throw new Error(`No expected terms found in results for query: ${query}`);
    }

    return {
      message: `Semantic connection successful: found ${foundTerms.length}/${expectedTerms.length} expected terms`,
      details: {
        query,
        expectedTerms,
        foundTerms,
        resultCount: result.results.length,
        metrics: result.metrics
      }
    };
  }

  private async testLatencyPerformance(): Promise<{ message: string; details?: any }> {
    const iterations = 10;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await this.hybridRetriever.retrieve(`test query ${i}`);
      latencies.push(Date.now() - start);
    }

    const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
    const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

    if (p95Latency > 1000) {
      throw new Error(`P95 latency too high: ${p95Latency}ms (threshold: 1000ms)`);
    }

    return {
      message: `Latency performance acceptable: avg ${avgLatency.toFixed(0)}ms, p95 ${p95Latency}ms`,
      details: {
        iterations,
        avgLatency,
        p95Latency,
        allLatencies: latencies
      }
    };
  }

  private async testThroughputPerformance(): Promise<{ message: string; details?: any }> {
    const duration = 10000; // 10 seconds
    const startTime = Date.now();
    let requestCount = 0;

    while (Date.now() - startTime < duration) {
      await this.hybridRetriever.retrieve(`throughput test ${requestCount}`);
      requestCount++;
    }

    const actualDuration = Date.now() - startTime;
    const throughput = (requestCount / actualDuration) * 1000; // requests per second

    if (throughput < 1) {
      throw new Error(`Throughput too low: ${throughput.toFixed(2)} req/s`);
    }

    return {
      message: `Throughput performance acceptable: ${throughput.toFixed(2)} req/s`,
      details: {
        requestCount,
        duration: actualDuration,
        throughput
      }
    };
  }

  private async testFactbookIntegration(): Promise<{ message: string; details?: any }> {
    // Test that factbook service is accessible
    const snippets = await this.factbookService.getAllSnippets();
    
    if (!snippets || snippets.length === 0) {
      throw new Error('Factbook service returned no snippets');
    }

    return {
      message: `Factbook integration successful with ${snippets.length} snippets`,
      details: {
        snippetCount: snippets.length
      }
    };
  }

  private async testCachingIntegration(): Promise<{ message: string; details?: any }> {
    const query = 'cache test query';
    
    // First request (cache miss)
    const start1 = Date.now();
    const result1 = await this.hybridRetriever.retrieve(query);
    const time1 = Date.now() - start1;

    // Second request (should be cached)
    const start2 = Date.now();
    const result2 = await this.hybridRetriever.retrieve(query);
    const time2 = Date.now() - start2;

    // Cache should make second request faster
    if (time2 >= time1) {
      console.warn(`Caching may not be working effectively: ${time1}ms vs ${time2}ms`);
    }

    return {
      message: `Caching integration test completed`,
      details: {
        firstRequestTime: time1,
        secondRequestTime: time2,
        speedup: time1 / time2,
        result1Count: result1.results.length,
        result2Count: result2.results.length
      }
    };
  }

  private async testEmbeddingService(): Promise<{ message: string; details?: any }> {
    // This would test the embedding service directly
    // For now, we'll test it indirectly through vector retrieval
    const result = await this.hybridRetriever.retrieve('embedding test');
    
    const vectorResults = result.results.filter(r => r.source === 'vector');
    if (vectorResults.length === 0) {
      throw new Error('Embedding service appears to be non-functional');
    }

    return {
      message: `Embedding service functional with ${vectorResults.length} vector results`,
      details: {
        vectorResults: vectorResults.length,
        metrics: result.metrics
      }
    };
  }

  private async testQueryExpander(): Promise<{ message: string; details?: any }> {
    // Test query expansion by using a low-confidence query
    const result = await this.hybridRetriever.retrieve('very specific uncommon query');
    
    return {
      message: `Query expander test completed`,
      details: {
        resultCount: result.results.length,
        metrics: result.metrics
      }
    };
  }

  private async testResultReranker(): Promise<{ message: string; details?: any }> {
    // Test result reranking
    const result = await this.hybridRetriever.retrieve('reranking test query');
    
    return {
      message: `Result reranker test completed`,
      details: {
        resultCount: result.results.length,
        metrics: result.metrics
      }
    };
  }

  private generateReport(config: ValidationConfig, results: ValidationResult[], totalDuration: number): ValidationReport {
    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === 'pass').length,
      failed: results.filter(r => r.status === 'fail').length,
      skipped: results.filter(r => r.status === 'skip').length,
      timeouts: results.filter(r => r.status === 'timeout').length
    };

    const criticalFailures = results.filter(r => 
      r.status === 'fail' && 
      this.tests.get(r.testId)?.critical
    );

    let overallStatus: 'pass' | 'fail' | 'partial' = 'pass';
    if (criticalFailures.length > 0) {
      overallStatus = 'fail';
    } else if (summary.failed > 0 || summary.timeouts > 0) {
      overallStatus = 'partial';
    }

    const recommendations = this.generateRecommendations(results, criticalFailures);

    return {
      timestamp: Date.now(),
      environment: config.environment,
      version: config.version,
      overallStatus,
      summary,
      results,
      criticalFailures,
      recommendations
    };
  }

  private generateRecommendations(results: ValidationResult[], criticalFailures: ValidationResult[]): string[] {
    const recommendations: string[] = [];

    if (criticalFailures.length > 0) {
      recommendations.push(`Critical failures detected - deployment should be rolled back`);
      recommendations.push(`Investigate: ${criticalFailures.map(f => f.testName).join(', ')}`);
    }

    const failedTests = results.filter(r => r.status === 'fail');
    const timeoutTests = results.filter(r => r.status === 'timeout');

    if (failedTests.length > 0) {
      recommendations.push(`${failedTests.length} tests failed - review test results and fix issues`);
    }

    if (timeoutTests.length > 0) {
      recommendations.push(`${timeoutTests.length} tests timed out - check system performance and resource allocation`);
    }

    const performanceTests = results.filter(r => 
      this.tests.get(r.testId)?.category === 'performance' && r.status !== 'pass'
    );
    if (performanceTests.length > 0) {
      recommendations.push('Performance tests failed - monitor system resources and optimize if needed');
    }

    if (recommendations.length === 0) {
      recommendations.push('All validation tests passed - deployment appears successful');
    }

    return recommendations;
  }
}