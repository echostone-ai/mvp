#!/usr/bin/env node

/**
 * Debug Memory Database Content - Find out what's actually in the database
 * and why retrieval is only returning basic details
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const JONATHAN_AVATAR_ID = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';

async function debugDatabaseContent() {
  console.log('🔍 DEBUGGING MEMORY DATABASE CONTENT\n');
  console.log('=' .repeat(80) + '\n');
  
  // 1. Check total memory fragments for Jonathan
  console.log('1. TOTAL MEMORY FRAGMENTS FOR JONATHAN');
  console.log('-'.repeat(50));
  
  const { data: allMemories, error: allError } = await supabase
    .from('memory_fragments')
    .select('id, fragment_text, user_id, avatar_id, created_at, conversation_context')
    .eq('avatar_id', JONATHAN_AVATAR_ID)
    .order('created_at', { ascending: false });
    
  if (allError) {
    console.error('❌ Error fetching memories:', allError);
    return;
  }
  
  console.log(`📊 Total memories found: ${allMemories.length}`);
  
  if (allMemories.length === 0) {
    console.log('❌ NO MEMORIES FOUND! This is the root problem.');
    console.log('   The database is empty for this avatar.');
    return;
  }
  
  // 2. Analyze memory types
  console.log('\n2. MEMORY ANALYSIS BY TYPE');
  console.log('-'.repeat(50));
  
  const withUser = allMemories.filter(m => m.user_id);
  const withoutUser = allMemories.filter(m => !m.user_id);
  const withContext = allMemories.filter(m => m.conversation_context);
  
  console.log(`📈 Memories with user_id: ${withUser.length}`);
  console.log(`📈 Memories without user_id (bio facts): ${withoutUser.length}`);
  console.log(`📈 Memories with conversation_context: ${withContext.length}`);
  
  // 3. Show sample memories
  console.log('\n3. SAMPLE MEMORIES (First 10)');
  console.log('-'.repeat(50));
  
  allMemories.slice(0, 10).forEach((memory, i) => {
    const hasUser = memory.user_id ? '👤' : '🤖';
    const contextType = memory.conversation_context?.ctx_type || 'none';
    console.log(`${i + 1}. ${hasUser} [${contextType}] ${memory.fragment_text.substring(0, 100)}...`);
  });
  
  // 4. Search for specific content
  console.log('\n4. SEARCHING FOR SPECIFIC CONTENT');
  console.log('-'.repeat(50));
  
  const searchTerms = ['nirvana', 'music', 'dog', 'romeo', 'bucky', 'george', 'olive', 'poodle', 'valentine'];
  
  for (const term of searchTerms) {
    const matches = allMemories.filter(m => 
      m.fragment_text.toLowerCase().includes(term.toLowerCase())
    );
    console.log(`🔍 "${term}": ${matches.length} matches`);
    
    if (matches.length > 0 && matches.length <= 3) {
      matches.forEach((match, i) => {
        console.log(`   ${i + 1}. ${match.fragment_text}`);
      });
    }
  }
  
  // 5. Test current retrieval function
  console.log('\n5. TESTING CURRENT RETRIEVAL FUNCTION');
  console.log('-'.repeat(50));
  
  const testQueries = ['favorite music', 'dog', 'nirvana', 'romeo', 'how many dogs'];
  
  for (const query of testQueries) {
    console.log(`\n🔍 Testing query: "${query}"`);
    
    try {
      // Test enhanced function if it exists
      const { data: enhancedData, error: enhancedError } = await supabase.rpc('get_enhanced_memories', {
        target_user_id: null,
        target_avatar_id: JONATHAN_AVATAR_ID,
        search_query: query,
        match_count: 20,
        similarity_threshold: 0.1, // Very low threshold
        include_bio_facts: true
      });
      
      if (enhancedError) {
        console.log(`❌ Enhanced function error: ${enhancedError.message}`);
        
        // Fallback to basic search
        const { data: basicData, error: basicError } = await supabase
          .from('memory_fragments')
          .select('*')
          .eq('avatar_id', JONATHAN_AVATAR_ID)
          .ilike('fragment_text', `%${query}%`)
          .limit(10);
          
        if (basicError) {
          console.log(`❌ Basic search error: ${basicError.message}`);
        } else {
          console.log(`📊 Basic search returned: ${basicData.length} results`);
          basicData.slice(0, 3).forEach((result, i) => {
            console.log(`   ${i + 1}. ${result.fragment_text.substring(0, 80)}...`);
          });
        }
      } else {
        console.log(`📊 Enhanced function returned: ${enhancedData.length} results`);
        enhancedData.slice(0, 3).forEach((result, i) => {
          console.log(`   ${i + 1}. [${result.similarity_score?.toFixed(2) || 'N/A'}] ${result.fragment_text.substring(0, 80)}...`);
        });
      }
    } catch (err) {
      console.log(`❌ Query test failed: ${err.message}`);
    }
  }
  
  // 6. Check quick_facts table
  console.log('\n6. CHECKING QUICK_FACTS TABLE');
  console.log('-'.repeat(50));
  
  const { data: quickFacts, error: factsError } = await supabase
    .from('quick_facts')
    .select('*')
    .eq('avatar_id', JONATHAN_AVATAR_ID)
    .order('priority', { ascending: true });
    
  if (factsError) {
    console.log(`❌ Quick facts error: ${factsError.message}`);
  } else {
    console.log(`📊 Quick facts found: ${quickFacts.length}`);
    quickFacts.slice(0, 10).forEach((fact, i) => {
      console.log(`   ${i + 1}. [P${fact.priority}] ${fact.key}: ${fact.value}`);
    });
  }
  
  // 7. Recommendations
  console.log('\n7. DIAGNOSIS AND RECOMMENDATIONS');
  console.log('-'.repeat(50));
  
  if (allMemories.length === 0) {
    console.log('❌ ROOT CAUSE: No memories in database');
    console.log('📝 SOLUTION: Need to seed the database with Jonathan\'s memories');
  } else if (allMemories.length < 10) {
    console.log('⚠️  ROOT CAUSE: Very few memories in database');
    console.log('📝 SOLUTION: Need more comprehensive memory seeding');
  } else {
    console.log('✅ Database has memories, issue is likely in retrieval logic');
    
    const hasRichContent = allMemories.some(m => 
      m.fragment_text.length > 100 && 
      (m.fragment_text.includes('nirvana') || m.fragment_text.includes('dog') || m.fragment_text.includes('music'))
    );
    
    if (!hasRichContent) {
      console.log('⚠️  ISSUE: Memories exist but lack rich content');
      console.log('📝 SOLUTION: Need to improve memory content quality');
    } else {
      console.log('⚠️  ISSUE: Rich content exists but retrieval is failing');
      console.log('📝 SOLUTION: Fix retrieval function parameters');
    }
  }
}

debugDatabaseContent().catch(console.error);