#!/usr/bin/env node

/**
 * Fix Jonathan Demo Memory Pipeline - Final Implementation
 * 
 * Addresses the remaining issues:
 * 1. Deep lane still cancelled with "late_start" 
 * 2. Political/opinion memories not retrieved (Trump experiences)
 * 3. RLS policy errors for fact_promotion_queue
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const JONATHAN_AVATAR_ID = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';

async function fixJonathanDemoPipeline() {
  console.log('🚀 Fixing Jonathan Demo Memory Pipeline - Final Implementation\n');
  
  // Step 1: Test current Trump memory retrieval
  console.log('1. Testing current Trump memory retrieval...');
  
  try {
    const { data: trumpMemories, error } = await supabase
      .from('memory_fragments')
      .select('id, fragment_text, conversation_context')
      .eq('avatar_id', JONATHAN_AVATAR_ID)
      .or('fragment_text.ilike.%trump%,fragment_text.ilike.%america%,fragment_text.ilike.%political%,fragment_text.ilike.%emigration%')
      .limit(10);
      
    if (error) {
      console.log(`❌ Trump memory query failed: ${error.message}`);
    } else {
      console.log(`📊 Found ${trumpMemories.length} Trump/political memories:`);
      trumpMemories.forEach((memory, i) => {
        console.log(`   ${i + 1}. ${memory.fragment_text.substring(0, 100)}...`);
        console.log(`      Context: ${JSON.stringify(memory.conversation_context)}`);
      });
    }
  } catch (err) {
    console.log(`❌ Trump memory test failed: ${err.message}`);
  }
  
  // Step 2: Test enhanced memory function with political queries
  console.log('\n2. Testing enhanced memory function with political queries...');
  
  const politicalQueries = [
    'what do you think of Trump?',
    'why did you leave America?',
    'do you like Trump?',
    'tell me about your political views'
  ];
  
  for (const query of politicalQueries) {
    console.log(`\n🔍 Testing: "${query}"`);
    
    try {
      const { data: memories, error } = await supabase.rpc('get_enhanced_memories', {
        target_user_id: null,
        target_avatar_id: JONATHAN_AVATAR_ID,
        search_query: query,
        match_count: 20,
        similarity_threshold: 0.25, // Lower threshold for political queries
        include_bio_facts: true
      });
      
      if (error) {
        console.log(`❌ Enhanced function error: ${error.message}`);
        
        // Fallback to basic search
        const { data: basicMemories } = await supabase
          .from('memory_fragments')
          .select('id, fragment_text')
          .eq('avatar_id', JONATHAN_AVATAR_ID)
          .or('fragment_text.ilike.%trump%,fragment_text.ilike.%america%,fragment_text.ilike.%political%')
          .limit(5);
          
        if (basicMemories && basicMemories.length > 0) {
          console.log(`📊 Basic search found ${basicMemories.length} memories:`);
          basicMemories.forEach((memory, i) => {
            console.log(`   ${i + 1}. ${memory.fragment_text.substring(0, 80)}...`);
          });
        } else {
          console.log('❌ No memories found even with basic search');
        }
      } else {
        console.log(`📊 Enhanced function returned ${memories.length} memories`);
        
        if (memories.length > 0) {
          console.log('✅ Political memories found:');
          memories.slice(0, 3).forEach((memory, i) => {
            console.log(`   ${i + 1}. [${memory.similarity_score?.toFixed(2)}] ${memory.fragment_text.substring(0, 80)}...`);
          });
        } else {
          console.log('❌ Enhanced function returned 0 results - this is the problem!');
        }
      }
    } catch (err) {
      console.log(`❌ Query test failed: ${err.message}`);
    }
  }
  
  // Step 3: Test RLS policy for fact_promotion_queue
  console.log('\n3. Testing RLS policy for fact_promotion_queue...');
  
  try {
    const testRecord = {
      avatar_id: JONATHAN_AVATAR_ID,
      fact_key: 'test_political_fix',
      fact_value: 'Test political memory fix',
      confidence: 0.8,
      priority: 5,
      source: 'pipeline_fix_test',
      conversation_context: {
        conversation_id: 'jonathan-demo',
        test: true,
        political_query: true
      }
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('fact_promotion_queue')
      .insert(testRecord)
      .select('id')
      .single();
      
    if (insertError) {
      console.log(`❌ RLS policy still blocking: ${insertError.message}`);
      console.log('   This confirms RLS needs manual fix in Supabase SQL Editor');
    } else {
      console.log('✅ RLS policy allows insertion');
      
      // Clean up test record
      if (insertData?.id) {
        await supabase
          .from('fact_promotion_queue')
          .delete()
          .eq('id', insertData.id);
        console.log('✅ Test record cleaned up');
      }
    }
  } catch (err) {
    console.log(`❌ RLS test failed: ${err.message}`);
  }
  
  console.log('\n📋 REQUIRED FIXES:\n');
  
  console.log('🔧 1. ENHANCED MEMORY FUNCTION FIX:');
  console.log('   Apply this in Supabase SQL Editor to fix political memory retrieval:');
  console.log('   File: fix-enhanced-memory-search-political.sql');
  
  console.log('\n🔧 2. RLS POLICY FIX:');
  console.log('   Apply this in Supabase SQL Editor to fix fact promotion:');
  console.log('```sql');
  console.log('-- Fix RLS policy for fact_promotion_queue');
  console.log('DROP POLICY IF EXISTS "Service role can manage fact_promotion_queue" ON public.fact_promotion_queue;');
  console.log('DROP POLICY IF EXISTS "Users can manage their own fact promotion queue" ON public.fact_promotion_queue;');
  console.log('');
  console.log('CREATE POLICY "Allow fact promotion access" ON public.fact_promotion_queue');
  console.log('    FOR ALL USING (');
  console.log('        auth.role() = \'service_role\' OR ');
  console.log('        auth.role() = \'authenticated\' OR');
  console.log('        -- Allow demo mode bypassing');
  console.log('        (conversation_context->>\'conversation_id\') LIKE \'%demo%\'');
  console.log('    );');
  console.log('```');
  
  console.log('\n🔧 3. DEEP LANE ORCHESTRATOR FIX:');
  console.log('   The deep lane cancellation will be fixed by updating the orchestrator');
  console.log('   to start immediately for political/opinion queries instead of waiting.');
}

fixJonathanDemoPipeline().catch(console.error);