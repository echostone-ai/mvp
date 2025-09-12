/**
 * Tests for ConversationHistoryManager
 * 
 * Verifies conversation session tracking, history storage and retrieval,
 * visitor ID handling, and automatic cleanup functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConversationHistoryManager, ConversationSession, ConversationTurn } from '../conversationHistoryManager';

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    upsert: vi.fn()
  }))
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient)
}));

describe('ConversationHistoryManager', () => {
  let historyManager: ConversationHistoryManager;

  beforeEach(() => {
    vi.clearAllMocks();
    historyManager = new ConversationHistoryManager(
      'test-url',
      'test-key',
      {
        maxTurnsPerSession: 10,
        sessionTimeoutMs: 60000, // 1 minute for testing
        autoCleanupIntervalMs: 0, // Disable auto cleanup for tests
        persistToDatabase: false // Disable for most tests
      }
    );
  });

  afterEach(() => {
    historyManager.destroy();
  });

  describe('Session Management', () => {
    it('should create a new conversation session', async () => {
      const session = await historyManager.getOrCreateSession(
        'session-1',
        'avatar-123',
        'visitor-456',
        'user-789'
      );

      expect(session).toMatchObject({
        sessionId: 'session-1',
        avatarId: 'avatar-123',
        visitorId: 'visitor-456',
        userId: 'user-789',
        turns: [],
        fastMode: false,
        isPersisted: false
      });

      expect(session.entityBindings).toBeInstanceOf(Map);
      expect(session.context).toEqual({});
      expect(session.startTime).toBeDefined();
      expect(session.lastActivity).toBeDefined();
    });

    it('should return existing session if already created', async () => {
      const session1 = await historyManager.getOrCreateSession(
        'session-1',
        'avatar-123',
        'visitor-456'
      );

      const session2 = await historyManager.getOrCreateSession(
        'session-1',
        'avatar-123',
        'visitor-456'
      );

      expect(session1).toBe(session2);
      expect(session1.sessionId).toBe('session-1');
    });

    it('should update last activity when accessing existing session', async () => {
      const session1 = await historyManager.getOrCreateSession(
        'session-1',
        'avatar-123'
      );
      const firstActivity = session1.lastActivity;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      const session2 = await historyManager.getOrCreateSession(
        'session-1',
        'avatar-123'
      );

      expect(new Date(session2.lastActivity).getTime()).toBeGreaterThan(
        new Date(firstActivity).getTime()
      );
    });

    it('should get session by ID', async () => {
      await historyManager.getOrCreateSession('session-1', 'avatar-123');
      
      const session = historyManager.getSession('session-1');
      expect(session).toBeDefined();
      expect(session?.sessionId).toBe('session-1');
    });

    it('should return undefined for non-existent session', () => {
      const session = historyManager.getSession('non-existent');
      expect(session).toBeUndefined();
    });
  });

  describe('Conversation Turns', () => {
    it('should add turns to a conversation session', async () => {
      await historyManager.getOrCreateSession('session-1', 'avatar-123');

      await historyManager.addTurn('session-1', 'user', 'Hello there!');
      await historyManager.addTurn('session-1', 'assistant', 'Hi! How can I help you?', {
        confidence: 0.95,
        processingTimeMs: 150
      });

      const history = historyManager.getConversationHistory('session-1');
      expect(history).toHaveLength(2);
      
      expect(history[0]).toMatchObject({
        role: 'user',
        content: 'Hello there!',
        metadata: undefined
      });

      expect(history[1]).toMatchObject({
        role: 'assistant',
        content: 'Hi! How can I help you?',
        metadata: {
          confidence: 0.95,
          processingTimeMs: 150
        }
      });

      expect(history[0].id).toBeDefined();
      expect(history[0].timestamp).toBeDefined();
    });

    it('should throw error when adding turn to non-existent session', async () => {
      await expect(
        historyManager.addTurn('non-existent', 'user', 'Hello')
      ).rejects.toThrow('Session non-existent not found');
    });

    it('should limit turns per session', async () => {
      await historyManager.getOrCreateSession('session-1', 'avatar-123');

      // Add more turns than the limit (10)
      for (let i = 0; i < 15; i++) {
        await historyManager.addTurn('session-1', 'user', `Message ${i}`);
      }

      const history = historyManager.getConversationHistory('session-1');
      expect(history).toHaveLength(10);
      
      // Should keep the most recent turns
      expect(history[0].content).toBe('Message 5');
      expect(history[9].content).toBe('Message 14');
    });

    it('should get conversation history with limit', async () => {
      await historyManager.getOrCreateSession('session-1', 'avatar-123');

      for (let i = 0; i < 5; i++) {
        await historyManager.addTurn('session-1', 'user', `Message ${i}`);
      }

      const limitedHistory = historyManager.getConversationHistory('session-1', 3);
      expect(limitedHistory).toHaveLength(3);
      expect(limitedHistory[0].content).toBe('Message 2');
      expect(limitedHistory[2].content).toBe('Message 4');
    });

    it('should return empty array for non-existent session history', () => {
      const history = historyManager.getConversationHistory('non-existent');
      expect(history).toEqual([]);
    });
  });

  describe('Entity Bindings and Context', () => {
    it('should update entity bindings', async () => {
      await historyManager.getOrCreateSession('session-1', 'avatar-123');

      historyManager.updateEntityBindings('session-1', 'pet_name', 'Fluffy');
      historyManager.updateEntityBindings('session-1', 'location', 'San Francisco');

      const session = historyManager.getSession('session-1');
      expect(session?.entityBindings.get('pet_name')).toBe('Fluffy');
      expect(session?.entityBindings.get('location')).toBe('San Francisco');
      expect(session?.entityBindings.size).toBe(2);
    });

    it('should update session context', async () => {
      await historyManager.getOrCreateSession('session-1', 'avatar-123');

      historyManager.updateSessionContext('session-1', 'mood', 'happy');
      historyManager.updateSessionContext('session-1', 'topic', 'pets');

      const session = historyManager.getSession('session-1');
      expect(session?.context.mood).toBe('happy');
      expect(session?.context.topic).toBe('pets');
    });

    it('should throw error when updating bindings for non-existent session', () => {
      expect(() => {
        historyManager.updateEntityBindings('non-existent', 'key', 'value');
      }).toThrow('Session non-existent not found');
    });

    it('should throw error when updating context for non-existent session', () => {
      expect(() => {
        historyManager.updateSessionContext('non-existent', 'key', 'value');
      }).toThrow('Session non-existent not found');
    });
  });

  describe('Session Filtering', () => {
    beforeEach(async () => {
      await historyManager.getOrCreateSession('session-1', 'avatar-123', 'visitor-1');
      await historyManager.getOrCreateSession('session-2', 'avatar-123', 'visitor-2');
      await historyManager.getOrCreateSession('session-3', 'avatar-456', 'visitor-1');
    });

    it('should get sessions for specific avatar', () => {
      const avatarSessions = historyManager.getSessionsForAvatar('avatar-123');
      expect(avatarSessions).toHaveLength(2);
      expect(avatarSessions.map(s => s.sessionId)).toEqual(['session-1', 'session-2']);
    });

    it('should get sessions for specific visitor', () => {
      const visitorSessions = historyManager.getSessionsForVisitor('visitor-1');
      expect(visitorSessions).toHaveLength(2);
      expect(visitorSessions.map(s => s.sessionId)).toEqual(['session-1', 'session-3']);
    });

    it('should return empty array for non-existent avatar', () => {
      const sessions = historyManager.getSessionsForAvatar('non-existent');
      expect(sessions).toEqual([]);
    });

    it('should return empty array for non-existent visitor', () => {
      const sessions = historyManager.getSessionsForVisitor('non-existent');
      expect(sessions).toEqual([]);
    });
  });

  describe('Conversation Continuity', () => {
    it('should get conversation continuity metrics', async () => {
      const session = await historyManager.getOrCreateSession('session-1', 'avatar-123');
      
      await historyManager.addTurn('session-1', 'user', 'Hello');
      await historyManager.addTurn('session-1', 'assistant', 'Hi there!');
      
      historyManager.updateEntityBindings('session-1', 'pet_name', 'Fluffy');
      historyManager.updateSessionContext('session-1', 'mood', 'happy');

      const continuity = historyManager.getConversationContinuity('session-1');
      
      expect(continuity).toMatchObject({
        turnCount: 2,
        entityBindings: 1,
        contextSize: 1,
        lastActivity: session.lastActivity
      });

      expect(continuity?.sessionDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should return null for non-existent session continuity', () => {
      const continuity = historyManager.getConversationContinuity('non-existent');
      expect(continuity).toBeNull();
    });
  });

  describe('Session Cleanup', () => {
    it('should clear expired sessions', async () => {
      await historyManager.getOrCreateSession('session-1', 'avatar-123');
      await historyManager.getOrCreateSession('session-2', 'avatar-123');

      // Manually set one session as expired
      const session1 = historyManager.getSession('session-1');
      if (session1) {
        session1.lastActivity = new Date(Date.now() - 120000).toISOString(); // 2 minutes ago
      }

      const cleared = historyManager.clearExpiredSessions(60000); // 1 minute threshold
      
      expect(cleared).toBe(1);
      expect(historyManager.getSession('session-1')).toBeUndefined();
      expect(historyManager.getSession('session-2')).toBeDefined();
    });

    it('should clear sessions for specific avatar', async () => {
      await historyManager.getOrCreateSession('session-1', 'avatar-123');
      await historyManager.getOrCreateSession('session-2', 'avatar-123');
      await historyManager.getOrCreateSession('session-3', 'avatar-456');

      const cleared = historyManager.clearSessionsForAvatar('avatar-123');
      
      expect(cleared).toBe(2);
      expect(historyManager.getSession('session-1')).toBeUndefined();
      expect(historyManager.getSession('session-2')).toBeUndefined();
      expect(historyManager.getSession('session-3')).toBeDefined();
    });

    it('should clear sessions for specific visitor', async () => {
      await historyManager.getOrCreateSession('session-1', 'avatar-123', 'visitor-1');
      await historyManager.getOrCreateSession('session-2', 'avatar-456', 'visitor-1');
      await historyManager.getOrCreateSession('session-3', 'avatar-123', 'visitor-2');

      const cleared = historyManager.clearSessionsForVisitor('visitor-1');
      
      expect(cleared).toBe(2);
      expect(historyManager.getSession('session-1')).toBeUndefined();
      expect(historyManager.getSession('session-2')).toBeUndefined();
      expect(historyManager.getSession('session-3')).toBeDefined();
    });
  });

  describe('History Statistics', () => {
    it('should provide conversation history statistics', async () => {
      await historyManager.getOrCreateSession('session-1', 'avatar-123');
      await historyManager.getOrCreateSession('session-2', 'avatar-456');

      await historyManager.addTurn('session-1', 'user', 'Hello');
      await historyManager.addTurn('session-1', 'assistant', 'Hi');
      await historyManager.addTurn('session-2', 'user', 'Hey there');

      const stats = historyManager.getHistoryStats();
      
      expect(stats.activeSessions).toBe(2);
      expect(stats.totalTurns).toBe(3);
      expect(stats.averageSessionDuration).toBeGreaterThanOrEqual(0);
      expect(stats.oldestSession).toBeDefined();
      expect(stats.newestSession).toBeDefined();
    });

    it('should handle empty statistics', () => {
      const stats = historyManager.getHistoryStats();
      
      expect(stats).toMatchObject({
        activeSessions: 0,
        totalTurns: 0,
        averageSessionDuration: 0,
        oldestSession: null,
        newestSession: null
      });
    });
  });

  describe('Database Persistence', () => {
    let persistentManager: ConversationHistoryManager;

    beforeEach(() => {
      persistentManager = new ConversationHistoryManager(
        'test-url',
        'test-key',
        {
          persistToDatabase: true,
          autoCleanupIntervalMs: 0
        }
      );
    });

    afterEach(() => {
      persistentManager.destroy();
    });

    it('should attempt to load session from database', async () => {
      const mockData = {
        id: 'session-1',
        user_id: 'user-123',
        avatar_id: 'avatar-456',
        messages: [
          { id: '1', role: 'user', content: 'Hello', timestamp: new Date().toISOString() }
        ],
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString()
      };

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockData,
          error: null
        })
      };

      mockSupabaseClient.from.mockReturnValue(mockChain);

      const session = await persistentManager.getOrCreateSession(
        'session-1',
        'avatar-456',
        'visitor-123',
        'user-123'
      );

      expect(session.isPersisted).toBe(true);
      expect(session.turns).toHaveLength(1);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('conversations');
    });

    it('should handle database load errors gracefully', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Database error')
        })
      };

      mockSupabaseClient.from.mockReturnValue(mockChain);

      const session = await persistentManager.getOrCreateSession(
        'session-1',
        'avatar-456',
        'visitor-123',
        'user-123'
      );

      expect(session.isPersisted).toBe(false);
      expect(session.turns).toHaveLength(0);
    });

    it('should persist session to database when adding turns', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        upsert: vi.fn().mockResolvedValue({ error: null })
      };

      mockSupabaseClient.from.mockReturnValue(mockChain);

      await persistentManager.getOrCreateSession(
        'session-1',
        'avatar-456',
        'visitor-123',
        'user-123'
      );

      await persistentManager.addTurn('session-1', 'user', 'Hello');

      expect(mockChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'session-1',
          user_id: 'user-123',
          avatar_id: 'avatar-456',
          messages: expect.any(Array)
        })
      );
    });
  });

  describe('Auto Cleanup', () => {
    it('should start and stop auto cleanup', () => {
      const managerWithCleanup = new ConversationHistoryManager(
        undefined,
        undefined,
        {
          autoCleanupIntervalMs: 1000,
          persistToDatabase: false
        }
      );

      // Auto cleanup should be running
      expect(managerWithCleanup['cleanupInterval']).toBeDefined();

      managerWithCleanup.stopAutoCleanup();
      expect(managerWithCleanup['cleanupInterval']).toBeUndefined();

      managerWithCleanup.destroy();
    });
  });
});