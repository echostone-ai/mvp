/**
 * Test Stabilized Deep Lane Implementation
 * Validates the fixes for deep lane scheduling and memory injection
 */

require('dotenv').config({ path: '.env.local' });

const testCases = [
  {
    name: "Political Opinion Query",
    query: "what do you think of trump?",
    expectedIntent: "opinion",
    expectDeepContribution: true,
    expectPinnedMemories: true,
    expectedFragments: ["trump", "political", "opinion"]
  },
  {
    name: "Pet Query", 
    query: "tell me about your dogs",
    expectedIntent: "pets",
    expectDeepContribution: true,
    expectPinnedMemories: true,
    expectedFragments: ["romeo", "dog", "pet"]
  },
  {
    name: "Language Query",
    query: "what languages do you speak?",
    expectedIntent: "languages",
    expectDeepContribution: true,
    expectPinnedMemories: true,
    expectedFragments: ["spanish", "english", "language"]
  },
  {
    name: "Simple Greeting",
    query: "hello",
    expectedIntent: null,
    expectDeepContribution: false,
    expectPinnedMemories: false,
    expectedFragments: ["hello", "hey", "hi"]
  },
  {
    name: "Bio Query",
    query: "tell me about yourself",
    expectedIntent: "bio", 
    expectDeepContribution: true,
    expectPinnedMemories: true,
    expectedFragments: ["jonathan", "writer", "bulgaria"]
  }
];

async function testStabilizedDeepLane() {
  console.log('🧪 Testing Stabilized Deep Lane Implementation');
  console.log('=' .repeat(70));

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    console.log(`\n🔍 Test: ${testCase.name}`);
    console.log(`Query: "${testCase.query}"`);
    console.log(`Expected intent: ${testCase.expectedIntent || 'none'}`);
    
    try {
      const startTime = Date.now();
      
      // Test with debug mode to get metrics
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          avatarSlug: 'jonathan-demo',
          message: testCase.query,
          debug: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const totalTime = Date.now() - startTime;

      console.log(`⏱️  Response time: ${totalTime}ms`);
      
      let testPassed = true;
      const failures = [];
      
      // Check debug metrics if available
      if (result.debug) {
        const debug = result.debug;
        
        console.log(`📊 Debug Metrics:`);
        console.log(`   - Intent: ${debug.intent || 'none'}`);
        console.log(`   - Memory injection queued: ${debug.memory_injection_queued || false}`);
        console.log(`   - Pinned count: ${debug.pinned_count || 0}`);
        console.log(`   - Fast pinned injected: ${debug.fast_pinned_injected || false}`);
        console.log(`   - Deep spawned: ${debug.deep_spawned || false}`);
        console.log(`   - Micro budget ms: ${debug.micro_budget_ms || 0}`);
        
        // Validate intent detection
        if (testCase.expectedIntent !== debug.intent) {
          testPassed = false;
          failures.push(`Intent mismatch: expected "${testCase.expectedIntent}", got "${debug.intent}"`);
        }
        
        // Validate deep contribution for critical intents
        if (testCase.expectDeepContribution && !debug.deep_spawned) {
          testPassed = false;
          failures.push('Deep lane should have been spawned for this intent');
        }
        
        // Validate pinned memory injection
        if (testCase.expectPinnedMemories) {
          if (!debug.memory_injection_queued) {
            testPassed = false;
            failures.push('Memory injection should have been queued');
          }
          if (debug.pinned_count === 0) {
            testPassed = false;
            failures.push('Should have pinned memories for this intent');
          }
          if (!debug.fast_pinned_injected) {
            testPassed = false;
            failures.push('Fast path should have pinned memories injected');
          }
        }
        
        // Validate micro budget is reasonable
        if (debug.micro_budget_ms < 500 && testCase.expectDeepContribution) {
          testPassed = false;
          failures.push(`Micro budget too low: ${debug.micro_budget_ms}ms`);
        }
        
      } else {
        console.log('⚠️  No debug metrics available');
      }
      
      // Check response content
      const responseText = result.answer?.toLowerCase() || '';
      const foundFragments = testCase.expectedFragments.filter(fragment => 
        responseText.includes(fragment.toLowerCase())
      );
      
      if (foundFragments.length > 0) {
        console.log(`✅ Found expected content: ${foundFragments.join(', ')}`);
      } else {
        testPassed = false;
        failures.push(`No expected fragments found: ${testCase.expectedFragments.join(', ')}`);
      }
      
      // Overall test result
      if (testPassed) {
        console.log('✅ Test PASSED');
        passedTests++;
      } else {
        console.log('❌ Test FAILED:');
        failures.forEach(failure => console.log(`   - ${failure}`));
      }
      
    } catch (error) {
      console.log(`❌ Test FAILED with error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`📈 Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Stabilized deep lane is working correctly.');
    
    // Additional performance summary
    console.log('\n📊 Performance Summary:');
    console.log('✅ Deep lane scheduling stabilized');
    console.log('✅ Memory injection working on fast path');
    console.log('✅ Intent detection functioning');
    console.log('✅ Micro budget calculations correct');
    
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Deep lane needs attention.');
    process.exit(1);
  }
}

// Run the tests
if (require.main === module) {
  testStabilizedDeepLane().catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = { testStabilizedDeepLane };