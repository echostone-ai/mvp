// Simple laugh test - paste this in browser console on jonathan-demo
console.log('🎭 SIMPLE LAUGH TEST');

// Override the playExpressionsForText method to be super simple
if (typeof streamingManagerRef !== 'undefined' && streamingManagerRef.current) {
  console.log('✅ Found streaming manager, adding simple laugh test...');
  
  // Get the audio queue instance
  const audioQueue = streamingManagerRef.current;
  
  // Create a simple test function
  window.testSimpleLaugh = function() {
    console.log('🎭 Testing simple laugh...');
    
    // Play your actual uploaded laugh directly
    const audio = new Audio('https://xiftnqnwyjixwqgxqfez.supabase.co/storage/v1/object/public/expressions/avatars/jonathan-demo/jonathan_Laugh_copy_1755508777740.mp3');
    audio.volume = 0.7;
    audio.play().then(() => {
      console.log('✅ Simple laugh test successful!');
    }).catch(error => {
      console.error('❌ Simple laugh test failed:', error);
    });
  };
  
  // Test it immediately
  window.testSimpleLaugh();
  
  console.log('✅ Simple laugh test function created. Call testSimpleLaugh() to test again.');
  
} else {
  console.log('❌ No streaming manager found');
}

// Also test the fallback laugh
setTimeout(() => {
  console.log('🎭 Testing fallback laugh...');
  const fallbackAudio = new Audio('/snippets/laugh_short.mp3');
  fallbackAudio.volume = 0.7;
  fallbackAudio.play().then(() => {
    console.log('✅ Fallback laugh works!');
  }).catch(error => {
    console.error('❌ Fallback laugh failed:', error);
  });
}, 2000);