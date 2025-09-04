const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSpecificDogQueries() {
  console.log('🔍 Testing specific dog-related queries...\n');
  
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const resolvedAvatarId = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
  
  const queries = [
    'What was your first dog?',
    'Romeo',
    'Bucky',
    'dog named Romeo',
    'first dog name',
    'pet dog'
  ];
  
  for (const query of queries) {
    console.log(`\n🔍 Testing query: "${query}"`);
    
    const { data, error } = await supabase.rpc('get_enhanced_memories', {
      target_user_id: userId,
      target_avatar_id: resolvedAvatarId,
      search_query: query,
      match_count: 5,
      similarity_threshold: 0.1, // Low threshold to get more results
      include_bio_facts: true
    });
    
    if (error) {
      console.log('❌ Error:', error);
    } else {
      console.log(`✅ Returned ${data?.length || 0} results`);
      if (data?.length > 0) {
        data.forEach((result, i) => {
          console.log(`  ${i+1}. [${result.match_type}] Score: ${result.similarity_score}`);
          console.log(`     ${result.fragment_text.substring(0, 120)}...`);
        });
      }
    }
  }
  
  // Also test with text search to see what's available
  console.log('\n\n🔍 Direct text search for "Romeo":');
  const { data: textData, error: textError } = await supabase
    .from('memory_fragments')
    .select('*')
    .eq('user_id', userId)
    .eq('avatar_id', resolvedAvatarId)
    .ilike('fragment_text', '%Romeo%');
    
  if (textError) {
    console.log('❌ Text search error:', textError);
  } else {
    console.log(`Text search returned ${textData?.length || 0} results`);
    if (textData?.length > 0) {
      textData.forEach((result, i) => {
        console.log(`  ${i+1}. ${result.fragment_text.substring(0, 120)}...`);
      });
    }
  }
}

testSpecificDogQueries().catch(console.error);