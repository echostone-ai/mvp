/**
 * Personalization Configuration
 * Centralized config for deep lane scheduling, memory injection, and intent handling
 */

export const MergeConfig = {
  mergeWindowMs: 3000,        // increased to 3000ms to ensure complete factbook responses
  minDeepBudgetMs: 400,       // was ~650; reduced for faster startup
  safetyMs: 120,              // buffer to avoid negative budgets
  fastMaxTokens: 80           // was ~60; give fast lane a touch more room
};

export const PinnedByIntent: Record<string, number> = {
  people: 3,        // Friend/family/relationship queries
  opinion: 3,
  bio: 3,
  timeline: 3,
  preferences: 2,
  pets: 3,
  languages: 3,
  travel: 3
};

export const Boosts = {
  contextTypeOpinion: 0.4,
  hasPolitics: 0.2,
  entityMatch: 0.3,
  relationshipMatch: 0.5,  // Boost for friend/family mentions
  friendMention: 0.4       // Boost for specific friend names
};

// Intent detection patterns
export const IntentPatterns = {
  // Order matters - more specific patterns first
  pets: /\b(dog|dogs|pet|pets|cat|cats|animal|animals|romeo|bucky|george|olive|poodle)\b/i,
  people: /\b(tyler|friend|friends|family|mom|dad|mother|father|brother|sister|girlfriend|boyfriend|partner|spouse|wife|husband|where does|how is|tell me about [A-Z][a-z]+|austin|what did you do|geoff|krissy|tia|eric|it's your|i'm your|it's me|boris)\b/i,
  opinion: /\b(think|opinion|feel|believe|view|trump|biden|political|politics|america|emigration|immigration)\b/i,
  languages: /\b(language|languages|speak|speaking|fluent|bilingual|multilingual|spanish|english|french)\b/i,
  travel: /\b(travel|traveled|trip|trips|visit|visited|country|countries|place|places|lived|live|living|moved|move|how long.*in|time in|years in|duration|how long were you|when did you|what years|which years|from when|until when|how long|when did you)\b/i,
  preferences: /\b(favorite|prefer|like|love|hate|dislike|best|worst|enjoy)\b/i,
  timeline: /\b(when|timeline|history|chronology|sequence|order|first|then|after|before|how long|when did you|what years|which years|from when|until when|how long were you|until when)\b/i,
  bio: /\b(bio|biography|background|story|life|personal|tell me about|who are you|about yourself)\b/i
};

/**
 * Detect intent from query text
 */
export function detectIntent(query: string): string | null {
  const queryLower = query.toLowerCase();
  
  for (const [intent, pattern] of Object.entries(IntentPatterns)) {
    if (pattern.test(queryLower)) {
      return intent;
    }
  }
  
  return null;
}

/**
 * Check if intent requires immediate deep lane start
 */
export function requiresImmediateDeep(intent: string | null): boolean {
  if (!intent) return false;
  return Object.keys(PinnedByIntent).includes(intent);
}

/**
 * Get pinned memory count for intent
 */
export function getPinnedCount(intent: string | null): number {
  if (!intent) return 0;
  return PinnedByIntent[intent] || 0;
}