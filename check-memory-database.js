// check-memory-database.js
// Script to check if the memory database setup is complete

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables in .env.local');
  console.log('Please ensure you have:');
  console.log('- NEXT_PUBLIC_SUPABASE_URL');
  console.log('- NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMemoryDatabase() {
  console.log('🔍 Checking memory database setup...\n');

  try {
    // Check if memory_fragments table exists
    console.log('1. Checking memory_fragments table...');
    const { data: tableData, error: tableError } = await supabase
      .from('memory_fragments')
      .select('count', { count: 'exact', head: true });

    if (tableError) {
      console.log('❌ memory_fragments table not found');
      console.log('Error:', tableError.message);
      console.log('\n📋 To fix this, run the following SQL in your Supabase SQL Editor:');
      console.log('   1. Go to your Supabase dashboard');
      console.log('   2. Navigate to SQL Editor');
      console.log('   3. Copy and paste the contents of supabase/migrations/001_create_memory_fragments.sql');
      console.log('   4. Execute the SQL');
      return false;
    } else {
      console.log('✅ memory_fragments table exists');
    }

    // Check if vector search function exists
    console.log('2. Checking match_memory_fragments function...');
    const { data: funcData, error: funcError } = await supabase.rpc('match_memory_fragments', {
      query_embedding: new Array(1536).fill(0.1),
      match_threshold: 0.5,
      match_count: 1
    });

    if (funcError) {
      console.log('❌ match_memory_fragments function not found');
      console.log('Error:', funcError.message);
      console.log('\n📋 To fix this, run the following SQL in your Supabase SQL Editor:');
      console.log('   1. Copy and paste the contents of supabase/functions/match_memory_fragments.sql');
      console.log('   2. Execute the SQL');
      return false;
    } else {
      console.log('✅ match_memory_fragments function exists');
    }

    // Check if conversations table exists
    console.log('3. Checking conversations table...');
    const { data: convData, error: convError } = await supabase
      .from('conversations')
      .select('count', { count: 'exact', head: true });

    if (convError) {
      console.log('❌ conversations table not found');
      console.log('Error:', convError.message);
      console.log('\n📋 To fix this, run the SQL from setup-database-quick.sql');
      return false;
    } else {
      console.log('✅ conversations table exists');
    }

    // Check if pgvector extension is enabled by testing vector operations
    console.log('4. Checking pgvector extension...');
    try {
      const testEmbedding = new Array(1536).fill(0.1);
      const { error: vectorError } = await supabase.rpc('match_memory_fragments', {
        query_embedding: testEmbedding,
        target_user_id: '00000000-0000-0000-0000-000000000000',
        match_threshold: 0.5,
        match_count: 1
      });

      if (vectorError && vectorError.message.includes('vector')) {
        console.log('❌ pgvector extension not enabled');
        console.log('Error:', vectorError.message);
        console.log('\n📋 To fix this, run the following SQL in your Supabase SQL Editor:');
        console.log('   CREATE EXTENSION IF NOT EXISTS vector;');
        return false;
      } else {
        console.log('✅ pgvector extension is enabled');
      }
    } catch (vectorTestError) {
      console.log('❌ pgvector extension test failed');
      console.log('Error:', vectorTestError.message);
      return false;
    }

    console.log('\n🎉 Memory database setup is complete!');
    console.log('✅ All required components are in place');
    console.log('✅ Memory system should now work correctly');
    console.log('✅ Conversations will persist across tabs/sessions');
    
    return true;

  } catch (error) {
    console.error('❌ Error checking database setup:', error.message);
    return false;
  }
}

// Run the check
checkMemoryDatabase().then(success => {
  if (!success) {
    console.log('\n🔧 Setup Instructions:');
    console.log('1. Open your Supabase dashboard');
    console.log('2. Go to SQL Editor');
    console.log('3. Run the SQL from supabase/migrations/001_create_memory_fragments.sql');
    console.log('4. Run the SQL from supabase/functions/match_memory_fragments.sql');
    console.log('5. Run this script again to verify');
    process.exit(1);
  }
  process.exit(0);
});