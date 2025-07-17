// test-memory-api-direct.js
// Test the memories API directly to see what's happening

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testMemoryAPI() {
  console.log('🔍 Testing Memory API...\n');

  // First, let's see what's actually in the database
  console.log('1. Checking database contents:');
  try {
    const { data: memories, error } = await supabase
      .from('memory_fragments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.log('❌ Database error:', error.message);
      return;
    }

    console.log(`✅ Found ${memories.length} memory fragments in database`);
    
    if (memories.length > 0) {
      console.log('Recent memories:');
      memories.slice(0, 3).forEach((memory, i) => {
        console.log(`  ${i+1}. User: ${memory.user_id}`);
        console.log(`     Text: "${memory.fragment_text}"`);
        console.log(`     Created: ${memory.created_at}`);
        console.log('');
      });

      // Test the API with a real user ID
      const testUserId = memories[0].user_id;
      console.log(`2. Testing API with user ID: ${testUserId}`);

      try {
        const response = await fetch(`http://localhost:3000/api/memories?userId=${testUserId}&limit=10&offset=0&orderBy=created_at&orderDirection=desc`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.log('❌ API error:', response.status, errorText);
          return;
        }

        const apiData = await response.json();
        console.log('✅ API response received');
        console.log(`   Stats: ${apiData.stats?.totalFragments || 0} total fragments`);
        console.log(`   Memories returned: ${apiData.memories?.length || 0}`);
        
        if (apiData.memories && apiData.memories.length > 0) {
          console.log('   First memory:', apiData.memories[0].fragmentText);
        } else {
          console.log('   ❌ No memories in API response - this is the problem!');
        }

      } catch (error) {
        console.log('❌ API test failed:', error.message);
      }

    } else {
      console.log('❌ No memories in database - memories aren\'t being created');
    }

  } catch (error) {
    console.log('❌ Database check failed:', error.message);
  }
}

testMemoryAPI().catch(console.error);