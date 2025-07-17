// check-database-status.js
// Check the actual database status and RLS policies

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing Supabase service role key');
  process.exit(1);
}

// Use service role key to bypass RLS
const supabase = createClient(supabaseUrl, serviceKey);

async function checkDatabaseStatus() {
  console.log('🔍 Checking Database Status with Service Role...\n');

  // Check if there are any memory fragments at all
  console.log('1. Checking existing memory fragments...');
  try {
    const { data, error } = await supabase
      .from('memory_fragments')
      .select('*')
      .limit(5);

    if (error) {
      console.log('❌ Error querying memory_fragments:', error.message);
    } else {
      console.log(`✅ Found ${data.length} memory fragments in database`);
      if (data.length > 0) {
        console.log('Sample fragment:', {
          id: data[0].id,
          user_id: data[0].user_id,
          fragment_text: data[0].fragment_text?.substring(0, 50) + '...',
          created_at: data[0].created_at
        });
      }
    }
  } catch (error) {
    console.log('❌ Exception:', error.message);
  }

  // Check conversations
  console.log('\n2. Checking existing conversations...');
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .limit(5);

    if (error) {
      console.log('❌ Error querying conversations:', error.message);
    } else {
      console.log(`✅ Found ${data.length} conversations in database`);
      if (data.length > 0) {
        console.log('Sample conversation:', {
          id: data[0].id,
          user_id: data[0].user_id,
          messages_count: data[0].messages?.length || 0,
          last_active: data[0].last_active
        });
      }
    }
  } catch (error) {
    console.log('❌ Exception:', error.message);
  }

  // Check auth.users table to see if we have users
  console.log('\n3. Checking auth.users...');
  try {
    const { data, error } = await supabase
      .from('auth.users')
      .select('id, email, created_at')
      .limit(3);

    if (error) {
      console.log('❌ Error querying auth.users:', error.message);
    } else {
      console.log(`✅ Found ${data.length} users in auth.users`);
      if (data.length > 0) {
        console.log('Sample user:', {
          id: data[0].id,
          email: data[0].email,
          created_at: data[0].created_at
        });
      }
    }
  } catch (error) {
    console.log('❌ Exception:', error.message);
  }

  // Test vector search with real user ID if available
  console.log('\n4. Testing vector search with real data...');
  try {
    const { data: users } = await supabase
      .from('auth.users')
      .select('id')
      .limit(1);

    if (users && users.length > 0) {
      const realUserId = users[0].id;
      console.log('Testing with real user ID:', realUserId);

      const { data, error } = await supabase.rpc('match_memory_fragments', {
        query_embedding: new Array(1536).fill(0.1),
        match_threshold: 0.5,
        match_count: 5,
        target_user_id: realUserId
      });

      if (error) {
        console.log('❌ Vector search failed:', error.message);
      } else {
        console.log(`✅ Vector search returned ${data.length} results`);
      }
    } else {
      console.log('❌ No users found to test with');
    }
  } catch (error) {
    console.log('❌ Exception:', error.message);
  }

  // Check pgvector extension directly
  console.log('\n5. Checking pgvector extension directly...');
  try {
    const { data, error } = await supabase
      .rpc('exec_sql', { 
        sql: "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';" 
      });

    if (error) {
      console.log('❌ Cannot check extensions:', error.message);
    } else if (!data || data.length === 0) {
      console.log('❌ pgvector extension NOT found');
      console.log('🔧 CRITICAL: Run this SQL: CREATE EXTENSION IF NOT EXISTS vector;');
    } else {
      console.log('✅ pgvector extension found:', data);
    }
  } catch (error) {
    console.log('❌ Exception checking pgvector:', error.message);
  }
}

checkDatabaseStatus().catch(console.error);