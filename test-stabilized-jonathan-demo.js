#!/usr/bin/env node

/**
 * Stabilized Jonathan Demo Chat Pipeline Test
 * Tests the stabilization fixes for memory injection and deep lane contribution
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

// Test queries for acceptance probes
const TEST_QUERIES = [
  {
    query: "Where does your friend Tyler live?",
    expectation: "pinned relationship memory",
    intent: "people"
  },
  {
    query: "Tell me about Olive.",
    expectation: "pet memory",
    intent: "pets"
  },
  {
    query: "What do you think of Trump?",
    expectation: "opinion, no crash",
    intent: "opinion"
  },
  {
    query: "How long were you in Austin?",
    expectation: "bio memory 2009-2018",
    intent: "travel"
  },
  {
    query: "When did you move to Austin?",
    expectation: "timeline memory",
    intent: "timeline"
  }
];

async function testStabilizedPipeline() {
  console.log('🚀 Testing Stabilized Jonathan Demo Chat Pipeline\n');
  
  let successCount = 0;
  let totalTests = 0;
  const results = [];
  
  for (const testCase of TEST_QUERIES) {
    totalTests++;
    console.log(`\n📝 Test ${totalTests}: ${testCase.query}`);
    console.log(`   Expected: ${testCase.expectation}`);
    console.log(`   Intent: ${testCase.intent}`);
    
    try {
      const startTime = Date.now();
      
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: testCase.query,
          avatar: 'jonathan-demo'
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let fullResponse = '';
      let deepStarted = false;
      let deepMerged = false;
      let deepStartTime = null;
      let pinnedCount = 0;
      let streamEvents = [];
      
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                streamEvents.push(data);
                
                if (data.channel === 'fast' || data.channel === 'deep') {
                  fullResponse += data.delta || '';
                }
                
                if (data.event === 'deep_merge_log') {
                  deepMerged = true;
                  if (!deepStartTime) deepStartTime = Date.now() - startTime;
                }
                
                if (data.event === 'meta') {
                  console.log(`   📊 Meta: budget=${data.latency_budget_ms}ms`);
                }
                
                if (data.event === 'meta_final') {
                  deepMerged = data.deep_merge;
                }
                
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      
      const totalTime = Date.now() - startTime;
      
      // Analyze results
      const hasCorrectContent = analyzeResponse(fullResponse, testCase);
      const deepStartedEarly = deepStartTime && deepStartTime < 100;
      const noHallucination = !containsHallucination(fullResponse, testCase);
      
      const testResult = {
        query: testCase.query,
        intent: testCase.intent,
        success: hasCorrectContent && noHallucination,
        totalTime,
        deepStartTime,
        deepMerged,
        deepStartedEarly,
        responseLength: fullResponse.length,
        response: fullResponse.substring(0, 200) + (fullResponse.length > 200 ? '...' : ''),
        issues: []
      };
      
      if (!hasCorrectContent) testResult.issues.push('Missing expected content');
      if (!noHallucination) testResult.issues.push('Contains hallucination');
      if (!deepStartedEarly && testCase.intent !== 'pets') testResult.issues.push('Deep lane started late');
      if (!deepMerged && ['people', 'opinion', 'travel', 'timeline'].includes(testCase.intent)) {
        testResult.issues.push('Deep lane did not contribute');
      }
      
      results.push(testResult);
      
      if (testResult.success) {
        successCount++;
        console.log(`   ✅ PASS (${totalTime}ms, deep: ${deepStartTime || 'N/A'}ms)`);
      } else {
        console.log(`   ❌ FAIL (${totalTime}ms) - ${testResult.issues.join(', ')}`);
      }
      
      console.log(`   📝 Response: ${testResult.response}`);
      
    } catch (error) {
      console.log(`   💥 ERROR: ${error.message}`);
      results.push({
        query: testCase.query,
        intent: testCase.intent,
        success: false,
        error: error.message,
        issues: ['Request failed']
      });
    }
    
    // Brief pause between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`📊 STABILIZATION TEST RESULTS`);
  console.log('='.repeat(60));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${successCount}`);
  console.log(`Failed: ${totalTests - successCount}`);
  console.log(`Success Rate: ${Math.round((successCount / totalTests) * 100)}%`);
  
  // Detailed results
  console.log('\n📋 Detailed Results:');
  results.forEach((result, i) => {
    console.log(`\n${i + 1}. ${result.query}`);
    console.log(`   Intent: ${result.intent}`);
    console.log(`   Status: ${result.success ? '✅ PASS' : '❌ FAIL'}`);
    if (result.issues && result.issues.length > 0) {
      console.log(`   Issues: ${result.issues.join(', ')}`);
    }
    if (result.totalTime) {
      console.log(`   Timing: ${result.totalTime}ms total, deep: ${result.deepStartTime || 'N/A'}ms`);
    }
  });
  
  // Validation criteria
  const passRate = (successCount / totalTests) * 100;
  const meetsAcceptanceCriteria = passRate >= 95;
  
  console.log('\n' + '='.repeat(60));
  console.log(`🎯 ACCEPTANCE CRITERIA: ${meetsAcceptanceCriteria ? '✅ MET' : '❌ NOT MET'}`);
  console.log(`   Required: ≥95% success rate`);
  console.log(`   Achieved: ${Math.round(passRate)}%`);
  console.log('='.repeat(60));
  
  return {
    totalTests,
    successCount,
    passRate,
    meetsAcceptanceCriteria,
    results
  };
}

function analyzeResponse(response, testCase) {
  const responseLower = response.toLowerCase();
  
  switch (testCase.intent) {
    case 'people':
      if (testCase.query.includes('Tyler')) {
        return responseLower.includes('tyler') || responseLower.includes('friend');
      }
      return true;
      
    case 'pets':
      if (testCase.query.includes('Olive')) {
        return responseLower.includes('olive') || responseLower.includes('dog') || responseLower.includes('pet');
      }
      return true;
      
    case 'opinion':
      if (testCase.query.includes('Trump')) {
        return responseLower.includes('trump') || responseLower.includes('opinion') || responseLower.includes('think');
      }
      return true;
      
    case 'travel':
      if (testCase.query.includes('Austin')) {
        return responseLower.includes('austin') || responseLower.includes('2009') || responseLower.includes('2018') || 
               responseLower.includes('years') || responseLower.includes('time');
      }
      return true;
      
    case 'timeline':
      return responseLower.includes('austin') || responseLower.includes('moved') || responseLower.includes('when');
      
    default:
      return true;
  }
}

function containsHallucination(response, testCase) {
  const responseLower = response.toLowerCase();
  
  // Check for common hallucination patterns
  const hallucinationPatterns = [
    /i think tyler lives in/i,
    /tyler is in/i,
    /olive is a.*cat/i, // If Olive is actually a dog
    /i was in austin for \d+ years/i, // Unless we have specific data
  ];
  
  // Check for abstention phrases (good - not hallucination)
  const abstentionPhrases = [
    'not sure yet',
    'let me check my notes',
    'i don\'t have that information',
    'i\'m not certain'
  ];
  
  const hasAbstention = abstentionPhrases.some(phrase => responseLower.includes(phrase));
  if (hasAbstention) return false; // Abstention is good, not hallucination
  
  // Check for specific hallucination patterns
  return hallucinationPatterns.some(pattern => pattern.test(response));
}

// Run the test
if (require.main === module) {
  testStabilizedPipeline()
    .then(results => {
      process.exit(results.meetsAcceptanceCriteria ? 0 : 1);
    })
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testStabilizedPipeline };