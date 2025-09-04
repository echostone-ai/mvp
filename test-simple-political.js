#!/usr/bin/env node

/**
 * Simple Political Query Test
 * Tests basic functionality without complex streaming
 */

const http = require('http');

function makeRequest(message) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      message,
      avatar: 'jonathan-demo',
      debug: false
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

async function testPoliticalQueries() {
  console.log('🚀 Testing Political Query Implementation');
  
  const tests = [
    'What do you think of Trump?',
    'Why did you leave America?',
    'Do you like Trump?',
    'What is your favorite music?'
  ];

  for (const query of tests) {
    console.log(`\n📋 Testing: "${query}"`);
    
    try {
      const result = await makeRequest(query);
      console.log(`Status: ${result.statusCode}`);
      
      if (result.statusCode === 200) {
        console.log('✅ API responded successfully');
        
        // Check if it's streaming response
        if (result.headers['content-type']?.includes('text/event-stream')) {
          console.log('✅ Streaming response detected');
          
          // Look for political content indicators
          const bodyLower = result.body.toLowerCase();
          if (query.toLowerCase().includes('trump') || query.toLowerCase().includes('america')) {
            if (bodyLower.includes('trump') || bodyLower.includes('political') || bodyLower.includes('america')) {
              console.log('✅ Political content detected in response');
            } else {
              console.log('⚠️  No political content detected');
            }
          }
          
          // Look for deep merge indicators
          if (bodyLower.includes('deep_merge') || bodyLower.includes('deep_tokens_any')) {
            console.log('✅ Deep merge logging detected');
          }
          
        } else {
          console.log('⚠️  Non-streaming response');
        }
      } else {
        console.log(`❌ API error: ${result.statusCode}`);
        console.log(`Response: ${result.body.substring(0, 200)}`);
      }
      
    } catch (error) {
      console.log(`❌ Request failed: ${error.message}`);
    }
  }
  
  console.log('\n🎉 Political query testing complete!');
  console.log('\n📋 Manual verification needed:');
  console.log('1. Check server logs for deep_merge and bypass_prefs_applied logging');
  console.log('2. Verify political queries return relevant memories');
  console.log('3. Confirm preference bypass only applies to benign queries');
}

testPoliticalQueries().catch(console.error);