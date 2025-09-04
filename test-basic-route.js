#!/usr/bin/env node

/**
 * Basic route test to check if the API is working
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

async function testBasicRoute() {
  console.log('🔍 Testing basic route functionality...\n');
  
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: "Hello",
        avatar: 'jonathan-demo',
        debug: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('✅ Debug response:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Basic route test failed:', error.message);
    return false;
  }
  
  return true;
}

// Run the test
if (require.main === module) {
  testBasicRoute()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testBasicRoute };