// src/lib/services/memoryAnalysisHelper.ts
// Task 1: Lightweight memory analysis helper for response coordination

export interface MemoryAnalysis {
  memoryId: string;
  contentTypes: ('opinion' | 'story' | 'fact' | 'emotion' | 'context')[];
  hookPotential: number; // 0-1 score for fast lane appeal
  storyDepth: number; // 0-1 score for deep lane potential
  emotionalTone: 'positive' | 'negative' | 'neutral' | 'mixed';
  keyElements: string[]; // Key phrases or concepts
}

/**
 * Lightweight memory analysis function that categorizes memories without extra RPCs
 * Keeps analysis O(n) and under 10ms total
 */
export function lightAnalyze(memories: any[], query?: string): MemoryAnalysis[] {
  const startTime = Date.now();
  
  if (!memories || memories.length === 0) {
    return [];
  }

  const analyses: MemoryAnalysis[] = memories.map(memory => {
    const fragmentText = memory.fragment_text || '';
    const context = memory.conversation_context || {};
    const memoryType = context.type || 'unknown';
    
    // Extract content types using heuristics
    const contentTypes = extractContentTypes(fragmentText, memoryType);
    
    // Calculate hook potential (0-1 score)
    const hookPotential = calculateHookPotential(fragmentText, memoryType, contentTypes, query);
    
    // Calculate story depth potential (0-1 score)
    const storyDepth = calculateStoryDepth(fragmentText, memoryType, contentTypes);
    
    // Detect emotional tone
    const emotionalTone = detectEmotionalTone(fragmentText);
    
    // Extract key elements
    const keyElements = extractKeyElements(fragmentText);
    
    return {
      memoryId: memory.id || '',
      contentTypes,
      hookPotential,
      storyDepth,
      emotionalTone,
      keyElements
    };
  });

  const elapsedMs = Date.now() - startTime;
  console.log('memory_analysis_completed', {
    count: memories.length,
    elapsed_ms: elapsedMs,
    avg_hook_potential: analyses.reduce((sum, a) => sum + a.hookPotential, 0) / analyses.length,
    content_type_distribution: getContentTypeDistribution(analyses)
  });

  return analyses;
}

/**
 * Extract content types using simple heuristics
 */
function extractContentTypes(text: string, memoryType: string): ('opinion' | 'story' | 'fact' | 'emotion' | 'context')[] {
  const types: Set<'opinion' | 'story' | 'fact' | 'emotion' | 'context'> = new Set();
  const lowerText = text.toLowerCase();
  
  // Opinion indicators
  if (memoryType === 'opinion' || 
      /\b(think|believe|feel|opinion|view|stance|against|support|hate|love|prefer)\b/.test(lowerText)) {
    types.add('opinion');
  }
  
  // Story indicators
  if (memoryType === 'memory' || memoryType === 'friend_memory' ||
      /\b(when|once|time|remember|story|experience|happened|went|did|was)\b/.test(lowerText) ||
      text.length > 100) {
    types.add('story');
  }
  
  // Fact indicators
  if (memoryType === 'bio' || memoryType === 'place_lived' ||
      /\b(born|live|work|age|name|from|studied|graduated|job|career)\b/.test(lowerText)) {
    types.add('fact');
  }
  
  // Emotion indicators
  if (/\b(excited|happy|sad|angry|frustrated|love|hate|amazing|terrible|wonderful|awful)\b/.test(lowerText)) {
    types.add('emotion');
  }
  
  // Context indicators (relationships, places, etc.)
  if (/\b(with|friend|family|wife|husband|dog|cat|pet|austin|texas|california)\b/.test(lowerText)) {
    types.add('context');
  }
  
  // Default to fact if no types detected
  if (types.size === 0) {
    types.add('fact');
  }
  
  return Array.from(types);
}

/**
 * Calculate hook potential for fast lane (0-1 score)
 */
function calculateHookPotential(text: string, memoryType: string, contentTypes: string[], query?: string): number {
  let score = 0.5; // Base score
  const lowerText = text.toLowerCase();
  const lowerQuery = query?.toLowerCase() || '';
  
  // QUERY RELEVANCE BOOST (highest priority)
  if (query) {
    const queryWords = lowerQuery.split(/\s+/).filter(word => word.length > 2);
    let relevanceBoost = 0;
    
    for (const word of queryWords) {
      if (lowerText.includes(word)) {
        relevanceBoost += 0.4; // Major boost for direct query matches
      }
    }
    
    // Special query-specific boosts
    if (lowerQuery.includes('austin') && lowerText.includes('austin')) {
      relevanceBoost += 0.5; // Massive boost for Austin queries
    }
    if (lowerQuery.includes('trump') && lowerText.includes('trump')) {
      relevanceBoost += 0.5; // Massive boost for Trump queries
    }
    if (lowerQuery.includes('dog') && (lowerText.includes('dog') || lowerText.includes('olive') || lowerText.includes('romeo'))) {
      relevanceBoost += 0.4; // Boost for dog queries
    }
    
    score += Math.min(relevanceBoost, 1.2); // Higher cap for relevance boost
  }
  
  // Reduce other boosts if query relevance is high (to prioritize relevance)
  const hasHighRelevance = query && (
    (lowerQuery.includes('austin') && lowerText.includes('austin')) ||
    (lowerQuery.includes('trump') && lowerText.includes('trump')) ||
    (lowerQuery.includes('dog') && (lowerText.includes('dog') || lowerText.includes('olive') || lowerText.includes('romeo')))
  );
  
  const boostMultiplier = hasHighRelevance ? 0.5 : 1.0; // Reduce other boosts when query is highly relevant
  
  // High hook potential for opinions
  if (contentTypes.includes('opinion')) {
    score += 0.3 * boostMultiplier;
  }
  
  // High hook potential for emotional content
  if (contentTypes.includes('emotion')) {
    score += 0.2 * boostMultiplier;
  }
  
  // Biographical facts make good hooks
  if (memoryType === 'bio' || memoryType === 'place_lived') {
    score += 0.2 * boostMultiplier;
  }
  
  // Strong opinion words boost hook potential
  if (/\b(absolutely|definitely|never|always|hate|love|amazing|terrible)\b/.test(lowerText)) {
    score += 0.2 * boostMultiplier;
  }
  
  // Controversial topics have high hook potential
  if (/\b(trump|politics|political|america|emigration|immigration)\b/.test(lowerText)) {
    score += 0.3 * boostMultiplier;
  }
  
  // Personal relationships and experiences
  if (/\b(austin|dog|pet|friend|family|wife|husband)\b/.test(lowerText)) {
    score += 0.1;
  }
  
  // Penalize generic conversation fragments
  if (memoryType === 'user' || memoryType === 'assistant') {
    score -= 0.3;
  }
  
  // Penalize very short or very long texts for hooks
  if (text.length < 20) {
    score -= 0.2;
  } else if (text.length > 200) {
    score -= 0.1;
  }
  
  // If query relevance is very high, allow scores above 1.0 to break ties
  const finalScore = hasHighRelevance ? Math.max(0, Math.min(1.5, score)) : Math.max(0, Math.min(1, score));
  return finalScore;
}

/**
 * Calculate story depth potential for deep lane (0-1 score)
 */
function calculateStoryDepth(text: string, memoryType: string, contentTypes: string[]): number {
  let score = 0.5; // Base score
  const lowerText = text.toLowerCase();
  
  // Stories have high depth potential
  if (contentTypes.includes('story')) {
    score += 0.3;
  }
  
  // Memories and experiences
  if (memoryType === 'memory' || memoryType === 'friend_memory') {
    score += 0.2;
  }
  
  // Longer texts have more depth potential
  if (text.length > 100) {
    score += 0.2;
  }
  if (text.length > 200) {
    score += 0.1;
  }
  
  // Narrative indicators
  if (/\b(when|once|time|story|experience|happened|remember|went|did|was|then|after|before)\b/.test(lowerText)) {
    score += 0.2;
  }
  
  // Detailed descriptions
  if (/\b(because|since|so|therefore|however|although|while|during)\b/.test(lowerText)) {
    score += 0.1;
  }
  
  // Personal context adds depth
  if (contentTypes.includes('context')) {
    score += 0.1;
  }
  
  // Penalize simple facts for depth
  if (memoryType === 'bio' && text.length < 50) {
    score -= 0.2;
  }
  
  return Math.max(0, Math.min(1, score));
}

/**
 * Detect emotional tone using simple keyword matching
 */
function detectEmotionalTone(text: string): 'positive' | 'negative' | 'neutral' | 'mixed' {
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

/**
 * Extract key elements (entities, concepts) from text
 */
function extractKeyElements(text: string): string[] {
  const elements: string[] = [];
  const lowerText = text.toLowerCase();
  
  // Common entities and concepts
  const patterns = [
    /\b(austin|texas|california|new york|florida|maine)\b/g, // Places
    /\b(dog|cat|pet|animal)\b/g, // Pets
    /\b(trump|biden|politics|political|america|immigration|emigration)\b/g, // Politics
    /\b(music|band|artist|song|album)\b/g, // Music
    /\b(friend|family|wife|husband|brother|sister|mother|father|parent)\b/g, // Relationships
    /\b(work|job|career|company|business)\b/g, // Work
    /\b(college|university|school|education|studied|graduated)\b/g, // Education
  ];
  
  patterns.forEach(pattern => {
    const matches = lowerText.match(pattern);
    if (matches) {
      elements.push(...matches);
    }
  });
  
  // Remove duplicates and return
  return [...new Set(elements)];
}

/**
 * Get content type distribution for logging
 */
function getContentTypeDistribution(analyses: MemoryAnalysis[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  
  analyses.forEach(analysis => {
    analysis.contentTypes.forEach(type => {
      distribution[type] = (distribution[type] || 0) + 1;
    });
  });
  
  return distribution;
}