/**
 * Example Usage: ConversationHistoryManager
 * 
 * Demonstrates how to use the ConversationHistoryManager for various scenarios
 * including session management, conversation tracking, and cleanup operations.
 */

import { ConversationHistoryManager } from '../conversationHistoryManager';

/**
 * Example 1: Basic conversation session management
 */
export async function basicConversationExample(): Promise<void> {
  console.log('=== Basic Conversation Example ===');

  const historyManager = new ConversationHistoryManager(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      maxTurnsPerSession: 50,
      sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes
      persistToDatabase: true
    }
  );

  try {
    // Create a new conversation session
    const session = await historyManager.getOrCreateSession(
      'user-chat-001',
      'avatar-alice-123',
      'visitor-bob-456',
      'user-789'
    );

    console.log('Created session:', {
      sessionId: session.sessionId,
      avatarId: session.avatarId,
      visitorId: session.visitorId,
      startTime: session.startTime
    });

    // Add conversation turns
    await historyManager.addTurn('user-chat-001', 'user', 'Hello Alice! How are you today?');
    await historyManager.addTurn('user-chat-001', 'assistant', 'Hi there! I\'m doing great, thank you for asking. How can I help you today?', {
      confidence: 0.95,
      processingTimeMs: 150,
      extractedEntities: ['greeting', 'wellbeing_inquiry']
    });

    await historyManager.addTurn('user-chat-001', 'user', 'I wanted to tell you about my new puppy, Max!');
    
    // Update entity bindings based on conversation
    historyManager.updateEntityBindings('user-chat-001', 'pet_name', 'Max');
    historyManager.updateEntityBindings('user-chat-001', 'pet_type', 'puppy');
    
    await historyManager.addTurn('user-chat-001', 'assistant', 'That\'s wonderful! Tell me more about Max. What breed is he?');

    // Get conversation history
    const history = historyManager.getConversationHistory('user-chat-001');
    console.log('Conversation history:', history.map(turn => ({
      role: turn.role,
      content: turn.content,
      timestamp: turn.timestamp
    })));

    // Get conversation continuity metrics
    const continuity = historyManager.getConversationContinuity('user-chat-001');
    console.log('Conversation continuity:', continuity);

  } finally {
    historyManager.destroy();
  }
}

/**
 * Example 2: Multi-session visitor tracking
 */
export async function multiSessionVisitorExample(): Promise<void> {
  console.log('=== Multi-Session Visitor Example ===');

  const historyManager = new ConversationHistoryManager(
    undefined, // No database persistence for this example
    undefined,
    {
      maxTurnsPerSession: 20,
      sessionTimeoutMs: 60 * 60 * 1000, // 1 hour
      persistToDatabase: false
    }
  );

  try {
    const visitorId = 'visitor-charlie-789';
    const avatarId = 'avatar-therapist-456';

    // Create multiple sessions for the same visitor
    const session1 = await historyManager.getOrCreateSession(
      'therapy-session-1',
      avatarId,
      visitorId
    );

    const session2 = await historyManager.getOrCreateSession(
      'therapy-session-2',
      avatarId,
      visitorId
    );

    // Add conversations to both sessions
    await historyManager.addTurn('therapy-session-1', 'user', 'I\'ve been feeling anxious lately');
    historyManager.updateEntityBindings('therapy-session-1', 'current_mood', 'anxious');
    historyManager.updateSessionContext('therapy-session-1', 'session_type', 'initial_consultation');

    await historyManager.addTurn('therapy-session-2', 'user', 'The anxiety is getting better since our last talk');
    historyManager.updateEntityBindings('therapy-session-2', 'current_mood', 'improving');
    historyManager.updateSessionContext('therapy-session-2', 'session_type', 'follow_up');

    // Get all sessions for this visitor
    const visitorSessions = historyManager.getSessionsForVisitor(visitorId);
    console.log('Visitor sessions:', visitorSessions.map(s => ({
      sessionId: s.sessionId,
      turnCount: s.turns.length,
      entityBindings: Array.from(s.entityBindings.entries()),
      context: s.context
    })));

    // Get sessions for the avatar
    const avatarSessions = historyManager.getSessionsForAvatar(avatarId);
    console.log('Avatar sessions count:', avatarSessions.length);

  } finally {
    historyManager.destroy();
  }
}

/**
 * Example 3: Session cleanup and maintenance
 */
export async function sessionCleanupExample(): Promise<void> {
  console.log('=== Session Cleanup Example ===');

  const historyManager = new ConversationHistoryManager(
    undefined,
    undefined,
    {
      sessionTimeoutMs: 5 * 60 * 1000, // 5 minutes for demo
      autoCleanupIntervalMs: 0, // Manual cleanup for demo
      persistToDatabase: false
    }
  );

  try {
    // Create several sessions
    await historyManager.getOrCreateSession('active-session-1', 'avatar-123', 'visitor-1');
    await historyManager.getOrCreateSession('active-session-2', 'avatar-123', 'visitor-2');
    await historyManager.getOrCreateSession('old-session-1', 'avatar-456', 'visitor-3');

    // Manually age one session
    const oldSession = historyManager.getSession('old-session-1');
    if (oldSession) {
      oldSession.lastActivity = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago
    }

    console.log('Before cleanup:');
    console.log('Stats:', historyManager.getHistoryStats());

    // Clean up expired sessions
    const expiredCount = historyManager.clearExpiredSessions();
    console.log('Cleaned up expired sessions:', expiredCount);

    // Clean up sessions for specific avatar
    const avatarCleanupCount = historyManager.clearSessionsForAvatar('avatar-123');
    console.log('Cleaned up avatar sessions:', avatarCleanupCount);

    console.log('After cleanup:');
    console.log('Stats:', historyManager.getHistoryStats());

  } finally {
    historyManager.destroy();
  }
}

/**
 * Example 4: Performance monitoring and optimization
 */
export async function performanceMonitoringExample(): Promise<void> {
  console.log('=== Performance Monitoring Example ===');

  const historyManager = new ConversationHistoryManager(
    undefined,
    undefined,
    {
      maxTurnsPerSession: 100,
      persistToDatabase: false
    }
  );

  try {
    const sessionId = 'performance-test-session';
    await historyManager.getOrCreateSession(sessionId, 'avatar-performance-test');

    // Simulate a high-volume conversation
    const startTime = Date.now();
    const turnCount = 50;

    for (let i = 0; i < turnCount; i++) {
      const role = i % 2 === 0 ? 'user' : 'assistant';
      await historyManager.addTurn(sessionId, role, `Message ${i}`, {
        processingTimeMs: Math.random() * 200,
        confidence: 0.8 + Math.random() * 0.2
      });

      // Add some entity bindings periodically
      if (i % 10 === 0) {
        historyManager.updateEntityBindings(sessionId, `entity_${i}`, `value_${i}`);
      }
    }

    const totalTime = Date.now() - startTime;
    console.log('Performance metrics:', {
      totalTurns: turnCount,
      totalTimeMs: totalTime,
      averageTimePerTurn: totalTime / turnCount,
      turnsPerSecond: (turnCount / totalTime) * 1000
    });

    // Test retrieval performance
    const retrievalStart = Date.now();
    const history = historyManager.getConversationHistory(sessionId, 20);
    const retrievalTime = Date.now() - retrievalStart;

    console.log('Retrieval performance:', {
      retrievedTurns: history.length,
      retrievalTimeMs: retrievalTime
    });

    // Get comprehensive stats
    const stats = historyManager.getHistoryStats();
    console.log('System stats:', stats);

    const continuity = historyManager.getConversationContinuity(sessionId);
    console.log('Session continuity:', continuity);

  } finally {
    historyManager.destroy();
  }
}

/**
 * Example 5: Database persistence with error handling
 */
export async function databasePersistenceExample(): Promise<void> {
  console.log('=== Database Persistence Example ===');

  const historyManager = new ConversationHistoryManager(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      persistToDatabase: true,
      maxTurnsPerSession: 30
    }
  );

  try {
    const sessionId = 'persistent-session-001';
    const avatarId = 'avatar-persistent-test';
    const userId = 'user-persistent-123';

    // Create session with database persistence
    const session = await historyManager.getOrCreateSession(
      sessionId,
      avatarId,
      'visitor-persistent',
      userId
    );

    console.log('Session created with persistence:', {
      sessionId: session.sessionId,
      isPersisted: session.isPersisted
    });

    // Add turns that will be persisted
    await historyManager.addTurn(sessionId, 'user', 'This conversation should be saved to the database');
    await historyManager.addTurn(sessionId, 'assistant', 'Yes, I\'ll remember this conversation for next time!');

    // Update entity bindings
    historyManager.updateEntityBindings(sessionId, 'persistence_test', 'active');
    historyManager.updateSessionContext(sessionId, 'database_enabled', true);

    console.log('Conversation data added and persisted');

    // Simulate loading the session again (would come from database in real scenario)
    const reloadedSession = await historyManager.getOrCreateSession(
      sessionId,
      avatarId,
      'visitor-persistent',
      userId
    );

    console.log('Reloaded session:', {
      sessionId: reloadedSession.sessionId,
      turnCount: reloadedSession.turns.length,
      isPersisted: reloadedSession.isPersisted
    });

  } catch (error) {
    console.error('Database persistence error:', error);
    console.log('Falling back to in-memory storage...');
  } finally {
    historyManager.destroy();
  }
}

/**
 * Run all examples
 */
export async function runAllExamples(): Promise<void> {
  console.log('Running ConversationHistoryManager Examples...\n');

  try {
    await basicConversationExample();
    console.log('\n');

    await multiSessionVisitorExample();
    console.log('\n');

    await sessionCleanupExample();
    console.log('\n');

    await performanceMonitoringExample();
    console.log('\n');

    await databasePersistenceExample();
    console.log('\n');

    console.log('All examples completed successfully!');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples();
}