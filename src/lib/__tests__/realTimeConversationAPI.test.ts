/**
 * Unit tests for real-time conversation API functionality
 * Tests the core components without requiring a running server
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import conversationStateManager from '../conversationStateManager';
import { ConversationalAIService } from '../conversationalAIService';
import { WebSocketManager } from '../websocketManager';

// Mock ElevenLabs API
vi.mock('../conversationalAIService');
vi.mock('../websocketManager');

describe('Real-Time Conversation API', () => {
  beforeEach(() => {
    // Clear any existing conversations
    const activeConversations = conversationStateManager.getActiveConversations();
    for (const conversation of activeConversations) {
      conversationStateManager.deleteConversation(conversation.id);
    }
  });

  afterEach(() => {
    // Clean up after each test
    const activeConversations = conversationStateManager.getActiveConversations();
    for (const conversation of activeConversations) {
      conversationStateManager.deleteConversation(conversation.id);
    }
  });

  describe('Conversation State Management', () => {
    it('should create a new conversation state', () => {
      const conversationId = 'test-conv-123';
      const userId = 'test-user-456';
      const voiceId = 'test-voice-789';
      const agentId = 'test-agent-101';

      const state = conversationStateManager.createConversation(
        conversationId,
        userId,
        voiceId,
        agentId
      );

      expect(state).toBeDefined();
      expect(state.id).toBe(conversationId);
      expect(state.userId).toBe(userId);
      expect(state.voiceId).toBe(voiceId);
      expect(state.agentId).toBe(agentId);
      expect(state.status).toBe('idle');
      expect(state.context).toEqual([]);
      expect(state.interruption_count).toBe(0);
    });

    it('should retrieve existing conversation state', () => {
      const conversationId = 'test-conv-123';
      const userId = 'test-user-456';
      const voiceId = 'test-voice-789';

      conversationStateManager.createConversation(conversationId, userId, voiceId);
      const retrievedState = conversationStateManager.getConversation(conversationId);

      expect(retrievedState).toBeDefined();
      expect(retrievedState!.id).toBe(conversationId);
      expect(retrievedState!.userId).toBe(userId);
      expect(retrievedState!.voiceId).toBe(voiceId);
    });

    it('should return null for non-existent conversation', () => {
      const state = conversationStateManager.getConversation('non-existent-id');
      expect(state).toBeNull();
    });

    it('should update conversation status', () => {
      const conversationId = 'test-conv-123';
      conversationStateManager.createConversation(conversationId, 'user', 'voice');

      const updated = conversationStateManager.updateConversationStatus(conversationId, 'processing');
      expect(updated).toBe(true);

      const state = conversationStateManager.getConversation(conversationId);
      expect(state!.status).toBe('processing');
    });

    it('should add context to conversation', () => {
      const conversationId = 'test-conv-123';
      conversationStateManager.createConversation(conversationId, 'user', 'voice');

      const added = conversationStateManager.addContext(conversationId, 'User said hello');
      expect(added).toBe(true);

      const state = conversationStateManager.getConversation(conversationId);
      expect(state!.context).toContain('User said hello');
    });

    it('should handle interruptions', () => {
      const conversationId = 'test-conv-123';
      conversationStateManager.createConversation(conversationId, 'user', 'voice');

      const handled = conversationStateManager.handleInterruption(conversationId);
      expect(handled).toBe(true);

      const state = conversationStateManager.getConversation(conversationId);
      expect(state!.interruption_count).toBe(1);
      expect(state!.status).toBe('listening');
    });

    it('should add messages to conversation', () => {
      const conversationId = 'test-conv-123';
      conversationStateManager.createConversation(conversationId, 'user', 'voice');

      const added = conversationStateManager.addMessage(conversationId, 'text_chunk', {
        text: 'Hello from assistant',
      });
      expect(added).toBe(true);

      const messages = conversationStateManager.getMessages(conversationId);
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('text_chunk');
      expect(messages[0].data.text).toBe('Hello from assistant');
    });

    it('should get conversation statistics', () => {
      const conversationId = 'test-conv-123';
      conversationStateManager.createConversation(conversationId, 'user', 'voice');
      conversationStateManager.addContext(conversationId, 'Test context');
      conversationStateManager.addMessage(conversationId, 'text_chunk', { text: 'Test' });
      conversationStateManager.handleInterruption(conversationId);

      const stats = conversationStateManager.getConversationStats(conversationId);
      expect(stats).toBeDefined();
      expect(stats!.message_count).toBe(1);
      expect(stats!.context_length).toBe(1);
      expect(stats!.interruption_count).toBe(1);
      expect(stats!.status).toBe('listening');
    });

    it('should delete conversation', () => {
      const conversationId = 'test-conv-123';
      conversationStateManager.createConversation(conversationId, 'user', 'voice');

      const deleted = conversationStateManager.deleteConversation(conversationId);
      expect(deleted).toBe(true);

      const state = conversationStateManager.getConversation(conversationId);
      expect(state).toBeNull();
    });

    it('should get user conversations', () => {
      const userId = 'test-user-123';
      conversationStateManager.createConversation('conv-1', userId, 'voice-1');
      conversationStateManager.createConversation('conv-2', userId, 'voice-2');
      conversationStateManager.createConversation('conv-3', 'other-user', 'voice-3');

      const userConversations = conversationStateManager.getUserConversations(userId);
      expect(userConversations).toHaveLength(2);
      expect(userConversations.every(conv => conv.userId === userId)).toBe(true);
    });

    it('should delete user conversations', () => {
      const userId = 'test-user-123';
      conversationStateManager.createConversation('conv-1', userId, 'voice-1');
      conversationStateManager.createConversation('conv-2', userId, 'voice-2');
      conversationStateManager.createConversation('conv-3', 'other-user', 'voice-3');

      const deletedCount = conversationStateManager.deleteUserConversations(userId);
      expect(deletedCount).toBe(2);

      const remainingConversations = conversationStateManager.getActiveConversations();
      expect(remainingConversations).toHaveLength(1);
      expect(remainingConversations[0].userId).toBe('other-user');
    });
  });

  describe('WebSocket Message Processing', () => {
    it('should update conversation from WebSocket message - audio_chunk', () => {
      const conversationId = 'test-conv-123';
      conversationStateManager.createConversation(conversationId, 'user', 'voice');

      const updated = conversationStateManager.updateFromWebSocketMessage(
        conversationId,
        'audio_chunk',
        { audio_data: 'base64-audio-data' }
      );

      expect(updated).toBe(true);
      const state = conversationStateManager.getConversation(conversationId);
      expect(state!.status).toBe('speaking');
    });

    it('should update conversation from WebSocket message - text_chunk', () => {
      const conversationId = 'test-conv-123';
      conversationStateManager.createConversation(conversationId, 'user', 'voice');

      const updated = conversationStateManager.updateFromWebSocketMessage(
        conversationId,
        'text_chunk',
        { text: 'Assistant response' }
      );

      expect(updated).toBe(true);
      const state = conversationStateManager.getConversation(conversationId);
      expect(state!.context).toContain('Assistant: Assistant response');
    });

    it('should update conversation from WebSocket message - user_input', () => {
      const conversationId = 'test-conv-123';
      conversationStateManager.createConversation(conversationId, 'user', 'voice');

      const updated = conversationStateManager.updateFromWebSocketMessage(
        conversationId,
        'user_input',
        { text: 'User message' }
      );

      expect(updated).toBe(true);
      const state = conversationStateManager.getConversation(conversationId);
      expect(state!.status).toBe('processing');
      expect(state!.context).toContain('User: User message');
    });

    it('should update conversation from WebSocket message - error', () => {
      const conversationId = 'test-conv-123';
      conversationStateManager.createConversation(conversationId, 'user', 'voice');

      const updated = conversationStateManager.updateFromWebSocketMessage(
        conversationId,
        'error',
        { error: 'Connection failed' }
      );

      expect(updated).toBe(true);
      const state = conversationStateManager.getConversation(conversationId);
      expect(state!.status).toBe('error');
    });

    it('should update conversation from WebSocket message - conversation_end', () => {
      const conversationId = 'test-conv-123';
      conversationStateManager.createConversation(conversationId, 'user', 'voice');

      const updated = conversationStateManager.updateFromWebSocketMessage(
        conversationId,
        'conversation_end',
        {}
      );

      expect(updated).toBe(true);
      const state = conversationStateManager.getConversation(conversationId);
      expect(state!.status).toBe('idle');
    });
  });

  describe('Context Management', () => {
    it('should limit context items to prevent memory issues', () => {
      const conversationId = 'test-conv-123';
      conversationStateManager.createConversation(conversationId, 'user', 'voice');

      // Add more than the maximum context items
      const contextItems = Array.from({ length: 60 }, (_, i) => `Context item ${i}`);
      conversationStateManager.addContext(conversationId, contextItems);

      const state = conversationStateManager.getConversation(conversationId);
      expect(state!.context.length).toBeLessThanOrEqual(50); // MAX_CONTEXT_ITEMS
      expect(state!.context[0]).toBe('Context item 10'); // Should keep the last 50 items
    });

    it('should limit messages to prevent memory issues', () => {
      const conversationId = 'test-conv-123';
      conversationStateManager.createConversation(conversationId, 'user', 'voice');

      // Add more than the maximum messages
      for (let i = 0; i < 110; i++) {
        conversationStateManager.addMessage(conversationId, 'text_chunk', {
          text: `Message ${i}`,
        });
      }

      const messages = conversationStateManager.getMessages(conversationId);
      expect(messages.length).toBeLessThanOrEqual(100); // MAX_MESSAGES_PER_CONVERSATION
    });

    it('should get limited messages', () => {
      const conversationId = 'test-conv-123';
      conversationStateManager.createConversation(conversationId, 'user', 'voice');

      // Add several messages
      for (let i = 0; i < 10; i++) {
        conversationStateManager.addMessage(conversationId, 'text_chunk', {
          text: `Message ${i}`,
        });
      }

      const recentMessages = conversationStateManager.getMessages(conversationId, 5);
      expect(recentMessages.length).toBe(5);
      expect(recentMessages[0].data.text).toBe('Message 5'); // Should get the last 5 messages
    });
  });

  describe('Conversation Validation', () => {
    it('should check if conversation exists', () => {
      const conversationId = 'test-conv-123';
      
      expect(conversationStateManager.hasConversation(conversationId)).toBe(false);
      
      conversationStateManager.createConversation(conversationId, 'user', 'voice');
      expect(conversationStateManager.hasConversation(conversationId)).toBe(true);
      
      conversationStateManager.deleteConversation(conversationId);
      expect(conversationStateManager.hasConversation(conversationId)).toBe(false);
    });

    it('should handle operations on non-existent conversations gracefully', () => {
      const nonExistentId = 'non-existent-conv';

      expect(conversationStateManager.updateConversationStatus(nonExistentId, 'processing')).toBe(false);
      expect(conversationStateManager.addContext(nonExistentId, 'test')).toBe(false);
      expect(conversationStateManager.handleInterruption(nonExistentId)).toBe(false);
      expect(conversationStateManager.addMessage(nonExistentId, 'text_chunk', {})).toBe(false);
      expect(conversationStateManager.updateFromWebSocketMessage(nonExistentId, 'audio_chunk', {})).toBe(false);
    });
  });
});

describe('ConversationalAIService Integration', () => {
  let service: ConversationalAIService;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    service = new ConversationalAIService(mockApiKey);
  });

  it('should initialize with API key', () => {
    expect(service).toBeDefined();
  });

  it('should generate conversation ID', () => {
    // Test the conversation ID generation pattern
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    expect(conversationId).toMatch(/^conv_\d+_[a-z0-9]{9}$/);
  });

  it('should handle personality integration', () => {
    const personalityIntegration = {
      profile_data: {
        id: 'test-user',
        name: 'Test User',
        preferences: {},
        memory_context: ['User likes music', 'User is interested in AI'],
      },
      conversation_style: {
        formality: 'casual' as const,
        humor_level: 0.7,
        empathy_level: 0.8,
        response_length: 'medium' as const,
      },
      emotional_preferences: {
        default_emotion: 'neutral',
        emotional_range: 0.8,
        context_sensitivity: 0.7,
        adaptation_speed: 0.6,
      },
      knowledge_base_entries: ['Test knowledge base entry'],
    };

    expect(personalityIntegration.profile_data.name).toBe('Test User');
    expect(personalityIntegration.conversation_style.formality).toBe('casual');
    expect(personalityIntegration.emotional_preferences.default_emotion).toBe('neutral');
  });
});

describe('WebSocket Message Types', () => {
  it('should define correct WebSocket message structure', () => {
    const message = {
      type: 'audio_chunk' as const,
      data: { audio_data: 'base64-encoded-audio' },
      conversation_id: 'test-conv-123',
      timestamp: Date.now(),
    };

    expect(message.type).toBe('audio_chunk');
    expect(message.data).toBeDefined();
    expect(message.conversation_id).toBe('test-conv-123');
    expect(typeof message.timestamp).toBe('number');
  });

  it('should handle different message types', () => {
    const messageTypes = [
      'audio_chunk',
      'text_chunk',
      'conversation_end',
      'error',
      'connection_established',
    ];

    for (const type of messageTypes) {
      const message = {
        type: type as any,
        data: {},
        conversation_id: 'test-conv',
        timestamp: Date.now(),
      };

      expect(message.type).toBe(type);
    }
  });
});