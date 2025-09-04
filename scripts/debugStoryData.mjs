#!/usr/bin/env node

/**
 * Debug story data structure
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '../.env.local') });

console.log('🔍 Debugging Story Data Structure...\n');

async function debugStoryData() {
  try {
    const DEMO_SYSTEM_USER_ID = process.env.DEMO_SYSTEM_USER_ID;
    const avatarId = 'jonathan-demo';
    
    console.log('📡 Getting stories from API...');
    
    const url = `http://localhost:3000/api/stories?avatarId=${avatarId}&userId=${DEMO_SYSTEM_USER_ID}&ownerType=avatar`;
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('✅ Stories response:', JSON.stringify(data, null, 2));
    
    if (data.success && data.stories && data.stories.length > 0) {
      const story = data.stories[0];
      console.log('\n📋 First story details:');
      console.log('- ID:', story.id);
      console.log('- Title:', story.title);
      console.log('- Triggers:', story.triggers);
      console.log('- Triggers type:', typeof story.triggers);
      console.log('- Audio URL:', story.audio_url);
      console.log('- Duration:', story.duration_ms);
      
      // Test trigger parsing
      console.log('\n🧪 Testing trigger parsing...');
      if (typeof story.triggers === 'string') {
        const triggerArray = story.triggers.split(',').map(t => t.trim().toLowerCase());
        console.log('- Parsed triggers:', triggerArray);
        
        // Test matching
        const testKeywords = ['sofia', 'bulgaria', 'tell', 'about'];
        console.log('- Test keywords:', testKeywords);
        
        const matches = triggerArray.filter(trigger => 
          testKeywords.some(keyword => keyword.includes(trigger) || trigger.includes(keyword))
        );
        console.log('- Matches found:', matches);
      }
    } else {
      console.log('❌ No stories found or API error');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

async function main() {
  await debugStoryData();
}

main().catch(console.error);