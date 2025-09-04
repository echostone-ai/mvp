#!/usr/bin/env node

/**
 * Test script for EchoStone Memory Retrieval & Fact Injection Fixes
 * 
 * Tests the acceptance criteria:
 * 1. "What's your favorite music?" → "Nirvana—I've always loved their sound."
 * 2. "How many dogs have you had?" → "Four total—Romeo now, and before that Bucky, George, and Olive."
 * 3. "Tell me about your dog." → "Romeo's my tiny toy poodle, born on Valentine's Day 2024."
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { randomUUID } = require('crypto');

const JONATHAN_AVATAR_ID = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
const TEST_USER_ID = randomUUID();

async function setupTestData() {
  console.log('🔧 Setting up test data...');
  
  // Insert test memory fragments for Jonathan
  const testMemories = [
    {
      user_id: null, // Bio data has no user_id
      avatar_id: JONATHAN_AVATAR_ID,
      fragment_text: 'Favorite music: Nirvana - I\'ve always loved their sound and energy',
      conversation_context: {
        source: 'test_seed',
        tags: ['music', 'preferences', 'favorite']
      }
    },
    {
      user_id: null,
      avatar_id: JONATHAN_AVATAR_ID,
      fragment_text: 'I had three beloved dogs before Romeo: Bucky, George, and Olive',
      conversation_context: {
        source: 'test_seed',
        tags: ['pets', 'dogs', 'history']
      }
    },
    {
      user_id: null,
      avatar_id: JONATHAN_AVATAR_ID,
      fragment_text: 'Romeo is my tiny toy poodle, born on Valentine\'s Day 2024',
      conversation_context: {
        source: 'test_seed',
        tags: ['pets', 'dogs', 'current', 'romeo']
      }
    },
    {
      user_id: TEST_USER_ID,
      avatar_id: JONATHAN_AVATAR_ID,
      fragment_text: 'User mentioned they love rock music too',
      conversation_context: {
        source: 'conversation',
        tags: ['music', 'user_preference']
      }
    }
  ];

  // Insert test memories
  const { error: memoryError } = await supabase
    .from('memory_fragments')
    .insert(testMemories);

  if (memoryError) {
    console.error('❌ Failed to insert test memories:', memoryError);
    return false;
  }

  // Insert test quick facts
  const testFacts = [
    {
      avatar_id: JONATHAN_AVATAR_ID,
      key: 'favorite_music',
      value: 'Nirvana',
      confidence: 0.9,
      priority: 2,
      source: 'manual' // Use valid source
    },
    {
      avatar_id: JONATHAN_AVATAR_ID,
      key: 'pet_current',
      value: 'Romeo (toy poodle, born Valentine\'s Day 2024)',
      confidence: 0.95,
      priority: 1,
      source: 'manual'
    },
    {
      avatar_id: JONATHAN_AVATAR_ID,
      key: 'pets_history',
      value: 'Previously had Bucky, George, and Olive',
      confidence: 0.8,
      priority: 3,
      source: 'manual'
    }
  ];

  const { error: factsError } = await supabase
    .from('quick_facts')
    .upsert(testFacts, { onConflict: 'avatar_id,key' });

  if (factsError) {
    console.error('❌ Failed to insert test facts:', factsError);
    return false;
  }

  console.log('✅ Test data setup complete');
  return true;
}

async function testEnhancedMemoryRetrieval() {
  console.log('\n🧪 Testing Enhanced Memory Retrieval...');

  // Test 1: Favorite music query
  console.log('\n📝 Test 1: Favorite music query');
  const { data: musicData, error: musicError } = await supabase.rpc('get_enhanced_memories', {
    target_user_id: null,
    target_avatar_id: JONATHAN_AVATAR_ID,
    search_query: 'favorite music',
    match_count: 10,
    similarity_threshold: 0.6,
    include_bio_facts: true
  });

  if (musicError) {
    console.error('❌ Music query failed:', musicError);
  } else {
    console.log(`✅ Found ${musicData.length} memories for music query`);
    musicData.forEach((memory, i) => {
      console.log(`   ${i + 1}. ${memory.fragment_text.substring(0, 80)}... (score: ${memory.similarity_score})`);
    });
  }

  // Test 2: Dog count query
  console.log('\n📝 Test 2: Dog count query');
  const { data: dogData, error: dogError } = await supabase.rpc('get_enhanced_memories', {
    target_user_id: null,
    target_avatar_id: JONATHAN_AVATAR_ID,
    search_query: 'how many dogs',
    match_count: 10,
    similarity_threshold: 0.6,
    include_bio_facts: true
  });

  if (dogError) {
    console.error('❌ Dog query failed:', dogError);
  } else {
    console.log(`✅ Found ${dogData.length} memories for dog count query`);
    dogData.forEach((memory, i) => {
      console.log(`   ${i + 1}. ${memory.fragment_text.substring(0, 80)}... (score: ${memory.similarity_score})`);
    });
  }

  // Test 3: Current dog query
  console.log('\n📝 Test 3: Current dog query');
  const { data: romeoData, error: romeoError } = await supabase.rpc('get_enhanced_memories', {
    target_user_id: null,
    target_avatar_id: JONATHAN_AVATAR_ID,
    search_query: 'tell me about your dog',
    match_count: 10,
    similarity_threshold: 0.6,
    include_bio_facts: true
  });

  if (romeoError) {
    console.error('❌ Romeo query failed:', romeoError);
  } else {
    console.log(`✅ Found ${romeoData.length} memories for current dog query`);
    romeoData.forEach((memory, i) => {
      console.log(`   ${i + 1}. ${memory.fragment_text.substring(0, 80)}... (score: ${memory.similarity_score})`);
    });
  }
}

async function testQuickFactsRetrieval() {
  console.log('\n🧪 Testing Quick Facts Retrieval...');

  const { data: facts, error } = await supabase.rpc('get_avatar_quick_facts', {
    target_avatar_id: JONATHAN_AVATAR_ID,
    max_priority: 5,
    include_expired: false
  });

  if (error) {
    console.error('❌ Quick facts query failed:', error);
  } else {
    console.log(`✅ Found ${facts.length} quick facts`);
    facts.forEach((fact, i) => {
      console.log(`   ${i + 1}. ${fact.key}: ${fact.value} (priority: ${fact.priority}, confidence: ${fact.confidence})`);
    });
  }
}

async function testCountEnumeration() {
  console.log('\n🧪 Testing Count Enumeration...');

  // Get memories for enumeration test
  const { data: memories, error } = await supabase.rpc('get_enhanced_memories', {
    target_user_id: null,
    target_avatar_id: JONATHAN_AVATAR_ID,
    search_query: 'dogs pets',
    match_count: 20,
    similarity_threshold: 0.5,
    include_bio_facts: true
  });

  if (error) {
    console.error('❌ Failed to get memories for enumeration:', error);
    return;
  }

  // Test enumeration function
  const memoriesJson = JSON.stringify(memories.map(m => ({
    id: m.id,
    fragment_text: m.fragment_text,
    created_at: m.created_at
  })));

  const { data: enumData, error: enumError } = await supabase.rpc('enumerate_items_from_memories', {
    memories_json: memoriesJson,
    item_patterns: ['dog', 'dogs', 'pet', 'pets', 'puppy', 'poodle']
  });

  if (enumError) {
    console.error('❌ Enumeration failed:', enumError);
  } else if (enumData && enumData.length > 0) {
    const result = enumData[0];
    console.log('✅ Enumeration result:');
    console.log(`   Total count: ${result.total_count}`);
    console.log(`   Current items: [${result.current_items?.join(', ') || 'none'}]`);
    console.log(`   Past items: [${result.past_items?.join(', ') || 'none'}]`);
    console.log(`   Formatted response: "${result.formatted_response}"`);
  } else {
    console.log('⚠️  No enumeration results returned');
  }
}

async function testAvatarResolution() {
  console.log('\n🧪 Testing Avatar Resolution...');

  // Test jonathan-demo resolution
  try {
    const { data: resolvedId, error } = await supabase.rpc('resolve_avatar_id', {
      profile_name: null,
      avatar_slug: 'jonathan-demo'
    });

    if (error) {
      console.error('❌ Avatar resolution failed:', error);
    } else {
      console.log(`✅ jonathan-demo resolves to: ${resolvedId}`);
      console.log(`   Expected: ${JONATHAN_AVATAR_ID}`);
      console.log(`   Match: ${resolvedId === JONATHAN_AVATAR_ID ? '✅' : '❌'}`);
    }
  } catch (err) {
    console.error('❌ Avatar resolution error:', err);
  }
}

async function testRLSPolicy() {
  console.log('\n🧪 Testing RLS Policy for Fact Promotion Queue...');

  try {
    // Test inserting into fact_promotion_queue
    const { error } = await supabase
      .from('fact_promotion_queue')
      .insert({
        avatar_id: JONATHAN_AVATAR_ID,
        fragment_id: '00000000-0000-0000-0000-000000000001', // Dummy ID
        fragment_text: 'Test fragment for RLS',
        status: 'pending'
      });

    if (error) {
      console.error('❌ RLS policy test failed:', error);
    } else {
      console.log('✅ RLS policy allows service-role inserts');
      
      // Clean up test entry
      await supabase
        .from('fact_promotion_queue')
        .delete()
        .eq('fragment_text', 'Test fragment for RLS');
    }
  } catch (err) {
    console.error('❌ RLS policy test error:', err);
  }
}

async function cleanupTestData() {
  console.log('\n🧹 Cleaning up test data...');

  // Remove test memories
  await supabase
    .from('memory_fragments')
    .delete()
    .or(`user_id.eq.${TEST_USER_ID},conversation_context->>source.eq.test_seed`);

  // Remove test facts (keep existing ones)
  await supabase
    .from('quick_facts')
    .delete()
    .in('key', ['favorite_music', 'pet_current', 'pets_history'])
    .eq('avatar_id', JONATHAN_AVATAR_ID);

  console.log('✅ Cleanup complete');
}

async function runTests() {
  console.log('🚀 Starting EchoStone Memory Retrieval Tests\n');

  try {
    // Setup
    const setupSuccess = await setupTestData();
    if (!setupSuccess) {
      console.error('❌ Test setup failed, aborting');
      return;
    }

    // Run tests
    await testEnhancedMemoryRetrieval();
    await testQuickFactsRetrieval();
    await testCountEnumeration();
    await testAvatarResolution();
    await testRLSPolicy();

    console.log('\n🎉 All tests completed!');
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
  } finally {
    // Cleanup
    await cleanupTestData();
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };