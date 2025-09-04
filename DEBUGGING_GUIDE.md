# Jonathan-Demo Expression Debugging Guide

## Step 1: Open Browser Console
1. Go to jonathan-demo page
2. Press F12 to open Developer Tools
3. Go to Console tab

## Step 2: Check Feature Flag
```javascript
// Check if feature flag is enabled
console.log('NEXT_PUBLIC_EXPRESSION_OVERLAYS_ENABLED:', process.env.NEXT_PUBLIC_EXPRESSION_OVERLAYS_ENABLED);
```

## Step 3: Check Expression System State
```javascript
// Check if expression pack is loaded
if (typeof expressionPackRef !== 'undefined' && expressionPackRef.current) {
  console.log('✅ Expression pack loaded:', expressionPackRef.current);
  console.log('- Expressions:', expressionPackRef.current.expressions.length);
  console.log('- Buffers:', expressionPackRef.current.buffers.size);
} else {
  console.log('❌ No expression pack found');
}

// Check streaming manager
if (typeof streamingManagerRef !== 'undefined' && streamingManagerRef.current) {
  console.log('✅ Streaming manager exists');
} else {
  console.log('❌ No streaming manager found');
}
```

## Step 4: Test Direct Expression Trigger
```javascript
// Test with simple text that should definitely trigger
if (streamingManagerRef.current) {
  console.log('🎭 Testing direct trigger...');
  streamingManagerRef.current.addSentence("funny");
} else {
  console.log('❌ No streaming manager available');
}
```

## Step 5: Test Your Uploaded Audio Files
```javascript
// Test your actual uploaded expressions directly
const testAudio = new Audio('https://xiftnqnwyjixwqgxqfez.supabase.co/storage/v1/object/public/expressions/avatars/jonathan-demo/jonathan_Laugh_copy_1755508777740.mp3');
testAudio.volume = 0.7;
testAudio.play().then(() => {
  console.log('✅ Your uploaded laugh works!');
}).catch(error => {
  console.error('❌ Your uploaded laugh failed:', error);
});
```

## Step 6: Check Console Logs
Look for these specific log patterns:

### ✅ Good Signs:
```
🎭 Loading REAL expression pack for jonathan-demo...
🎭 ✅ Found 3 uploaded expressions for jonathan-demo
🎭 playExpressionsForText called with: "funny"
🎭 Laugh match: true
[overlay: laugh triggered] 2024-XX-XXTXX:XX:XX.XXXZ
🎭 playExpression called with type: "laugh"
```

### ❌ Bad Signs:
```
🎭 ❌ Early return - isEnabled: false, audioContext: false
🎭 Expression overlays disabled by feature flag
🎭 No buffer found by type
❌ All playback methods failed for expression laugh
```

## Step 7: Manual Test Buttons
Use the test buttons on the page:
- 🎭 Test Expressions
- 🎵 Test YOUR Expressions  
- 🔍 Debug Expressions
- 🎭 Test Direct

## Step 8: Check Network Tab
1. Go to Network tab in Developer Tools
2. Try to trigger an expression
3. Look for requests to your Supabase URLs
4. Check if any requests are failing (red status)

## Common Issues & Solutions

### Issue: Feature flag disabled
**Solution**: Restart your development server after adding `NEXT_PUBLIC_EXPRESSION_OVERLAYS_ENABLED=true`

### Issue: No expression pack loaded
**Solution**: Check if the API call to `/api/expressions` is working

### Issue: Audio files not loading
**Solution**: Check if your Supabase URLs are accessible

### Issue: Expressions not triggering
**Solution**: Check if the trigger words match your expression types

## Quick Fix Test
If nothing else works, try this simple test:
```javascript
// Create a simple expression player manually
const testPlayer = new (await import('/lib/simpleExpressionPlayer.js')).SimpleExpressionPlayer();
await testPlayer.loadExpressions([{
  id: 'test-laugh',
  type: 'laugh', 
  keywords: ['funny'],
  audioUrl: '/snippets/laugh_short.mp3'
}]);
await testPlayer.playExpressionsForText('funny');
```