# Jonathan-Demo Expression Debug & Fix

## Immediate Issues Found

### 1. File Format Problem
Your uploaded expressions are M4A format, but browsers can only decode MP3/WAV in AudioContext.

**Quick Fix**: Convert your M4A files to MP3 format and re-upload them.

### 2. Trigger Keyword Mismatch
The system looks for "funny" keyword, but your expressions might have different trigger words.

**Debug Steps**:
1. Open jonathan-demo in browser
2. Open Developer Console (F12)
3. Type: `debugExpressionSystem()` 
4. Look for logs showing your actual expression types

### 3. Expression Loading Verification
Check if expressions are actually loading:

**In Browser Console**:
```javascript
// Check if expressions loaded
console.log('Expression pack:', expressionPackRef.current)

// Test direct trigger
testExpressions()

// Test your actual audio files
testAudioFiles()
```

## Quick MVP Fix

### Step 1: Convert Files to MP3
- Download your M4A expressions from Supabase
- Convert to MP3 format (use online converter or ffmpeg)
- Re-upload as MP3 files

### Step 2: Verify Trigger Keywords
Update the trigger logic to match your actual expression types:

```typescript
// In simpleExpressionPlayer.ts, update playExpressionsForText:
if (normalizedText.includes('funny') || normalizedText.includes('hilarious') || normalizedText.includes('laugh')) {
  this.lastOverlayTime = now;
  const timestamp = new Date().toISOString();
  console.log(`[overlay: laugh triggered] ${timestamp}`);
  await this.playExpression('laugh');
} else if (normalizedText.includes('sigh') || normalizedText.includes('overwhelm')) {
  this.lastOverlayTime = now;
  const timestamp = new Date().toISOString();
  console.log(`[overlay: sigh triggered] ${timestamp}`);
  await this.playExpression('sigh');
} else {
  console.log('[overlay: no match]');
}
```

### Step 3: Test Phrases
Try these exact phrases in jonathan-demo:
- "That's so funny!" (should trigger laugh)
- "That makes me sigh" (should trigger sigh)  
- "Jeez, that's incredible!" (should trigger jeez)

## Verification Commands

Run these in browser console on jonathan-demo:

```javascript
// 1. Check expression system state
debugExpressionSystem()

// 2. Test expressions manually
testExpressions()

// 3. Test your uploaded audio files directly
testAudioFiles()

// 4. Check feature flag
console.log('Feature flag enabled:', isFeatureEnabled('EXPRESSION_OVERLAYS_ENABLED'))
```