#!/usr/bin/env node

/**
 * Check what's actually in the database for Jonathan
 */

async function checkDatabase() {
  try {
    console.log('🔍 Checking database for Jonathan...');
    
    // Check if avatar exists
    const avatarResponse = await fetch('http://localhost:3000/api/avatars', {
      method: 'GET'
    });
    
    if (avatarResponse.ok) {
      const avatars = await avatarResponse.json();
      console.log('📋 Avatars found:', avatars.length);
      const jonathan = avatars.find(a => a.name === 'jonathan_braden' || a.slug === 'jonathan_braden');
      if (jonathan) {
        console.log('✅ Jonathan avatar found:', jonathan.id || jonathan.name);
      } else {
        console.log('❌ Jonathan avatar NOT found');
        console.log('Available avatars:', avatars.map(a => a.name || a.slug));
      }
    }

    // Try to get facts directly via a simple API call
    console.log('\n🔍 Testing fact retrieval...');
    const testResponse = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        avatar: 'jonathan_braden',
        message: 'tell me about romeo',
        debug: true
      })
    });

    if (testResponse.ok) {
      const result = await testResponse.json();
      console.log('💬 Chat response:', result.text?.substring(0, 200) + '...');
      if (result.debug) {
        console.log('🐛 Debug info:', result.debug);
      }
    } else {
      const errorText = await testResponse.text();
      console.log('❌ Chat test failed:', errorText);
    }

  } catch (error) {
    console.error('❌ Error checking database:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  checkDatabase();
}

module.exports = { checkDatabase };