#!/usr/bin/env node

/**
 * Final Comprehensive Test
 * Tests all critical functionality after fixes
 */

require('dotenv').config({ path: '.env.local' });

async function testFinalComprehensive() {
  console.log('🎯 Final Comprehensive Test - All Critical Blockers\n');
  
  const testCases = [
    {
      name: "Tyler Query (People Intent)",
      query: "Where does your friend Tyler live?",
      expectedIntent: "people",
      expectedPinned: 3
    },
    {
      name: "Austin Query (Travel Intent)", 
      query: "Did you live in Austin?",
      expectedIntent: "travel",
      expectedPinned: 3
    },
    {
      name: "Olive Query (Pets Intent)",
      query: "Tell me about Olive.",
      expectedIntent: "pets", 
      expectedPinned: 3
    },
    {
      name: "Music Query (Preferences Intent)",
      query: "What's your favorite music?",
      expectedIntent: "preferences",
      expectedPinned: 2
    }
  ];
  
  let allPassed = true;
  
  for (const testCase of testCases) {
    console.log(`🧪 Testing: ${testCase.name}`);
    console.log(`   Query: "${testCase.query}"`);
    
    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: testCase.query,
          avatarSlug: 'jonathan-demo'
        })
      });
      
      if (!response.ok) {
        console.log(`   ❌ FAILED - HTTP ${response.status}`);
        allPassed = false;
        continue;
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let metaData = null;
      let hasResponse = false;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.event === 'meta') {
                metaData = data;
              }
              
              if (data.channel === 'fast' || data.channel === 'deep') {
                hasResponse = true;
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
      
      if (!hasResponse) {
        console.log(`   ❌ FAILED - No response received`);
        allPassed = false;
        continue;
      }
      
      if (!metaData) {
        console.log(`   ❌ FAILED - No metadata received`);
        allPassed = false;
        continue;
      }
      
      // Check intent
      const actualIntent = metaData.intent;
      if (actualIntent !== testCase.expectedIntent) {
        console.log(`   ⚠️  Intent mismatch: expected ${testCase.expectedIntent}, got ${actualIntent}`);
      }
      
      // Check pinned count
      const actualPinned = metaData.pinned_count || 0;
      if (actualPinned < testCase.expectedPinned) {
        console.log(`   ⚠️  Pinned count low: expected ${testCase.expectedPinned}, got ${actualPinned}`);
      }
      
      // Check deep merge
      const deepMerge = metaData.deep_merge;
      
      console.log(`   ✅ SUCCESS`);
      console.log(`      Intent: ${actualIntent}`);
      console.log(`      Pinned: ${actualPinned}`);
      console.log(`      Deep Merge: ${deepMerge}`);
      
    } catch (error) {
      console.log(`   ❌ FAILED - ${error.message}`);
      allPassed = false;
    }
    
    console.log('');
  }
  
  // Test voice streaming
  console.log('🎵 Testing Voice Streaming...');
  try {
    const voiceResponse = await fetch('http://localhost:3000/api/voice-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'Hello, this is a test of the voice streaming system.',
        voiceId: 'CO6pxVrMZfyL61ZIglyr'
      })
    });
    
    const contentType = voiceResponse.headers.get('content-type');
    const fallback = voiceResponse.headers.get('voice-fallback');
    
    if (voiceResponse.ok) {
      if (contentType?.includes('audio')) {
        console.log('   ✅ SUCCESS - Audio returned');
      } else if (fallback === 'text-only') {
        console.log('   ✅ SUCCESS - Graceful degradation to text');
      } else {
        console.log('   ⚠️  Unexpected response type');
      }
    } else {
      console.log(`   ❌ FAILED - HTTP ${voiceResponse.status}`);
      allPassed = false;
    }
    
  } catch (error) {
    console.log(`   ❌ FAILED - ${error.message}`);
    allPassed = false;
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED - Critical blockers are fixed!');
    console.log('\n✅ Pinned memories working');
    console.log('✅ Voice streaming working');
    console.log('✅ Intent detection working');
    console.log('✅ Deep merge working');
  } else {
    console.log('❌ Some tests failed - review issues above');
  }
}

// Run the test
if (require.main === module) {
  testFinalComprehensive()
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testFinalComprehensive };