import { describe, it, expect, vi } from 'vitest';

// Mock OpenAI to prevent browser environment error
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  }))
}));

import { GPT5Service, StructuredContext } from '../gpt5Service';

describe('GPT5Service - Integration Tests', () => {
  it('should create service with default configuration', () => {
    const service = new GPT5Service();
    expect(service).toBeDefined();
    expect(service['config'].primaryModel).toBe('gpt-4o');
    expect(service['config'].fallbackModel).toBe('gpt-4o-mini');
    expect(service['config'].maxTokens).toBe(500);
    expect(service['config'].temperature).toBe(0.7);
    expect(service['config'].timeout).toBe(10000);
    expect(service['config'].maxRetries).toBe(3);
    expect(service['config'].confidenceThreshold).toBe(0.7);
  });

  it('should create service with custom configuration', () => {
    const customConfig = {
      primaryModel: 'gpt-5',
      fallbackModel: 'gpt-4',
      maxTokens: 1000,
      temperature: 0.5,
      timeout: 15000,
      maxRetries: 5,
      confidenceThreshold: 0.8
    };

    const service = new GPT5Service(customConfig);
    expect(service['config']).toMatchObject(customConfig);
  });

  it('should validate responses correctly', () => {
    const service = new GPT5Service();
    const mockContext: StructuredContext = {
      quickFacts: [
        {
          id: '1',
          key: 'pet_name',
          value: 'Romeo',
          confidence: 0.9,
          priority: 1,
          source: 'manual',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          category: 'pets'
        }
      ],
      memoryFragments: [
        {
          id: 'mem1',
          fragment_text: 'Romeo loves chasing butterflies.',
          similarity: 0.8,
          created_at: '2024-01-01T00:00:00Z'
        }
      ],
      conversationHistory: [],
      retrievalMetadata: {
        avatarId: 'avatar1',
        query: 'test',
        retrievalTime: 100,
        factsCount: 1,
        memoriesCount: 1,
        historyCount: 0
      }
    };

    // Test valid response
    const goodResponse = 'Romeo is my beloved dog who loves chasing butterflies.';
    expect(service.validateResponse(goodResponse, mockContext)).toBe(true);

    // Test empty response
    const emptyResponse = '';
    expect(service.validateResponse(emptyResponse, mockContext)).toBe(false);

    // Test denial response with context (should be false)
    const denialResponse = 'I don\'t have access to information about pets.';
    expect(service.validateResponse(denialResponse, mockContext)).toBe(false);

    // Test denial response without context (should be true)
    const emptyContext: StructuredContext = {
      quickFacts: [],
      memoryFragments: [],
      conversationHistory: [],
      retrievalMetadata: {
        avatarId: 'avatar1',
        query: 'test',
        retrievalTime: 100,
        factsCount: 0,
        memoriesCount: 0,
        historyCount: 0
      }
    };
    expect(service.validateResponse(denialResponse, emptyContext)).toBe(true);
  });

  it('should format context correctly', () => {
    const service = new GPT5Service();
    const mockContext: StructuredContext = {
      quickFacts: [
        {
          id: '1',
          key: 'pet_name',
          value: 'Romeo',
          confidence: 0.9,
          priority: 1,
          source: 'manual',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          category: 'identity'
        },
        {
          id: '2',
          key: 'birth_place',
          value: 'Valencia, Spain',
          confidence: 0.8,
          priority: 3,
          source: 'extraction',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          category: 'places'
        }
      ],
      memoryFragments: [
        {
          id: 'mem1',
          fragment_text: 'Romeo loves chasing butterflies in the garden.',
          similarity: 0.8,
          created_at: '2024-01-01T00:00:00Z',
          title: 'Romeo playing'
        }
      ],
      conversationHistory: [
        {
          role: 'user',
          content: 'Tell me about your dog',
          timestamp: '2024-01-01T00:00:00Z'
        }
      ],
      retrievalMetadata: {
        avatarId: 'avatar1',
        query: 'Tell me about your dog',
        retrievalTime: 100,
        factsCount: 2,
        memoriesCount: 1,
        historyCount: 1
      }
    };

    // Access the private method for testing
    const formattedContext = service['formatContextForGPT5'](mockContext);

    expect(formattedContext).toContain('## Core Identity');
    expect(formattedContext).toContain('pet_name: Romeo');
    expect(formattedContext).toContain('## Personal Facts');
    expect(formattedContext).toContain('birth_place: Valencia, Spain');
    expect(formattedContext).toContain('## Relevant Memories');
    expect(formattedContext).toContain('Romeo loves chasing butterflies');
    expect(formattedContext).toContain('Title: Romeo playing');
    expect(formattedContext).toContain('## Recent Conversation');
    expect(formattedContext).toContain('user: Tell me about your dog');
    expect(formattedContext).toContain('## Instructions');
    expect(formattedContext).toContain('Respond as this person based on the provided facts');
  });

  it('should handle empty context sections gracefully', () => {
    const service = new GPT5Service();
    const emptyContext: StructuredContext = {
      quickFacts: [],
      memoryFragments: [],
      conversationHistory: [],
      retrievalMetadata: {
        avatarId: 'avatar1',
        query: 'test',
        retrievalTime: 100,
        factsCount: 0,
        memoriesCount: 0,
        historyCount: 0
      }
    };

    const formattedContext = service['formatContextForGPT5'](emptyContext);

    expect(formattedContext).toContain('## Instructions');
    expect(formattedContext).not.toContain('## Core Identity');
    expect(formattedContext).not.toContain('## Personal Facts');
    expect(formattedContext).not.toContain('## Relevant Memories');
    expect(formattedContext).not.toContain('## Recent Conversation');
  });
});