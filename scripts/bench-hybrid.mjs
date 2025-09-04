/**
 * Hybrid Streaming Benchmark - Latency Budget Enforcement
 * Tests strict end-to-end timing: demo ≤900ms, normal ≤1500ms
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function benchmarkScenario(scenario) {
  const startTime = Date.now();
  let firstTokenTime = null;
  let tokenCount = 0;
  let fullResponse = '';
  let fastLaneTokens = 0;
  let deepLaneTokens = 0;
  let traceId = null;
  let budgetMs = null;
  let cancelReason = null;
  
  console.log(`\n🎯 Benchmarking: ${scenario.name}`);
  console.log(`   Avatar: ${scenario.avatarSlug}`);
  console.log(`   Message: "${scenario.message}"`);
  
  try {
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
              
              // Handle meta event
              if (data.event === 'meta') {
                traceId = data.trace_id;
                budgetMs = data.latency_budget_ms;
                continue;
              }
              
              // Handle end event
              if (data.event === 'end') {
                break;
              }
              
              // Handle delta tokens
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
    const totalMs = endTime - startTime;
    const firstTokenMs = firstTokenTime ? firstTokenTime - startTime : null;
    
    const result = {
      scenario: scenario.name,
      avatarSlug: scenario.avatarSlug,
      firstTokenMs,
      totalMs,
      tokenCount,
      fastLaneTokens,
      deepLaneTokens,
      traceId,
      budgetMs,
      cancelReason,
      preview: fullResponse.slice(0, 100) + (fullResponse.length > 100 ? '...' : ''),
      fullResponse
    };
    
    // Budget assertions
    const isDemo = scenario.avatarSlug.includes('demo');
    const budgetLimit = isDemo ? 900 : 1500;
    const budgetPassed = totalMs <= budgetLimit;
    
    console.log(`   ⏱️  First token: ${firstTokenMs}ms`);
    console.log(`   ⏱️  Total time: ${totalMs}ms (budget: ${budgetLimit}ms) ${budgetPassed ? '✅' : '❌'}`);
    console.log(`   📊 Tokens: ${tokenCount} (Fast: ${fastLaneTokens}, Deep: ${deepLaneTokens})`);
    console.log(`   🔍 Trace: ${traceId}, Budget: ${budgetMs}ms`);
    if (cancelReason) {
      console.log(`   ⚠️  Cancel reason: ${cancelReason}`);
    }
    console.log(`   💬 Response: "${result.preview}"`);
    
    // Assertions
    if (isDemo) {
      console.assert(totalMs <= 900, `Demo total ${totalMs}ms > 900ms`);
    } else {
      console.assert(totalMs <= 1500, `Normal total ${totalMs}ms > 1500ms`);
    }
    
    return result;
    
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.message}`);
    return { 
      scenario: scenario.name, 
      error: error.message,
      totalMs: Date.now() - startTime
    };
  }
}

async function runBenchmarks() {
  console.log('🚀 Hybrid Streaming Latency Budget Benchmark\n');
  console.log('Target: Demo ≤900ms, Normal ≤1500ms\n');

  const scenarios = [
    {
      name: 'Demo Cold Request',
      avatarSlug: 'jonathan-demo',
      message: 'Hey Jonathan! How are you doing?'
    },
    {
      name: 'Demo Cache Hit',
      avatarSlug: 'jonathan-demo', 
      message: 'Tell me about Romeo'
    },
    {
      name: 'Demo Identity Confirmation',
      avatarSlug: 'jonathan-demo',
      message: 'Hey it\'s Tyler from France'
    },
    {
      name: 'Normal Mode',
      avatarSlug: 'test-avatar',
      message: 'Hello there!'
    }
  ];

  const results = [];

  for (const scenario of scenarios) {
    const result = await benchmarkScenario(scenario);
    results.push(result);
    
    // Brief pause between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  console.log('\n📊 BENCHMARK SUMMARY');
  console.log('====================');
  
  const passed = results.filter(r => {
    if (r.error) return false;
    const isDemo = r.avatarSlug?.includes('demo');
    const limit = isDemo ? 900 : 1500;
    return r.totalMs <= limit;
  }).length;
  
  const total = results.length;
  
  console.log(`✅ Budget compliance: ${passed}/${total} (${(passed/total*100).toFixed(1)}%)`);
  
  // Performance breakdown
  const validResults = results.filter(r => !r.error && r.firstTokenMs);
  if (validResults.length > 0) {
    const avgFirstToken = validResults.reduce((sum, r) => sum + r.firstTokenMs, 0) / validResults.length;
    const avgTotal = validResults.reduce((sum, r) => sum + r.totalMs, 0) / validResults.length;
    
    console.log(`⚡ Average first token: ${avgFirstToken.toFixed(0)}ms`);
    console.log(`⏱️  Average total time: ${avgTotal.toFixed(0)}ms`);
    
    // Deep Lane analysis
    const withDeepTokens = validResults.filter(r => r.deepLaneTokens > 0);
    console.log(`🔄 Deep Lane active: ${withDeepTokens.length}/${validResults.length} scenarios`);
    
    if (withDeepTokens.length > 0) {
      const avgDeepTokens = withDeepTokens.reduce((sum, r) => sum + r.deepLaneTokens, 0) / withDeepTokens.length;
      console.log(`📈 Average Deep tokens: ${avgDeepTokens.toFixed(0)}`);
    }
  }
  
  console.log('\n🎉 Benchmark Complete!');
  
  return results;
}

// Run benchmarks
if (import.meta.url === `file://${process.argv[1]}`) {
  runBenchmarks().catch(console.error);
}

export { runBenchmarks };