const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugActualCall() {
  console.log('🔍 Debugging the actual memory service call...\n');
  
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const resolvedAvatarId = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
  
  // Simulate the exact call from the logs
  console.log('Simulating the exact call from memory service:');
  console.log('Parameters:');
  console.log('- target_user_id:', userId);
  console.log('- target_avatar_id:', resolvedAvatarId);
  console.log('- search_query: "What was your first dog?"');
  console.log('- match_count: 64 (default)');
  console.log('- similarity_threshold: 0.6 (default)');
  console.log('- include_bio_facts: true');
  
  const { data, error } = await supabase.rpc('get_enhanced_memories', {
    target_user_id: userId,
    target_avatar_id: resolvedAvatarId,
    search_query: 'What was your first dog?',
    match_count: 64,
    similarity_threshold: 0.6,
    include_bio_facts: true
  });
  
  if (error) {
    console.log('❌ Error:', error);
  } else {
    console.log(`✅ Returned ${data?.length || 0} results`);
    if (data?.length > 0) {
      console.log('\nResults:');
      data.forEach((result, i) => {
        console.log(`${i+1}. [${result.match_type}] ${result.fragment_text.substring(0, 100)}...`);
        console.log(`   Similarity: ${result.similarity_score}`);
      });
    } else {
      console.log('\n🤔 No results with similarity_threshold 0.6. Trying lower threshold...');
      
      const { data: lowThresholdData, error: lowThresholdError } = await supabase.rpc('get_enhanced_memories', {
        target_user_id: userId,
        target_avatar_id: resolvedAvatarId,
        search_query: 'What was your first dog?',
        match_count: 64,
        similarity_threshold: 0.1, // Much lower threshold
        include_bio_facts: true
      });
      
      if (lowThresholdError) {
        console.log('❌ Error with low threshold:', lowThresholdError);
      } else {
        console.log(`With threshold 0.1: ${lowThresholdData?.length || 0} results`);
        if (lowThresholdData?.length > 0) {
          console.log('\nResults with low threshold:');
          lowThresholdData.forEach((result, i) => {
            console.log(`${i+1}. [${result.match_type}] ${result.fragment_text.substring(0, 100)}...`);
            console.log(`   Similarity: ${result.similarity_score}`);
          });
        }
      }
    }
  }
  
  // Also test with just "dog" as query
  console.log('\n\n🔍 Testing with simpler query "dog":');
  const { data: simpleData, error: simpleError } = await supabase.rpc('get_enhanced_memories', {
    target_user_id: userId,
    target_avatar_id: resolvedAvatarId,
    search_query: 'dog',
    match_count: 64,
    similarity_threshold: 0.6,
    include_bio_facts: true
  });
  
  if (simpleError) {
    console.log('❌ Error with simple query:', simpleError);
  } else {
    console.log(`Simple query returned ${simpleData?.length || 0} results`);
    if (simpleData?.length > 0) {
      console.log('\nSimple query results:');
      simpleData.forEach((result, i) => {
        console.log(`${i+1}. [${result.match_type}] ${result.fragment_text.substring(0, 100)}...`);
        console.log(`   Similarity: ${result.similarity_score}`);
      });
    }
  }
}

debugActualCall().catch(console.error);