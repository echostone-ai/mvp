const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCorrectEnhancedMemories() {
  console.log('🔍 Testing get_enhanced_memories with correct parameters...\n');
  
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const resolvedAvatarId = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
  
  // Test with correct parameters
  console.log('Testing with correct parameters:');
  const { data, error } = await supabase.rpc('get_enhanced_memories', {
    target_user_id: userId,
    target_avatar_id: resolvedAvatarId,
    search_query: 'dog',
    match_count: 10,
    similarity_threshold: 0.1, // Lower threshold to get more results
    include_bio_facts: true
  });
  
  if (error) {
    console.log('❌ Error:', error);
  } else {
    console.log(`✅ Success! Returned ${data?.length || 0} results`);
    if (data?.length > 0) {
      console.log('\nResults:');
      data.forEach((result, i) => {
        console.log(`${i+1}. [${result.match_type}] ${result.fragment_text.substring(0, 100)}...`);
        console.log(`   Similarity: ${result.similarity_score}`);
      });
    } else {
      console.log('No results returned. Let me try without search query...');
      
      // Try without search query to get all memories
      const { data: allData, error: allError } = await supabase.rpc('get_enhanced_memories', {
        target_user_id: userId,
        target_avatar_id: resolvedAvatarId,
        search_query: '',
        match_count: 10,
        similarity_threshold: 0.0,
        include_bio_facts: true
      });
      
      if (allError) {
        console.log('❌ Error getting all memories:', allError);
      } else {
        console.log(`Got ${allData?.length || 0} memories without search query`);
        if (allData?.length > 0) {
          console.log('\nAll memories:');
          allData.forEach((result, i) => {
            console.log(`${i+1}. [${result.match_type}] ${result.fragment_text.substring(0, 100)}...`);
          });
        }
      }
    }
  }
}

testCorrectEnhancedMemories().catch(console.error);