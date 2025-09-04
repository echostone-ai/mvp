#!/usr/bin/env node

/**
 * Test script for minimal fast path
 * Should achieve true sub-300ms by bypassing all database operations
 */

const BASE_URL = 'http://localhost:3000';

async function testMinimalFast() {
  console.log('🚀 Testing Minimal Fast Path (No DB Calls)\n');

  const startTime = Date.now();
  let firstTokenTime = 0;
  let responseText = '';
  
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      avatarSlug: 'jonathan-demo',
      message: 'Hi Jonathan! How are you? Where do you live now?',
      fastMode: true
    })
  });

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  console.log('📡 Minimal fast response:');
  console.log('─'.repeat(60));
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      const chunk = decoder.decode(value);
      responseText += chunk;
      
      // Measure first token
      if (firstTokenTime === 0) {
        firstTokenTime = Date.now() - startTime;
        console.log(`⚡ First token: ${firstTokenTime}ms`);
        console.log('─'.repeat(60));
      }
      
      // Print chunk in real-time
      process.stdout.write(chunk);
    }
  } catch (error) {
    console.error('Streaming error:', error);
  } finally {
    reader.releaseLock();
  }
  
  const totalTime = Date.now() - startTime;
  
  console.log('\n' + '─'.repeat(60));
  console.log('📊 Minimal Fast Performance:');
  console.log(`⚡ First token: ${firstTokenTime}ms`);
  console.log(`🏁 Total time: ${totalTime}ms`);
  console.log(`📝 Response length: ${responseText.length} chars`);
  
  console.log('\n🔍 Content Check:');
  const lowerResponse = responseText.toLowerCase();
  
  const hasSpain = lowerResponse.includes('spain');
  const hasCurrentInfo = hasSpain || lowerResponse.includes('currently') || lowerResponse.includes('now');
  const hasVancouverIsland = lowerResponse.includes('vancouver island');
  
  console.log(`✅ Mentions current location: ${hasCurrentInfo ? '✅ GOOD' : '⚠️  BASIC'}`);
  console.log(`❌ Mentions Vancouver Island: ${hasVancouverIsland ? '⚠️  OUTDATED' : '✅ GOOD'}`);
  
  console.log('\n🎯 Speed Analysis:');
  console.log(`Target: < 300ms`);
  console.log(`Actual: ${firstTokenTime}ms`);
  
  if (firstTokenTime < 300) {
    console.log(`🚀 SUCCESS: ${((300 - firstTokenTime) / 300 * 100).toFixed(1)}% faster than target!`);
  } else if (firstTokenTime < 500) {
    console.log(`✅ GOOD: Only ${firstTokenTime - 300}ms over target`);
  } else if (firstTokenTime < 1000) {
    console.log(`⚠️  SLOW: ${firstTokenTime - 300}ms over target`);
  } else {
    console.log(`❌ VERY SLOW: ${(firstTokenTime / 1000).toFixed(1)}s - something is blocking`);
  }
  
  console.log('\n🔍 Performance Targets:');
  console.log(`< 200ms: ${firstTokenTime < 200 ? '🚀 AMAZING' : '❌'}`);
  console.log(`< 300ms: ${firstTokenTime < 300 ? '🚀 EXCELLENT' : '❌'}`);
  console.log(`< 500ms: ${firstTokenTime < 500 ? '✅ GOOD' : '❌'}`);
  console.log(`< 1000ms: ${firstTokenTime < 1000 ? '⚠️  ACCEPTABLE' : '❌'}`);
  
  // Quick follow-up test
  console.log('\n🔄 Testing follow-up speed...');
  const followupStart = Date.now();
  
  const followupResponse = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': response.headers.get('set-cookie') || ''
    },
    body: JSON.stringify({
      avatarSlug: 'jonathan-demo',
      message: 'What do you like about it there?',
      fastMode: true
    })
  });

  if (followupResponse.body) {
    const followupReader = followupResponse.body.getReader();
    const { value } = await followupReader.read();
    const followupFirstToken = Date.now() - followupStart;
    
    console.log(`⚡ Follow-up: ${followupFirstToken}ms`);
    console.log(`Consistency: ${Math.abs(followupFirstToken - firstTokenTime) < 200 ? '✅ CONSISTENT' : '⚠️  VARIABLE'}`);
    
    followupReader.releaseLock();
  }
  
  console.log('\n🎯 Minimal Fast Strategy:');
  console.log('- 🚫 No database calls before streaming');
  console.log('- 🚫 No avatar ID lookup blocking');
  console.log('- 🚫 No memory fetching blocking');
  console.log('- ⚡ Direct to OpenAI streaming');
  console.log('- 🔄 Background memory operations');
  
  if (firstTokenTime > 1000) {
    console.log('\n⚠️  DIAGNOSIS: Still > 1s suggests:');
    console.log('- Network latency to OpenAI');
    console.log('- OpenAI API cold start');
    console.log('- System/Node.js overhead');
    console.log('- Possible rate limiting');
  }
  
  console.log('\n📈 Improvement Summary:');
  console.log(`Previous attempt: 3276ms`);
  console.log(`Current attempt: ${firstTokenTime}ms`);
  if (firstTokenTime < 3276) {
    console.log(`Improvement: ${((3276 - firstTokenTime) / 3276 * 100).toFixed(1)}% faster`);
  }
}

testMinimalFast().catch(console.error);