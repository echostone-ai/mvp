// src/lib/services/__tests__/hybridRetrieval.golden.runner.ts
// Test runner for golden query test suite with comprehensive reporting

import { describe, it, expect } from 'vitest';
import { HybridRetriever, parseHybridRetrievalConfig } from '../hybridRetrieval';
import { FactbookService } from '../factbookService';

interface TestResult {
  testId: string;
  query: string;
  passed: boolean;
  resultCount: number;
  confidenceScore: number;
  totalTimeMs: number;
  methodsUsed: string[];
  foundExpectedSnippets: string[];
  error?: string;
}

interface TestSuiteReport {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  averageLatency: number;
  p95Latency: number;
  averageConfidence: number;
  methodUsageStats: Record<string, number>;
  results: TestResult[];
}

// Golden Query Test Suite
const GOLDEN_TEST_SUITE = [
  {
    id: 'childhood_location',
    query: 'Where did you grow up?',
    expectedSnippets: ['timeline.childhood', 'places.vancouver_island', 'timeline.coombs_years'],
    minConfidence: 0.6,
    description: 'Should find childhood location information'
  },
  {
    id: 'snake_story_semantic',
    query: 'snake story',
    expectedSnippets: ['places.morocco'],
    minConfidence: 0.5,
    description: 'Should connect snake → cobra semantically'
  },
  {
    id: 'current_pet',
    query: 'Tell me about Romeo',
    expectedSnippets: ['pets.romeo', 'identity.romeo'],
    minConfidence: 0.7,
    description: 'Should find current pet Romeo information'
  },
  {
    id: 'brother_info',
    query: 'Tell me about your brother',
    expectedSnippets: ['family.brother'],
    minConfidence: 0.7,
    description: 'Should find brother information'
  },
  {
    id: 'sxsw_meetings',
    query: 'meetings at SXSW',
    expectedSnippets: ['memories.bill_murray'],
    minConfidence: 0.5,
    description: 'Should find SXSW-related memories'
  },
  {
    id: 'tyler_identity',
    query: 'Who is Tyler?',
    expectedSnippets: ['relationships.tyler'],
    minConfidence: 0.7,
    description: 'Should retrieve Tyler facts'
  },
  {
    id: 'tyler_partner',
    query: 'Tyler partner',
    expectedSnippets: ['relationships.tyler_partner'],
    minConfidence: 0.6,
    description: 'Should connect Tyler → Cansu relationship'
  },
  {
    id: 'current_location',
    query: 'Where do you live now?',
    expectedSnippets: ['identity.current_location', 'places.sofia_current'],
    minConfidence: 0.7,
    description: 'Should find current location in Sofia'
  },
  {
    id: 'partner_info',
    query: 'Tell me about Krissy',
    expectedSnippets: ['relationships.krissy'],
    minConfidence: 0.7,
    description: 'Should find partner information'
  },
  {
    id: 'project_echostone',
    query: 'What is Echostone?',
    expectedSnippets: ['projects.echostone'],
    minConfidence: 0.7,
    description: 'Should find Echostone project information'
  },
  {
    id: 'music_interests',
    query: 'What music do you like?',
    expectedSnippets: ['interests.music'],
    minConfidence: 0.6,
    description: 'Should find music interests'
  },
  {
    id: 'past_pets',
    query: 'Who were George and Olive?',
    expectedSnippets: ['pets.george', 'pets.olive'],
    minConfidence: 0.6,
    description: 'Should find past pet information'
  }
];

export class GoldenQueryTestRunner {
  private hybridRetriever: HybridRetriever;
  private factbookService: FactbookService;

  constructor(hybridRetriever: HybridRetriever, factbookService: FactbookService) {
    this.hybridRetriever = hybridRetriever;
    this.factbookService = factbookService;
  }

  async runGoldenQueryTests(): Promise<TestSuiteReport> {
    const results: TestResult[] = [];
    const latencies: number[] = [];
    const confidenceScores: number[] = [];
    const methodUsageStats: Record<string, number> = {};

    console.log('🚀 Starting Golden Query Test Suite...\n');

    for (const test of GOLDEN_TEST_SUITE) {
      try {
        console.log(`Testing: ${test.id} - "${test.query}"`);
        
        const startTime = Date.now();
        const result = await this.hybridRetriever.retrieve(test.query);
        const totalTime = Date.now() - startTime;

        // Check for expected snippets
        const foundSnippetIds = result.results.map(r => r.snippet.id);
        const foundExpectedSnippets = test.expectedSnippets.filter(expectedId => 
          foundSnippetIds.some(foundId => foundId.includes(expectedId))
        );

        // Determine if test passed
        const hasExpectedSnippet = foundExpectedSnippets.length > 0;
        const meetsConfidenceThreshold = result.metrics.confidenceScore >= test.minConfidence;
        const hasResults = result.results.length > 0;
        const passed = hasExpectedSnippet && meetsConfidenceThreshold && hasResults;

        // Track method usage
        result.metrics.methodsUsed.forEach(method => {
          methodUsageStats[method] = (methodUsageStats[method] || 0) + 1;
        });

        const testResult: TestResult = {
          testId: test.id,
          query: test.query,
          passed,
          resultCount: result.results.length,
          confidenceScore: result.metrics.confidenceScore,
          totalTimeMs: totalTime,
          methodsUsed: result.metrics.methodsUsed,
          foundExpectedSnippets
        };

        if (!passed) {
          testResult.error = `Expected snippets: ${test.expectedSnippets.join(', ')}, Found: ${foundExpectedSnippets.join(', ')}, Confidence: ${result.metrics.confidenceScore.toFixed(2)} (min: ${test.minConfidence})`;
        }

        results.push(testResult);
        latencies.push(totalTime);
        confidenceScores.push(result.metrics.confidenceScore);

        // Log result
        const status = passed ? '✅ PASS' : '❌ FAIL';
        console.log(`  ${status} - ${result.results.length} results, confidence: ${result.metrics.confidenceScore.toFixed(2)}, time: ${totalTime}ms`);
        if (!passed && testResult.error) {
          console.log(`    Error: ${testResult.error}`);
        }
        console.log(`    Methods: ${result.metrics.methodsUsed.join(', ')}`);
        console.log(`    Found snippets: ${foundSnippetIds.slice(0, 3).join(', ')}${foundSnippetIds.length > 3 ? '...' : ''}\n`);

      } catch (error) {
        const testResult: TestResult = {
          testId: test.id,
          query: test.query,
          passed: false,
          resultCount: 0,
          confidenceScore: 0,
          totalTimeMs: 0,
          methodsUsed: [],
          foundExpectedSnippets: [],
          error: error instanceof Error ? error.message : String(error)
        };

        results.push(testResult);
        console.log(`  ❌ FAIL - Error: ${testResult.error}\n`);
      }
    }

    // Calculate statistics
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = results.length - passedTests;
    const averageLatency = latencies.length > 0 ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length : 0;
    const sortedLatencies = latencies.sort((a, b) => a - b);
    const p95Latency = sortedLatencies.length > 0 ? sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] : 0;
    const averageConfidence = confidenceScores.length > 0 ? confidenceScores.reduce((sum, conf) => sum + conf, 0) / confidenceScores.length : 0;

    const report: TestSuiteReport = {
      totalTests: results.length,
      passedTests,
      failedTests,
      averageLatency,
      p95Latency,
      averageConfidence,
      methodUsageStats,
      results
    };

    this.printReport(report);
    return report;
  }

  private printReport(report: TestSuiteReport): void {
    console.log('📊 Golden Query Test Suite Report');
    console.log('================================\n');

    // Overall Results
    console.log('📈 Overall Results:');
    console.log(`  Total Tests: ${report.totalTests}`);
    console.log(`  Passed: ${report.passedTests} (${(report.passedTests / report.totalTests * 100).toFixed(1)}%)`);
    console.log(`  Failed: ${report.failedTests} (${(report.failedTests / report.totalTests * 100).toFixed(1)}%)`);
    console.log('');

    // Performance Metrics
    console.log('⚡ Performance Metrics:');
    console.log(`  Average Latency: ${report.averageLatency.toFixed(1)}ms`);
    console.log(`  P95 Latency: ${report.p95Latency}ms`);
    console.log(`  Average Confidence: ${report.averageConfidence.toFixed(2)}`);
    console.log('');

    // Method Usage Statistics
    console.log('🔧 Method Usage Statistics:');
    Object.entries(report.methodUsageStats).forEach(([method, count]) => {
      const percentage = (count / report.totalTests * 100).toFixed(1);
      console.log(`  ${method}: ${count}/${report.totalTests} (${percentage}%)`);
    });
    console.log('');

    // Failed Tests Details
    if (report.failedTests > 0) {
      console.log('❌ Failed Tests:');
      report.results.filter(r => !r.passed).forEach(result => {
        console.log(`  ${result.testId}: "${result.query}"`);
        if (result.error) {
          console.log(`    Error: ${result.error}`);
        }
      });
      console.log('');
    }

    // Top Performing Tests
    console.log('🏆 Top Performing Tests (by confidence):');
    const topTests = report.results
      .filter(r => r.passed)
      .sort((a, b) => b.confidenceScore - a.confidenceScore)
      .slice(0, 5);

    topTests.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.testId}: ${result.confidenceScore.toFixed(2)} confidence, ${result.totalTimeMs}ms`);
    });
    console.log('');

    // Performance Analysis
    const slowTests = report.results.sort((a, b) => b.totalTimeMs - a.totalTimeMs).slice(0, 3);
    console.log('🐌 Slowest Tests:');
    slowTests.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.testId}: ${result.totalTimeMs}ms`);
    });
    console.log('');

    // Recommendations
    console.log('💡 Recommendations:');
    if (report.failedTests > 0) {
      console.log('  - Review failed tests and improve semantic matching');
    }
    if (report.p95Latency > 600) {
      console.log('  - P95 latency exceeds 600ms target, consider optimization');
    }
    if (report.averageConfidence < 0.6) {
      console.log('  - Average confidence is low, consider improving retrieval accuracy');
    }
    if (report.methodUsageStats['vector'] && report.methodUsageStats['vector'] < report.totalTests * 0.5) {
      console.log('  - Vector search usage is low, check embedding system health');
    }
    console.log('');
  }

  async runPerformanceComparison(): Promise<void> {
    console.log('🏁 Running Performance Comparison...\n');

    // Test minimal config (BM25 only)
    const minimalConfig = {
      ...parseHybridRetrievalConfig(),
      enableEmbeddings: false,
      enableExpansion: 'off' as const,
      enableReranking: false
    };

    const minimalRetriever = new HybridRetriever(minimalConfig, this.factbookService);
    await minimalRetriever.warmup();

    // Test full config
    const fullConfig = {
      ...parseHybridRetrievalConfig(),
      enableEmbeddings: true,
      enableExpansion: 'auto' as const,
      enableReranking: true
    };

    const fullRetriever = new HybridRetriever(fullConfig, this.factbookService);
    await fullRetriever.warmup();

    const testQueries = GOLDEN_TEST_SUITE.slice(0, 5).map(t => t.query);

    // Test minimal config
    console.log('Testing Minimal Config (BM25 only)...');
    const minimalTimes: number[] = [];
    for (const query of testQueries) {
      const startTime = Date.now();
      await minimalRetriever.retrieve(query);
      minimalTimes.push(Date.now() - startTime);
    }

    // Test full config
    console.log('Testing Full Config (All features)...');
    const fullTimes: number[] = [];
    for (const query of testQueries) {
      const startTime = Date.now();
      await fullRetriever.retrieve(query);
      fullTimes.push(Date.now() - startTime);
    }

    // Calculate statistics
    const minimalAvg = minimalTimes.reduce((sum, time) => sum + time, 0) / minimalTimes.length;
    const fullAvg = fullTimes.reduce((sum, time) => sum + time, 0) / fullTimes.length;
    const overhead = fullAvg - minimalAvg;
    const overheadPercentage = (overhead / minimalAvg * 100);

    console.log('\n📊 Performance Comparison Results:');
    console.log(`  Minimal Config (BM25 only): ${minimalAvg.toFixed(1)}ms average`);
    console.log(`  Full Config (All features): ${fullAvg.toFixed(1)}ms average`);
    console.log(`  Overhead: ${overhead.toFixed(1)}ms (${overheadPercentage.toFixed(1)}%)`);
    console.log(`  Target: ≤600ms P95 for full config`);
    
    const fullP95 = fullTimes.sort((a, b) => a - b)[Math.floor(fullTimes.length * 0.95)];
    console.log(`  Full Config P95: ${fullP95}ms`);
    
    if (fullP95 <= 600) {
      console.log('  ✅ Performance target met!');
    } else {
      console.log('  ❌ Performance target exceeded!');
    }
    console.log('');
  }

  async runSemanticAccuracyTest(): Promise<void> {
    console.log('🎯 Running Semantic Accuracy Test...\n');

    const semanticTests = [
      { query: 'serpent encounter', expectedTopic: 'morocco', description: 'Snake → Cobra semantic connection' },
      { query: 'music festival meetings', expectedTopic: 'sxsw', description: 'Festival → SXSW semantic connection' },
      { query: 'canine companions', expectedTopic: 'pets', description: 'Canine → Pets semantic connection' },
      { query: 'romantic partner', expectedTopic: 'krissy', description: 'Partner → Krissy semantic connection' },
      { query: 'childhood home', expectedTopic: 'vancouver', description: 'Home → Vancouver semantic connection' }
    ];

    let passedTests = 0;
    const totalTests = semanticTests.length;

    for (const test of semanticTests) {
      console.log(`Testing: "${test.query}" → ${test.expectedTopic}`);
      
      const result = await this.hybridRetriever.retrieve(test.query);
      
      // Check if semantic connection was found
      const hasSemanticMatch = result.results.some(r => 
        r.snippet.text.toLowerCase().includes(test.expectedTopic) ||
        r.snippet.topics.some(topic => topic.includes(test.expectedTopic)) ||
        r.snippet.keywords.some(keyword => keyword.includes(test.expectedTopic))
      );

      if (hasSemanticMatch) {
        console.log(`  ✅ PASS - Found semantic connection (${result.results.length} results, confidence: ${result.metrics.confidenceScore.toFixed(2)})`);
        passedTests++;
      } else {
        console.log(`  ❌ FAIL - No semantic connection found (${result.results.length} results, confidence: ${result.metrics.confidenceScore.toFixed(2)})`);
      }
      
      console.log(`    Methods used: ${result.metrics.methodsUsed.join(', ')}`);
      console.log('');
    }

    console.log(`📊 Semantic Accuracy Results: ${passedTests}/${totalTests} (${(passedTests / totalTests * 100).toFixed(1)}%) passed\n`);
  }
}

// Export test runner for use in other test files
export async function runGoldenQueryTestSuite(): Promise<TestSuiteReport> {
  // Load factbook service
  const factbookService = FactbookService.getInstance();
  
  // Load actual factbook data
  try {
    const factbookData = await import('@/data/jonathan_profile_factbook.json');
    await factbookService.loadFactbook(factbookData.default);
  } catch (error) {
    console.error('Failed to load factbook data:', error);
    throw error;
  }

  // Create hybrid retriever
  const config = parseHybridRetrievalConfig();
  const hybridRetriever = new HybridRetriever(config, factbookService);
  await hybridRetriever.warmup();

  // Run tests
  const runner = new GoldenQueryTestRunner(hybridRetriever, factbookService);
  const report = await runner.runGoldenQueryTests();
  
  // Run additional tests
  await runner.runPerformanceComparison();
  await runner.runSemanticAccuracyTest();

  return report;
}

// Vitest integration
describe('Golden Query Test Suite Runner', () => {
  it('should run the complete golden query test suite', async () => {
    const report = await runGoldenQueryTestSuite();
    
    // Assert overall test suite success
    expect(report.passedTests).toBeGreaterThan(report.totalTests * 0.8); // At least 80% pass rate
    expect(report.p95Latency).toBeLessThanOrEqual(600); // Performance requirement
    expect(report.averageConfidence).toBeGreaterThan(0.5); // Reasonable confidence
    
    console.log(`Golden Query Test Suite completed: ${report.passedTests}/${report.totalTests} tests passed`);
  }, 60000); // 60 second timeout for comprehensive testing
});