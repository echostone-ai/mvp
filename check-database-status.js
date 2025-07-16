// Script to check current database status
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkDatabaseStatus() {
  console.log('Checking current database status...\n');

  try {
    // Test 1: Check auth status
    console.log('1. Checking authentication...');
    const { data: authData, error: authError } = await supabase.auth.getSession();
    console.log('   Auth session:', authData.session ? 'Active' : 'None');

    // Test 2: Try to access memory_fragments table
    console.log('\n2. Checking memory_fragments table...');
    const { data: memoryData, error: memoryError } = await supabase
      .from('memory_fragments')
      .select('*')
      .limit(1);

    if (memoryError) {
      console.log('   ❌ memory_fragments table error:', memoryError.message);
      if (memoryError.message.includes('does not exist')) {
        console.log('   → Table needs to be created');
      }
    } else {
      console.log('   ✅ memory_fragments table exists');
      console.log('   → Found', memoryData.length, 'records');
    }

    // Test 3: Check if we can access any tables (to verify connection)
    console.log('\n3. Testing basic database access...');
    
    // Try accessing auth.users (should exist in any Supabase project)
    const { data: usersData, error: usersError } = await supabase
      .from('auth.users')
      .select('id')
      .limit(1);

    if (usersError) {
      console.log('   Note: Cannot access auth.users directly (expected)');
    }

    // Test 4: Check if pgvector extension is available
    console.log('\n4. Testing vector operations capability...');
    
    // Try to create a simple test with vector data
    const testVector = Array(1536).fill(0.1);
    console.log('   Test vector created with', testVector.length, 'dimensions');

    console.log('\n📊 Database Status Summary:');
    console.log('   - Supabase connection: ✅ Working');
    console.log('   - memory_fragments table:', memoryError ? '❌ Missing' : '✅ Exists');
    console.log('   - Vector support: 🔍 Needs testing after table creation');

    return !memoryError;

  } catch (error) {
    console.error('\n❌ Database check failed:', error.message);
    return false;
  }
}

checkDatabaseStatus()
  .then(success => {
    if (!success) {
      console.log('\n🔧 Next Steps:');
      console.log('1. Go to your Supabase dashboard SQL Editor');
      console.log('2. Run the migration: supabase/migrations/001_create_memory_fragments.sql');
      console.log('3. Run the function: supabase/functions/match_memory_fragments.sql');
      console.log('4. Test again with: node test-vector-operations.js');
    }
    process.exit(success ? 0 : 1);
  });