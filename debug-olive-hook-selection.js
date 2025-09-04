// Debug script to test the memory analysis and hook selection for Olive query
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Import the analysis functions (simplified versions for testing)
function lightAnalyze(memories, query) {
  return memories.map(memory => {
    const fragmentText = memory.fragment_text || '';
    const context = memory.conversation_context || {};
    const memoryType = context.type || 'unknown';
    
    // Calculate hook potential
    const hookPotential = calculateHookPotential(fragmentText, memoryType, query);
    
    return {
      memoryId: memory.id,
      hookPotential,
      fragmentText: fragmentText.substring(0, 200),
      memoryType
    };
  });
}

function calculateHookPotential(text, memoryType, query) {
  let score = 0.5;
  const lowerText = text.toLowerCase();
  const lowerQuery = query?.toLowerCase() || '';
  
  // Query relevance boost
  if (query) {
    const queryWords = lowerQuery.split(/\s+/).filter(word => word.length > 2);
    let relevanceBoost = 0;
    
    for (const word of queryWords) {
      if (lowerText.includes(word)) {
        relevanceBoost += 0.4;
      }
    }
    
    // Special query-specific boosts
    if (lowerQuery.includes('olive') && lowerText.includes('olive')) {
      relevanceBoost += 0.5;
    }
    if (lowerQuery.includes('dog') && (lowerText.includes('dog') || lowerText.includes('olive') || lowerText.includes('romeo'))) {
      relevanceBoost += 0.4;
    }
    
    score += Math.min(relevanceBoost, 1.2);
  }
  
  // Other factors
  if (memoryType === 'bio' || memoryType === 'place_lived') {
    score += 0.2;
  }
  
  if (memoryType === 'user' || memoryType === 'assistant') {
    score -= 0.3;
  }
  
  if (text.length < 20) {
    score -= 0.2;
  } else if (text.length > 200) {
    score -= 0.1;
  }
  
  return Math.max(0, Math.min(1.5, score));
}

async function debugOliveHookSelection() {
  const DEMO_AVATAR_ID = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
  const query = 'Tell me about Olive';

  console.log('=== DEBUGGING OLIVE HOOK SELECTION ===');
  console.log('Query:', query);
  console.log('');

  // Simulate the memory retrieval process from the chat API
  let allMemories = [];

  // 1. Try semantic search first
  console.log('1. Testing semantic search:');
  try {
    const { data: semanticResults, error } = await supabase.rpc('get_enhanced_memories', {
      target_user_id: null,
      target_avatar_id: DEMO_AVATAR_ID,
      search_query: query,
      match_count: 10,
      similarity_threshold: 0.1
    });

    if (!error && semanticResults) {
      allMemories = [...semanticResults];
      console.log(`Semantic search found ${semanticResults.length} results`);
    }
  } catch (e) {
    console.error('Semantic search failed:', e);
  }

  // 2. Keyword search
  console.log('\\n2. Testing keyword search:');
  const words = query.toLowerCase()
    .replace(/[^\\w\\s]/g, ' ')
    .split(/\\s+/)
    .filter(word => word.length > 2 && !['what', 'when', 'where', 'how', 'why', 'did', 'you', 'your', 'the', 'and', 'but', 'for', 'are', 'with', 'this', 'that', 'they', 'have', 'from', 'been', 'were', 'said', 'each', 'which', 'their', 'time', 'will', 'about', 'would', 'there', 'could', 'other', 'after', 'first', 'well', 'many', 'some', 'these', 'may', 'then', 'them', 'people', 'into', 'very', 'know', 'just', 'like', 'over', 'think', 'also', 'back', 'work', 'life', 'only', 'can', 'should', 'any', 'new', 'way', 'look', 'good', 'want', 'through', 'much', 'before', 'right', 'too', 'means', 'old', 'take', 'than', 'high', 'never', 'more', 'used', 'make', 'most', 'over', 'such', 'during', 'here', 'even', 'off', 'used', 'against', 'because', 'does', 'part', 'being', 'now', 'made', 'before', 'here', 'through', 'when', 'where', 'much', 'should', 'well', 'without', 'may', 'use', 'your', 'way', 'about', 'many', 'then', 'them', 'these'].includes(word));

  console.log('Extracted keywords:', words);

  if (words.length > 0) {
    const keywordQuery = words.map(word => `fragment_text.ilike.%${word}%`).join(',');

    const { data: keywordMemories, error } = await supabase
      .from('memory_fragments')
      .select('*')
      .eq('avatar_id', DEMO_AVATAR_ID)
      .or(keywordQuery)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && keywordMemories) {
      const existingIds = new Set(allMemories.map(m => m.id));
      const newMemories = keywordMemories.filter(m => !existingIds.has(m.id));
      allMemories = [...allMemories, ...newMemories];
      console.log(`Keyword search found ${keywordMemories.length} results, ${newMemories.length} new`);
    }
  }

  console.log(`\\nTotal memories found: ${allMemories.length}`);

  // 3. Sort memories using the same logic as the chat API
  console.log('\\n3. Sorting memories:');
  const sortedMemories = allMemories.sort((a, b) => {
    const aContext = a.conversation_context || {};
    const bContext = b.conversation_context || {};
    const aText = a.fragment_text?.toLowerCase() || '';
    const bText = b.fragment_text?.toLowerCase() || '';

    // Priority scores
    const getPriorityScore = (context, text) => {
      let score = 0;
      
      if (context.type === 'opinion') score += 3.0;
      else if (context.type === 'bio') score += 2.0;
      else if (context.type === 'friend_memory') score += 1.5;
      else if (['memory', 'place_lived'].includes(context.type)) score += 1.0;
      
      const hasEntities = /\\b[A-Z][a-z]+\\b/.test(text) || 
                         /\\b(austin|texas|trump|biden|america|maine|portland|dog|cat|pet)\\b/i.test(text);
      if (!hasEntities) score -= 0.4;
      
      return score;
    };

    const aScore = getPriorityScore(aContext, aText);
    const bScore = getPriorityScore(bContext, bText);

    // Prioritize non-conversation content
    const aIsConversation = ['user', 'assistant'].includes(aContext.type);
    const bIsConversation = ['user', 'assistant'].includes(bContext.type);

    if (!aIsConversation && bIsConversation) return -1;
    if (aIsConversation && !bIsConversation) return 1;

    if (aScore !== bScore) return bScore - aScore;

    // Count keyword matches
    const aMatches = words.filter(word => aText.includes(word)).length;
    const bMatches = words.filter(word => bText.includes(word)).length;

    if (aMatches !== bMatches) return bMatches - aMatches;

    return bText.length - aText.length;
  });

  // Show top 10 sorted memories
  console.log('\\nTop 10 sorted memories:');
  sortedMemories.slice(0, 10).forEach((memory, index) => {
    console.log(`\\n  ${index + 1}. ID: ${memory.id}`);
    console.log(`     Type: ${memory.conversation_context?.type || 'unknown'}`);
    console.log(`     Text: ${memory.fragment_text?.substring(0, 150)}...`);
  });

  // 4. Analyze memories for hook potential
  console.log('\\n4. Analyzing memories for hook potential:');
  const pinnedMemories = sortedMemories.slice(0, 9); // Take top 9 like the API
  const analyses = lightAnalyze(pinnedMemories, query);

  console.log('\\nMemory analyses (sorted by hook potential):');
  const sortedAnalyses = analyses.sort((a, b) => b.hookPotential - a.hookPotential);
  
  sortedAnalyses.forEach((analysis, index) => {
    console.log(`\\n  ${index + 1}. Hook Potential: ${analysis.hookPotential.toFixed(3)}`);
    console.log(`     Memory Type: ${analysis.memoryType}`);
    console.log(`     Text: ${analysis.fragmentText}...`);
  });

  // 5. Show which memory would be selected
  console.log('\\n5. Selected memory for fast hook:');
  const bestAnalysis = sortedAnalyses[0];
  if (bestAnalysis) {
    console.log(`Selected memory with hook potential: ${bestAnalysis.hookPotential.toFixed(3)}`);
    console.log(`Memory type: ${bestAnalysis.memoryType}`);
    console.log(`Text: ${bestAnalysis.fragmentText}...`);
  }

  console.log('\\n=== DEBUG COMPLETE ===');
}

debugOliveHookSelection().catch(console.error);