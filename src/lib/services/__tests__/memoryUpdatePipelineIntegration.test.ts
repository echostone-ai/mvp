/**
 * Integration tests for MemoryUpdatePipeline
 * 
 * Tests the complete pipeline integration with fact extraction and database operations
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MemoryUpdatePipeline, ConversationContext } from '../memoryUpdatePipeline';

// Mock the entire supabase module
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
          })),
          limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
        })),
        limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      }))
    }))
  }
}));

// Mock FactExtractionEngine with realistic responses
vi.mock('../factExtractionEngine', () => ({
  FactExtractionEngine: vi.fn(() => ({
    extractFacts: vi.fn()
  }))
}));

describe('MemoryUpdatePipeline Integration', () => {
  let pipeline: MemoryUpdatePipeline;
  let mockFactExtractionEngine: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Create a mock that will be returned by the FactExtractionEngine constructor
    mockFactExtractionEngine = {
      extractFacts: vi.fn()
    };
    
    // Mock the FactExtractionEngine constructor to return our mock
    const { FactExtractionEngine } = await import('../factExtractionEngine');
    vi.mocked(FactExtractionEngine).mockImplementation(() => mockFactExtractionEngine);
    
    pipeline = new MemoryUpdatePipeline();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('End-to-end conversation processing', () => {
    it('should process a complete conversation with personal information', async () => {
      // Mock realistic fact extraction results
      mockFactExtractionEngine.extractFacts.mockResolvedValue({
        facts: [
          {
            key: 'name',
            value: 'Alice Johnson',
            confidence: 0.95,
            source_text: 'My name is Alice Johnson',
            extraction_method: 'pattern'
          },
          {
            key: 'occupation',
            value: 'software engineer',
            confidence: 0.9,
            source_text: 'I work as a software engineer',
            extraction_method: 'pattern'
          },
          {
            key: 'location',
            value: 'San Francisco',
            confidence: 0.85,
            source_text: 'I live in San Francisco',
            extraction_method: 'pattern'
          },
          {
            key: 'pet_name',
            value: 'Buddy',
            confidence: 0.8,
            source_text: 'my dog Buddy',
            extraction_method: 'pattern'
          }
        ],
        processing_time_ms: 150,
        errors: []
      });

      const context: ConversationContext = {
        conversationId: 'conv-integration-1',
        visitorId: 'visitor-alice',
        sessionId: 'session-alice-1',
        userInput: 'Hi! My name is Alice Johnson and I work as a software engineer in San Francisco. I have a dog named Buddy who loves going to the park.',
        assistantResponse: 'Nice to meet you, Alice! It sounds like you have a great life in San Francisco with Buddy. Software engineering is such an interesting field!',
        timestamp: '2024-01-15T10:00:00Z',
        metadata: {
          conversationType: 'introduction',
          userEmotion: 'friendly'
        }
      };

      const result = await pipeline.processConversationTurn('avatar-alice-123', context);

      // Verify the results
      expect(result.factsExtracted).toBe(4);
      expect(result.factsUpdated).toBe(4); // All facts should be new
      expect(result.memoriesCreated).toBe(1); // One memory fragment created
      expect(result.conflicts).toHaveLength(0); // No conflicts for new facts
      expect(result.errors).toHaveLength(0);
      expect(result.processingTimeMs).toBeGreaterThan(0);

      // Verify fact extraction was called with correct parameters
      expect(mockFactExtractionEngine.extractFacts).toHaveBeenCalledWith(
        'User: Hi! My name is Alice Johnson and I work as a software engineer in San Francisco. I have a dog named Buddy who loves going to the park.\nAssistant: Nice to meet you, Alice! It sounds like you have a great life in San Francisco with Buddy. Software engineering is such an interesting field!',
        'avatar-alice-123'
      );
    });

    it('should handle conversation updates with conflicting information', async () => {
      // First, mock existing facts in the database
      const { supabase } = await import('@/lib/supabase');
      const existingFact = {
        id: 'fact-location-123',
        avatar_id: 'avatar-alice-123',
        key: 'location',
        value: 'San Francisco',
        confidence: 0.8,
        priority: 3,
        source: 'extraction',
        source_reference: 'Previous conversation',
        created_at: '2024-01-14T10:00:00Z',
        updated_at: '2024-01-14T10:00:00Z'
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [existingFact], error: null }))
            }))
          }))
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null }))
        })),
        insert: vi.fn(() => Promise.resolve({ error: null }))
      } as any);

      // Mock new fact extraction with conflicting location
      mockFactExtractionEngine.extractFacts.mockResolvedValue({
        facts: [
          {
            key: 'location',
            value: 'New York',
            confidence: 0.95, // Higher confidence
            source_text: 'I moved to New York last month',
            extraction_method: 'pattern'
          }
        ],
        processing_time_ms: 100,
        errors: []
      });

      const context: ConversationContext = {
        conversationId: 'conv-integration-2',
        visitorId: 'visitor-alice',
        userInput: 'I moved to New York last month for a new job opportunity.',
        assistantResponse: 'That\'s exciting! How are you finding New York compared to your previous location?',
        timestamp: '2024-01-15T11:00:00Z'
      };

      const result = await pipeline.processConversationTurn('avatar-alice-123', context);

      // Verify conflict resolution
      expect(result.factsExtracted).toBe(1);
      expect(result.factsUpdated).toBe(1);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].key).toBe('location');
      expect(result.conflicts[0].resolution).toBe('update_with_new');
      expect(result.conflicts[0].reason).toContain('higher confidence');
    });

    it('should respect configuration settings', async () => {
      // Configure pipeline with strict settings
      const strictPipeline = new MemoryUpdatePipeline({
        confidenceThreshold: 0.9, // Very high threshold
        maxFactsPerUpdate: 2, // Limit to 2 facts
        enableMemoryFragments: false // Disable memory fragments
      });

      // Mock facts with varying confidence levels
      mockFactExtractionEngine.extractFacts.mockResolvedValue({
        facts: [
          {
            key: 'name',
            value: 'Bob Smith',
            confidence: 0.95, // Above threshold
            source_text: 'My name is Bob Smith',
            extraction_method: 'pattern'
          },
          {
            key: 'age',
            value: '30',
            confidence: 0.92, // Above threshold
            source_text: 'I am 30 years old',
            extraction_method: 'pattern'
          },
          {
            key: 'hobby',
            value: 'reading',
            confidence: 0.85, // Below threshold
            source_text: 'I like reading',
            extraction_method: 'llm'
          },
          {
            key: 'food_preference',
            value: 'pizza',
            confidence: 0.91, // Above threshold but should be limited
            source_text: 'I love pizza',
            extraction_method: 'pattern'
          }
        ],
        processing_time_ms: 120,
        errors: []
      });

      const context: ConversationContext = {
        conversationId: 'conv-strict-config',
        visitorId: 'visitor-bob',
        userInput: 'My name is Bob Smith, I am 30 years old, I like reading, and I love pizza.',
        assistantResponse: 'Nice to meet you, Bob! You have some great interests.',
        timestamp: '2024-01-15T12:00:00Z'
      };

      const result = await strictPipeline.processConversationTurn('avatar-bob-456', context);

      // Should only process 2 high-confidence facts due to maxFactsPerUpdate limit
      expect(result.factsExtracted).toBe(2);
      expect(result.factsUpdated).toBe(2);
      expect(result.memoriesCreated).toBe(0); // Memory fragments disabled
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      const { supabase } = await import('@/lib/supabase');
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: null, error: { message: 'Database connection failed' } }))
            }))
          }))
        })),
        insert: vi.fn(() => Promise.resolve({ error: { message: 'Insert failed' } }))
      } as any);

      mockFactExtractionEngine.extractFacts.mockResolvedValue({
        facts: [
          {
            key: 'name',
            value: 'Charlie Brown',
            confidence: 0.9,
            source_text: 'My name is Charlie Brown',
            extraction_method: 'pattern'
          }
        ],
        processing_time_ms: 80,
        errors: []
      });

      const context: ConversationContext = {
        conversationId: 'conv-db-error',
        visitorId: 'visitor-charlie',
        userInput: 'My name is Charlie Brown.',
        assistantResponse: 'Hello Charlie!',
        timestamp: '2024-01-15T13:00:00Z'
      };

      const result = await pipeline.processConversationTurn('avatar-charlie-789', context);

      // Should handle errors gracefully
      expect(result.factsExtracted).toBe(1);
      expect(result.factsUpdated).toBe(0); // Failed to update due to DB error
      expect(result.errors.length).toBeGreaterThan(0); // Should have memory fragment error
    });

    it('should process multiple conversation turns maintaining context', async () => {
      const conversationTurns = [
        {
          userInput: 'Hi, I\'m Sarah and I work at Google.',
          assistantResponse: 'Nice to meet you, Sarah! Google is a great company.',
          facts: [
            { key: 'name', value: 'Sarah', confidence: 0.95 },
            { key: 'company', value: 'Google', confidence: 0.9 }
          ]
        },
        {
          userInput: 'I have two cats named Whiskers and Shadow.',
          assistantResponse: 'Cats are wonderful pets! Tell me more about Whiskers and Shadow.',
          facts: [
            { key: 'pet_type', value: 'cats', confidence: 0.9 },
            { key: 'pet_count', value: '2', confidence: 0.95 },
            { key: 'pet_name_1', value: 'Whiskers', confidence: 0.9 },
            { key: 'pet_name_2', value: 'Shadow', confidence: 0.9 }
          ]
        },
        {
          userInput: 'Actually, I just got promoted to Senior Software Engineer!',
          assistantResponse: 'Congratulations on your promotion! That\'s fantastic news.',
          facts: [
            { key: 'job_title', value: 'Senior Software Engineer', confidence: 0.95 }
          ]
        }
      ];

      let totalFacts = 0;
      let totalMemories = 0;

      for (const [index, turn] of conversationTurns.entries()) {
        // Mock the extraction results for this turn
        mockFactExtractionEngine.extractFacts.mockResolvedValueOnce({
          facts: turn.facts.map(fact => ({
            ...fact,
            source_text: turn.userInput,
            extraction_method: 'pattern' as const
          })),
          processing_time_ms: 100 + index * 10,
          errors: []
        });

        const context: ConversationContext = {
          conversationId: `conv-multi-${index + 1}`,
          visitorId: 'visitor-sarah-multi',
          userInput: turn.userInput,
          assistantResponse: turn.assistantResponse,
          timestamp: new Date(Date.now() + index * 1000).toISOString()
        };

        const result = await pipeline.processConversationTurn('avatar-sarah-multi', context);

        totalFacts += result.factsExtracted;
        totalMemories += result.memoriesCreated;

        expect(result.errors).toHaveLength(0);
        expect(result.factsExtracted).toBe(turn.facts.length);
      }

      // Verify overall processing
      expect(totalFacts).toBe(7); // Total facts across all turns
      expect(totalMemories).toBe(3); // One memory per turn
    });
  });

  describe('Performance and reliability', () => {
    it('should complete processing within reasonable time limits', async () => {
      // Add a small delay to simulate processing time
      mockFactExtractionEngine.extractFacts.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          facts: [
            {
              key: 'name',
              value: 'Performance Test User',
              confidence: 0.9,
              source_text: 'Performance test',
              extraction_method: 'pattern'
            }
          ],
          processing_time_ms: 50,
          errors: []
        };
      });

      const context: ConversationContext = {
        conversationId: 'conv-performance',
        visitorId: 'visitor-perf',
        userInput: 'Performance test input',
        assistantResponse: 'Performance test response',
        timestamp: new Date().toISOString()
      };

      const startTime = Date.now();
      const result = await pipeline.processConversationTurn('avatar-perf', context);
      const endTime = Date.now();

      // Should complete within 1 second for simple processing
      expect(endTime - startTime).toBeLessThan(1000);
      expect(result.processingTimeMs).toBeGreaterThan(0);
      expect(result.processingTimeMs).toBeLessThan(500);
    });

    it('should handle concurrent processing requests', async () => {
      mockFactExtractionEngine.extractFacts.mockImplementation(async (text: string) => {
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          facts: [
            {
              key: 'concurrent_test',
              value: 'test_value',
              confidence: 0.8,
              source_text: text,
              extraction_method: 'pattern' as const
            }
          ],
          processing_time_ms: 50,
          errors: []
        };
      });

      // Create multiple concurrent requests
      const promises = Array.from({ length: 5 }, (_, index) => {
        const context: ConversationContext = {
          conversationId: `conv-concurrent-${index}`,
          visitorId: `visitor-concurrent-${index}`,
          userInput: `Concurrent test input ${index}`,
          assistantResponse: `Concurrent test response ${index}`,
          timestamp: new Date().toISOString()
        };

        return pipeline.processConversationTurn(`avatar-concurrent-${index}`, context);
      });

      const results = await Promise.all(promises);

      // All requests should complete successfully
      results.forEach((result, index) => {
        expect(result.factsExtracted).toBe(1);
        expect(result.errors).toHaveLength(0);
      });
    });
  });
});