import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextFallbackService } from '../contextFallbackService';
import { ErrorHandlingService } from '../errorHandlingService';
import { StructuredContext, QuickFact, MemoryFragment, ConversationTurn } from '../types';

describe('ContextFallbackService', () => {
  let fallbackService: ContextFallbackService;
  let mockErrorHandler: ErrorHandlingService;

  const mockQuickFacts: QuickFact[] = [
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
  ];

  const mockMemoryFragments: MemoryFragment[] = [
    {
      id: '1',
      avatarId: 'avatar1',
      fragmentText: 'User likes coffee in the morning',
      conversationContext: {
        source: 'conversation',
        type: 'user',
        conversationId: 'conv1'
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    }
  ];

  const mockConversationHistory: ConversationTurn[] = [
    {
      role: 'user',
      content: 'Hello there',
      timestamp: '2024-01-01T10:00:00Z'
    },
    {
      role: 'assistant',
      content: 'Hi John! How are you today?',
      timestamp: '2024-01-01T10:00:01Z'
    }
  ];

  beforeEach(() => {
    mockErrorHandler = new ErrorHandlingService();
    fallbackService = new ContextFallbackService(mockErrorHandler);
  });

  describe('getFallbackContext', () => {
    it('should return cached context when available', async () => {
      const mockCachedContext: StructuredContext = {
        quickFacts: mockQuickFacts,
        memoryFragments: mockMemoryFragments,
        conversationHistory: mockConversationHistory,
        retrievalMetadata: {
          source: 'cache',
          timestamp: '2024-01-01T00:00:00Z',
          totalFacts: 1,
          totalMemories: 1,
          totalHistory: 2
        }
      };

      vi.spyOn(mockErrorHandler, 'getCachedContext').mockReturnValue(mockCachedContext);

      const result = await fallbackService.getFallbackContext(
        'avatar1',
        'test query',
        new Error('Database connection failed')
      );

      expect(result).toBeDefined();
      expect(result.quickFacts).toEqual(mockQuickFacts);
      expect(result.retrievalMetadata.source).toBe('cache_fallback');
      expect(result.retrievalMetadata.fallbackReason).toBe('Database connection failed');
    });

    it('should return partial context from individual cached components', async () => {
      vi.spyOn(mockErrorHandler, 'getCachedContext').mockReturnValue(null);
      vi.spyOn(mockErrorHandler, 'getCachedData')
        .mockImplementation((key: string) => {
          if (key === 'quickfacts:avatar1') return mockQuickFacts;
          if (key === 'memories:avatar1') return mockMemoryFragments;
          if (key === 'history:avatar1') return [];
          return null;
        });

      const result = await fallbackService.getFallbackContext(
        'avatar1',
        'test query',
        new Error('Partial failure')
      );

      expect(result).toBeDefined();
      expect(result.quickFacts).toEqual(mockQuickFacts);
      expect(result.memoryFragments).toEqual(mockMemoryFragments);
      expect(result.conversationHistory).toEqual([]);
      expect(result.retrievalMetadata.source).toBe('partial_cache_fallback');
    });

    it('should return emergency context when no cache available', async () => {
      vi.spyOn(mockErrorHandler, 'getCachedContext').mockReturnValue(null);
      vi.spyOn(mockErrorHandler, 'getCachedData').mockReturnValue(null);

      const result = await fallbackService.getFallbackContext(
        'avatar1',
        'test query',
        new Error('Complete failure')
      );

      expect(result).toBeDefined();
      expect(result.quickFacts).toHaveLength(2); // Emergency facts
      expect(result.memoryFragments).toEqual([]);
      expect(result.conversationHistory).toEqual([]);
      expect(result.retrievalMetadata.source).toBe('emergency_fallback');
      expect(result.quickFacts[0].key).toBe('identity');
    });
  });

  describe('validateFallbackContext', () => {
    it('should validate high quality context', () => {
      const context: StructuredContext = {
        quickFacts: [
          ...mockQuickFacts,
          { id: '2', avatarId: 'avatar1', key: 'age', value: '30', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
          { id: '3', avatarId: 'avatar1', key: 'location', value: 'New York', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
          { id: '4', avatarId: 'avatar1', key: 'job', value: 'Engineer', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
          { id: '5', avatarId: 'avatar1', key: 'city', value: 'Boston', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' }
        ],
        memoryFragments: mockMemoryFragments,
        conversationHistory: mockConversationHistory,
        retrievalMetadata: {
          source: 'database',
          timestamp: '2024-01-01T00:00:00Z',
          totalFacts: 5,
          totalMemories: 1,
          totalHistory: 2
        }
      };

      const validation = fallbackService.validateFallbackContext(context);

      expect(validation.isValid).toBe(true);
      expect(validation.quality).toBe('high');
      expect(validation.warnings).toHaveLength(0);
    });

    it('should detect low quality context', () => {
      const context: StructuredContext = {
        quickFacts: [],
        memoryFragments: [],
        conversationHistory: [],
        retrievalMetadata: {
          source: 'emergency_fallback',
          timestamp: '2024-01-01T00:00:00Z',
          totalFacts: 0,
          totalMemories: 0,
          totalHistory: 0
        }
      };

      const validation = fallbackService.validateFallbackContext(context);

      expect(validation.isValid).toBe(false);
      expect(validation.quality).toBe('minimal');
      expect(validation.warnings).toContain('No context data available');
    });

    it('should detect missing identity information', () => {
      const context: StructuredContext = {
        quickFacts: [
          { id: '1', avatarId: 'avatar1', key: 'hobby', value: 'reading', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' }
        ],
        memoryFragments: [],
        conversationHistory: [],
        retrievalMetadata: {
          source: 'database',
          timestamp: '2024-01-01T00:00:00Z',
          totalFacts: 1,
          totalMemories: 0,
          totalHistory: 0
        }
      };

      const validation = fallbackService.validateFallbackContext(context);

      expect(validation.warnings).toContain('Missing essential identity information');
      expect(validation.quality).toBe('low'); // Only 1 item total, so low quality
    });

    it('should detect fallback context usage', () => {
      const context: StructuredContext = {
        quickFacts: mockQuickFacts,
        memoryFragments: [],
        conversationHistory: [],
        retrievalMetadata: {
          source: 'cache_fallback',
          timestamp: '2024-01-01T00:00:00Z',
          totalFacts: 1,
          totalMemories: 0,
          totalHistory: 0
        }
      };

      const validation = fallbackService.validateFallbackContext(context);

      expect(validation.warnings).toContain('Using fallback context - may be stale');
    });
  });

  describe('enhanceFallbackContext', () => {
    it('should enhance context with computed facts', () => {
      const context: StructuredContext = {
        quickFacts: mockQuickFacts,
        memoryFragments: mockMemoryFragments,
        conversationHistory: mockConversationHistory,
        retrievalMetadata: {
          source: 'cache_fallback',
          timestamp: '2024-01-01T00:00:00Z',
          totalFacts: 1,
          totalMemories: 1,
          totalHistory: 2
        }
      };

      const enhanced = fallbackService.enhanceFallbackContext(context);

      expect(enhanced.quickFacts.length).toBeGreaterThan(context.quickFacts.length);
      expect(enhanced.quickFacts.some(fact => fact.key === 'memory_count')).toBe(true);
      expect(enhanced.quickFacts.some(fact => fact.key === 'last_interaction')).toBe(true);
      expect(enhanced.retrievalMetadata.source).toBe('cache_fallback_enhanced');
    });

    it('should handle context with no memories or history', () => {
      const context: StructuredContext = {
        quickFacts: mockQuickFacts,
        memoryFragments: [],
        conversationHistory: [],
        retrievalMetadata: {
          source: 'emergency_fallback',
          timestamp: '2024-01-01T00:00:00Z',
          totalFacts: 1,
          totalMemories: 0,
          totalHistory: 0
        }
      };

      const enhanced = fallbackService.enhanceFallbackContext(context);

      expect(enhanced.quickFacts.length).toBe(context.quickFacts.length);
      expect(enhanced.retrievalMetadata.source).toBe('emergency_fallback_enhanced');
    });
  });
});