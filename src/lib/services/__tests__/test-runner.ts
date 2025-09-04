/**
 * Comprehensive Test Runner for GPT-5 Avatar Memory Upgrade
 * 
 * Orchestrates all test suites and provides detailed reporting
 * on test coverage, performance, and accuracy metrics.
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

interface TestSuite {
  name: string;
  file: string;
  category: 'unit' | 'integration' | 'performance' | 'accuracy' | 'compatibility';
  timeout: number;
  critical: boolean;
}

interface TestResult {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: number;
  errors: string[];
}

interface TestReport {
  timestamp: string;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  totalDuration: number;
  overallCoverage: number;
  suiteResults: TestResult[];
  performanceMetrics: {
    averageResponseTime: number;
    accuracyRate: number;
    compatibilityScore: number;
  };
  recommendations: string[];
}

class ComprehensiveTestRunner {
  private testSuites: TestSuite[] = [
    {
      name: 'Unit Tests',
      file: 'comprehensive-unit-tests.test.ts',
      category: 'unit',
      timeout: 30000,
      critical: true
    },
    {
      name: 'End-to-End Integration',
      file: 'end-to-end-integration.test.ts',
      category: 'integration',
      timeout: 60000,
      critical: true
    },
    {
      name: 'Performance Benchmarks',
      file: 'performance-benchmarks.test.ts',
      category: 'performance',
      timeout: 120000,
      critical: true
    },
    {
      name: 'Accuracy and Continuity',
      file: 'accuracy-and-continuity.test.ts',
      category: 'accuracy',
      timeout: 90000,
      critical: true
    },
    {
      name: 'Database Compatibility',
      file: 'database-compatibility.test.ts',
      category: 'compatibility',
      timeout: 45000,
      critical: true
    }
  ];

  async runAllTests(): Promise<TestReport> {
    console.log('🚀 Starting Comprehensive Test Suite for GPT-5 Avatar Memory Upgrade');
    console.log('=' .repeat(80));

    const startTime = Date.now();
    const results: TestResult[] = [];
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    // Run each test suite
    for (const suite of this.testSuites) {
      console.log(`\n📋 Running ${suite.name} (${suite.category})...`);
      
      try {
        const result = await this.runTestSuite(suite);
        results.push(result);
        
        totalTests += result.passed + result.failed + result.skipped;
        totalPassed += result.passed;
        totalFailed += result.failed;
        totalSkipped += result.skipped;

        this.printSuiteResult(result);
      } catch (error) {
        console.error(`❌ Failed to run ${suite.name}:`, error);
        results.push({
          suite: suite.name,
          passed: 0,
          failed: 1,
          skipped: 0,
          duration: 0,
          errors: [(error as Error).message]
        });
        totalFailed += 1;
      }
    }

    const totalDuration = Date.now() - startTime;

    // Generate comprehensive report
    const report: TestReport = {
      timestamp: new Date().toISOString(),
      totalTests,
      totalPassed,
      totalFailed,
      totalSkipped,
      totalDuration,
      overallCoverage: this.calculateOverallCoverage(results),
      suiteResults: results,
      performanceMetrics: this.extractPerformanceMetrics(results),
      recommendations: this.generateRecommendations(results)
    };

    this.printFinalReport(report);
    this.saveReport(report);

    return report;
  }

  private async runTestSuite(suite: TestSuite): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      // Run vitest for the specific test file
      const command = `npx vitest run src/lib/services/__tests__/${suite.file} --reporter=json --timeout=${suite.timeout}`;
      const output = execSync(command, { 
        encoding: 'utf8',
        timeout: suite.timeout + 10000 // Add buffer to command timeout
      });

      const result = this.parseVitestOutput(output);
      
      return {
        suite: suite.name,
        passed: result.passed,
        failed: result.failed,
        skipped: result.skipped,
        duration: Date.now() - startTime,
        coverage: result.coverage,
        errors: result.errors
      };
    } catch (error) {
      return {
        suite: suite.name,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration: Date.now() - startTime,
        errors: [(error as Error).message]
      };
    }
  }

  private parseVitestOutput(output: string): {
    passed: number;
    failed: number;
    skipped: number;
    coverage?: number;
    errors: string[];
  } {
    try {
      // Parse JSON output from vitest
      const lines = output.split('\n').filter(line => line.trim());
      const jsonLine = lines.find(line => line.startsWith('{'));
      
      if (jsonLine) {
        const result = JSON.parse(jsonLine);
        return {
          passed: result.numPassedTests || 0,
          failed: result.numFailedTests || 0,
          skipped: result.numPendingTests || 0,
          coverage: result.coverageMap ? this.calculateCoverage(result.coverageMap) : undefined,
          errors: result.testResults?.map((t: any) => t.message).filter(Boolean) || []
        };
      }
    } catch (parseError) {
      console.warn('Failed to parse vitest output, using fallback parsing');
    }

    // Fallback parsing for non-JSON output
    const passed = (output.match(/✓/g) || []).length;
    const failed = (output.match(/✗|❌/g) || []).length;
    const skipped = (output.match(/⏭|skipped/gi) || []).length;

    return {
      passed,
      failed,
      skipped,
      errors: output.includes('Error') ? [output] : []
    };
  }

  private calculateCoverage(coverageMap: any): number {
    // Calculate coverage percentage from coverage map
    if (!coverageMap) return 0;
    
    let totalLines = 0;
    let coveredLines = 0;
    
    Object.values(coverageMap).forEach((file: any) => {
      if (file.s) { // Statement coverage
        Object.values(file.s).forEach((count: any) => {
          totalLines++;
          if (count > 0) coveredLines++;
        });
      }
    });
    
    return totalLines > 0 ? (coveredLines / totalLines) * 100 : 0;
  }

  private calculateOverallCoverage(results: TestResult[]): number {
    const coverageResults = results.filter(r => r.coverage !== undefined);
    if (coverageResults.length === 0) return 0;
    
    const totalCoverage = coverageResults.reduce((sum, r) => sum + (r.coverage || 0), 0);
    return totalCoverage / coverageResults.length;
  }

  private extractPerformanceMetrics(results: TestResult[]): {
    averageResponseTime: number;
    accuracyRate: number;
    compatibilityScore: number;
  } {
    // Extract performance metrics from test results
    const performanceResult = results.find(r => r.suite.includes('Performance'));
    const accuracyResult = results.find(r => r.suite.includes('Accuracy'));
    const compatibilityResult = results.find(r => r.suite.includes('Compatibility'));

    return {
      averageResponseTime: performanceResult ? this.estimateResponseTime(performanceResult) : 0,
      accuracyRate: accuracyResult ? this.estimateAccuracyRate(accuracyResult) : 0,
      compatibilityScore: compatibilityResult ? this.estimateCompatibilityScore(compatibilityResult) : 0
    };
  }

  private estimateResponseTime(result: TestResult): number {
    // Estimate average response time based on test duration and number of tests
    const totalTests = result.passed + result.failed;
    return totalTests > 0 ? result.duration / totalTests : 0;
  }

  private estimateAccuracyRate(result: TestResult): number {
    // Calculate accuracy rate as percentage of passed tests
    const totalTests = result.passed + result.failed;
    return totalTests > 0 ? (result.passed / totalTests) * 100 : 0;
  }

  private estimateCompatibilityScore(result: TestResult): number {
    // Calculate compatibility score based on test results
    const totalTests = result.passed + result.failed;
    return totalTests > 0 ? (result.passed / totalTests) * 100 : 0;
  }

  private generateRecommendations(results: TestResult[]): string[] {
    const recommendations: string[] = [];

    // Analyze results and generate recommendations
    const failedSuites = results.filter(r => r.failed > 0);
    const slowSuites = results.filter(r => r.duration > 60000); // > 1 minute
    const lowCoverageSuites = results.filter(r => r.coverage && r.coverage < 80);

    if (failedSuites.length > 0) {
      recommendations.push(`🔧 Fix failing tests in: ${failedSuites.map(s => s.suite).join(', ')}`);
    }

    if (slowSuites.length > 0) {
      recommendations.push(`⚡ Optimize performance for: ${slowSuites.map(s => s.suite).join(', ')}`);
    }

    if (lowCoverageSuites.length > 0) {
      recommendations.push(`📊 Improve test coverage for: ${lowCoverageSuites.map(s => s.suite).join(', ')}`);
    }

    const overallPassRate = results.reduce((sum, r) => sum + r.passed, 0) / 
                           results.reduce((sum, r) => sum + r.passed + r.failed, 0);

    if (overallPassRate < 0.95) {
      recommendations.push('🎯 Overall pass rate is below 95%. Focus on critical test failures.');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ All tests are performing well! Consider adding more edge case tests.');
    }

    return recommendations;
  }

  private printSuiteResult(result: TestResult): void {
    const passRate = result.passed / (result.passed + result.failed) * 100;
    const status = result.failed === 0 ? '✅' : '❌';
    
    console.log(`${status} ${result.suite}:`);
    console.log(`   Passed: ${result.passed}, Failed: ${result.failed}, Skipped: ${result.skipped}`);
    console.log(`   Duration: ${(result.duration / 1000).toFixed(2)}s`);
    console.log(`   Pass Rate: ${passRate.toFixed(1)}%`);
    
    if (result.coverage) {
      console.log(`   Coverage: ${result.coverage.toFixed(1)}%`);
    }
    
    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.length}`);
    }
  }

  private printFinalReport(report: TestReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE TEST REPORT');
    console.log('='.repeat(80));
    
    console.log(`\n📈 Overall Results:`);
    console.log(`   Total Tests: ${report.totalTests}`);
    console.log(`   Passed: ${report.totalPassed} (${(report.totalPassed/report.totalTests*100).toFixed(1)}%)`);
    console.log(`   Failed: ${report.totalFailed} (${(report.totalFailed/report.totalTests*100).toFixed(1)}%)`);
    console.log(`   Skipped: ${report.totalSkipped} (${(report.totalSkipped/report.totalTests*100).toFixed(1)}%)`);
    console.log(`   Total Duration: ${(report.totalDuration / 1000).toFixed(2)}s`);
    console.log(`   Overall Coverage: ${report.overallCoverage.toFixed(1)}%`);

    console.log(`\n🎯 Performance Metrics:`);
    console.log(`   Average Response Time: ${report.performanceMetrics.averageResponseTime.toFixed(0)}ms`);
    console.log(`   Accuracy Rate: ${report.performanceMetrics.accuracyRate.toFixed(1)}%`);
    console.log(`   Compatibility Score: ${report.performanceMetrics.compatibilityScore.toFixed(1)}%`);

    console.log(`\n💡 Recommendations:`);
    report.recommendations.forEach(rec => console.log(`   ${rec}`));

    const overallStatus = report.totalFailed === 0 ? '🎉 ALL TESTS PASSED!' : '⚠️  SOME TESTS FAILED';
    console.log(`\n${overallStatus}`);
    console.log('='.repeat(80));
  }

  private saveReport(report: TestReport): void {
    const reportPath = join(process.cwd(), 'test-reports', `gpt5-upgrade-${Date.now()}.json`);
    
    try {
      // Ensure directory exists
      execSync('mkdir -p test-reports', { stdio: 'ignore' });
      
      writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    } catch (error) {
      console.warn('Failed to save report:', error);
    }
  }

  async runSpecificCategory(category: TestSuite['category']): Promise<TestResult[]> {
    const suitesToRun = this.testSuites.filter(suite => suite.category === category);
    const results: TestResult[] = [];

    console.log(`🎯 Running ${category} tests only...`);

    for (const suite of suitesToRun) {
      console.log(`\n📋 Running ${suite.name}...`);
      
      try {
        const result = await this.runTestSuite(suite);
        results.push(result);
        this.printSuiteResult(result);
      } catch (error) {
        console.error(`❌ Failed to run ${suite.name}:`, error);
      }
    }

    return results;
  }

  async runCriticalTestsOnly(): Promise<TestResult[]> {
    const criticalSuites = this.testSuites.filter(suite => suite.critical);
    const results: TestResult[] = [];

    console.log('🚨 Running critical tests only...');

    for (const suite of criticalSuites) {
      console.log(`\n📋 Running ${suite.name} (CRITICAL)...`);
      
      try {
        const result = await this.runTestSuite(suite);
        results.push(result);
        this.printSuiteResult(result);
      } catch (error) {
        console.error(`❌ CRITICAL TEST FAILED - ${suite.name}:`, error);
      }
    }

    return results;
  }
}

// CLI interface
if (require.main === module) {
  const runner = new ComprehensiveTestRunner();
  const args = process.argv.slice(2);

  if (args.includes('--category')) {
    const categoryIndex = args.indexOf('--category');
    const category = args[categoryIndex + 1] as TestSuite['category'];
    runner.runSpecificCategory(category);
  } else if (args.includes('--critical')) {
    runner.runCriticalTestsOnly();
  } else {
    runner.runAllTests();
  }
}

export { ComprehensiveTestRunner, TestSuite, TestResult, TestReport };