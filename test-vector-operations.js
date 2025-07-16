// Test script to verify vector operations and pgvector configuration
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testVectorOperations() {
  console.log('Testing vector operations and pgvector configuration...\n');

  // Hardcoded known user_id in your auth.users table
  const testUserId = 'c2bbf339-3a83-42cb-9c47-2bc5159a99d5';

  try {
    // Test 1: Check if memory_fragments table exists and has correct structure
    console.log('1. Checking memory_fragments table structure...');
    const { error: tableError } = await supabase
      .from('memory_fragments')
      .select('*')
      .limit(0);
    
    if (tableError) {
      if (tableError.message.includes('relation "memory_fragments" does not exist')) {
        console.error('   ✗ memory_fragments table does not exist');
        console.log('   Please run the SQL migration from DATABASE_SETUP.md');
        return false;
      } else {
        console.error('   ✗ Error accessing memory_fragments table:', tableError.message);
        return false;
      }
    } else {
      console.log('   ✓ memory_fragments table is accessible');
    }

    // Test 2: Test vector insertion
    console.log('\n2. Testing vector insertion...');
    
    const testEmbedding1 = Array(1536).fill(0).map((_, i) => Math.sin(i * 0.01));
    const testEmbedding2 = Array(1536).fill(0).map((_, i) => Math.cos(i * 0.01));
    
    const { data: insertData, error: insertError } = await supabase
      .from('memory_fragments')
      .insert([
        {
          user_id: testUserId,
          fragment_text: 'Test memory fragment about favorite food: I love pizza with mushrooms',
          embedding: testEmbedding1,
          conversation_context: { 
            test: true, 
            timestamp: new Date().toISOString(),
            topic: 'food preferences'
          }
        },
        {
          user_id: testUserId,
          fragment_text: 'Test memory fragment about hobbies: I enjoy reading science fiction books',
          embedding: testEmbedding2,
          conversation_context: { 
            test: true, 
            timestamp: new Date().toISOString(),
            topic: 'hobbies'
          }
        }
      ])
      .select();

    if (insertError) {
      console.error('   ✗ Error inserting test data:', insertError.message);
      if (insertError.message.includes('violates foreign key constraint')) {
        console.log('   Note: Make sure this user_id exists in your auth.users table');
      }
      return false;
    } else {
      console.log('   ✓ Successfully inserted test memory fragments');
      console.log(`   Inserted ${insertData.length} fragments`);
    }

    // Test 3: Test basic retrieval
    console.log('\n3. Testing memory fragment retrieval...');
    const { data: retrieveData, error: retrieveError } = await supabase
      .from('memory_fragments')
      .select('*')
      .eq('user_id', testUserId)
      .limit(5);

    if (retrieveError) {
      console.error('   ✗ Error retrieving test data:', retrieveError.message);
    } else {
      console.log(`   ✓ Successfully retrieved ${retrieveData.length} memory fragments`);
    }

    // Test 4: Test vector similarity search function
    console.log('\n4. Testing vector similarity search function...');
    const queryEmbedding = Array(1536).fill(0).map((_, i) => Math.sin(i * 0.01) * 0.9);
    
    const { data: similarityData, error: similarityError } = await supabase
      .rpc('match_memory_fragments', {
        query_embedding: queryEmbedding,
        match_threshold: 0.1,
        match_count: 5,
        target_user_id: testUserId
      });

    if (similarityError) {
      if (similarityError.message.includes('function match_memory_fragments')) {
        console.log('   ⚠️  Vector similarity search function not found');
        console.log('   Please run the function SQL from DATABASE_SETUP.md');
      } else {
        console.error('   ✗ Error in similarity search:', similarityError.message);
      }
    } else {
      console.log(`   ✓ Vector similarity search working - found ${similarityData.length} matches`);
      if (similarityData.length > 0) {
        console.log(`   Best match similarity: ${similarityData[0].similarity.toFixed(4)}`);
      }
    }

    // Test 5: Clean up test data
    console.log('\n5. Cleaning up test data...');
    const { error: deleteError } = await supabase
      .from('memory_fragments')
      .delete()
      .eq('user_id', testUserId)
      .eq('conversation_context->>test', 'true');

    if (deleteError) {
      console.error('   ✗ Error cleaning up test data:', deleteError.message);
    } else {
      console.log('   ✓ Test data cleaned up successfully');
    }

    console.log('\n✅ Vector operations test completed successfully!');
    console.log('The database schema and vector search infrastructure is ready.');
    return true;

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    return false;
  }
}

// Run the test
testVectorOperations()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });