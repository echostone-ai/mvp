const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAvatarSecurity() {
  try {
    console.log('🔍 Testing avatar security...');
    
    // Get all avatars without user filtering
    const { data: allAvatars, error } = await supabase
      .from('avatar_profiles')
      .select('*');
      
    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }
    
    console.log(`📊 Total avatars in database: ${allAvatars.length}`);
    
    if (allAvatars.length > 0) {
      console.log('📋 First avatar columns:', Object.keys(allAvatars[0]));
      
      const hasUserId = 'user_id' in allAvatars[0];
      console.log(`🔐 Has user_id column: ${hasUserId}`);
      
      if (!hasUserId) {
        console.log('\n🚨 CRITICAL SECURITY VULNERABILITY CONFIRMED!');
        console.log('❌ The avatar_profiles table is missing the user_id column');
        console.log('❌ This allows all users to see all avatars');
        console.log('\n🔧 IMMEDIATE ACTION REQUIRED:');
        console.log('1. Go to your Supabase Dashboard > SQL Editor');
        console.log('2. Run this SQL command:');
        console.log('   ALTER TABLE avatar_profiles ADD COLUMN user_id UUID REFERENCES auth.users(id);');
        console.log('3. Then update existing avatars to assign them to users');
      } else {
        console.log('✅ user_id column exists');
        // Show user_id values
        allAvatars.forEach((avatar, i) => {
          console.log(`Avatar ${i + 1}: ${avatar.name} - user_id: ${avatar.user_id || 'NULL'}`);
        });
      }
    }
    
  } catch (err) {
    console.error('❌ Script error:', err.message);
  }
  
  process.exit(0);
}

testAvatarSecurity();