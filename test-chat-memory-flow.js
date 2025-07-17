// test-chat-memory-flow.js
// Test the exact memory flow that happens during chat

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseAnonKey || !openaiApiKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// Use the same client setup as the actual app
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

// Simulate the exact memory extraction logic from MemoryService
async function extractMemoryFragments(message, userId, conversationContext) {
  const EXTRACTION_PROMPT = `
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

Input: "My sister Sarah is getting married next month. I'm so nervous about giving the maid of honor speech because I hate public speaking."
Output: ["User has a sister named Sarah who is getting married", "User is the maid of honor at Sarah's wedding", "User dislikes public speaking and gets nervous about it"]

Now extract memory fragments from this message:
`;

  try {
    console.log('🧠 Extracting memories from:', message);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: EXTRACTION_PROMPT,
        },
        {
          role: 'user',
          content: message,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const response = completion.choices[0].message.content;
    if (!response) {
      throw new Error('No response from OpenAI for memory extraction');
    }

    console.log('📝 Raw extraction response:', response);

    let fragments;
    try {
      fragments = JSON.parse(response);
    } catch (parseError) {
      throw new Error('Failed to parse memory extraction response: ' + parseError.message);
    }

    if (!Array.isArray(fragments) || !fragments.every(f => typeof f === 'string')) {
      throw new Error('Invalid memory extraction response format');
    }

    const timestamp = new Date().toISOString();
    const memoryFragments = fragments.map(fragmentText => ({
      userId,
      fragmentText: fragmentText.trim(),
      conversationContext: {
        timestamp,
        messageContext: conversationContext || message.substring(0, 200),
        emotionalTone: detectEmotionalTone(message)
      }
    }));

    console.log('✅ Extracted', memoryFragments.length, 'memory fragments');
    return memoryFragments;

  } catch (error) {
    console.log('❌ Memory extraction failed:', error.message);
    return [];
  }
}

function detectEmotionalTone(message) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('love') || lowerMessage.includes('happy') || lowerMessage.includes('excited')) {
    return 'positive';
  }
  if (lowerMessage.includes('sad') || lowerMessage.includes('worried') || lowerMessage.includes('upset')) {
    return 'negative';
  }
  if (lowerMessage.includes('nervous') || lowerMessage.includes('anxious') || lowerMessage.includes('scared')) {
    return 'anxious';
  }
  
  return 'neutral';
}

async function generateEmbedding(text) {
  try {
    console.log('🔢 Generating embedding for:', text.substring(0, 50) + '...');
    
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
    });

    if (!response.data?.[0]?.embedding) {
      throw new Error('No embedding data returned from OpenAI');
    }

    console.log('✅ Generated embedding, length:', response.data[0].embedding.length);
    return response.data[0].embedding;
  } catch (error) {
    console.log('❌ Embedding generation failed:', error.message);
    throw error;
  }
}

async function storeMemoryFragment(fragment) {
  try {
    console.log('💾 Storing memory fragment:', fragment.fragmentText);
    
    // Generate embedding if not provided
    if (!fragment.embedding) {
      fragment.embedding = await generateEmbedding(fragment.fragmentText);
    }

    const { data, error } = await supabase
      .from('memory_fragments')
      .insert({
        user_id: fragment.userId,
        fragment_text: fragment.fragmentText,
        embedding: fragment.embedding,
        conversation_context: fragment.conversationContext,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error('Database error: ' + error.message);
    }

    if (!data?.id) {
      throw new Error('No ID returned from memory fragment insertion');
    }

    console.log('✅ Stored memory fragment with ID:', data.id);
    return data.id;
  } catch (error) {
    console.log('❌ Memory storage failed:', error.message);
    throw error;
  }
}

async function processAndStoreMemories(message, userId, conversationContext) {
  try {
    console.log('\n🚀 Starting memory processing...');
    console.log('User ID:', userId);
    console.log('Message:', message);
    console.log('Context:', conversationContext);

    // Extract memory fragments
    const fragments = await extractMemoryFragments(message, userId, conversationContext);

    if (fragments.length === 0) {
      console.log('ℹ️  No meaningful memories extracted from this message');
      return [];
    }

    console.log('📋 Processing', fragments.length, 'fragments...');

    // Store fragments with embeddings
    const storedFragments = [];
    for (const fragment of fragments) {
      try {
        const fragmentId = await storeMemoryFragment(fragment);
        storedFragments.push({
          ...fragment,
          id: fragmentId
        });
      } catch (error) {
        console.log('⚠️  Failed to store fragment:', fragment.fragmentText, '- Error:', error.message);
      }
    }

    console.log('✅ Successfully stored', storedFragments.length, 'out of', fragments.length, 'fragments');
    return storedFragments;

  } catch (error) {
    console.log('❌ Memory processing failed:', error.message);
    return [];
  }
}

async function testChatMemoryFlow() {
  console.log('🔍 Testing Chat Memory Flow...\n');

  // Test with a realistic chat message
  const testMessage = "I love hiking with my dog Max every weekend. He's a golden retriever and gets so excited when he sees the leash. We usually go to the mountains near my house.";
  const testUserId = 'test-user-id-12345'; // This will fail due to foreign key, but we'll see the exact error
  const conversationContext = `Chat conversation at ${new Date().toISOString()}`;

  console.log('Testing with message:', testMessage);
  console.log('User ID:', testUserId);

  const result = await processAndStoreMemories(testMessage, testUserId, conversationContext);
  
  if (result.length > 0) {
    console.log('\n🎉 Memory processing successful!');
    console.log('Stored memories:', result.map(r => r.fragmentText));
  } else {
    console.log('\n❌ No memories were stored');
  }

  // Also test with a message that should not generate memories
  console.log('\n---\n');
  console.log('Testing with non-memorable message...');
  const boringMessage = "It's raining today and I'm feeling tired.";
  const boringResult = await processAndStoreMemories(boringMessage, testUserId, conversationContext);
  
  if (boringResult.length === 0) {
    console.log('✅ Correctly identified non-memorable message');
  } else {
    console.log('⚠️  Unexpectedly extracted memories from boring message:', boringResult);
  }
}

// Run the test
testChatMemoryFlow().then(() => {
  console.log('\n🏁 Chat memory flow test completed');
}).catch(error => {
  console.error('💥 Test crashed:', error);
});