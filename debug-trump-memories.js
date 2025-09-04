#!/usr/bin/env node

/**
 * Debug Trump Memories - Check what's actually in the database
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xiftnqnwyjixwqgxqfez.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpZnRucW53eWppeHdxZ3hxZmV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY2MjI0NSwiZXhwIjoyMDcwMjM4MjQ1fQ.7NWQofZH1WnEWgSKBnLUEpTRhun10if5VmjILc_lL74',
  { auth: { persistSession: false } }
);

async function debugTrumpMemories() {
  console.log('🔍 Debugging Trump Memories in Database\n');
  
  const jonathanAvatarId = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
  
  // 1. Check for any Trump-related memories
  console.log('📋 Step 1: Searching for Trump-related memories...');
  const { data: trumpMemories, error: trumpError } = await supabase
    .from('memory_fragments')
    .select('*')
    .eq('avatar_id', jonathanAvatarId)
    .ilike('fragment_text', '%trump%');
  
  if (trumpError) {
    console.error('❌ Error searching Trump memories:', trumpError);
  } else {
    console.log(`✅ Found ${trumpMemories?.length || 0} Trump memories`);
    trumpMemories?.forEach((memory, i) => {
      console.log(`\n${i + 1}. ID: ${memory.id.substring(0, 8)}`);
      console.log(`   Text: ${memory.fragment_text.substring(0, 100)}...`);
      console.log(`   Context: ${JSON.stringify(memory.conversation_context)}`);
      console.log(`   Created: ${memory.created_at}`);
    });
  }
  
  // 2. Check for political/America memories
  console.log('\n📋 Step 2: Searching for political/America memories...');
  const { data: politicalMemories, error: politicalError } = await supabase
    .from('memory_fragments')
    .select('*')
    .eq('avatar_id', jonathanAvatarId)
    .or('fragment_text.ilike.%political%,fragment_text.ilike.%america%,fragment_text.ilike.%emigration%,fragment_text.ilike.%2018%');
  
  if (politicalError) {
    console.error('❌ Error searching political memories:', politicalError);
  } else {
    console.log(`✅ Found ${politicalMemories?.length || 0} political memories`);
    politicalMemories?.forEach((memory, i) => {
      console.log(`\n${i + 1}. ID: ${memory.id.substring(0, 8)}`);
      console.log(`   Text: ${memory.fragment_text.substring(0, 100)}...`);
      console.log(`   Context: ${JSON.stringify(memory.conversation_context)}`);
    });
  }
  
  // 3. Test enhanced memory function
  console.log('\n📋 Step 3: Testing enhanced memory function...');
  const { data: enhancedResults, error: enhancedError } = await supabase.rpc('get_enhanced_memories', {
    target_user_id: null,
    target_avatar_id: jonathanAvatarId,
    search_query: 'trump political opinion',
    match_count: 10,
    similarity_threshold: 0.25,
    include_bio_facts: true
  });
  
  if (enhancedError) {
    console.error('❌ Enhanced memory function error:', enhancedError);
  } else {
    console.log(`✅ Enhanced function returned ${enhancedResults?.length || 0} results`);
    enhancedResults?.forEach((result, i) => {
      console.log(`\n${i + 1}. Score: ${result.similarity_score}`);
      console.log(`   Text: ${result.fragment_text.substring(0, 100)}...`);
      console.log(`   Match Type: ${result.match_type}`);
    });
  }
  
  // 4. Check if we need to seed Trump memories
  if (!trumpMemories?.length && !politicalMemories?.length) {
    console.log('\n⚠️  NO TRUMP/POLITICAL MEMORIES FOUND!');
    console.log('🔧 Need to seed the database with Jonathan\'s Trump memories');
    
    await seedTrumpMemories(jonathanAvatarId);
  }
  
  console.log('\n🎯 DIAGNOSIS COMPLETE');
}

async function seedTrumpMemories(avatarId) {
  console.log('\n🌱 Seeding Trump memories for Jonathan...');
  
  const trumpMemories = [
    {
      fragment_text: "I left America in 2018 because of the political climate under Trump. The whole situation was becoming unbearable for me.",
      conversation_context: {
        ctx_type: 'opinion',
        type: 'bio',
        context: 'politics_and_emigration',
        tags: ['trump', 'political', 'emigration', '2018', 'opinion']
      }
    },
    {
      fragment_text: "Trump is a miserable bastard who made life difficult for many Americans. I had a road incident that really crystallized my negative feelings about the direction the country was heading.",
      conversation_context: {
        ctx_type: 'opinion',
        type: 'language_style',
        context: 'politics',
        tags: ['trump', 'negative', 'opinion', 'road', 'incident']
      }
    },
    {
      fragment_text: "My opinion of Trump is very negative. He represents everything wrong with American politics - divisive, harmful rhetoric that tears communities apart.",
      conversation_context: {
        ctx_type: 'opinion',
        type: 'bio',
        context: 'politics',
        tags: ['trump', 'opinion', 'negative', 'political']
      }
    },
    {
      fragment_text: "The 2018 political climate in America was toxic. Trump's policies and behavior made me realize I needed to leave the country for my own well-being.",
      conversation_context: {
        ctx_type: 'bio',
        type: 'bio',
        context: 'politics_and_emigration',
        tags: ['2018', 'trump', 'emigration', 'america', 'political', 'climate']
      }
    }
  ];
  
  try {
    const { data, error } = await supabase
      .from('memory_fragments')
      .insert(trumpMemories.map(memory => ({
        avatar_id: avatarId,
        user_id: process.env.DEMO_SYSTEM_USER_ID || '550e8400-e29b-41d4-a716-446655440000',
        fragment_text: memory.fragment_text,
        conversation_context: memory.conversation_context
      })));
    
    if (error) {
      console.error('❌ Error seeding memories:', error);
    } else {
      console.log('✅ Successfully seeded Trump memories');
    }
  } catch (err) {
    console.error('❌ Seeding failed:', err);
  }
}

debugTrumpMemories().catch(console.error);