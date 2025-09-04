#!/usr/bin/env node

/**
 * Test script for hybrid streaming mode
 * Tests fast start + rich enhancement approach
 */

const BASE_URL = 'http://localhost:3000';

async function testHybridMode() {
  console.log('🚀 Testing Hybrid Streaming Mode\n');

  const startTime = Date.now();
  let firstTokenTime = 0;
  let totalTokens = 0;
  let responseText = '';
  
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      avatarSlug: 'jonathan', // Use normal avatar, not demo
      message: 'Tell me about your background and experiences',
      fastMode: true
    })
  });

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  console.log('📡 Streaming response:');
  console.log('─'.repeat(60));
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      const chunk = decoder.decode(value);
      responseText += chunk;
      totalTokens++;
      
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
  console.log('📊 Hybrid Mode Performance:');
  console.log(`⚡ First token: ${firstTokenTime}ms`);
  console.log(`🏁 Total time: ${totalTime}ms`);
  console.log(`📝 Total response length: ${responseText.length} chars`);
  console.log(`🎯 Tokens streamed: ${totalTokens}`);
  
  console.log('\n✅ Expected Behavior:');
  console.log('1. Fast start (< 500ms first token)');
  console.log('2. Basic response begins immediately');
  console.log('3. Enhanced content follows seamlessly');
  console.log('4. Rich personality emerges in continuation');
  
  console.log('\n🔍 Performance Targets:');
  console.log(`First token < 500ms: ${firstTokenTime < 500 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`First token < 300ms: ${firstTokenTime < 300 ? '🚀 EXCELLENT' : '⚠️  GOOD'}`);
  console.log(`Total response < 5s: ${totalTime < 5000 ? '✅ PASS' : '❌ FAIL'}`);
  
  // Test with conversation history
  console.log('\n🔄 Testing follow-up with history...');
  const followupStart = Date.now();
  
  const followupResponse = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': response.headers.get('set-cookie') || ''
    },
    body: JSON.stringify({
      avatarSlug: 'jonathan',
      message: 'What do you think about that?',
      fastMode: true
    })
  });

  if (followupResponse.body) {
    const followupReader = followupResponse.body.getReader();
    const { value } = await followupReader.read();
    const followupFirstToken = Date.now() - followupStart;
    
    console.log(`⚡ Follow-up first token: ${followupFirstToken}ms`);
    console.log(`With history < 400ms: ${followupFirstToken < 400 ? '✅ PASS' : '❌ FAIL'}`);
    
    followupReader.releaseLock();
  }
  
  console.log('\n🎭 Hybrid Mode Features:');
  console.log('- ⚡ Instant response start (fast prompt)');
  console.log('- 🧠 Enhanced personality (background processing)');
  console.log('- 🔄 Seamless transition between modes');
  console.log('- 💾 Full conversation memory');
  console.log('- 🎯 Best of both worlds');
}

testHybridMode().catch(console.error);