const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Simulate the new multi-keyword approach
function extractKeywords(text) {
  const stopWords = new Set(['what', 'was', 'your', 'the', 'a', 'an', 'is', 'are', 'were', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must', 'shall', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'and', 'or', 'but', 'so', 'if', 'then', 'else', 'when', 'where', 'why', 'how', 'who', 'which', 'that', 'this', 'these', 'those', 'me', 'my', 'mine', 'you', 'yours', 'he', 'his', 'she', 'her', 'hers', 'it', 'its', 'we', 'our', 'ours', 'they', 'their', 'theirs', 'i', 'tell', 'about']);
  const importantWords = new Set(['dog', 'cat', 'pet', 'music', 'band', 'song', 'name', 'age', 'job', 'work', 'live', 'born', 'from']);
  
  return text.toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter(word => 
      word.length > 0 && (
        (word.length >= 3 && !stopWords.has(word)) || 
        importantWords.has(word)
      )
    );
}

async function testMultiKeywordApproach() {
  console.log('🔍 Testing multi-keyword approach...\n');
  
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const resolvedAvatarId = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
  
  const originalQuery = 'What was your first dog?';
  const keywords = extractKeywords(originalQuery);
  const limit = 10;
  const similarityThreshold = 0.1;
  
  console.log(`Original query: "${originalQuery}"`);
  console.log(`Keywords: [${keywords.join(', ')}]`);
  
  // Simulate the new approach
  let allResults = [];
  const seenIds = new Set();
  
  console.log('\nTesting each keyword individually:');
  
  for (const keyword of keywords) {
    console.log(`\nSearching for "${keyword}":`);
    
    const { data: keywordData, error: keywordError } = await supabase.rpc('get_enhanced_memories', {
      target_user_id: userId,
      target_avatar_id: resolvedAvatarId,
      search_query: keyword,
      match_count: Math.ceil(limit / keywords.length) + 5,
      similarity_threshold: similarityThreshold,
      include_bio_facts: true
    });
    
    if (keywordError) {
      console.log(`  ❌ Error: ${keywordError.message}`);
    } else {
      console.log(`  Found ${keywordData?.length || 0} results`);
      
      if (keywordData) {
        let newResults = 0;
        keywordData.forEach(result => {
          if (!seenIds.has(result.id)) {
            seenIds.add(result.id);
            allResults.push(result);
            newResults++;
          }
        });
        console.log(`  Added ${newResults} new unique results`);
        
        // Show dog answers for this keyword
        const dogAnswers = keywordData.filter(r => 
          (r.fragment_text.includes('Romeo') || r.fragment_text.includes('Bucky')) && 
          r.fragment_text.length > 50
        );
        
        if (dogAnswers.length > 0) {
          console.log(`  🎉 Found ${dogAnswers.length} dog answers!`);
          dogAnswers.forEach((answer, i) => {
            console.log(`    ${i+1}. ${answer.fragment_text.substring(0, 80)}...`);
          });
        }
      }
    }
  }
  
  // Sort by similarity score and limit results
  allResults.sort((a, b) => b.similarity_score - a.similarity_score);
  allResults = allResults.slice(0, limit);
  
  console.log(`\n📊 Final combined results: ${allResults.length} total`);
  
  const finalDogAnswers = allResults.filter(r => 
    (r.fragment_text.includes('Romeo') || r.fragment_text.includes('Bucky')) && 
    r.fragment_text.length > 50
  );
  
  if (finalDogAnswers.length > 0) {
    console.log(`\n🎉 SUCCESS! Multi-keyword approach found ${finalDogAnswers.length} dog answers!`);
    console.log('\nFinal dog answers:');
    finalDogAnswers.forEach((answer, i) => {
      console.log(`${i+1}. [Score: ${answer.similarity_score}] ${answer.fragment_text.substring(0, 100)}...`);
    });
    
    console.log('\n✅ The memory service fix should now work correctly for Jonathan demo!');
  } else {
    console.log('\n⚠️  Multi-keyword approach still not finding dog answers.');
  }
  
  console.log('\nAll final results:');
  allResults.forEach((result, i) => {
    const isDogAnswer = (result.fragment_text.includes('Romeo') || result.fragment_text.includes('Bucky')) && result.fragment_text.length > 50;
    console.log(`${i+1}. [${result.match_type}] Score: ${result.similarity_score} ${isDogAnswer ? '🐕' : ''}`);
    console.log(`   ${result.fragment_text.substring(0, 100)}...`);
  });
}

testMultiKeywordApproach().catch(console.error);