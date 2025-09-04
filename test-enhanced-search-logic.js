const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testEnhancedSearchLogic() {
  console.log('🔍 Testing enhanced search logic...\n');
  
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const resolvedAvatarId = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
  
  // Test different search strategies
  const testCases = [
    {
      name: 'Original query',
      query: 'What was your first dog?'
    },
    {
      name: 'Just "dog"',
      query: 'dog'
    },
    {
      name: 'Dog name',
      query: 'Romeo'
    },
    {
      name: 'Pet name',
      query: 'Bucky'
    },
    {
      name: 'Empty query (should return recent)',
      query: ''
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🔍 Testing: ${testCase.name} - "${testCase.query}"`);
    
    const { data, error } = await supabase.rpc('get_enhanced_memories', {
      target_user_id: userId,
      target_avatar_id: resolvedAvatarId,
      search_query: testCase.query,
      match_count: 5,
      similarity_threshold: 0.1,
      include_bio_facts: true
    });
    
    if (error) {
      console.log('❌ Error:', error);
    } else {
      console.log(`✅ Returned ${data?.length || 0} results`);
      if (data?.length > 0) {
        data.forEach((result, i) => {
          const hasRomeo = result.fragment_text.includes('Romeo');
          const hasBucky = result.fragment_text.includes('Bucky');
          const isDogRelated = hasRomeo || hasBucky || result.fragment_text.toLowerCase().includes('dog');
          
          console.log(`  ${i+1}. [${result.match_type}] Score: ${result.similarity_score} ${isDogRelated ? '🐕' : ''}`);
          console.log(`     ${result.fragment_text.substring(0, 80)}...`);
        });
        
        const dogAnswers = data.filter(r => 
          r.fragment_text.includes('Romeo') || 
          r.fragment_text.includes('Bucky') ||
          (r.fragment_text.toLowerCase().includes('dog') && r.fragment_text.length > 50)
        );
        
        if (dogAnswers.length > 0) {
          console.log(`🎉 Found ${dogAnswers.length} dog-related answers!`);
        }
      }
    }
  }
  
  // Test the specific issue: why "What was your first dog?" doesn't match Romeo answers
  console.log('\n\n🔍 Debugging specific matching logic...');
  
  const query = 'What was your first dog?';
  const fragments = [
    'What was your first dog?',
    'Ah, Bucky! He\'s my trusty sidekick, a dog named Romeo.',
    'Tell me about your dogs'
  ];
  
  console.log(`Query: "${query}"`);
  console.log('Testing fragments:');
  
  fragments.forEach((fragment, i) => {
    const lowerQuery = query.toLowerCase();
    const lowerFragment = fragment.toLowerCase();
    
    const exactMatch = lowerFragment.includes(lowerQuery);
    const containsDog = lowerFragment.includes('dog');
    const queryContainsDog = lowerQuery.includes('dog');
    
    console.log(`\n${i+1}. "${fragment}"`);
    console.log(`   - Exact match: ${exactMatch}`);
    console.log(`   - Fragment contains "dog": ${containsDog}`);
    console.log(`   - Query contains "dog": ${queryContainsDog}`);
    console.log(`   - Would match current logic: ${exactMatch || (queryContainsDog && containsDog)}`);
  });
}

testEnhancedSearchLogic().catch(console.error);