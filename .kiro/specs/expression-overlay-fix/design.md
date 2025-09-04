# Design Document

## Overview

This design implements a minimal fix for the expression overlay system to enable basic expression playback during TTS streaming. The solution focuses on ensuring the expression player is properly awaited before use and implementing one hardcoded trigger ("funny" → "laugh") to prove the concept works.

## Architecture

The fix operates within the existing architecture without major changes:

1. **StreamingUtils.ts**: Contains the AudioQueue class that manages TTS streaming and expression integration
2. **SimpleExpressionPlayer.ts**: Handles expression audio playback with keyword matching
3. **UniversalExpressionService.ts**: Provides expression loading and player creation for all avatars
4. **Jonathan-demo page**: Consumer that initializes and uses the expression system

## Components and Interfaces

### Core Fix Components

#### 1. Expression Player Initialization (streamingUtils.ts)
- **Current Issue**: Expression player initialization is async but not properly awaited
- **Fix**: Store initialization promise and await it before first use
- **Implementation**: Add `ensureExpressionPlayerReady()` method that waits for initialization

#### 2. Hardcoded Trigger Mapping (simpleExpressionPlayer.ts)
- **Current Issue**: Complex keyword matching that may not be working reliably
- **Fix**: Implement simple exact string matching for "funny" → "laugh"
- **Implementation**: Enhanced logging in `playExpressionsForText()` method

#### 3. Concurrent Audio Playback
- **Current Issue**: Expression timing and TTS interaction unclear
- **Fix**: Ensure expressions play concurrently with TTS without blocking
- **Implementation**: Use separate AudioBufferSourceNode instances so TTS never stalls
- **Audio Context**: Expressions use same AudioContext as TTS but separate source nodes

## Data Models

### Expression Trigger Model
```typescript
// Minimal hardcoded mapping for proof of concept
const HARDCODED_TRIGGERS = {
  "funny": "laugh"  // If text contains "funny" (anywhere), play "laugh" expression
}
// Note: Triggers on any occurrence of "funny" - will match "that's funny", "funny story", etc.
```

### Logging Model
```typescript
interface ExpressionLog {
  timestamp: number
  action: 'triggered' | 'completed' | 'failed'
  expressionId: string
  text: string
  duration?: number  // Playback duration in seconds for completed events
}
```

## Error Handling

### Graceful Degradation Strategy
1. **Expression Player Not Ready**: Log warning, continue with TTS only
2. **Audio File Missing**: Log error, continue with TTS only  
3. **Audio Playback Failure**: Log error, continue with TTS only
4. **No Expression Match**: Log debug info, continue with TTS only

### Error Logging Requirements
- All expression attempts must be logged with timestamps
- Success and failure cases must be clearly distinguishable
- No errors should interrupt TTS playback

## Testing Strategy

### Manual Testing Protocol
1. **Setup**: Navigate to jonathan-demo page
2. **Test Input 1**: Type "that's funny" in chat
3. **Expected Behavior**: 
   - Console shows "[overlay: laugh triggered]" within 200ms
   - Both TTS and laugh audio play concurrently
   - Console shows "[overlay: laugh completed @1.8s]" when expression finishes
4. **Test Input 2**: Type "hello there" in chat (non-trigger)
5. **Expected Behavior**: 
   - No expression logs in console
   - Only TTS plays normally
   - No audio glitches or interruptions
6. **Verification**: Repeat both tests 3 times to ensure consistency

### Debug Logging Requirements
- Expression player initialization status
- Keyword matching attempts and results  
- Audio playback start/end events
- Any errors or fallbacks used

## Implementation Approach

### Phase 1: Core Fix (Target: <20 lines)
1. **streamingUtils.ts**: Add `ensureExpressionPlayerReady()` method (5 lines)
2. **streamingUtils.ts**: Call await before expression playback (2 lines)  
3. **simpleExpressionPlayer.ts**: Add hardcoded "funny" → "laugh" check (8 lines)
4. **simpleExpressionPlayer.ts**: Add completion logging with duration (3 lines)

### Code Changes Summary
- **File 1**: `src/lib/streamingUtils.ts` - Expression player awaiting
- **File 2**: `src/lib/simpleExpressionPlayer.ts` - Hardcoded trigger and logging
- **Total**: Maximum 18 lines of changes

### Integration Points
- Uses existing `UniversalExpressionService` for player creation
- Uses existing `SimpleExpressionPlayer` for audio playback
- Uses existing AudioQueue expression scheduling in `streamingUtils.ts`
- No changes to API endpoints, database, or page components

## Success Criteria

### Functional Requirements
1. Expression player properly awaited before first use
2. Text containing "funny" triggers laugh expression
3. TTS and expression audio play concurrently without interruption
4. Console logging confirms trigger and completion events

### Performance Requirements  
1. Expression trigger detection within 200ms
2. No delay added to TTS start time
3. No audio glitches or interruptions

### Reliability Requirements
1. System works consistently across multiple test attempts
2. Graceful fallback when expressions fail
3. TTS continues normally if expression system unavailable