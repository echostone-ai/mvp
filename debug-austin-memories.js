#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function debugAustinMemories() {
  console.log('🔍 Debugging Austin memories...');
  
  const avatarId = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
  const query = 'When did you live in Austin?';
  
  try {
    // Test the same RPC call that the chat route uses
    console.log('\n1. Testing get_enhanced_memories RPC...');
    const { data: memories, error } = await supabase.rpc('get_enhanced_memories', {
      target_user_id: null,
      target_avatar_id: avatarId,
      search_query: query,
      match_count: 10,
      similarity_threshold: 0.2
    });
    
    if (error) {
      console.error('RPC Error:', error);
      return;
    }
    
    console.log(`Found ${memories?.length || 0} memories`);
    
    if (memories && memories.length > 0) {
      console.log('\n📝 Memory samples:');
      memories.slice(0, 5).forEach((memory, i) => {
        console.log(`\n${i + 1}. Similarity: ${memory.similarity_score || 'N/A'}`);
        console.log(`   Context: ${JSON.stringify(memory.conversation_context || {})}`);
        console.log(`   Text: "${memory.fragment_text?.substring(0, 200)}..."`);
      });
    }
    
    // Also search for Austin specifically
    console.log('\n2. Searching specifically for Austin...');
    const { data: austinMemories, error: austinError } = await supabase
      .from('memory_fragments')
      .select('*')
      .eq('avatar_id', avatarId)
      .ilike('fragment_text', '%austin%')
      .limit(5);
    
    if (austinError) {
      console.error('Austin search error:', austinError);
    } else {
      console.log(`Found ${austinMemories?.length || 0} Austin-specific memories`);
      
      if (austinMemories && austinMemories.length > 0) {
        console.log('\n🏙️ Austin memories:');
        austinMemories.forEach((memory, i) => {
          console.log(`\n${i + 1}. Created: ${memory.created_at}`);
          console.log(`   Context: ${JSON.stringify(memory.conversation_context || {})}`);
          console.log(`   Text: "${memory.fragment_text}"`);
        });
      }
    }
    
    // Search for biographical data
    console.log('\n3. Searching for biographical data...');
    const { data: bioMemories, error: bioError } = await supabase
      .from('memory_fragments')
      .select('*')
      .eq('avatar_id', avatarId)
      .or('fragment_text.ilike.%2009%,fragment_text.ilike.%2018%,fragment_text.ilike.%lived%,fragment_text.ilike.%moved%')
      .limit(10);
    
    if (bioError) {
      console.error('Bio search error:', bioError);
    } else {
      console.log(`Found ${bioMemories?.length || 0} biographical memories`);
      
      if (bioMemories && bioMemories.length > 0) {
        console.log('\n📚 Biographical memories:');
        bioMemories.forEach((memory, i) => {
          console.log(`\n${i + 1}. Created: ${memory.created_at}`);
          console.log(`   Context: ${JSON.stringify(memory.conversation_context || {})}`);
          console.log(`   Text: "${memory.fragment_text}"`);
        });
      }
    }
    
  } catch (error) {
    console.error('Debug error:', error);
  }
}

debugAustinMemories();