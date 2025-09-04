// Debug script for jonathan-demo expression issues
// Copy and paste this into browser console on jonathan-demo page

console.log('🔍 DEBUGGING JONATHAN-DEMO EXPRESSIONS');

// 1. Check feature flag
console.log('1. Feature flag check:');
try {
  // This might not be available in browser, but let's try
  console.log('EXPRESSION_OVERLAYS_ENABLED should be true');
} catch (e) {
  console.log('Feature flag check not available in browser');
}

// 2. Check if expression pack loaded
console.log('2. Expression pack check:');
if (typeof expressionPackRef !== 'undefined' && expressionPackRef.current) {
  console.log('✅ Expression pack exists:', expressionPackRef.current);
  console.log('- Expressions:', expressionPackRef.current.expressions.length);
  console.log('- Buffers:', expressionPackRef.current.buffers.size);
  expressionPackRef.current.expressions.forEach(expr => {
    console.log(`  - ${expr.type}: ${expr.filename} (${expr.cdnUrl})`);
  });
} else {
  console.log('❌ No expression pack found');
}

// 3. Check streaming manager
console.log('3. Streaming manager check:');
if (typeof streamingManagerRef !== 'undefined' && streamingManagerRef.current) {
  console.log('✅ Streaming manager exists');
} else {
  console.log('❌ No streaming manager found');
}

// 4. Test direct expression trigger
console.log('4. Testing direct expression trigger...');
if (typeof testExpressions === 'function') {
  console.log('Calling testExpressions()...');
  testExpressions();
} else {
  console.log('❌ testExpressions function not available');
}

// 5. Test audio files directly
console.log('5. Testing audio files directly...');
if (typeof testAudioFiles === 'function') {
  console.log('Calling testAudioFiles()...');
  testAudioFiles();
} else {
  console.log('❌ testAudioFiles function not available');
}

// 6. Manual expression test
console.log('6. Manual expression test...');
const testAudio = new Audio('https://xiftnqnwyjixwqgxqfez.supabase.co/storage/v1/object/public/expressions/avatars/jonathan-demo/jonathan_Laugh_copy_1755508777740.mp3');
testAudio.volume = 0.7;
testAudio.play().then(() => {
  console.log('✅ Manual audio test successful');
}).catch(error => {
  console.error('❌ Manual audio test failed:', error);
});

console.log('🔍 Debug complete. Check the logs above for issues.');