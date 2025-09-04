import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GPT5ApiService } from '../gpt5ApiService';
import { ErrorHandlingService } from '../errorHandlingService';
import { StructuredContext } from '../types';

// Mock fetch globally
global.fetch = vi.fn();

describe('GPT5ApiService', () => {
  let gpt5Service: GPT5ApiService;
  let mockErrorHandler: ErrorHandlingService;

  const mockContext: StructuredContext = {
    quickFacts: [
      {
        id: '1',
        avatarId: 'avatar1',
        key: 'name',
        value: 'John Doe',
        confidence: 0.9,
        priority: 1,
        source: 'manual',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }
    ],
    memoryFragments: [],
    conversationHistory: [
      {
        role: 'user',
        content: 'Hello',
        timestamp: '2024-01-01T00:00:00Z'
      }
    ],
    retrievalMetadata: {
      source: 'database',
      timestamp: '2024-01-01T00:00:00Z',
      totalFacts: 1,
      totalMemories: 0,
      totalHistory: 1
    }
  };

  beforeEach(() => {
    mockErrorHandler = new ErrorHandlingService(
      { maxRetries: 1, baseDelay: 10, maxDelay: 100 }, // Fast retries for tests
      { maxCacheSize: 10 }
    );
    gpt5Service = new GPT5ApiService(
      {
        apiKey: 'test-key',
        model: 'gpt-5-turbo',
        fallbackModel: 'gpt-4-turbo-preview',
        timeout: 1000 // Shorter timeout for tests
      },
      mockErrorHandler
    );

    vi.clearAllMocks();
  });

  describe('generateResponse', () => {
    it('should generate response using GPT-5', async () => {
      const mockApiResponse = {
        choices: [
          {
            message: {
              content: 'Hello John! How can I help you today?',
              role: 'assistant'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 20,
          total_tokens: 70
        },
        model: 'gpt-5-turbo'
      };

      (fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      });

      const response = await gpt5Service.generateResponse(
        mockContext,
        'Hello there!'
      );

      expect(response.text).toBe('Hello John! How can I help you today?');
      expect(response.modelUsed).toBe('gpt-5-turbo');
      expect(response.confidence).toBeGreaterThan(0);
      expect(response.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should fallback to GPT-4 when GPT-5 fails', async () => {
      const mockGpt4Response = {
        choices: [
          {
            message: {
              content: 'Hi there! I can help you with that.',
              role: 'assistant'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 45,
          completion_tokens: 18,
          total_tokens: 63
        },
        model: 'gpt-4-turbo-preview'
      };

      // First call (GPT-5) fails, second call (GPT-4) succeeds
      (fetch as any)
        .mockRejectedValueOnce(new Error('GPT-5 unavailable'))
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockGpt4Response)
        });

      const response = await gpt5Service.generateResponse(
        mockContext,
        'Hello there!'
      );

      expect(response.text).toBe('Hi there! I can help you with that.');
      expect(response.modelUsed).toBe('gpt-4-turbo-preview (fallback)');
      expect(response.confidence).toBeLessThan(0.9); // Fallback has reduced confidence
    });

    it('should return emergency response when both models fail', async () => {
      (fetch as any).mockRejectedValue(new Error('API unavailable'));

      const response = await gpt5Service.generateResponse(
        mockContext,
        'Hello there!'
      );

      expect(response.text).toContain('technical difficulties');
      expect(response.modelUsed).toBe('emergency_fallback');
      expect(response.confidence).toBe(0.1);
      expect(response.extractedFacts).toEqual([]);
    }, 10000);

    it('should handle API timeout', async () => {
      (fetch as any).mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 2000)) // Longer than timeout
      );

      const response = await gpt5Service.generateResponse(
        mockContext,
        'Hello there!'
      );

      expect(response.modelUsed).toBe('emergency_fallback');
    }, 10000);

    it('should handle API error responses', async () => {
      (fetch as any).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: () => Promise.resolve({ error: 'Rate limit exceeded' })
      });

      const response = await gpt5Service.generateResponse(
        mockContext,
        'Hello there!'
      );

      expect(response.modelUsed).toBe('emergency_fallback');
    }, 10000);
  });

  describe('validateResponse', () => {
    it('should validate high quality response', () => {
      const response = {
        text: 'This is a well-formed response that provides helpful information.',
        confidence: 0.9,
        extractedFacts: [],
        modelUsed: 'gpt-5-turbo',
        processingTime: 1500
      };

      const validation = gpt5Service.validateResponse(response, mockContext);

      expect(validation.isValid).toBe(true);
      expect(validation.quality).toBe('high');
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect low quality response', () => {
      const response = {
        text: 'Short',
        confidence: 0.2,
        extractedFacts: [],
        modelUsed: 'gpt-5-turbo',
        processingTime: 15000
      };

      const validation = gpt5Service.validateResponse(response, mockContext);

      expect(validation.isValid).toBe(false);
      expect(validation.quality).toBe('low');
      expect(validation.issues).toContain('Response too short');
      expect(validation.issues).toContain('Low confidence response');
      expect(validation.issues).toContain('Slow response time');
    });

    it('should detect potential hallucination', () => {
      const response = {
        text: 'I can see you sitting there in your chair right now.',
        confidence: 0.8,
        extractedFacts: [],
        modelUsed: 'gpt-5-turbo',
        processingTime: 1000
      };

      const validation = gpt5Service.validateResponse(response, mockContext);

      expect(validation.quality).toBe('low');
      expect(validation.issues).toContain('Potential hallucination detected');
    });

    it('should detect name contradictions', () => {
      const response = {
        text: 'Hello! My name is Jane Smith.',
        confidence: 0.8,
        extractedFacts: [],
        modelUsed: 'gpt-5-turbo',
        processingTime: 1000
      };

      const validation = gpt5Service.validateResponse(response, mockContext);

      expect(validation.quality).toBe('low');
      expect(validation.issues).toContain('Potential hallucination detected');
    });
  });

  describe('fact extraction', () => {
    it('should extract facts from response text', async () => {
      const mockApiResponse = {
        choices: [
          {
            message: {
              content: 'Hi! My name is Alice and I am a software engineer.',
              role: 'assistant'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 20,
          total_tokens: 70
        },
        model: 'gpt-5-turbo'
      };

      (fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      });

      const response = await gpt5Service.generateResponse(
        mockContext,
        'What is your name?'
      );

      expect(response.extractedFacts).toHaveLength(1);
      expect(response.extractedFacts[0].key).toBe('name');
      expect(response.extractedFacts[0].value).toContain('Alice');
    });
  });

  describe('system prompt building', () => {
    it('should build comprehensive system prompt', async () => {
      const contextWithMemories: StructuredContext = {
        ...mockContext,
        quickFacts: [
          ...mockContext.quickFacts,
          {
            id: '2',
            avatarId: 'avatar1',
            key: 'hobby',
            value: 'reading',
            priority: 5,
            source: 'manual',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          }
        ],
        memoryFragments: [
          {
            id: '1',
            avatarId: 'avatar1',
            fragmentText: 'User mentioned they love science fiction books',
            conversationContext: {
              source: 'conversation',
              type: 'user',
              conversationId: 'conv1'
            },
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          }
        ]
      };

      const mockApiResponse = {
        choices: [
          {
            message: {
              content: 'Hello John! I remember you enjoy reading, especially science fiction.',
              role: 'assistant'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 25,
          total_tokens: 125
        },
        model: 'gpt-5-turbo'
      };

      (fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      });

      const response = await gpt5Service.generateResponse(
        contextWithMemories,
        'Hello!'
      );

      expect(response.text).toContain('John');
      expect(response.text).toContain('reading');
      expect(response.text).toContain('science fiction');
    });
  });
});