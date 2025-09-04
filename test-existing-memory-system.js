#!/usr/bin/env node

/**
 * Test existing memory system to validate current functionality
 * before applying the enhanced fixes
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const JONATHAN_AVATAR_ID = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
const TEST_USER_ID = randomUUID();

async function testCurrentMemorySystem() {
  console.log('🧪 Testing Current Memory System...');

  // Test 1: Check if Jonathan avatar exists
  console.log('\n📝 Test 1: Avatar existence');
  const { data: avatarData, error: avatarError } = await supabase
    .from('avatar_profiles')
    .select('id, name')
    .eq('id', JONATHAN_AVATAR_ID)
    .single();

  if (avatarError) {
    console.error('❌ Avatar not found:', avatarError);
  } else {
    console.log(`✅ Found avatar: ${avatarData.name} (${avatarData.id})`);
  }

  // Test 2: Check existing memories for Jonathan
  console.log('\n📝 Test 2: Existing memories');
  const { data: memories, error: memoryError } = await supabase
    .from('memory_fragments')
    .select('id, fragment_text, user_id, avatar_id, created_at')
    .eq('avatar_id', JONATHAN_AVATAR_ID)
    .limit(10);

  if (memoryError) {
    console.error('❌ Memory query failed:', memoryError);
  } else {
    console.log(`✅ Found ${memories.length} existing memories for Jonathan`);
    memories.forEach((memory, i) => {
      console.log(`   ${i + 1}. ${memory.fragment_text.substring(0, 60)}... (user: ${memory.user_id ? 'yes' : 'no'})`);
    });
  }

  // Test 3: Check existing quick facts
  console.log('\n📝 Test 3: Existing quick facts');
  const { data: facts, error: factsError } = await supabase
    .from('quick_facts')
    .select('key, value, priority, confidence, source')
    .eq('avatar_id', JONATHAN_AVATAR_ID)
    .order('priority', { ascending: true });

  if (factsError) {
    console.error('❌ Facts query failed:', factsError);
  } else {
    console.log(`✅ Found ${facts.length} existing quick facts for Jonathan`);
    facts.forEach((fact, i) => {
      console.log(`   ${i + 1}. ${fact.key}: ${fact.value} (p:${fact.priority}, c:${fact.confidence})`);
    });
  }

  // Test 4: Test search_memories function if it exists
  console.log('\n📝 Test 4: Search memories function');
  try {
    const { data: searchData, error: searchError } = await supabase
      .rpc('search_memories', { 
        p_slug: 'jonathan-demo', 
        p_query: 'music', 
        p_limit: 5 
      });

    if (searchError) {
      console.error('❌ Search memories failed:', searchError);
    } else {
      console.log(`✅ Search memories returned ${searchData?.length || 0} results`);
      if (searchData && searchData.length > 0) {
        searchData.forEach((result, i) => {
          console.log(`   ${i + 1}. ${result.fragment_text?.substring(0, 60)}...`);
        });
      }
    }
  } catch (err) {
    console.error('❌ Search memories function not available:', err.message);
  }

  // Test 5: Test fact promotion queue access
  console.log('\n📝 Test 5: Fact promotion queue access');
  try {
    const { data: queueData, error: queueError } = await supabase
      .from('fact_promotion_queue')
      .select('id, status, created_at')
      .limit(5);

    if (queueError) {
      console.error('❌ Queue access failed:', queueError);
    } else {
      console.log(`✅ Queue access successful, found ${queueData.length} entries`);
    }
  } catch (err) {
    console.error('❌ Queue access error:', err.message);
  }

  // Test 6: Insert a test memory to see if it triggers promotion
  console.log('\n📝 Test 6: Memory insertion and promotion trigger');
  const testMemory = {
    user_id: TEST_USER_ID,
    avatar_id: JONATHAN_AVATAR_ID,
    fragment_text: 'Test memory: I love listening to Nirvana while walking my dog Romeo',
    conversation_context: {
      source: 'test',
      tags: ['music', 'pets', 'test']
    }
  };

  const { data: insertedMemory, error: insertError } = await supabase
    .from('memory_fragments')
    .insert(testMemory)
    .select('id')
    .single();

  if (insertError) {
    console.error('❌ Memory insertion failed:', insertError);
  } else {
    console.log(`✅ Memory inserted with ID: ${insertedMemory.id}`);
    
    // Check if promotion was queued
    setTimeout(async () => {
      const { data: promotionData, error: promotionError } = await supabase
        .from('fact_promotion_queue')
        .select('id, status, fragment_text')
        .eq('fragment_id', insertedMemory.id);

      if (promotionError) {
        console.error('❌ Promotion check failed:', promotionError);
      } else if (promotionData && promotionData.length > 0) {
        console.log(`✅ Promotion queued: ${promotionData[0].status}`);
      } else {
        console.log('⚠️  No promotion queue entry found (trigger may not be active)');
      }

      // Cleanup
      await cleanup(insertedMemory.id);
    }, 1000);
  }
}

async function cleanup(memoryId) {
  console.log('\n🧹 Cleaning up test data...');
  
  // Remove test memory
  await supabase
    .from('memory_fragments')
    .delete()
    .eq('id', memoryId);

  // Remove any promotion queue entries
  await supabase
    .from('fact_promotion_queue')
    .delete()
    .eq('fragment_id', memoryId);

  console.log('✅ Cleanup complete');
}

async function runTests() {
  console.log('🚀 Starting Current Memory System Tests\n');

  try {
    await testCurrentMemorySystem();
    console.log('\n🎉 Tests completed!');
  } catch (error) {
    console.error('❌ Test execution failed:', error);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };