// test-coordination-acceptance.js
// End-to-end acceptance tests for response coordination enhancement
const fetch = require('node-fetch');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const PERFORMANCE_THRESHOLDS = {
  FAST_LANE_MAX_MS: 200,
  TOTAL_RESPONSE_MAX_MS: 1200
};

// Test scenarios covering different intents and coordination patterns
const TEST_SCENARIOS = [
  {
    name: 'Opinion Query - Trump',
    query: 'What do you think about Trump?',
    intent: 'opinion',
    expectedFastPattern: /hate|terrible|bad|awful/i,
    expectedCoordination: {
      fastShouldContain: ['trump'],
      deepShouldExpand: true,
      toneShouldBe: 'critical'
    }
  },
  {
    name: 'Travel Query - Austin',
    query: 'Tell me about your time in Austin',
    intent: 'travel', 
    expectedFastPattern: /austin|incredible|amazing|love/i,
    expectedCoordination: {
      fastShouldContain: ['austin'],
      deepShouldExpand: true,
      toneShouldBe: 'enthusiastic'
    }
  },
  {
    name: 'People Query - Dog',
    query: 'Tell me about your dog',
    intent: 'people',
    expectedFastPattern: /dog|love|important|joy/i,
    expectedCoordination: {
      fastShouldContain: ['dog'],
      deepShouldExpand: true,
      toneShouldBe: 'warm'
    }
  },
  {
    name: 'Travel Query - Valencia',
    query: 'What was it like living in Valencia?',
    intent: 'travel',
    expectedFastPattern: /valencia|spain|culture|mediterranean/i,
    expectedCoordination: {
      fastShouldContain: ['valencia'],
      deepShouldExpand: true,
      toneShouldBe: 'enthusiastic'
    }
  }
];

class CoordinationTester {
  constructor() {
    this.results = [];
    this.totalTests = 0;
    this.passedTests = 0;
  }

  async runAllTests() {
    console.log('🚀 Starting Coordination Acceptance Tests');
    console.log('=' .repeat(60));
    
    for (const scenario of TEST_SCENARIOS) {
      await this.runScenarioTest(scenario);
    }
    
    this.printSummary();
  }

  async runScenarioTest(scenario) {
    console.log(`\n📋 Testing: ${scenario.name}`);
    console.log(`Query: "${scenario.query}"`);
    
    const testResult = {
      scenario: scenario.name,
      query: scenario.query,
      passed: false,
      timing: {},
      coordination: {},
      errors: []
    };

    try {
      const response = await this.makeRequest(scenario.query);
      const coordination = await this.analyzeResponse(response, scenario);
      
      testResult.timing = coordination.timing;
      testResult.coordination = coordination.analysis;
      testResult.passed = this.validateScenario(coordination, scenario, testResult);
      
    } catch (error) {
      testResult.errors.push(`Request failed: ${error.message}`);
      console.log(`❌ ${scenario.name}: ${error.message}`);
    }
    
    this.results.push(testResult);
    this.totalTests++;
    if (testResult.passed) this.passedTests++;
  }

  async makeRequest(query) {
    const startTime = Date.now();
    
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        avatarSlug: 'jonathan_braden',
        message: query,
        debug: false
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return { response, startTime };
  }

  async analyzeResponse({ response, startTime }, scenario) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let fastContent = '';
    let deepContent = '';
    let fastStartTime = null;
    let fastEndTime = null;
    let deepStartTime = null;
    let deepEndTime = null;
    let coordinationLogged = false;
    let coordinationData = {};

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.channel === 'fast' && data.delta) {
              if (!fastStartTime) fastStartTime = Date.now();
              fastContent += data.delta;
              fastEndTime = Date.now();
            }
            
            if (data.channel === 'deep' && data.delta) {
              if (!deepStartTime) deepStartTime = Date.now();
              deepContent += data.delta;
              deepEndTime = Date.now();
            }
          } catch (e) {
            // Check for coordination logging in non-JSON lines
            if (line.includes('fast_hook_selected')) {
              coordinationLogged = true;
              try {
                const logMatch = line.match(/fast_hook_selected.*?({.*})/);
                if (logMatch) {
                  coordinationData = JSON.parse(logMatch[1]);
                }
              } catch (e) {
                // Ignore parsing errors for logs
              }
            }
          }
        }
      }
    }

    const totalTime = Date.now() - startTime;
    const fastTime = fastEndTime ? (fastEndTime - startTime) : 0;

    return {
      timing: {
        total: totalTime,
        fastLane: fastTime,
        deepLane: deepEndTime ? (deepEndTime - (deepStartTime || fastEndTime || startTime)) : 0
      },
      analysis: {
        fastContent,
        deepContent,
        coordinationLogged,
        coordinationData,
        fastLength: fastContent.length,
        deepLength: deepContent.length,
        repetitionCheck: this.checkRepetition(fastContent, deepContent)
      }
    };
  }

  checkRepetition(fastContent, deepContent) {
    if (!fastContent || !deepContent) return { overlap: 0, repeated: [] };
    
    const fastWords = fastContent.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const deepWords = deepContent.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    const commonWords = fastWords.filter(word => deepWords.includes(word));
    const overlapPercentage = fastWords.length > 0 ? commonWords.length / fastWords.length : 0;
    
    return {
      overlap: overlapPercentage,
      repeated: commonWords,
      excessive: overlapPercentage > 0.3
    };
  }

  validateScenario(coordination, scenario, testResult) {
    let passed = true;
    const { timing, analysis } = coordination;
    
    // Performance validation
    if (timing.fastLane > PERFORMANCE_THRESHOLDS.FAST_LANE_MAX_MS) {
      testResult.errors.push(`Fast lane too slow: ${timing.fastLane}ms > ${PERFORMANCE_THRESHOLDS.FAST_LANE_MAX_MS}ms`);
      passed = false;
    } else {
      console.log(`✅ Fast lane performance: ${timing.fastLane}ms`);
    }
    
    if (timing.total > PERFORMANCE_THRESHOLDS.TOTAL_RESPONSE_MAX_MS) {
      testResult.errors.push(`Total response too slow: ${timing.total}ms > ${PERFORMANCE_THRESHOLDS.TOTAL_RESPONSE_MAX_MS}ms`);
      passed = false;
    } else {
      console.log(`✅ Total response performance: ${timing.total}ms`);
    }
    
    // Content validation
    if (!analysis.fastContent) {
      testResult.errors.push('No fast lane content received');
      passed = false;
    } else if (!scenario.expectedFastPattern.test(analysis.fastContent)) {
      testResult.errors.push(`Fast content doesn't match expected pattern: "${analysis.fastContent}"`);
      passed = false;
    } else {
      console.log(`✅ Fast content matches pattern: "${analysis.fastContent.substring(0, 100)}..."`);
    }
    
    if (!analysis.deepContent && scenario.expectedCoordination.deepShouldExpand) {
      testResult.errors.push('Expected deep lane expansion but got none');
      passed = false;
    } else if (analysis.deepContent) {
      console.log(`✅ Deep content provided: ${analysis.deepLength} characters`);
    }
    
    // Coordination validation
    if (!analysis.coordinationLogged) {
      testResult.errors.push('No coordination logging detected');
      passed = false;
    } else {
      console.log(`✅ Coordination logging detected`);
    }
    
    // Repetition validation
    if (analysis.repetitionCheck.excessive) {
      testResult.errors.push(`Excessive repetition detected: ${Math.round(analysis.repetitionCheck.overlap * 100)}% overlap`);
      passed = false;
    } else {
      console.log(`✅ Repetition within acceptable range: ${Math.round(analysis.repetitionCheck.overlap * 100)}%`);
    }
    
    // Content requirements validation
    for (const expectedWord of scenario.expectedCoordination.fastShouldContain) {
      if (!analysis.fastContent.toLowerCase().includes(expectedWord.toLowerCase())) {
        testResult.errors.push(`Fast content missing expected word: "${expectedWord}"`);
        passed = false;
      }
    }
    
    if (passed) {
      console.log(`✅ ${scenario.name}: All tests passed`);
    } else {
      console.log(`❌ ${scenario.name}: ${testResult.errors.length} errors`);
      testResult.errors.forEach(error => console.log(`   - ${error}`));
    }
    
    return passed;
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 COORDINATION ACCEPTANCE TEST SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\nOverall Results: ${this.passedTests}/${this.totalTests} tests passed`);
    
    if (this.passedTests === this.totalTests) {
      console.log('🎉 ALL TESTS PASSED! Coordination system is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Review the errors above.');
    }
    
    // Performance summary
    const avgFastTime = this.results.reduce((sum, r) => sum + r.timing.fastLane, 0) / this.results.length;
    const avgTotalTime = this.results.reduce((sum, r) => sum + r.timing.total, 0) / this.results.length;
    
    console.log(`\nPerformance Summary:`);
    console.log(`- Average fast lane time: ${Math.round(avgFastTime)}ms (target: <${PERFORMANCE_THRESHOLDS.FAST_LANE_MAX_MS}ms)`);
    console.log(`- Average total time: ${Math.round(avgTotalTime)}ms (target: <${PERFORMANCE_THRESHOLDS.TOTAL_RESPONSE_MAX_MS}ms)`);
    
    // Coordination summary
    const coordinationWorking = this.results.filter(r => r.coordination.coordinationLogged).length;
    console.log(`\nCoordination Summary:`);
    console.log(`- Coordination logging: ${coordinationWorking}/${this.totalTests} tests`);
    
    const lowRepetition = this.results.filter(r => !r.coordination.repetitionCheck?.excessive).length;
    console.log(`- Repetition control: ${lowRepetition}/${this.totalTests} tests`);
    
    // Detailed results
    console.log(`\nDetailed Results:`);
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.scenario}`);
      console.log(`   Fast: ${result.timing.fastLane}ms | Total: ${result.timing.total}ms`);
      console.log(`   Repetition: ${Math.round((result.coordination.repetitionCheck?.overlap || 0) * 100)}%`);
      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.length}`);
      }
    });
    
    console.log('\n' + '='.repeat(60));
  }
}

// Run the tests
async function main() {
  const tester = new CoordinationTester();
  
  try {
    await tester.runAllTests();
  } catch (error) {
    console.error('Test runner failed:', error);
    process.exit(1);
  }
  
  // Exit with error code if tests failed
  if (tester.passedTests < tester.totalTests) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { CoordinationTester, TEST_SCENARIOS };