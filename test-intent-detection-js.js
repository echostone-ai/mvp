/**
 * Test Intent Detection and Configuration (Pure JS)
 */

// Intent patterns (copied from personalization.ts) - order matters
const IntentPatterns = {
  pets: /\b(dog|dogs|pet|pets|cat|cats|animal|animals|romeo|bucky|george|olive|poodle)\b/i,
  opinion: /\b(think|opinion|feel|believe|view|trump|biden|political|politics|america|emigration|immigration)\b/i,
  languages: /\b(language|languages|speak|speaking|fluent|bilingual|multilingual|spanish|english|french)\b/i,
  travel: /\b(travel|traveled|trip|trips|visit|visited|country|countries|place|places|lived|live|living|moved|move)\b/i,
  preferences: /\b(favorite|prefer|like|love|hate|dislike|best|worst|enjoy)\b/i,
  timeline: /\b(when|timeline|history|chronology|sequence|order|first|then|after|before)\b/i,
  bio: /\b(bio|biography|background|story|life|personal|tell me about|who are you|about yourself)\b/i
};

const PinnedByIntent = {
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

// Test cases
const testCases = [
  { query: "what do you think of trump?", expectedIntent: "opinion" },
  { query: "tell me about your dogs", expectedIntent: "pets" },
  { query: "what languages do you speak?", expectedIntent: "languages" },
  { query: "where have you lived?", expectedIntent: "travel" },
  { query: "tell me about yourself", expectedIntent: "bio" },
  { query: "hello", expectedIntent: null },
  { query: "how are you?", expectedIntent: null }
];

console.log('🧪 Testing Intent Detection');
console.log('=' .repeat(40));

let passed = 0;
let total = testCases.length;

for (const testCase of testCases) {
  const detected = detectIntent(testCase.query);
  const shouldStartDeep = requiresImmediateDeep(detected);
  const pinnedCount = getPinnedCount(detected);
  
  const success = detected === testCase.expectedIntent;
  
  console.log(`\n📝 "${testCase.query}"`);
  console.log(`   Expected: ${testCase.expectedIntent || 'none'}`);
  console.log(`   Detected: ${detected || 'none'}`);
  console.log(`   Start Deep: ${shouldStartDeep}`);
  console.log(`   Pinned Count: ${pinnedCount}`);
  console.log(`   Result: ${success ? '✅ PASS' : '❌ FAIL'}`);
  
  if (success) passed++;
}

console.log('\n' + '='.repeat(40));
console.log(`📊 Results: ${passed}/${total} tests passed`);

if (passed === total) {
  console.log('🎉 All intent detection tests passed!');
  process.exit(0);
} else {
  console.log('⚠️  Some intent detection tests failed.');
  process.exit(1);
}