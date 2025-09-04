#!/usr/bin/env node

/**
 * Test just the fast lane without deep lane to isolate issues
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

async function testFastLaneOnly() {
  console.log('🚀 Testing Fast Lane Only\n');
  
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: "Hello, how are you?",
        avatar: 'jonathan-demo'
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let fullResponse = '';
    let eventCount = 0;
    
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
              eventCount++;
              
              if (data.channel === 'fast') {
                fullResponse += data.delta || '';
                console.log(`📝 Fast: ${data.delta || ''}`);
              } else if (data.channel === 'deep') {
                console.log(`🔍 Deep: ${data.delta || ''}`);
              } else if (data.event) {
                console.log(`📊 Event: ${data.event}`, data);
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
    
    console.log('\n' + '='.repeat(50));
    console.log(`✅ Fast lane test completed`);
    console.log(`📊 Events received: ${eventCount}`);
    console.log(`📝 Full response: ${fullResponse}`);
    console.log('='.repeat(50));
    
    return fullResponse.length > 0;
    
  } catch (error) {
    console.error('❌ Fast lane test failed:', error.message);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testFastLaneOnly()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testFastLaneOnly };