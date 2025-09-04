#!/usr/bin/env node

/**
 * Test script for improved demo mode with hybrid streaming
 * Should now have fast response + accurate personality data
 */

const BASE_URL = 'http://localhost:3000';

async function testImprovedDemo() {
  console.log('🚀 Testing Improved Demo Mode (Hybrid + Accurate Data)\n');

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
      message: 'Hi Jonathan, how are you doing? Tell me about where you live now.',
      fastMode: true
    })
  });

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  console.log('📡 Demo response (should be fast + accurate):');
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
  console.log('📊 Improved Demo Performance:');
  console.log(`⚡ First token: ${firstTokenTime}ms`);
  console.log(`🏁 Total time: ${totalTime}ms`);
  console.log(`📝 Response length: ${responseText.length} chars`);
  
  console.log('\n🔍 Accuracy Check:');
  const lowerResponse = responseText.toLowerCase();
  
  // Check for outdated Vancouver Island reference
  const hasVancouverIsland = lowerResponse.includes('vancouver island');
  const hasCurrentLocation = lowerResponse.includes('spain') || lowerResponse.includes('valencia') || lowerResponse.includes('maine');
  
  console.log(`❌ Mentions Vancouver Island: ${hasVancouverIsland ? '⚠️  OUTDATED' : '✅ GOOD'}`);
  console.log(`✅ Mentions current/accurate location: ${hasCurrentLocation ? '✅ GOOD' : '❌ MISSING'}`);
  
  console.log('\n🎯 Performance Targets:');
  console.log(`First token < 500ms: ${firstTokenTime < 500 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`First token < 300ms: ${firstTokenTime < 300 ? '🚀 EXCELLENT' : '⚠️  GOOD'}`);
  console.log(`Accurate information: ${!hasVancouverIsland && hasCurrentLocation ? '✅ PASS' : '❌ FAIL'}`);
  
  // Test follow-up to check memory isolation
  console.log('\n🔄 Testing demo memory isolation...');
  const followupStart = Date.now();
  
  const followupResponse = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': response.headers.get('set-cookie') || ''
    },
    body: JSON.stringify({
      avatarSlug: 'jonathan-demo',
      message: 'What did I just ask you about?',
      fastMode: true
    })
  });

  if (followupResponse.body) {
    const followupReader = followupResponse.body.getReader();
    let followupText = '';
    
    try {
      while (true) {
        const { done, value } = await followupReader.read();
        if (done) break;
        followupText += decoder.decode(value);
      }
    } catch (e) {
      console.warn('Follow-up read error:', e);
    } finally {
      followupReader.releaseLock();
    }
    
    const followupFirstToken = Date.now() - followupStart;
    const remembersContext = followupText.toLowerCase().includes('where') || 
                           followupText.toLowerCase().includes('live') || 
                           followupText.toLowerCase().includes('location');
    
    console.log(`⚡ Follow-up first token: ${followupFirstToken}ms`);
    console.log(`🧠 Remembers context: ${remembersContext ? '✅ GOOD' : '❌ MISSING'}`);
  }
  
  console.log('\n✅ Expected Improvements:');
  console.log('- 🚀 Fast first token (< 300ms)');
  console.log('- 🎯 Accurate personality data from database');
  console.log('- 🧠 Proper memory isolation for demo');
  console.log('- 🔄 Enhanced personality in continuation');
  console.log('- 💾 Conversation memory within session');
  
  console.log('\n🔧 Technical Changes:');
  console.log('- ✅ Demo mode now uses hybrid streaming');
  console.log('- ✅ Accesses real EnhancedPromptBuilder');
  console.log('- ✅ Proper demo memory filtering');
  console.log('- ✅ Fast start + rich enhancement');
}

testImprovedDemo().catch(console.error);