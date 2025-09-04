#!/usr/bin/env node

/**
 * Test story upload functionality
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '../.env.local') });

console.log('🧪 Testing Story Upload Functionality...\n');

// Test API endpoint
async function testStoryAPI() {
  try {
    const DEMO_SYSTEM_USER_ID = process.env.DEMO_SYSTEM_USER_ID;
    const avatarId = 'jonathan-demo';
    
    console.log('📡 Testing GET /api/stories...');
    
    const url = `http://localhost:3000/api/stories?avatarId=${avatarId}&userId=${DEMO_SYSTEM_USER_ID}&ownerType=avatar`;
    console.log('Request URL:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('✅ API endpoint working correctly');
      console.log(`📊 Found ${data.stories?.length || 0} existing stories`);
    } else {
      console.log('❌ API endpoint error:', data.error);
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
  await testStoryAPI();
}

main().catch(console.error);