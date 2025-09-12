/**
 * Tests for MemoryUpdatePipeline
 * 
 * Tests fact extraction, conflict resolution, and session memory merging
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MemoryUpdatePipeline, ConversationContext, QuickFact, MemoryFragment } from '../memoryUpdatePipeline';
import { ExtractedFact } from '../patternExtractor';

// Mock FactExtractionEngine
const mockFactExtractionEngine = {
  extractFacts: vi.fn()
};

vi.mock('../factExtractionEngine', () => ({
  FactExtractionEngine: vi.fn(() => mockFactExtractionEngine)
}));

// Mock Supabase
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

describe('MemoryUpdatePipeline', () => {
  let pipeline: MemoryUpdatePipeline;
  let mockContext: ConversationContext;

  beforeEach(() => {
    pipeline = new MemoryUpdatePipeline();
    mockContext = {
      conversationId: 'conv-123',
      visitorId: 'visitor-456',
      sessionId: 'session-789',
      userInput: 'My name is John and I work as a software engineer.',
      assistantResponse: 'Nice to meet you, John! Software engineering is a great field.',
      timestamp: '2024-01-15T10:00:00Z',
      metadata: {}
    };

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('processConversationTurn', () => {
    it('should process conversation and extract facts', async () => {
      const mockExtractedFacts: ExtractedFact[] = [
        {
          key: 'name',
          value: 'John',
          confidence: 0.9,
          source_text: 'My name is John',
          extraction_method: 'pattern'
        },
        {
          key: 'occupation',
          value: 'software engineer',
          confidence: 0.8,
          source_text: 'I work as a software engineer',
          extraction_method: 'pattern'
        }
      ];

      mockFactExtractionEngine.extractFacts.mockResolvedValue({
        facts: mockExtractedFacts,
        processing_time_ms: 100,
        errors: []
      });

      const result = await pipeline.processConversationTurn('avatar-123', mockContext);

      expect(result.factsExtracted).toBe(2);
      expect(result.factsUpdated).toBe(2);
      expect(result.memoriesCreated).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(result.processingTimeMs).toBeGreaterThan(0);
    });

    it('should skip processing when ignoreSessionMemory is true', async () => {
      const pipelineWithIgnore = new MemoryUpdatePipeline({ ignoreSessionMemory: true });
      
      const result = await pipelineWithIgnore.processConversationTurn('avatar-123', mockContext);

      expect(result.factsExtracted).toBe(0);
      expect(result.factsUpdated).toBe(0);
      expect(result.memoriesCreated).toBe(0);
      expect(mockFactExtractionEngine.extractFacts).not.toHaveBeenCalled();
    });

    it('should handle extraction errors gracefully', async () => {
      mockFactExtractionEngine.extractFacts.mockRejectedValue(new Error('Extraction failed'));

      const result = await pipeline.processConversationTurn('avatar-123', mockContext);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.factsExtracted).toBe(0);
    });
  });

  describe('extractNewFacts', () => {
    it('should extract facts from combined user input and assistant response', async () => {
      const mockExtractedFacts: ExtractedFact[] = [
        {
          key: 'name',
          value: 'John',
          confidence: 0.9,
          source_text: 'My name is John',
          extraction_method: 'pattern'
        }
      ];

      mockFactExtractionEngine.extractFacts.mockResolvedValue({
        facts: mockExtractedFacts,
        processing_time_ms: 100,
        errors: []
      });

      const facts = await pipeline.extractNewFacts(
        'My name is John',
        'Nice to meet you, John!',
        'avatar-123'
      );

      expect(facts).toHaveLength(1);
      expect(facts[0].key).toBe('name');
      expect(facts[0].value).toBe('John');
      expect(mockFactExtractionEngine.extractFacts).toHaveBeenCalledWith(
        'User: My name is John\nAssistant: Nice to meet you, John!',
        'avatar-123'
      );
    });

    it('should filter facts by confidence threshold', async () => {
      const mockExtractedFacts: ExtractedFact[] = [
        {
          key: 'name',
          value: 'John',
          confidence: 0.9,
          source_text: 'My name is John',
          extraction_method: 'pattern'
        },
        {
          key: 'hobby',
          value: 'reading',
          confidence: 0.2, // Below default threshold of 0.35
          source_text: 'I might like reading',
          extraction_method: 'llm'
        }
      ];

      mockFactExtractionEngine.extractFacts.mockResolvedValue({
        facts: mockExtractedFacts,
        processing_time_ms: 100,
        errors: []
      });

      const facts = await pipeline.extractNewFacts(
        'My name is John and I might like reading',
        'Interesting!',
        'avatar-123'
      );

      expect(facts).toHaveLength(1);
      expect(facts[0].key).toBe('name');
    });

    it('should limit facts per update', async () => {
      const pipelineWithLimit = new MemoryUpdatePipeline({ maxFactsPerUpdate: 2 });
      
      const mockExtractedFacts: ExtractedFact[] = Array.from({ length: 5 }, (_, i) => ({
        key: `fact${i}`,
        value: `value${i}`,
        confidence: 0.8,
        source_text: `source${i}`,
        extraction_method: 'pattern' as const
      }));

      mockFactExtractionEngine.extractFacts.mockResolvedValue({
        facts: mockExtractedFacts,
        processing_time_ms: 100,
        errors: []
      });

      const facts = await pipelineWithLimit.extractNewFacts(
        'Lots of facts here',
        'Indeed!',
        'avatar-123'
      );

      expect(facts).toHaveLength(2);
    });

    it('should return empty array when fact extraction is disabled', async () => {
      const pipelineDisabled = new MemoryUpdatePipeline({ enableFactExtraction: false });

      const facts = await pipelineDisabled.extractNewFacts(
        'My name is John',
        'Nice to meet you!',
        'avatar-123'
      );

      expect(facts).toHaveLength(0);
      expect(mockFactExtractionEngine.extractFacts).not.toHaveBeenCalled();
    });
  });

  describe('updateQuickFacts', () => {
    it('should create new facts when they do not exist', async () => {
      const mockFacts: ExtractedFact[] = [
        {
          key: 'name',
          value: 'John',
          confidence: 0.9,
          source_text: 'My name is John',
          extraction_method: 'pattern'
        }
      ];

      const result = await pipeline.updateQuickFacts('avatar-123', mockFacts);

      expect(result.updated).toBe(1);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should resolve conflicts when facts already exist', async () => {
      const mockFacts: ExtractedFact[] = [
        {
          key: 'name',
          value: 'John Smith',
          confidence: 0.95,
          source_text: 'My full name is John Smith',
          extraction_method: 'pattern'
        }
      ];

      const existingFact = {
        id: 'fact-123',
        avatar_id: 'avatar-123',
        key: 'name',
        value: 'John',
        confidence: 0.8,
        priority: 2,
        source: 'extraction',
        source_reference: 'Previous conversation',
        created_at: '2024-01-14T10:00:00Z',
        updated_at: '2024-01-14T10:00:00Z'
      };

      // Import and mock supabase for this specific test
      const { supabase } = await import('@/lib/supabase');
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

      const result = await pipeline.updateQuickFacts('avatar-123', mockFacts);

      expect(result.updated).toBe(1);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].resolution).toBe('update_with_new');
      expect(result.conflicts[0].reason).toContain('higher confidence');
    });
  });

  describe('resolveConflicts', () => {
    const existingFact = {
      id: 'fact-123',
      avatar_id: 'avatar-123',
      key: 'name',
      value: 'John',
      confidence: 0.8,
      priority: 2,
      source: 'extraction',
      source_reference: 'Previous conversation',
      created_at: '2024-01-14T10:00:00Z',
      updated_at: '2024-01-14T10:00:00Z'
    };

    it('should prefer higher confidence facts', () => {
      const newFact: ExtractedFact = {
        key: 'name',
        value: 'John Smith',
        confidence: 0.95,
        source_text: 'My full name is John Smith',
        extraction_method: 'pattern'
      };

      const resolution = pipeline.resolveConflicts(existingFact, newFact);

      expect(resolution.resolution).toBe('update_with_new');
      expect(resolution.reason).toContain('higher confidence');
    });

    it('should prefer manual sources over extracted facts', () => {
      const existingManualFact = {
        ...existingFact,
        source: 'manual',
        confidence: 0.7
      };

      const newFact: ExtractedFact = {
        key: 'name',
        value: 'John Smith',
        confidence: 0.9,
        source_text: 'My full name is John Smith',
        extraction_method: 'pattern'
      };

      const resolution = pipeline.resolveConflicts(existingManualFact, newFact);

      expect(resolution.resolution).toBe('keep_existing');
      expect(resolution.reason).toContain('manually entered');
    });

    it('should prefer newer information when confidence is similar', () => {
      const newFact: ExtractedFact = {
        key: 'name',
        value: 'John Smith',
        confidence: 0.82, // Within 0.1 of existing 0.8
        source_text: 'My full name is John Smith',
        extraction_method: 'pattern'
      };

      const resolution = pipeline.resolveConflicts(existingFact, newFact);

      expect(resolution.resolution).toBe('update_with_new');
      // The actual reason will be about higher priority since name facts get priority 1
      expect(resolution.reason).toContain('priority');
    });

    it('should keep existing fact when it has higher confidence', () => {
      const newFact: ExtractedFact = {
        key: 'name',
        value: 'John Smith',
        confidence: 0.6, // Lower than existing 0.8
        source_text: 'My full name is John Smith',
        extraction_method: 'llm'
      };

      const resolution = pipeline.resolveConflicts(existingFact, newFact);

      expect(resolution.resolution).toBe('keep_existing');
      expect(resolution.reason).toContain('higher confidence or priority');
    });
  });

  describe('updateMemoryFragments', () => {
    it('should create memory fragments for substantial content', async () => {
      const result = await pipeline.updateMemoryFragments(
        'avatar-123',
        'I had a wonderful vacation in Italy last summer. The food was amazing!',
        mockContext
      );

      expect(result.created).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip short content', async () => {
      const result = await pipeline.updateMemoryFragments(
        'avatar-123',
        'Yes.',
        mockContext
      );

      expect(result.created).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      // Import and mock supabase for this specific test
      const { supabase } = await import('@/lib/supabase');
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn(() => Promise.resolve({ error: { message: 'Database error' } }))
      } as any);

      const result = await pipeline.updateMemoryFragments(
        'avatar-123',
        'I had a wonderful vacation in Italy last summer.',
        mockContext
      );

      expect(result.created).toBe(0);
      expect(result.errors).toContain('Failed to create memory fragment: Database error');
    });

    it('should not create memory fragments when disabled', async () => {
      const pipelineDisabled = new MemoryUpdatePipeline({ enableMemoryFragments: false });

      const result = await pipelineDisabled.updateMemoryFragments(
        'avatar-123',
        'I had a wonderful vacation in Italy last summer.',
        mockContext
      );

      expect(result.created).toBe(0);
    });
  });

  describe('priority calculation', () => {
    it('should assign high priority to core identity facts', () => {
      const nameFact: ExtractedFact = {
        key: 'name',
        value: 'John',
        confidence: 0.9,
        source_text: 'My name is John',
        extraction_method: 'pattern'
      };

      // Access private method through type assertion for testing
      const priority = (pipeline as any).calculatePriority(nameFact);
      expect(priority).toBe(1); // Highest priority for high-confidence name
    });

    it('should assign medium priority to important personal facts', () => {
      const hobbyFact: ExtractedFact = {
        key: 'hobby',
        value: 'photography',
        confidence: 0.7,
        source_text: 'I love photography',
        extraction_method: 'pattern'
      };

      const priority = (pipeline as any).calculatePriority(hobbyFact);
      expect(priority).toBe(4); // Medium priority for important facts with 0.7 confidence
    });

    it('should assign lower priority to less confident facts', () => {
      const triviaFact: ExtractedFact = {
        key: 'random_preference',
        value: 'likes blue',
        confidence: 0.4,
        source_text: 'I think I like blue',
        extraction_method: 'llm'
      };

      const priority = (pipeline as any).calculatePriority(triviaFact);
      expect(priority).toBe(8); // Lower priority for low-confidence facts
    });
  });

  describe('configuration management', () => {
    it('should return current configuration', () => {
      const config = pipeline.getConfig();
      
      expect(config.enableFactExtraction).toBe(true);
      expect(config.enableMemoryFragments).toBe(true);
      expect(config.confidenceThreshold).toBe(0.35);
      expect(config.maxFactsPerUpdate).toBe(20);
    });

    it('should update configuration', () => {
      pipeline.updateConfig({
        confidenceThreshold: 0.5,
        maxFactsPerUpdate: 10
      });

      const config = pipeline.getConfig();
      expect(config.confidenceThreshold).toBe(0.5);
      expect(config.maxFactsPerUpdate).toBe(10);
      expect(config.enableFactExtraction).toBe(true); // Should remain unchanged
    });
  });

  describe('helper methods', () => {
    it('should generate appropriate gist from content', () => {
      const shortContent = 'I love pizza.';
      const gist1 = (pipeline as any).generateGist(shortContent);
      expect(gist1).toBe('I love pizza');

      const longContent = 'I had an amazing vacation in Italy last summer. The food was incredible and the people were so friendly. I visited Rome, Florence, and Venice.';
      const gist2 = (pipeline as any).generateGist(longContent);
      expect(gist2).toBe('I had an amazing vacation in Italy last summer');
    });

    it('should extract relevant tags from content', () => {
      const content = 'I work as a software engineer and love traveling with my family.';
      const tags = (pipeline as any).extractTags(content);
      
      expect(tags).toContain('work');
      expect(tags).toContain('travel');
      expect(tags).toContain('family');
    });

    it('should map extraction methods to source types', () => {
      expect((pipeline as any).mapExtractionMethodToSource('pattern')).toBe('heuristic');
      expect((pipeline as any).mapExtractionMethodToSource('llm')).toBe('llm');
      expect((pipeline as any).mapExtractionMethodToSource('manual')).toBe('manual');
      expect((pipeline as any).mapExtractionMethodToSource('unknown')).toBe('extraction');
    });
  });
});