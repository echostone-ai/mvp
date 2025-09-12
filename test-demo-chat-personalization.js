// Test the fully optimized demo-chat route with all ChatGPT enhancements
const fetch = require('node-fetch');

async function testOptimizedDemoChat() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('Testing fully optimized demo-chat route with all ChatGPT enhancements...\n');
  
  // Test 1: Brother query (should be high intimacy with optimized parameters)
  console.log('=== Test 1: Brother Query (High Intimacy + Optimization) ===');
  try {
    const response1 = await fetch(`${baseUrl}/api/demo-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: "Hey bro, tell me about Romeo and how he's doing",
        visitorId: "test-geoff-visitor",
        debug: true
      })
    });
    
    const result1 = await response1.json();
    console.log('Response:', result1.answer);
    console.log('Debug info:', result1.debug);
    console.log('Metadata:', result1.metadata);
  } catch (error) {
    console.error('Test 1 failed:', error.message);
  }
  
  console.log('\n=== Test 2: Emotional Query (Should detect sadness and adjust) ===');
  try {
    const response2 = await fetch(`${baseUrl}/api/demo-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: "I'm feeling really sad today, can you cheer me up?",
        visitorId: "test-friend-visitor",
        debug: true
      })
    });
    
    const result2 = await response2.json();
    console.log('Response:', result2.answer);
    console.log('Debug info:', result2.debug);
    console.log('Metadata:', result2.metadata);
  } catch (error) {
    console.error('Test 2 failed:', error.message);
  }
  
  console.log('\n=== Test 3: Excited Query (Should detect excitement and match energy) ===');
  try {
    const response3 = await fetch(`${baseUrl}/api/demo-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: "This is amazing! I just got the best news ever! Tell me something exciting about your travels!",
        visitorId: "test-friend-visitor",
        debug: true
      })
    });
    
    const result3 = await response3.json();
    console.log('Response:', result3.answer);
    console.log('Debug info:', result3.debug);
    console.log('Metadata:', result3.metadata);
  } catch (error) {
    console.error('Test 3 failed:', error.message);
  }
  
  console.log('\n=== Test 4: Complex Relationship Query (Should use semantic expansion) ===');
  try {
    const response4 = await fetch(`${baseUrl}/api/demo-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: "Tell me about your marriage and relationship history",
        visitorId: "test-friend-visitor",
        debug: true
      })
    });
    
    const result4 = await response4.json();
    console.log('Response:', result4.answer);
    console.log('Debug info:', result4.debug);
    console.log('Metadata:', result4.metadata);
  } catch (error) {
    console.error('Test 4 failed:', error.message);
  }
}

testOptimizedDemoChat().catch(console.error);