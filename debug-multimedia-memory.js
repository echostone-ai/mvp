// Debug script to find where the multimedia storytelling content is coming from
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugMultimediaMemory() {
  const DEMO_AVATAR_ID = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';

  console.log('=== DEBUGGING MULTIMEDIA STORYTELLING MEMORY ===');
  console.log('');

  // Find the exact memory containing the multimedia storytelling content
  const { data: multimediaMemories, error } = await supabase
    .from('memory_fragments')
    .select('*')
    .eq('avatar_id', DEMO_AVATAR_ID)
    .ilike('fragment_text', '%multimedia storytelling%');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${multimediaMemories.length} memories containing "multimedia storytelling":`);
  
  multimediaMemories.forEach((memory, index) => {
    console.log(`\\n=== Memory ${index + 1} ===`);
    console.log(`ID: ${memory.id}`);
    console.log(`Type: ${memory.conversation_context?.type || 'unknown'}`);
    console.log(`Created: ${memory.created_at}`);
    console.log(`Full text: ${memory.fragment_text}`);
    console.log(`Context: ${JSON.stringify(memory.conversation_context, null, 2)}`);
  });

  // Now test if this memory would be returned in a semantic search for "Tell me about Olive"
  console.log('\\n=== TESTING SEMANTIC SEARCH FOR OLIVE ===');
  
  const { data: semanticResults, error: semanticError } = await supabase.rpc('get_enhanced_memories', {
    target_user_id: null,
    target_avatar_id: DEMO_AVATAR_ID,
    search_query: 'Tell me about Olive',
    match_count: 10,
    similarity_threshold: 0.1
  });

  if (semanticError) {
    console.error('Semantic search error:', semanticError);
    return;
  }

  console.log(`\\nSemantic search for "Tell me about Olive" returned ${semanticResults.length} results:`);
  
  const multimediaIds = new Set(multimediaMemories.map(m => m.id));
  let foundMultimedia = false;
  
  semanticResults.forEach((result, index) => {
    const isMultimedia = multimediaIds.has(result.id);
    if (isMultimedia) foundMultimedia = true;
    
    console.log(`\\n  ${index + 1}. ${isMultimedia ? '*** MULTIMEDIA MEMORY ***' : ''}`);
    console.log(`     ID: ${result.id}`);
    console.log(`     Similarity: ${result.similarity_score}`);
    console.log(`     Type: ${result.conversation_context?.type || 'unknown'}`);
    console.log(`     Text: ${result.fragment_text.substring(0, 150)}...`);
  });

  if (foundMultimedia) {
    console.log('\\n*** FOUND THE PROBLEM: Multimedia memory is being returned in semantic search for Olive! ***');
  } else {
    console.log('\\n*** Multimedia memory is NOT in semantic search results for Olive ***');
  }

  console.log('\\n=== DEBUG COMPLETE ===');
}

debugMultimediaMemory().catch(console.error);