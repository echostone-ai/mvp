/**
 * Conversation Service Usage Examples
 * 
 * Demonstrates how to use the ConversationService for various scenarios
 * including basic conversations, session management, and performance optimization.
 */

import { ConversationService, ConversationRequest, ConversationResponse } from '../conversationService';

// Create a conversation service instance
const conversationService = new ConversationService();

/**
 * Example 1: Basic conversation processing
 */
export async function basicConversationExample(): Promise<void> {
  console.log('=== Basic Conversation Example ===');

  const request: ConversationRequest = {
    avatarId: 'avatar-123',
    userInput: 'Tell me about yourself',
    visitorId: 'visitor-456',
    fastMode: false,
    options: {
      enableFactExtraction: true,
      includeMemoryFragments: true,
      confidenceThreshold: 0.35
    }
  };

  try {
    const response = await conversationService.processConversation(request);
    
    console.log('Response:', response.text);
    console.log('Confidence:', response.confidence);
    console.log('Processing Time:', response.processingTimeMs, 'ms');
    console.log('Session ID:', response.sessionId);
    console.log('Facts Retrieved:', response.metadata.factsRetrieved);
    console.log('Memories Retrieved:', response.metadata.memoriesRetrieved);
    
  } catch (error) {
    console.error('Conversation failed:', error);
  }
}

/**
 * Example 2: Multi-turn conversation with session continuity
 */
export async function multiTurnConversationExample(): Promise<void> {
  console.log('=== Multi-turn Conversation Example ===');

  const sessionId = 'demo-session-' + Date.now();
  const avatarId = 'avatar-123';

  // First turn
  const firstRequest: ConversationRequest = {
    avatarId,
    userInput: 'What\'s your favorite hobby?',
    sessionId,
    fastMode: false
  };

  const firstResponse = await conversationService.processConversation(firstRequest);
  console.log('Turn 1 - User:', firstRequest.userInput);
  console.log('Turn 1 - Assistant:', firstResponse.text);

  // Second turn - references previous context
  const secondRequest: ConversationRequest = {
    avatarId,
    userInput: 'How long have you been doing that?',
    sessionId,
    fastMode: false
  };

  const secondResponse = await conversationService.processConversation(secondRequest);
  console.log('Turn 2 - User:', secondRequest.userInput);
  console.log('Turn 2 - Assistant:', secondResponse.text);

  // Third turn - more context building
  const thirdRequest: ConversationRequest = {
    avatarId,
    userInput: 'What got you started with it?',
    sessionId,
    fastMode: false
  };

  const thirdResponse = await conversationService.processConversation(thirdRequest);
  console.log('Turn 3 - User:', thirdRequest.userInput);
  console.log('Turn 3 - Assistant:', thirdResponse.text);

  // Show session information
  const session = conversationService.getSession(sessionId);
  console.log('Session turns:', session?.turns.length);
  console.log('Entity bindings:', session?.entityBindings.size);

  // Show conversation continuity metrics
  const continuity = conversationService.getConversationContinuity(sessionId);
  console.log('Continuity metrics:', continuity);
}

/**
 * Example 3: Fast mode for quick responses
 */
export async function fastModeExample(): Promise<void> {
  console.log('=== Fast Mode Example ===');

  const normalRequest: ConversationRequest = {
    avatarId: 'avatar-123',
    userInput: 'Quick question about your work',
    fastMode: false
  };

  const fastRequest: ConversationRequest = {
    avatarId: 'avatar-123',
    userInput: 'Quick question about your work',
    fastMode: true
  };

  // Normal mode
  const normalStart = Date.now();
  const normalResponse = await conversationService.processConversation(normalRequest);
  const normalTime = Date.now() - normalStart;

  // Fast mode
  const fastStart = Date.now();
  const fastResponse = await conversationService.processConversation(fastRequest);
  const fastTime = Date.now() - fastStart;

  console.log('Normal mode:');
  console.log('  Response:', normalResponse.text);
  console.log('  Time:', normalTime, 'ms');
  console.log('  Facts retrieved:', normalResponse.metadata.factsRetrieved);
  console.log('  Memories retrieved:', normalResponse.metadata.memoriesRetrieved);

  console.log('Fast mode:');
  console.log('  Response:', fastResponse.text);
  console.log('  Time:', fastTime, 'ms');
  console.log('  Facts retrieved:', fastResponse.metadata.factsRetrieved);
  console.log('  Memories retrieved:', fastResponse.metadata.memoriesRetrieved);

  console.log('Speed improvement:', Math.round((1 - fastTime / normalTime) * 100), '%');
}

/**
 * Example 4: Custom conversation options
 */
export async function customOptionsExample(): Promise<void> {
  console.log('=== Custom Options Example ===');

  const request: ConversationRequest = {
    avatarId: 'avatar-123',
    userInput: 'Tell me a story from your childhood',
    fastMode: false,
    options: {
      maxResponseLength: 200,
      includeMemoryFragments: true,
      confidenceThreshold: 0.5, // Higher threshold for more reliable facts
      enableFactExtraction: true,
      customSystemPrompt: `
        You are a warm, nostalgic storyteller. When sharing memories, 
        be vivid and emotional. Reference specific details from your past.
        Keep responses under 200 words but make them engaging.
      `,
      performanceMode: 'balanced'
    }
  };

  const response = await conversationService.processConversation(request);
  
  console.log('Custom response:', response.text);
  console.log('Used custom prompt:', !!request.options?.customSystemPrompt);
  console.log('Response length:', response.text.length);
  console.log('Confidence threshold used:', request.options?.confidenceThreshold);
}

/**
 * Example 5: Session management and cleanup
 */
export async function sessionManagementExample(): Promise<void> {
  console.log('=== Session Management Example ===');

  // Create multiple sessions
  const sessions = ['session-1', 'session-2', 'session-3'];
  
  for (const sessionId of sessions) {
    await conversationService.processConversation({
      avatarId: 'avatar-123',
      userInput: `Hello from ${sessionId}`,
      sessionId,
      fastMode: false
    });
  }

  // Show performance stats
  const stats = conversationService.getPerformanceStats();
  console.log('Performance stats:');
  console.log('  Active sessions:', stats.activeSessions);
  console.log('  Average session duration:', Math.round(stats.averageSessionDuration), 'ms');
  console.log('  Average entity bindings:', Math.round(stats.averageEntityBindings));

  // Demonstrate session retrieval
  const session1 = conversationService.getSession('session-1');
  console.log('Session 1 info:');
  console.log('  Avatar ID:', session1?.avatarId);
  console.log('  Turn count:', session1?.turns.length);
  console.log('  Entity bindings:', session1?.entityBindings.size);

  // Clean up old sessions (simulate old sessions)
  if (session1) {
    session1.lastActivity = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
  }

  const cleanedCount = conversationService.clearExpiredSessions(24 * 60 * 60 * 1000); // 24 hour threshold
  console.log('Cleaned up', cleanedCount, 'expired sessions');
  console.log('Remaining active sessions:', conversationService.getPerformanceStats().activeSessions);
}

/**
 * Example 6: Error handling and recovery
 */
export async function errorHandlingExample(): Promise<void> {
  console.log('=== Error Handling Example ===');

  // Example with invalid avatar ID
  const invalidRequest: ConversationRequest = {
    avatarId: '', // Invalid avatar ID
    userInput: 'This should handle errors gracefully',
    fastMode: false
  };

  try {
    const response = await conversationService.processConversation(invalidRequest);
    console.log('Unexpected success:', response.text);
  } catch (error) {
    console.log('Handled error gracefully:', (error as Error).message);
  }

  // Example with very long input
  const longInputRequest: ConversationRequest = {
    avatarId: 'avatar-123',
    userInput: 'A'.repeat(10000), // Very long input
    fastMode: true // Use fast mode to handle it better
  };

  try {
    const response = await conversationService.processConversation(longInputRequest);
    console.log('Handled long input, response length:', response.text.length);
    console.log('Processing time:', response.processingTimeMs, 'ms');
  } catch (error) {
    console.log('Long input error:', (error as Error).message);
  }
}

/**
 * Example 7: Performance monitoring and optimization
 */
export async function performanceMonitoringExample(): Promise<void> {
  console.log('=== Performance Monitoring Example ===');

  const performanceResults: Array<{
    mode: string;
    time: number;
    confidence: number;
    factsRetrieved: number;
  }> = [];

  // Test different performance modes
  const modes = [
    { name: 'fast', fastMode: true },
    { name: 'normal', fastMode: false }
  ];

  for (const mode of modes) {
    const startTime = Date.now();
    
    const response = await conversationService.processConversation({
      avatarId: 'avatar-123',
      userInput: 'Tell me about your day',
      fastMode: mode.fastMode,
      options: {
        performanceMode: mode.fastMode ? 'fast' : 'balanced'
      }
    });

    const totalTime = Date.now() - startTime;

    performanceResults.push({
      mode: mode.name,
      time: totalTime,
      confidence: response.confidence,
      factsRetrieved: response.metadata.factsRetrieved
    });

    console.log(`${mode.name} mode:`, {
      totalTime,
      processingTime: response.processingTimeMs,
      contextRetrieval: response.metadata.contextRetrievalTimeMs,
      gpt5Processing: response.metadata.gpt5ProcessingTimeMs,
      memoryUpdate: response.metadata.memoryUpdateTimeMs,
      confidence: response.confidence,
      factsRetrieved: response.metadata.factsRetrieved
    });
  }

  // Compare performance
  const fastResult = performanceResults.find(r => r.mode === 'fast');
  const normalResult = performanceResults.find(r => r.mode === 'normal');

  if (fastResult && normalResult) {
    const speedImprovement = Math.round((1 - fastResult.time / normalResult.time) * 100);
    console.log(`Fast mode is ${speedImprovement}% faster`);
    console.log(`Confidence difference: ${Math.round((normalResult.confidence - fastResult.confidence) * 100)}%`);
  }
}

/**
 * Run all examples
 */
export async function runAllExamples(): Promise<void> {
  console.log('Running Conversation Service Examples...\n');

  try {
    await basicConversationExample();
    console.log('\n');

    await multiTurnConversationExample();
    console.log('\n');

    await fastModeExample();
    console.log('\n');

    await customOptionsExample();
    console.log('\n');

    await sessionManagementExample();
    console.log('\n');

    await errorHandlingExample();
    console.log('\n');

    await performanceMonitoringExample();
    console.log('\n');

    console.log('All examples completed successfully!');
  } catch (error) {
    console.error('Example execution failed:', error);
  }
}

// Export individual examples for selective testing
export {
  basicConversationExample,
  multiTurnConversationExample,
  fastModeExample,
  customOptionsExample,
  sessionManagementExample,
  errorHandlingExample,
  performanceMonitoringExample
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}