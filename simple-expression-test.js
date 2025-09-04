// Simple test to verify expression system
// Run this in browser console on jonathan-demo page

console.log('🎭 SIMPLE EXPRESSION TEST');

// Test 1: Check if we can access the streaming manager
if (typeof streamingManagerRef !== 'undefined' && streamingManagerRef.current) {
  console.log('✅ Streaming manager found');
  
  // Test 2: Try to trigger expressions with simple text
  console.log('🎭 Testing with simple "funny" text...');
  streamingManagerRef.current.addSentence("funny").then(() => {
    console.log('✅ addSentence completed');
  }).catch(error => {
    console.error('❌ addSentence failed:', error);
  });
  
  // Wait a bit, then test with more text
  setTimeout(() => {
    console.log('🎭 Testing with "That is so funny"...');
    streamingManagerRef.current.addSentence("That is so funny");
  }, 3000);
  
  setTimeout(() => {
    console.log('🎭 Testing with "haha that is hilarious"...');
    streamingManagerRef.current.addSentence("haha that is hilarious");
  }, 6000);
  
} else {
  console.log('❌ No streaming manager found');
  console.log('Available refs:', Object.keys(window).filter(key => key.includes('Ref')));
}

// Test 3: Check if expressions are loaded
setTimeout(() => {
  console.log('🎭 Checking expression pack...');
  if (typeof expressionPackRef !== 'undefined' && expressionPackRef.current) {
    console.log('✅ Expression pack found:', expressionPackRef.current);
  } else {
    console.log('❌ No expression pack found');
  }
}, 1000);