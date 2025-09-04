const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMemoryServiceWithLowerThreshold() {
  console.log('🔍 Testing memory service behavior with different approaches...\n');
  
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const resolvedAvatarId = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
  
  // Test 1: Use the current function but with a much lower threshold
  console.log('1. Testing with very low threshold (0.01):');
  const { data: lowThreshold, error: lowError } = await supabase.rpc('get_enhanced_memories', {
    target_user_id: userId,
    target_avatar_id: resolvedAvatarId,
    search_query: 'What was your first dog?',
    match_count: 10,
    similarity_threshold: 0.01,
    include_bio_facts: true
  });
  
  if (lowError) {
    console.log('❌ Error:', lowError);
  } else {
    console.log(`Returned ${lowThreshold?.length || 0} results`);
    const dogAnswers = lowThreshold?.filter(r => 
      (r.fragment_text.includes('Romeo') || r.fragment_text.includes('Bucky')) && 
      r.fragment_text.length > 50
    ) || [];
    console.log(`Dog answers: ${dogAnswers.length}`);
  }
  
  // Test 2: Try extracting keywords manually and searching for those
  console.log('\n2. Testing keyword extraction approach:');
  const keywords = ['dog', 'first'];
  
  for (const keyword of keywords) {
    console.log(`\n   Searching for "${keyword}":`);
    const { data: keywordData, error: keywordError } = await supabase.rpc('get_enhanced_memories', {
      target_user_id: userId,
      target_avatar_id: resolvedAvatarId,
      search_query: keyword,
      match_count: 5,
      similarity_threshold: 0.1,
      include_bio_facts: true
    });
    
    if (keywordError) {
      console.log('   ❌ Error:', keywordError);
    } else {
      const dogAnswers = keywordData?.filter(r => 
        (r.fragment_text.includes('Romeo') || r.fragment_text.includes('Bucky')) && 
        r.fragment_text.length > 50
      ) || [];
      console.log(`   Found ${keywordData?.length || 0} results, ${dogAnswers.length} dog answers`);
      
      if (dogAnswers.length > 0) {
        console.log('   🎉 Dog answers found with this keyword!');
        dogAnswers.forEach((answer, i) => {
          console.log(`      ${i+1}. ${answer.fragment_text.substring(0, 80)}...`);
        });
      }
    }
  }
  
  // Test 3: Try a workaround - search for multiple related terms
  console.log('\n3. Testing multi-term search workaround:');
  const searchTerms = ['dog', 'Romeo', 'Bucky', 'pet'];
  const allResults = new Map();
  
  for (const term of searchTerms) {
    const { data: termData, error: termError } = await supabase.rpc('get_enhanced_memories', {
      target_user_id: userId,
      target_avatar_id: resolvedAvatarId,
      search_query: term,
      match_count: 10,
      similarity_threshold: 0.1,
      include_bio_facts: true
    });
    
    if (!termError && termData) {
      termData.forEach(result => {
        if (!allResults.has(result.id)) {
          allResults.set(result.id, result);
        }
      });
    }
  }
  
  const combinedResults = Array.from(allResults.values());
  const dogAnswers = combinedResults.filter(r => 
    (r.fragment_text.includes('Romeo') || r.fragment_text.includes('Bucky')) && 
    r.fragment_text.length > 50
  );
  
  console.log(`Combined search found ${combinedResults.length} unique results`);
  console.log(`Dog answers: ${dogAnswers.length}`);
  
  if (dogAnswers.length > 0) {
    console.log('\n🎉 SUCCESS! Multi-term search found dog answers:');
    dogAnswers.forEach((answer, i) => {
      console.log(`${i+1}. ${answer.fragment_text.substring(0, 100)}...`);
    });
    
    console.log('\n💡 SOLUTION: The memory service should use multi-term search for better results!');
  }
}

testMemoryServiceWithLowerThreshold().catch(console.error);