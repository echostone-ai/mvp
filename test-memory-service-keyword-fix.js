// Test the keyword extraction logic
function extractKeywords(text) {
  const stopWords = new Set(['what', 'was', 'your', 'the', 'a', 'an', 'is', 'are', 'were', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must', 'shall', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'and', 'or', 'but', 'so', 'if', 'then', 'else', 'when', 'where', 'why', 'how', 'who', 'which', 'that', 'this', 'these', 'those', 'me', 'my', 'mine', 'you', 'yours', 'he', 'his', 'she', 'her', 'hers', 'it', 'its', 'we', 'our', 'ours', 'they', 'their', 'theirs', 'i', 'tell', 'about']);
  return text.toLowerCase().split(/\s+/).filter(word => 
    word.length > 2 && !stopWords.has(word) && /^[a-z]+$/.test(word)
  );
}

const testQueries = [
  'What was your first dog?',
  'Tell me about your favorite music',
  'What kind of dog is Romeo?',
  'How many pets do you have?'
];

console.log('🔍 Testing keyword extraction logic:\n');

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

async function testKeywordSearch() {
  console.log('\n🔍 Testing keyword-based search:\n');
  
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const resolvedAvatarId = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
  
  const originalQuery = 'What was your first dog?';
  const keywords = extractKeywords(originalQuery);
  const keywordQuery = keywords.join(' ');
  
  console.log(`Original query: "${originalQuery}"`);
  console.log(`Keyword query: "${keywordQuery}"`);
  
  // Test original query
  console.log('\n1. Testing original query:');
  const { data: originalData, error: originalError } = await supabase.rpc('get_enhanced_memories', {
    target_user_id: userId,
    target_avatar_id: resolvedAvatarId,
    search_query: originalQuery,
    match_count: 5,
    similarity_threshold: 0.1,
    include_bio_facts: true
  });
  
  if (originalError) {
    console.log('❌ Error:', originalError);
  } else {
    const dogAnswers = originalData?.filter(r => 
      (r.fragment_text.includes('Romeo') || r.fragment_text.includes('Bucky')) && 
      r.fragment_text.length > 50
    ) || [];
    console.log(`Original query: ${originalData?.length || 0} results, ${dogAnswers.length} dog answers`);
  }
  
  // Test keyword query
  console.log('\n2. Testing keyword query:');
  const { data: keywordData, error: keywordError } = await supabase.rpc('get_enhanced_memories', {
    target_user_id: userId,
    target_avatar_id: resolvedAvatarId,
    search_query: keywordQuery,
    match_count: 5,
    similarity_threshold: 0.1,
    include_bio_facts: true
  });
  
  if (keywordError) {
    console.log('❌ Error:', keywordError);
  } else {
    const dogAnswers = keywordData?.filter(r => 
      (r.fragment_text.includes('Romeo') || r.fragment_text.includes('Bucky')) && 
      r.fragment_text.length > 50
    ) || [];
    console.log(`Keyword query: ${keywordData?.length || 0} results, ${dogAnswers.length} dog answers`);
    
    if (dogAnswers.length > 0) {
      console.log('\n🎉 SUCCESS! Keyword search found dog answers:');
      dogAnswers.forEach((answer, i) => {
        console.log(`${i+1}. ${answer.fragment_text.substring(0, 100)}...`);
      });
    }
  }
}

testKeywordSearch().catch(console.error);