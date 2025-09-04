#!/usr/bin/env node

/**
 * Apply Final Memory Fix Directly via Supabase Client
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function applyFinalMemoryFix() {
  console.log('🚀 Applying Final Memory Fix for Enhanced Retrieval\n');
  
  // Read the final fix SQL
  const finalFixSQL = fs.readFileSync('fix-enhanced-memory-search-final.sql', 'utf8');
  
  // Extract just the function definition
  const functionMatch = finalFixSQL.match(/CREATE OR REPLACE FUNCTION get_enhanced_memories\([\s\S]*?\$\$;/);
  
  if (!functionMatch) {
    console.error('❌ Could not extract function definition from SQL file');
    return;
  }
  
  const functionSQL = functionMatch[0];
  
  console.log('📝 Applying enhanced memory function...');
  
  try {
    // Use raw SQL query instead of RPC
    const { data, error } = await supabase
      .from('memory_fragments')
      .select('id')
      .limit(1);
      
    if (error) {
      console.error('❌ Database connection failed:', error);
      return;
    }
    
    console.log('✅ Database connection successful');
    
    // Since we can't execute DDL directly, let's test the current function
    console.log('\n🧪 Testing current enhanced memory function...');
    
    const JONATHAN_AVATAR_ID = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
    
    // Test problematic queries
    const testQueries = ['romeo poodle', 'bucky first dog', 'george dog'];
    
    for (const query of testQueries) {
      console.log(`\n🔍 Testing: "${query}"`);
      
      try {
        const { data: memories, error } = await supabase.rpc('get_enhanced_memories', {
          target_user_id: null,
          target_avatar_id: JONATHAN_AVATAR_ID,
          search_query: query,
          match_count: 20,
          similarity_threshold: 0.05, // Even lower threshold
          include_bio_facts: true
        });
        
        if (error) {
          console.log(`❌ Function error: ${error.message}`);
        } else {
          console.log(`📊 Retrieved ${memories.length} memories`);
          
          if (memories.length > 0) {
            console.log('✅ Function is working for this query');
            memories.slice(0, 2).forEach((memory, i) => {
              console.log(`   ${i + 1}. [${memory.similarity_score?.toFixed(2)}] ${memory.fragment_text.substring(0, 80)}...`);
            });
          } else {
            console.log('❌ No memories returned - need to fix function');
            
            // Try basic ILIKE search as fallback
            const { data: basicMemories } = await supabase
              .from('memory_fragments')
              .select('id, fragment_text')
              .eq('avatar_id', JONATHAN_AVATAR_ID)
              .or(`fragment_text.ilike.%${query.split(' ')[0]}%,fragment_text.ilike.%${query.split(' ')[1] || query.split(' ')[0]}%`)
              .limit(5);
              
            if (basicMemories && basicMemories.length > 0) {
              console.log(`📊 Basic search found ${basicMemories.length} memories:`);
              basicMemories.forEach((memory, i) => {
                console.log(`   ${i + 1}. ${memory.fragment_text.substring(0, 80)}...`);
              });
            }
          }
        }
      } catch (err) {
        console.log(`❌ Test failed: ${err.message}`);
      }
    }
    
    // Test if we can create a simple workaround
    console.log('\n🔧 Creating workaround for memory retrieval...');
    
    // Test comprehensive search
    const { data: allRomeoMemories } = await supabase
      .from('memory_fragments')
      .select('id, fragment_text, conversation_context')
      .eq('avatar_id', JONATHAN_AVATAR_ID)
      .or('fragment_text.ilike.%romeo%,fragment_text.ilike.%poodle%,fragment_text.ilike.%valentine%')
      .limit(10);
      
    console.log(`📊 Found ${allRomeoMemories?.length || 0} Romeo-related memories with basic search`);
    
    if (allRomeoMemories && allRomeoMemories.length > 0) {
      console.log('✅ Rich Romeo content exists:');
      allRomeoMemories.slice(0, 3).forEach((memory, i) => {
        console.log(`   ${i + 1}. ${memory.fragment_text}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Fix application failed:', error);
  }
  
  console.log('\n📋 MANUAL FIX REQUIRED:');
  console.log('1. Open Supabase SQL Editor');
  console.log('2. Copy and paste the following function:');
  console.log('\n```sql');
  console.log(functionSQL);
  console.log('```');
  console.log('\n3. Execute the SQL to replace the function');
  console.log('4. Test with: node test-rich-memory-content.js');
}

applyFinalMemoryFix().catch(console.error);