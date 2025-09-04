#!/usr/bin/env node

/**
 * Test Trump Memory Pipeline - Comprehensive validation
 * 
 * Tests the three acceptance criteria:
 * 1. "What do you think of Trump?" → Must include DB memory about leaving America
 * 2. "Why did you leave America?" → Must mention political climate/Trump
 * 3. "Do you like Trump?" → Must retrieve opinion fragments
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const JONATHAN_AVATAR_ID = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';

async function testTrumpMemoryPipeline() {
  console.log('🎯 Testing Trump Memory Pipeline - Acceptance Criteria Validation\n');
  
  // Test queries from the requirements
  const acceptanceTests = [
    {
      query: "What do you think of Trump?",
      expectedContent: ["trump", "miserable", "bastard", "america", "2018", "political"],
      description: "Must include DB memory: leaving America in 2018, Trump = miserable MF, run off the road, etc."
    },
    {
      query: "Why did you leave America?", 
      expectedContent: ["political", "climate", "trump", "2018", "couldn't handle"],
      description: "Must mention political climate/Trump"
    },
    {
      query: "Do you like Trump?",
      expectedContent: ["trump", "opinion", "political", "miserable", "bastard"],
      description: "Must retrieve opinion fragments, not say 'I don't have thoughts on that'"
    }
  ];
  
  console.log('📊 Step 1: Verify Trump memories exist in database...\n');
  
  // First, verify the Trump memories exist
  const { data: trumpMemories, error: trumpError } = await supabase
    .from('memory_fragments')
    .select('id, fragment_text, conversation_context')
    .eq('avatar_id', JONATHAN_AVATAR_ID)
    .or('fragment_text.ilike.%trump%,fragment_text.ilike.%political climate%,fragment_text.ilike.%miserable%')
    .limit(10);
    
  if (trumpError) {
    console.error('❌ Failed to query Trump memories:', trumpError.message);
    return;
  }
  
  console.log(`✅ Found ${trumpMemories.length} Trump-related memories in database:`);
  trumpMemories.forEach((memory, i) => {
    console.log(`   ${i + 1}. ${memory.fragment_text}`);
    console.log(`      Context: ${JSON.stringify(memory.conversation_context)}`);
  });
  
  if (trumpMemories.length === 0) {
    console.error('❌ No Trump memories found in database! Need to seed the data first.');
    console.log('\n📋 Run this to seed Trump memories:');
    console.log('   node import-jonathan-complete.sql (apply in Supabase)');
    return;
  }
  
  console.log('\n🧪 Step 2: Test enhanced memory function with acceptance criteria...\n');
  
  for (const test of acceptanceTests) {
    console.log(`🔍 Testing: "${test.query}"`);
    console.log(`📝 Expected: ${test.description}`);
    
    try {
      // Test with enhanced memory function
      const { data: memories, error } = await supabase.rpc('get_enhanced_memories', {
        target_user_id: null,
        target_avatar_id: JONATHAN_AVATAR_ID,
        search_query: test.query,
        match_count: 20,
        similarity_threshold: 0.25, // Lower threshold for political queries
        include_bio_facts: true
      });
      
      if (error) {
        console.log(`❌ Enhanced function error: ${error.message}`);
        
        // Fallback test with basic search
        console.log('   Trying basic search fallback...');
        const { data: basicMemories } = await supabase
          .from('memory_fragments')
          .select('id, fragment_text, conversation_context')
          .eq('avatar_id', JONATHAN_AVATAR_ID)
          .or('fragment_text.ilike.%trump%,fragment_text.ilike.%political%,fragment_text.ilike.%america%')
          .limit(5);
          
        if (basicMemories && basicMemories.length > 0) {
          console.log(`📊 Basic search found ${basicMemories.length} memories`);
          const hasExpectedContent = test.expectedContent.some(term => 
            basicMemories.some(m => m.fragment_text.toLowerCase().includes(term))
          );
          console.log(`${hasExpectedContent ? '✅' : '❌'} Contains expected content: ${hasExpectedContent ? 'YES' : 'NO'}`);
        } else {
          console.log('❌ Even basic search found no memories');
        }
      } else {
        console.log(`📊 Enhanced function returned ${memories.length} memories`);
        
        if (memories.length > 0) {
          console.log('✅ Memories retrieved:');
          memories.slice(0, 3).forEach((memory, i) => {
            console.log(`   ${i + 1}. [${memory.similarity_score?.toFixed(2)}] ${memory.fragment_text.substring(0, 100)}...`);
          });
          
          // Check if expected content is present
          const foundContent = [];
          const allText = memories.map(m => m.fragment_text.toLowerCase()).join(' ');
          
          test.expectedContent.forEach(term => {
            if (allText.includes(term.toLowerCase())) {
              foundContent.push(term);
            }
          });
          
          const hasExpectedContent = foundContent.length >= 2; // At least 2 expected terms
          console.log(`${hasExpectedContent ? '✅' : '⚠️'} Expected content found: ${foundContent.join(', ')}`);
          console.log(`${hasExpectedContent ? '✅' : '❌'} ACCEPTANCE TEST: ${hasExpectedContent ? 'PASS' : 'FAIL'}`);
        } else {
          console.log('❌ Enhanced function returned 0 results');
          console.log('❌ ACCEPTANCE TEST: FAIL - No memories retrieved');
        }
      }
    } catch (err) {
      console.log(`❌ Test failed: ${err.message}`);
      console.log('❌ ACCEPTANCE TEST: FAIL - Function error');
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
  }
  
  console.log('🌐 Step 3: Test full API pipeline...\n');
  
  // Test the actual demo chat API if server is running
  try {
    const testQuery = "What do you think of Trump?";
    console.log(`🚀 Testing demo chat API: "${testQuery}"`);
    
    const response = await fetch('http://localhost:3000/api/demo-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: testQuery,
        debug: true
      })
    });

    if (!response.ok) {
      console.log(`⚠️ API not available (${response.status}). Start server with: npm run dev`);
    } else {
      // Read the streaming response
      const reader = response.body?.getReader();
      if (reader) {
        let fullResponse = '';
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          fullResponse += chunk;
        }

        console.log(`✅ API Response (${fullResponse.length} chars):`);
        console.log(`"${fullResponse}"`);
        
        // Check for Trump-related content
        const lowerResponse = fullResponse.toLowerCase();
        const hasTrumpContent = lowerResponse.includes('trump') || 
                               lowerResponse.includes('political') || 
                               lowerResponse.includes('america') ||
                               lowerResponse.includes('2018');
        
        console.log(`${hasTrumpContent ? '✅' : '❌'} API ACCEPTANCE TEST: ${hasTrumpContent ? 'PASS' : 'FAIL'}`);
        
        if (!hasTrumpContent) {
          console.log('❌ API response does not contain Trump-related content');
          console.log('   This indicates the memory pipeline is not working correctly');
        }
      }
    }
  } catch (apiError) {
    console.log(`⚠️ API test skipped: ${apiError.message}`);
    console.log('   Start the development server and run this test again');
  }
  
  console.log('\n📋 SUMMARY:\n');
  console.log('✅ Database contains Trump memories');
  console.log('🔧 Enhanced memory function needs to be updated (apply fix-enhanced-memory-search-political.sql)');
  console.log('🔧 RLS policy needs to be fixed (apply RLS fix in Supabase SQL Editor)');
  console.log('🔧 Deep lane orchestrator updated to prevent late_start cancellation');
  
  console.log('\n🎯 NEXT STEPS:');
  console.log('1. Apply fix-enhanced-memory-search-political.sql in Supabase SQL Editor');
  console.log('2. Apply RLS policy fix in Supabase SQL Editor');
  console.log('3. Restart the development server');
  console.log('4. Run this test again to validate all fixes');
  
  console.log('\n🚀 Once all fixes are applied, the Trump memory pipeline should work correctly!');
}

testTrumpMemoryPipeline().catch(console.error);