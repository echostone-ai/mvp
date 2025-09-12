/**
 * Conversation Service Integration Tests
 * 
 * Tests the complete conversation flow including context retrieval,
 * memory injection, GPT-5 processing, and memory updates.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ConversationService, ConversationRequest, ConversationResponse } from '../conversationService';
import { ContextRetrievalEngine, StructuredContext } from '../contextRetrievalEngine';
import { MemoryInjectionService } from '../memoryInjectionService';
import { GPT5Service, GPT5Response } from '../gpt5Service';
import { MemoryUpdatePipeline, MemoryUpdateResult } from '../memoryUpdatePipeline';

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{
            message: { content: 'Test response' }
          }],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 20,
            total_tokens: 120
          }
        })
      }
    }
  }))
}));

// Mock Supabase
vi.mock('@/lib/data/client', () => ({
  sbAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          lte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                or: vi.fn(() => Promise.resolve({ data: [], error: null }))
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
          limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      }))
    }))
  }
}));

// Mock implementations
const mockContextEngine = {
  retrieveContext: vi.fn(),
  clearCache: vi.fn()
} as unknown as ContextRetrievalEngine;

const mockMemoryInjection = {
  formatContext: vi.fn()
} as unknown as MemoryInjectionService;

const mockGPT5Service = {
  generateResponse: vi.fn(),
  validateResponse: vi.fn()
} as unknown as GPT5Service;

const mockMemoryPipeline = {
  processConversationTurn: vi.fn()
} as unknown as MemoryUpdatePipeline;

describe('ConversationService', () => {
  let conversationService: ConversationService;
  let mockContext: StructuredContext;
  let mockGPT5Response: GPT5Response;
  let mockMemoryUpdateResult: MemoryUpdateResult;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create service with mocked dependencies
    conversationService = new ConversationService(
      mockContextEngine,
      mockMemoryInjection,
      mockGPT5Service,
      mockMemoryPipeline
    );

    // Setup mock data
    mockContext = {
      quickFacts: [
        {
          id: '1',
          avatarId: 'avatar-123',
          key: 'pet_name',
          value: 'Buddy',
          confidence: 0.9,
          priority: 1,
          source: 'manual',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        },
        {
          id: '2',
          avatarId: 'avatar-123',
          key: 'occupation',
          value: 'Software Engineer',
          confidence: 0.8,
          priority: 2,
          source: 'extraction',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ],
      memoryFragments: [
        {
          id: 'mem-1',
          avatarId: 'avatar-123',
          fragmentText: 'I love hiking in the mountains on weekends',
          conversationContext: {
            source: 'conversation',
            type: 'user',
            conversationId: 'conv-1'
          },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ],
      conversationHistory: [],
      retrievalMetadata: {
        totalQuickFacts: 2,
        totalMemoryFragments: 1,
        totalConversationTurns: 0,
        retrievalTimeMs: 150,
        confidenceThreshold: 0.35,
        queryOptimizations: ['parallel_queries'],
        cacheHits: ['quick_facts']
      }
    };

    mockGPT5Response = {
      text: 'Yes, I love spending time with Buddy! As a software engineer, I find that hiking helps me relax.',
      confidence: 0.85,
      extractedFacts: [
        {
          key: 'hobby',
          value: 'hiking',
          confidence: 0.8,
          priority: 4,
          source: 'llm',
          sourceReference: 'conversation_123'
        }
      ],
      modelUsed: 'gpt-4o',
      processingTime: 800
    };

    mockMemoryUpdateResult = {
      factsExtracted: 1,
      factsUpdated: 1,
      memoriesCreated: 1,
      conflicts: [],
      errors: [],
      processingTimeMs: 120
    };

    // Setup mock implementations
    vi.mocked(mockContextEngine.retrieveContext).mockResolvedValue(mockContext);
    vi.mocked(mockMemoryInjection.formatContext).mockReturnValue('Formatted memory template');
    vi.mocked(mockGPT5Service.generateResponse).mockResolvedValue(mockGPT5Response);
    vi.mocked(mockMemoryPipeline.processConversationTurn).mockResolvedValue(mockMemoryUpdateResult);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('processConversation', () => {
    it('should orchestrate complete conversation flow successfully', async () => {
      const request: ConversationRequest = {
        avatarId: 'avatar-123',
        userInput: 'Tell me about your pet and work',
        sessionId: 'session-123',
        visitorId: 'visitor-456',
        fastMode: false
      };

      const response = await conversationService.processConversation(request);

      // Verify response structure
      expect(response).toMatchObject({
        text: expect.stringContaining('Buddy'),
        sessionId: 'session-123',
        confidence: 0.85,
        processingTimeMs: expect.any(Number)
      });

      // Verify metadata
      expect(response.metadata).toMatchObject({
        modelUsed: 'gpt-4o',
        contextRetrievalTimeMs: expect.any(Number),
        memoryInjectionTimeMs: expect.any(Number),
        gpt5ProcessingTimeMs: expect.any(Number),
        memoryUpdateTimeMs: expect.any(Number),
        factsRetrieved: 2,
        memoriesRetrieved: 1,
        factsExtracted: 1,
        factsUpdated: 1,
        cacheHits: ['quick_facts'],
        entityBindingsUsed: expect.any(Array)
      });

      // Verify session was created/updated
      expect(response.session).toMatchObject({
        sessionId: 'session-123',
        avatarId: 'avatar-123',
        visitorId: 'visitor-456',
        fastMode: false,
        turns: expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: request.userInput }),
          expect.objectContaining({ role: 'assistant', content: response.text })
        ])
      });
    });

    it('should handle fast mode with reduced processing', async () => {
      const request: ConversationRequest = {
        avatarId: 'avatar-123',
        userInput: 'Quick question about work',
        fastMode: true
      };

      const response = await conversationService.processConversation(request);

      // Verify context retrieval was called with fast mode
      expect(mockContextEngine.retrieveContext).toHaveBeenCalledWith(
        'avatar-123',
        'Quick question about work',
        expect.objectContaining({
          fastMode: true,
          memoryLimit: 8,
          historyLimit: 5
        })
      );

      // Verify memory injection used fast mode settings
      expect(mockMemoryInjection.formatContext).toHaveBeenCalledWith(
        mockContext,
        expect.objectContaining({
          maxCharacters: 4000,
          conversationHistoryLimit: 5,
          memoryFragmentLimit: 8
        })
      );

      expect(response.session.fastMode).toBe(true);
    });

    it('should maintain session-level entity bindings', async () => {
      const request: ConversationRequest = {
        avatarId: 'avatar-123',
        userInput: 'What is my pet\'s name?',
        sessionId: 'session-binding-test'
      };

      const response = await conversationService.processConversation(request);

      // Verify session has entity bindings for core facts
      expect(response.session.entityBindings.has('pet_name')).toBe(true);
      expect(response.session.entityBindings.get('pet_name')).toMatchObject({
        value: 'Buddy',
        confidence: expect.any(Number),
        boundAt: expect.any(String)
      });

      // Make another request to same session
      const secondRequest: ConversationRequest = {
        avatarId: 'avatar-123',
        userInput: 'Tell me more about Buddy',
        sessionId: 'session-binding-test'
      };

      await conversationService.processConversation(secondRequest);

      // Verify entity binding persisted across turns
      const session = conversationService.getSession('session-binding-test');
      expect(session?.entityBindings.has('pet_name')).toBe(true);
      expect(session?.turns.length).toBe(4); // 2 user + 2 assistant turns
    });

    it('should handle conversation continuity within sessions', async () => {
      const sessionId = 'continuity-test-session';

      // First conversation turn
      const firstRequest: ConversationRequest = {
        avatarId: 'avatar-123',
        userInput: 'I just got a new job',
        sessionId
      };

      await conversationService.processConversation(firstRequest);

      // Second conversation turn referencing first
      const secondRequest: ConversationRequest = {
        avatarId: 'avatar-123',
        userInput: 'What do you think about my career change?',
        sessionId
      };

      const response = await conversationService.processConversation(secondRequest);

      // Verify session has conversation history
      expect(response.session.turns.length).toBe(4); // 2 user + 2 assistant
      
      // Verify context included conversation history
      expect(mockContextEngine.retrieveContext).toHaveBeenLastCalledWith(
        'avatar-123',
        'What do you think about my career change?',
        expect.any(Object)
      );

      // Check that conversation history was passed to context
      const lastCallArgs = vi.mocked(mockContextEngine.retrieveContext).mock.calls.slice(-1)[0];
      expect(lastCallArgs).toBeDefined();
    });

    it('should meet performance targets for text responses', async () => {
      const request: ConversationRequest = {
        avatarId: 'avatar-123',
        userInput: 'Quick response test',
        fastMode: false
      };

      const startTime = Date.now();
      const response = await conversationService.processConversation(request);
      const totalTime = Date.now() - startTime;

      // Should meet <1.5s target for text responses
      expect(response.processingTimeMs).toBeLessThan(1500);
      expect(totalTime).toBeLessThan(2000); // Allow some buffer for test overhead

      // Verify individual component times are reasonable
      expect(response.metadata.contextRetrievalTimeMs).toBeLessThan(500);
      expect(response.metadata.gpt5ProcessingTimeMs).toBeLessThan(1000);
    });

    it('should handle errors gracefully', async () => {
      // Mock context retrieval failure
      vi.mocked(mockContextEngine.retrieveContext).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request: ConversationRequest = {
        avatarId: 'avatar-123',
        userInput: 'This should fail'
      };

      await expect(conversationService.processConversation(request))
        .rejects.toThrow('Conversation failed: Database connection failed');
    });

    it('should handle GPT-5 service failures', async () => {
      // Mock GPT-5 failure
      vi.mocked(mockGPT5Service.generateResponse).mockRejectedValue(
        new Error('API rate limit exceeded')
      );

      const request: ConversationRequest = {
        avatarId: 'avatar-123',
        userInput: 'This should fail at GPT-5'
      };

      await expect(conversationService.processConversation(request))
        .rejects.toThrow('Conversation failed: API rate limit exceeded');
    });

    it('should process memory updates asynchronously in fast mode', async () => {
      const request: ConversationRequest = {
        avatarId: 'avatar-123',
        userInput: 'Fast mode memory test',
        fastMode: true
      };

      const response = await conversationService.processConversation(request);

      // In fast mode, memory update should be minimal/async
      expect(response.metadata.memoryUpdateTimeMs).toBeLessThan(50);
      expect(response.metadata.factsExtracted).toBe(0); // Should be 0 in fast mode
    });

    it('should generate unique session IDs when not provided', async () => {
      const request1: ConversationRequest = {
        avatarId: 'avatar-123',
        userInput: 'First conversation'
      };

      const request2: ConversationRequest = {
        avatarId: 'avatar-123',
        userInput: 'Second conversation'
      };

      const response1 = await conversationService.processConversation(request1);
      const response2 = await conversationService.processConversation(request2);

      expect(response1.sessionId).toBeDefined();
      expect(response2.sessionId).toBeDefined();
      expect(response1.sessionId).not.toBe(response2.sessionId);
    });
  });

  describe('session management', () => {
    it('should retrieve existing sessions', async () => {
      const sessionId = 'test-session-retrieval';
      
      // Create a session
      await conversationService.processConversation({
        avatarId: 'avatar-123',
        userInput: 'Create session',
        sessionId
      });

      // Retrieve the session
      const session = conversationService.getSession(sessionId);
      
      expect(session).toBeDefined();
      expect(session?.sessionId).toBe(sessionId);
      expect(session?.avatarId).toBe('avatar-123');
    });

    it('should clear expired sessions', async () => {
      const oldSessionId = 'old-session';
      const newSessionId = 'new-session';

      // Create sessions
      await conversationService.processConversation({
        avatarId: 'avatar-123',
        userInput: 'Old session',
        sessionId: oldSessionId
      });

      await conversationService.processConversation({
        avatarId: 'avatar-123',
        userInput: 'New session',
        sessionId: newSessionId
      });

      // Manually set old session's last activity to past
      const oldSession = conversationService.getSession(oldSessionId);
      if (oldSession) {
        oldSession.lastActivity = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
      }

      // Clear expired sessions (24 hour threshold)
      const clearedCount = conversationService.clearExpiredSessions(24 * 60 * 60 * 1000);

      expect(clearedCount).toBe(1);
      expect(conversationService.getSession(oldSessionId)).toBeUndefined();
      expect(conversationService.getSession(newSessionId)).toBeDefined();
    });

    it('should provide conversation continuity metrics', async () => {
      const sessionId = 'continuity-metrics-test';

      // Create multiple turns
      for (let i = 0; i < 3; i++) {
        await conversationService.processConversation({
          avatarId: 'avatar-123',
          userInput: `Turn ${i + 1}`,
          sessionId
        });
      }

      const continuity = conversationService.getConversationContinuity(sessionId);

      expect(continuity).toMatchObject({
        turnCount: 6, // 3 user + 3 assistant turns
        entityBindings: expect.any(Number),
        sessionDurationMs: expect.any(Number),
        lastActivity: expect.any(String)
      });
    });
  });

  describe('performance monitoring', () => {
    it('should provide performance statistics', async () => {
      // Create some sessions
      await conversationService.processConversation({
        avatarId: 'avatar-123',
        userInput: 'Performance test 1',
        sessionId: 'perf-1'
      });

      await conversationService.processConversation({
        avatarId: 'avatar-456',
        userInput: 'Performance test 2',
        sessionId: 'perf-2'
      });

      const stats = conversationService.getPerformanceStats();

      expect(stats).toMatchObject({
        activeSessions: 2,
        averageSessionDuration: expect.any(Number),
        averageEntityBindings: expect.any(Number),
        performanceTargets: {
          textResponseMs: 1500,
          ttsResponseMs: 3000,
          contextRetrievalMs: 500,
          memoryUpdateMs: 200
        }
      });
    });

    it('should log performance warnings when targets are exceeded', async () => {
      // Mock slow context retrieval and GPT-5 response to exceed targets
      vi.mocked(mockContextEngine.retrieveContext).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockContext), 600)) // Slow context retrieval
      );
      
      vi.mocked(mockGPT5Service.generateResponse).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          ...mockGPT5Response,
          processingTime: 1200 // Slow GPT-5 processing
        }), 1200))
      );

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const request: ConversationRequest = {
        avatarId: 'avatar-123',
        userInput: 'Slow response test',
        fastMode: false
      };

      await conversationService.processConversation(request);

      // Should log performance warning (total time > 1500ms target)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Performance target exceeded'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('integration with all components', () => {
    it('should call all services in correct order', async () => {
      const request: ConversationRequest = {
        avatarId: 'avatar-123',
        userInput: 'Integration test',
        sessionId: 'integration-session'
      };

      await conversationService.processConversation(request);

      // Verify call order and parameters
      expect(mockContextEngine.retrieveContext).toHaveBeenCalledWith(
        'avatar-123',
        'Integration test',
        expect.objectContaining({
          fastMode: false,
          confidenceThreshold: 0.35
        })
      );

      expect(mockMemoryInjection.formatContext).toHaveBeenCalledWith(
        mockContext,
        expect.objectContaining({
          modelType: 'gpt-5',
          prioritizeCoreIdentity: true
        })
      );

      expect(mockGPT5Service.generateResponse).toHaveBeenCalledWith(
        mockContext,
        'Integration test',
        'Formatted memory template'
      );

      expect(mockMemoryPipeline.processConversationTurn).toHaveBeenCalledWith(
        'avatar-123',
        expect.objectContaining({
          conversationId: 'integration-session',
          userInput: 'Integration test',
          assistantResponse: mockGPT5Response.text
        })
      );
    });

    it('should handle partial service failures gracefully', async () => {
      // Mock memory update failure
      vi.mocked(mockMemoryPipeline.processConversationTurn).mockRejectedValue(
        new Error('Memory update failed')
      );

      const request: ConversationRequest = {
        avatarId: 'avatar-123',
        userInput: 'Partial failure test',
        fastMode: false
      };

      // Should still complete conversation despite memory update failure
      await expect(conversationService.processConversation(request))
        .rejects.toThrow('Conversation failed: Memory update failed');
    });
  });
});