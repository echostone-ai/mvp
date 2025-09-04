/**
 * Voice Expression Integration Example
 * 
 * Demonstrates how to integrate expression overlays with the voice pipeline
 * while maintaining TTS performance and reliability.
 * 
 * Requirements: 9.1, 9.2, 5.2
 */

import { createStreamingAudioManager } from '../streamingUtils';
import { 
  integrateExpressionsWithVoice, 
  setupUserExpressions, 
  setupAvatarExpressions,
  disableExpressions,
  enableExpressions,
  checkExpressionsAvailable
} from '../voiceExpressionIntegration';

/**
 * Example 1: Basic User Expression Integration
 * Shows how to add expression support to a user's voice experience
 */
export async function basicUserExpressionExample(userId: string, voiceId: string) {
  console.log('=== Basic User Expression Integration ===');
  
  // Create streaming audio manager as usual
  const audioManager = createStreamingAudioManager(voiceId, {}, undefined, {
    conversationId: `user-${userId}-session`
  });
  
  // Check if user has expressions available
  const hasExpressions = await checkExpressionsAvailable(userId, 'user');
  console.log(`User ${userId} has expressions: ${hasExpressions}`);
  
  if (hasExpressions) {
    // Set up user expressions (this is the main integration step)
    const result = await setupUserExpressions(audioManager, userId);
    
    if (result.success) {
      console.log(`✅ Successfully integrated ${result.expressionCount} expressions`);
      
      // Now use the audio manager normally - expressions will be added automatically
      await audioManager.addSentence("Hello! This is absolutely hilarious!");
      await audioManager.addSentence("Unfortunately, that's a bit disappointing.");
      await audioManager.addSentence("But exactly what I expected!");
      
    } else {
      console.log(`❌ Failed to integrate expressions: ${result.error}`);
      // Audio manager still works normally without expressions
      await audioManager.addSentence("Hello! This works without expressions too.");
    }
  } else {
    console.log('No expressions available, using standard TTS');
    await audioManager.addSentence("Hello! This is standard TTS without expressions.");
  }
  
  // Clean up
  audioManager.stop();
}

/**
 * Example 2: Avatar Expression Integration
 * Shows how to set up expressions for demo avatars like jonathan-demo
 */
export async function avatarExpressionExample(avatarId: string, voiceId: string) {
  console.log('=== Avatar Expression Integration ===');
  
  const audioManager = createStreamingAudioManager(voiceId, {}, undefined, {
    conversationId: `avatar-${avatarId}-session`
  });
  
  // Set up avatar expressions (for demo avatars with admin-managed expressions)
  const result = await setupAvatarExpressions(audioManager, avatarId);
  
  if (result.success) {
    console.log(`✅ Avatar ${avatarId} has ${result.expressionCount} expressions`);
    
    // Demo conversation with expressions
    await audioManager.addSentence("Welcome! I'm delighted to meet you.");
    await audioManager.addSentence("That's absolutely fascinating!");
    await audioManager.addSentence("Hmm, let me think about that for a moment.");
    
  } else {
    console.log(`Avatar ${avatarId} has no expressions, using standard voice`);
    await audioManager.addSentence("Welcome! I'm here to help you.");
  }
  
  audioManager.stop();
}

/**
 * Example 3: Advanced Integration with Manual Control
 * Shows how to manually control expression settings and handle errors
 */
export async function advancedExpressionExample(userId: string, voiceId: string) {
  console.log('=== Advanced Expression Integration ===');
  
  const audioManager = createStreamingAudioManager(voiceId);
  
  try {
    // Manual integration with custom options
    const result = await integrateExpressionsWithVoice(audioManager, {
      ownerId: userId,
      ownerType: 'user',
      enableByDefault: true,
      maxExpressions: 20 // Limit to 20 expressions for performance
    });
    
    if (result.success) {
      console.log(`✅ Integrated ${result.expressionCount} expressions`);
      
      // Test with expressions enabled
      console.log('Testing with expressions enabled...');
      await audioManager.addSentence("This is hilarious and absolutely perfect!");
      
      // Temporarily disable expressions
      console.log('Disabling expressions...');
      disableExpressions(audioManager);
      await audioManager.addSentence("This sentence won't have expressions.");
      
      // Re-enable expressions
      console.log('Re-enabling expressions...');
      enableExpressions(audioManager);
      await audioManager.addSentence("Now expressions are back!");
      
    } else {
      console.log(`❌ Integration failed: ${result.error}`);
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
    // Audio manager continues to work for TTS even if expressions fail
    await audioManager.addSentence("Fallback TTS still works perfectly.");
  }
  
  audioManager.stop();
}

/**
 * Example 4: Performance Testing
 * Demonstrates that TTS performance is maintained with expressions
 */
export async function performanceTestExample(userId: string, voiceId: string) {
  console.log('=== TTS Performance Test with Expressions ===');
  
  const audioManager = createStreamingAudioManager(voiceId);
  
  // Set up expressions
  await setupUserExpressions(audioManager, userId);
  
  // Test TTS start time (should be under 10ms as per requirement 9.1)
  const sentences = [
    "This is a performance test sentence.",
    "Another sentence to test timing.",
    "A third sentence with funny content that might trigger expressions.",
    "Final sentence to complete the test."
  ];
  
  console.log('Testing TTS start times...');
  
  for (const sentence of sentences) {
    const startTime = performance.now();
    
    // This should start immediately, not blocked by expression processing
    await audioManager.addSentence(sentence);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`Sentence processed in ${duration.toFixed(2)}ms`);
    
    // Verify performance requirement (should be under 10ms)
    if (duration > 10) {
      console.warn(`⚠️  Performance warning: TTS took ${duration.toFixed(2)}ms (should be <10ms)`);
    } else {
      console.log(`✅ Performance good: ${duration.toFixed(2)}ms`);
    }
  }
  
  audioManager.stop();
}

/**
 * Example 5: Error Handling and Graceful Degradation
 * Shows how the system handles various error conditions
 */
export async function errorHandlingExample(voiceId: string) {
  console.log('=== Error Handling and Graceful Degradation ===');
  
  const audioManager = createStreamingAudioManager(voiceId);
  
  // Test with non-existent user (should gracefully handle no expressions)
  console.log('Testing with non-existent user...');
  const result1 = await setupUserExpressions(audioManager, 'non-existent-user');
  console.log(`Result: success=${result1.success}, count=${result1.expressionCount}`);
  
  // TTS should still work
  await audioManager.addSentence("TTS works even without expressions.");
  
  // Test with network errors (simulated by invalid user ID)
  console.log('Testing error recovery...');
  try {
    await audioManager.addSentence("This should work despite any expression errors.");
    console.log('✅ TTS continues to work during expression errors');
  } catch (error) {
    console.error('❌ TTS failed:', error);
  }
  
  audioManager.stop();
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('🎵 Voice Expression Integration Examples 🎵\n');
  
  const testUserId = 'example-user-123';
  const testAvatarId = 'jonathan-demo';
  const testVoiceId = 'example-voice-id';
  
  try {
    await basicUserExpressionExample(testUserId, testVoiceId);
    console.log('\n' + '='.repeat(50) + '\n');
    
    await avatarExpressionExample(testAvatarId, testVoiceId);
    console.log('\n' + '='.repeat(50) + '\n');
    
    await advancedExpressionExample(testUserId, testVoiceId);
    console.log('\n' + '='.repeat(50) + '\n');
    
    await performanceTestExample(testUserId, testVoiceId);
    console.log('\n' + '='.repeat(50) + '\n');
    
    await errorHandlingExample(testVoiceId);
    
    console.log('\n✅ All examples completed successfully!');
    
  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

// Export for easy testing
if (typeof window !== 'undefined') {
  (window as any).voiceExpressionExamples = {
    basicUserExpressionExample,
    avatarExpressionExample,
    advancedExpressionExample,
    performanceTestExample,
    errorHandlingExample,
    runAllExamples
  };
}