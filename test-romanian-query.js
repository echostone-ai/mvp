#!/usr/bin/env node

/**
 * Test Romanian Query - Specific test for the multilingual memory
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const JONATHAN_AVATAR_ID = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';

async function testRomanianQuery() {
  console.log('🔍 TESTING ROMANIAN LANGUAGE QUERY\n');
  
  // 1. Verify the multilingual memory exists
  console.log('1. CHECKING FOR MULTILINGUAL MEMORY');
  console.log('-'.repeat(50));
  
  const { data: multilingualMemories, error: multiError } = await supabase
    .from('memory_fragments')
    .select('id, fragment_text, user_id')
    .eq('avatar_id', JONATHAN_AVATAR_ID)
    .or('fragment_text.ilike.%romanian%,fragment_text.ilike.%hungarian%,fragment_text.ilike.%bulgarian%,fragment_text.ilike.%multilingual%,fragment_text.ilike.%french%,fragment_text.ilike.%spanish%')
    .limit(10);
    
  if (multiError) {
    console.error('❌ Error fetching multilingual memories:', multiError);
    return;
  }
  
  console.log(`📊 Found ${multilingualMemories.length} multilingual memories`);
  
  if (multilingualMemories.length > 0) {
    console.log('📝 Multilingual memories:');
    multilingualMemories.forEach((memory, i) => {
      const hasUser = memory.user_id ? '👤' : '🤖';
      console.log(`   ${i + 1}. ${hasUser} ${memory.fragment_text.substring(0, 150)}...`);
    });
  } else {
    console.log('❌ No multilingual memories found');
    return;
  }
  
  // 2. Test enhanced retrieval for Romanian
  console.log('\n2. TESTING ENHANCED RETRIEVAL FOR ROMANIAN');
  console.log('-'.repeat(50));
  
  const queries = ['romanian', 'speak romanian', 'do you speak romanian', 'languages'];
  
  for (const query of queries) {
    console.log(`\n🔍 Testing query: "${query}"`);
    
    try {
      const { data: enhancedData, error: enhancedError } = await supabase.rpc('get_enhanced_memories', {
        target_user_id: null,
        target_avatar_id: JONATHAN_AVATAR_ID,
        search_query: query,
        match_count: 10,
        similarity_threshold: 0.1,
        include_bio_facts: true
      });
      
      if (enhancedError) {
        console.log(`❌ Enhanced retrieval failed: ${enhancedError.message}`);
      } else {
        console.log(`📊 Enhanced retrieval: ${enhancedData.length} results`);
        
        if (enhancedData.length > 0) {
          const hasRomanian = enhancedData.some(m => 
            m.fragment_text.toLowerCase().includes('romanian')
          );
          console.log(`   Contains Romanian info: ${hasRomanian ? '✅' : '❌'}`);
          
          if (hasRomanian) {
            console.log('   📝 Romanian memory found:');
            enhancedData.filter(m => m.fragment_text.toLowerCase().includes('romanian'))
              .forEach((memory, i) => {
                console.log(`      ${i + 1}. ${memory.fragment_text.substring(0, 100)}...`);
              });
          }
        }
      }
    } catch (err) {
      console.log(`❌ Enhanced retrieval error: ${err.message}`);
    }
  }
  
  // 3. Test API response
  console.log('\n3. TESTING API RESPONSE FOR ROMANIAN QUERY');
  console.log('-'.repeat(50));
  
  try {
    const response = await fetch('http://localhost:3000/api/demo-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: "Do you speak Romanian?",
        debug: true
      })
    });

    if (!response.ok) {
      console.error(`❌ API request failed: ${response.status} ${response.statusText}`);
      return;
    }

    // Read the streaming response
    const reader = response.body?.getReader();
    if (!reader) {
      console.error('❌ No response body reader available');
      return;
    }

    let fullResponse = '';
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      fullResponse += chunk;
    }

    console.log(`✅ Response received (${fullResponse.length} chars)`);
    
    // Parse the JSON response
    let responseData;
    try {
      responseData = JSON.parse(fullResponse);
    } catch (parseError) {
      console.log('Raw response:', fullResponse);
      console.error('❌ Failed to parse JSON response:', parseError.message);
      return;
    }
    
    console.log(`📝 Response: "${responseData.text}"`);
    console.log(`📊 Memories count: ${responseData.metadata?.memories_count || 0}`);
    
    // Check if Romanian is mentioned
    const lowerResponse = responseData.text.toLowerCase();
    const mentionsRomanian = lowerResponse.includes('romanian');
    const mentionsLanguages = lowerResponse.includes('french') || 
                             lowerResponse.includes('spanish') || 
                             lowerResponse.includes('bulgarian') ||
                             lowerResponse.includes('hungarian');
    
    console.log(`\n📊 CONTENT ANALYSIS:`);
    console.log(`Mentions Romanian: ${mentionsRomanian ? '✅' : '❌'}`);
    console.log(`Mentions other languages: ${mentionsLanguages ? '✅' : '❌'}`);
    
    if (mentionsRomanian) {
      console.log('🎉 SUCCESS: Romanian memory retrieved and used!');
    } else if (mentionsLanguages) {
      console.log('⚠️  PARTIAL: Other languages mentioned but not Romanian specifically');
    } else {
      console.log('❌ FAILURE: No language information in response');
      console.log('   This confirms the enhanced memory function is not working');
    }
    
  } catch (error) {
    console.error(`❌ API test failed: ${error.message}`);
    console.log('\n⚠️ Make sure the development server is running: npm run dev');
  }
  
  console.log('\n📋 DIAGNOSIS:');
  console.log('If the API response mentions Romanian/languages, the fix is working.');
  console.log('If not, the enhanced memory function needs the SQL fix from MANUAL_SQL_FIX.md');
}

testRomanianQuery().catch(console.error);