// test-memory-creation.js
// Test the actual memory creation process

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !serviceKey || !openaiKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);
const openai = new OpenAI({ apiKey: openaiKey });

async function testMemoryCreation() {
  console.log('🧪 Testing Memory Creation Process...\n');

  // Step 1: Get a real user ID
  console.log('1. Getting real user ID...');
  try {
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.log('❌ Error getting users:', error.message);
      return;
    }

    if (!users || users.length === 0) {
      console.log('❌ No users found in the system');
      console.log('🔧 You need to sign up/login to create a user first');
      return;
    }

    const testUser = users[0];
    console.log('✅ Found user:', testUser.id, testUser.email);

    // Step 2: Test OpenAI memory extraction
    console.log('\n2. Testing OpenAI memory extraction...');
    const testMessage = "I love hiking with my dog Max every weekend. He's a golden retriever.";
    
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Extract meaningful personal information and return as JSON array of strings. 
            Example: ["User loves hiking and does it every weekend", "User has a golden retriever named Max"]`
          },
          {
            role: 'user',
            content: testMessage
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const response = completion.choices[0].message.content;
      console.log('✅ OpenAI extraction response:', response);

      let fragments;
      try {
        fragments = JSON.parse(response);
        console.log('✅ Parsed fragments:', fragments);
      } catch (parseError) {
        console.log('❌ Failed to parse OpenAI response:', parseError.message);
        return;
      }

      // Step 3: Test embedding generation
      console.log('\n3. Testing embedding generation...');
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: fragments[0],
        encoding_format: 'float',
      });

      if (!embeddingResponse.data?.[0]?.embedding) {
        console.log('❌ Failed to generate embedding');
        return;
      }

      const embedding = embeddingResponse.data[0].embedding;
      console.log('✅ Generated embedding, length:', embedding.length);

      // Step 4: Test direct database insertion
      console.log('\n4. Testing direct database insertion...');
      try {
        const { data, error } = await supabase
          .from('memory_fragments')
          .insert({
            user_id: testUser.id,
            fragment_text: fragments[0],
            embedding: embedding,
            conversation_context: {
              timestamp: new Date().toISOString(),
              messageContext: testMessage.substring(0, 200),
              emotionalTone: 'positive'
            }
          })
          .select();

        if (error) {
          console.log('❌ Database insertion failed:', error.message);
          console.log('Error details:', error);
          
          if (error.message.includes('vector')) {
            console.log('🔧 ISSUE: pgvector extension not enabled');
            console.log('   Run: CREATE EXTENSION IF NOT EXISTS vector;');
          }
        } else {
          console.log('✅ Successfully inserted memory fragment:', data[0].id);
          
          // Test retrieval
          console.log('\n5. Testing memory retrieval...');
          const { data: retrieved, error: retrieveError } = await supabase
            .from('memory_fragments')
            .select('*')
            .eq('user_id', testUser.id);

          if (retrieveError) {
            console.log('❌ Retrieval failed:', retrieveError.message);
          } else {
            console.log('✅ Retrieved memories:', retrieved.length);
            if (retrieved.length > 0) {
              console.log('Sample:', {
                id: retrieved[0].id,
                text: retrieved[0].fragment_text,
                created_at: retrieved[0].created_at
              });
            }
          }

          // Test vector search
          console.log('\n6. Testing vector search...');
          const searchEmbedding = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: 'tell me about pets',
            encoding_format: 'float',
          });

          const { data: searchResults, error: searchError } = await supabase.rpc('match_memory_fragments', {
            query_embedding: searchEmbedding.data[0].embedding,
            match_threshold: 0.5,
            match_count: 5,
            target_user_id: testUser.id
          });

          if (searchError) {
            console.log('❌ Vector search failed:', searchError.message);
          } else {
            console.log('✅ Vector search returned:', searchResults.length, 'results');
            if (searchResults.length > 0) {
              console.log('Top result:', {
                text: searchResults[0].fragment_text,
                similarity: searchResults[0].similarity
              });
            }
          }
        }
      } catch (dbError) {
        console.log('❌ Database error:', dbError.message);
      }

    } catch (openaiError) {
      console.log('❌ OpenAI error:', openaiError.message);
    }

  } catch (authError) {
    console.log('❌ Auth error:', authError.message);
  }
}

testMemoryCreation().catch(console.error);