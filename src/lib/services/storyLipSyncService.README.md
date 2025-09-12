# Story Lip-Sync Service (Experimental)

## Overview

The `StoryLipSyncService` provides experimental integration between authentic voice stories and HeyGen avatar lip-sync capabilities. This feature attempts to synchronize avatar lip movements with story audio for a more immersive experience.

**⚠️ EXPERIMENTAL FEATURE**: This feature is experimental and disabled by default. It requires a connected HeyGen avatar and gracefully degrades when unavailable.

## Features

- **HeyGen Integration**: Attempts to sync avatar lip movements with story audio
- **Transcript Support**: Uses story transcripts for accurate lip-sync when available
- **Fallback Text**: Generates appropriate fallback text based on story category and title
- **Graceful Degradation**: Falls back to idle animation when lip-sync is unavailable
- **Smooth Transitions**: Provides smooth transitions between story and TTS lip-sync
- **Configuration**: Fully configurable with runtime enable/disable support

## Requirements

- Task 17: Integrate with avatar lip-sync system (experimental, off by default)
- Requirement 3.2: Avatar lip-sync animation synchronized to audio
- Requirement 7.4: Reliable cross-device functionality

## Usage

### Basic Setup

```typescript
import { StoryLipSyncService } from './storyLipSyncService';

// Create service with default configuration (disabled)
const lipSyncService = new StoryLipSyncService();

// Enable experimental feature
lipSyncService.setEnabled(true);

// Attempt lip-sync for a story
const result = await lipSyncService.attemptStoryLipSync(story, audioBuffer);

if (result.success) {
  console.log(`Lip-sync activated: ${result.method}`);
} else {
  console.log(`Lip-sync failed: ${result.error}`);
}
```

### Integration with Story Audio Manager

The service is automatically integrated with `StoryAudioManager`:

```typescript
import { StoryAudioManager } from './storyAudioManager';

const audioManager = new StoryAudioManager({
  enableLipSync: true // Enable experimental lip-sync
});

// Lip-sync will be attempted automatically during story playback
const result = await audioManager.replaceNextTTSWithStory(story, streamingManager);

console.log('Lip-sync used:', result.lip_sync_used);
console.log('Lip-sync method:', result.lip_sync_method);
```

### Configuration Options

```typescript
const lipSyncService = new StoryLipSyncService({
  enabled: false,              // Disabled by default (experimental)
  fallbackToIdle: true,        // Show idle animation when unavailable
  transitionDurationMs: 300,   // Smooth transition duration
  maxRetries: 2,               // Retry attempts for failed operations
  timeoutMs: 5000,             // Timeout for lip-sync operations
  debugMode: false             // Enable detailed logging
});
```

## How It Works

### 1. HeyGen Avatar Detection

The service attempts to connect to a global HeyGen avatar instance:

```typescript
// Looks for global avatar instance
const globalHeyGen = (window as any).heygenAvatar;

if (globalHeyGen && globalHeyGen.isConnected) {
  // Use HeyGen for lip-sync
}
```

### 2. Lip-Sync Methods

#### Transcript-Based Sync (Preferred)
When a story has a transcript, it's used for accurate lip-sync:

```typescript
if (story.transcript) {
  await heygenAvatar.speak(story.transcript, 'story-lipsync');
}
```

#### Fallback Text Sync
When no transcript is available, generates appropriate fallback text:

```typescript
const fallbackTexts = {
  memory: `Sharing a cherished memory about ${story.title}`,
  experience: `Recounting an experience from ${story.title}`,
  advice: `Offering some thoughts on ${story.title}`,
  anecdote: `Telling a story about ${story.title}`
};
```

#### Idle Animation Fallback
When HeyGen is unavailable, falls back to idle animation:

```typescript
if (!heygenAvatar.isConnected) {
  return { success: true, method: 'idle' };
}
```

### 3. State Management

The service manages lip-sync state transitions:

- **Idle**: Default state, no active lip-sync
- **Story**: Currently syncing with story audio
- **TTS**: Syncing with text-to-speech audio

### 4. Smooth Transitions

Provides smooth transitions between different states:

```typescript
// Transition to story lip-sync
await transitionToStoryLipSync();

// Play story audio with lip-sync

// Transition back to TTS
await transitionBackToTTS();
```

## API Reference

### Core Methods

#### `attemptStoryLipSync(story, audioBuffer?)`
Attempts to sync avatar with story audio.

**Parameters:**
- `story`: UserStory object with metadata
- `audioBuffer`: Optional AudioBuffer for the story

**Returns:** `LipSyncResult`
- `success`: Whether lip-sync was activated
- `method`: 'heygen' | 'idle' | 'none'
- `error`: Error message if failed
- `duration`: Expected duration in milliseconds

#### `transitionBackToTTS()`
Transitions from story lip-sync back to TTS mode.

#### `setEnabled(enabled)`
Enables or disables the lip-sync feature.

#### `isAvailable()`
Checks if lip-sync is available and ready.

#### `getCurrentState()`
Returns current lip-sync state and status.

### Configuration Methods

#### `updateConfig(config)`
Updates service configuration at runtime.

#### `getConfig()`
Returns current configuration.

## Error Handling

The service implements comprehensive error handling:

### Connection Errors
```typescript
try {
  const result = await lipSyncService.attemptStoryLipSync(story);
} catch (error) {
  // Automatically falls back to idle animation
  console.log('Lip-sync failed, using idle animation');
}
```

### Graceful Degradation
- **No HeyGen Avatar**: Falls back to idle animation
- **Avatar Disconnected**: Falls back to idle animation  
- **Speak Failures**: Falls back to idle animation
- **Timeout**: Abandons lip-sync, continues with audio

### Error Recovery
- Automatic retry with exponential backoff
- Fallback to idle animation on persistent failures
- Continues audio playback regardless of lip-sync status

## Performance Considerations

### Minimal Impact
- Lip-sync attempts are non-blocking
- Audio playback continues regardless of lip-sync status
- Timeout protection prevents hanging operations

### Resource Management
- Lightweight service with minimal memory footprint
- No persistent connections or heavy resources
- Efficient state management

### Mobile Optimization
- Works with existing mobile audio optimizations
- Respects mobile Safari constraints
- Graceful degradation on resource-constrained devices

## Testing

### Unit Tests
```bash
npm test storyLipSyncService.test.ts
```

### Integration Tests
```bash
npm test storyAudioManager.lipSync.integration.test.ts
```

### Manual Testing Checklist

1. **Enable Feature**
   - [ ] Lip-sync can be enabled via configuration
   - [ ] Feature remains disabled by default

2. **HeyGen Integration**
   - [ ] Connects to HeyGen avatar when available
   - [ ] Handles missing HeyGen avatar gracefully
   - [ ] Respects avatar connection status

3. **Lip-Sync Methods**
   - [ ] Uses transcript when available
   - [ ] Generates fallback text appropriately
   - [ ] Falls back to idle animation when needed

4. **Transitions**
   - [ ] Smooth transition to story lip-sync
   - [ ] Smooth transition back to TTS
   - [ ] Handles concurrent transitions

5. **Error Scenarios**
   - [ ] Handles HeyGen speak failures
   - [ ] Handles timeout scenarios
   - [ ] Continues audio playback on errors

## Configuration UI

Use the `StoryLipSyncSettings` component for user configuration:

```typescript
import StoryLipSyncSettings from '../components/StoryLipSyncSettings';

// In your settings page
<StoryLipSyncSettings />
```

## Troubleshooting

### Common Issues

#### Lip-Sync Not Working
1. Check if feature is enabled: `lipSyncService.getCurrentState().enabled`
2. Verify HeyGen avatar connection: `(window as any).heygenAvatar?.isConnected`
3. Enable debug mode: `lipSyncService.updateConfig({ debugMode: true })`

#### Performance Issues
1. Check transition duration: Reduce `transitionDurationMs`
2. Verify timeout settings: Adjust `timeoutMs`
3. Monitor console for error messages

#### Avatar Connection Issues
1. Ensure HeyGen avatar is properly initialized
2. Check avatar session status
3. Verify global avatar instance availability

### Debug Mode

Enable detailed logging for troubleshooting:

```typescript
lipSyncService.updateConfig({ debugMode: true });
```

This will log:
- Initialization attempts
- Lip-sync method selection
- Transition events
- Error details
- Performance metrics

## Future Enhancements

### Planned Improvements
- Support for additional avatar systems (D-ID, etc.)
- Enhanced transcript processing
- Real-time lip-sync quality monitoring
- Advanced transition effects
- Performance analytics

### Experimental Features
- Voice activity detection
- Emotion-based lip-sync adjustments
- Multi-language support
- Custom fallback text templates

## Security Considerations

- No sensitive data is transmitted to external services
- HeyGen integration uses existing session management
- Graceful degradation prevents security failures
- No persistent storage of lip-sync data

## Browser Compatibility

- **Chrome**: Full support
- **Firefox**: Full support  
- **Safari**: Full support with mobile optimizations
- **Edge**: Full support
- **Mobile Safari**: Optimized support with graceful degradation
- **Android Chrome**: Full support

## License

This experimental feature is part of the EchoStone project and follows the same licensing terms.