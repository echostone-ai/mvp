#!/usr/bin/env node

/**
 * Simple seeding script that actually inserts data into Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function seedJonathan() {
  console.log('🌱 Starting direct Supabase seed for Jonathan...');
  
  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing environment variables:');
    console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
    console.error('SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✅ Set' : '❌ Missing');
    process.exit(1);
  }

  // Create Supabase client
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  console.log('🔗 Connected to Supabase');

  // Avatar ID and facts
  const avatarId = "0585f43b-4b49-4e16-b2a7-91c8e1e3850c";
  const facts = {
    full_name: "Jonathan Braden",
    given_name: "Jonathan", 
    home_city: "Vancouver Island",
    home_country: "Canada",
    profession: "Writer",
    birth_year: "1980",
    personality: "Witty, quick, warm personality with playful sarcasm",
    pets: "Dog named Romeo",
    partner_name: "Krissy"
  };

  console.log(`🎯 Inserting facts for avatar: ${avatarId}`);

  // Prepare facts for bulk insert
  const factsToInsert = Object.entries(facts).map(([key, value]) => ({
    avatar_id: avatarId,
    key: key,
    value: value,
    confidence: 0.9,
    priority: key === 'full_name' || key === 'given_name' ? 1 : 2,
    source: 'manual',
    source_reference: 'simple_seed_script',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  try {
    // Bulk upsert all facts
    const { data, error } = await supabase
      .from('quick_facts')
      .upsert(factsToInsert, {
        onConflict: 'avatar_id,key',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error('❌ Database error:', error.message);
      console.error('Error details:', error);
      process.exit(1);
    }

    console.log(`✅ Successfully inserted ${data?.length || factsToInsert.length} facts!`);
    
    console.log('\n📝 Inserted facts:');
    factsToInsert.forEach(fact => {
      console.log(`  ${fact.key}: ${fact.value}`);
    });

    console.log('\n🎉 Jonathan should now know about:');
    console.log('- His name and profession');
    console.log('- Romeo the dog');
    console.log('- Krissy his partner');
    console.log('- His location and background');
    
    console.log('\n💬 Try asking Jonathan:');
    console.log('- "Who are you?"');
    console.log('- "Tell me about Romeo"');
    console.log('- "How\'s your dog?"');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

// Run immediately
seedJonathan().then(() => {
  console.log('\n🏁 Seeding complete!');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Unexpected error:', error.message);
  process.exit(1);
});