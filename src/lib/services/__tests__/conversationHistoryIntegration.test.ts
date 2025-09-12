/**
 * Integration Tests for ConversationHistoryManager
 * 
 * Tests integration with database, performance under load,
 * and compatibility with existing conversation systems.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConversationHistoryManager } from '../conversationHistoryManager';

describe('ConversationHistoryManager Integration', () => {
  let historyManager: ConversationHistoryManager;

  beforeEach(() => {
    historyManager = new ConversationHistoryManager(
      undefined,
      undefined,
      {
        maxTurnsPerSession: 50,
        sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes
        autoCleanupIntervalMs: 0, // Disable for tests
        persistToDatabase: false
      }
    );
  });

  afterEach(() => {
    historyManager.destroy();
  });

  describe('Multi-Session Conversation Flow', () => {
    it('should handle multiple concurrent conversation sessions', async () => {
      const sessions = [];
      const sessionCount = 10;

      // Create multiple sessions concurrently
      const sessionPromises = Array.from({ length: sessionCount }, (_, i) =>
        historyManager.getOrCreateSession(
          `session-${i}`,
          `avatar-${i % 3}`, // 3 different avatars
          `visitor-${i % 5}`, // 5 different visitors
          `user-${i}`
        )
      );

      const createdSessions = await Promise.all(sessionPromises);
      expect(createdSessions).toHaveLength(sessionCount);

      // Add turns to each session
      for (let i = 0; i < sessionCount; i++) {
        await historyManager.addTurn(`session-${i}`, 'user', `Hello from session ${i}`);
        await historyManager.addTurn(`session-${i}`, 'assistant', `Hi there! This is session ${i}`);
      }

      // Verify all sessions have correct data
      for (let i = 0; i < sessionCount; i++) {
        const history = historyManager.getConversationHistory(`session-${i}`);
        expect(history).toHaveLength(2);
        expect(history[0].content).toBe(`Hello from session ${i}`);
        expect(history[1].content).toBe(`Hi there! This is session ${i}`);
      }

      // Verify session filtering works
      const avatar0Sessions = historyManager.getSessionsForAvatar('avatar-0');
      expect(avatar0Sessions.length).toBeGreaterThan(0);

      const visitor0Sessions = historyManager.getSessionsForVisitor('visitor-0');
      expect(visitor0Sessions.length).toBeGreaterThan(0);
    });

    it('should maintain conversation continuity across multiple turns', async () => {
      const sessionId = 'continuity-test';
      await historyManager.getOrCreateSession(sessionId, 'avatar-123', 'visitor-456');

      // Simulate a multi-turn conversation with entity binding
      await historyManager.addTurn(sessionId, 'user', 'My name is Alice');
      historyManager.updateEntityBindings(sessionId, 'user_name', 'Alice');

      await historyManager.addTurn(sessionId, 'assistant', 'Nice to meet you, Alice!');
      
      await historyManager.addTurn(sessionId, 'user', 'I have a dog named Max');
      historyManager.updateEntityBindings(sessionId, 'pet_name', 'Max');
      historyManager.updateEntityBindings(sessionId, 'pet_type', 'dog');

      await historyManager.addTurn(sessionId, 'assistant', 'That\'s wonderful! Tell me more about Max.');
      
      await historyManager.addTurn(sessionId, 'user', 'He loves to play fetch');
      historyManager.updateSessionContext(sessionId, 'current_topic', 'pet_activities');

      // Verify conversation continuity
      const continuity = historyManager.getConversationContinuity(sessionId);
      expect(continuity).toMatchObject({
        turnCount: 5,
        entityBindings: 3, // user_name, pet_name, pet_type
        contextSize: 1 // current_topic
      });

      const session = historyManager.getSession(sessionId);
      expect(session?.entityBindings.get('user_name')).toBe('Alice');
      expect(session?.entityBindings.get('pet_name')).toBe('Max');
      expect(session?.entityBindings.get('pet_type')).toBe('dog');
      expect(session?.context.current_topic).toBe('pet_activities');
    });

    it('should handle rapid conversation turns without data loss', async () => {
      const sessionId = 'rapid-turns-test';
      await historyManager.getOrCreateSession(sessionId, 'avatar-123');

      const turnCount = 100;
      const turnPromises = [];

      // Add turns rapidly
      for (let i = 0; i < turnCount; i++) {
        const role = i % 2 === 0 ? 'user' : 'assistant';
        turnPromises.push(
          historyManager.addTurn(sessionId, role, `Message ${i}`, {
            processingTimeMs: Math.random() * 100,
            confidence: 0.8 + Math.random() * 0.2
          })
        );
      }

      await Promise.all(turnPromises);

      const history = historyManager.getConversationHistory(sessionId);
      expect(history).toHaveLength(Math.min(turnCount, 50)); // Limited by maxTurnsPerSession

      // Verify turns are in correct order (most recent)
      const expectedStartIndex = Math.max(0, turnCount - 50);
      for (let i = 0; i < history.length; i++) {
        const expectedIndex = expectedStartIndex + i;
        expect(history[i].content).toBe(`Message ${expectedIndex}`);
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large number of sessions efficiently', async () => {
      const sessionCount = 1000;
      const startTime = Date.now();

      // Create many sessions
      const sessionPromises = Array.from({ length: sessionCount }, (_, i) =>
        historyManager.getOrCreateSession(`perf-session-${i}`, 'avatar-perf')
      );

      await Promise.all(sessionPromises);
      
      const creationTime = Date.now() - startTime;
      expect(creationTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify all sessions exist
      const stats = historyManager.getHistoryStats();
      expect(stats.activeSessions).toBe(sessionCount);

      // Test cleanup performance
      const cleanupStart = Date.now();
      const cleared = historyManager.clearExpiredSessions(0); // Clear all
      const cleanupTime = Date.now() - cleanupStart;

      expect(cleared).toBe(sessionCount);
      expect(cleanupTime).toBeLessThan(1000); // Cleanup should be fast
    });

    it('should maintain performance with many turns per session', async () => {
      const sessionId = 'performance-turns-test';
      await historyManager.getOrCreateSession(sessionId, 'avatar-123');

      const turnCount = 1000;
      const startTime = Date.now();

      // Add many turns
      for (let i = 0; i < turnCount; i++) {
        await historyManager.addTurn(sessionId, i % 2 === 0 ? 'user' : 'assistant', `Turn ${i}`);
      }

      const addTime = Date.now() - startTime;
      expect(addTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Test retrieval performance
      const retrievalStart = Date.now();
      const history = historyManager.getConversationHistory(sessionId);
      const retrievalTime = Date.now() - retrievalStart;

      expect(retrievalTime).toBeLessThan(100); // Retrieval should be very fast
      expect(history.length).toBeLessThan(turnCount); // Should be limited by maxTurnsPerSession
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle session operations gracefully when session does not exist', async () => {
      const nonExistentId = 'does-not-exist';

      // These should not throw
      expect(historyManager.getSession(nonExistentId)).toBeUndefined();
      expect(historyManager.getConversationHistory(nonExistentId)).toEqual([]);
      expect(historyManager.getConversationContinuity(nonExistentId)).toBeNull();

      // These should throw with clear error messages
      expect(() => {
        historyManager.updateEntityBindings(nonExistentId, 'key', 'value');
      }).toThrow(`Session ${nonExistentId} not found`);

      expect(() => {
        historyManager.updateSessionContext(nonExistentId, 'key', 'value');
      }).toThrow(`Session ${nonExistentId} not found`);

      await expect(
        historyManager.addTurn(nonExistentId, 'user', 'Hello')
      ).rejects.toThrow(`Session ${nonExistentId} not found`);
    });

    it('should handle concurrent access to same session safely', async () => {
      const sessionId = 'concurrent-test';
      await historyManager.getOrCreateSession(sessionId, 'avatar-123');

      // Simulate concurrent operations on the same session
      const operations = [
        historyManager.addTurn(sessionId, 'user', 'Message 1'),
        historyManager.addTurn(sessionId, 'assistant', 'Response 1'),
        historyManager.addTurn(sessionId, 'user', 'Message 2'),
        historyManager.addTurn(sessionId, 'assistant', 'Response 2'),
      ];

      // Add concurrent entity binding updates
      operations.push(
        Promise.resolve(historyManager.updateEntityBindings(sessionId, 'key1', 'value1')),
        Promise.resolve(historyManager.updateEntityBindings(sessionId, 'key2', 'value2')),
        Promise.resolve(historyManager.updateSessionContext(sessionId, 'context1', 'value1'))
      );

      await Promise.all(operations);

      // Verify final state is consistent
      const session = historyManager.getSession(sessionId);
      expect(session?.turns).toHaveLength(4);
      expect(session?.entityBindings.size).toBe(2);
      expect(Object.keys(session?.context || {})).toHaveLength(1);
    });
  });

  describe('Memory Management', () => {
    it('should properly clean up resources on destroy', async () => {
      // Create sessions and add data
      await historyManager.getOrCreateSession('cleanup-1', 'avatar-123');
      await historyManager.getOrCreateSession('cleanup-2', 'avatar-456');
      
      await historyManager.addTurn('cleanup-1', 'user', 'Hello');
      await historyManager.addTurn('cleanup-2', 'user', 'Hi there');

      expect(historyManager.getHistoryStats().activeSessions).toBe(2);

      // Destroy should clean up everything
      historyManager.destroy();

      // Create new manager to verify cleanup
      const newManager = new ConversationHistoryManager();
      expect(newManager.getHistoryStats().activeSessions).toBe(0);
      
      newManager.destroy();
    });

    it('should handle session timeout and cleanup correctly', async () => {
      const shortTimeoutManager = new ConversationHistoryManager(
        undefined,
        undefined,
        {
          sessionTimeoutMs: 100, // Very short timeout for testing
          autoCleanupIntervalMs: 0
        }
      );

      try {
        await shortTimeoutManager.getOrCreateSession('timeout-test', 'avatar-123');
        
        // Wait for session to expire
        await new Promise(resolve => setTimeout(resolve, 150));
        
        const cleared = shortTimeoutManager.clearExpiredSessions();
        expect(cleared).toBe(1);
        expect(shortTimeoutManager.getSession('timeout-test')).toBeUndefined();
      } finally {
        shortTimeoutManager.destroy();
      }
    });
  });

  describe('Visitor ID Handling', () => {
    it('should properly handle visitor ID associations', async () => {
      // Create sessions with different visitor IDs
      await historyManager.getOrCreateSession('session-1', 'avatar-123', 'visitor-alice');
      await historyManager.getOrCreateSession('session-2', 'avatar-123', 'visitor-bob');
      await historyManager.getOrCreateSession('session-3', 'avatar-456', 'visitor-alice');

      // Test visitor-specific session retrieval
      const aliceSessions = historyManager.getSessionsForVisitor('visitor-alice');
      expect(aliceSessions).toHaveLength(2);
      expect(aliceSessions.map(s => s.sessionId).sort()).toEqual(['session-1', 'session-3']);

      const bobSessions = historyManager.getSessionsForVisitor('visitor-bob');
      expect(bobSessions).toHaveLength(1);
      expect(bobSessions[0].sessionId).toBe('session-2');

      // Test visitor-specific cleanup
      const clearedAlice = historyManager.clearSessionsForVisitor('visitor-alice');
      expect(clearedAlice).toBe(2);
      
      expect(historyManager.getSession('session-1')).toBeUndefined();
      expect(historyManager.getSession('session-3')).toBeUndefined();
      expect(historyManager.getSession('session-2')).toBeDefined();
    });

    it('should handle sessions without visitor IDs', async () => {
      await historyManager.getOrCreateSession('no-visitor-1', 'avatar-123');
      await historyManager.getOrCreateSession('no-visitor-2', 'avatar-123', undefined);

      const sessions = historyManager.getSessionsForAvatar('avatar-123');
      expect(sessions).toHaveLength(2);
      
      sessions.forEach(session => {
        expect(session.visitorId).toBeUndefined();
      });

      // Visitor-specific operations should not affect these sessions
      const cleared = historyManager.clearSessionsForVisitor('any-visitor');
      expect(cleared).toBe(0);
      expect(historyManager.getHistoryStats().activeSessions).toBe(2);
    });
  });
});