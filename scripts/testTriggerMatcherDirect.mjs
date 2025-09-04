#!/usr/bin/env node

/**
 * Test trigger matcher directly
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '../.env.local') });

console.log('🧪 Testing Trigger Matcher Directly...\n');

async function testTriggerMatcherDirect() {
  try {
    console.log('📡 Testing direct trigger matcher API...\n');
    
    const response = await fetch('http://localhost:3000/api/stories/trigger-matcher-test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: "Tell me about Sofia",
        avatarId: 'jonathan-demo'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Response:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Error:', response.status, response.statusText);
      const errorData = await response.text();
      console.log('Error details:', errorData);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function main() {
  await testTriggerMatcherDirect();
}

main().catch(console.error);