/**
 * Comprehensive Test for Tyler, Olive, and Trump Queries
 * Tests the fixed memory retrieval and response pipeline
 */

require('dotenv').config({ path: '.env.local' });

const testQueries = [
  {
    name: "Tyler Friend Query",
    query: "Where does your friend Tyler live?",
    expectedIntent: "people",
    expectedFragments: ["tyler", "friend", "austin", "texas", "live"],
    expectDeepContribution: true,
    expectPinnedMemories: true,
    memoryType: "relationship"
  },
  {
    name: "Olive Pet Query", 
    query: "Tell me about Olive.",
    expectedIntent: "pets",
    expectedFragments: ["olive", "dog", "pet", "poodle"],
    expectDeepContribution: true,
    expectPinnedMemories: true,
    memoryType: "pet"
  },
  {
    name: "Trump Opinion Query",
    query: "What do you think of Trump?",
    expectedIntent: "opinion", 
    expectedFragments: ["trump", "political", "opinion", "think"],
    expectDeepContribution: true,
    expectPinnedMemories: true,
    memoryType: "opinion"
  }
];

async function testSpecificQueries() {
  console.log('🧪 Testing Tyler, Olive, and Trump Query Pipeline');
  console.log('=' .repeat(60));

  let passedTests = 0;
  let totalTests = testQueries.length;

  for (const test of testQueries) {
    console.log(`\n🔍 Test: ${test.name}`);
    console.log(`Query: "${test.query}"`);
    console.log(`Expected intent: ${test.expectedIntent}`);
    console.log(`Memory type: ${test.memoryType}`);
    
    try {
      const startTime = Date.now();
      
      // Test the chat API
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          avatarSlug: 'jonathan-demo',
          message: test.query,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Process streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let metaData = null;
      let deepMergeDetected = false;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.delta) {
                fullResponse += data.delta;
              }
              
              if (data.event === 'meta') {
                metaData = data;
              }
              
              if (data.event === 'deep_merge_log') {
                deepMergeDetected = true;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      const totalTime = Date.now() - startTime;
      console.log(`⏱️  Response time: ${totalTime}ms`);
      console.log(`📝 Response length: ${fullResponse.length} chars`);
      
      let testPassed = true;
      const failures = [];
      
      // Check response content for expected fragments
      const responseText = fullResponse.toLowerCase();
      const foundFragments = test.expectedFragments.filter(fragment => 
        responseText.includes(fragment.toLowerCase())
      );
      
      console.log(`🔍 Found fragments: ${foundFragments.join(', ')}`);
      
      if (foundFragments.length === 0) {
        testPassed = false;
        failures.push(`No expected fragments found: ${test.expectedFragments.join(', ')}`);
      } else {
        console.log(`✅ Found ${foundFragments.length}/${test.expectedFragments.length} expected fragments`);
      }
      
      // Check for deep lane contribution
      if (test.expectDeepContribution && !deepMergeDetected) {
        testPassed = false;
        failures.push('Deep lane should have contributed but no deep merge detected');
      } else if (deepMergeDetected) {
        console.log('✅ Deep lane contribution detected');
      }
      
      // Check for non-hallucinated content (response should be specific, not generic)
      const isGeneric = /i don't have|i'm not sure|i don't know|i can't recall/i.test(responseText);
      const isSpecific = foundFragments.length > 1; // Multiple fragments suggest specific memory recall
      
      if (isGeneric && !isSpecific) {
        testPassed = false;
        failures.push('Response appears to be generic/hallucinated rather than from stored memories');
      } else if (isSpecific) {
        console.log('✅ Response appears to be from specific stored memories');
      }
      
      // Check response quality
      if (fullResponse.length < 20) {
        testPassed = false;
        failures.push('Response too short, may indicate system failure');
      }
      
      // Log metadata if available
      if (metaData) {
        console.log(`📊 Metadata: trace_id=${metaData.trace_id}, budget=${metaData.latency_budget_ms}ms`);
      }
      
      // Overall test result
      if (testPassed) {
        console.log('✅ Test PASSED');
        console.log(`📄 Response preview: "${fullResponse.substring(0, 100)}..."`);
        passedTests++;
      } else {
        console.log('❌ Test FAILED:');
        failures.forEach(failure => console.log(`   - ${failure}`));
        console.log(`📄 Full response: "${fullResponse}"`);
      }
      
    } catch (error) {
      console.log(`❌ Test FAILED with error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📈 Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All specific query tests passed!');
    console.log('✅ Tyler, Olive, and Trump queries are working correctly');
    console.log('✅ Memory retrieval is functioning properly');
    console.log('✅ No hallucination detected');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Memory pipeline needs attention.');
    process.exit(1);
  }
}

// Run the tests
if (require.main === module) {
  testSpecificQueries().catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = { testSpecificQueries };