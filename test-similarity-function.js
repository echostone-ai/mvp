// Test if the vector similarity function exists and works
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testSimilarityFunction() {
  console.log('Testing vector similarity function...\n');

  try {
    // Create a test embedding
    const testEmbedding = Array(1536).fill(0).map((_, i) => Math.sin(i * 0.01));
    
    console.log('1. Testing match_memory_fragments function...');
    
    const { data, error } = await supabase
      .rpc('match_memory_fragments', {
        query_embedding: testEmbedding,
        match_threshold: 0.1,
        match_count: 5
      });

    if (error) {
      if (error.message.includes('function match_memory_fragments')) {
        console.log('   ❌ Function does not exist');
        console.log('   → Need to create the function from: supabase/functions/match_memory_fragments.sql');
        return false;
      } else {
        console.log('   ⚠️  Function exists but error occurred:', error.message);
        return false;
      }
    } else {
      console.log('   ✅ Function exists and working');
      console.log('   → Found', data.length, 'matches');
      return true;
    }

  } catch (error) {
    console.error('   ❌ Test failed:', error.message);
    return false;
  }
}

testSimilarityFunction()
  .then(success => {
    console.log('\n📊 Function Status:', success ? '✅ Ready' : '❌ Needs Setup');
    process.exit(success ? 0 : 1);
  });