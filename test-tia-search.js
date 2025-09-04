// Test searching for the Tia memory specifically
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function testTiaSearch() {
  console.log('=== Testing Tia Memory Search ===\n');

  const avatarId = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';

  // 1. Search for Tia memory directly
  console.log('1. Searching for Tia memory directly...');
  const { data: tiaMemory, error: tiaError } = await supabase
    .from('memory_fragments')
    .select('*')
    .eq('avatar_id', avatarId)
    .ilike('fragment_text', '%Tia%')
    .limit(5);

  if (tiaError) {
    console.error('Error:', tiaError);
    return;
  }

  console.log(`Found ${tiaMemory?.length || 0} memories containing "Tia"`);
  tiaMemory?.forEach((memory, i) => {
    console.log(`\nTia Memory ${i + 1}:`);
    console.log(`Text: ${memory.fragment_text}`);
    console.log(`Context:`, JSON.stringify(memory.conversation_context, null, 2));
  });

  // 2. Search using the same conditions as the enhanced prompt builder
  console.log('\n2. Testing enhanced prompt builder search conditions...');
  
  const searchTerms = ['have', 'you', 'ever', 'married', 'marriage', 'wife', 'husband', 'partner', 'relationship', 'dating', 'together', 'girlfriend', 'boyfriend'];
  const orConditions = searchTerms.map(term => `fragment_text.ilike.%${term}%`);
  
  console.log(`Search conditions: ${orConditions.join(', ')}`);
  
  const { data: searchResults, error: searchError } = await supabase
    .from('memory_fragments')
    .select('id, fragment_text, created_at, conversation_context')
    .eq('avatar_id', avatarId)
    .or(orConditions.join(','))
    .order('created_at', { ascending: false })
    .limit(50); // Get more results to see if Tia memory is there

  if (searchError) {
    console.error('Search error:', searchError);
    return;
  }

  console.log(`\nFound ${searchResults?.length || 0} memories with enhanced search`);
  
  // Look for Tia memory in results
  const tiaInResults = searchResults?.find(memory => 
    memory.fragment_text.toLowerCase().includes('tia') || 
    memory.fragment_text.toLowerCase().includes('married my first girlfriend')
  );
  
  if (tiaInResults) {
    console.log('\n✅ Tia memory found in enhanced search results!');
    console.log(`Text: ${tiaInResults.fragment_text}`);
    console.log(`Context:`, JSON.stringify(tiaInResults.conversation_context, null, 2));
  } else {
    console.log('\n❌ Tia memory NOT found in enhanced search results');
    
    // Check if any memory contains "married" but not the user questions
    const marriedMemories = searchResults?.filter(memory => 
      memory.fragment_text.toLowerCase().includes('married') &&
      !memory.fragment_text.toLowerCase().includes('have you ever been married')
    );
    
    console.log(`\nFound ${marriedMemories?.length || 0} other memories containing "married":`);
    marriedMemories?.forEach((memory, i) => {
      console.log(`\nMarried Memory ${i + 1}:`);
      console.log(`Text: ${memory.fragment_text.substring(0, 200)}...`);
      console.log(`Context:`, JSON.stringify(memory.conversation_context, null, 2));
    });
  }

  // 3. Test if Tia memory matches individual search terms
  if (tiaMemory && tiaMemory.length > 0) {
    console.log('\n3. Testing if Tia memory matches individual search terms...');
    const tiaText = tiaMemory[0].fragment_text.toLowerCase();
    
    searchTerms.forEach(term => {
      const matches = tiaText.includes(term);
      console.log(`Term "${term}": ${matches ? '✅ MATCHES' : '❌ no match'}`);
    });
  }
}

testTiaSearch().catch(console.error);