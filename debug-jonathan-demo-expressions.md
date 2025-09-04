# Debug: Jonathan-Demo Expression Issues

## Current Status
- ✅ Feature flag `EXPRESSION_OVERLAYS_ENABLED=true` is set
- ✅ Expression MP3 files exist in `/public/snippets/`
- ✅ Code implementation looks correct
- ❌ Expressions not triggering on jonathan-demo

## Debugging Steps

### 1. Check Browser Console
When testing on jonathan-demo, look for these logs:
```
🎭 Initializing universal expression player for avatar jonathan-demo...
🎭 ✅ Universal expression player initialized for avatar jonathan-demo
[overlay: laugh triggered] 2024-XX-XXTXX:XX:XX.XXXZ
```

### 2. Test Trigger Phrases
Try these exact phrases in jonathan-demo chat:
- "That's funny"
- "funny"
- "That's so funny!"
- "Haha, that's hilarious!"

### 3. Check Network Tab
Look for requests to:
- `/snippets/laugh_short.mp3`
- Any 404 errors for MP3 files

### 4. Verify Expression Player Initialization
The system should log:
```
[AudioQueue] 🎭 Initializing universal expression player for avatar jonathan-demo...
[AudioQueue] 🎭 ✅ Universal expression player initialized for avatar jonathan-demo
```

## Potential Issues

### Issue 1: Avatar ID Mismatch
The code might be looking for avatar ID "jonathan-demo" but the actual avatar ID could be different.

### Issue 2: TTS Pipeline Not Connected
Expressions only trigger during TTS playback. If TTS isn't working, expressions won't trigger.

### Issue 3: AudioContext Issues
Mobile Safari or other browsers might have AudioContext restrictions.

### Issue 4: Expression Player Not Ready
The async initialization might not be completing before TTS starts.

## Quick Fix Test
Add this to browser console on jonathan-demo:
```javascript
// Test if expression player exists
console.log('Testing expression system...');

// Try to manually trigger
if (window.expressionPlayer) {
  window.expressionPlayer.playExpressionsForText('funny');
} else {
  console.log('No expression player found');
}
```