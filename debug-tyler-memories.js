#!/usr/bin/env node

/**
 * Debug Tyler Memories - Check what exists in the database for Tyler
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const JONATHAN_AVATAR_ID = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';

async function debugTylerMemories() {
  console.log('🔍 DEBUGGING TYLER MEMORIES\n');
  
  // 1. Search for Tyler-related memories
  console.log('1. SEARCHING FOR TYLER MEMORIES');
  console.log('-'.repeat(50));
  
  const { data: tylerMemories, error: tylerError } = await supabase
    .from('memory_fragments')
    .select('id, fragment_text, conversation_context, user_id, created_at')
    .eq('avatar_id', JONATHAN_AVATAR_ID)
    .or('fragment_text.ilike.%tyler%,fragment_text.ilike.%friend%')
    .order('created_at', { ascending: false });
    
  if (tylerError) {
    console.error('❌ Error fetching Tyler memories:', tylerError);
    return;
  }
  
  console.log(`📊 Found ${tylerMemories.length} Tyler/friend-related memories`);
  
  if (tylerMemories.length === 0) {
    console.log('❌ NO TYLER MEMORIES FOUND - This is the problem!');
    console.log('   The system has no information about Tyler to retrieve.');
    
    // Check if there are any friend-related memories at all
    const { data: friendMemories } = await supabase
      .from('memory_fragments')
      .select('id, fragment_text')
      .eq('avatar_id', JONATHAN_AVATAR_ID)
      .or('fragment_text.ilike.%friend%,fragment_text.ilike.%buddy%,fragment_text.ilike.%pal%')
      .limit(10);
      
    console.log(`📊 Found ${friendMemories?.length || 0} general friend memories`);
    
    if (friendMemories && friendMemories.length > 0) {
      console.log('📝 Sample friend memories:');
      friendMemories.slice(0, 5).forEach((memory, i) => {
        console.log(`   ${i + 1}. ${memory.fragment_text}`);
      });
    }
    
    return;
  }
  
  // Show Tyler memories
  console.log('📝 Tyler-related memories found:');
  tylerMemories.forEach((memory, i) => {
    const hasUser = memory.user_id ? '👤' : '🤖';
    console.log(`   ${i + 1}. ${hasUser} ${memory.fragment_text}`);
  });
  
  // 2. Test enhanced retrieval for Tyler
  console.log('\n2. TESTING ENHANCED RETRIEVAL FOR TYLER');
  console.log('-'.repeat(50));
  
  try {
    const { data: enhancedData, error: enhancedError } = await supabase.rpc('get_enhanced_memories', {
      target_user_id: null,
      target_avatar_id: JONATHAN_AVATAR_ID,
      search_query: 'tyler friend',
      match_count: 20,
      similarity_threshold: 0.1,
      include_bio_facts: true
    });
    
    if (enhancedError) {
      console.log(`❌ Enhanced retrieval failed: ${enhancedError.message}`);
    } else {
      console.log(`📊 Enhanced retrieval returned: ${enhancedData.length} results`);
      
      if (enhancedData.length > 0) {
        console.log('📝 Enhanced results:');
        enhancedData.slice(0, 5).forEach((memory, i) => {
          console.log(`   ${i + 1}. [${memory.similarity_score?.toFixed(2)}] ${memory.fragment_text.substring(0, 100)}...`);
        });
      }
    }
  } catch (err) {
    console.log(`❌ Enhanced retrieval test failed: ${err.message}`);
  }
  
  // 3. Test fallback search
  console.log('\n3. TESTING FALLBACK SEARCH FOR TYLER');
  console.log('-'.repeat(50));
  
  const searchTerms = ['tyler', 'friend', 'buddy', 'pal'];
  const orConditions = searchTerms.map(term => `fragment_text.ilike.%${term}%`);
  
  const { data: fallbackData, error: fallbackError } = await supabase
    .from('memory_fragments')
    .select('id, fragment_text, user_id')
    .eq('avatar_id', JONATHAN_AVATAR_ID)
    .or(orConditions.join(','))
    .limit(10);
    
  if (fallbackError) {
    console.log(`❌ Fallback search failed: ${fallbackError.message}`);
  } else {
    console.log(`📊 Fallback search returned: ${fallbackData.length} results`);
    
    if (fallbackData.length > 0) {
      console.log('📝 Fallback results:');
      fallbackData.forEach((memory, i) => {
        const hasUser = memory.user_id ? '👤' : '🤖';
        console.log(`   ${i + 1}. ${hasUser} ${memory.fragment_text}`);
      });
    }
  }
  
  // 4. Check deep lane cancellation issue
  console.log('\n4. ANALYZING DEEP LANE CANCELLATION');
  console.log('-'.repeat(50));
  
  const query = 'tell me about your friend tyler';
  const isProfileQuery = /\b(favorite|prefer|like|love|music|band|artist|dog|pet|family|parents|work|job|hobby|interest)\b/i.test(query);
  const isCountQuery = /\b(how many|count|number of|total)\b/i.test(query);
  const isMemoryProbe = isProfileQuery || isCountQuery || /\b(tell me about|describe|what|who|when|where|how many)\b/i.test(query);
  
  console.log(`Query: "${query}"`);
  console.log(`Is profile query: ${isProfileQuery}`);
  console.log(`Is count query: ${isCountQuery}`);
  console.log(`Is memory probe: ${isMemoryProbe}`);
  console.log(`Should disable fast mode: ${isMemoryProbe}`);
  
  if (!isMemoryProbe) {
    console.log('❌ ISSUE: Query not detected as memory probe - fast mode will be enabled');
    console.log('🔧 SOLUTION: Need to enhance memory probe detection');
  } else {
    console.log('✅ Query correctly detected as memory probe - fast mode should be disabled');
  }
  
  // 5. Recommendations
  console.log('\n5. RECOMMENDATIONS');
  console.log('-'.repeat(50));
  
  if (tylerMemories.length === 0) {
    console.log('❌ ROOT CAUSE: No Tyler memories in database');
    console.log('📝 SOLUTIONS:');
    console.log('   1. Add Tyler memories to the database');
    console.log('   2. Improve fallback to handle "I don\'t know Tyler" gracefully');
    console.log('   3. Suggest asking for more information about Tyler');
  } else {
    console.log('✅ Tyler memories exist in database');
    console.log('📝 ISSUE: Deep lane cancellation preventing memory retrieval');
    console.log('🔧 SOLUTIONS:');
    console.log('   1. Fix memory probe detection for friend queries');
    console.log('   2. Ensure enhanced retrieval function works for Tyler');
    console.log('   3. Improve fallback search reliability');
  }
}

debugTylerMemories().catch(console.error);