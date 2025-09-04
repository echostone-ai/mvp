/**
 * Stabilized Chat Route Acceptance Test
 * Tests Tyler/Olive/Trump queries with strict requirements
 */

require('dotenv').config({ path: '.env.local' });

const TEST_QUERIES = [
  {
    name: 'Tyler Friend Query',
    query: 'Where does your friend Tyler live?',
    expectedIntent: 'people',
    expectedFragments: ['tyler', 'austin', 'portland', 'sofia'],
    entitySlot: 'Tyler.city'
  },
  {
    name: 'Olive Pet Query',
    query: 'Tell me about Olive.',
    expectedIntent: 'pets',
    expectedFragments: ['olive', 'pet', 'personality'],
    entitySlot: 'Olive.description'
  },
  {
    name: 'Trump Opinion Query',
    query: 'What do you think of Trump?',
    expectedIntent: 'opinion',
    expectedFragments: ['trump', 'opinion', 'political'],
    entitySlot: 'Trump.opinion'
  }
];

async function runAcceptanceTest(testCase, runNumber) {
  console.log(`\n🔍 Run ${runNumber}: ${testCase.name}`);
  console.log(`Query: "${testCase.query}"`);
  
  const startTime = Date.now();
  let hasRuntimeError = false;
  let deepStartedMs = null;
  let deepMerge = false;
  let controllerError = false;
  
  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        avatarSlug: 'jonathan-demo',
        message: testCase.query
      })
    });

    if (!response.ok) {
      hasRuntimeError = true;
      console.error('❌ HTTP Error:', response.status);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let metaData = null;
    
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
              deepStartedMs = data.t_deep_started_ms;
              deepMerge = data.deep_merge;
            }
            
            if (data.event === 'error' && data.error?.includes('controller')) {
              controllerError = true;
            }
          } catch (e) {
            // JSON parse errors are acceptable for SSE
          }
        }
      }
    }
    
    const responseTime = Date.now() - startTime;
    
    // Check acceptance criteria
    const criteria = {
      deepStartedUnder100ms: deepStartedMs !== null && deepStartedMs < 100,
      deepMergeTrue: deepMerge === true,
      noControllerError: !controllerError,
      noRuntimeError: !hasRuntimeError,
      hasSpecificContent: false,
      usesStoredSlots: false
    };
    
    // Check for specific content vs hallucination
    const responseText = fullResponse.toLowerCase();
    const foundFragments = testCase.expectedFragments.filter(fragment => 
      responseText.includes(fragment.toLowerCase())
    );
    
    criteria.hasSpecificContent = foundFragments.length > 0;
    
    // Check if response uses stored information or abstains
    const hasGenericResponse = responseText.includes("i don't know") || 
                              responseText.includes("i'm not sure") ||
                              responseText.includes("don't have enough information");
    
    criteria.usesStoredSlots = criteria.hasSpecificContent || hasGenericResponse;
    
    const allCriteriaMet = Object.values(criteria).every(Boolean);
    
    // Log results
    console.log(`⏱️  Response time: ${responseTime}ms`);
    console.log(`🚀 Deep started: ${deepStartedMs}ms (${criteria.deepStartedUnder100ms ? '✅' : '❌'} <100ms)`);
    console.log(`🔄 Deep merge: ${deepMerge} (${criteria.deepMergeTrue ? '✅' : '❌'})`);
    console.log(`🛡️  No controller error: ${criteria.noControllerError ? '✅' : '❌'}`);
    console.log(`🔍 Found fragments: ${foundFragments.length}/${testCase.expectedFragments.length} (${foundFragments.join(', ')})`);
    console.log(`📝 Uses stored slots/abstains: ${criteria.usesStoredSlots ? '✅' : '❌'}`);
    
    if (allCriteriaMet) {
      console.log('✅ PASS - All acceptance criteria met');
    } else {
      console.log('❌ FAIL - Some criteria not met');
    }
    
    return {
      success: allCriteriaMet,
      criteria,
      responseTime,
      deepStartedMs,
      deepMerge,
      foundFragments: foundFragments.length,
      response: fullResponse.substring(0, 150) + '...'
    };
    
  } catch (error) {
    hasRuntimeError = true;
    console.error('❌ Runtime error:', error.message);
    return { 
      success: false, 
      error: error.message,
      criteria: { noRuntimeError: false }
    };
  }
}

async function runFullAcceptanceTest() {
  console.log('🧪 STABILIZED CHAT ROUTE ACCEPTANCE TEST');
  console.log('=' .repeat(60));
  console.log('Requirements:');
  console.log('- t_deep_started_ms < 100ms');
  console.log('- deep_merge === true');
  console.log('- No controller closed/ReferenceError');
  console.log('- Entity answers use stored slots or abstain');
  console.log('- Success threshold: 50 sequential runs, zero runtime errors');
  console.log('- Deep contribution on ≥95% of runs\n');
  
  const REQUIRED_RUNS = 50;
  const MIN_DEEP_CONTRIBUTION_RATE = 0.95;
  
  let totalRuns = 0;
  let successfulRuns = 0;
  let runtimeErrors = 0;
  let deepContributions = 0;
  let consecutiveSuccesses = 0;
  let maxConsecutiveSuccesses = 0;
  
  const results = [];
  
  for (let run = 1; run <= REQUIRED_RUNS; run++) {
    for (const testCase of TEST_QUERIES) {
      totalRuns++;
      const result = await runAcceptanceTest(testCase, run);
      results.push({ testCase: testCase.name, run, result });
      
      if (result.success) {
        successfulRuns++;
        consecutiveSuccesses++;
        maxConsecutiveSuccesses = Math.max(maxConsecutiveSuccesses, consecutiveSuccesses);
      } else {
        consecutiveSuccesses = 0;
      }
      
      if (result.error || result.criteria?.noRuntimeError === false) {
        runtimeErrors++;
      }
      
      if (result.deepMerge) {
        deepContributions++;
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Progress update every 10 runs
    if (run % 10 === 0) {
      const successRate = (successfulRuns / totalRuns) * 100;
      const deepRate = (deepContributions / totalRuns) * 100;
      console.log(`\n📊 Progress after ${run} runs:`);
      console.log(`   Success rate: ${successRate.toFixed(1)}% (${successfulRuns}/${totalRuns})`);
      console.log(`   Deep contribution rate: ${deepRate.toFixed(1)}% (${deepContributions}/${totalRuns})`);
      console.log(`   Runtime errors: ${runtimeErrors}`);
      console.log(`   Max consecutive successes: ${maxConsecutiveSuccesses}`);
    }
  }
  
  // Final analysis
  const finalSuccessRate = (successfulRuns / totalRuns) * 100;
  const finalDeepRate = (deepContributions / totalRuns) * 100;
  
  console.log('\n' + '=' .repeat(60));
  console.log('📈 FINAL ACCEPTANCE TEST RESULTS');
  console.log('=' .repeat(60));
  
  console.log(`✅ Successful runs: ${successfulRuns}/${totalRuns} (${finalSuccessRate.toFixed(1)}%)`);
  console.log(`🔄 Deep contributions: ${deepContributions}/${totalRuns} (${finalDeepRate.toFixed(1)}%)`);
  console.log(`❌ Runtime errors: ${runtimeErrors}`);
  console.log(`🏆 Max consecutive successes: ${maxConsecutiveSuccesses}`);
  
  // Check acceptance criteria
  const passesSuccessThreshold = maxConsecutiveSuccesses >= REQUIRED_RUNS;
  const passesRuntimeErrorThreshold = runtimeErrors === 0;
  const passesDeepContributionThreshold = finalDeepRate >= (MIN_DEEP_CONTRIBUTION_RATE * 100);
  
  console.log('\n🎯 ACCEPTANCE CRITERIA:');
  console.log(`   50 sequential successes: ${passesSuccessThreshold ? '✅' : '❌'} (${maxConsecutiveSuccesses}/50)`);
  console.log(`   Zero runtime errors: ${passesRuntimeErrorThreshold ? '✅' : '❌'} (${runtimeErrors} errors)`);
  console.log(`   ≥95% deep contribution: ${passesDeepContributionThreshold ? '✅' : '❌'} (${finalDeepRate.toFixed(1)}%)`);
  
  const overallPass = passesSuccessThreshold && passesRuntimeErrorThreshold && passesDeepContributionThreshold;
  
  if (overallPass) {
    console.log('\n🎉 ACCEPTANCE TEST PASSED');
    console.log('   Chat route is stabilized and ready for production');
  } else {
    console.log('\n⚠️  ACCEPTANCE TEST FAILED');
    console.log('   Chat route needs further stabilization');
  }
  
  return {
    passed: overallPass,
    successRate: finalSuccessRate,
    deepContributionRate: finalDeepRate,
    runtimeErrors,
    maxConsecutiveSuccesses
  };
}

// Run the acceptance test
runFullAcceptanceTest().catch(console.error);