// Test the expression fix - paste in browser console
console.log('🎭 TESTING EXPRESSION FIX');

// Test phrases that should work with your 3 expressions
const testPhrases = [
  { text: "That's so funny!", expected: "laugh" },
  { text: "Wow, that's incredible!", expected: "catchphrase (jeez)" },
  { text: "This is overwhelming", expected: "laugh (sigh)" }
];

console.log('🎭 Your available expressions should be:');
console.log('- laugh (actual laugh)');
console.log('- laugh (actually sigh)'); 
console.log('- catchphrase (jeez)');

console.log('🎭 Testing trigger phrases...');
testPhrases.forEach((test, i) => {
  console.log(`${i + 1}. "${test.text}" should trigger: ${test.expected}`);
});

console.log('🎭 Try saying one of these phrases in chat to test!');