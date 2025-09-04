/**
 * Debug Deep Lane Issue
 * Test the intent detection and deep lane logic
 */

require('dotenv').config({ path: '.env.local' });

// Test intent detection directly
const IntentPatterns = {
  people: /\b(tyler|friend|friends|family|mom|dad|mother|father|brother|sister|girlfriend|boyfriend|partner|spouse|wife|husband|where does|how is|tell me about [A-Z][a-z]+)\b/i,
  pets: /\b(dog|dogs|pet|pets|cat|cats|animal|animals|romeo|bucky|george|olive|poodle)\b/i,
  opinion: /\b(think|opinion|feel|believe|view|trump|biden|political|politics|america|emigration|immigration)\b/i,
  languages: /\b(language|languages|speak|speaking|fluent|bilingual|multilingual|spanish|english|french)\b/i,
  travel: /\b(travel|traveled|trip|trips|visit|visited|country|countries|place|places|lived|live|living|moved|move)\b/i,
  preferences: /\b(favorite|prefer|like|love|hate|dislike|best|worst|enjoy)\b/i,
  timeline: /\b(when|timeline|history|chronology|sequence|order|first|then|after|before)\b/i,
  bio: /\b(bio|biography|background|story|life|personal|tell me about|who are you|about yourself)\b/i
};

const PinnedByIntent = {
  people: 3,
  opinion: 3,
  bio: 3,
  timeline: 3,
  preferences: 2,
  pets: 3,
  languages: 3,
  travel: 3
};

function detectIntent(query) {
  const queryLower = query.toLowerCase();
  
  for (const [intent, pattern] of Object.entries(IntentPatterns)) {
    if (pattern.test(queryLower)) {
      return intent;
    }
  }
  
  return null;
}

function requiresImmediateDeep(intent) {
  if (!intent) return false;
  return Object.keys(PinnedByIntent).includes(intent);
}

function getPinnedCount(intent) {
  if (!intent) return 0;
  return PinnedByIntent[intent] || 0;
}

// Test the problematic queries
const testQueries = [
  'Where does your friend Tyler live?',
  'Tell me about Olive.',
  'What do you think of Trump?'
];

console.log('🔍 Deep Lane Debug Analysis');
console.log('=' .repeat(50));

testQueries.forEach(query => {
  console.log(`\nQuery: "${query}"`);
  
  const intent = detectIntent(query);
  const shouldStartImmediately = requiresImmediateDeep(intent);
  const pinnedCount = getPinnedCount(intent);
  
  console.log(`  Intent: ${intent || 'none'}`);
  console.log(`  Should start immediately: ${shouldStartImmediately}`);
  console.log(`  Pinned count: ${pinnedCount}`);
  
  // Simulate budget calculation
  const BUDGET_MS = 8000;
  const mergeWindowMs = 900;
  const safetyMs = 120;
  const elapsedMs = 100; // Assume 100ms elapsed
  
  const microBudgetMs = BUDGET_MS - elapsedMs - mergeWindowMs - safetyMs;
  const shouldSkipDeep = !shouldStartImmediately && microBudgetMs < 200;
  
  console.log(`  Micro budget: ${microBudgetMs}ms`);
  console.log(`  Would skip deep: ${shouldSkipDeep}`);
  console.log(`  Expected result: ${shouldSkipDeep ? 'DEEP SKIPPED' : 'DEEP SHOULD START'}`);
});

console.log('\n' + '=' .repeat(50));
console.log('🎯 Analysis Summary:');
console.log('- If "Should start immediately" is true, deep lane should start');
console.log('- If "Would skip deep" is true, deep lane will be skipped');
console.log('- The issue might be in the import/export of these functions');