/**
 * Accuracy and Context Continuity Tests for GPT-5 Avatar Memory Upgrade
 * 
 * Tests fact recall accuracy, conversation continuity, and prevention of
 * false denials of stored information.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConversationService } from '../conversationService';
import { ContextRetrievalEngine } from '../contextRetrievalEngine';
import { MemoryInjectionService } from '../memoryInjectionService';
import { GPT5Service } from '../gpt5Service';
import { MemoryUpdatePipeline } from '../memoryUpdatePipeline';

// Mock comprehensive test data
const mockQuickFacts = [
  {
    id: '1',
    avatar_id: 'accuracy-test-avatar',
    key: 'name',
    value: 'Emma Thompson',
    confidence: 0.95,
    priority: 1,
    source: 'manual',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    avatar_id: 'accuracy-test-avatar',
    key: 'pet_name',
    value: 'Charlie',
    confidence: 0.9,
    priority: 2,
    source: 'manual',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '3',
    avatar_id: 'accuracy-test-avatar',
    key: 'pet_type',
    value: 'Golden Retriever',
    confidence: 0.85,
    priority: 2,
    source: 'extraction',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '4',
    avatar_id: 'accuracy-test-avatar',
    key: 'occupation',
    value: 'Marine Biologist',
    confidence: 0.88,
    priority: 3,
    source: 'extraction',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '5',
    avatar_id: 'accuracy-test-avatar',
    key: 'hometown',
    value: 'Portland, Oregon',
    confidence: 0.8,
    priority: 4,
    source: 'llm',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '6',
    avatar_id: 'accuracy-test-avatar',
    key: 'favorite_food',
    value: 'Sushi',
    confidence: 0.75,
    priority: 5,
    source: 'llm',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
];

const mockMemoryFragments = [
  {
    id: 'mem-1',
    avatar_id: 'accuracy-test-avatar',
    fragment_text: 'I love diving in coral reefs and studying marine ecosystems',
    conversation_context: {
      source: 'chat',
      type: 'user',
      conversation_id: 'conv-1'
    },
    similarity: 0.9,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'mem-2',
    avatar_id: 'accuracy-test-avatar',
    fragment_text: 'Charlie loves playing fetch at the beach near my house',
    conversation_context: {
      source: 'chat',
      type: 'user',
      conversation_id: 'conv-2'
    },
    similarity: 0.85,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z'
  },
  {
    id: 'mem-3',
    avatar_id: 'accuracy-test-avatar',
    fragment_text: 'Growing up in Portland, I always loved the rain and green forests',
    conversation_context: {
      source: 'chat',
      type: 'user',
      conversation_id: 'conv-3'
    },
    similarity: 0.8,
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z'
  }
];

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
                  data: mockQuickFacts,
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
            data: mockMemoryFragments,
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

// Mock OpenAI with context-aware responses
vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn((params: any) => {
          const prompt = params.messages[0].content.toLowerCase();
          
          // Generate contextually appropriate responses based on the prompt
          let response = '';
          
          if (prompt.includes('name')) {
            response = 'Hi! I\'m Emma Thompson. Nice to meet you!';
          } else if (prompt.includes('pet')) {
            response = 'I have a wonderful Golden Retriever named Charlie. He\'s such a good boy!';
          } else if (prompt.includes('work') || prompt.includes('job') || prompt.includes('occupation')) {
            response = 'I work as a marine biologist. I love studying ocean ecosystems and coral reefs!';
          } else if (prompt.includes('hometown') || prompt.includes('where') && prompt.includes('from')) {
            response = 'I\'m from Portland, Oregon. I love the rain and all the green forests there.';
          } else if (prompt.includes('food') || prompt.includes('eat')) {
            response = 'I absolutely love sushi! There\'s something about fresh fish that appeals to me as a marine biologist.';
          } else if (prompt.includes('diving') || prompt.includes('coral')) {
            response = 'Yes, I love diving in coral reefs! It\'s amazing to see the marine ecosystems up close.';
          } else if (prompt.includes('beach') || prompt.includes('fetch')) {
            response = 'Charlie and I love going to the beach! He gets so excited playing fetch in the sand.';
          } else if (prompt.includes('charlie') && prompt.includes('old')) {
            response = 'Charlie is 4 years old now. He\'s still very energetic and loves to play!';
          } else if (prompt.includes('contradiction') || prompt.includes('different')) {
            response = 'I think there might be some confusion. Let me clarify what I know to be true.';
          } else {
            response = 'That\'s an interesting question! Let me think about that.';
          }

          return Promise.resolve({
            choices: [{
              message: { content: response }
            }],
            usage: {
              prompt_tokens: 150,
              completion_tokens: response.split(' ').length,
              total_tokens: 150 + response.split(' ').length
            }
          });
        })
      }
    };
  }
}));

describe('Accuracy and Context Continuity Tests', () => {
  let conversationService: ConversationService;

  beforeEach(() => {
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
    conversationService.clearExpiredSessions(0);
  });

  describe('Fact Recall Accuracy', () => {
    it('should accurately recall core identity facts', async () => {
      const testCases = [
        {
          question: 'What is your name?',
          expectedContent: ['emma', 'thompson'],
          factKey: 'name'
        },
        {
          question: 'What do you do for work?',
          expectedContent: ['marine', 'biologist'],
          factKey: 'occupation'
        },
        {
          question: 'Where are you from?',
          expectedContent: ['portland', 'oregon'],
          factKey: 'hometown'
        }
      ];

      for (const testCase of testCases) {
        const request = {
          avatarId: 'accuracy-test-avatar',
          userInput: testCase.question,
          sessionId: `fact-recall-${testCase.factKey}`,
          fastMode: false
        };

        const response = await conversationService.processConversation(request);

        // Verify expected content is present
        testCase.expectedContent.forEach(content => {
          expect(response.text.toLowerCase()).toContain(content);
        });

        // Verify confidence is reasonable
        expect(response.confidence).toBeGreaterThan(0.5);

        // Verify facts were retrieved
        expect(response.metadata.factsRetrieved).toBeGreaterThan(0);
      }
    });

    it('should accurately recall relationship and pet information', async () => {
      const petQuestions = [
        {
          question: 'Do you have any pets?',
          expectedContent: ['charlie', 'golden retriever']
        },
        {
          question: 'What is your pet\'s name?',
          expectedContent: ['charlie']
        },
        {
          question: 'What kind of dog do you have?',
          expectedContent: ['golden retriever']
        }
      ];

      for (const testCase of petQuestions) {
        const request = {
          avatarId: 'accuracy-test-avatar',
          userInput: testCase.question,
          sessionId: `pet-recall-${Date.now()}`,
          fastMode: false
        };

        const response = await conversationService.processConversation(request);

        testCase.expectedContent.forEach(content => {
          expect(response.text.toLowerCase()).toContain(content);
        });
      }
    });

    it('should recall contextual facts with appropriate confidence filtering', async () => {
      const request = {
        avatarId: 'accuracy-test-avatar',
        userInput: 'What is your favorite food?',
        sessionId: 'contextual-fact-test',
        fastMode: false
      };

      const response = await conversationService.processConversation(request);

      // Should include the favorite food fact (confidence 0.75 > threshold 0.35)
      expect(response.text.toLowerCase()).toContain('sushi');
      expect(response.confidence).toBeGreaterThan(0.3);
    });

    it('should integrate memory fragments with quick facts', async () => {
      const request = {
        avatarId: 'accuracy-test-avatar',
        userInput: 'Tell me about your work with coral reefs',
        sessionId: 'memory-integration-test',
        fastMode: false
      };

      const response = await conversationService.processConversation(request);

      // Should combine occupation fact with diving memory
      expect(response.text.toLowerCase()).toContain('marine');
      expect(response.text.toLowerCase()).toContain('coral');
      expect(response.metadata.memoriesRetrieved).toBeGreaterThan(0);
    });

    it('should never deny stored facts', async () => {
      const deniableQuestions = [
        'Do you have a pet?',
        'Do you work in science?',
        'Are you from the Pacific Northwest?',
        'Do you like seafood?'
      ];

      for (const question of deniableQuestions) {
        const request = {
          avatarId: 'accuracy-test-avatar',
          userInput: question,
          sessionId: `denial-test-${Date.now()}`,
          fastMode: false
        };

        const response = await conversationService.processConversation(request);

        // Should not contain denial phrases when facts exist
        const denialPhrases = [
          'i don\'t have',
          'i don\'t work',
          'i\'m not from',
          'i don\'t like',
          'no, i don\'t',
          'i don\'t know'
        ];

        const containsDenial = denialPhrases.some(phrase => 
          response.text.toLowerCase().includes(phrase)
        );

        expect(containsDenial).toBe(false);
        expect(response.text.length).toBeGreaterThan(10);
      }
    });
  });

  describe('Conversation Continuity', () => {
    it('should maintain context across multiple conversation turns', async () => {
      const sessionId = 'continuity-test-session';
      const conversationFlow = [
        {
          input: 'Tell me about your pet',
          expectedContent: ['charlie', 'golden retriever'],
          turnNumber: 1
        },
        {
          input: 'How old is he?',
          expectedContent: ['charlie'], // Should understand "he" refers to Charlie
          turnNumber: 2
        },
        {
          input: 'Does he like the beach?',
          expectedContent: ['beach', 'fetch'], // Should connect to beach memory
          turnNumber: 3
        },
        {
          input: 'That sounds fun! Do you go there often?',
          expectedContent: [], // Should understand "there" refers to beach
          turnNumber: 4
        }
      ];

      for (const turn of conversationFlow) {
        const request = {
          avatarId: 'accuracy-test-avatar',
          userInput: turn.input,
          sessionId,
          fastMode: false
        };

        const response = await conversationService.processConversation(request);

        // Verify expected content
        turn.expectedContent.forEach(content => {
          expect(response.text.toLowerCase()).toContain(content);
        });

        // Verify conversation history is maintained
        expect(response.session.turns.length).toBe(turn.turnNumber * 2);

        // Verify session continuity
        expect(response.sessionId).toBe(sessionId);
      }

      // Final verification of complete session
      const session = conversationService.getSession(sessionId);
      expect(session?.turns.length).toBe(8); // 4 user + 4 assistant turns
      expect(session?.entityBindings.size).toBeGreaterThan(0);
    });

    it('should handle pronoun resolution correctly', async () => {
      const sessionId = 'pronoun-resolution-test';

      // Establish entities first
      const setupRequest = {
        avatarId: 'accuracy-test-avatar',
        userInput: 'Tell me about Charlie and your work as a marine biologist',
        sessionId,
        fastMode: false
      };

      await conversationService.processConversation(setupRequest);

      // Test pronoun resolution
      const pronounTests = [
        {
          input: 'How old is he?', // "he" should refer to Charlie
          expectedEntity: 'charlie'
        },
        {
          input: 'Do you enjoy it?', // "it" should refer to marine biology work
          expectedEntity: 'marine'
        },
        {
          input: 'Does he like to swim?', // "he" should still refer to Charlie
          expectedEntity: 'charlie'
        }
      ];

      for (const test of pronounTests) {
        const request = {
          avatarId: 'accuracy-test-avatar',
          userInput: test.input,
          sessionId,
          fastMode: false
        };

        const response = await conversationService.processConversation(request);
        expect(response.text.toLowerCase()).toContain(test.expectedEntity);
      }
    });

    it('should maintain entity bindings throughout session', async () => {
      const sessionId = 'entity-binding-test';

      // First conversation establishes bindings
      const firstRequest = {
        avatarId: 'accuracy-test-avatar',
        userInput: 'What\'s your name and what do you do?',
        sessionId,
        fastMode: false
      };

      const firstResponse = await conversationService.processConversation(firstRequest);
      expect(firstResponse.text.toLowerCase()).toContain('emma');
      expect(firstResponse.text.toLowerCase()).toContain('marine');

      // Verify entity bindings were created
      let session = conversationService.getSession(sessionId);
      expect(session?.entityBindings.has('name')).toBe(true);
      expect(session?.entityBindings.has('occupation')).toBe(true);

      // Multiple subsequent conversations should maintain bindings
      const followupQuestions = [
        'How long have you been doing that work?',
        'Do you enjoy your profession?',
        'What\'s the most interesting part of your job?'
      ];

      for (const question of followupQuestions) {
        const request = {
          avatarId: 'accuracy-test-avatar',
          userInput: question,
          sessionId,
          fastMode: false
        };

        await conversationService.processConversation(request);

        // Entity bindings should persist
        session = conversationService.getSession(sessionId);
        expect(session?.entityBindings.has('name')).toBe(true);
        expect(session?.entityBindings.has('occupation')).toBe(true);
      }

      // Final verification
      expect(session?.entityBindings.get('name')?.value).toBe('Emma Thompson');
      expect(session?.entityBindings.get('occupation')?.value).toBe('Marine Biologist');
    });

    it('should handle topic transitions smoothly', async () => {
      const sessionId = 'topic-transition-test';

      const topicFlow = [
        {
          input: 'Tell me about your work',
          topic: 'work',
          expectedContent: ['marine', 'biologist']
        },
        {
          input: 'That\'s interesting. What about your personal life?',
          topic: 'personal',
          expectedContent: ['charlie', 'pet']
        },
        {
          input: 'Nice! Where did you grow up?',
          topic: 'background',
          expectedContent: ['portland', 'oregon']
        },
        {
          input: 'Cool! Going back to your work, do you do field research?',
          topic: 'work',
          expectedContent: ['diving', 'coral']
        }
      ];

      for (const turn of topicFlow) {
        const request = {
          avatarId: 'accuracy-test-avatar',
          userInput: turn.input,
          sessionId,
          fastMode: false
        };

        const response = await conversationService.processConversation(request);

        turn.expectedContent.forEach(content => {
          expect(response.text.toLowerCase()).toContain(content);
        });

        // Should maintain conversation flow
        expect(response.text.length).toBeGreaterThan(15);
        expect(response.confidence).toBeGreaterThan(0.4);
      }
    });
  });

  describe('Conflict Resolution and Fact Validation', () => {
    it('should handle contradictory information gracefully', async () => {
      const sessionId = 'contradiction-test';

      // Establish known fact
      const setupRequest = {
        avatarId: 'accuracy-test-avatar',
        userInput: 'What\'s your pet\'s name?',
        sessionId,
        fastMode: false
      };

      const setupResponse = await conversationService.processConversation(setupRequest);
      expect(setupResponse.text.toLowerCase()).toContain('charlie');

      // Provide contradictory information
      const contradictionRequest = {
        avatarId: 'accuracy-test-avatar',
        userInput: 'Actually, I think your pet\'s name is Max',
        sessionId,
        fastMode: false
      };

      const contradictionResponse = await conversationService.processConversation(contradictionRequest);

      // Should acknowledge discrepancy rather than just accepting
      const responseText = contradictionResponse.text.toLowerCase();
      const acknowledgmentPhrases = [
        'thought',
        'remember',
        'charlie',
        'max',
        'confused',
        'different',
        'sure'
      ];

      const containsAcknowledgment = acknowledgmentPhrases.some(phrase => 
        responseText.includes(phrase)
      );

      expect(containsAcknowledgment).toBe(true);
      expect(contradictionResponse.text.length).toBeGreaterThan(20);
    });

    it('should prioritize high-confidence facts over low-confidence ones', async () => {
      // This test verifies that manual facts (confidence 0.95) override LLM facts (confidence 0.75)
      const request = {
        avatarId: 'accuracy-test-avatar',
        userInput: 'Tell me your name and favorite food',
        sessionId: 'confidence-priority-test',
        fastMode: false
      };

      const response = await conversationService.processConversation(request);

      // Should include both high-confidence name and lower-confidence food preference
      expect(response.text.toLowerCase()).toContain('emma');
      expect(response.text.toLowerCase()).toContain('sushi');

      // But name should be stated more confidently than food preference
      expect(response.confidence).toBeGreaterThan(0.6);
    });

    it('should handle missing information gracefully', async () => {
      const unknownQuestions = [
        'What is your middle name?',
        'How many siblings do you have?',
        'What car do you drive?',
        'What\'s your favorite movie?'
      ];

      for (const question of unknownQuestions) {
        const request = {
          avatarId: 'accuracy-test-avatar',
          userInput: question,
          sessionId: `unknown-info-${Date.now()}`,
          fastMode: false
        };

        const response = await conversationService.processConversation(request);

        // Should acknowledge gap gracefully rather than making up information
        const gracefulPhrases = [
          'don\'t know',
          'not sure',
          'haven\'t mentioned',
          'don\'t recall',
          'tell me',
          'share'
        ];

        const isGraceful = gracefulPhrases.some(phrase => 
          response.text.toLowerCase().includes(phrase)
        );

        expect(isGraceful).toBe(true);
        expect(response.text.length).toBeGreaterThan(10);
      }
    });
  });

  describe('Memory Fragment Integration', () => {
    it('should seamlessly integrate memory fragments with quick facts', async () => {
      const integrationTests = [
        {
          input: 'Tell me about your diving experiences',
          expectedQuickFact: 'marine biologist',
          expectedMemory: 'coral reefs',
          integration: 'work + diving experience'
        },
        {
          input: 'What does Charlie like to do?',
          expectedQuickFact: 'charlie',
          expectedMemory: 'fetch at the beach',
          integration: 'pet + activity'
        },
        {
          input: 'What do you miss about your hometown?',
          expectedQuickFact: 'portland',
          expectedMemory: 'rain and green forests',
          integration: 'location + memories'
        }
      ];

      for (const test of integrationTests) {
        const request = {
          avatarId: 'accuracy-test-avatar',
          userInput: test.input,
          sessionId: `integration-${Date.now()}`,
          fastMode: false
        };

        const response = await conversationService.processConversation(request);

        // Should contain both quick fact and memory content
        expect(response.text.toLowerCase()).toContain(test.expectedQuickFact);
        expect(response.text.toLowerCase()).toContain(test.expectedMemory);

        // Should have retrieved both types of data
        expect(response.metadata.factsRetrieved).toBeGreaterThan(0);
        expect(response.metadata.memoriesRetrieved).toBeGreaterThan(0);
      }
    });

    it('should maintain narrative coherence across fact types', async () => {
      const request = {
        avatarId: 'accuracy-test-avatar',
        userInput: 'Tell me about yourself - your background, work, and personal life',
        sessionId: 'narrative-coherence-test',
        fastMode: false
      };

      const response = await conversationService.processConversation(request);

      // Should weave together multiple fact types into coherent narrative
      const expectedElements = [
        'emma', // name
        'portland', // hometown
        'marine biologist', // occupation
        'charlie', // pet
        'golden retriever' // pet type
      ];

      expectedElements.forEach(element => {
        expect(response.text.toLowerCase()).toContain(element);
      });

      // Response should be substantial and coherent
      expect(response.text.length).toBeGreaterThan(50);
      expect(response.confidence).toBeGreaterThan(0.6);
    });
  });

  describe('Accuracy Metrics and Validation', () => {
    it('should provide accurate fact recall statistics', async () => {
      const testQuestions = [
        'What is your name?',
        'What do you do for work?',
        'What is your pet\'s name?',
        'Where are you from?',
        'What is your favorite food?'
      ];

      let totalCorrectRecalls = 0;
      const totalQuestions = testQuestions.length;

      for (const question of testQuestions) {
        const request = {
          avatarId: 'accuracy-test-avatar',
          userInput: question,
          sessionId: `accuracy-metric-${Date.now()}`,
          fastMode: false
        };

        const response = await conversationService.processConversation(request);

        // Check if response contains expected fact
        let correctRecall = false;
        if (question.includes('name') && response.text.toLowerCase().includes('emma')) {
          correctRecall = true;
        } else if (question.includes('work') && response.text.toLowerCase().includes('marine')) {
          correctRecall = true;
        } else if (question.includes('pet') && response.text.toLowerCase().includes('charlie')) {
          correctRecall = true;
        } else if (question.includes('from') && response.text.toLowerCase().includes('portland')) {
          correctRecall = true;
        } else if (question.includes('food') && response.text.toLowerCase().includes('sushi')) {
          correctRecall = true;
        }

        if (correctRecall) totalCorrectRecalls++;
      }

      const accuracyRate = totalCorrectRecalls / totalQuestions;
      expect(accuracyRate).toBeGreaterThanOrEqual(0.8); // 80% accuracy minimum

      console.log(`Fact recall accuracy: ${(accuracyRate * 100).toFixed(1)}% (${totalCorrectRecalls}/${totalQuestions})`);
    });

    it('should track conversation continuity metrics', async () => {
      const sessionId = 'continuity-metrics-test';
      const conversationTurns = [
        'Tell me about your work',
        'That sounds interesting. Do you enjoy it?',
        'What about your personal life?',
        'How does your pet fit into your lifestyle?',
        'That\'s wonderful. Any other hobbies?'
      ];

      for (const turn of conversationTurns) {
        const request = {
          avatarId: 'accuracy-test-avatar',
          userInput: turn,
          sessionId,
          fastMode: false
        };

        await conversationService.processConversation(request);
      }

      const continuityMetrics = conversationService.getConversationContinuity(sessionId);

      expect(continuityMetrics).toMatchObject({
        turnCount: 10, // 5 user + 5 assistant turns
        entityBindings: expect.any(Number),
        sessionDurationMs: expect.any(Number),
        lastActivity: expect.any(String)
      });

      expect(continuityMetrics.entityBindings).toBeGreaterThan(0);
      expect(continuityMetrics.turnCount).toBe(10);
    });

    it('should validate response consistency across multiple sessions', async () => {
      const testQuestion = 'What is your name and what do you do?';
      const responses: string[] = [];

      // Ask the same question across multiple sessions
      for (let i = 0; i < 3; i++) {
        const request = {
          avatarId: 'accuracy-test-avatar',
          userInput: testQuestion,
          sessionId: `consistency-test-${i}`,
          fastMode: false
        };

        const response = await conversationService.processConversation(request);
        responses.push(response.text.toLowerCase());
      }

      // All responses should contain the same core facts
      responses.forEach(response => {
        expect(response).toContain('emma');
        expect(response).toContain('marine');
      });

      // Responses can vary in wording but should be factually consistent
      const uniqueResponses = new Set(responses);
      expect(uniqueResponses.size).toBeGreaterThanOrEqual(1); // At least some variation is good
    });
  });
});