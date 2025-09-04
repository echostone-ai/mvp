#!/usr/bin/env node

/**
 * Check if database tables exist
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTables() {
  console.log('🔍 Checking database tables...\n');
  
  try {
    // Check if user_stories table exists
    console.log('📋 Checking user_stories table...');
    const { data: storiesData, error: storiesError } = await supabase
      .from('user_stories')
      .select('count')
      .limit(1);
    
    if (storiesError) {
      console.log('❌ user_stories table does not exist');
      console.log('   Error:', storiesError.message);
      console.log('   👉 You need to run the database migration!');
    } else {
      console.log('✅ user_stories table exists');
    }
    
    // Check if story_usage_analytics table exists
    console.log('📊 Checking story_usage_analytics table...');
    const { data: analyticsData, error: analyticsError } = await supabase
      .from('story_usage_analytics')
      .select('count')
      .limit(1);
    
    if (analyticsError) {
      console.log('❌ story_usage_analytics table does not exist');
      console.log('   Error:', analyticsError.message);
    } else {
      console.log('✅ story_usage_analytics table exists');
    }
    
    // Check storage bucket
    console.log('💾 Checking storage bucket...');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      console.log('❌ Error checking storage buckets:', bucketError.message);
    } else {
      const storyBucket = buckets.find(b => b.name === 'story-audio-files');
      if (storyBucket) {
        console.log('✅ story-audio-files bucket exists');
      } else {
        console.log('❌ story-audio-files bucket does not exist');
        console.log('   👉 You need to create the storage bucket!');
      }
    }
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  }
}

console.log('🗄️  Database Setup Check\n');
console.log('Supabase URL:', supabaseUrl);
console.log('Service Key:', supabaseServiceKey ? '[CONFIGURED]' : '[MISSING]');
console.log('');

checkTables().catch(console.error);