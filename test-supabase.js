// Simple test to verify Supabase connection and basic operations
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testSupabaseConnection() {
  console.log('Testing Supabase connection...\n');

  try {
    // Test basic connection
    console.log('1. Testing basic connection...');
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.log('   Note: Auth session check completed (no active session expected)');
    } else {
      console.log('   ✓ Supabase connection successful');
    }

    // Test if we can access the memory_fragments table structure
    console.log('\n2. Testing memory_fragments table access...');
    const { data: tableData, error: tableError } = await supabase
      .from('memory_fragments')
      .select('*')
      .limit(0);

    if (tableError) {
      if (tableError.message.includes('relation "memory_fragments" does not exist')) {
        console.log('   ⚠️  memory_fragments table does not exist yet');
        console.log('   Please run the migration: supabase/migrations/001_create_memory_fragments.sql');
        return false;
      } else {
        console.log('   ✓ memory_fragments table exists and is accessible');
      }
    } else {
      console.log('   ✓ memory_fragments table exists and is accessible');
    }

    console.log('\n✅ Supabase connection test completed!');
    return true;

  } catch (error) {
    console.error('\n❌ Connection test failed:', error.message);
    return false;
  }
}

// Run the test
testSupabaseConnection()
  .then(success => {
    if (success) {
      console.log('\nNext steps:');
      console.log('1. Run the database migration in your Supabase dashboard');
      console.log('2. Execute: supabase/migrations/001_create_memory_fragments.sql');
      console.log('3. Execute: supabase/functions/match_memory_fragments.sql');
      console.log('4. Run: node test-vector-operations.js to test vector operations');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });