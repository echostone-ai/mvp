// test-memory-system.js
// Test script to debug the memory system issues

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testMemorySystem() {
  console.log('🧪 Testing Memory System Components...\n');

  try {
    // Test 1: Check if we can create a simple vector
    console.log('1. Testing vector creation...');
    try {
      const testVector = new Array(1536).fill(0.1);
      console.log('✅ Vector creation successful');
    } catch (error) {
      console.log('❌ Vector creation failed:', error.message);
    }

    // Test 2: Check if we can call the vector search function
    console.log('2. Testing vector search function...');
    try {
      const { data, error } = await supabase.rpc('match_memory_fragments', {
        query_embedding: new Array(1536).fill(0.1),
        match_threshold: 0.5,
        match_count: 1,
        target_user_id: 'test-user-id'
      });

      if (error) {
        console.log('❌ Vector search failed:', error.message);
        console.log('   Error details:', error);
      } else {
        console.log('✅ Vector search successful, results:', data?.length || 0);
      }
    } catch (error) {
      console.log('❌ Vector search exception:', error.message);
    }

    // Test 3: Check if we can insert into memory_fragments table
    console.log('3. Testing memory_fragments table access...');
    try {
      const { data, error } = await supabase
        .from('memory_fragments')
        .select('count', { count: 'exact', head: true });

      if (error) {
        console.log('❌ Table access failed:', error.message);
      } else {
        console.log('✅ Table access successful');
      }
    } catch (error) {
      console.log('❌ Table access exception:', error.message);
    }

    // Test 4: Check if we can access conversations table
    console.log('4. Testing conversations table access...');
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('count', { count: 'exact', head: true });

      if (error) {
        console.log('❌ Conversations table access failed:', error.message);
      } else {
        console.log('✅ Conversations table access successful');
      }
    } catch (error) {
      console.log('❌ Conversations table access exception:', error.message);
    }

    // Test 5: Check pgvector extension specifically
    console.log('5. Testing pgvector extension...');
    try {
      const { data, error } = await supabase
        .from('pg_extension')
        .select('extname')
        .eq('extname', 'vector');

      if (error) {
        console.log('❌ Extension check failed:', error.message);
      } else if (!data || data.length === 0) {
        console.log('❌ pgvector extension not found');
        console.log('🔧 SOLUTION: Run this SQL in your Supabase SQL Editor:');
        console.log('   CREATE EXTENSION IF NOT EXISTS vector;');
      } else {
        console.log('✅ pgvector extension is enabled');
      }
    } catch (error) {
      console.log('❌ Extension check exception:', error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testMemorySystem().then(() => {
  console.log('\n🏁 Memory system test complete');
});