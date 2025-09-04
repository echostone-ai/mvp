const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testEnhancedMemories() {
  console.log('🔍 Testing get_enhanced_memories function...\n');
  
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const resolvedAvatarId = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
  
  // Test different parameter combinations
  const testCases = [
    {
      name: 'Test 1: Basic parameters',
      params: {
        p_user_id: userId,
        p_avatar_id: resolvedAvatarId,
        p_query: 'dog',
        p_limit: 10
      }
    },
    {
      name: 'Test 2: Without p_ prefix',
      params: {
        user_id: userId,
        avatar_id: resolvedAvatarId,
        query: 'dog',
        limit: 10
      }
    },
    {
      name: 'Test 3: Different parameter names',
      params: {
        query_text: 'dog',
        user_id: userId,
        avatar_id: resolvedAvatarId,
        limit_count: 10
      }
    },
    {
      name: 'Test 4: Just query',
      params: {
        query: 'dog'
      }
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n${testCase.name}:`);
    console.log('Parameters:', testCase.params);
    
    const { data, error } = await supabase.rpc('get_enhanced_memories', testCase.params);
    
    if (error) {
      console.log('❌ Error:', error.message);
    } else {
      console.log(`✅ Success! Returned ${data?.length || 0} results`);
      if (data?.length > 0) {
        console.log('Sample result:', data[0]);
      }
    }
  }
}

testEnhancedMemories().catch(console.error);