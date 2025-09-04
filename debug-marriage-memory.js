// Debug script to test marriage memory retrieval
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function debugMarriageMemory() {
  console.log('=== Debugging Marriage Memory Retrieval ===\n');

  // 1. Find the Tia marriage memory
  console.log('1. Looking for Tia marriage memory...');
  const { data: tiaMemory, error: tiaError } = await supabase
    .from('memory_fragments')
    .select('*')
    .ilike('fragment_text', '%married%Tia%')
    .limit(5);

  if (tiaError) {
    console.error('Error finding Tia memory:', tiaError);
    return;
  }

  if (!tiaMemory || tiaMemory.length === 0) {
    console.log('❌ No Tia marriage memory found');
    return;
  }

  console.log(`✅ Found ${tiaMemory.length} Tia marriage memory(ies):`);
  tiaMemory.forEach((memory, i) => {
    console.log(`\nMemory ${i + 1}:`);
    console.log(`ID: ${memory.id}`);
    console.log(`Fragment: ${memory.fragment_text}`);
    console.log(`Context:`, JSON.stringify(memory.conversation_context, null, 2));
    console.log(`Created: ${memory.created_at}`);
  });

  // 2. Test demo mode filtering logic
  console.log('\n2. Testing demo mode filtering logic...');
  const testMemory = tiaMemory[0];
  const ctx = testMemory.conversation_context || {};
  
  console.log('Memory context analysis:');
  console.log(`- ctx_type: ${ctx.ctx_type}`);
  console.log(`- type: ${ctx.type}`);
  console.log(`- visitor_id: ${ctx.visitor_id}`);
  console.log(`- conversation_id: ${ctx.conversation_id}`);
  console.log(`- source: ${ctx.source}`);
  console.log(`- tags: ${JSON.stringify(ctx.tags)}`);
  console.log(`- is_avatar_memory: ${ctx.is_avatar_memory}`);
  console.log(`- expires_at: ${ctx.expires_at}`);

  // Apply the filtering logic from the code
  let shouldInclude = false;
  let reason = '';

  // Include global seed memories (identity, bio, language_style, story) with no visitor_id
  if (['identity', 'bio', 'language_style', 'story'].includes(ctx.ctx_type) && 
      !ctx.visitor_id && !ctx.conversation_id) {
    shouldInclude = true;
    reason = 'Global seed memory (ctx_type)';
  }
  
  // Include bio memories with simple context structure (like Tia memory)
  else if (ctx.type === 'bio' && !ctx.visitor_id && !ctx.conversation_id) {
    shouldInclude = true;
    reason = 'Bio memory with simple context';
  }
  
  // Include avatar's own memories (personal stories, relationships, experiences)
  else if (ctx.source === 'avatar_personal_memory' || 
      ctx.tags?.includes('avatar_memory') ||
      ctx.tags?.includes('personal_story') ||
      ctx.is_avatar_memory === true) {
    shouldInclude = true;
    reason = 'Avatar personal memory';
  }
  
  // Include visitor-scoped demo memories that haven't expired
  else if (ctx.conversation_id === 'jonathan-demo' && 
      ctx.visitor_id === 'demo-visitor' &&
      ctx.expires_at && new Date(ctx.expires_at) > new Date()) {
    shouldInclude = true;
    reason = 'Valid visitor-scoped demo memory';
  }
  
  // Include memories without expiration (permanent avatar memories)
  else if (ctx.conversation_id === 'jonathan-demo' && !ctx.expires_at) {
    shouldInclude = true;
    reason = 'Permanent demo memory';
  }

  console.log(`\n3. Filtering result:`);
  console.log(`Should include: ${shouldInclude ? '✅ YES' : '❌ NO'}`);
  console.log(`Reason: ${reason || 'Does not match any inclusion criteria'}`);

  // 3. Test marriage query search
  console.log('\n4. Testing marriage query search...');
  const marriageQuery = 'have you ever been married?';
  
  // Test the search terms that would be generated
  const searchTerms = ['married', 'marriage', 'wife', 'husband', 'partner'];
  const orConditions = searchTerms.map(term => `fragment_text.ilike.%${term}%`);
  
  console.log(`Query: "${marriageQuery}"`);
  console.log(`Search terms: ${searchTerms.join(', ')}`);
  console.log(`OR conditions: ${orConditions.join(', ')}`);

  // Test the actual search
  const { data: searchResults, error: searchError } = await supabase
    .from('memory_fragments')
    .select('id, fragment_text, created_at, conversation_context')
    .eq('avatar_id', testMemory.avatar_id)
    .or(orConditions.join(','))
    .order('created_at', { ascending: false })
    .limit(10);

  if (searchError) {
    console.error('Search error:', searchError);
    return;
  }

  console.log(`\n5. Search results (${searchResults?.length || 0} found):`);
  searchResults?.forEach((result, i) => {
    const resultCtx = result.conversation_context || {};
    let includeInDemo = false;
    
    // Apply same filtering logic
    if (['identity', 'bio', 'language_style', 'story'].includes(resultCtx.ctx_type) && 
        !resultCtx.visitor_id && !resultCtx.conversation_id) {
      includeInDemo = true;
    } else if (resultCtx.type === 'bio' && !resultCtx.visitor_id && !resultCtx.conversation_id) {
      includeInDemo = true;
    } else if (resultCtx.source === 'avatar_personal_memory' || 
        resultCtx.tags?.includes('avatar_memory') ||
        resultCtx.tags?.includes('personal_story') ||
        resultCtx.is_avatar_memory === true) {
      includeInDemo = true;
    } else if (resultCtx.conversation_id === 'jonathan-demo' && !resultCtx.expires_at) {
      includeInDemo = true;
    }

    console.log(`\nResult ${i + 1}: ${includeInDemo ? '✅ INCLUDED' : '❌ FILTERED OUT'}`);
    console.log(`Fragment: ${result.fragment_text.substring(0, 100)}...`);
    console.log(`Context type: ${resultCtx.ctx_type || resultCtx.type || 'none'}`);
  });

  // 6. Recommendation
  console.log('\n6. RECOMMENDATION:');
  if (!shouldInclude) {
    console.log('❌ The Tia marriage memory is being filtered out in demo mode!');
    console.log('💡 SOLUTION: Update the memory context to mark it as a bio/identity memory');
    console.log('   - Set conversation_context.type = "bio"');
    console.log('   - OR set conversation_context.ctx_type = "bio"');
    console.log('   - OR add "avatar_memory" to tags array');
    console.log('   - OR set is_avatar_memory = true');
  } else {
    console.log('✅ The Tia marriage memory should be included in demo mode');
    console.log('🤔 The issue might be elsewhere in the retrieval chain');
  }
}

debugMarriageMemory().catch(console.error);