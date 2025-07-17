/**
 * Shared conversation state manager for real-time conversational AI
 * Manages conversation states across different API endpoints
 */

export interface ConversationState {
  id: string;
  userId: string;
  voiceId: string;
  agentId?: string;
  status: 'idle' | 'listening' | 'processing' | 'speaking' | 'error';
  created_at: Date;
  last_activity: Date;
  context: string[];
  interruption_count: number;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  type: 'audio_chunk' | 'text_chunk' | 'user_input' | 'system_message' | 'error';
  data: any;
  timestamp: Date;
}

class ConversationStateManager {
  private conversationStates = new Map<string, ConversationState>();
  private conversationMessages = new Map<string, ConversationMessage[]>();
  private cleanupInterval: NodeJS.Timeout;
  private readonly CONVERSATION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_MESSAGES_PER_CONVERSATION = 100;
  private readonly MAX_CONTEXT_ITEMS = 50;

  constructor() {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveConversations();
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  /**
   * Create a new conversation state
   */
  createConversation(
    conversationId: string,
    userId: string,
    voiceId: string,
    agentId?: string
  ): ConversationState {
    const state: ConversationState = {
      id: conversationId,
      userId,
      voiceId,
      agentId,
      status: 'idle',
      created_at: new Date(),
      last_activity: new Date(),
      context: [],
      interruption_count: 0,
    };

    this.conversationStates.set(conversationId, state);
    this.conversationMessages.set(conversationId, []);

    return state;
  }

  /**
   * Get conversation state
   */
  getConversation(conversationId: string): ConversationState | null {
    return this.conversationStates.get(conversationId) || null;
  }

  /**
   * Update conversation status
   */
  updateConversationStatus(
    conversationId: string,
    status: ConversationState['status']
  ): boolean {
    const state = this.conversationStates.get(conversationId);
    if (!state) return false;

    state.status = status;
    state.last_activity = new Date();
    return true;
  }

  /**
   * Add context to conversation
   */
  addContext(conversationId: string, context: string | string[]): boolean {
    const state = this.conversationStates.get(conversationId);
    if (!state) return false;

    if (Array.isArray(context)) {
      state.context.push(...context);
    } else {
      state.context.push(context);
    }

    // Keep only last N context items to prevent memory issues
    if (state.context.length > this.MAX_CONTEXT_ITEMS) {
      state.context = state.context.slice(-this.MAX_CONTEXT_ITEMS);
    }

    state.last_activity = new Date();
    return true;
  }

  /**
   * Handle interruption
   */
  handleInterruption(conversationId: string): boolean {
    const state = this.conversationStates.get(conversationId);
    if (!state) return false;

    state.interruption_count++;
    state.status = 'listening';
    state.last_activity = new Date();
    return true;
  }

  /**
   * Add message to conversation
   */
  addMessage(
    conversationId: string,
    type: ConversationMessage['type'],
    data: any
  ): boolean {
    const messages = this.conversationMessages.get(conversationId);
    if (!messages) return false;

    const message: ConversationMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversation_id: conversationId,
      type,
      data,
      timestamp: new Date(),
    };

    messages.push(message);

    // Keep only last N messages to prevent memory issues
    if (messages.length > this.MAX_MESSAGES_PER_CONVERSATION) {
      messages.splice(0, messages.length - this.MAX_MESSAGES_PER_CONVERSATION);
    }

    // Update conversation activity
    const state = this.conversationStates.get(conversationId);
    if (state) {
      state.last_activity = new Date();
    }

    return true;
  }

  /**
   * Get recent messages for conversation
   */
  getMessages(conversationId: string, limit?: number): ConversationMessage[] {
    const messages = this.conversationMessages.get(conversationId) || [];
    if (limit && limit > 0) {
      return messages.slice(-limit);
    }
    return [...messages];
  }

  /**
   * Get all active conversations
   */
  getActiveConversations(): ConversationState[] {
    return Array.from(this.conversationStates.values());
  }

  /**
   * Get conversations for specific user
   */
  getUserConversations(userId: string): ConversationState[] {
    return Array.from(this.conversationStates.values())
      .filter(state => state.userId === userId);
  }

  /**
   * Delete conversation
   */
  deleteConversation(conversationId: string): boolean {
    const deleted = this.conversationStates.delete(conversationId);
    this.conversationMessages.delete(conversationId);
    return deleted;
  }

  /**
   * Delete all conversations for user
   */
  deleteUserConversations(userId: string): number {
    let deletedCount = 0;
    for (const [id, state] of this.conversationStates) {
      if (state.userId === userId) {
        this.conversationStates.delete(id);
        this.conversationMessages.delete(id);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  /**
   * Check if conversation exists
   */
  hasConversation(conversationId: string): boolean {
    return this.conversationStates.has(conversationId);
  }

  /**
   * Get conversation statistics
   */
  getConversationStats(conversationId: string): {
    message_count: number;
    context_length: number;
    interruption_count: number;
    duration_minutes: number;
    status: string;
  } | null {
    const state = this.conversationStates.get(conversationId);
    const messages = this.conversationMessages.get(conversationId);
    
    if (!state || !messages) return null;

    const durationMs = new Date().getTime() - state.created_at.getTime();
    const durationMinutes = Math.round(durationMs / (1000 * 60));

    return {
      message_count: messages.length,
      context_length: state.context.length,
      interruption_count: state.interruption_count,
      duration_minutes: durationMinutes,
      status: state.status,
    };
  }

  /**
   * Update conversation from WebSocket message
   */
  updateFromWebSocketMessage(
    conversationId: string,
    messageType: string,
    messageData: any
  ): boolean {
    const state = this.conversationStates.get(conversationId);
    if (!state) return false;

    // Update status based on message type
    switch (messageType) {
      case 'audio_chunk':
        state.status = 'speaking';
        this.addMessage(conversationId, 'audio_chunk', messageData);
        break;
      case 'text_chunk':
        if (messageData?.text) {
          state.context.push(`Assistant: ${messageData.text}`);
          this.addMessage(conversationId, 'text_chunk', messageData);
        }
        break;
      case 'user_input':
        state.status = 'processing';
        if (messageData?.text) {
          state.context.push(`User: ${messageData.text}`);
        }
        this.addMessage(conversationId, 'user_input', messageData);
        break;
      case 'conversation_end':
        state.status = 'idle';
        this.addMessage(conversationId, 'system_message', { message: 'Conversation ended' });
        break;
      case 'error':
        state.status = 'error';
        this.addMessage(conversationId, 'error', messageData);
        break;
    }

    // Keep context within limits
    if (state.context.length > this.MAX_CONTEXT_ITEMS) {
      state.context = state.context.slice(-this.MAX_CONTEXT_ITEMS);
    }

    state.last_activity = new Date();
    return true;
  }

  /**
   * Clean up inactive conversations
   */
  private cleanupInactiveConversations(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [conversationId, state] of this.conversationStates) {
      const inactiveTime = now.getTime() - state.last_activity.getTime();
      
      if (inactiveTime > this.CONVERSATION_TIMEOUT) {
        console.log(`Cleaning up inactive conversation: ${conversationId}`);
        this.deleteConversation(conversationId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} inactive conversations`);
    }
  }

  /**
   * Cleanup manager resources
   */
  cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.conversationStates.clear();
    this.conversationMessages.clear();
  }
}

// Create singleton instance
const conversationStateManager = new ConversationStateManager();

export default conversationStateManager;
export { ConversationStateManager };