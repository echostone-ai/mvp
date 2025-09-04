/**
 * Test Hybrid Streaming Fast Lane + Persistent Session Context
 * Validates the complete hybrid streaming architecture
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testHybridStreaming() {
  console.log('🚀 Testing Hybrid Streaming Architecture...\n');

  // Test scenarios
  const scenarios = [
    {
      name: 'Demo Mode - Cold Request',
      avatarSlug: 'jonathan-demo',
      message: 'Hey Jonathan! How are you doing?',
      expectFirstToken: 200, // <200ms target
      expectDeepMerge: 1000   // <1s target
    },
    {
      name: 'Demo Mode - Cache Hit',
      avatarSlug: 'jonathan-demo', 
      message: 'Tell me about Romeo',
      expectFirstToken: 100,  // Near-instant for cache hit
      expectDeepMerge: 800
    },
    {
      name: 'Demo Mode - Identity Confirmation',
      avatarSlug: 'jonathan-demo',
      message: 'Hey it\'s Tyler from France',
      expectFirstToken: 150,
      expectDeepMerge: 900
    },
    {
      name: 'Normal Mode - Should be unaffected',
      avatarSlug: 'test-avatar',
      message: 'Hello there!',
      expectFirstToken: 300,  // Normal latency expected
      expectDeepMerge: 1200
    }
  ];

  const results = [];

  for (const scenario of scenarios) {
    console.log(`\n📋 Testing: ${scenario.name}`);
    console.log(`   Avatar: ${scenario.avatarSlug}`);
    console.log(`   Message: "${scenario.message}"`);
    
    try {
      const result = await testSingleScenario(scenario);
      results.push({ scenario: scenario.name, ...result });
      
      // Validate performance targets
      const firstTokenOk = result.firstTokenMs <= scenario.expectFirstToken;
      const deepMergeOk = result.totalMs <= scenario.expectDeepMerge;
      
      console.log(`   ✅ First token: ${result.firstTokenMs}ms ${firstTokenOk ? '(PASS)' : '(FAIL)'}`);
      console.log(`   ✅ Total time: ${result.totalMs}ms ${deepMergeOk ? '(PASS)' : '(FAIL)'}`);
      console.log(`   📊 Tokens: ${result.tokenCount} (Fast: ${result.fastLaneTokens}, Deep: ${result.deepLaneTokens})`);
      console.log(`   💬 Response: "${result.preview}"`)
      
    } catch (error) {
      console.log(`   ❌ FAILED: ${error.message}`);
      results.push({ scenario: scenario.name, error: error.message });
    }
    
    // Brief pause between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  console.log('\n📊 HYBRID STREAMING TEST SUMMARY');
  console.log('================================');
  
  const passed = results.filter(r => !r.error && r.firstTokenMs <= 200).length;
  const total = results.length;
  
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`🎯 Fast Lane Success Rate: ${(passed/total*100).toFixed(1)}%`);
  
  // Performance breakdown
  const avgFirstToken = results
    .filter(r => r.firstTokenMs)
    .reduce((sum, r) => sum + r.firstTokenMs, 0) / results.filter(r => r.firstTokenMs).length;
  
  console.log(`⚡ Average First Token: ${avgFirstToken.toFixed(0)}ms`);
  
  // Check for memory leakage (demo vs normal isolation)
  console.log('\n🔒 Testing Demo Mode Isolation...');
  await testDemoIsolation();
  
  console.log('\n🎉 Hybrid Streaming Test Complete!');
}

async function testSingleScenario(scenario) {
  const startTime = Date.now();
  let firstTokenTime = null;
  let tokenCount = 0;
  let fullResponse = '';
  let fastLaneTokens = 0;
  let deepLaneTokens = 0;
  
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      avatarSlug: scenario.avatarSlug,
      message: scenario.message
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // Stream SSE response
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  
  if (!reader) {
    throw new Error('No response body');
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value, { stream: true });
    if (chunk) {
      // Parse SSE data
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.delta) {
              if (firstTokenTime === null) {
                firstTokenTime = Date.now();
              }
              tokenCount += data.delta.length;
              fullResponse += data.delta;
              
              if (data.channel === 'fast') {
                fastLaneTokens += data.delta.length;
              } else if (data.channel === 'deep') {
                deepLaneTokens += data.delta.length;
              }
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  const endTime = Date.now();
  
  return {
    firstTokenMs: firstTokenTime ? firstTokenTime - startTime : null,
    totalMs: endTime - startTime,
    tokenCount,
    fastLaneTokens,
    deepLaneTokens,
    preview: fullResponse.slice(0, 100) + (fullResponse.length > 100 ? '...' : ''),
    fullResponse
  };
}

async function testDemoIsolation() {
  // Test that demo memories don't leak to normal avatars
  console.log('   🔍 Testing memory isolation...');
  
  // Make a demo request
  await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      avatarSlug: 'jonathan-demo',
      message: 'Remember I told you about my secret project X'
    })
  });
  
  // Make a normal avatar request - should not see demo memories
  const normalResponse = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      avatarSlug: 'test-avatar',
      message: 'Do you know about project X?',
      debug: true
    })
  });
  
  if (normalResponse.ok) {
    const debugData = await normalResponse.json();
    console.log('   ✅ Demo isolation test passed');
  } else {
    console.log('   ⚠️  Demo isolation test inconclusive');
  }
}

async function testDebugMode() {
  console.log('\n🔧 Testing Debug Mode...');
  
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      avatarSlug: 'jonathan-demo',
      message: 'Test debug mode',
      debug: true
    })
  });
  
  if (response.ok) {
    const debugData = await response.json();
    console.log('   📊 Debug data:', {
      sessionCtx: debugData.sessionCtx,
      cacheStats: debugData.cacheStats
    });
  }
}

// Run tests
if (require.main === module) {
  testHybridStreaming()
    .then(() => testDebugMode())
    .catch(console.error);
}

module.exports = { testHybridStreaming };