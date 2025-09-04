#!/usr/bin/env node

/**
 * Test Critical Blockers Fix
 * Tests pinned memories and voice streaming fixes
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

async function testPinnedMemories() {
  console.log('🔍 Testing Pinned Memories Fix...\n');
  
  const testQueries = [
    {
      query: "Where does your friend Tyler live?",
      intent: "people",
      expectedPinned: 3
    },
    {
      query: "Did you live in Austin?",
      intent: "travel", 
      expectedPinned: 3
    },
    {
      query: "Tell me about Olive.",
      intent: "pets",
      expectedPinned: 3
    }
  ];
  
  for (const testCase of testQueries) {
    console.log(`📝 Testing: "${testCase.query}"`);
    console.log(`   Expected intent: ${testCase.intent}, pinned: ${testCase.expectedPinned}`);
    
    try {
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
        console.log(`   ❌ HTTP ${response.status}: ${response.statusText}`);
        continue;
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let fullResponse = '';
      let pinnedMemoriesFound = false;
      let pinnedCount = 0;
      let deepMerged = false;
      
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
                
                if (data.channel === 'fast' || data.channel === 'deep') {
                  fullResponse += data.delta || '';
                }
                
                if (data.event === 'meta') {
                  pinnedCount = data.pinned_count || 0;
                }
                
                if (data.event === 'deep_merge_log') {
                  deepMerged = true;
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
      
      // Check if response contains specific content (not generic)
      const isSpecific = !fullResponse.includes("I'm thinking about that...") && 
                        !fullResponse.includes("I'm not sure yet—let me check my notes");
      
      console.log(`   📊 Pinned count: ${pinnedCount}, Deep merged: ${deepMerged}`);
      console.log(`   📝 Response: ${fullResponse.substring(0, 100)}...`);
      
      if (pinnedCount > 0 && isSpecific) {
        console.log(`   ✅ SUCCESS - Pinned memories working`);
      } else if (pinnedCount > 0) {
        console.log(`   ⚠️  PARTIAL - Pinned memories retrieved but response still generic`);
      } else {
        console.log(`   ❌ FAILED - No pinned memories retrieved`);
      }
      
    } catch (error) {
      console.log(`   💥 ERROR: ${error.message}`);
    }
    
    console.log('');
  }
}

async function testVoiceStreaming() {
  console.log('🎵 Testing Voice Streaming Fix...\n');
  
  try {
    const response = await fetch(`${API_BASE}/api/voice-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: "Hello, this is a test of the voice streaming system.",
        avatar: 'jonathan-demo',
        useEnhancedQuality: true
      })
    });
    
    console.log(`📊 Voice stream response: ${response.status} ${response.statusText}`);
    console.log(`📊 Content-Type: ${response.headers.get('Content-Type')}`);
    console.log(`📊 Voice-Fallback: ${response.headers.get('X-Voice-Fallback') || 'none'}`);
    
    if (response.ok) {
      const contentType = response.headers.get('Content-Type');
      if (contentType === 'audio/mpeg') {
        console.log('   ✅ SUCCESS - Voice streaming working (audio returned)');
      } else if (contentType === 'application/json') {
        const result = await response.json();
        if (result.fallback) {
          console.log('   ⚠️  GRACEFUL DEGRADATION - TTS unavailable, text fallback provided');
          console.log(`   📝 Fallback text: ${result.text.substring(0, 50)}...`);
        } else {
          console.log('   ❌ UNEXPECTED JSON response');
        }
      } else {
        console.log('   ❌ UNEXPECTED content type');
      }
    } else {
      console.log('   ❌ FAILED - Voice streaming returned error');
    }
    
  } catch (error) {
    console.log(`   💥 ERROR: ${error.message}`);
  }
}

async function runTests() {
  console.log('🚀 Testing Critical Blockers Fixes\n');
  console.log('='.repeat(60));
  
  await testPinnedMemories();
  
  console.log('='.repeat(60));
  
  await testVoiceStreaming();
  
  console.log('='.repeat(60));
  console.log('✅ Critical blockers test completed');
}

// Run the tests
if (require.main === module) {
  runTests()
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testPinnedMemories, testVoiceStreaming };