/**
 * Test Intent Detection and Configuration
 */

const { detectIntent, requiresImmediateDeep, getPinnedCount } = require('./src/config/personalization.ts');

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
} else {
  console.log('⚠️  Some intent detection tests failed.');
}