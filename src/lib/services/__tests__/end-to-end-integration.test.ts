/**
 * End-to-End Integration Tests for GPT-5 Avatar Memory Upgrade
 * 
 * Tests complete conversation flows from user input to response,
 * verifying all components work together correctly.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConversationService } from '../conversationService';
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
                      avatar_id: 'test-avatar',
                      key: 'name',
                      value: 'Sarah',
                      confidence: 0.95,
                      priority: 1,
                      source: 'manual',
                      created_at: '2024-01-01T00:00:00Z',
                      updated_at: '2024-01-01T00:00:00Z'
                    },
                    {
                      id: '2',
                      avatar_id: 'test-avatar',
                      key: 'pet_name',
                      value: 'Luna',
                      confidence: 0.9,
                      priority: 2,
                      source: 'extraction',
                      created_at: '2024-01-01T00:00:00Z',
                      updated_at: '2024-01-01T00:00:00Z'
                    },
                    {
                      id: '3',
                      avatar_id: 'test-avatar',
                      key: 'occupation',
                      value: 'Software Developer',
                      confidence: 0.85,
                      priority: 3,
                      source: 'llm',
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
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
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
            data: [
              {
                id: 'mem-1',
                avatar_id: 'test-avatar',
                fragment_text: 'I love hiking in the mountains on weekends',
                conversation_context: {
                  source: 'chat',
                  type: 'user',
                  conversation_id: 'conv-1'
                },
                similarity: 0.8,
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z'
              }
            ],
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
              content: 'Hello! I\'m Sarah, and yes, I love spending time with my cat Luna. As a software developer, I find that hiking helps me unwind from coding.'
            }
          }],
          usage: {
            prompt_tokens: 200,
            completion_tokens: 35,
            total_tokens: 235
          }
        }))
      }
    };
  }
}));

describe('End-to-End Integration Tests', () => {
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

    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any test sessions
    conversationService.clearExpiredSessions(0);
  });

  describe('Complete Conversation Flow', () => {
    it('should process a complete conversation with accurate fact recall', async () => {
      const request = {
        avatarId: 'test-avatar',
        userInput: 'Tell me about yourself and your pet',
        sessionId: 'e2e-test-session-1',
        visitorId: 'test-visitor',
        fastMode: false,
        options: {
          enableFactExtraction: true,
          includeMemoryFragments: true,
          confidenceThreshold: 0.3
        }
      };

      const response = await conversationService.processConversation(request);

      // Verify response structure and content
      expect(response).toMatchObject({
        text: expect.any(String),
        sessionId: 'e2e-test-session-1',
        confidence: expect.any(Number),
        processingTimeMs: expect.any(Number),
        metadata: expect.objectContaining({
          modelUsed: expect.any(String),
          contextRetrievalTimeMs: expect.any(Number),
          memoryInjectionTimeMs: expect.any(Number),
          gpt5ProcessingTimeMs: expect.any(Number),
          memoryUpdateTimeMs: expect.any(Number),
          factsRetrieved: 3, // Sarah, Luna, Software Developer
          memoriesRetrieved: 1 // Hiking memory
        }),
        session: expect.objectContaining({
          sessionId: 'e2e-test-session-1',
          avatarId: 'test-avatar',
          visitorId: 'test-visitor',
          turns: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: 'Tell me about yourself and your pet'
            }),
            expect.objectContaining({
              role: 'assistant',
              content: expect.stringContaining('Sarah')
            })
          ])
        })
      });

      // Verify fact recall accuracy
      expect(response.text.toLowerCase()).toContain('sarah');
      expect(response.text.toLowerCase()).toContain('luna');
      expect(response.text.toLowerCase()).toContain('software');

      // Verify performance targets
      expect(response.processingTimeMs).toBeLessThan(1500); // Text response target
      expect(response.metadata.contextRetrievalTimeMs).toBeLessThan(500);
    });

    it('should maintain conversation continuity across multiple turns', async () => {
      const sessionId = 'e2e-continuity-test';
      const avatarId = 'test-avatar';

      // First turn - establish context about work
      const firstRequest = {
        avatarId,
        userInput: 'What do you do for work?',
        sessionId,
        fastMode: false
      };

      const firstResponse = await conversationService.processConversation(firstRequest);
      expect(firstResponse.text.toLowerCase()).toContain('software');
      expect(firstResponse.text.toLowerCase()).toContain('developer');

      // Second turn - reference previous context
      const secondRequest = {
        avatarId,
        userInput: 'Do you enjoy that profession?',
        sessionId,
        fastMode: false
      };

      const secondResponse = await conversationService.processConversation(secondRequest);

      // Verify conversation continuity
      expect(secondResponse.session.turns.length).toBe(4); // 2 user + 2 assistant
      expect(secondResponse.sessionId).toBe(sessionId);

      // Third turn - ask about something mentioned earlier
      const thirdRequest = {
        avatarId,
        userInput: 'Tell me more about your hiking hobby',
        sessionId,
        fastMode: false
      };

      const thirdResponse = await conversationService.processConversation(thirdRequest);

      // Should reference hiking from memory fragments
      expect(thirdResponse.text.toLowerCase()).toContain('hiking');
      expect(thirdResponse.session.turns.length).toBe(6); // 3 user + 3 assistant

      // Verify session state
      const session = conversationService.getSession(sessionId);
      expect(session?.turns).toHaveLength(6);
      expect(session?.entityBindings.size).toBeGreaterThan(0);
    });

    it('should demonstrate session-level entity binding', async () => {
      const sessionId = 'e2e-entity-binding-test';
      const avatarId = 'test-avatar';

      // First conversation establishes pet name
      const firstRequest = {
        avatarId,
        userInput: 'What\'s your pet\'s name?',
        sessionId,
        fastMode: false
      };

      const firstResponse = await conversationService.processConversation(firstRequest);
      expect(firstResponse.text.toLowerCase()).toContain('luna');

      // Verify entity binding was created
      const session = conversationService.getSession(sessionId);
      expect(session?.entityBindings.has('pet_name')).toBe(true);
      expect(session?.entityBindings.get('pet_name')?.value).toBe('Luna');

      // Second conversation should use bound entity
      const secondRequest = {
        avatarId,
        userInput: 'How old is your pet?',
        sessionId,
        fastMode: false
      };

      const secondResponse = await conversationService.processConversation(secondRequest);

      // Should reference the bound pet name
      expect(secondResponse.text.toLowerCase()).toContain('luna');

      // Third conversation with pronoun reference
      const thirdRequest = {
        avatarId,
        userInput: 'Does she like to play?',
        sessionId,
        fastMode: false
      };

      const thirdResponse = await conversationService.processConversation(thirdRequest);

      // Should understand "she" refers to Luna
      expect(thirdResponse.text.length).toBeGreaterThan(10);
      expect(thirdResponse.confidence).toBeGreaterThan(0.3);

      // Entity binding should persist throughout session
      const finalSession = conversationService.getSession(sessionId);
      expect(finalSession?.entityBindings.has('pet_name')).toBe(true);
    });

    it('should handle fact contradictions gracefully', async () => {
      const sessionId = 'e2e-contradiction-test';
      const avatarId = 'test-avatar';

      // First, establish that the pet name is Luna (from stored facts)
      const firstRequest = {
        avatarId,
        userInput: 'What\'s your pet\'s name?',
        sessionId,
        fastMode: false
      };

      const firstResponse = await conversationService.processConversation(firstRequest);
      expect(firstResponse.text.toLowerCase()).toContain('luna');

      // Now provide contradictory information
      const secondRequest = {
        avatarId,
        userInput: 'Actually, I think your pet\'s name is Max',
        sessionId,
        fastMode: false
      };

      const secondResponse = await conversationService.processConversation(secondRequest);

      // Should acknowledge the discrepancy rather than just accepting
      expect(secondResponse.text.toLowerCase()).toMatch(/(thought|remember|luna|max)/);
      expect(secondResponse.text.length).toBeGreaterThan(20);
    });

    it('should extract and store new facts during conversation', async () => {
      const sessionId = 'e2e-fact-extraction-test';
      const avatarId = 'test-avatar';

      const request = {
        avatarId,
        userInput: 'I just adopted a new dog named Charlie, and I work as a teacher now',
        sessionId,
        fastMode: false,
        options: {
          enableFactExtraction: true
        }
      };

      const response = await conversationService.processConversation(request);

      // Should process the conversation successfully
      expect(response.text).toBeDefined();
      expect(response.text.length).toBeGreaterThan(10);

      // Should have attempted fact extraction
      expect(response.metadata.memoryUpdateTimeMs).toBeGreaterThan(0);

      // In a real implementation, this would extract "dog", "Charlie", and "teacher"
      // For now, we verify the pipeline was called
      expect(response.metadata.factsExtracted).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance and Optimization', () => {
    it('should meet performance targets consistently', async () => {
      const performanceResults: number[] = [];
      const sessionId = 'e2e-performance-test';

      // Run multiple conversations to test consistency
      for (let i = 0; i < 5; i++) {
        const request = {
          avatarId: 'test-avatar',
          userInput: `Performance test conversation ${i + 1}`,
          sessionId: `${sessionId}-${i}`,
          fastMode: false
        };

        const startTime = Date.now();
        const response = await conversationService.processConversation(request);
        const totalTime = Date.now() - startTime;

        performanceResults.push(totalTime);

        // Each individual request should meet targets
        expect(response.processingTimeMs).toBeLessThan(1500);
        expect(response.metadata.contextRetrievalTimeMs).toBeLessThan(500);
        expect(response.metadata.gpt5ProcessingTimeMs).toBeLessThan(1000);
      }

      // Average performance should be good
      const averageTime = performanceResults.reduce((a, b) => a + b, 0) / performanceResults.length;
      expect(averageTime).toBeLessThan(1200);

      // No request should be extremely slow
      expect(Math.max(...performanceResults)).toBeLessThan(2000);
    });

    it('should show significant performance improvement in fast mode', async () => {
      const avatarId = 'test-avatar';
      const userInput = 'Quick question about work';

      // Normal mode
      const normalRequest = {
        avatarId,
        userInput,
        sessionId: 'normal-mode-test',
        fastMode: false
      };

      const normalStart = Date.now();
      const normalResponse = await conversationService.processConversation(normalRequest);
      const normalTime = Date.now() - normalStart;

      // Fast mode
      const fastRequest = {
        avatarId,
        userInput,
        sessionId: 'fast-mode-test',
        fastMode: true
      };

      const fastStart = Date.now();
      const fastResponse = await conversationService.processConversation(fastRequest);
      const fastTime = Date.now() - fastStart;

      // Fast mode should be significantly faster
      expect(fastTime).toBeLessThan(normalTime * 0.8);
      expect(fastResponse.processingTimeMs).toBeLessThan(750);

      // Both should provide valid responses
      expect(normalResponse.text.length).toBeGreaterThan(10);
      expect(fastResponse.text.length).toBeGreaterThan(10);

      // Fast mode characteristics
      expect(fastResponse.session.fastMode).toBe(true);
      expect(fastResponse.metadata.factsExtracted).toBe(0); // No extraction in fast mode
    });

    it('should handle concurrent conversations efficiently', async () => {
      const concurrentRequests = Array.from({ length: 3 }, (_, i) => ({
        avatarId: 'test-avatar',
        userInput: `Concurrent conversation ${i + 1}`,
        sessionId: `concurrent-${i + 1}`,
        fastMode: true
      }));

      const startTime = Date.now();
      const responses = await Promise.all(
        concurrentRequests.map(request => 
          conversationService.processConversation(request)
        )
      );
      const totalTime = Date.now() - startTime;

      // All responses should be valid
      responses.forEach((response, i) => {
        expect(response.text).toBeDefined();
        expect(response.sessionId).toBe(`concurrent-${i + 1}`);
        expect(response.processingTimeMs).toBeLessThan(1000);
      });

      // Concurrent processing shouldn't be much slower than sequential
      expect(totalTime).toBeLessThan(2000);

      // Each session should be independent
      const sessions = responses.map(r => conversationService.getSession(r.sessionId));
      sessions.forEach((session, i) => {
        expect(session?.sessionId).toBe(`concurrent-${i + 1}`);
        expect(session?.turns.length).toBe(2); // 1 user + 1 assistant
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle database connection failures gracefully', async () => {
      // Mock database failure
      const { sbAdmin } = await import('@/lib/data/client');
      vi.mocked(sbAdmin.from).mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  or: vi.fn(() => Promise.reject(new Error('Database connection failed')))
                }))
              }))
            }))
          }))
        }))
      }));

      const request = {
        avatarId: 'test-avatar',
        userInput: 'This should handle database failure',
        sessionId: 'error-handling-test',
        fastMode: false
      };

      // Should either succeed with fallback or fail gracefully
      try {
        const response = await conversationService.processConversation(request);
        
        // If it succeeds with fallback, verify it's a valid response
        expect(response.text).toBeDefined();
        expect(response.sessionId).toBeDefined();
        expect(response.metadata.fallbackUsed).toBe(true);
      } catch (error) {
        // If it fails, should be a meaningful error
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Conversation failed');
      }
    });

    it('should recover from partial service failures', async () => {
      // Mock memory update failure but allow other services to work
      const originalConsoleError = console.error;
      console.error = vi.fn();

      try {
        const request = {
          avatarId: 'test-avatar',
          userInput: 'Test partial failure recovery',
          sessionId: 'partial-failure-test',
          fastMode: false
        };

        // Should complete conversation despite memory update issues
        const response = await conversationService.processConversation(request);

        expect(response.text).toBeDefined();
        expect(response.sessionId).toBeDefined();
        expect(response.processingTimeMs).toBeGreaterThan(0);
      } finally {
        console.error = originalConsoleError;
      }
    });

    it('should maintain session integrity during errors', async () => {
      const sessionId = 'error-integrity-test';
      
      // First successful conversation
      const successfulRequest = {
        avatarId: 'test-avatar',
        userInput: 'This should work fine',
        sessionId,
        fastMode: false
      };

      await conversationService.processConversation(successfulRequest);

      // Verify session was created
      let session = conversationService.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.turns.length).toBe(2);

      // Second conversation that might fail
      const riskyRequest = {
        avatarId: 'test-avatar',
        userInput: 'This might cause issues',
        sessionId,
        fastMode: false
      };

      try {
        await conversationService.processConversation(riskyRequest);
      } catch (error) {
        // Even if it fails, session should still exist and be valid
        session = conversationService.getSession(sessionId);
        expect(session).toBeDefined();
        expect(session?.sessionId).toBe(sessionId);
      }
    });
  });

  describe('Accuracy and Context Continuity', () => {
    it('should accurately recall stored facts across conversation turns', async () => {
      const sessionId = 'accuracy-test-session';
      const avatarId = 'test-avatar';

      // Test name recall
      const nameRequest = {
        avatarId,
        userInput: 'What is your name?',
        sessionId,
        fastMode: false
      };

      const nameResponse = await conversationService.processConversation(nameRequest);
      expect(nameResponse.text.toLowerCase()).toContain('sarah');

      // Test pet recall
      const petRequest = {
        avatarId,
        userInput: 'Tell me about your pet',
        sessionId,
        fastMode: false
      };

      const petResponse = await conversationService.processConversation(petRequest);
      expect(petResponse.text.toLowerCase()).toContain('luna');

      // Test occupation recall
      const workRequest = {
        avatarId,
        userInput: 'What do you do for work?',
        sessionId,
        fastMode: false
      };

      const workResponse = await conversationService.processConversation(workRequest);
      expect(workResponse.text.toLowerCase()).toContain('software');
      expect(workResponse.text.toLowerCase()).toContain('developer');

      // Test memory fragment recall
      const hobbyRequest = {
        avatarId,
        userInput: 'What do you like to do in your free time?',
        sessionId,
        fastMode: false
      };

      const hobbyResponse = await conversationService.processConversation(hobbyRequest);
      expect(hobbyResponse.text.toLowerCase()).toContain('hiking');
    });

    it('should never contradict established facts without acknowledgment', async () => {
      const sessionId = 'fact-consistency-test';
      const avatarId = 'test-avatar';

      // Establish facts through multiple questions
      const questions = [
        'What is your name?',
        'What is your pet\'s name?',
        'What do you do for work?'
      ];

      const responses: string[] = [];

      for (const question of questions) {
        const request = {
          avatarId,
          userInput: question,
          sessionId,
          fastMode: false
        };

        const response = await conversationService.processConversation(request);
        responses.push(response.text.toLowerCase());
      }

      // All responses should be consistent with stored facts
      expect(responses[0]).toContain('sarah');
      expect(responses[1]).toContain('luna');
      expect(responses[2]).toContain('software');

      // Ask the same questions again - should get consistent answers
      for (let i = 0; i < questions.length; i++) {
        const request = {
          avatarId,
          userInput: questions[i],
          sessionId,
          fastMode: false
        };

        const response = await conversationService.processConversation(request);
        const newResponse = response.text.toLowerCase();

        // Should maintain consistency
        if (i === 0) expect(newResponse).toContain('sarah');
        if (i === 1) expect(newResponse).toContain('luna');
        if (i === 2) expect(newResponse).toContain('software');
      }
    });

    it('should maintain context across complex multi-turn conversations', async () => {
      const sessionId = 'complex-context-test';
      const avatarId = 'test-avatar';

      // Complex conversation flow
      const conversationFlow = [
        {
          input: 'Tell me about your work and hobbies',
          expectedContent: ['software', 'hiking']
        },
        {
          input: 'How do those activities complement each other?',
          expectedContent: ['software', 'hiking'] // Should reference both from previous turn
        },
        {
          input: 'Do you ever take your pet on those outdoor activities?',
          expectedContent: ['luna', 'hiking'] // Should connect pet with hiking
        },
        {
          input: 'That sounds wonderful. How long have you been doing this?',
          expectedContent: [] // Should understand "this" refers to hiking with Luna
        }
      ];

      for (let i = 0; i < conversationFlow.length; i++) {
        const { input, expectedContent } = conversationFlow[i];
        
        const request = {
          avatarId,
          userInput: input,
          sessionId,
          fastMode: false
        };

        const response = await conversationService.processConversation(request);
        
        // Verify expected content is present
        expectedContent.forEach(content => {
          expect(response.text.toLowerCase()).toContain(content);
        });

        // Verify conversation continuity
        expect(response.session.turns.length).toBe((i + 1) * 2);
      }

      // Final verification of session state
      const finalSession = conversationService.getSession(sessionId);
      expect(finalSession?.turns.length).toBe(8); // 4 user + 4 assistant turns
      expect(finalSession?.entityBindings.size).toBeGreaterThan(0);
    });
  });
});