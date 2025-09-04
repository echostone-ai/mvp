#!/usr/bin/env node

/**
 * Test story trigger matching
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '../.env.local') });

console.log('🧪 Testing Story Trigger Matching...\n');

async function testStoryTrigger() {
  try {
    const DEMO_SYSTEM_USER_ID = process.env.DEMO_SYSTEM_USER_ID;
    const avatarId = 'jonathan-demo';
    
    // Test messages that should trigger the Sofia story
    const testMessages = [
      "Tell me about Sofia",
      "What's it like living in Sofia?",
      "How was your move to Bulgaria?",
      "Tell me about sofia",
      "SOFIA",
      "bulgaria"
    ];
    
    console.log('📡 Testing story trigger API...\n');
    
    for (const message of testMessages) {
      console.log(`Testing message: "${message}"`);
      
      try {
        const response = await fetch('http://localhost:3000/api/stories/trigger-test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message,
            avatarId,
            userId: DEMO_SYSTEM_USER_ID
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Response:', data);
        } else {
          console.log('❌ Error:', response.status, response.statusText);
        }
      } catch (error) {
        console.log('❌ Request failed:', error.message);
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Check if dev server is running
async function checkDevServer() {
  try {
    const response = await fetch('http://localhost:3000/api/health');
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  const isServerRunning = await checkDevServer();
  
  if (!isServerRunning) {
    console.log('⚠️  Dev server not running. Please start it with: npm run dev');
    console.log('   Then run this test again.');
    return;
  }
  
  console.log('✅ Dev server is running');
  await testStoryTrigger();
}

main().catch(console.error);