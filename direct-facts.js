#!/usr/bin/env node

/**
 * Directly insert facts into Supabase using the service client
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function insertFactsDirectly() {
  console.log('🔧 Inserting facts directly into Supabase...');
  
  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing environment variables:');
    console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
    console.error('SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✅ Set' : '❌ Missing');
    console.error('Make sure these are set in your .env.local file');
    process.exit(1);
  }

  // Create Supabase client
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  // The facts we want to insert
  const facts = {
    full_name: "Jonathan Braden",
    given_name: "Jonathan",
    home_city: "Vancouver Island", 
    home_country: "Canada",
    profession: "Writer",
    birth_year: "1980",
    personality: "Witty, quick, warm personality with playful sarcasm",
    pets: "Dog named Romeo",
    partner_name: "Krissy",
    places_lived: "Vancouver Island, Maine, Austin Texas, France"
  };

  // Your avatar ID from the database
  const avatarId = "0585f43b-4b49-4e16-b2a7-91c8e1e3850c";

  console.log('📝 Facts to insert:');
  Object.entries(facts).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });

  console.log(`\n🎯 Target avatar ID: ${avatarId}`);
  console.log('\n🚀 Starting database insertion...');

  // Prepare facts for insertion
  const factsToInsert = Object.entries(facts).map(([key, value]) => ({
    avatar_id: avatarId,
    key: key,
    value: value,
    confidence: 0.9,
    priority: key === 'full_name' ? 1 : key === 'given_name' ? 1 : 2,
    source: 'manual',
    source_reference: 'direct_script',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  let successCount = 0;
  let errorCount = 0;

  // Insert facts one by one for better error reporting
  for (const fact of factsToInsert) {
    try {
      const { data, error } = await supabase
        .from('quick_facts')
        .upsert([fact], {
          onConflict: 'avatar_id,key',
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        console.error(`❌ Failed to insert ${fact.key}:`, error.message);
        errorCount++;
      } else {
        console.log(`✅ Successfully inserted: ${fact.key} = ${fact.value}`);
        successCount++;
      }
    } catch (err) {
      console.error(`❌ Unexpected error inserting ${fact.key}:`, err.message);
      errorCount++;
    }
  }

  console.log(`\n📊 Results:`);
  console.log(`✅ Successfully inserted: ${successCount} facts`);
  console.log(`❌ Failed to insert: ${errorCount} facts`);

  if (successCount > 0) {
    console.log('\n🎉 Facts have been inserted! Jonathan should now know about:');
    console.log('- His name and profession');
    console.log('- Romeo the dog');
    console.log('- Krissy his partner');
    console.log('- His location and background');
    console.log('\n💬 Try asking Jonathan: "Who are you?" or "Tell me about Romeo"');
  }

  if (errorCount > 0) {
    console.log('\n⚠️  Some facts failed to insert. Check the errors above.');
  }
}

// Run the insertion
insertFactsDirectly().then(() => {
  console.log('\n🏁 Direct facts insertion complete');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Unexpected error:', error.message);
  process.exit(1);
});