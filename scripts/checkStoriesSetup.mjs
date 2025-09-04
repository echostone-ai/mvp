#!/usr/bin/env node

/**
 * Quick setup check for Authentic Voice Stories
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '../.env.local') });

console.log('🔍 Checking Authentic Voice Stories Setup...\n');

// Check environment variables
const requiredEnvVars = {
  'NEXT_PUBLIC_SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL,
  'NEXT_PUBLIC_SUPABASE_ANON_KEY': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
  'STORIES_ENABLED': process.env.STORIES_ENABLED,
  'STORY_CDN_URL': process.env.STORY_CDN_URL,
  'DEMO_SYSTEM_USER_ID': process.env.DEMO_SYSTEM_USER_ID
};

console.log('📋 Environment Variables:');
let allEnvVarsSet = true;

for (const [key, value] of Object.entries(requiredEnvVars)) {
  const status = value ? '✅' : '❌';
  const displayValue = value ? (key.includes('KEY') ? '[HIDDEN]' : value) : 'NOT SET';
  console.log(`  ${status} ${key}: ${displayValue}`);
  
  if (!value) {
    allEnvVarsSet = false;
  }
}

console.log('\n🗄️  Database Setup:');
console.log('  📝 Migration file: supabase/migrations/025_create_user_stories_tables.sql');
console.log('  ⚠️  Run this migration in your Supabase SQL editor');

console.log('\n💾 Storage Setup:');
console.log('  📁 Bucket name: story-audio-files');
console.log('  🌐 CDN URL:', process.env.STORY_CDN_URL || 'NOT SET');
console.log('  ⚠️  Create this bucket in Supabase Storage');

console.log('\n🎭 Demo Configuration:');
console.log('  👤 Demo User ID:', process.env.DEMO_SYSTEM_USER_ID || 'NOT SET');
console.log('  🤖 Demo Avatar: jonathan-demo');
console.log('  📍 Stories Page: http://localhost:3000/stories');

console.log('\n📊 Setup Status:');
if (allEnvVarsSet) {
  console.log('  ✅ Environment variables configured');
} else {
  console.log('  ❌ Missing environment variables');
}

console.log('\n🚀 Next Steps:');
console.log('  1. Create Supabase Storage bucket: story-audio-files');
console.log('  2. Run database migration in Supabase SQL editor');
console.log('  3. Visit http://localhost:3000/stories to test');
console.log('  4. Upload a test MP3 file (30s-5min duration)');

console.log('\n✨ Setup check complete!');