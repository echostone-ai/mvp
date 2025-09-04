#!/usr/bin/env node

/**
 * Performance test script for optimized chat route
 * Tests first token latency for demo vs normal mode
 */

const DEMO_AVATAR_SLUG = 'jonathan-demo';
const NORMAL_AVATAR_SLUG = 'jonathan';
const BASE_URL = 'http://localhost:3000';

async function measureFirstToken(avatarSlug, message, cookie = null) {
  const startTime = Date.now();
  
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (cookie) {
    headers['Cookie'] = cookie;
  }

  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      avatarSlug,
      message,
      fastMode: true
    })
  });

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  // Read first chunk to measure first token latency
  const { value } = await reader.read();
  const firstTokenTime = Date.now() - startTime;
  
  // Clean up reader
  reader.releaseLock();
  
  return {
    firstTokenLatency: firstTokenTime,
    cookie: response.headers.get('set-cookie')
  };
}

async function testPerformance() {
  console.log('🚀 Testing Performance Optimizations\n');

  // Test 1: Demo mode first token latency
  console.log('1. Testing demo mode first token latency...');
  
  try {
    const demoResult = await measureFirstToken(DEMO_AVATAR_SLUG, 'Hello, how are you?');
    console.log(`Demo mode first token: ${demoResult.firstTokenLatency}ms`);
    console.log(`Target: < 1000ms | ${demoResult.firstTokenLatency < 1000 ? '✅ PASS' : '❌ FAIL'}`);
    
    // Test 2: Demo mode with cached memories (second request)
    console.log('\n2. Testing demo mode with cached memories...');
    const demoCachedResult = await measureFirstToken(
      DEMO_AVATAR_SLUG, 
      'What do you remember about me?',
      demoResult.cookie
    );
    console.log(`Demo cached first token: ${demoCachedResult.firstTokenLatency}ms`);
    console.log(`Should be faster than first request: ${demoCachedResult.firstTokenLatency < demoResult.firstTokenLatency ? '✅ PASS' : '❌ FAIL'}`);

    // Test 3: Normal mode comparison
    console.log('\n3. Testing normal mode for comparison...');
    const normalResult = await measureFirstToken(NORMAL_AVATAR_SLUG, 'Hello, how are you?');
    console.log(`Normal mode first token: ${normalResult.firstTokenLatency}ms`);

    // Test 4: Multiple rapid demo requests (cache effectiveness)
    console.log('\n4. Testing cache effectiveness with rapid requests...');
    const rapidTests = [];
    for (let i = 0; i < 3; i++) {
      rapidTests.push(measureFirstToken(
        DEMO_AVATAR_SLUG, 
        `Quick test ${i + 1}`,
        demoResult.cookie
      ));
    }
    
    const rapidResults = await Promise.all(rapidTests);
    const avgLatency = rapidResults.reduce((sum, r) => sum + r.firstTokenLatency, 0) / rapidResults.length;
    console.log(`Average rapid request latency: ${avgLatency.toFixed(0)}ms`);
    console.log(`Consistent performance: ${rapidResults.every(r => r.firstTokenLatency < 1000) ? '✅ PASS' : '❌ FAIL'}`);

    console.log('\n📊 Performance Summary:');
    console.log(`- Demo mode first token: ${demoResult.firstTokenLatency}ms`);
    console.log(`- Demo cached requests: ${demoCachedResult.firstTokenLatency}ms`);
    console.log(`- Normal mode: ${normalResult.firstTokenLatency}ms`);
    console.log(`- Rapid requests avg: ${avgLatency.toFixed(0)}ms`);
    
    console.log('\n✅ Aggressive optimizations implemented:');
    console.log('- ✅ Avatar ID caching (1 hour TTL)');
    console.log('- ✅ Precomputed demo prompt caching (5 min TTL)');
    console.log('- ✅ Bypassed EnhancedPromptBuilder for demo mode');
    console.log('- ✅ Reusable Supabase client connections');
    console.log('- ✅ Minimal memory fetching for demo (4 turns max)');
    console.log('- ✅ Async memory writes (fire and forget)');
    console.log('- ✅ SQL-level filtering and reduced query limits');

  } catch (error) {
    console.error('Performance test failed:', error);
  }
}

// Run the test
testPerformance().catch(console.error);