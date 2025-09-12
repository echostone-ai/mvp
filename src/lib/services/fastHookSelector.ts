// src/lib/services/fastHookSelector.ts
// Task 2: Fast lane hook selector for response coordination

import { MemoryAnalysis } from './memoryAnalysisHelper';

export interface FastHookSelection {
  selectedContent: string;
  contentType: 'hook' | 'teaser' | 'opinion' | 'enthusiasm';
  deepLaneHints: {
    expandOn: string[]; // Memory IDs to expand on
    avoidRepeating: string[]; // Phrases not to repeat
    suggestedTone: string; // Tone to maintain
    relatedMemories: string[]; // Other memories to weave in
  };
}

/**
 * Select the best 1-2 sentence hook from analyzed memories
 * Caps hook text to ~180 characters for quick delivery
 * Generates explicit handoff hints for deep lane coordination
 */
export function selectFastHook(
  memories: any[],
  analyses: MemoryAnalysis[],
  query: string,
  intent?: string
): FastHookSelection {
  // Handle empty memories case
  if (!memories || memories.length === 0 || !analyses || analyses.length === 0) {
    return createFallbackHook(query, intent);
  }

  // Sort analyses by hook potential
  const sortedAnalyses = [...analyses].sort((a, b) => b.hookPotential - a.hookPotential);
  
  // Find the best hook candidate
  const bestAnalysis = sortedAnalyses[0];
  const bestMemory = memories.find(m => m.id === bestAnalysis.memoryId);
  
  if (!bestMemory) {
    return createFallbackHook(query, intent);
  }

  // Generate hook content based on memory type and analysis
  const hookResult = generateHookContent(bestMemory, bestAnalysis, query, intent);
  
  // Generate deep lane hints
  const deepLaneHints = generateDeepLaneHints(
    bestMemory,
    bestAnalysis,
    memories,
    analyses,
    hookResult.selectedContent
  );

  return {
    selectedContent: hookResult.selectedContent,
    contentType: hookResult.contentType,
    deepLaneHints
  };
}

/**
 * Generate hook content from the best memory
 */
function generateHookContent(
  memory: any,
  analysis: MemoryAnalysis,
  query: string,
  intent?: string
): { selectedContent: string; contentType: 'hook' | 'teaser' | 'opinion' | 'enthusiasm' } {
  const fragmentText = memory.fragment_text || '';
  const context = memory.conversation_context || {};
  const memoryType = context.type || 'unknown';
  
  // Clean up common prefixes
  const cleanText = fragmentText.replace(/^(Opinion on politics: |About \w+: |With \w+: |Place lived: |Lived in |Pet: )/i, '');
  
  // Special handling for Austin memories (high enthusiasm)
  if (fragmentText.toLowerCase().includes('austin') && fragmentText.match(/(2009|2018|\d{4}[-–]\d{4})/)) {
    return {
      selectedContent: "Oh absolutely! Austin was such an incredible chapter of my life!",
      contentType: 'enthusiasm'
    };
  }
  
  // Opinion-based hooks (strong stance)
  if (analysis.contentTypes.includes('opinion') && analysis.hookPotential > 0.7) {
    const opinionHook = extractOpinionHook(cleanText);
    if (opinionHook) {
      return {
        selectedContent: opinionHook,
        contentType: 'opinion'
      };
    }
  }
  
  // Story-based teasers (engaging preview)
  if (analysis.contentTypes.includes('story') && analysis.storyDepth > 0.6) {
    const storyTeaser = extractStoryTeaser(cleanText);
    if (storyTeaser) {
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
      return {
        selectedContent: bioHook,
        contentType: 'hook'
      };
    }
  }
  
  // Default: create engaging hook from best content
  const defaultHook = createDefaultHook(cleanText, analysis.emotionalTone);
  return {
    selectedContent: defaultHook,
    contentType: 'hook'
  };
}

/**
 * Extract opinion-based hook (strong stance)
 */
function extractOpinionHook(text: string): string | null {
  const lowerText = text.toLowerCase();
  
  // Look for strong opinion indicators
  const strongOpinions = [
    /i (absolutely|definitely|really|totally) (hate|love|think|believe)/i,
    /i (never|always) (want|think|believe)/i,
    /(trump|politics|political).{0,50}(terrible|amazing|awful|great)/i
  ];
  
  for (const pattern of strongOpinions) {
    const match = text.match(pattern);
    if (match) {
      // Extract sentence containing the opinion
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

/**
 * Extract story teaser (engaging preview)
 */
function extractStoryTeaser(text: string): string | null {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  if (sentences.length === 0) return null;
  
  // Look for engaging opening sentences
  const firstSentence = sentences[0].trim();
  
  // If first sentence is engaging and under 180 chars, use it
  if (firstSentence.length <= 180 && isEngagingOpener(firstSentence)) {
    return firstSentence + (firstSentence.endsWith('.') ? '' : '.');
  }
  
  // Otherwise, create a teaser from the beginning
  if (text.length <= 180) {
    return text.trim();
  } else {
    return text.substring(0, 177).trim() + '...';
  }
}

/**
 * Check if a sentence is an engaging opener
 */
function isEngagingOpener(sentence: string): boolean {
  const lowerSentence = sentence.toLowerCase();
  
  const engagingPatterns = [
    /^(when|once|during|after|before)/,
    /\b(amazing|incredible|wonderful|terrible|awful|fantastic)/,
    /\b(love|hate|excited|thrilled|disappointed)/,
    /^(oh|wow|absolutely|definitely)/
  ];
  
  return engagingPatterns.some(pattern => pattern.test(lowerSentence));
}

/**
 * Extract biographical hook
 */
function extractBioHook(text: string, keyElements: string[]): string | null {
  // For bio facts, create an engaging introduction
  const lowerText = text.toLowerCase();
  
  // Location-based hooks
  if (keyElements.some(el => ['california', 'texas', 'austin', 'maine'].includes(el))) {
    const location = keyElements.find(el => ['california', 'texas', 'austin', 'maine'].includes(el));
    if (lowerText.includes('born') || lowerText.includes('from')) {
      return `I'm originally from ${location}!`;
    } else if (lowerText.includes('lived') || lowerText.includes('live')) {
      return `I lived in ${location} for a while.`;
    }
  }
  
  // Default bio hook
  if (text.length <= 180) {
    return text.trim();
  } else {
    return text.substring(0, 177).trim() + '...';
  }
}

/**
 * Create default hook from content
 */
function createDefaultHook(text: string, emotionalTone: string): string {
  // Adjust tone based on emotional analysis
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
  
  // Cap at 180 characters including prefix
  const maxContentLength = 180 - prefix.length;
  
  if (text.length <= maxContentLength) {
    return prefix + text.trim();
  } else {
    return prefix + text.substring(0, maxContentLength - 3).trim() + '...';
  }
}

/**
 * Generate deep lane coordination hints
 */
function generateDeepLaneHints(
  selectedMemory: any,
  selectedAnalysis: MemoryAnalysis,
  allMemories: any[],
  allAnalyses: MemoryAnalysis[],
  hookContent: string
): FastHookSelection['deepLaneHints'] {
  const expandOn: string[] = [selectedMemory.id];
  const avoidRepeating: string[] = [];
  const relatedMemories: string[] = [];
  
  // Extract key phrases to avoid repeating
  const hookWords = extractKeyPhrases(hookContent);
  avoidRepeating.push(...hookWords);
  
  // Find related memories with high story depth
  const relatedAnalyses = allAnalyses
    .filter(a => a.memoryId !== selectedMemory.id && a.storyDepth > 0.5)
    .sort((a, b) => b.storyDepth - a.storyDepth)
    .slice(0, 3);
  
  relatedMemories.push(...relatedAnalyses.map(a => a.memoryId));
  
  // Determine suggested tone based on selected content
  let suggestedTone = 'conversational';
  
  if (selectedAnalysis.emotionalTone === 'positive') {
    suggestedTone = 'enthusiastic';
  } else if (selectedAnalysis.emotionalTone === 'negative') {
    suggestedTone = 'critical';
  } else if (selectedAnalysis.contentTypes.includes('opinion')) {
    suggestedTone = 'assertive';
  } else if (selectedAnalysis.contentTypes.includes('story')) {
    suggestedTone = 'narrative';
  }
  
  return {
    expandOn,
    avoidRepeating,
    suggestedTone,
    relatedMemories
  };
}

/**
 * Extract key phrases from hook content to avoid repetition
 */
function extractKeyPhrases(text: string): string[] {
  const phrases: string[] = [];
  
  // Extract 2-3 word phrases
  const words = text.toLowerCase().split(/\s+/);
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i].length > 2 && words[i + 1].length > 2) {
      phrases.push(`${words[i]} ${words[i + 1]}`);
    }
  }
  
  // Extract distinctive words
  const distinctiveWords = words.filter(word => 
    word.length > 4 && 
    !['that', 'this', 'with', 'from', 'they', 'were', 'have', 'been'].includes(word)
  );
  
  phrases.push(...distinctiveWords);
  
  return phrases.slice(0, 5); // Limit to 5 key phrases
}

/**
 * Create fallback hook when no memories are available
 */
function createFallbackHook(query: string, intent?: string): FastHookSelection {
  let fallbackContent = '';
  
  // Intent-specific fallbacks
  if (['travel', 'timeline', 'people'].includes(intent || '')) {
    fallbackContent = "Let me check my memories about that...";
  } else {
    fallbackContent = "I'm thinking about that...";
  }
  
  return {
    selectedContent: fallbackContent,
    contentType: 'hook',
    deepLaneHints: {
      expandOn: [],
      avoidRepeating: [],
      suggestedTone: 'conversational',
      relatedMemories: []
    }
  };
}