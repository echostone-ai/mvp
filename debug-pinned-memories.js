#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function debugPinnedMemories() {
  console.log('🔍 Debugging pinned memories for Austin query...');
  
  const avatarId = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
  const query = 'When did you live in Austin?';
  
  try {
    // Test the exact call used by the chat route for pinned memories
    console.log('\n📌 Testing pinned memory call (match_count: 10, threshold: 0.1)...');
    const { data: pinnedMemories, error } = await supabase.rpc('get_enhanced_memories', {
      target_user_id: null,
      target_avatar_id: avatarId,
      search_query: query,
      match_count: 10,
      similarity_threshold: 0.1
    });
    
    if (error) {
      console.error('Pinned memory error:', error);
      return;
    }
    
    console.log(`Found ${pinnedMemories?.length || 0} pinned memories`);
    
    if (pinnedMemories && pinnedMemories.length > 0) {
      console.log('\n📝 Pinned memory details:');
      pinnedMemories.forEach((memory, i) => {
        const context = memory.conversation_context || {};
        const hasAustin = memory.fragment_text?.toLowerCase().includes('austin');
        const hasYears = memory.fragment_text?.match(/(2009|2018|\d{4}[-–]\d{4})/);
        
        console.log(`\n${i + 1}. Similarity: ${memory.similarity_score || 'N/A'}`);
        console.log(`   Type: ${context.type || 'unknown'}`);
        console.log(`   Has Austin: ${hasAustin ? '✅' : '❌'}`);
        console.log(`   Has Years: ${hasYears ? '✅ ' + hasYears[0] : '❌'}`);
        console.log(`   Text: "${memory.fragment_text?.substring(0, 150)}..."`);
      });
      
      // Check if Austin biographical memory is in the results
      const austinBioMemory = pinnedMemories.find(m => 
        m.fragment_text?.toLowerCase().includes('austin') && 
        m.fragment_text?.includes('2009')
      );
      
      if (austinBioMemory) {
        console.log('\n✅ Found Austin biographical memory!');
        console.log(`   Position: ${pinnedMemories.indexOf(austinBioMemory) + 1}`);
        console.log(`   Text: "${austinBioMemory.fragment_text}"`);
      } else {
        console.log('\n❌ Austin biographical memory not found in pinned results');
        
        // Check if it exists at all
        const { data: directAustin } = await supabase
          .from('memory_fragments')
          .select('*')
          .eq('avatar_id', avatarId)
          .ilike('fragment_text', '%austin%2009%');
        
        if (directAustin && directAustin.length > 0) {
          console.log('   But it exists in database:');
          console.log(`   "${directAustin[0].fragment_text}"`);
        }
      }
    }
    
  } catch (error) {
    console.error('Debug error:', error);
  }
}

debugPinnedMemories();