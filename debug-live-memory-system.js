// debug-live-memory-system.js
// Debug script to test the live memory system

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugLiveMemorySystem() {
  console.log('🔍 Debugging Live Memory System...\n');

  // Test 1: Check if tables exist
  console.log('1. Checking database tables...');
  try {
    const { data: memoryData, error: memoryError } = await supabase
      .from('memory_fragments')
      .select('count', { count: 'exact', head: true });

    if (memoryError) {
      console.log('❌ memory_fragments table error:', memoryError.message);
    } else {
      console.log('✅ memory_fragments table exists');
    }

    const { data: convData, error: convError } = await supabase
      .from('conversations')
      .select('count', { count: 'exact', head: true });

    if (convError) {
      console.log('❌ conversations table error:', convError.message);
    } else {
      console.log('✅ conversations table exists');
    }
  } catch (error) {
    console.log('❌ Database connection error:', error.message);
    return;
  }

  // Test 2: Check if vector function exists
  console.log('2. Testing vector search function...');
  try {
    const testEmbedding = new Array(1536).fill(0.1);
    const { data, error } = await supabase.rpc('match_memory_fragments', {
      query_embedding: testEmbedding,
      match_threshold: 0.5,
      match_count: 1,
      target_user_id: '00000000-0000-0000-0000-000000000000'
    });

    if (error) {
      console.log('❌ Vector search function error:', error.message);
      if (error.message.includes('function match_memory_fragments')) {
        console.log('   → Function does not exist or has wrong signature');
      }
      if (error.message.includes('vector')) {
        console.log('   → pgvector extension may not be enabled');
      }
    } else {
      console.log('✅ Vector search function works');
    }
  } catch (error) {
    console.log('❌ Vector search test failed:', error.message);
  }

  // Test 3: Check existing memory data
  console.log('3. Checking existing memory data...');
  try {
    const { data, error } = await supabase
      .from('memory_fragments')
      .select('user_id, fragment_text, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.log('❌ Failed to query memory fragments:', error.message);
    } else {
      console.log('✅ Memory fragments query successful');
      console.log(`   Found ${data.length} total memory fragments`);
      
      if (data.length > 0) {
        console.log('   Recent fragments:');
        data.forEach((fragment, index) => {
          console.log(`   ${index + 1}. User: ${fragment.user_id.substring(0, 8)}... | "${fragment.fragment_text.substring(0, 50)}..." | ${fragment.created_at}`);
        });
      } else {
        console.log('   No memory fragments found - this is why memories aren\'t loading');
      }
    }
  } catch (error) {
    console.log('❌ Memory data check failed:', error.message);
  }

  // Test 4: Check if we can access auth users (this will likely fail with anon key)
  console.log('4. Checking user authentication...');
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      console.log('ℹ️  No authenticated user (expected with this test script)');
      console.log('   In the live app, make sure users are properly authenticated');
    } else {
      console.log('✅ User authenticated:', user.id);
    }
  } catch (error) {
    console.log('ℹ️  Auth check failed (expected):', error.message);
  }

  // Test 5: Simulate memory API call
  console.log('5. Testing memory API endpoint...');
  try {
    // This will fail because we're not authenticated, but we can see the error
    const response = await fetch(`${supabaseUrl.replace('supabase.co', 'supabase.co')}/rest/v1/rpc/match_memory_fragments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify({
        query_embedding: new Array(1536).fill(0.1),
        match_threshold: 0.5,
        match_count: 5,
        target_user_id: null
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Memory API endpoint works');
      console.log(`   Returned ${data.length} results`);
    } else {
      const errorText = await response.text();
      console.log('❌ Memory API endpoint error:', response.status, errorText);
    }
  } catch (error) {
    console.log('❌ Memory API test failed:', error.message);
  }

  console.log('\n📋 Summary:');
  console.log('If you see errors above, those need to be fixed for the memory system to work.');
  console.log('If everything shows ✅, then the issue might be in the frontend code or authentication.');
}

debugLiveMemorySystem().catch(error => {
  console.error('💥 Debug script crashed:', error);
});