/**
 * Integration tests for Task 8: Conversation State Management
 * Tests the integration of conversation state management in jonathan-demo
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jonathanConversationState } from '@/lib/services/jonathanDemoConversationState';

// Mock dependencies
vi.mock('@/lib/globalAudioManager', () => ({
  globalAudioManager: {
    playAudio: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('@/lib/streamingUtils', () => ({
  stopAllAudio: vi.fn().mockResolvedValue(undefined),
  createStreamingAudioManager: vi.fn(() => ({
    addSentence: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    isPlaying: vi.fn().mockReturnValue(false)
  })),
  splitIntoSentences: vi.fn((text: string) => [text])
}));

vi.mock('@/lib/enhancedVoiceConfig', () => ({
  getEnhancedVoiceConfig: vi.fn(() => ({
    voice_settings: {
      stability: 0.70,
      similarity_boost: 0.85,
      style: 0.00,
      use_speaker_boost: false
    }
  }))
}));

vi.mock('@/lib/services/expressionPackService', () => ({
  ExpressionPackService: {
    getJonathanDemoExpressionPack: vi.fn().mockResolvedValue(null),
    createMockExpressionPack: vi.fn(() => ({
      expressions: [],
      buffers: new Map()
    }))
  }
}));

vi.mock('@/lib/jonathanDemoMemoryService', () => ({
  JonathanDemoMemoryService: {
    warmMemoryCache: vi.fn().mockResolvedValue(undefined),
    getComprehensiveMemoryContext: vi.fn().mockResolvedValue({
      memoryContext: 'Test memory context',
      continuityContext: 'Test continuity context',
      retrievalTimeMs: 150,
      memoryCount: 3,
      totalTokens: 200,
      cacheHit: true,
      fallbackUsed: false
    }),
    storeConversationTurnAsync: vi.fn().mockResolvedValue(undefined)
  }
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('Task 8: Conversation State Management Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(async () => {
    // Clean up any conversations created during tests
    await jonathanConversationState.cleanupConversations();
  });

  describe('Conversation ID Generation and Persistence', () => {
    it('should generate unique conversation IDs with proper format', () => {
      const id1 = jonathanConversationState.generateConversationId();
      const id2 = jonathanConversationState.generateConversationId();
      
      // Should follow format: jonathan-demo-{timestamp}-{random}
      expect(id1).toMatch(/^jonathan-demo-\d+-[a-z0-9]+$/);
      expect(id2).toMatch(/^jonathan-demo-\d+-[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should persist session ID across browser sessions', () => {
      // First call - no existing session
      localStorageMock.getItem.mockReturnValue(null);
      const sessionId1 = jonathanConversationState.generateSessionId();
      
      expect(sessionId1).toMatch(/^session-\d+-[a-z0-9]+$/);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'jonathan-demo-session-id',
        sessionId1
      );

      // Second call - existing session
      localStorageMock.getItem.mockReturnValue(sessionId1);
      const sessionId2 = jonathanConversationState.generateSessionId();
      
      expect(sessionId2).toBe(sessionId1);
    });

    it('should create conversation with proper session association', async () => {
      const sessionId = 'test-session-123';
      const conversation = await jonathanConversationState.getOrCreateConversation(
        'jonathan-demo',
        sessionId
      );

      expect(conversation.sessionId).toBe(sessionId);
      expect(conversation.avatarId).toBe('jonathan-demo');
      expect(conversation.isActive).toBe(true);
      expect(conversation.turns).toHaveLength(0);
    });
  });

  describe('Conversation History Management', () => {
    it('should track conversation turns with proper memory fragment association', async () => {
      const conversation = await jonathanConversationState.getOrCreateConversation(
        'jonathan-demo',
        'test-session'
      );

      // Add user turn
      await jonathanConversationState.addConversationTurn(
        conversation.id,
        'user',
        'Tell me about your dog Romeo'
      );

      // Add assistant turn with metadata
      await jonathanConversationState.addConversationTurn(
        conversation.id,
        'assistant',
        'Romeo is my golden retriever who loves to play fetch!',
        {
          audioLatency: 450,
          expressionsUsed: ['laugh', 'smile'],
          memoryFragmentsReferenced: ['memory-fragment-1', 'memory-fragment-2'],
          processingTimeMs: 1200,
          confidence: 0.95
        }
      );

      const history = jonathanConversationState.getConversationHistory('test-session');
      
      expect(history).toHaveLength(2);
      
      // Verify user turn
      expect(history[0].role).toBe('user');
      expect(history[0].content).toBe('Tell me about your dog Romeo');
      expect(history[0].id).toMatch(/^turn-\d+-[a-z0-9]+$/);
      
      // Verify assistant turn with metadata
      expect(history[1].role).toBe('assistant');
      expect(history[1].content).toBe('Romeo is my golden retriever who loves to play fetch!');
      expect(history[1].audioLatency).toBe(450);
      expect(history[1].expressionsUsed).toEqual(['laugh', 'smile']);
      expect(history[1].memoryFragmentsReferenced).toEqual(['memory-fragment-1', 'memory-fragment-2']);
      expect(history[1].metadata?.processingTimeMs).toBe(1200);
      expect(history[1].metadata?.confidence).toBe(0.95);
    });

    it('should maintain conversation continuity across multiple turns', async () => {
      const conversation = await jonathanConversationState.getOrCreateConversation(
        'jonathan-demo',
        'continuity-session'
      );

      // Simulate a multi-turn conversation
      const turns = [
        { role: 'user' as const, content: 'Hi Jonathan!' },
        { role: 'assistant' as const, content: 'Hello! How can I help you today?' },
        { role: 'user' as const, content: 'Tell me about your writing' },
        { role: 'assistant' as const, content: 'I love writing about technology and life experiences.' },
        { role: 'user' as const, content: 'What\'s your latest project?' },
        { role: 'assistant' as const, content: 'I\'m working on a book about AI and human creativity.' }
      ];

      for (const turn of turns) {
        await jonathanConversationState.addConversationTurn(
          conversation.id,
          turn.role,
          turn.content
        );
      }

      const history = jonathanConversationState.getConversationHistory('continuity-session');
      
      expect(history).toHaveLength(6);
      expect(history.map(t => t.content)).toEqual(turns.map(t => t.content));
      
      // Verify conversation state is updated
      const currentConversation = jonathanConversationState.getCurrentConversation('continuity-session');
      expect(currentConversation?.turns).toHaveLength(6);
      expect(currentConversation?.lastActivity).toBeDefined();
    });

    it('should limit conversation history when requested', async () => {
      const conversation = await jonathanConversationState.getOrCreateConversation(
        'jonathan-demo',
        'limit-session'
      );

      // Add 10 turns
      for (let i = 0; i < 10; i++) {
        await jonathanConversationState.addConversationTurn(
          conversation.id,
          i % 2 === 0 ? 'user' : 'assistant',
          `Turn ${i}`
        );
      }

      // Get limited history
      const limitedHistory = jonathanConversationState.getConversationHistory('limit-session', 5);
      
      expect(limitedHistory).toHaveLength(5);
      expect(limitedHistory[0].content).toBe('Turn 5'); // Last 5 turns
      expect(limitedHistory[4].content).toBe('Turn 9');
    });
  });

  describe('Conversation Cleanup and Archival', () => {
    it('should enforce maximum turns per conversation', async () => {
      // Create conversation state with low turn limit for testing
      const testConversationState = new (await import('@/lib/services/jonathanDemoConversationState')).JonathanDemoConversationState({
        maxTurnsPerConversation: 5,
        conversationTimeoutMs: 60000,
        autoCleanupIntervalMs: 0,
        persistToDatabase: false
      });

      const conversation = await testConversationState.getOrCreateConversation(
        'jonathan-demo',
        'limit-test-session'
      );

      // Add more turns than the limit
      for (let i = 0; i < 8; i++) {
        await testConversationState.addConversationTurn(
          conversation.id,
          i % 2 === 0 ? 'user' : 'assistant',
          `Turn ${i}`
        );
      }

      const history = testConversationState.getConversationHistory('limit-test-session');
      
      // Should only keep the most recent 5 turns
      expect(history).toHaveLength(5);
      expect(history[0].content).toBe('Turn 3'); // Oldest kept turn
      expect(history[4].content).toBe('Turn 7'); // Newest turn

      await testConversationState.destroy();
    });

    it('should end conversations properly', async () => {
      const conversation = await jonathanConversationState.getOrCreateConversation(
        'jonathan-demo',
        'end-test-session'
      );

      expect(conversation.isActive).toBe(true);

      await jonathanConversationState.endConversation(conversation.id);
      
      const endedConversation = jonathanConversationState.getCurrentConversation('end-test-session');
      expect(endedConversation?.isActive).toBe(false);
    });

    it('should cleanup old conversations', async () => {
      // Create conversation state with short timeout for testing
      const testConversationState = new (await import('@/lib/services/jonathanDemoConversationState')).JonathanDemoConversationState({
        maxTurnsPerConversation: 50,
        conversationTimeoutMs: 1000, // 1 second timeout
        autoCleanupIntervalMs: 0,
        persistToDatabase: false
      });

      const conversation = await testConversationState.getOrCreateConversation(
        'jonathan-demo',
        'cleanup-test-session'
      );

      // Manually set old timestamp
      const oldConversation = testConversationState.getCurrentConversation('cleanup-test-session');
      if (oldConversation) {
        oldConversation.lastActivity = new Date(Date.now() - 2000).toISOString(); // 2 seconds ago
      }

      // Wait for timeout and cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      await testConversationState.cleanupConversations();
      
      const cleanedConversation = testConversationState.getCurrentConversation('cleanup-test-session');
      expect(cleanedConversation).toBeNull();

      await testConversationState.destroy();
    });
  });

  describe('Conversation State Updates', () => {
    it('should update conversation memory context', async () => {
      const conversation = await jonathanConversationState.getOrCreateConversation(
        'jonathan-demo',
        'memory-update-session'
      );

      const memoryContext = 'User likes dogs, especially golden retrievers. Lives in Sofia.';
      jonathanConversationState.updateMemoryContext(conversation.id, memoryContext);
      
      const updatedConversation = jonathanConversationState.getCurrentConversation('memory-update-session');
      expect(updatedConversation?.memoryContext).toBe(memoryContext);
    });

    it('should update conversation voice settings', async () => {
      const conversation = await jonathanConversationState.getOrCreateConversation(
        'jonathan-demo',
        'voice-update-session'
      );

      const voiceSettings = {
        stability: 0.8,
        similarity_boost: 0.9,
        style: 0.1,
        use_speaker_boost: true
      };
      
      jonathanConversationState.updateVoiceSettings(conversation.id, voiceSettings);
      
      const updatedConversation = jonathanConversationState.getCurrentConversation('voice-update-session');
      expect(updatedConversation?.voiceSettings).toEqual(voiceSettings);
    });

    it('should update conversation expression pack', async () => {
      const conversation = await jonathanConversationState.getOrCreateConversation(
        'jonathan-demo',
        'expression-update-session'
      );

      const expressionPackId = 'jonathan-expressions-v2';
      jonathanConversationState.updateExpressionPack(conversation.id, expressionPackId);
      
      const updatedConversation = jonathanConversationState.getCurrentConversation('expression-update-session');
      expect(updatedConversation?.expressionPackId).toBe(expressionPackId);
    });
  });

  describe('Conversation Metrics', () => {
    it('should provide accurate conversation metrics', async () => {
      // Create a fresh conversation state instance for this test to avoid interference
      const testConversationState = new (await import('@/lib/services/jonathanDemoConversationState')).JonathanDemoConversationState({
        maxTurnsPerConversation: 50,
        conversationTimeoutMs: 60000,
        autoCleanupIntervalMs: 0,
        persistToDatabase: false
      });

      // Create multiple conversations
      const conv1 = await testConversationState.getOrCreateConversation('jonathan-demo', 'metrics-session-1');
      const conv2 = await testConversationState.getOrCreateConversation('jonathan-demo', 'metrics-session-2');
      const conv3 = await testConversationState.getOrCreateConversation('jonathan-demo', 'metrics-session-3');

      // Add turns to conversations
      await testConversationState.addConversationTurn(conv1.id, 'user', 'Hello');
      await testConversationState.addConversationTurn(conv1.id, 'assistant', 'Hi there!');
      
      await testConversationState.addConversationTurn(conv2.id, 'user', 'How are you?');
      await testConversationState.addConversationTurn(conv2.id, 'assistant', 'I\'m doing well!');
      await testConversationState.addConversationTurn(conv2.id, 'user', 'That\'s great!');
      
      await testConversationState.addConversationTurn(conv3.id, 'user', 'Tell me a story');
      
      // End one conversation
      await testConversationState.endConversation(conv3.id);

      const metrics = testConversationState.getConversationMetrics();
      
      expect(metrics.totalConversations).toBe(3);
      expect(metrics.activeConversations).toBe(2);
      expect(metrics.totalTurns).toBe(6);
      expect(metrics.averageTurnsPerConversation).toBe(2);
      expect(metrics.averageConversationDuration).toBeGreaterThanOrEqual(0);

      await testConversationState.destroy();
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent conversation gracefully', async () => {
      await expect(
        jonathanConversationState.addConversationTurn(
          'non-existent-conversation-id',
          'user',
          'Hello'
        )
      ).rejects.toThrow('Conversation not found: non-existent-conversation-id');
    });

    it('should handle updates to non-existent conversations gracefully', () => {
      expect(() => {
        jonathanConversationState.updateMemoryContext('non-existent', 'context');
      }).not.toThrow();
      
      expect(() => {
        jonathanConversationState.updateVoiceSettings('non-existent', {});
      }).not.toThrow();
      
      expect(() => {
        jonathanConversationState.updateExpressionPack('non-existent', 'pack-id');
      }).not.toThrow();
    });

    it('should return empty history for non-existent sessions', () => {
      const history = jonathanConversationState.getConversationHistory('non-existent-session');
      expect(history).toEqual([]);
    });

    it('should return null for non-existent current conversation', () => {
      const conversation = jonathanConversationState.getCurrentConversation('non-existent-session');
      expect(conversation).toBeNull();
    });
  });
});