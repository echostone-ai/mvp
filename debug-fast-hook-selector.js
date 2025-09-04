// Debug script to test the exact fast hook selector logic
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Simplified versions of the analysis functions
function lightAnalyze(memories, query) {
  return memories.map(memory => {
    const fragmentText = memory.fragment_text || '';
    const context = memory.conversation_context || {};
    const memoryType = context.type || 'unknown';
    
    const contentTypes = extractContentTypes(fragmentText, memoryType);
    const hookPotential = calculateHookPotential(fragmentText, memoryType, contentTypes, query);
    const storyDepth = calculateStoryDepth(fragmentText, memoryType, contentTypes);
    const emotionalTone = detectEmotionalTone(fragmentText);
    const keyElements = extractKeyElements(fragmentText);
    
    return {
      memoryId: memory.id,
      contentTypes,
      hookPotential,
      storyDepth,
      emotionalTone,
      keyElements
    };
  });
}

function extractContentTypes(text, memoryType) {
  const types = new Set();
  const lowerText = text.toLowerCase();
  
  if (memoryType === 'opinion' || 
      /\\b(think|believe|feel|opinion|view|stance|against|support|hate|love|prefer)\\b/.test(lowerText)) {
    types.add('opinion');
  }
  
  if (memoryType === 'memory' || memoryType === 'friend_memory' ||
      /\\b(when|once|time|remember|story|experience|happened|went|did|was)\\b/.test(lowerText) ||
      text.length > 100) {
    types.add('story');
  }
  
  if (memoryType === 'bio' || memoryType === 'place_lived' ||
      /\\b(born|live|work|age|name|from|studied|graduated|job|career)\\b/.test(lowerText)) {
    types.add('fact');
  }
  
  if (/\\b(excited|happy|sad|angry|frustrated|love|hate|amazing|terrible|wonderful|awful)\\b/.test(lowerText)) {
    types.add('emotion');
  }
  
  if (/\\b(with|friend|family|wife|husband|dog|cat|pet|austin|texas|california)\\b/.test(lowerText)) {
    types.add('context');
  }
  
  if (types.size === 0) {
    types.add('fact');
  }
  
  return Array.from(types);
}

function calculateHookPotential(text, memoryType, contentTypes, query) {
  let score = 0.5;
  const lowerText = text.toLowerCase();
  const lowerQuery = query?.toLowerCase() || '';
  
  if (query) {
    const queryWords = lowerQuery.split(/\\s+/).filter(word => word.length > 2);
    let relevanceBoost = 0;
    
    for (const word of queryWords) {
      if (lowerText.includes(word)) {
        relevanceBoost += 0.4;
      }
    }
    
    if (lowerQuery.includes('austin') && lowerText.includes('austin')) {
      relevanceBoost += 0.5;
    }
    if (lowerQuery.includes('trump') && lowerText.includes('trump')) {
      relevanceBoost += 0.5;
    }
    if (lowerQuery.includes('dog') && (lowerText.includes('dog') || lowerText.includes('olive') || lowerText.includes('romeo'))) {
      relevanceBoost += 0.4;
    }
    if (lowerQuery.includes('olive') && lowerText.includes('olive')) {
      relevanceBoost += 0.5;
    }
    
    score += Math.min(relevanceBoost, 1.2);
  }
  
  const hasHighRelevance = query && (
    (lowerQuery.includes('austin') && lowerText.includes('austin')) ||
    (lowerQuery.includes('trump') && lowerText.includes('trump')) ||
    (lowerQuery.includes('dog') && (lowerText.includes('dog') || lowerText.includes('olive') || lowerText.includes('romeo'))) ||
    (lowerQuery.includes('olive') && lowerText.includes('olive'))
  );
  
  const boostMultiplier = hasHighRelevance ? 0.5 : 1.0;
  
  if (contentTypes.includes('opinion')) {
    score += 0.3 * boostMultiplier;
  }
  
  if (contentTypes.includes('emotion')) {
    score += 0.2 * boostMultiplier;
  }
  
  if (memoryType === 'bio' || memoryType === 'place_lived') {
    score += 0.2 * boostMultiplier;
  }
  
  if (/\\b(absolutely|definitely|never|always|hate|love|amazing|terrible)\\b/.test(lowerText)) {
    score += 0.2 * boostMultiplier;
  }
  
  if (/\\b(trump|politics|political|america|emigration|immigration)\\b/.test(lowerText)) {
    score += 0.3 * boostMultiplier;
  }
  
  if (/\\b(austin|dog|pet|friend|family|wife|husband)\\b/.test(lowerText)) {
    score += 0.1;
  }
  
  if (memoryType === 'user' || memoryType === 'assistant') {
    score -= 0.3;
  }
  
  if (text.length < 20) {
    score -= 0.2;
  } else if (text.length > 200) {
    score -= 0.1;
  }
  
  const finalScore = hasHighRelevance ? Math.max(0, Math.min(1.5, score)) : Math.max(0, Math.min(1, score));
  return finalScore;
}

function calculateStoryDepth(text, memoryType, contentTypes) {
  let score = 0.5;
  const lowerText = text.toLowerCase();
  
  if (contentTypes.includes('story')) {
    score += 0.3;
  }
  
  if (memoryType === 'memory' || memoryType === 'friend_memory') {
    score += 0.2;
  }
  
  if (text.length > 100) {
    score += 0.2;
  }
  if (text.length > 200) {
    score += 0.1;
  }
  
  if (/\\b(when|once|time|story|experience|happened|remember|went|did|was|then|after|before)\\b/.test(lowerText)) {
    score += 0.2;
  }
  
  if (/\\b(because|since|so|therefore|however|although|while|during)\\b/.test(lowerText)) {
    score += 0.1;
  }
  
  if (contentTypes.includes('context')) {
    score += 0.1;
  }
  
  if (memoryType === 'bio' && text.length < 50) {
    score -= 0.2;
  }
  
  return Math.max(0, Math.min(1, score));
}

function detectEmotionalTone(text) {
  const lowerText = text.toLowerCase();
  
  const positiveWords = ['love', 'amazing', 'wonderful', 'great', 'excellent', 'fantastic', 'happy', 'excited', 'beautiful', 'perfect'];
  const negativeWords = ['hate', 'terrible', 'awful', 'horrible', 'sad', 'angry', 'frustrated', 'disappointed', 'worst', 'disgusting'];
  
  const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
  
  if (positiveCount > 0 && negativeCount > 0) {
    return 'mixed';
  } else if (positiveCount > 0) {
    return 'positive';
  } else if (negativeCount > 0) {
    return 'negative';
  } else {
    return 'neutral';
  }
}

function extractKeyElements(text) {
  const elements = [];
  const lowerText = text.toLowerCase();
  
  const patterns = [
    /\\b(austin|texas|california|new york|florida|maine)\\b/g,
    /\\b(dog|cat|pet|animal)\\b/g,
    /\\b(trump|biden|politics|political|america|immigration|emigration)\\b/g,
    /\\b(music|band|artist|song|album)\\b/g,
    /\\b(friend|family|wife|husband|brother|sister|mother|father|parent)\\b/g,
    /\\b(work|job|career|company|business)\\b/g,
    /\\b(college|university|school|education|studied|graduated)\\b/g,
  ];
  
  patterns.forEach(pattern => {
    const matches = lowerText.match(pattern);
    if (matches) {
      elements.push(...matches);
    }
  });
  
  return [...new Set(elements)];
}

// Simplified selectFastHook function
function selectFastHook(memories, analyses, query, intent) {
  if (!memories || memories.length === 0 || !analyses || analyses.length === 0) {
    return {
      selectedContent: "I'm thinking about that...",
      contentType: 'hook',
      deepLaneHints: {
        expandOn: [],
        avoidRepeating: [],
        suggestedTone: 'conversational',
        relatedMemories: []
      }
    };
  }

  const sortedAnalyses = [...analyses].sort((a, b) => b.hookPotential - a.hookPotential);
  const bestAnalysis = sortedAnalyses[0];
  const bestMemory = memories.find(m => m.id === bestAnalysis.memoryId);
  
  if (!bestMemory) {
    return {
      selectedContent: "I'm thinking about that...",
      contentType: 'hook',
      deepLaneHints: {
        expandOn: [],
        avoidRepeating: [],
        suggestedTone: 'conversational',
        relatedMemories: []
      }
    };
  }

  const hookResult = generateHookContent(bestMemory, bestAnalysis, query, intent);
  
  return {
    selectedContent: hookResult.selectedContent,
    contentType: hookResult.contentType,
    deepLaneHints: {
      expandOn: [bestMemory.id],
      avoidRepeating: [],
      suggestedTone: 'conversational',
      relatedMemories: []
    }
  };
}

function generateHookContent(memory, analysis, query, intent) {
  const fragmentText = memory.fragment_text || '';
  const context = memory.conversation_context || {};
  const memoryType = context.type || 'unknown';
  
  console.log('\\n=== GENERATING HOOK CONTENT ===');
  console.log('Memory ID:', memory.id);
  console.log('Memory type:', memoryType);
  console.log('Fragment text:', fragmentText);
  console.log('Analysis:', analysis);
  
  const cleanText = fragmentText.replace(/^(Opinion on politics: |About \\w+: |With \\w+: |Place lived: |Lived in |Pet: )/i, '');
  
  // Special handling for Austin memories
  if (fragmentText.toLowerCase().includes('austin') && fragmentText.match(/(2009|2018|\\d{4}[-–]\\d{4})/)) {
    console.log('Using Austin enthusiasm hook');
    return {
      selectedContent: "Oh absolutely! Austin was such an incredible chapter of my life!",
      contentType: 'enthusiasm'
    };
  }
  
  // Opinion-based hooks
  if (analysis.contentTypes.includes('opinion') && analysis.hookPotential > 0.7) {
    const opinionHook = extractOpinionHook(cleanText);
    if (opinionHook) {
      console.log('Using opinion hook:', opinionHook);
      return {
        selectedContent: opinionHook,
        contentType: 'opinion'
      };
    }
  }
  
  // Story-based teasers
  if (analysis.contentTypes.includes('story') && analysis.storyDepth > 0.6) {
    const storyTeaser = extractStoryTeaser(cleanText);
    if (storyTeaser) {
      console.log('Using story teaser:', storyTeaser);
      return {
        selectedContent: storyTeaser,
        contentType: 'teaser'
      };
    }
  }
  
  // Biographical fact hooks
  if (memoryType === 'bio' || memoryType === 'place_lived') {
    const bioHook = extractBioHook(cleanText, analysis.keyElements);
    if (bioHook) {
      console.log('Using bio hook:', bioHook);
      return {
        selectedContent: bioHook,
        contentType: 'hook'
      };
    }
  }
  
  // Default hook
  const defaultHook = createDefaultHook(cleanText, analysis.emotionalTone);
  console.log('Using default hook:', defaultHook);
  return {
    selectedContent: defaultHook,
    contentType: 'hook'
  };
}

function extractOpinionHook(text) {
  const strongOpinions = [
    /i (absolutely|definitely|really|totally) (hate|love|think|believe)/i,
    /i (never|always) (want|think|believe)/i,
    /(trump|politics|political).{0,50}(terrible|amazing|awful|great)/i
  ];
  
  for (const pattern of strongOpinions) {
    const match = text.match(pattern);
    if (match) {
      const sentences = text.split(/[.!?]+/);
      for (const sentence of sentences) {
        if (pattern.test(sentence)) {
          const trimmed = sentence.trim();
          if (trimmed.length <= 180) {
            return trimmed + (trimmed.endsWith('.') ? '' : '.');
          } else {
            return trimmed.substring(0, 177) + '...';
          }
        }
      }
    }
  }
  
  return null;
}

function extractStoryTeaser(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  if (sentences.length === 0) return null;
  
  const firstSentence = sentences[0].trim();
  
  if (firstSentence.length <= 180 && isEngagingOpener(firstSentence)) {
    return firstSentence + (firstSentence.endsWith('.') ? '' : '.');
  }
  
  if (text.length <= 180) {
    return text.trim();
  } else {
    return text.substring(0, 177).trim() + '...';
  }
}

function isEngagingOpener(sentence) {
  const lowerSentence = sentence.toLowerCase();
  
  const engagingPatterns = [
    /^(when|once|during|after|before)/,
    /\\b(amazing|incredible|wonderful|terrible|awful|fantastic)/,
    /\\b(love|hate|excited|thrilled|disappointed)/,
    /^(oh|wow|absolutely|definitely)/
  ];
  
  return engagingPatterns.some(pattern => pattern.test(lowerSentence));
}

function extractBioHook(text, keyElements) {
  const lowerText = text.toLowerCase();
  
  if (keyElements.some(el => ['california', 'texas', 'austin', 'maine'].includes(el))) {
    const location = keyElements.find(el => ['california', 'texas', 'austin', 'maine'].includes(el));
    if (lowerText.includes('born') || lowerText.includes('from')) {
      return `I'm originally from ${location}!`;
    } else if (lowerText.includes('lived') || lowerText.includes('live')) {
      return `I lived in ${location} for a while.`;
    }
  }
  
  if (text.length <= 180) {
    return text.trim();
  } else {
    return text.substring(0, 177).trim() + '...';
  }
}

function createDefaultHook(text, emotionalTone) {
  let prefix = '';
  
  switch (emotionalTone) {
    case 'positive':
      prefix = 'Oh, ';
      break;
    case 'negative':
      prefix = 'Well, ';
      break;
    case 'mixed':
      prefix = 'You know, ';
      break;
    default:
      prefix = '';
  }
  
  const maxContentLength = 180 - prefix.length;
  
  if (text.length <= maxContentLength) {
    return prefix + text.trim();
  } else {
    return prefix + text.substring(0, maxContentLength - 3).trim() + '...';
  }
}

async function debugFastHookSelector() {
  const DEMO_AVATAR_ID = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
  const query = 'Tell me about Olive';

  console.log('=== DEBUGGING FAST HOOK SELECTOR ===');
  console.log('Query:', query);
  console.log('');

  // Get the same memories that would be retrieved
  const { data: semanticResults } = await supabase.rpc('get_enhanced_memories', {
    target_user_id: null,
    target_avatar_id: DEMO_AVATAR_ID,
    search_query: query,
    match_count: 10,
    similarity_threshold: 0.1
  });

  // Sort them the same way as the chat API
  const sortedMemories = semanticResults.sort((a, b) => {
    const aContext = a.conversation_context || {};
    const bContext = b.conversation_context || {};
    const aText = a.fragment_text?.toLowerCase() || '';
    const bText = b.fragment_text?.toLowerCase() || '';

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

    const aIsConversation = ['user', 'assistant'].includes(aContext.type);
    const bIsConversation = ['user', 'assistant'].includes(bContext.type);

    if (!aIsConversation && bIsConversation) return -1;
    if (aIsConversation && !bIsConversation) return 1;

    if (aScore !== bScore) return bScore - aScore;

    const words = query.toLowerCase().split(/\\s+/).filter(word => word.length > 2);
    const aMatches = words.filter(word => aText.includes(word)).length;
    const bMatches = words.filter(word => bText.includes(word)).length;

    if (aMatches !== bMatches) return bMatches - aMatches;

    return bText.length - aText.length;
  });

  const pinnedMemories = sortedMemories.slice(0, 9);
  
  console.log('Pinned memories:');
  pinnedMemories.forEach((memory, index) => {
    console.log(`\\n  ${index + 1}. ID: ${memory.id}`);
    console.log(`     Type: ${memory.conversation_context?.type || 'unknown'}`);
    console.log(`     Text: ${memory.fragment_text.substring(0, 100)}...`);
  });

  // Analyze memories
  console.log('\\n=== ANALYZING MEMORIES ===');
  const analyses = lightAnalyze(pinnedMemories, query);
  
  // Select fast hook
  console.log('\\n=== SELECTING FAST HOOK ===');
  const hookSelection = selectFastHook(pinnedMemories, analyses, query, 'pets');
  
  console.log('\\nFinal hook selection:');
  console.log('Selected content:', hookSelection.selectedContent);
  console.log('Content type:', hookSelection.contentType);

  console.log('\\n=== DEBUG COMPLETE ===');
}

debugFastHookSelector().catch(console.error);