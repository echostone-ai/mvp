const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugMemoryRetrieval() {
  console.log('🔍 Debugging Jonathan Demo Memory Retrieval...\n');
  
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const avatarId = 'jonathan-demo';
  const resolvedAvatarId = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
  
  // 1. Check memory_fragments table
  console.log('1. Checking memory_fragments table...');
  const { data: fragments, error: fragError } = await supabase
    .from('memory_fragments')
    .select('*')
    .eq('user_id', userId)
    .eq('avatar_id', resolvedAvatarId);
    
  console.log(`Found ${fragments?.length || 0} memory fragments`);
  if (fragError) console.log('Fragment error:', fragError);
  if (fragments?.length > 0) {
    console.log('Sample fragment:', fragments[0]);
  }
  
  // 2. Test the enhanced retrieval function directly
  console.log('\n2. Testing enhanced retrieval function...');
  const { data: enhancedResult, error: enhancedError } = await supabase
    .rpc('get_enhanced_memories_with_ranking', {
      p_user_id: userId,
      p_avatar_id: resolvedAvatarId,
      p_query: 'dog',
      p_limit: 10
    });
    
  console.log(`Enhanced retrieval returned ${enhancedResult?.length || 0} memories`);
  if (enhancedError) console.log('Enhanced error:', enhancedError);
  if (enhancedResult?.length > 0) {
    console.log('Sample enhanced result:', enhancedResult[0]);
  }
  
  // 3. Test basic memory retrieval
  console.log('\n3. Testing basic memory retrieval...');
  const { data: basicResult, error: basicError } = await supabase
    .from('memory_fragments')
    .select('*')
    .eq('user_id', userId)
    .eq('avatar_id', resolvedAvatarId)
    .ilike('content', '%dog%')
    .limit(5);
    
  console.log(`Basic retrieval returned ${basicResult?.length || 0} memories`);
  if (basicError) console.log('Basic error:', basicError);
  if (basicResult?.length > 0) {
    console.log('Sample basic result:', basicResult[0]);
  }
  
  // 4. Check RLS policies
  console.log('\n4. Checking RLS policies...');
  const { data: policies, error: policyError } = await supabase
    .from('pg_policies')
    .select('*')
    .eq('tablename', 'memory_fragments');
    
  if (policyError) {
    console.log('Policy check error:', policyError);
  } else {
    console.log(`Found ${policies?.length || 0} RLS policies for memory_fragments`);
  }
  
  // 5. Test fact_promotion_queue access
  console.log('\n5. Testing fact_promotion_queue access...');
  const { data: queueTest, error: queueError } = await supabase
    .from('fact_promotion_queue')
    .select('count(*)')
    .limit(1);
    
  if (queueError) {
    console.log('Queue access error:', queueError);
  } else {
    console.log('Queue access successful');
  }
}

debugMemoryRetrieval().catch(console.error);