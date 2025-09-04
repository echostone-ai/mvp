#!/usr/bin/env node

/**
 * Test script for the unified EnhancedPromptBuilder fast mode
 * Tests the key scenarios mentioned in the requirements
 */

const BASE_URL = 'http://localhost:3000';

async function testFastMode() {
  console.log('🚀 Testing Unified Fast Mode System\n');

  const testCases = [
    {
      name: "Romeo Query (Pet Recognition)",
      prompt: "How's Romeo doing?",
      expectedFeatures: ["pet facts", "emotional tone", "real Romeo details"]
    },
    {
      name: "Spain Location Query", 
      prompt: "Have you lived in Spain?",
      expectedFeatures: ["Valencia mention", "location facts", "no hesitation"]
    },
    {
      name: "Story Request",
      prompt: "Tell me a story",
      expectedFeatures: ["real memory", "first person", "vivid details", "no fabrication"]
    },
    {
      name: "Simple Greeting",
      prompt: "Hi there!",
      expectedFeatures: ["fast response", "warm tone", "natural phrasing"]
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📝 Testing: ${testCase.name}`);
    console.log(`Query: "${testCase.prompt}"`);
    
    const startTime = Date.now();
    
    try {
      // Test both regular chat and fast reply endpoints
      const [chatResponse, fastResponse] = await Promise.all([
        fetch(`${BASE_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: testCase.prompt,
            avatarSlug: 'jonathan-demo',
            debug: true
          })
        }),
        fetch(`${BASE_URL}/api/reply-fast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: testCase.prompt,
            avatarSlug: 'jonathan-demo',
            debug: true
          })
        })
      ]);

      const chatData = await chatResponse.json();
      const fastData = await fastResponse.json();
      
      const totalTime = Date.now() - startTime;
      
      console.log(`⏱️  Total time: ${totalTime}ms`);
      
      if (chatData.debug) {
        console.log(`📊 Chat API - Processing: ${chatData.debug.metadata?.processing_time_ms || 'N/A'}ms`);
        console.log(`📊 Chat API - Facts: ${chatData.debug.metadata?.facts_count || 0}, Memories: ${chatData.debug.metadata?.memories_count || 0}`);
      }
      
      if (fastData.debug) {
        console.log(`⚡ Fast API - Processing: ${fastData.debug.enhanced_metadata?.processing_time_ms || 'N/A'}ms`);
        console.log(`⚡ Fast API - Facts: ${fastData.debug.enhanced_metadata?.facts_count || 0}, Memories: ${fastData.debug.enhanced_metadata?.memories_count || 0}`);
        console.log(`🤖 Model used: ${fastData.debug.model_used || 'N/A'}`);
      }
      
      console.log(`💬 Chat Response: ${chatData.text?.substring(0, 150) || 'No response'}...`);
      console.log(`⚡ Fast Response: ${fastData.text?.substring(0, 150) || 'No response'}...`);
      
      // Check for expected features
      const chatText = (chatData.text || '').toLowerCase();
      const fastText = (fastData.text || '').toLowerCase();
      
      console.log(`✅ Expected features check:`);
      for (const feature of testCase.expectedFeatures) {
        const featureLower = feature.toLowerCase();
        const chatHas = chatText.includes(featureLower.split(' ')[0]);
        const fastHas = fastText.includes(featureLower.split(' ')[0]);
        console.log(`   ${feature}: Chat=${chatHas ? '✓' : '✗'}, Fast=${fastHas ? '✓' : '✗'}`);
      }
      
    } catch (error) {
      console.error(`❌ Error testing ${testCase.name}:`, error.message);
    }
    
    console.log('─'.repeat(60));
  }

  // Test streaming performance
  console.log('\n🌊 Testing Streaming Performance');
  const streamStart = Date.now();
  
  try {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: "Tell me about your time in Valencia",
        avatarSlug: 'jonathan-demo'
      })
    });

    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedText = '';
      let firstTokenTime = null;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        if (chunk && !firstTokenTime) {
          firstTokenTime = Date.now() - streamStart;
        }
        streamedText += chunk;
      }
      
      const totalStreamTime = Date.now() - streamStart;
      console.log(`⏱️  First token: ${firstTokenTime}ms`);
      console.log(`⏱️  Total stream: ${totalStreamTime}ms`);
      console.log(`📝 Streamed length: ${streamedText.length} chars`);
      console.log(`💬 Sample: ${streamedText.substring(0, 100)}...`);
    }
  } catch (error) {
    console.error('❌ Streaming test failed:', error.message);
  }
}

// Run the tests
testFastMode().catch(console.error);