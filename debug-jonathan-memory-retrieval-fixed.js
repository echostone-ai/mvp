const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugMemoryRetrieval() {
  console.log('🔍 Debugging Jonathan Demo Memory Retrieval (Fixed)...\n');
  
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const avatarId = 'jonathan-demo';
  const resolvedAvatarId = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
  
  // 1. Check memory_fragments table with correct column name
  console.log('1. Checking memory_fragments table...');
  const { data: fragments, error: fragError } = await supabase
    .from('memory_fragments')
    .select('*')
    .eq('user_id', userId)
    .eq('avatar_id', resolvedAvatarId);
    
  console.log(`Found ${fragments?.length || 0} memory fragments`);
  if (fragError) console.log('Fragment error:', fragError);
  if (fragments?.length > 0) {
    console.log('Sample fragment:', fragments[0]);
    console.log('All fragments:');
    fragments.forEach((f, i) => {
      console.log(`  ${i+1}. ${f.fragment_text.substring(0, 100)}...`);
    });
  }
  
  // 2. Test basic memory retrieval with correct column
  console.log('\n2. Testing basic memory retrieval with "dog" query...');
  const { data: basicResult, error: basicError } = await supabase
    .from('memory_fragments')
    .select('*')
    .eq('user_id', userId)
    .eq('avatar_id', resolvedAvatarId)
    .ilike('fragment_text', '%dog%')
    .limit(5);
    
  console.log(`Basic retrieval returned ${basicResult?.length || 0} memories`);
  if (basicError) console.log('Basic error:', basicError);
  if (basicResult?.length > 0) {
    console.log('Dog-related memories found:');
    basicResult.forEach((r, i) => {
      console.log(`  ${i+1}. ${r.fragment_text}`);
    });
  }
  
  // 3. Check what RPC functions exist
  console.log('\n3. Checking available RPC functions...');
  const { data: functions, error: funcError } = await supabase
    .rpc('get_enhanced_memories', {
      p_user_id: userId,
      p_avatar_id: resolvedAvatarId,
      p_query: 'dog',
      p_limit: 10
    });
    
  if (funcError) {
    console.log('get_enhanced_memories error:', funcError);
    
    // Try alternative function names
    console.log('\n4. Trying search_memories function...');
    const { data: searchResult, error: searchError } = await supabase
      .rpc('search_memories', {
        query_text: 'dog',
        user_id: userId,
        avatar_id: resolvedAvatarId,
        limit_count: 10
      });
      
    if (searchError) {
      console.log('search_memories error:', searchError);
    } else {
      console.log(`search_memories returned ${searchResult?.length || 0} results`);
      if (searchResult?.length > 0) {
        console.log('Search results:', searchResult);
      }
    }
  } else {
    console.log(`get_enhanced_memories returned ${functions?.length || 0} results`);
    if (functions?.length > 0) {
      console.log('Enhanced results:', functions);
    }
  }
  
  // 4. Test text search using PostgreSQL full-text search
  console.log('\n5. Testing PostgreSQL text search...');
  const { data: textSearch, error: textError } = await supabase
    .from('memory_fragments')
    .select('*')
    .eq('user_id', userId)
    .eq('avatar_id', resolvedAvatarId)
    .textSearch('tv', 'dog')
    .limit(5);
    
  console.log(`Text search returned ${textSearch?.length || 0} memories`);
  if (textError) console.log('Text search error:', textError);
  if (textSearch?.length > 0) {
    console.log('Text search results:');
    textSearch.forEach((r, i) => {
      console.log(`  ${i+1}. ${r.fragment_text}`);
    });
  }
}

debugMemoryRetrieval().catch(console.error);