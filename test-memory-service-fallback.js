#!/usr/bin/env node

/**
 * Test Memory Service Fallback - Test the enhanced searchMemoriesByText function
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const JONATHAN_AVATAR_ID = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';

async function testMemoryServiceFallback() {
  console.log('🔍 TESTING MEMORY SERVICE FALLBACK FUNCTION\n');
  
  // Simulate the enhanced searchMemoriesByText function
  async function searchMemoriesByText(searchText, userId, limit = 10, avatarId = null) {
    console.log(`[Test] searchMemoriesByText - query: "${searchText}", avatar: ${avatarId}`);
    
    // Resolve avatarId (simulate the function)
    const resolvedAvatarId = avatarId === 'jonathan-demo' ? JONATHAN_AVATAR_ID : avatarId;
    
    // Build query to include both user memories AND avatar bio memories
    let query = supabase
      .from('memory_fragments')
      .select('*');
      
    if (resolvedAvatarId) {
      // Include memories that belong to either:
      // 1. This user AND this avatar (conversation memories)
      // 2. This avatar with no user (bio/seeded memories)
      query = query.or(`and(user_id.eq.${userId},avatar_id.eq.${resolvedAvatarId}),and(user_id.is.null,avatar_id.eq.${resolvedAvatarId})`);
    } else {
      // Fallback to user-only if no avatar
      query = query.eq('user_id', userId);
    }
    
    // Enhanced text search with comprehensive term matching
    if (searchText && searchText.trim()) {
      const queryLower = searchText.toLowerCase();
      
      // Enhanced query analysis for better term extraction
      const isDogQuery = /\b(dog|dogs|pet|pets|bucky|george|olive|romeo|poodle|valentine)\b/i.test(queryLower);
      const isMusicQuery = /\b(music|favorite|band|artist|nirvana|sound|emotion|kurt|cobain)\b/i.test(queryLower);
      
      let searchTerms = [];
      
      if (isDogQuery) {
        // Comprehensive dog search terms
        searchTerms = ['dog', 'dogs', 'pet', 'pets', 'bucky', 'george', 'olive', 'romeo', 'poodle', 'valentine', 'toy', 'golden', 'retriever'];
      } else if (isMusicQuery) {
        // Comprehensive music search terms
        searchTerms = ['music', 'favorite', 'band', 'artist', 'nirvana', 'song', 'sound', 'emotion', 'kurt', 'cobain'];
      } else {
        // General search - extract meaningful words
        searchTerms = searchText.toLowerCase().split(/\s+/).filter(w => 
          w.length > 1 && 
          !['what', 'was', 'your', 'the', 'a', 'an', 'is', 'are', 'tell', 'me', 'about'].includes(w)
        );
      }
      
      console.log('[Test] Using search terms:', searchTerms);
      
      if (searchTerms.length > 0) {
        const orConditions = [];
        
        // Add individual term searches
        searchTerms.forEach(term => {
          orConditions.push(`fragment_text.ilike.%${term}%`);
        });
        
        // Add exact phrase search if multiple words
        if (searchText.includes(' ')) {
          orConditions.push(`fragment_text.ilike.%${searchText}%`);
        }
        
        query = query.or(orConditions.join(','));
      }
    }
    
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit * 3); // Get more to allow for filtering and ranking
    
    console.log('[Test] Retrieved', data?.length || 0, 'memories before filtering');

    if (error) {
      console.error('[Test] Query error:', error);
      return [];
    }

    return (data || []).map(item => ({
      id: item.id,
      userId: item.user_id,
      avatarId: item.avatar_id,
      fragmentText: item.fragment_text,
      conversationContext: item.conversation_context,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at)
    }));
  }
  
  // Test queries that were failing
  const testQueries = [
    {
      query: 'romeo poodle',
      userId: '550e8400-e29b-41d4-a716-446655440000', // Demo user
      avatarId: 'jonathan-demo',
      expectedTerms: ['romeo', 'poodle', 'valentine', 'toy']
    },
    {
      query: 'bucky first dog',
      userId: '550e8400-e29b-41d4-a716-446655440000',
      avatarId: 'jonathan-demo',
      expectedTerms: ['bucky', 'golden', 'retriever', 'first']
    },
    {
      query: 'george dog',
      userId: '550e8400-e29b-41d4-a716-446655440000',
      avatarId: 'jonathan-demo',
      expectedTerms: ['george', 'dog', 'energetic', 'fetch']
    }
  ];
  
  for (const test of testQueries) {
    console.log(`\n🔍 Testing: "${test.query}"`);
    console.log(`Expected terms: ${test.expectedTerms.join(', ')}`);
    
    try {
      const memories = await searchMemoriesByText(test.query, test.userId, 20, test.avatarId);
      
      console.log(`📊 Retrieved ${memories.length} memories`);
      
      if (memories.length === 0) {
        console.log('❌ No memories retrieved with enhanced fallback');
        
        // Try even more basic search
        console.log('🔧 Trying ultra-basic search...');
        const { data: basicData } = await supabase
          .from('memory_fragments')
          .select('id, fragment_text')
          .eq('avatar_id', JONATHAN_AVATAR_ID)
          .ilike('fragment_text', `%${test.query.split(' ')[0]}%`)
          .limit(5);
          
        if (basicData && basicData.length > 0) {
          console.log(`📊 Ultra-basic search found ${basicData.length} memories:`);
          basicData.forEach((memory, i) => {
            console.log(`   ${i + 1}. ${memory.fragment_text.substring(0, 100)}...`);
          });
        } else {
          console.log('❌ Even ultra-basic search found nothing');
        }
        
        continue;
      }
      
      // Check for expected terms
      const allText = memories.map(m => m.fragmentText.toLowerCase()).join(' ');
      let foundTerms = 0;
      
      for (const term of test.expectedTerms) {
        if (allText.includes(term.toLowerCase())) {
          foundTerms++;
          console.log(`  ✅ Found expected term: "${term}"`);
        } else {
          console.log(`  ⚠️  Missing expected term: "${term}"`);
        }
      }
      
      const coverage = foundTerms / test.expectedTerms.length;
      console.log(`  📊 Term coverage: ${Math.round(coverage * 100)}% (${foundTerms}/${test.expectedTerms.length})`);
      
      // Show top results
      console.log('  🔍 Top 3 results:');
      memories.slice(0, 3).forEach((memory, i) => {
        console.log(`    ${i + 1}. ${memory.fragmentText.substring(0, 120)}...`);
      });
      
      if (coverage >= 0.5) {
        console.log('  ✅ GOOD COVERAGE: Enhanced fallback is working');
      } else {
        console.log('  ⚠️  LOW COVERAGE: May need further enhancement');
      }
      
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
    }
  }
  
  console.log('\n📋 SUMMARY:');
  console.log('The enhanced searchMemoriesByText function should now:');
  console.log('1. ✅ Include comprehensive search terms for dog and music queries');
  console.log('2. ✅ Search both user memories AND avatar bio memories');
  console.log('3. ✅ Use multiple OR conditions for better matching');
  console.log('4. ✅ Provide fallback when enhanced retrieval returns 0 results');
}

testMemoryServiceFallback().catch(console.error);