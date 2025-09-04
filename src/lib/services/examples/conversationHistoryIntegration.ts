/**
 * Integration Example: ConversationHistoryManager with ConversationService
 * 
 * Demonstrates how the ConversationHistoryManager can be integrated with
 * the existing ConversationService for enhanced conversation tracking.
 */

import { ConversationHistoryManager } from '../conversationHistoryManager';
import { ConversationService } from '../conversationService';

/**
 * Enhanced conversation service that uses ConversationHistoryManager
 * for improved session management and persistence
 */
export class EnhancedConversationService {
  private conversationService: ConversationService;
  private historyManager: ConversationHistoryManager;

  constructor(
    conversationService?: ConversationService,
    historyManager?: ConversationHistoryManager
  ) {
    this.conversationService = conversationService || new ConversationService();
    this.historyManager = historyManager || new ConversationHistoryManager(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        maxTurnsPerSession: 100,
        sessionTimeoutMs: 24 * 60 * 60 * 1000, // 24 hours
        persistToDatabase: true,
        autoCleanupIntervalMs: 60 * 60 * 1000 // 1 hour
      }
    );
  }

  /**
   * Process a conversation with enhanced history tracking
   */
  async processConversation(request: {
    avatarId: string;
    userInput: string;
    sessionId?: string;
    visitorId?: string;
    userId?: string;
    fastMode?: boolean;
  }): Promise<{
    response: string;
    sessionId: string;
    continuity: any;
    historyLength: number;
  }> {
    const sessionId = request.sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Ensure session exists in history manager
    await this.historyManager.getOrCreateSession(
      sessionId,
      request.avatarId,
      request.visitorId,
      request.userId,
      request.fastMode || false
    );

    // Add user turn to history
    await this.historyManager.addTurn(sessionId, 'user', request.userInput);

    // Get conversation history for context
    const conversationHistory = this.historyManager.getConversationHistory(sessionId, 10);

    // Process with existing conversation service
    const conversationResponse = await this.conversationService.processConversation({
      avatarId: request.avatarId,
      userInput: request.userInput,
      sessionId,
      visitorId: request.visitorId,
      fastMode: request.fastMode
    });

    // Add assistant turn to history
    await this.historyManager.addTurn(sessionId, 'assistant', conversationResponse.text, {
      confidence: conversationResponse.confidence,
      processingTimeMs: conversationResponse.processingTimeMs
    });

    // Update entity bindings if any were extracted
    const session = this.historyManager.getSession(sessionId);
    if (session && conversationResponse.session.entityBindings) {
      conversationResponse.session.entityBindings.forEach((value, key) => {
        this.historyManager.updateEntityBindings(sessionId, key, value);
      });
    }

    // Get conversation continuity metrics
    const continuity = this.historyManager.getConversationContinuity(sessionId);

    return {
      response: conversationResponse.text,
      sessionId,
      continuity,
      historyLength: conversationHistory.length
    };
  }

  /**
   * Get conversation history for a session
   */
  getConversationHistory(sessionId: string, limit?: number) {
    return this.historyManager.getConversationHistory(sessionId, limit);
  }

  /**
   * Get session information
   */
  getSessionInfo(sessionId: string) {
    const session = this.historyManager.getSession(sessionId);
    const continuity = this.historyManager.getConversationContinuity(sessionId);
    
    return {
      session,
      continuity,
      exists: !!session
    };
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(maxAgeMs?: number): number {
    return this.historyManager.clearExpiredSessions(maxAgeMs);
  }

  /**
   * Get system statistics
   */
  getSystemStats() {
    const historyStats = this.historyManager.getHistoryStats();
    const conversationStats = this.conversationService.getPerformanceStats();

    return {
      history: historyStats,
      conversation: conversationStats,
      combined: {
        totalSessions: historyStats.activeSessions,
        averageSessionDuration: historyStats.averageSessionDuration,
        totalTurns: historyStats.totalTurns
      }
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.historyManager.destroy();
  }
}

/**
 * Example usage of the enhanced conversation service
 */
export async function enhancedConversationExample(): Promise<void> {
  console.log('=== Enhanced Conversation Service Example ===');

  const enhancedService = new EnhancedConversationService();

  try {
    // Start a conversation
    const response1 = await enhancedService.processConversation({
      avatarId: 'avatar-therapist-123',
      userInput: 'Hello, I\'ve been feeling anxious lately',
      visitorId: 'visitor-patient-456',
      userId: 'user-789'
    });

    console.log('First response:', {
      response: response1.response,
      sessionId: response1.sessionId,
      continuity: response1.continuity
    });

    // Continue the conversation
    const response2 = await enhancedService.processConversation({
      avatarId: 'avatar-therapist-123',
      userInput: 'It started about a week ago when I got a new job',
      sessionId: response1.sessionId,
      visitorId: 'visitor-patient-456',
      userId: 'user-789'
    });

    console.log('Second response:', {
      response: response2.response,
      continuity: response2.continuity
    });

    // Get conversation history
    const history = enhancedService.getConversationHistory(response1.sessionId);
    console.log('Conversation history:', history.map(turn => ({
      role: turn.role,
      content: turn.content.substring(0, 50) + '...',
      timestamp: turn.timestamp
    })));

    // Get session info
    const sessionInfo = enhancedService.getSessionInfo(response1.sessionId);
    console.log('Session info:', {
      exists: sessionInfo.exists,
      turnCount: sessionInfo.continuity?.turnCount,
      entityBindings: sessionInfo.continuity?.entityBindings
    });

    // Get system stats
    const stats = enhancedService.getSystemStats();
    console.log('System stats:', stats);

  } catch (error) {
    console.error('Error in enhanced conversation example:', error);
  } finally {
    enhancedService.destroy();
  }
}

/**
 * Example of multi-user conversation management
 */
export async function multiUserConversationExample(): Promise<void> {
  console.log('=== Multi-User Conversation Example ===');

  const enhancedService = new EnhancedConversationService();

  try {
    const users = [
      { userId: 'user-alice', visitorId: 'visitor-alice', avatarId: 'avatar-coach-123' },
      { userId: 'user-bob', visitorId: 'visitor-bob', avatarId: 'avatar-coach-123' },
      { userId: 'user-charlie', visitorId: 'visitor-charlie', avatarId: 'avatar-therapist-456' }
    ];

    const sessions: string[] = [];

    // Start conversations for multiple users
    for (const user of users) {
      const response = await enhancedService.processConversation({
        ...user,
        userInput: `Hello, I'm ${user.userId.split('-')[1]}. I'd like to start a session.`
      });
      
      sessions.push(response.sessionId);
      console.log(`Started session for ${user.userId}: ${response.sessionId}`);
    }

    // Continue conversations
    for (let i = 0; i < sessions.length; i++) {
      const user = users[i];
      await enhancedService.processConversation({
        ...user,
        sessionId: sessions[i],
        userInput: `This is my second message in the conversation.`
      });
    }

    // Show system stats
    const stats = enhancedService.getSystemStats();
    console.log('Multi-user system stats:', {
      activeSessions: stats.history.activeSessions,
      totalTurns: stats.history.totalTurns,
      averageSessionDuration: stats.history.averageSessionDuration
    });

    // Cleanup demonstration
    console.log('Cleaning up expired sessions...');
    const cleaned = enhancedService.cleanupExpiredSessions(0); // Clean all for demo
    console.log(`Cleaned up ${cleaned} sessions`);

  } catch (error) {
    console.error('Error in multi-user conversation example:', error);
  } finally {
    enhancedService.destroy();
  }
}

/**
 * Run all integration examples
 */
export async function runIntegrationExamples(): Promise<void> {
  console.log('Running ConversationHistoryManager Integration Examples...\n');

  try {
    await enhancedConversationExample();
    console.log('\n');

    await multiUserConversationExample();
    console.log('\n');

    console.log('All integration examples completed successfully!');
  } catch (error) {
    console.error('Error running integration examples:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runIntegrationExamples();
}