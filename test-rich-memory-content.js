#!/usr/bin/env node

/**
 * Test Rich Memory Content - Validate that all 187 memories are accessible
 * and that the system returns detailed responses, not just basic facts
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const JONATHAN_AVATAR_ID = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';

async function testRichMemoryContent() {
  console.log('🎯 TESTING RICH MEMORY CONTENT RETRIEVAL\n');
  console.log('=' .repeat(80) + '\n');
  
  // 1. Verify database has rich content
  console.log('1. VERIFYING DATABASE CONTENT');
  console.log('-'.repeat(50));
  
  const { data: allMemories, error: allError } = await supabase
    .from('memory_fragments')
    .select('id, fragment_text, conversation_context')
    .eq('avatar_id', JONATHAN_AVATAR_ID)
    .order('created_at', { ascending: false });
    
  if (allError || !allMemories) {
    console.error('❌ Failed to fetch memories:', allError);
    return;
  }
  
  console.log(`📊 Total memories: ${allMemories.length}`);
  
  // Analyze content richness
  const richMemories = allMemories.filter(m => m.fragment_text.length > 100);
  const detailedMemories = allMemories.filter(m => 
    m.fragment_text.length > 200 || 
    m.fragment_text.includes('—') || 
    m.fragment_text.includes('Valentine') ||
    m.fragment_text.includes('emotion') ||
    m.fragment_text.includes('companionship')
  );
  
  console.log(`📈 Rich memories (>100 chars): ${richMemories.length}`);
  console.log(`📈 Detailed memories (>200 chars or rich content): ${detailedMemories.length}`);
  
  // Show examples of rich content
  console.log('\n📝 Examples of rich content:');
  detailedMemories.slice(0, 3).forEach((memory, i) => {
    console.log(`   ${i + 1}. ${memory.fragment_text}`);
  });
  
  // 2. Test enhanced retrieval function
  console.log('\n2. TESTING ENHANCED RETRIEVAL FUNCTION');
  console.log('-'.repeat(50));
  
  const testQueries = [
    {
      query: 'favorite music',
      expectedRichTerms: ['nirvana', 'sound', 'emotion', 'kurt', 'cobain'],
      description: 'Should return detailed Nirvana preference with emotional context'
    },
    {
      query: 'romeo poodle',
      expectedRichTerms: ['valentine', 'day', '2024', 'tiny', 'personality', 'joy'],
      description: 'Should return detailed Romeo description with birth date and personality'
    },
    {
      query: 'bucky first dog',
      expectedRichTerms: ['golden', 'retriever', 'companionship', 'responsibility', 'taught'],
      description: 'Should return detailed Bucky story with breed and lessons learned'
    }
  ];
  
  for (const test of testQueries) {
    console.log(`\n🔍 Testing: "${test.query}"`);
    console.log(`Expected: ${test.description}`);
    
    try {
      const { data: memories, error } = await supabase.rpc('get_enhanced_memories', {
        target_user_id: null,
        target_avatar_id: JONATHAN_AVATAR_ID,
        search_query: test.query,
        match_count: 20,
        similarity_threshold: 0.1, // Very low to catch everything
        include_bio_facts: true
      });
      
      if (error) {
        console.log(`❌ Retrieval failed: ${error.message}`);
        continue;
      }
      
      console.log(`📊 Retrieved ${memories.length} memories`);
      
      if (memories.length === 0) {
        console.log('❌ No memories retrieved - this is the problem!');
        continue;
      }
      
      // Analyze richness of retrieved content
      const retrievedText = memories.map(m => m.fragment_text).join(' ').toLowerCase();
      let richTermsFound = 0;
      
      for (const term of test.expectedRichTerms) {
        if (retrievedText.includes(term.toLowerCase())) {
          richTermsFound++;
          console.log(`  ✅ Found rich term: "${term}"`);
        } else {
          console.log(`  ⚠️  Missing rich term: "${term}"`);
        }
      }
      
      const richness = richTermsFound / test.expectedRichTerms.length;
      console.log(`  📊 Richness score: ${Math.round(richness * 100)}% (${richTermsFound}/${test.expectedRichTerms.length})`);
      
      // Show top results
      console.log('  🔍 Top 3 results:');
      memories.slice(0, 3).forEach((memory, i) => {
        const score = memory.similarity_score?.toFixed(2) || 'N/A';
        const preview = memory.fragment_text.substring(0, 120) + (memory.fragment_text.length > 120 ? '...' : '');
        console.log(`    ${i + 1}. [${score}] ${preview}`);
      });
      
      // Check if we have rich content
      const hasRichContent = memories.some(m => 
        m.fragment_text.length > 100 && 
        test.expectedRichTerms.some(term => 
          m.fragment_text.toLowerCase().includes(term.toLowerCase())
        )
      );
      
      if (hasRichContent) {
        console.log('  ✅ RICH CONTENT FOUND: Retrieval is working properly');
      } else {
        console.log('  ❌ ONLY BASIC CONTENT: Retrieval needs improvement');
      }
      
    } catch (err) {
      console.log(`❌ Test failed: ${err.message}`);
    }
  }
  
  // 3. Test prompt building with memory injection
  console.log('\n3. TESTING MEMORY INJECTION IN PROMPTS');
  console.log('-'.repeat(50));
  
  // Simulate what the prompt builder should do
  const { data: musicMemories } = await supabase.rpc('get_enhanced_memories', {
    target_user_id: null,
    target_avatar_id: JONATHAN_AVATAR_ID,
    search_query: 'favorite music',
    match_count: 10,
    similarity_threshold: 0.2,
    include_bio_facts: true
  });
  
  if (musicMemories && musicMemories.length > 0) {
    console.log('✅ Memory injection test:');
    console.log(`   Retrieved ${musicMemories.length} music memories for prompt injection`);
    
    // Build a sample prompt section
    const memorySection = musicMemories.slice(0, 5).map((memory, i) => {
      return `- Memory ${i + 1}: ${memory.fragment_text}`;
    }).join('\n');
    
    console.log('\n📝 Sample prompt section with injected memories:');
    console.log('```');
    console.log('RELEVANT MEMORIES:');
    console.log(memorySection);
    console.log('```');
    
    // Check if this would produce rich responses
    const totalMemoryText = musicMemories.map(m => m.fragment_text).join(' ');
    const hasNirvanaDetails = totalMemoryText.toLowerCase().includes('nirvana') && 
                             (totalMemoryText.includes('sound') || totalMemoryText.includes('emotion'));
    
    if (hasNirvanaDetails) {
      console.log('\n✅ RICH PROMPT: This would produce detailed Nirvana responses');
    } else {
      console.log('\n❌ BASIC PROMPT: This would only produce generic responses');
    }
  } else {
    console.log('❌ Memory injection failed - no memories retrieved');
  }
  
  // 4. Recommendations
  console.log('\n4. DIAGNOSIS AND RECOMMENDATIONS');
  console.log('-'.repeat(50));
  
  const totalRichMemories = allMemories.filter(m => m.fragment_text.length > 100).length;
  const retrievalWorking = musicMemories && musicMemories.length > 0;
  
  if (totalRichMemories > 50 && retrievalWorking) {
    console.log('✅ SYSTEM STATUS: Database has rich content and retrieval is working');
    console.log('📝 ISSUE: Problem may be in prompt building or API response generation');
    console.log('🔧 SOLUTION: Check enhanced prompt builder and streaming response logic');
  } else if (totalRichMemories > 50 && !retrievalWorking) {
    console.log('⚠️  SYSTEM STATUS: Database has rich content but retrieval is failing');
    console.log('📝 ISSUE: Enhanced memory function or similarity thresholds');
    console.log('🔧 SOLUTION: Fix get_enhanced_memories function parameters');
  } else {
    console.log('❌ SYSTEM STATUS: Database lacks rich content');
    console.log('📝 ISSUE: Need to seed more detailed memories');
    console.log('🔧 SOLUTION: Import comprehensive memory dataset');
  }
}

async function runRichContentTest() {
  try {
    await testRichMemoryContent();
  } catch (error) {
    console.error('❌ Rich content test failed:', error);
  }
}

// Run test
runRichContentTest().catch(console.error);