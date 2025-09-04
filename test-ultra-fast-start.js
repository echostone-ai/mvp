#!/usr/bin/env node

/**
 * Test script for ultra-fast start approach
 * Should achieve sub-300ms first token with basic accuracy
 */

const BASE_URL = 'http://localhost:3000';

async function testUltraFastStart() {
  console.log('🚀 Testing Ultra-Fast Start (No Waiting)\n');

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
      message: 'Hi Jonathan! How are you doing? Where do you live now?',
      fastMode: true
    })
  });

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  console.log('📡 Ultra-fast response:');
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
  console.log('📊 Ultra-Fast Start Performance:');
  console.log(`⚡ First token: ${firstTokenTime}ms`);
  console.log(`🏁 Total time: ${totalTime}ms`);
  console.log(`📝 Response length: ${responseText.length} chars`);
  
  console.log('\n🔍 Basic Accuracy Check:');
  const lowerResponse = responseText.toLowerCase();
  
  const hasSpain = lowerResponse.includes('spain');
  const hasValencia = lowerResponse.includes('valencia');
  const hasCurrentInfo = hasSpain || hasValencia || lowerResponse.includes('currently') || lowerResponse.includes('now');
  const hasVancouverIsland = lowerResponse.includes('vancouver island');
  
  console.log(`✅ Mentions Spain/current location: ${hasCurrentInfo ? '✅ GOOD' : '⚠️  BASIC'}`);
  console.log(`❌ Mentions Vancouver Island: ${hasVancouverIsland ? '⚠️  OUTDATED' : '✅ GOOD'}`);
  
  console.log('\n🎯 Performance Targets:');
  console.log(`First token < 500ms: ${firstTokenTime < 500 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`First token < 300ms: ${firstTokenTime < 300 ? '🚀 EXCELLENT' : firstTokenTime < 500 ? '✅ GOOD' : '❌ FAIL'}`);
  console.log(`First token < 200ms: ${firstTokenTime < 200 ? '🚀 AMAZING' : '⚠️  TARGET'}`);
  console.log(`Total time < 3s: ${totalTime < 3000 ? '✅ PASS' : '❌ FAIL'}`);
  
  // Test rapid follow-up
  console.log('\n🔄 Testing rapid follow-up...');
  const followupStart = Date.now();
  
  const followupResponse = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': response.headers.get('set-cookie') || ''
    },
    body: JSON.stringify({
      avatarSlug: 'jonathan-demo',
      message: 'That sounds great! What do you like about living there?',
      fastMode: true
    })
  });

  if (followupResponse.body) {
    const followupReader = followupResponse.body.getReader();
    const { value } = await followupReader.read();
    const followupFirstToken = Date.now() - followupStart;
    
    console.log(`⚡ Follow-up first token: ${followupFirstToken}ms`);
    console.log(`Consistent speed: ${followupFirstToken < 400 ? '✅ GOOD' : '❌ SLOWER'}`);
    
    followupReader.releaseLock();
  }
  
  console.log('\n🎯 Ultra-Fast Start Strategy:');
  console.log('- 🚀 No waiting for EnhancedPromptBuilder');
  console.log('- ⚡ Immediate streaming with basic prompt');
  console.log('- 🎭 Basic personality info in prompt');
  console.log('- 💾 Memory writes happen async');
  console.log('- 🔄 Consistent fast performance');
  
  console.log('\n📈 Expected vs Actual:');
  console.log(`Expected first token: < 300ms`);
  console.log(`Actual first token: ${firstTokenTime}ms`);
  console.log(`Performance ratio: ${firstTokenTime < 300 ? '✅ MEETS TARGET' : `❌ ${(firstTokenTime/300).toFixed(1)}x slower`}`);
  
  if (firstTokenTime < 300) {
    console.log('\n🎉 SUCCESS: Ultra-fast start is working!');
  } else {
    console.log('\n⚠️  ISSUE: Still not fast enough, need further optimization');
  }
}

testUltraFastStart().catch(console.error);