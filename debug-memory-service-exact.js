const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugMemoryServiceExact() {
  console.log('🔍 Debugging memory service exact behavior...\n');
  
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const avatarId = 'jonathan-demo';
  const resolvedAvatarId = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
  
  // Test the exact parameters that would be used in getUserMemories
  console.log('Testing getUserMemories parameters:');
  console.log('- userId:', userId);
  console.log('- avatarId:', avatarId);
  console.log('- resolvedAvatarId:', resolvedAvatarId);
  console.log('- limit: 3');
  console.log('- orderBy: created_at');
  console.log('- orderDirection: desc');
  
  // First, let's see what the basic query returns
  console.log('\n1. Basic query (what getUserMemories does first):');
  const { data: basicData, error: basicError } = await supabase
    .from('memory_fragments')
    .select('*')
    .eq('user_id', userId)
    .eq('avatar_id', resolvedAvatarId)
    .order('created_at', { ascending: false })
    .limit(3);
    
  if (basicError) {
    console.log('❌ Basic query error:', basicError);
  } else {
    console.log(`✅ Basic query returned ${basicData?.length || 0} memories`);
    if (basicData?.length > 0) {
      console.log('Sample memory:', basicData[0].fragment_text.substring(0, 100) + '...');
    }
  }
  
  // Now test the enhanced retrieval with the exact query from logs
  console.log('\n2. Enhanced retrieval with exact query from logs:');
  const query = 'What was your first dog?';
  
  const { data: enhancedData, error: enhancedError } = await supabase.rpc('get_enhanced_memories', {
    target_user_id: userId,
    target_avatar_id: resolvedAvatarId,
    search_query: query,
    match_count: 3, // Using limit from getUserMemories
    similarity_threshold: 0.6, // Default threshold
    include_bio_facts: true
  });
  
  if (enhancedError) {
    console.log('❌ Enhanced query error:', enhancedError);
  } else {
    console.log(`Enhanced query returned ${enhancedData?.length || 0} memories`);
    if (enhancedData?.length > 0) {
      console.log('Enhanced results:');
      enhancedData.forEach((result, i) => {
        console.log(`  ${i+1}. [${result.match_type}] ${result.fragment_text.substring(0, 100)}...`);
        console.log(`     Similarity: ${result.similarity_score}`);
      });
    } else {
      console.log('❌ No results from enhanced query - this matches the logs!');
      
      // Try with lower threshold
      console.log('\n3. Trying with lower similarity threshold (0.1):');
      const { data: lowThresholdData, error: lowThresholdError } = await supabase.rpc('get_enhanced_memories', {
        target_user_id: userId,
        target_avatar_id: resolvedAvatarId,
        search_query: query,
        match_count: 3,
        similarity_threshold: 0.1,
        include_bio_facts: true
      });
      
      if (lowThresholdError) {
        console.log('❌ Low threshold error:', lowThresholdError);
      } else {
        console.log(`Low threshold returned ${lowThresholdData?.length || 0} memories`);
        if (lowThresholdData?.length > 0) {
          console.log('Low threshold results:');
          lowThresholdData.forEach((result, i) => {
            console.log(`  ${i+1}. [${result.match_type}] ${result.fragment_text.substring(0, 100)}...`);
            console.log(`     Similarity: ${result.similarity_score}`);
          });
        }
      }
    }
  }
}

debugMemoryServiceExact().catch(console.error);