// debug-memory-system.js
// Comprehensive debugging script for the memory system

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
  console.error('❌ Missing required environment variables');
  console.log('Required:');
  console.log('- NEXT_PUBLIC_SUPABASE_URL');
  console.log('- SUPABASE_SERVICE_ROLE_KEY');
  console.log('- OPENAI_API_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

async function debugMemorySystem() {
  console.log('🔍 Debugging Memory System...\n');

  // Test 1: Check database connectivity
  console.log('1. Testing database connectivity...');
  try {
    const { data, error } = await supabase
      .from('memory_fragments')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.log('❌ Database connection failed:', error.message);
      return false;
    }
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.log('❌ Database connection error:', error.message);
    return false;
  }

  // Test 2: Check OpenAI API connectivity
  console.log('2. Testing OpenAI API connectivity...');
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 10
    });
    
    if (!completion.choices[0].message.content) {
      console.log('❌ OpenAI API returned no content');
      return false;
    }
    console.log('✅ OpenAI API connected successfully');
  } catch (error) {
    console.log('❌ OpenAI API error:', error.message);
    return false;
  }

  // Test 3: Test memory extraction
  console.log('3. Testing memory extraction...');
  try {
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

Examples:
Input: "I love hiking with my dog Max every weekend. He's a golden retriever and gets so excited when he sees the leash."
Output: ["User loves hiking and does it every weekend", "User has a golden retriever named Max who gets excited about walks"]

Input: "It's raining today and I'm feeling tired."
Output: []

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
    console.log('Raw extraction response:', response);

    if (!response) {
      console.log('❌ No response from memory extraction');
      return false;
    }

    let fragments;
    try {
      fragments = JSON.parse(response);
    } catch (parseError) {
      console.log('❌ Failed to parse extraction response:', parseError.message);
      console.log('Response was:', response);
      return false;
    }

    if (!Array.isArray(fragments)) {
      console.log('❌ Extraction response is not an array:', fragments);
      return false;
    }

    console.log('✅ Memory extraction successful');
    console.log('Extracted fragments:', fragments);
  } catch (error) {
    console.log('❌ Memory extraction failed:', error.message);
    return false;
  }

  // Test 4: Test embedding generation
  console.log('4. Testing embedding generation...');
  try {
    const testText = "User loves hiking and does it every weekend";
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: testText,
      encoding_format: 'float'
    });

    if (!response.data?.[0]?.embedding) {
      console.log('❌ No embedding data returned');
      return false;
    }

    const embedding = response.data[0].embedding;
    console.log('✅ Embedding generation successful');
    console.log('Embedding length:', embedding.length);
    console.log('First 5 values:', embedding.slice(0, 5));
  } catch (error) {
    console.log('❌ Embedding generation failed:', error.message);
    return false;
  }

  // Test 5: Test memory storage
  console.log('5. Testing memory storage...');
  try {
    const testUserId = '00000000-0000-0000-0000-000000000001'; // Test UUID
    const testFragment = "User loves hiking and does it every weekend";
    
    // Generate embedding
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: testFragment,
      encoding_format: 'float'
    });
    const embedding = embeddingResponse.data[0].embedding;

    // Store in database
    const { data, error } = await supabase
      .from('memory_fragments')
      .insert({
        user_id: testUserId,
        fragment_text: testFragment,
        embedding: embedding,
        conversation_context: {
          timestamp: new Date().toISOString(),
          messageContext: 'Debug test',
          emotionalTone: 'positive'
        }
      })
      .select('id')
      .single();

    if (error) {
      console.log('❌ Memory storage failed:', error.message);
      return false;
    }

    console.log('✅ Memory storage successful');
    console.log('Stored fragment ID:', data.id);

    // Clean up test data
    await supabase
      .from('memory_fragments')
      .delete()
      .eq('id', data.id);
    
    console.log('✅ Test data cleaned up');
  } catch (error) {
    console.log('❌ Memory storage test failed:', error.message);
    return false;
  }

  // Test 6: Test vector search
  console.log('6. Testing vector search...');
  try {
    const testUserId = '00000000-0000-0000-0000-000000000001';
    const queryText = "outdoor activities";
    
    // Generate query embedding
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: queryText,
      encoding_format: 'float'
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Test vector search function
    const { data, error } = await supabase.rpc('match_memory_fragments', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: 5,
      target_user_id: testUserId
    });

    if (error) {
      console.log('❌ Vector search failed:', error.message);
      return false;
    }

    console.log('✅ Vector search successful');
    console.log('Search results:', data.length, 'fragments found');
  } catch (error) {
    console.log('❌ Vector search test failed:', error.message);
    return false;
  }

  // Test 7: Check existing memory data
  console.log('7. Checking existing memory data...');
  try {
    const { data, error } = await supabase
      .from('memory_fragments')
      .select('user_id, fragment_text, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.log('❌ Failed to check existing data:', error.message);
      return false;
    }

    console.log('✅ Existing memory data check successful');
    console.log('Total fragments in database:', data.length);
    
    if (data.length > 0) {
      console.log('Recent fragments:');
      data.forEach((fragment, index) => {
        console.log(`  ${index + 1}. User: ${fragment.user_id.substring(0, 8)}... | Text: "${fragment.fragment_text.substring(0, 50)}..." | Created: ${fragment.created_at}`);
      });
    } else {
      console.log('No memory fragments found in database');
    }
  } catch (error) {
    console.log('❌ Existing data check failed:', error.message);
    return false;
  }

  console.log('\n🎉 All memory system tests passed!');
  console.log('The memory system should be working correctly.');
  
  return true;
}

// Run the debug
debugMemorySystem().then(success => {
  if (!success) {
    console.log('\n❌ Memory system has issues that need to be fixed.');
    process.exit(1);
  }
  process.exit(0);
});