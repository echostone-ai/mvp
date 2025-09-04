// Test the updated keyword extraction logic
function extractKeywords(text) {
  const stopWords = new Set(['what', 'was', 'your', 'the', 'a', 'an', 'is', 'are', 'were', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must', 'shall', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'and', 'or', 'but', 'so', 'if', 'then', 'else', 'when', 'where', 'why', 'how', 'who', 'which', 'that', 'this', 'these', 'those', 'me', 'my', 'mine', 'you', 'yours', 'he', 'his', 'she', 'her', 'hers', 'it', 'its', 'we', 'our', 'ours', 'they', 'their', 'theirs', 'i', 'tell', 'about']);
  const importantWords = new Set(['dog', 'cat', 'pet', 'music', 'band', 'song', 'name', 'age', 'job', 'work', 'live', 'born', 'from']);
  return text.toLowerCase().split(/\s+/).filter(word => 
    (word.length >= 3 && !stopWords.has(word) && /^[a-z]+$/.test(word)) || importantWords.has(word)
  );
}

const testQueries = [
  'What was your first dog?',
  'Tell me about your favorite music',
  'What kind of dog is Romeo?',
  'How many pets do you have?'
];

console.log('🔍 Testing updated keyword extraction logic:\n');

testQueries.forEach(query => {
  const keywords = extractKeywords(query);
  const searchQuery = keywords.length > 0 ? keywords.join(' ') : query;
  
  console.log(`Original: "${query}"`);
  console.log(`Keywords: [${keywords.join(', ')}]`);
  console.log(`Search query: "${searchQuery}"`);
  console.log('---');
});

// Test with the Supabase function
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testUpdatedKeywordSearch() {
  console.log('\n🔍 Testing updated keyword-based search:\n');
  
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const resolvedAvatarId = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
  
  const originalQuery = 'What was your first dog?';
  const keywords = extractKeywords(originalQuery);
  const keywordQuery = keywords.join(' ');
  
  console.log(`Original query: "${originalQuery}"`);
  console.log(`Keywords: [${keywords.join(', ')}]`);
  console.log(`Keyword query: "${keywordQuery}"`);
  
  // Test keyword query
  console.log('\nTesting keyword query:');
  const { data: keywordData, error: keywordError } = await supabase.rpc('get_enhanced_memories', {
    target_user_id: userId,
    target_avatar_id: resolvedAvatarId,
    search_query: keywordQuery,
    match_count: 10,
    similarity_threshold: 0.1,
    include_bio_facts: true
  });
  
  if (keywordError) {
    console.log('❌ Error:', keywordError);
  } else {
    console.log(`Keyword query returned ${keywordData?.length || 0} results`);
    
    if (keywordData?.length > 0) {
      console.log('\nResults:');
      keywordData.forEach((result, i) => {
        const hasRomeo = result.fragment_text.includes('Romeo');
        const hasBucky = result.fragment_text.includes('Bucky');
        const isDogAnswer = (hasRomeo || hasBucky) && result.fragment_text.length > 50;
        
        console.log(`${i+1}. [${result.match_type}] Score: ${result.similarity_score} ${isDogAnswer ? '🎉' : ''}`);
        console.log(`   ${result.fragment_text.substring(0, 100)}...`);
      });
      
      const dogAnswers = keywordData.filter(r => 
        (r.fragment_text.includes('Romeo') || r.fragment_text.includes('Bucky')) && 
        r.fragment_text.length > 50
      );
      
      if (dogAnswers.length > 0) {
        console.log(`\n🎉 SUCCESS! Found ${dogAnswers.length} dog answers with keyword search!`);
        console.log('The memory service fix should now work correctly.');
      } else {
        console.log('\n⚠️  Still not finding dog answers. Let me try individual keywords...');
        
        // Try each keyword individually
        for (const keyword of keywords) {
          console.log(`\nTrying "${keyword}":`);
          const { data: singleData, error: singleError } = await supabase.rpc('get_enhanced_memories', {
            target_user_id: userId,
            target_avatar_id: resolvedAvatarId,
            search_query: keyword,
            match_count: 5,
            similarity_threshold: 0.1,
            include_bio_facts: true
          });
          
          if (!singleError && singleData) {
            const singleDogAnswers = singleData.filter(r => 
              (r.fragment_text.includes('Romeo') || r.fragment_text.includes('Bucky')) && 
              r.fragment_text.length > 50
            );
            console.log(`  ${singleData.length} results, ${singleDogAnswers.length} dog answers`);
            
            if (singleDogAnswers.length > 0) {
              console.log(`  🎉 "${keyword}" found dog answers!`);
            }
          }
        }
      }
    }
  }
}

testUpdatedKeywordSearch().catch(console.error);