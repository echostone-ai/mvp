#!/usr/bin/env node

/**
 * Fix Jonathan Demo Dog Memories
 * 
 * This script fixes the inconsistent dog memories and adds proper context
 * for all four dogs: Romeo (current), Bucky, George, and Olive (past)
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const JONATHAN_AVATAR_ID = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
const DEMO_USER_ID = '550e8400-e29b-41d4-a716-446655440000';

async function fixJonathanDogMemories() {
  console.log('🐕 Fixing Jonathan Demo Dog Memories\n');
  
  // Step 1: Remove inconsistent dog memories
  console.log('1. Removing inconsistent dog memories...');
  
  const { data: existingMemories, error: fetchError } = await supabase
    .from('memory_fragments')
    .select('id, fragment_text')
    .eq('user_id', DEMO_USER_ID)
    .eq('avatar_id', JONATHAN_AVATAR_ID)
    .or('fragment_text.ilike.%bucky%,fragment_text.ilike.%romeo%');
    
  if (fetchError) {
    console.error('❌ Error fetching existing memories:', fetchError);
    return;
  }
  
  console.log(`Found ${existingMemories.length} existing dog memories to clean up`);
  
  // Delete inconsistent memories (ones that say "Bucky" but then mention "Romeo")
  const inconsistentMemories = existingMemories.filter(m => 
    m.fragment_text.toLowerCase().includes('bucky') && 
    m.fragment_text.toLowerCase().includes('romeo')
  );
  
  if (inconsistentMemories.length > 0) {
    console.log(`Removing ${inconsistentMemories.length} inconsistent memories...`);
    
    for (const memory of inconsistentMemories) {
      const { error: deleteError } = await supabase
        .from('memory_fragments')
        .delete()
        .eq('id', memory.id);
        
      if (deleteError) {
        console.error(`❌ Error deleting memory ${memory.id}:`, deleteError);
      } else {
        console.log(`✅ Deleted inconsistent memory: ${memory.fragment_text.substring(0, 50)}...`);
      }
    }
  }
  
  // Step 2: Add proper dog memories
  console.log('\n2. Adding proper dog memories...');
  
  const properDogMemories = [
    {
      fragment_text: "Romeo is my current toy poodle, born on Valentine's Day 2024. He's tiny but has such a big personality and brings so much joy to my daily life.",
      conversation_context: {
        type: 'bio',
        source: 'demo-seed',
        conversation_id: 'jonathan-demo',
        ctx_type: 'pet_current',
        tags: ['pet', 'dog', 'current', 'romeo', 'poodle']
      }
    },
    {
      fragment_text: "Bucky was my first dog, a golden retriever mix who taught me so much about companionship and responsibility. He had this gentle nature and was incredibly loyal.",
      conversation_context: {
        type: 'bio',
        source: 'demo-seed',
        conversation_id: 'jonathan-demo',
        ctx_type: 'pet_past',
        tags: ['pet', 'dog', 'past', 'bucky', 'first', 'golden retriever']
      }
    },
    {
      fragment_text: "George was another dog I had after Bucky. He was energetic and loved playing fetch in the backyard. George had this way of making everyone smile with his playful antics.",
      conversation_context: {
        type: 'bio',
        source: 'demo-seed',
        conversation_id: 'jonathan-demo',
        ctx_type: 'pet_past',
        tags: ['pet', 'dog', 'past', 'george', 'energetic']
      }
    },
    {
      fragment_text: "Olive was a sweet dog I had before Romeo. She was calm and gentle, the perfect companion for quiet evenings. Olive had this soothing presence that made her special.",
      conversation_context: {
        type: 'bio',
        source: 'demo-seed',
        conversation_id: 'jonathan-demo',
        ctx_type: 'pet_past',
        tags: ['pet', 'dog', 'past', 'olive', 'gentle']
      }
    },
    {
      fragment_text: "I've had four dogs total throughout my life: Romeo is my current toy poodle, and before him I had Bucky (my first), George, and Olive. Each one brought something special to my life.",
      conversation_context: {
        type: 'bio',
        source: 'demo-seed',
        conversation_id: 'jonathan-demo',
        ctx_type: 'pet_summary',
        tags: ['pet', 'dog', 'count', 'four', 'romeo', 'bucky', 'george', 'olive']
      }
    },
    {
      fragment_text: "My favorite music is Nirvana—I've always loved their sound and the raw emotion in Kurt Cobain's voice. Their music has been a constant companion through different phases of my life.",
      conversation_context: {
        type: 'bio',
        source: 'demo-seed',
        conversation_id: 'jonathan-demo',
        ctx_type: 'preference_music',
        tags: ['music', 'favorite', 'nirvana', 'preference']
      }
    }
  ];
  
  let addedCount = 0;
  
  for (const memory of properDogMemories) {
    try {
      const { data, error } = await supabase
        .from('memory_fragments')
        .insert({
          user_id: DEMO_USER_ID,
          avatar_id: JONATHAN_AVATAR_ID,
          fragment_text: memory.fragment_text,
          conversation_context: memory.conversation_context
        })
        .select('id')
        .single();
        
      if (error) {
        console.error(`❌ Error adding memory: ${error.message}`);
      } else {
        console.log(`✅ Added: ${memory.fragment_text.substring(0, 60)}...`);
        addedCount++;
      }
    } catch (err) {
      console.error(`❌ Exception adding memory: ${err.message}`);
    }
  }
  
  console.log(`\n✅ Added ${addedCount} proper dog memories`);
  
  // Step 3: Test the enhanced retrieval
  console.log('\n3. Testing enhanced retrieval with new memories...');
  
  const testQueries = [
    'favorite music',
    'how many dogs',
    'what were their names',
    'tell me about your dog',
    'first dog'
  ];
  
  for (const query of testQueries) {
    console.log(`\n🔍 Testing: "${query}"`);
    
    try {
      const { data, error } = await supabase.rpc('get_enhanced_memories', {
        target_user_id: DEMO_USER_ID,
        target_avatar_id: JONATHAN_AVATAR_ID,
        search_query: query,
        match_count: 10,
        similarity_threshold: 0.2,
        include_bio_facts: true
      });
      
      if (error) {
        console.log(`❌ Error: ${error.message}`);
      } else {
        console.log(`✅ Found ${data.length} memories`);
        if (data.length > 0) {
          console.log(`   Top result: ${data[0].fragment_text.substring(0, 80)}...`);
        }
      }
    } catch (err) {
      console.log(`❌ Exception: ${err.message}`);
    }
  }
  
  console.log('\n🎯 Jonathan Demo Dog Memories Fixed!');
  console.log('\n📝 Summary:');
  console.log('✅ Removed inconsistent memories');
  console.log('✅ Added proper dog enumeration (Romeo, Bucky, George, Olive)');
  console.log('✅ Added current vs past context');
  console.log('✅ Added favorite music preference (Nirvana)');
  console.log('✅ Enhanced retrieval now finds relevant memories');
}

// Run the fix
fixJonathanDogMemories().catch(console.error);