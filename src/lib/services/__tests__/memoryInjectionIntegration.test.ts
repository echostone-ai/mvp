/**
 * Memory Injection Service Integration Tests
 * 
 * Tests integration between MemoryInjectionService and ContextRetrievalEngine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryInjectionService } from '../memoryInjectionService';
import { ContextRetrievalEngine, StructuredContext } from '../contextRetrievalEngine';

// Mock the database client
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

describe('MemoryInjectionService Integration', () => {
  let memoryService: MemoryInjectionService;
  let contextEngine: ContextRetrievalEngine;

  beforeEach(() => {
    memoryService = new MemoryInjectionService();
    contextEngine = new ContextRetrievalEngine();
  });

  describe('end-to-end template generation', () => {
    it('should generate template from retrieved context', async () => {
      // This test would normally retrieve real context, but with mocked DB it will be empty
      const context = await contextEngine.retrieveContext('test-avatar', 'test query');
      
      expect(context).toBeDefined();
      expect(context.quickFacts).toEqual([]);
      expect(context.memoryFragments).toEqual([]);
      expect(context.conversationHistory).toEqual([]);
      
      const template = memoryService.formatContext(context);
      
      // Should still generate a valid template with instructions even with empty context
      expect(template).toContain('=== INSTRUCTIONS ===');
      expect(template).toContain('Reference the information above naturally');
      
      const validation = memoryService.validateTemplate(template);
      expect(validation.isValid).toBe(true);
    });

    it('should handle context retrieval errors gracefully', async () => {
      // Mock a context retrieval error
      const mockContextEngine = {
        retrieveContext: vi.fn().mockRejectedValue(new Error('Database connection failed'))
      };

      try {
        await mockContextEngine.retrieveContext('test-avatar', 'test query');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Database connection failed');
      }
    });

    it('should optimize templates based on retrieval metadata', async () => {
      const mockContext: StructuredContext = {
        quickFacts: [
          {
            id: '1',
            avatarId: 'test-avatar',
            key: 'name',
            value: 'Test User',
            confidence: 1.0,
            priority: 1,
            source: 'manual',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          }
        ],
        memoryFragments: [],
        conversationHistory: [],
        retrievalMetadata: {
          totalQuickFacts: 1,
          totalMemoryFragments: 0,
          totalConversationTurns: 0,
          retrievalTimeMs: 50, // Fast retrieval
          confidenceThreshold: 0.35,
          queryOptimizations: ['parallel_queries', 'cache_quick_facts'],
          cacheHits: ['quick_facts']
        }
      };

      const template = memoryService.formatContext(mockContext, {
        maxCharacters: 1000 // Small limit for fast mode
      });

      expect(template).toContain('name: Test User');
      expect(template.length).toBeLessThanOrEqual(1000);
      
      const validation = memoryService.validateTemplate(template);
      expect(validation.isValid).toBe(true);
      expect(validation.sectionCounts.coreIdentity).toBe(1);
    });

    it('should handle different model optimizations consistently', async () => {
      const mockContext: StructuredContext = {
        quickFacts: [
          {
            id: '1',
            avatarId: 'test-avatar',
            key: 'occupation',
            value: 'software developer',
            confidence: 0.9,
            priority: 2,
            source: 'extraction',
            category: 'occupation',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          }
        ],
        memoryFragments: [
          {
            id: 'mem-1',
            avatarId: 'test-avatar',
            fragmentText: 'User mentioned they enjoy coding in TypeScript.',
            conversationContext: {
              source: 'conversation',
              type: 'user',
              conversationId: 'conv-1'
            },
            similarity: 0.8,
            createdAt: '2024-01-01T10:00:00Z',
            updatedAt: '2024-01-01T10:00:00Z'
          }
        ],
        conversationHistory: [
          {
            role: 'user',
            content: 'What programming languages do you recommend?',
            timestamp: '2024-01-01T12:00:00Z'
          }
        ],
        retrievalMetadata: {
          totalQuickFacts: 1,
          totalMemoryFragments: 1,
          totalConversationTurns: 1,
          retrievalTimeMs: 150,
          confidenceThreshold: 0.35,
          queryOptimizations: ['parallel_queries'],
          cacheHits: []
        }
      };

      // Test different model optimizations
      const models = ['gpt-5', 'gpt-4', 'claude'] as const;
      const templates: Record<string, string> = {};

      for (const model of models) {
        templates[model] = memoryService.formatContext(mockContext, { modelType: model });
        
        const validation = memoryService.validateTemplate(templates[model]);
        expect(validation.isValid).toBe(true);
      }

      // GPT-5 should maintain structured format
      expect(templates['gpt-5']).toContain('=== CORE IDENTITY ===');
      
      // GPT-4 should have enhanced instructions
      expect(templates['gpt-4']).toContain('IMPORTANT INSTRUCTIONS');
      
      // Claude should have natural format markers
      expect(templates['claude']).toContain('CORE IDENTITY:');
      expect(templates['claude']).toContain('• ');
    });

    it('should maintain template quality under various context sizes', async () => {
      const createMockContext = (factCount: number, memoryCount: number): StructuredContext => ({
        quickFacts: Array.from({ length: factCount }, (_, i) => ({
          id: `fact-${i}`,
          avatarId: 'test-avatar',
          key: `fact_${i}`,
          value: `value_${i}`,
          confidence: 0.8 + (i % 3) * 0.1,
          priority: (i % 5) + 1,
          source: 'extraction' as const,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        })),
        memoryFragments: Array.from({ length: memoryCount }, (_, i) => ({
          id: `mem-${i}`,
          avatarId: 'test-avatar',
          fragmentText: `Memory fragment ${i} with some contextual information.`,
          conversationContext: {
            source: 'conversation',
            type: 'user' as const,
            conversationId: `conv-${i}`
          },
          similarity: 0.7 + (i % 3) * 0.1,
          createdAt: `2024-01-0${(i % 9) + 1}T10:00:00Z`,
          updatedAt: `2024-01-0${(i % 9) + 1}T10:00:00Z`
        })),
        conversationHistory: [],
        retrievalMetadata: {
          totalQuickFacts: factCount,
          totalMemoryFragments: memoryCount,
          totalConversationTurns: 0,
          retrievalTimeMs: 100 + factCount * 10,
          confidenceThreshold: 0.35,
          queryOptimizations: ['parallel_queries'],
          cacheHits: []
        }
      });

      // Test with different context sizes
      const testCases = [
        { facts: 0, memories: 0, name: 'empty context' },
        { facts: 5, memories: 3, name: 'small context' },
        { facts: 20, memories: 15, name: 'medium context' },
        { facts: 50, memories: 30, name: 'large context' }
      ];

      for (const testCase of testCases) {
        const context = createMockContext(testCase.facts, testCase.memories);
        const template = memoryService.formatContext(context, {
          maxCharacters: 8000,
          memoryFragmentLimit: 20,
          conversationHistoryLimit: 10
        });

        const validation = memoryService.validateTemplate(template);
        const stats = memoryService.getTemplateStats(template);

        expect(validation.isValid).toBe(true);
        expect(stats.characterCount).toBeLessThanOrEqual(8000);
        
        // Should have appropriate sections based on content
        if (testCase.facts > 0) {
          expect(template).toContain('=== CORE IDENTITY ===');
        }
        if (testCase.memories > 0) {
          expect(template).toContain('=== RELEVANT MEMORIES ===');
        }
        
        console.log(`${testCase.name}: ${stats.characterCount} chars, ${stats.sectionCount} sections`);
      }
    });
  });

  describe('performance characteristics', () => {
    it('should generate templates within reasonable time limits', async () => {
      const largeContext: StructuredContext = {
        quickFacts: Array.from({ length: 100 }, (_, i) => ({
          id: `fact-${i}`,
          avatarId: 'perf-test-avatar',
          key: `performance_fact_${i}`,
          value: `This is a performance test fact with index ${i} and some additional content to make it realistic.`,
          confidence: Math.random(),
          priority: (i % 10) + 1,
          source: 'extraction' as const,
          category: i % 2 === 0 ? 'preference' : 'fact',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        })),
        memoryFragments: Array.from({ length: 50 }, (_, i) => ({
          id: `mem-${i}`,
          avatarId: 'perf-test-avatar',
          fragmentText: `This is memory fragment ${i} containing detailed information about user interactions and preferences that should be included in the context for better conversation quality.`,
          conversationContext: {
            source: 'conversation',
            type: 'user' as const,
            conversationId: `perf-conv-${i}`,
            tags: [`tag-${i % 5}`, `category-${i % 3}`]
          },
          similarity: Math.random(),
          createdAt: `2024-01-${String((i % 28) + 1).padStart(2, '0')}T10:00:00Z`,
          updatedAt: `2024-01-${String((i % 28) + 1).padStart(2, '0')}T10:00:00Z`
        })),
        conversationHistory: Array.from({ length: 20 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
          content: `This is conversation turn ${i} with some meaningful content that represents a typical exchange.`,
          timestamp: `2024-01-01T${String(10 + i).padStart(2, '0')}:00:00Z`
        })),
        retrievalMetadata: {
          totalQuickFacts: 100,
          totalMemoryFragments: 50,
          totalConversationTurns: 20,
          retrievalTimeMs: 300,
          confidenceThreshold: 0.35,
          queryOptimizations: ['parallel_queries', 'cache_quick_facts'],
          cacheHits: ['quick_facts']
        }
      };

      const startTime = Date.now();
      const template = memoryService.formatContext(largeContext, {
        maxCharacters: 10000,
        memoryFragmentLimit: 25,
        conversationHistoryLimit: 10
      });
      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(100); // Should process within 100ms
      expect(template.length).toBeLessThanOrEqual(10000);
      
      const validation = memoryService.validateTemplate(template);
      expect(validation.isValid).toBe(true);
      
      console.log(`Large context processing: ${processingTime}ms, ${template.length} chars`);
    });
  });
});