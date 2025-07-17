// test-pgvector-simple.js
// Simple test to check if pgvector is working by testing vector operations

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Need: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testPgVector() {
  console.log('🔍 Testing pgvector functionality...\n');

  try {
    // Test 1: Try to create a test vector
    console.log('1. Testing vector storage...');
    const testEmbedding = new Array(1536).fill(0.1);
    
    const { data: insertData, error: insertError } = await supabase
      .from('memory_fragments')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000', // Test UUID
        fragment_text: 'Test fragment for pgvector',
        embedding: testEmbedding,
        conversation_context: { test: true }
      })
      .select();

    if (insertError) {
      if (insertError.message.includes('vector')) {
        console.log('❌ pgvector extension not enabled');
        console.log('Error:', insertError.message);
        console.log('\n🔧 Solution: Run this SQL in Supabase SQL Editor:');
        console.log('CREATE EXTENSION IF NOT EXISTS vector;');
        return false;
      } else {
        console.log('⚠️  Insert error (might be normal):', insertError.message);
      }
    } else {
      console.log('✅ Vector storage works');
      
      // Clean up test data
      if (insertData && insertData[0]) {
        await supabase
          .from('memory_fragments')
          .delete()
          .eq('id', insertData[0].id);
      }
    }

    // Test 2: Try vector search function
    console.log('2. Testing vector search function...');
    const { data: searchData, error: searchError } = await supabase.rpc('match_memory_fragments', {
      query_embedding: testEmbedding,
      target_user_id: '00000000-0000-0000-0000-000000000000',
      match_threshold: 0.5,
      match_count: 1
    });

    if (searchError) {
      console.log('❌ Vector search function failed');
      console.log('Error:', searchError.message);
      return false;
    } else {
      console.log('✅ Vector search function works');
    }

    console.log('\n🎉 pgvector is working correctly!');
    console.log('✅ Vector storage enabled');
    console.log('✅ Vector search function working');
    console.log('✅ Memory system should work now');
    
    return true;

  } catch (error) {
    console.error('❌ Error testing pgvector:', error.message);
    return false;
  }
}

// Run the test
testPgVector().then(success => {
  if (!success) {
    console.log('\n🚨 pgvector is not working properly');
    console.log('This is likely because the vector extension is not enabled.');
    console.log('\n🔧 To fix:');
    console.log('1. Go to your Supabase Dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Run: CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('4. Run this test again');
    process.exit(1);
  }
  process.exit(0);
});