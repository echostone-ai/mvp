/**
 * Memory Injection Service Tests
 * 
 * Tests for template generation, validation, and model-specific optimization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryInjectionService } from '../memoryInjectionService';
import { StructuredContext, QuickFact, MemoryFragment, ConversationTurn } from '../contextRetrievalEngine';

describe('MemoryInjectionService', () => {
  let service: MemoryInjectionService;
  let mockContext: StructuredContext;

  beforeEach(() => {
    service = new MemoryInjectionService();
    
    // Create comprehensive mock context
    mockContext = {
      quickFacts: [
        {
          id: '1',
          avatarId: 'avatar-1',
          key: 'name',
          value: 'John Smith',
          confidence: 1.0,
          priority: 1,
          source: 'manual',
          category: 'name',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        },
        {
          id: '2',
          avatarId: 'avatar-1',
          key: 'age',
          value: '35',
          confidence: 0.9,
          priority: 2,
          source: 'extraction',
          category: 'age',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        },
        {
          id: '3',
          avatarId: 'avatar-1',
          key: 'favorite_color',
          value: 'blue',
          confidence: 0.7,
          priority: 5,
          source: 'llm',
          category: 'preference',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        },
        {
          id: '4',
          avatarId: 'avatar-1',
          key: 'occupation',
          value: 'software engineer',
          confidence: 0.95,
          priority: 2,
          source: 'manual',
          category: 'occupation',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ],
      memoryFragments: [
        {
          id: 'mem-1',
          avatarId: 'avatar-1',
          fragmentText: 'John mentioned he loves hiking in the mountains on weekends.',
          conversationContext: {
            source: 'conversation',
            type: 'user',
            conversationId: 'conv-1'
          },
          similarity: 0.85,
          createdAt: '2024-01-02T10:00:00Z',
          updatedAt: '2024-01-02T10:00:00Z'
        },
        {
          id: 'mem-2',
          avatarId: 'avatar-1',
          fragmentText: 'He talked about his recent trip to Colorado and how beautiful the scenery was.',
          conversationContext: {
            source: 'conversation',
            type: 'user',
            conversationId: 'conv-2'
          },
          similarity: 0.75,
          createdAt: '2024-01-03T14:30:00Z',
          updatedAt: '2024-01-03T14:30:00Z'
        }
      ],
      conversationHistory: [
        {
          role: 'user',
          content: 'How was your weekend?',
          timestamp: '2024-01-05T09:00:00Z'
        },
        {
          role: 'assistant',
          content: 'It was great! I spent some time outdoors.',
          timestamp: '2024-01-05T09:01:00Z'
        },
        {
          role: 'user',
          content: 'That sounds nice. Did you go hiking?',
          timestamp: '2024-01-05T09:02:00Z'
        }
      ],
      retrievalMetadata: {
        totalQuickFacts: 4,
        totalMemoryFragments: 2,
        totalConversationTurns: 3,
        retrievalTimeMs: 150,
        confidenceThreshold: 0.35,
        queryOptimizations: ['parallel_queries'],
        cacheHits: []
      }
    };
  });

  describe('formatContext', () => {
    it('should generate structured template with all sections', () => {
      const template = service.formatContext(mockContext);
      
      expect(template).toContain('=== CORE IDENTITY ===');
      expect(template).toContain('=== CONTEXTUAL FACTS ===');
      expect(template).toContain('=== RELEVANT MEMORIES ===');
      expect(template).toContain('=== RECENT CONVERSATION ===');
      expect(template).toContain('=== INSTRUCTIONS ===');
    });

    it('should categorize facts correctly into core identity and contextual', () => {
      const template = service.formatContext(mockContext);
      
      // Core identity should contain name, age, occupation
      const coreSection = template.split('=== CONTEXTUAL FACTS ===')[0];
      expect(coreSection).toContain('name: John Smith');
      expect(coreSection).toContain('age: 35');
      expect(coreSection).toContain('occupation: software engineer');
      
      // Contextual facts should contain preferences
      const contextualSection = template.split('=== CONTEXTUAL FACTS ===')[1];
      expect(contextualSection).toContain('favorite_color: blue');
    });

    it('should include memory fragments with proper formatting', () => {
      const template = service.formatContext(mockContext);
      
      expect(template).toContain('John mentioned he loves hiking');
      expect(template).toContain('recent trip to Colorado');
      expect(template).toContain('Memory 1');
      expect(template).toContain('Memory 2');
    });

    it('should include conversation history with timestamps', () => {
      const template = service.formatContext(mockContext);
      
      expect(template).toContain('USER: How was your weekend?');
      expect(template).toContain('ASSISTANT: It was great!');
      expect(template).toContain('USER: That sounds nice. Did you go hiking?');
    });

    it('should generate natural language template when requested', () => {
      const template = service.formatContext(mockContext, { useStructuredFormat: false });
      
      expect(template).toContain('You are having a conversation with someone you know well');
      expect(template).toContain('Core information:');
      expect(template).toContain('Their name is John Smith');
      expect(template).not.toContain('=== CORE IDENTITY ===');
    });

    it('should include metadata when requested', () => {
      const template = service.formatContext(mockContext, { includeMetadata: true });
      
      expect(template).toContain('(confidence: 1.00)');
      expect(template).toContain('(confidence: 0.90)');
      expect(template).toContain('(similarity: 0.85)');
    });

    it('should respect conversation history limit', () => {
      const template = service.formatContext(mockContext, { conversationHistoryLimit: 2 });
      
      const conversationSection = template.split('=== RECENT CONVERSATION ===')[1]?.split('=== INSTRUCTIONS ===')[0];
      const turnCount = (conversationSection?.match(/USER:|ASSISTANT:/g) || []).length;
      expect(turnCount).toBeLessThanOrEqual(2);
    });

    it('should respect memory fragment limit', () => {
      const template = service.formatContext(mockContext, { memoryFragmentLimit: 1 });
      
      const memorySection = template.split('=== RELEVANT MEMORIES ===')[1]?.split('=== RECENT CONVERSATION ===')[0];
      const memoryCount = (memorySection?.match(/Memory \d+/g) || []).length;
      expect(memoryCount).toBeLessThanOrEqual(1);
    });

    it('should truncate template when it exceeds character limit', () => {
      const template = service.formatContext(mockContext, { maxCharacters: 500 });
      
      expect(template.length).toBeLessThanOrEqual(500);
      expect(template).toContain('[Content truncated for length]');
    });
  });

  describe('validateTemplate', () => {
    it('should validate a well-formed template', () => {
      const template = service.formatContext(mockContext);
      const validation = service.validateTemplate(template);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.characterCount).toBeGreaterThan(0);
      expect(validation.sectionCounts.coreIdentity).toBe(1);
      expect(validation.sectionCounts.contextualFacts).toBe(1);
    });

    it('should detect empty template', () => {
      const validation = service.validateTemplate('');
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Template is empty');
    });

    it('should warn about long templates', () => {
      const longTemplate = 'a'.repeat(10000);
      const validation = service.validateTemplate(longTemplate);
      
      expect(validation.warnings.some(w => w.includes('exceeds recommended length'))).toBe(true);
    });

    it('should detect undefined/null values', () => {
      const badTemplate = 'name: undefined\nage: null';
      const validation = service.validateTemplate(badTemplate);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Template contains undefined or null values');
    });

    it('should warn about very long lines', () => {
      const templateWithLongLine = 'short line\n' + 'a'.repeat(250);
      const validation = service.validateTemplate(templateWithLongLine);
      
      expect(validation.warnings.some(w => w.includes('very long'))).toBe(true);
    });
  });

  describe('optimizeForModel', () => {
    it('should optimize for GPT-5 (default)', () => {
      const template = service.formatContext(mockContext);
      const optimized = service.optimizeForModel(template, 'gpt-5');
      
      // GPT-5 should maintain structured format
      expect(optimized).toContain('=== CORE IDENTITY ===');
      expect(optimized).toBe(template); // No changes for GPT-5
    });

    it('should optimize for GPT-4', () => {
      const template = service.formatContext(mockContext);
      const optimized = service.optimizeForModel(template, 'gpt-4');
      
      expect(optimized).toContain('=== IMPORTANT INSTRUCTIONS ===');
      expect(optimized).toContain('Please follow these guidelines carefully:');
    });

    it('should optimize for Claude', () => {
      const template = service.formatContext(mockContext);
      const optimized = service.optimizeForModel(template, 'claude');
      
      expect(optimized).toContain('CORE IDENTITY:');
      expect(optimized).toContain('• Reference the information');
      expect(optimized).not.toContain('=== CORE IDENTITY ===');
    });
  });

  describe('edge cases', () => {
    it('should handle empty context gracefully', () => {
      const emptyContext: StructuredContext = {
        quickFacts: [],
        memoryFragments: [],
        conversationHistory: [],
        retrievalMetadata: {
          totalQuickFacts: 0,
          totalMemoryFragments: 0,
          totalConversationTurns: 0,
          retrievalTimeMs: 50,
          confidenceThreshold: 0.35,
          queryOptimizations: [],
          cacheHits: []
        }
      };

      const template = service.formatContext(emptyContext);
      
      expect(template).toContain('=== INSTRUCTIONS ===');
      expect(template).not.toContain('=== CORE IDENTITY ===');
      expect(template).not.toContain('=== CONTEXTUAL FACTS ===');
    });

    it('should handle facts without confidence scores', () => {
      const contextWithoutConfidence: StructuredContext = {
        ...mockContext,
        quickFacts: [
          {
            id: '1',
            avatarId: 'avatar-1',
            key: 'name',
            value: 'John Smith',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          }
        ]
      };

      const template = service.formatContext(contextWithoutConfidence);
      expect(template).toContain('name: John Smith');
      expect(template).not.toContain('confidence:');
    });

    it('should handle memory fragments without similarity scores', () => {
      const contextWithoutSimilarity: StructuredContext = {
        ...mockContext,
        memoryFragments: [
          {
            id: 'mem-1',
            avatarId: 'avatar-1',
            fragmentText: 'A memory without similarity score',
            conversationContext: {
              source: 'conversation',
              type: 'user',
              conversationId: 'conv-1'
            },
            createdAt: '2024-01-02T10:00:00Z',
            updatedAt: '2024-01-02T10:00:00Z'
          }
        ]
      };

      const template = service.formatContext(contextWithoutSimilarity);
      expect(template).toContain('A memory without similarity score');
      expect(template).not.toContain('similarity:');
    });

    it('should prioritize core identity facts correctly', () => {
      const template = service.formatContext(mockContext, { prioritizeCoreIdentity: true });
      
      const coreSection = template.split('=== CONTEXTUAL FACTS ===')[0];
      const lines = coreSection.split('\n').filter(line => line.includes(':'));
      
      // Should have name, age, occupation in core identity
      expect(lines.some(line => line.includes('name:'))).toBe(true);
      expect(lines.some(line => line.includes('age:'))).toBe(true);
      expect(lines.some(line => line.includes('occupation:'))).toBe(true);
    });
  });

  describe('getTemplateStats', () => {
    it('should return accurate template statistics', () => {
      const template = service.formatContext(mockContext);
      const stats = service.getTemplateStats(template);
      
      expect(stats.characterCount).toBe(template.length);
      expect(stats.lineCount).toBe(template.split('\n').length);
      expect(stats.sectionCount).toBeGreaterThan(0);
      expect(stats.avgLineLength).toBeGreaterThan(0);
    });

    it('should handle empty template stats', () => {
      const stats = service.getTemplateStats('');
      
      expect(stats.characterCount).toBe(0);
      expect(stats.lineCount).toBe(1); // Empty string still has one line
      expect(stats.sectionCount).toBe(0);
      expect(stats.avgLineLength).toBe(0);
    });
  });

  describe('instructions generation', () => {
    it('should generate appropriate instructions based on context', () => {
      const template = service.formatContext(mockContext);
      
      expect(template).toContain('Reference the information above naturally');
      expect(template).toContain('Never contradict established facts');
      expect(template).toContain('Use their name and personal details');
      expect(template).toContain('Reference relevant memories when appropriate');
    });

    it('should include confidence warnings for low-confidence facts', () => {
      const lowConfidenceContext: StructuredContext = {
        ...mockContext,
        quickFacts: [
          {
            id: '1',
            avatarId: 'avatar-1',
            key: 'uncertain_fact',
            value: 'maybe true',
            confidence: 0.4,
            priority: 5,
            source: 'llm',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          }
        ]
      };

      const template = service.formatContext(lowConfidenceContext);
      expect(template).toContain('Be cautious with lower-confidence facts');
    });
  });
});