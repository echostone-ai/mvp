#!/usr/bin/env node

/**
 * Debug Identity Resolution for jonathan-demo
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function debugIdentityResolution() {
  console.log('🔍 DEBUGGING IDENTITY RESOLUTION FOR jonathan-demo\n');
  
  console.log('Environment variables:');
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30)}...`);
  console.log('');
  
  // Test the hardcoded check
  const avatarSlug = 'jonathan-demo';
  const expectedUUID = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
  
  console.log('1. Testing hardcoded check logic:');
  const isDev = process.env.NODE_ENV === 'development';
  const isTest = process.env.NODE_ENV === 'test';
  console.log(`   avatarSlug === 'jonathan-demo': ${avatarSlug === 'jonathan-demo'}`);
  console.log(`   NODE_ENV === 'development': ${isDev}`);
  console.log(`   NODE_ENV === 'test': ${isTest}`);
  console.log(`   Should use hardcoded UUID: ${avatarSlug === 'jonathan-demo' && (isDev || isTest)}`);
  console.log('');
  
  // Check avatar_profiles table
  console.log('2. Checking avatar_profiles table:');
  const { data: profileData, error: profileError } = await supabase
    .from('avatar_profiles')
    .select('id, name')
    .eq('name', 'jonathan-demo');
    
  if (profileError) {
    console.log(`   ❌ Error: ${profileError.message}`);
  } else {
    console.log(`   📊 Found ${profileData.length} profiles with name 'jonathan-demo'`);
    profileData.forEach(profile => {
      console.log(`      - ID: ${profile.id}, Name: ${profile.name}`);
    });
  }
  console.log('');
  
  // Check avatars table
  console.log('3. Checking avatars table:');
  const { data: avatarData, error: avatarError } = await supabase
    .from('avatars')
    .select('id, slug, name')
    .eq('slug', 'jonathan-demo');
    
  if (avatarError) {
    console.log(`   ❌ Error: ${avatarError.message}`);
  } else {
    console.log(`   📊 Found ${avatarData.length} avatars with slug 'jonathan-demo'`);
    avatarData.forEach(avatar => {
      console.log(`      - ID: ${avatar.id}, Slug: ${avatar.slug}, Name: ${avatar.name}`);
    });
  }
  console.log('');
  
  // Check if the expected UUID exists
  console.log('4. Checking if expected UUID exists in database:');
  const { data: uuidCheck, error: uuidError } = await supabase
    .from('avatar_profiles')
    .select('id, name')
    .eq('id', expectedUUID);
    
  if (uuidError) {
    console.log(`   ❌ Error: ${uuidError.message}`);
  } else {
    console.log(`   📊 Found ${uuidCheck.length} profiles with UUID ${expectedUUID}`);
    uuidCheck.forEach(profile => {
      console.log(`      - ID: ${profile.id}, Name: ${profile.name}`);
    });
  }
  console.log('');
  
  // Test the actual resolveAvatarId function
  console.log('5. Testing resolveAvatarId function:');
  try {
    const { resolveAvatarId } = require('./src/lib/services/identity.ts');
    
    const resolvedId = await resolveAvatarId(
      { avatarSlug: 'jonathan-demo' },
      supabase
    );
    
    console.log(`   ✅ Resolved ID: ${resolvedId}`);
    console.log(`   ✅ Matches expected: ${resolvedId === expectedUUID}`);
  } catch (error) {
    console.log(`   ❌ Resolution failed: ${error.message}`);
  }
}

debugIdentityResolution().catch(console.error);