#!/usr/bin/env node

/**
 * Complete Tyler Query Test - Test the entire pipeline for Tyler queries
 */

require('dotenv').config({ path: '.env.local' });

async function testTylerQueryComplete() {
  console.log('🎯 COMPLETE TYLER QUERY TEST\n');
  
  // Test the actual API endpoint
  console.log('1. TESTING DEMO CHAT API WITH TYLER QUERY');
  console.log('-'.repeat(60));
  
  try {
    const response = await fetch('http://localhost:3000/api/demo-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: "tell me about your friend tyler",
        debug: true
      })
    });

    if (!response.ok) {
      console.error(`❌ API request failed: ${response.status} ${response.statusText}`);
      
      // Try to read error response
      try {
        const errorText = await response.text();
        console.error(`Error details: ${errorText}`);
      } catch (e) {
        console.error('Could not read error response');
      }
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
    
    console.log('\n📝 RESPONSE ANALYSIS:');
    console.log(`Text: "${responseData.text}"`);
    console.log(`Facts count: ${responseData.metadata?.facts_count || 0}`);
    console.log(`Memories count: ${responseData.metadata?.memories_count || 0}`);
    console.log(`Processing time: ${responseData.metadata?.processing_time_ms || 0}ms`);
    
    if (responseData.debug) {
      console.log('\n🔍 DEBUG INFO:');
      console.log(`Facts preview: ${JSON.stringify(responseData.debug.factsPreview?.slice(0, 3) || [])}`);
      console.log(`Memories preview: ${JSON.stringify(responseData.debug.memoriesPreview?.slice(0, 3) || [])}`);
      console.log(`History count: ${responseData.debug.historyCount || 0}`);
    }
    
    // Check if Tyler is mentioned
    const lowerResponse = responseData.text.toLowerCase();
    const mentionsTyler = lowerResponse.includes('tyler');
    const hasRichContent = lowerResponse.includes('mccoy') || 
                          lowerResponse.includes('austin') || 
                          lowerResponse.includes('yoga') || 
                          lowerResponse.includes('kayak') ||
                          lowerResponse.includes('cansu');
    
    console.log('\n📊 CONTENT ANALYSIS:');
    console.log(`Mentions Tyler: ${mentionsTyler ? '✅' : '❌'}`);
    console.log(`Has rich Tyler details: ${hasRichContent ? '✅' : '❌'}`);
    
    if (mentionsTyler && hasRichContent) {
      console.log('🎉 SUCCESS: Rich Tyler content retrieved and used!');
    } else if (mentionsTyler) {
      console.log('⚠️  PARTIAL: Tyler mentioned but lacks rich details');
    } else {
      console.log('❌ FAILURE: No Tyler information in response');
      console.log('   This indicates memory retrieval is not working');
    }
    
  } catch (error) {
    console.error(`❌ API test failed: ${error.message}`);
    console.log('\n⚠️ Make sure the development server is running:');
    console.log('   npm run dev');
  }
  
  // Test 2: Direct memory service test
  console.log('\n2. TESTING MEMORY SERVICE DIRECTLY');
  console.log('-'.repeat(60));
  
  const { createClient } = require('@supabase/supabase-js');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  
  const JONATHAN_AVATAR_ID = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
  const DEMO_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  
  // Test enhanced retrieval
  console.log('Testing enhanced retrieval...');
  try {
    const { data: enhancedData, error: enhancedError } = await supabase.rpc('get_enhanced_memories', {
      target_user_id: DEMO_USER_ID,
      target_avatar_id: JONATHAN_AVATAR_ID,
      search_query: 'tyler friend',
      match_count: 20,
      similarity_threshold: 0.1,
      include_bio_facts: true
    });
    
    if (enhancedError) {
      console.log(`❌ Enhanced retrieval failed: ${enhancedError.message}`);
    } else {
      console.log(`📊 Enhanced retrieval: ${enhancedData.length} results`);
      if (enhancedData.length > 0) {
        console.log(`   Sample: ${enhancedData[0].fragment_text.substring(0, 100)}...`);
      }
    }
  } catch (err) {
    console.log(`❌ Enhanced retrieval error: ${err.message}`);
  }
  
  // Test fallback search
  console.log('\nTesting fallback search...');
  try {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('memory_fragments')
      .select('id, fragment_text')
      .eq('avatar_id', JONATHAN_AVATAR_ID)
      .or('fragment_text.ilike.%tyler%,fragment_text.ilike.%mccoy%')
      .limit(5);
      
    if (fallbackError) {
      console.log(`❌ Fallback search failed: ${fallbackError.message}`);
    } else {
      console.log(`📊 Fallback search: ${fallbackData.length} results`);
      if (fallbackData.length > 0) {
        console.log(`   Sample: ${fallbackData[0].fragment_text.substring(0, 100)}...`);
      }
    }
  } catch (err) {
    console.log(`❌ Fallback search error: ${err.message}`);
  }
  
  console.log('\n📋 SUMMARY:');
  console.log('If the API test shows Tyler content, the pipeline is working.');
  console.log('If not, check:');
  console.log('1. Enhanced memory function needs SQL update');
  console.log('2. Deep lane cancellation still happening');
  console.log('3. Memory service fallback not being triggered');
}

testTylerQueryComplete().catch(console.error);