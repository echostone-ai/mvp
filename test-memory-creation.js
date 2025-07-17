// test-memory-creation.js
// Test memory creation with a real user from the system

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

async function testMemoryCreation() {
  console.log('🔍 Testing Memory Creation with Real User...\n');

  // Step 1: Find a real user from the auth.users table
  console.log('1. Finding a real user...');
  try {
    const { data: users, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.log('❌ Failed to get users:', error.message);
      return false;
    }

    if (!users.users || users.users.length === 0) {
      console.log('❌ No users found in the system');
      console.log('Please create a user account first by signing up at /signup');
      return false;
    }

    const testUser = users.users[0];
    console.log('✅ Found user:', testUser.email, 'ID:', testUser.id);

    // Step 2: Test memory extraction
    console.log('2. Testing memory extraction...');
    const testMessage = "I love hiking with my dog Max every weekend. He's a golden retriever and gets so excited when he sees the leash.";
    
    const extractionPrompt = `
You are an AI assistant that extracts meaningful personal information from user messages to create memory fragments for future conversations.

Your task is to identify and extract:
- Personal relationships (family, friends, colleagues, pets)
- Significant experiences and life events
- Personal preferences (hobbies, interests, dislikes)
- Important personal details (goals, fears, values)
- Emotional connections and memories

IMPORTANT RULES:
1. Only extract information that is personally meaningful and would be valuable to remember in future conversations
2. Extract complete, standalone fragments that make sense without additional context
3. Ignore casual mentions or temporary states
4. Focus on information that reveals character, relationships, or lasting preferences
5. If no meaningful personal information is found, return an empty array

Return your response as a JSON array of strings, where each string is a meaningful memory fragment.

Now extract memory fragments from this message:
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: extractionPrompt },
        { role: 'user', content: testMessage }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    const response = completion.choices[0].message.content;
    const fragments = JSON.parse(response);
    
    console.log('✅ Extracted fragments:', fragments);

    // Step 3: Generate embeddings and store memories
    console.log('3. Storing memories in database...');
    
    for (const fragmentText of fragments) {
      // Generate embedding
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: fragmentText,
        encoding_format: 'float'
      });
      const embedding = embeddingResponse.data[0].embedding;

      // Store in database
      const { data, error } = await supabase
        .from('memory_fragments')
        .insert({
          user_id: testUser.id,
          fragment_text: fragmentText,
          embedding: embedding,
          conversation_context: {
            timestamp: new Date().toISOString(),
            messageContext: 'Test memory creation',
            emotionalTone: 'positive'
          }
        })
        .select('id')
        .single();

      if (error) {
        console.log('❌ Failed to store fragment:', error.message);
        return false;
      }

      console.log('✅ Stored fragment:', fragmentText, '| ID:', data.id);
    }

    // Step 4: Test memory retrieval
    console.log('4. Testing memory retrieval...');
    const queryText = "outdoor activities";
    
    // Generate query embedding
    const queryEmbeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: queryText,
      encoding_format: 'float'
    });
    const queryEmbedding = queryEmbeddingResponse.data[0].embedding;

    // Search for relevant memories
    const { data: searchResults, error: searchError } = await supabase.rpc('match_memory_fragments', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: 5,
      target_user_id: testUser.id
    });

    if (searchError) {
      console.log('❌ Memory search failed:', searchError.message);
      return false;
    }

    console.log('✅ Memory search successful');
    console.log('Found', searchResults.length, 'relevant memories:');
    searchResults.forEach((result, index) => {
      console.log(`  ${index + 1}. "${result.fragment_text}" (similarity: ${result.similarity?.toFixed(3)})`);
    });

    // Step 5: Check all memories for this user
    console.log('5. Checking all memories for user...');
    const { data: allMemories, error: allError } = await supabase
      .from('memory_fragments')
      .select('fragment_text, created_at')
      .eq('user_id', testUser.id)
      .order('created_at', { ascending: false });

    if (allError) {
      console.log('❌ Failed to get all memories:', allError.message);
      return false;
    }

    console.log('✅ Total memories for user:', allMemories.length);
    allMemories.forEach((memory, index) => {
      console.log(`  ${index + 1}. "${memory.fragment_text}" (${memory.created_at})`);
    });

    console.log('\n🎉 Memory system is working correctly!');
    console.log('✅ Memory extraction works');
    console.log('✅ Memory storage works');
    console.log('✅ Memory retrieval works');
    console.log('✅ Vector search works');
    
    return true;

  } catch (error) {
    console.log('❌ Test failed:', error.message);
    console.log('Stack trace:', error.stack);
    return false;
  }
}

// Run the test
testMemoryCreation().then(success => {
  if (!success) {
    console.log('\n❌ Memory creation test failed.');
    console.log('The memory system needs debugging.');
    process.exit(1);
  }
  
  console.log('\n✅ Memory creation test passed!');
  console.log('The memory system should now work in the chat interface.');
  process.exit(0);
});