/**
 * Memory Pipeline Validation Script
 * Tests the stabilized deep lane and memory injection system
 */

require('dotenv').config({ path: '.env.local' });

const testQueries = [
  {
    query: "why did you leave america?",
    intent: "opinion",
    expectedFragments: ["trump", "political", "emigration", "left america"]
  },
  {
    query: "what languages do you speak?",
    intent: "languages", 
    expectedFragments: ["spanish", "english", "language", "speak"]
  },
  {
    query: "tell me about all the dogs you've had",
    intent: "pets",
    expectedFragments: ["romeo", "bucky", "george", "olive", "dog", "pet"]
  },
  {
    query: "where have you lived?",
    intent: "travel",
    expectedFragments: ["spain", "valencia", "maine", "austin", "lived", "moved"]
  },
  {
    query: "what do you think of trump?",
    intent: "opinion", 
    expectedFragments: ["trump", "political", "opinion", "think"]
  }
];

async function testMemoryPipeline() {
  console.log('🧪 Testing Memory Pipeline with Stabilized Deep Lane');
  console.log('=' .repeat(60));

  let passedTests = 0;
  let totalTests = testQueries.length;

  for (const test of testQueries) {
    console.log(`\n🔍 Testing: "${test.query}"`);
    console.log(`Expected intent: ${test.intent}`);
    
    try {
      const startTime = Date.now();
      
      // Test the chat API with debug mode
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          avatarSlug: 'jonathan-demo',
          message: test.query,
          debug: true // Enable debug mode to get metrics
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const totalTime = Date.now() - startTime;

      console.log(`⏱️  Total response time: ${totalTime}ms`);
      
      // Check if we got debug metrics
      if (result.debug) {
        const { deep, memory, inject } = result.debug;
        
        console.log(`📊 Metrics:`);
        console.log(`   - Deep contrib ms: ${deep?.contrib_ms || 0}`);
        console.log(`   - Memory retrieval ms: ${memory?.retrieval_ms || 0}`);
        console.log(`   - Injected memories: ${inject?.count || 0}`);
        console.log(`   - Detected intent: ${inject?.intent || 'none'}`);
        
        // Test assertions
        let testPassed = true;
        const failures = [];
        
        // Assert deep contributed for critical intents
        if (['opinion', 'bio', 'pets', 'languages', 'travel'].includes(test.intent)) {
          if (!deep?.contrib_ms || deep.contrib_ms === 0) {
            testPassed = false;
            failures.push(`Deep lane did not contribute for critical intent "${test.intent}"`);
          }
        }
        
        // Assert memory retrieval was fast enough
        if (memory?.retrieval_ms > 200) {
          testPassed = false;
          failures.push(`Memory retrieval too slow: ${memory.retrieval_ms}ms > 200ms`);
        }
        
        // Assert memories were injected
        if (!inject?.count || inject.count === 0) {
          testPassed = false;
          failures.push('No memories were injected');
        }
        
        // Assert response contains expected fragments
        const responseText = result.answer?.toLowerCase() || '';
        const foundFragments = test.expectedFragments.filter(fragment => 
          responseText.includes(fragment.toLowerCase())
        );
        
        if (foundFragments.length === 0) {
          testPassed = false;
          failures.push(`Response doesn't contain any expected fragments: ${test.expectedFragments.join(', ')}`);
        } else {
          console.log(`✅ Found fragments: ${foundFragments.join(', ')}`);
        }
        
        if (testPassed) {
          console.log('✅ Test PASSED');
          passedTests++;
        } else {
          console.log('❌ Test FAILED:');
          failures.forEach(failure => console.log(`   - ${failure}`));
        }
        
      } else {
        console.log('⚠️  No debug metrics available');
        
        // Basic test - check if response contains expected content
        const responseText = result.answer?.toLowerCase() || '';
        const foundFragments = test.expectedFragments.filter(fragment => 
          responseText.includes(fragment.toLowerCase())
        );
        
        if (foundFragments.length > 0) {
          console.log(`✅ Basic test PASSED - found: ${foundFragments.join(', ')}`);
          passedTests++;
        } else {
          console.log(`❌ Basic test FAILED - no expected fragments found`);
        }
      }
      
    } catch (error) {
      console.log(`❌ Test FAILED with error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📈 Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Memory pipeline is working correctly.');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Memory pipeline needs attention.');
    process.exit(1);
  }
}

// Run the tests
testMemoryPipeline().catch(error => {
  console.error('💥 Test suite failed:', error);
  process.exit(1);
});