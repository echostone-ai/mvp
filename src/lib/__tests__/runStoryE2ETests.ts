/**
 * Comprehensive Test Runner for Story E2E Test Suite
 * Orchestrates all end-to-end tests for task 11 implementation
 * Requirements: 8.1, 8.2, 8.4
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

class StoryE2ETestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Story E2E Test Suite...\n');
    this.startTime = Date.now();

    // Test files to run in order
    const testFiles = [
      {
        name: 'Trigger Matching Unit Tests',
        file: 'src/lib/services/__tests__/storyTriggerMatcher.e2e.test.ts',
        timeout: 30000
      },
      {
        name: 'Story Playback Flow Integration',
        file: 'src/lib/__tests__/storyPlaybackFlow.integration.test.ts',
        timeout: 45000
      },
      {
        name: 'TTS Fallback No-Gap E2E',
        file: 'src/lib/__tests__/storyTTSFallback.e2e.test.ts',
        timeout: 60000
      },
      {
        name: 'Performance Harness (20 attempts)',
        file: 'src/lib/__tests__/storyPerformanceHarness.test.ts',
        timeout: 120000
      }
    ];

    for (const test of testFiles) {
      await this.runSingleTest(test.name, test.file, test.timeout);
    }

    this.printFinalReport();
  }

  private async runSingleTest(name: string, filePath: string, timeout: number): Promise<void> {
    console.log(`📋 Running: ${name}`);
    console.log(`   File: ${filePath}`);
    
    if (!existsSync(filePath)) {
      this.results.push({
        name,
        passed: false,
        duration: 0,
        error: 'Test file not found'
      });
      console.log(`   ❌ FAILED: Test file not found\n`);
      return;
    }

    const testStartTime = Date.now();
    
    try {
      // Run the test using vitest
      const command = `npx vitest run "${filePath}" --reporter=verbose --timeout=${timeout}`;
      
      execSync(command, {
        stdio: 'pipe',
        timeout: timeout + 10000, // Add buffer to vitest timeout
        cwd: process.cwd()
      });

      const duration = Date.now() - testStartTime;
      this.results.push({
        name,
        passed: true,
        duration
      });
      
      console.log(`   ✅ PASSED (${duration}ms)\n`);
      
    } catch (error: any) {
      const duration = Date.now() - testStartTime;
      this.results.push({
        name,
        passed: false,
        duration,
        error: error.message
      });
      
      console.log(`   ❌ FAILED (${duration}ms)`);
      console.log(`   Error: ${error.message}\n`);
    }
  }

  private printFinalReport(): void {
    const totalDuration = Date.now() - this.startTime;
    const passedTests = this.results.filter(r => r.passed).length;
    const totalTests = this.results.length;
    
    console.log('='.repeat(60));
    console.log('📊 STORY E2E TEST SUITE FINAL REPORT');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log('');

    // Detailed results
    console.log('📋 DETAILED RESULTS:');
    this.results.forEach((result, index) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const duration = `${result.duration}ms`;
      console.log(`${index + 1}. ${result.name}: ${status} (${duration})`);
      
      if (!result.passed && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    console.log('');

    // Requirements compliance check
    console.log('🎯 REQUIREMENTS COMPLIANCE:');
    console.log(`Requirement 8.1 (TTS Performance): ${this.checkRequirement('Performance Harness') ? '✅' : '❌'}`);
    console.log(`Requirement 8.2 (Trigger Matching): ${this.checkRequirement('Trigger Matching') ? '✅' : '❌'}`);
    console.log(`Requirement 8.4 (Story Loading): ${this.checkRequirement('Performance Harness') ? '✅' : '❌'}`);
    console.log(`Requirement 8.6 (No Audio Gap): ${this.checkRequirement('TTS Fallback') ? '✅' : '❌'}`);
    console.log('');

    // Manual testing reminder
    console.log('📱 MANUAL TESTING REQUIRED:');
    console.log('Please complete the iOS Safari manual checklist:');
    console.log('📄 File: src/lib/__tests__/iOSSafariManualChecklist.md');
    console.log('');

    // Overall status
    const allPassed = passedTests === totalTests;
    console.log(`🏁 OVERALL STATUS: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    if (!allPassed) {
      console.log('');
      console.log('⚠️  Please fix failing tests before proceeding to production deployment.');
    }
    
    console.log('='.repeat(60));
  }

  private checkRequirement(testNamePattern: string): boolean {
    return this.results.some(r => 
      r.name.toLowerCase().includes(testNamePattern.toLowerCase()) && r.passed
    );
  }
}

// Export for programmatic use
export { StoryE2ETestRunner };

// CLI execution
if (require.main === module) {
  const runner = new StoryE2ETestRunner();
  runner.runAllTests().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}