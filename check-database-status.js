// check-database-status.js
// Quick check of what's actually in the database

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDatabaseStatus() {
  console.log('🔍 Checking Database Status...\n');

  // Check memory fragments
  console.log('1. Memory Fragments:');
  try {
    const { data, error } = await supabase
      .from('memory_fragments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.log('❌ Error:', error.message);
    } else {
      console.log(`   Found ${data.length} memory fragments`);
      data.forEach((fragment, i) => {
        console.log(`   ${i+1}. User: ${fragment.user_id} | Text: "${fragment.fragment_text.substring(0, 50)}..."`);
      });
    }
  } catch (error) {
    console.log('❌ Failed:', error.message);
  }

  // Check conversations
  console.log('\n2. Conversations:');
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.log('❌ Error:', error.message);
    } else {
      console.log(`   Found ${data.length} conversations`);
      data.forEach((conv, i) => {
        const messageCount = Array.isArray(conv.messages) ? conv.messages.length : 0;
        console.log(`   ${i+1}. User: ${conv.user_id} | Messages: ${messageCount} | Last: ${conv.last_active}`);
      });
    }
  } catch (error) {
    console.log('❌ Failed:', error.message);
  }

  // Check users
  console.log('\n3. Users:');
  try {
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.log('❌ Error:', error.message);
    } else {
      console.log(`   Found ${users.length} users`);
      users.slice(0, 3).forEach((user, i) => {
        console.log(`   ${i+1}. ID: ${user.id} | Email: ${user.email} | Created: ${user.created_at}`);
      });
    }
  } catch (error) {
    console.log('❌ Failed:', error.message);
  }

  // Test vector function with a real user
  console.log('\n4. Testing Vector Function:');
  try {
    const { data: { users } } = await supabase.auth.admin.listUsers();
    if (users.length > 0) {
      const testUser = users[0];
      const testEmbedding = new Array(1536).fill(0.1);
      
      const { data, error } = await supabase.rpc('match_memory_fragments', {
        query_embedding: testEmbedding,
        match_threshold: 0.5,
        match_count: 5,
        target_user_id: testUser.id
      });

      if (error) {
        console.log('❌ Vector function error:', error.message);
      } else {
        console.log(`✅ Vector function works, returned ${data.length} results`);
      }
    }
  } catch (error) {
    console.log('❌ Vector test failed:', error.message);
  }
}

checkDatabaseStatus().catch(console.error);