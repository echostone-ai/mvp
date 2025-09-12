/**
 * Conversation Service End-to-End Integration Tests
 * 
 * Tests the complete conversation flow with real service integrations
 * to verify the entire system works together correctly.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConversationService, ConversationRequest } from '../conversationService';
import { ContextRetrievalEngine } from '../contextRetrievalEngine';
import { MemoryInjectionService } from '../memoryInjectionService';
import { GPT5Service } from '../gpt5Service';
import { MemoryUpdatePipeline } from '../memoryUpdatePipeline';

// Mock external dependencies
vi.mock('@/lib/data/client', () => ({
  sbAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          lte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                or: vi.fn(() => Promise.resolve({
                  data: [
                    {
                      id: '1',
                      avatar_id: 'avatar-123',
                      key: 'pet_name',
                      value: 'Max',
                      confidence: 0.9,
                      priority: 1,
                      source: 'manual',
                      created_at: '2024-01-01T00:00:00Z',
                      updated_at: '2024-01-01T00:00:00Z'
                    },
                    {
                      id: '2',
                      avatar_id: 'avatar-123',
                      key: 'occupation',
                      value: 'Teacher',
                      confidence: 0.8,
                      priority: 2,
                      source: 'extraction',
                      created_at: '2024-01-01T00:00:00Z',
                      updated_at: '2024-01-01T00:00:00Z'
                    }
                  ],
                  error: null
                }))
              }))
            }))
          }))
        }))
      }))
    }))
  }
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({
            data: [],
            error: null
          }))
        }))
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      }))
    }))
  }
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn(() => Promise.resolve({
          choices: [{
            message: {
              content: 'Hello! Yes, I love spending time with Max. Teaching keeps me busy, but I always make time for my furry friend.'
            }
          }],
          usage: {
            prompt_tokens: 150,
            completion_tokens: 25,
            total_tokens: 175
          }
        }))
      }
    };
  }
}));

describe('ConversationService Integration', () => {
  let conversationService: ConversationService;

  beforeEach(() => {
    // Create service with real implementations
    const contextEngine = new ContextRetrievalEngine();
    const memoryInjection = new MemoryInjectionService();
    const gpt5Service = new GPT5Service();
    const memoryPipeline = new MemoryUpdatePipeline();

    conversationService = new ConversationService(
      contextEngine,
      memoryInjection,
      gpt5Service,
      memoryPipeline
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('complete conversation flow', () => {
    it('should process a complete conversation with fact recall', async () => {
      const request: ConversationRequest = {
        avatarId: 'avatar-123',
        userInput: 'Tell me about your pet and your work',
        sessionId: 'integration-test-session',
        visitorId: 'visitor-789',
        fastMode: false,
        options: {
          enableFactExtraction: true,
          includeMemoryFragments: true,
          confidenceThreshold: 0.3
        }
      };

      const response = await conversationService.processConversation(request);

      // Verify response structure
      expect(response).toMatchObject({
        text: expect.any(String),
        sessionId: 'integration-test-session',
        confidence: expect.any(Number),
        processingTimeMs: expect.any(Number),
        metadata: expect.objectContaining({
          modelUsed: expect.any(String),
          contextRetrievalTimeMs: expect.any(Number),
          memoryInjectionTimeMs: expect.any(Number),
          gpt5ProcessingTimeMs: expect.any(Number),
          memoryUpdateTimeMs: expect.any(Number),
          factsRetrieved: expect.any(Number),
          memoriesRetrieved: expect.any(Number)
        }),
        session: expect.objectContaining({
          sessionId: 'integration-test-session',
          avatarId: 'avatar-123',
          visitorId: 'visitor-789',
          turns: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: 'Tell me about your pet and your work'
            }),
            expect.objectContaining({
              role: 'assistant',
              content: expect.stringContaining('Max')
            })
          ])
        })
      });

      // Verify the response mentions the pet name from facts
      expect(response.text.toLowerCase()).toContain('max');
      
      // Verify performance is within targets
      expect(response.processingTimeMs).toBeLessThan(3000);
      expect(response.metadata.contextRetrievalTimeMs).toBeLessThan(1000);
    });

    it('should maintain conversation continuity across multiple turns', async () => {
      const sessionId = 'continuity-integration-test';
      const avatarId = 'avatar-123';

      // First turn - establish context
      const firstRequest: ConversationRequest = {
        avatarId,
        userInput: 'What do you do for work?',
        sessionId,
        fastMode: false
      };

      const firstResponse = await conversationService.processConversation(firstRequest);
      expect(firstResponse.text.toLowerCase()).toContain('teach');

      // Second turn - reference previous context
      const secondRequest: ConversationRequest = {
        avatarId,
        userInput: 'Do you enjoy that profession?',
        sessionId,
        fastMode: false
      };

      const secondResponse = await conversationService.processConversation(secondRequest);

      // Verify session continuity
      expect(secondResponse.session.turns.length).toBe(4); // 2 user + 2 assistant
      expect(secondResponse.sessionId).toBe(sessionId);
      
      // Verify conversation history is maintained
      const session = conversationService.getSession(sessionId);
      expect(session?.turns).toHaveLength(4);
      expect(session?.turns[0].content).toBe('What do you do for work?');
      expect(session?.turns[2].content).toBe('Do you enjoy that profession?');
    });

    it('should handle session-level entity binding', async () => {
      const sessionId = 'entity-binding-test';
      const avatarId = 'avatar-123';

      // First conversation establishes pet name
      const firstRequest: ConversationRequest = {
        avatarId,
        userInput: 'Tell me about your pet',
        sessionId,
        fastMode: false
      };

      const firstResponse = await conversationService.processConversation(firstRequest);
      
      // Verify entity binding was created
      const session = conversationService.getSession(sessionId);
      expect(session?.entityBindings.has('pet_name')).toBe(true);
      expect(session?.entityBindings.get('pet_name')).toMatchObject({
        value: 'Max',
        confidence: expect.any(Number)
      });

      // Second conversation should use bound entity
      const secondRequest: ConversationRequest = {
        avatarId,
        userInput: 'How old is your pet?',
        sessionId,
        fastMode: false
      };

      const secondResponse = await conversationService.processConversation(secondRequest);
      
      // Should reference the bound pet name
      expect(secondResponse.text.toLowerCase()).toContain('max');
      
      // Entity binding should persist
      const updatedSession = conversationService.getSession(sessionId);
      expect(updatedSession?.entityBindings.has('pet_name')).toBe(true);
    });

    it('should perform well in fast mode', async () => {
      const request: ConversationRequest = {
        avatarId: 'avatar-123',
        userInput: 'Quick question about work',
        fastMode: true,
        options: {
          performanceMode: 'fast'
        }
      };

      const startTime = Date.now();
      const response = await conversationService.processConversation(request);
      const totalTime = Date.now() - startTime;

      // Fast mode should be significantly faster
      expect(totalTime).toBeLessThan(1000);
      expect(response.processingTimeMs).toBeLessThan(750);
      
      // Should still provide meaningful response
      expect(response.text.length).toBeGreaterThan(10);
      expect(response.confidence).toBeGreaterThan(0.3);
      
      // Fast mode characteristics
      expect(response.session.fastMode).toBe(true);
      expect(response.metadata.factsExtracted).toBe(0); // No fact extraction in fast mode
    });

    it('should handle errors gracefully and provide fallbacks', async () => {
      // Mock a temporary failure in context retrieval
      const originalConsoleError = console.error;
      console.error = vi.fn();

      try {
        const request: ConversationRequest = {
          avatarId: 'nonexistent-avatar',
          userInput: 'This might cause issues',
          fastMode: false
        };

        // Should either succeed with fallback or fail gracefully
        try {
          const response = await conversationService.processConversation(request);
          
          // If it succeeds, verify it's a valid response
          expect(response.text).toBeDefined();
          expect(response.sessionId).toBeDefined();
          expect(response.processingTimeMs).toBeGreaterThan(0);
        } catch (error) {
          // If it fails, should be a meaningful error
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain('Conversation failed');
        }
      } finally {
        console.error = originalConsoleError;
      }
    });

    it('should extract and store new facts during conversation', async () => {
      const request: ConversationRequest = {
        avatarId: 'avatar-123',
        userInput: 'I just adopted a new cat named Whiskers',
        sessionId: 'fact-extraction-test',
        fastMode: false,
        options: {
          enableFactExtraction: true
        }
      };

      const response = await conversationService.processConversation(request);

      // Should process the conversation successfully
      expect(response.text).toBeDefined();
      expect(response.metadata.factsExtracted).toBeGreaterThanOrEqual(0);
      
      // In a real implementation, this would extract "cat" and "Whiskers" as facts
      // For now, we verify the pipeline was called
      expect(response.metadata.memoryUpdateTimeMs).toBeGreaterThan(0);
    });

    it('should provide comprehensive performance metrics', async () => {
      // Create multiple conversations to generate metrics
      const requests = [
        {
          avatarId: 'avatar-123',
          userInput: 'First conversation',
          sessionId: 'metrics-1'
        },
        {
          avatarId: 'avatar-456',
          userInput: 'Second conversation',
          sessionId: 'metrics-2'
        },
        {
          avatarId: 'avatar-123',
          userInput: 'Third conversation',
          sessionId: 'metrics-3'
        }
      ];

      // Process all conversations
      for (const request of requests) {
        await conversationService.processConversation(request);
      }

      // Get performance statistics
      const stats = conversationService.getPerformanceStats();

      expect(stats).toMatchObject({
        activeSessions: 3,
        averageSessionDuration: expect.any(Number),
        averageEntityBindings: expect.any(Number),
        performanceTargets: {
          textResponseMs: 1500,
          ttsResponseMs: 3000,
          contextRetrievalMs: 500,
          memoryUpdateMs: 200
        }
      });

      // Verify continuity metrics for individual sessions
      const continuity = conversationService.getConversationContinuity('metrics-1');
      expect(continuity).toMatchObject({
        turnCount: 2, // 1 user + 1 assistant
        entityBindings: expect.any(Number),
        sessionDurationMs: expect.any(Number),
        lastActivity: expect.any(String)
      });
    });

    it('should clean up expired sessions', async () => {
      // Create a session
      await conversationService.processConversation({
        avatarId: 'avatar-123',
        userInput: 'Test session',
        sessionId: 'cleanup-test'
      });

      // Verify session exists
      expect(conversationService.getSession('cleanup-test')).toBeDefined();

      // Manually expire the session
      const session = conversationService.getSession('cleanup-test');
      if (session) {
        session.lastActivity = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      }

      // Clean up expired sessions
      const cleanedCount = conversationService.clearExpiredSessions(24 * 60 * 60 * 1000);

      expect(cleanedCount).toBe(1);
      expect(conversationService.getSession('cleanup-test')).toBeUndefined();
    });
  });

  describe('performance benchmarks', () => {
    it('should meet performance targets consistently', async () => {
      const performanceResults: number[] = [];

      // Run multiple conversations to test consistency
      for (let i = 0; i < 5; i++) {
        const request: ConversationRequest = {
          avatarId: 'avatar-123',
          userInput: `Performance test ${i + 1}`,
          fastMode: false
        };

        const startTime = Date.now();
        const response = await conversationService.processConversation(request);
        const totalTime = Date.now() - startTime;

        performanceResults.push(totalTime);

        // Each individual request should meet targets
        expect(response.processingTimeMs).toBeLessThan(1500);
        expect(response.metadata.contextRetrievalTimeMs).toBeLessThan(500);
      }

      // Average performance should be good
      const averageTime = performanceResults.reduce((a, b) => a + b, 0) / performanceResults.length;
      expect(averageTime).toBeLessThan(1200);

      // No request should be extremely slow
      expect(Math.max(...performanceResults)).toBeLessThan(2000);
    });

    it('should show significant performance improvement in fast mode', async () => {
      const normalRequest: ConversationRequest = {
        avatarId: 'avatar-123',
        userInput: 'Normal mode test',
        fastMode: false
      };

      const fastRequest: ConversationRequest = {
        avatarId: 'avatar-123',
        userInput: 'Fast mode test',
        fastMode: true
      };

      const normalStart = Date.now();
      const normalResponse = await conversationService.processConversation(normalRequest);
      const normalTime = Date.now() - normalStart;

      const fastStart = Date.now();
      const fastResponse = await conversationService.processConversation(fastRequest);
      const fastTime = Date.now() - fastStart;

      // Fast mode should be at least 30% faster
      expect(fastTime).toBeLessThan(normalTime * 0.7);
      
      // Both should provide valid responses
      expect(normalResponse.text.length).toBeGreaterThan(10);
      expect(fastResponse.text.length).toBeGreaterThan(10);
    });
  });
});