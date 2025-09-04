#!/usr/bin/env node

/**
 * Debug script to check if Jonathan avatar exists and has facts
 */

async function debugJonathan() {
  try {
    console.log('🔍 Debugging Jonathan avatar...');
    
    // Check if avatar exists and has facts
    const debugResponse = await fetch('http://localhost:3000/api/debug/jd?avatarSlug=jonathan_braden', {
      method: 'GET',
      headers: {
        'DEBUG_SECRET': process.env.DEBUG_SECRET || 'your_debug_secret_here'
      }
    });

    if (!debugResponse.ok) {
      const errorText = await debugResponse.text();
      console.error('❌ Debug endpoint failed:', errorText);
      
      if (debugResponse.status === 401) {
        console.log('💡 Make sure DEBUG_SECRET is set in your .env.local file');
      }
      return;
    }

    const debugResult = await debugResponse.json();
    console.log('📊 Debug Results:');
    console.log('Avatar ID:', debugResult.avatar_id);
    console.log('Quick Facts Count:', debugResult.quick_facts_count);
    console.log('Sample Keys:', debugResult.sample_keys);
    console.log('Memory Count (24h):', debugResult.mem_count_last_24h);
    console.log('Last 3 Memories:', debugResult.last_3_mems);

    if (debugResult.quick_facts_count === 0) {
      console.log('⚠️  No facts found! Avatar needs to be seeded.');
    } else if (debugResult.quick_facts_count < 8) {
      console.log('⚠️  Only', debugResult.quick_facts_count, 'facts found. Expected at least 8-12.');
    } else {
      console.log('✅ Avatar has sufficient facts!');
    }

  } catch (error) {
    console.error('❌ Error debugging avatar:', error.message);
    
    if (error.message.includes('fetch failed')) {
      console.log('💡 Make sure the Next.js app is running at http://localhost:3000');
    }
  }
}

// Run if called directly
if (require.main === module) {
  debugJonathan();
}

module.exports = { debugJonathan };