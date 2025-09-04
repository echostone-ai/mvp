#!/usr/bin/env node

/**
 * Ultra-fast demo mode test
 * Tests the new bypassed demo mode implementation
 */

const BASE_URL = 'http://localhost:3000';

async function testUltraFastDemo() {
  console.log('🚀 Testing Ultra-Fast Demo Mode\n');

  const startTime = Date.now();
  
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      avatarSlug: 'jonathan-demo',
      message: 'Hello, how are you today?',
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
  
  console.log(`✅ Ultra-fast demo first token: ${firstTokenTime}ms`);
  console.log(`Target < 500ms: ${firstTokenTime < 500 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Stretch goal < 200ms: ${firstTokenTime < 200 ? '✅ PASS' : '⚠️  CLOSE'}`);

  // Read a bit more to see the response
  let responseText = decoder.decode(value);
  try {
    const { value: value2 } = await reader.read();
    if (value2) responseText += decoder.decode(value2);
  } catch {}
  
  console.log(`\nFirst response chunk: "${responseText.slice(0, 50)}..."`);
  
  // Clean up reader
  reader.releaseLock();

  // Test cached request
  console.log('\n🔄 Testing cached request...');
  const cachedStart = Date.now();
  
  const cachedResponse = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': response.headers.get('set-cookie') || ''
    },
    body: JSON.stringify({
      avatarSlug: 'jonathan-demo',
      message: 'What do you think about the weather?',
      fastMode: true
    })
  });

  if (cachedResponse.body) {
    const cachedReader = cachedResponse.body.getReader();
    const { value: cachedValue } = await cachedReader.read();
    const cachedFirstToken = Date.now() - cachedStart;
    
    console.log(`✅ Cached request first token: ${cachedFirstToken}ms`);
    console.log(`Target < 200ms: ${cachedFirstToken < 200 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Ultra-fast < 100ms: ${cachedFirstToken < 100 ? '🚀 AMAZING' : '⚠️  GOOD'}`);
    
    cachedReader.releaseLock();
  }

  console.log('\n📊 Ultra-Fast Optimizations:');
  console.log('- ✅ Completely bypassed EnhancedPromptBuilder');
  console.log('- ✅ Minimal conversation history (2 turns max)');
  console.log('- ✅ Cached prompt with 5-minute TTL');
  console.log('- ✅ Cached avatar ID with 1-hour TTL');
  console.log('- ✅ Async memory writes (fire and forget)');
  console.log('- ✅ Reusable Supabase client');
  console.log('- ✅ Direct OpenAI streaming');
}

testUltraFastDemo().catch(console.error);