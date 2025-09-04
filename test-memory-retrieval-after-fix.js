const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMemoryRetrievalAfterFix() {
  console.log('🔍 Testing memory retrieval after similarity threshold fix...\n');
  
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const resolvedAvatarId = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
  
  // Test with the new lower similarity threshold (0.1)
  console.log('Testing with similarity threshold 0.1:');
  const { data, error } = await supabase.rpc('get_enhanced_memories', {
    target_user_id: userId,
    target_avatar_id: resolvedAvatarId,
    search_query: 'What was your first dog?',
    match_count: 10,
    similarity_threshold: 0.1, // New lower threshold
    include_bio_facts: true
  });
  
  if (error) {
    console.log('❌ Error:', error);
  } else {
    console.log(`✅ Returned ${data?.length || 0} results`);
    if (data?.length > 0) {
      console.log('\nResults:');
      data.forEach((result, i) => {
        console.log(`${i+1}. [${result.match_type}] Score: ${result.similarity_score}`);
        console.log(`   ${result.fragment_text.substring(0, 120)}...`);
        console.log('');
      });
      
      // Check if we have the Romeo/Bucky answers
      const hasRomeoAnswer = data.some(r => r.fragment_text.includes('Romeo'));
      const hasBuckyAnswer = data.some(r => r.fragment_text.includes('Bucky'));
      
      console.log('✅ Analysis:');
      console.log(`- Has Romeo answer: ${hasRomeoAnswer ? '✅' : '❌'}`);
      console.log(`- Has Bucky answer: ${hasBuckyAnswer ? '✅' : '❌'}`);
      
      if (hasRomeoAnswer || hasBuckyAnswer) {
        console.log('🎉 SUCCESS! The memory retrieval now returns Jonathan\'s dog information!');
      } else {
        console.log('⚠️  Still not returning the dog answers. Let me try a different approach...');
        
        // Try with even lower threshold
        console.log('\nTrying with threshold 0.01:');
        const { data: veryLowData, error: veryLowError } = await supabase.rpc('get_enhanced_memories', {
          target_user_id: userId,
          target_avatar_id: resolvedAvatarId,
          search_query: 'What was your first dog?',
          match_count: 10,
          similarity_threshold: 0.01,
          include_bio_facts: true
        });
        
        if (veryLowError) {
          console.log('❌ Very low threshold error:', veryLowError);
        } else {
          console.log(`Very low threshold returned ${veryLowData?.length || 0} results`);
          const hasRomeoVeryLow = veryLowData?.some(r => r.fragment_text.includes('Romeo'));
          const hasBuckyVeryLow = veryLowData?.some(r => r.fragment_text.includes('Bucky'));
          console.log(`- Has Romeo answer: ${hasRomeoVeryLow ? '✅' : '❌'}`);
          console.log(`- Has Bucky answer: ${hasBuckyVeryLow ? '✅' : '❌'}`);
        }
      }
    }
  }
}

testMemoryRetrievalAfterFix().catch(console.error);