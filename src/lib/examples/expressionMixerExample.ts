/**
 * Example usage of ExpressionAudioMixer
 * 
 * Demonstrates how to integrate the mixer with existing audio systems
 * and schedule expression overlays during TTS playback.
 */

import { ExpressionAudioMixer, createExpressionMixer } from '../expressionAudioMixer';
import { scheduleOverlays, ExpressionClip } from '../expressionScheduler';
import { useExpressionPack } from '../hooks/useExpressionPack';

/**
 * Example: Basic mixer setup and usage
 */
export async function basicMixerExample() {
  // Create and initialize the mixer
  const mixer = await createExpressionMixer({
    masterVolume: 0.8,
    duckingAmount: 0.4, // 3-6dB reduction during expressions
    fadeDurationMs: 50,
    maxExpressionDurationMs: 300
  });

  if (!mixer) {
    console.warn('Failed to create expression mixer - Web Audio not supported');
    return null;
  }

  console.log('Expression mixer initialized:', mixer.isReady());
  return mixer;
}

/**
 * Example: Integration with TTS system
 */
export async function ttsIntegrationExample(mixer: ExpressionAudioMixer, ttsAudioElement: HTMLAudioElement) {
  // Get the TTS input node for connecting TTS audio
  const ttsInput = mixer.getTTSInput();
  
  if (!ttsInput) {
    console.warn('Mixer not ready for TTS integration');
    return;
  }

  // In a real implementation, you would connect your TTS audio source to ttsInput
  // For example, if using Web Audio API for TTS:
  // const ttsSource = audioContext.createMediaElementSource(ttsAudioElement);
  // ttsSource.connect(ttsInput);
  
  // Get the mixer output for connecting to speakers
  const output = mixer.getOutput();
  // output would connect to audioContext.destination or your audio routing system
  
  console.log('TTS integration ready');
}

/**
 * Example: Scheduling and playing expressions
 */
export async function expressionPlaybackExample(
  mixer: ExpressionAudioMixer,
  text: string,
  expressionClips: ExpressionClip[]
) {
  // Schedule expressions based on text content
  const schedules = scheduleOverlays(text, expressionClips, {
    maxOverlays: 2,
    minSpacingMs: 4000,
    duckingAmount: 0.4
  });

  console.log(`Scheduled ${schedules.length} expressions for text: "${text}"`);

  // Create mock audio buffers (in real usage, these would be preloaded)
  const mockBuffers = new Map<string, AudioBuffer>();
  
  // In a real implementation, you would use preloaded buffers from useExpressionPack
  // const { pack } = useExpressionPack({ ownerId: 'user-123' });
  // const buffers = pack?.preloaded_buffers || new Map();

  // Play the scheduled expressions
  await mixer.playExpressionOverlays(schedules, mockBuffers);
  
  console.log('Expressions scheduled for playback');
  
  // Monitor mixer state
  const state = mixer.getState();
  console.log('Mixer state:', {
    activeExpressions: state.activeExpressions,
    isDucked: state.isDucked,
    currentVolume: state.currentVolume
  });
}

/**
 * Example: Complete conversation flow
 */
export async function conversationFlowExample() {
  // Initialize mixer
  const mixer = await basicMixerExample();
  if (!mixer) return;

  // Example conversation turns
  const conversationTurns = [
    {
      text: "Hello there! How are you doing today?",
      expressions: [
        {
          id: 'greeting-1',
          type: 'greeting' as const,
          cdnUrl: 'https://example.com/hello.mp3',
          durationMs: 150,
          priority: 1
        }
      ]
    },
    {
      text: "That's absolutely hilarious! I can't stop laughing at that story.",
      expressions: [
        {
          id: 'laugh-1',
          type: 'laugh' as const,
          cdnUrl: 'https://example.com/laugh.mp3',
          durationMs: 200,
          priority: 1
        },
        {
          id: 'affirmation-1',
          type: 'affirmation' as const,
          cdnUrl: 'https://example.com/absolutely.mp3',
          durationMs: 180,
          priority: 2
        }
      ]
    },
    {
      text: "Unfortunately, that's a really long explanation that requires some careful thought and consideration of all the various factors involved.",
      expressions: [
        {
          id: 'sigh-1',
          type: 'sigh' as const,
          cdnUrl: 'https://example.com/sigh.mp3',
          durationMs: 250,
          priority: 1
        },
        {
          id: 'breath-1',
          type: 'breath' as const,
          cdnUrl: 'https://example.com/breath.mp3',
          durationMs: 120,
          priority: 1
        }
      ]
    }
  ];

  // Process each conversation turn
  for (const [index, turn] of conversationTurns.entries()) {
    console.log(`\n--- Turn ${index + 1} ---`);
    
    // Schedule expressions for this turn
    await expressionPlaybackExample(mixer, turn.text, turn.expressions);
    
    // Simulate TTS completion and cleanup
    setTimeout(() => {
      mixer.stopAllExpressions();
      console.log('Turn completed, expressions stopped');
    }, 3000);
    
    // Wait before next turn
    await new Promise(resolve => setTimeout(resolve, 4000));
  }

  // Cleanup
  mixer.dispose();
  console.log('Conversation completed, mixer disposed');
}

/**
 * Example: Error handling and graceful degradation
 */
export async function errorHandlingExample() {
  const mixer = await basicMixerExample();
  if (!mixer) return;

  // Example with missing buffers (graceful degradation)
  const expressions: ExpressionClip[] = [
    {
      id: 'missing-expr',
      type: 'laugh',
      cdnUrl: 'https://example.com/missing.mp3',
      durationMs: 200,
      priority: 1
    }
  ];

  const schedules = scheduleOverlays("This is funny!", expressions);
  
  // Empty buffer map simulates missing/failed preloads
  const emptyBuffers = new Map<string, AudioBuffer>();
  
  // Should handle gracefully without throwing
  await mixer.playExpressionOverlays(schedules, emptyBuffers);
  
  console.log('Graceful degradation test completed');
  
  // Test rapid stop/start
  for (let i = 0; i < 5; i++) {
    await mixer.playExpressionOverlays(schedules, emptyBuffers);
    mixer.stopAllExpressions();
  }
  
  console.log('Rapid start/stop test completed');
  
  mixer.dispose();
}

/**
 * Example: Performance monitoring
 */
export async function performanceMonitoringExample() {
  const startTime = performance.now();
  
  const mixer = await basicMixerExample();
  if (!mixer) return;
  
  const initTime = performance.now() - startTime;
  console.log(`Mixer initialization time: ${initTime.toFixed(2)}ms`);
  
  // Test scheduling performance
  const expressions: ExpressionClip[] = Array.from({ length: 10 }, (_, i) => ({
    id: `expr-${i}`,
    type: 'filler' as const,
    cdnUrl: `https://example.com/filler-${i}.mp3`,
    durationMs: 100,
    priority: 1
  }));
  
  const scheduleStart = performance.now();
  const schedules = scheduleOverlays("This is a long text that should trigger multiple expressions", expressions);
  const scheduleTime = performance.now() - scheduleStart;
  
  console.log(`Expression scheduling time: ${scheduleTime.toFixed(2)}ms for ${schedules.length} expressions`);
  
  // Test playback scheduling performance
  const playbackStart = performance.now();
  await mixer.playExpressionOverlays(schedules, new Map());
  const playbackTime = performance.now() - playbackStart;
  
  console.log(`Playback scheduling time: ${playbackTime.toFixed(2)}ms`);
  
  mixer.dispose();
}

// Export all examples for easy testing
export const examples = {
  basic: basicMixerExample,
  ttsIntegration: ttsIntegrationExample,
  expressionPlayback: expressionPlaybackExample,
  conversationFlow: conversationFlowExample,
  errorHandling: errorHandlingExample,
  performanceMonitoring: performanceMonitoringExample
};

// Example usage:
// import { examples } from './expressionMixerExample';
// examples.conversationFlow();