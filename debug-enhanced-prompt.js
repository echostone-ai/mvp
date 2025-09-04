// Debug the enhanced prompt builder memory retrieval
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function debugEnhancedPromptMemoryRetrieval() {
  console.log('=== Debugging Enhanced Prompt Builder Memory Retrieval ===\n');

  const query = 'have you ever been married?';
  const avatarSlug = 'jonathan_braden';
  
  // 1. Get avatar ID
  console.log('1. Resolving avatar ID...');
  const { data: prof, error: profError } = await supabase
    .from('avatar_profiles')
    .select('id')
    .eq('name', avatarSlug)
    .single();

  if (profError || !prof?.id) {
    console.error('❌ Avatar not found:', profError);
    return;
  }

  const avatarId = prof.id;
  console.log(`✅ Avatar ID: ${avatarId}`);

  // 2. Test the fast mode memory retrieval logic
  console.log('\n2. Testing fast mode memory retrieval...');
  
  // This mimics the logic from fetchRelevantMemoriesFast
  const queryLower = query.toLowerCase();
  const searchTerms = queryLower.split(' ').slice(0, 3); // First 3 words: ['have', 'you', 'ever']
  console.log(`Search terms from query: ${searchTerms}`);
  
  // The issue might be here - the search terms are too generic!
  const orConditions = searchTerms.map(term => `fragment_text.ilike.%${term}%`);
  console.log(`OR conditions: ${orConditions}`);

  // Test this search
  let testQuery = supabase
    .from('memory_fragments')
    .select('id, fragment_text, created_at, conversation_context')
    .eq('avatar_id', avatarId)
    .or(orConditions.join(','));

  const { data: fastResults, error: fastError } = await testQuery
    .order('created_at', { ascending: false })
    .limit(6);

  console.log(`Fast mode results: ${fastResults?.length || 0} memories found`);
  if (fastError) console.error('Fast mode error:', fastError);

  // 3. Test with better search terms
  console.log('\n3. Testing with marriage-specific search terms...');
  
  const marriageTerms = ['married', 'marriage', 'wife', 'husband', 'partner'];
  const marriageConditions = marriageTerms.map(term => `fragment_text.ilike.%${term}%`);
  
  const { data: marriageResults, error: marriageError } = await supabase
    .from('memory_fragments')
    .select('id, fragment_text, created_at, conversation_context')
    .eq('avatar_id', avatarId)
    .or(marriageConditions.join(','))
    .order('created_at', { ascending: false })
    .limit(6);

  console.log(`Marriage-specific results: ${marriageResults?.length || 0} memories found`);
  if (marriageError) console.error('Marriage search error:', marriageError);

  // 4. Check the query length filter
  console.log('\n4. Checking query length filter...');
  console.log(`Query length: ${query.length} characters`);
  console.log(`Has question mark: ${query.includes('?')}`);
  
  // The code has this condition: if (query.length < 15 && !query.includes('?') && !isGeoQuery)
  const wouldSkipMemorySearch = query.length < 15 && !query.includes('?');
  console.log(`Would skip memory search: ${wouldSkipMemorySearch ? '❌ YES' : '✅ NO'}`);

  // 5. Test the actual enhanced prompt builder
  console.log('\n5. Testing with EnhancedPromptBuilder...');
  
  try {
    // Import the actual class
    const { EnhancedPromptBuilder } = await import('./src/lib/services/enhancedPromptBuilder.js');
    
    const builder = new EnhancedPromptBuilder(supabase);
    
    // Test the buildEnhancedSystemPromptWithStyle method
    const result = await builder.buildEnhancedSystemPromptWithStyle(
      avatarSlug,
      query,
      [], // conversation history
      {
        priorityFilter: 6,
        memoryLimit: 8,
        trackExpressions: true,
        fastMode: true,
        debug: true,
        demoMode: {
          isDemo: true,
          conversationId: 'jonathan-demo',
          visitorId: process.env.DEMO_SYSTEM_USER_ID
        }
      }
    );
    
    console.log('Enhanced prompt builder result:');
    console.log(`- Memories found: ${result.debug?.memories_found || 'Not provided'}`);
    console.log(`- Facts found: ${result.debug?.facts_found || 'Not provided'}`);
    console.log(`- Processing time: ${result.debug?.processing_time_ms || 'Not provided'}ms`);
    
    if (result.debug?.memory_retrieval) {
      console.log('- Memory retrieval details:', result.debug.memory_retrieval);
    }
    
  } catch (error) {
    console.error('Enhanced prompt builder test failed:', error.message);
  }
}

debugEnhancedPromptMemoryRetrieval().catch(console.error);