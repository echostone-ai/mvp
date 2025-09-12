/**
 * Tests for Jonathan Demo Conversation State Management
 * Task 8: Add conversation state management and persistence
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JonathanDemoConversationState } from '../jonathanDemoConversationState';

// Mock localStorage for browser session persistence
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      upsert: vi.fn(() => ({ error: null })),
      insert: vi.fn(() => ({ error: null })),
      update: vi.fn(() => ({ error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            order: vi.fn(() => ({ data: [], error: null }))
          }))
        }))
      }))
    }))
  }))
}));

describe('JonathanDemoConversationState', () => {
  let conversationState: JonathanDemoConversationState;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    
    conversationState = new JonathanDemoConversationState({
      maxTurnsPerConversation: 10,
      conversationTimeoutMs: 60000, // 1 minute for testing
      autoCleanupIntervalMs: 0, // Disable auto cleanup for tests
      persistToDatabase: false, // Disable database persistence for tests
      enableMemoryAssociation: true
    });
  });

  afterEach(async () => {
    await conversationState.destroy();
  });

  describe('Conversation ID Generation', () => {
    it('should generate unique conversation IDs', () => {
      const id1 = conversationState.generateConversationId();
      const id2 = conversationState.generateConversationId();
      
      expect(id1).toMatch(/^jonathan-demo-\d+-[a-z0-9]+$/);
      expect(id2).toMatch(/^jonathan-demo-\d+-[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should include timestamp and random component', () => {
      const id = conversationState.generateConversationId();
      const parts = id.split('-');
      
      expect(parts[0]).toBe('jonathan');
      expect(parts[1]).toBe('demo');
      expect(parts[2]).toMatch(/^\d+$/); // timestamp
      expect(parts[3]).toMatch(/^[a-z0-9]+$/); // random component
    });
  });

  describe('Session ID Generation', () => {
    it('should generate new session ID when none exists', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const sessionId = conversationState.generateSessionId();
      
      expect(sessionId).toMatch(/^session-\d+-[a-z0-9]+$/);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'jonathan-demo-session-id',
        sessionId
      );
    });

    it('should return existing session ID from localStorage', () => {
      const existingSessionId = 'session-123-abc';
      localStorageMock.getItem.mockReturnValue(existingSessionId);
      
      const sessionId = conversationState.generateSessionId();
      
      expect(sessionId).toBe(existingSessionId);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('Conversation Creation and Management', () => {
    it('should create new conversation for new session', async () => {
      const conversation = await conversationState.getOrCreateConversation(
        'jonathan-demo',
        'test-session-1'
      );

      expect(conversation.id).toMatch(/^jonathan-demo-\d+-[a-z0-9]+$/);
      expect(conversation.sessionId).toBe('test-session-1');
      expect(conversation.avatarId).toBe('jonathan-demo');
      expect(conversation.turns).toHaveLength(0);
      expect(conversation.isActive).toBe(true);
      expect(conversation.isPersisted).toBe(false);
    });

    it('should return existing conversation for same session', async () => {
      const conversation1 = await conversationState.getOrCreateConversation(
        'jonathan-demo',
        'test-session-1'
      );
      
      const conversation2 = await conversationState.getOrCreateConversation(
        'jonathan-demo',
        'test-session-1'
      );

      expect(conversation1.id).toBe(conversation2.id);
      expect(conversation1.sessionId).toBe(conversation2.sessionId);
    });

    it('should create different conversations for different sessions', async () => {
      const conversation1 = await conversationState.getOrCreateConversation(
        'jonathan-demo',
        'test-session-1'
      );
      
      const conversation2 = await conversationState.getOrCreateConversation(
        'jonathan-demo',
        'test-session-2'
      );

      expect(conversation1.id).not.toBe(conversation2.id);
      expect(conversation1.sessionId).not.toBe(conversation2.sessionId);
    });
  });

  describe('Conversation Turns', () => {
    it('should add user turn to conversation', async () => {
      const conversation = await conversationState.getOrCreateConversation(
        'jonathan-demo',
        'test-session-1'
      );

      await conversationState.addConversationTurn(
        conversation.id,
        'user',
        'Hello Jonathan!'
      );

      const updatedConversation = conversationState.getCurrentConversation('test-session-1');
      expect(updatedConversation?.turns).toHaveLength(1);
      expect(updatedConversation?.turns[0].role).toBe('user');
      expect(updatedConversation?.turns[0].content).toBe('Hello Jonathan!');
      expect(updatedConversation?.turns[0].id).toMatch(/^turn-\d+-[a-z0-9]+$/);
    });

    it('should add assistant turn with metadata', async () => {
      const conversation = await conversationState.getOrCreateConversation(
        'jonathan-demo',
        'test-session-1'
      );

      await conversationState.addConversationTurn(
        conversation.id,
        'assistant',
        'Hello! How can I help you?',
        {
          audioLatency: 500,
          expressionsUsed: ['laugh', 'smile'],
          memoryFragmentsReferenced: ['memory-1', 'memory-2'],
          processingTimeMs: 1200
        }
      );

      const updatedConversation = conversationState.getCurrentConversation('test-session-1');
      const turn = updatedConversation?.turns[0];
      
      expect(turn?.role).toBe('assistant');
      expect(turn?.content).toBe('Hello! How can I help you?');
      expect(turn?.audioLatency).toBe(500);
      expect(turn?.expressionsUsed).toEqual(['laugh', 'smile']);
      expect(turn?.memoryFragmentsReferenced).toEqual(['memory-1', 'memory-2']);
      expect(turn?.metadata?.processingTimeMs).toBe(1200);
    });

    it('should enforce max turns limit', async () => {
      const conversation = await conversationState.getOrCreateConversation(
        'jonathan-demo',
        'test-session-1'
      );

      // Add more turns than the limit (10)
      for (let i = 0; i < 15; i++) {
        await conversationState.addConversationTurn(
          conversation.id,
          i % 2 === 0 ? 'user' : 'assistant',
          `Turn ${i}`
        );
      }

      const updatedConversation = conversationState.getCurrentConversation('test-session-1');
      expect(updatedConversation?.turns).toHaveLength(10);
      
      // Should keep the most recent turns
      expect(updatedConversation?.turns[0].content).toBe('Turn 5');
      expect(updatedConversation?.turns[9].content).toBe('Turn 14');
    });

    it('should throw error for non-existent conversation', async () => {
      await expect(
        conversationState.addConversationTurn(
          'non-existent-id',
          'user',
          'Hello'
        )
      ).rejects.toThrow('Conversation not found: non-existent-id');
    });
  });

  describe('Conversation History', () => {
    it('should return conversation history for session', async () => {
      const conversation = await conversationState.getOrCreateConversation(
        'jonathan-demo',
        'test-session-1'
      );

      await conversationState.addConversationTurn(conversation.id, 'user', 'Hello');
      await conversationState.addConversationTurn(conversation.id, 'assistant', 'Hi there!');
      await conversationState.addConversationTurn(conversation.id, 'user', 'How are you?');

      const history = conversationState.getConversationHistory('test-session-1');
      
      expect(history).toHaveLength(3);
      expect(history[0].content).toBe('Hello');
      expect(history[1].content).toBe('Hi there!');
      expect(history[2].content).toBe('How are you?');
    });

    it('should limit conversation history when requested', async () => {
      const conversation = await conversationState.getOrCreateConversation(
        'jonathan-demo',
        'test-session-1'
      );

      for (let i = 0; i < 5; i++) {
        await conversationState.addConversationTurn(conversation.id, 'user', `Message ${i}`);
      }

      const history = conversationState.getConversationHistory('test-session-1', 3);
      
      expect(history).toHaveLength(3);
      expect(history[0].content).toBe('Message 2'); // Last 3 messages
      expect(history[2].content).toBe('Message 4');
    });

    it('should return empty array for non-existent session', () => {
      const history = conversationState.getConversationHistory('non-existent-session');
      expect(history).toEqual([]);
    });
  });

  describe('Conversation State Updates', () => {
    it('should update memory context', async () => {
      const conversation = await conversationState.getOrCreateConversation(
        'jonathan-demo',
        'test-session-1'
      );

      conversationState.updateMemoryContext(conversation.id, 'Updated memory context');
      
      const updatedConversation = conversationState.getCurrentConversation('test-session-1');
      expect(updatedConversation?.memoryContext).toBe('Updated memory context');
    });

    it('should update voice settings', async () => {
      const conversation = await conversationState.getOrCreateConversation(
        'jonathan-demo',
        'test-session-1'
      );

      const voiceSettings = { stability: 0.8, similarity_boost: 0.9 };
      conversationState.updateVoiceSettings(conversation.id, voiceSettings);
      
      const updatedConversation = conversationState.getCurrentConversation('test-session-1');
      expect(updatedConversation?.voiceSettings).toEqual(voiceSettings);
    });

    it('should update expression pack', async () => {
      const conversation = await conversationState.getOrCreateConversation(
        'jonathan-demo',
        'test-session-1'
      );

      conversationState.updateExpressionPack(conversation.id, 'expression-pack-123');
      
      const updatedConversation = conversationState.getCurrentConversation('test-session-1');
      expect(updatedConversation?.expressionPackId).toBe('expression-pack-123');
    });
  });

  describe('Conversation Lifecycle', () => {
    it('should end conversation', async () => {
      const conversation = await conversationState.getOrCreateConversation(
        'jonathan-demo',
        'test-session-1'
      );

      expect(conversation.isActive).toBe(true);

      await conversationState.endConversation(conversation.id);
      
      const updatedConversation = conversationState.getCurrentConversation('test-session-1');
      expect(updatedConversation?.isActive).toBe(false);
    });

    it('should cleanup old conversations', async () => {
      // Create conversation with old timestamp
      const conversation = await conversationState.getOrCreateConversation(
        'jonathan-demo',
        'test-session-1'
      );

      // Manually set old timestamp
      conversation.lastActivity = new Date(Date.now() - 120000).toISOString(); // 2 minutes ago

      await conversationState.cleanupConversations();
      
      // Conversation should be cleaned up
      const clearedConversation = conversationState.getCurrentConversation('test-session-1');
      expect(clearedConversation).toBeNull();
    });
  });

  describe('Conversation Metrics', () => {
    it('should return conversation metrics', async () => {
      // Create multiple conversations with turns
      const conv1 = await conversationState.getOrCreateConversation('jonathan-demo', 'session-1');
      const conv2 = await conversationState.getOrCreateConversation('jonathan-demo', 'session-2');
      
      await conversationState.addConversationTurn(conv1.id, 'user', 'Hello');
      await conversationState.addConversationTurn(conv1.id, 'assistant', 'Hi');
      await conversationState.addConversationTurn(conv2.id, 'user', 'Hey');
      
      await conversationState.endConversation(conv2.id);

      const metrics = conversationState.getConversationMetrics();
      
      expect(metrics.totalConversations).toBe(2);
      expect(metrics.activeConversations).toBe(1);
      expect(metrics.totalTurns).toBe(3);
      expect(metrics.averageTurnsPerConversation).toBe(1.5);
      expect(metrics.averageConversationDuration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent conversation gracefully', () => {
      expect(() => {
        conversationState.updateMemoryContext('non-existent', 'context');
      }).not.toThrow();
      
      expect(() => {
        conversationState.updateVoiceSettings('non-existent', {});
      }).not.toThrow();
      
      expect(() => {
        conversationState.updateExpressionPack('non-existent', 'pack-id');
      }).not.toThrow();
    });

    it('should handle cleanup errors gracefully', async () => {
      // This should not throw even if there are no conversations
      await expect(conversationState.cleanupConversations()).resolves.not.toThrow();
    });
  });
});