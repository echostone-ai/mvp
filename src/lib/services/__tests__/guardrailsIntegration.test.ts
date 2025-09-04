import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromptBuilder } from '../promptBuilder';
import { supabase } from '@/lib/supabase';

// Mock supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          ilike: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn()
            }))
          }))
        }))
      }))
    }))
  }
}));

const mockSupabase = supabase as any;

describe('Guardrails Integration Tests', () => {
  let promptBuilder: PromptBuilder;

  beforeEach(() => {
    promptBuilder = new PromptBuilder();
    vi.clearAllMocks();
  });

  describe('Missing Information Guardrails', () => {
    it('should provide "I don\'t have that yet" response for queries about missing core identity', async () => {
      // Mock avatar lookup for getAvatarIdFromSlug
      const mockAvatarFromSlug = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { id: 'avatar-123' }, error: null })
          }))
        }))
      };

      // Mock avatar lookup for fetchRelevantMemories (user_id lookup) - return error to trigger graceful fallback
      const mockAvatarFromUserId = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') })
          }))
        }))
      };

      // Mock empty facts and memories
      mockSupabase.from
        .mockReturnValueOnce(mockAvatarFromSlug as any) // getAvatarIdFromSlug
        .mockReturnValueOnce(mockAvatarFromUserId as any); // fetchRelevantMemories avatar lookup

      mockSupabase.rpc
        .mockResolvedValueOnce({ data: [], error: null }) // fetchQuickFacts
        .mockResolvedValueOnce({ data: [], error: null }); // fetchStyleProfile

      const result = await promptBuilder.buildSystemPromptWithValidation(
        'test-avatar',
        'Who are you and when were you born?'
      );

      expect(result.validation.isValid).toBe(false);
      expect(result.prompt).toContain("I don't have information about");
      expect(result.prompt).toContain('NEVER guess or make up information');
      expect(result.validation.warnings).toContain('Insufficient information available for comprehensive response');
    });

    it('should use structured prompt with guardrails when sufficient information exists', async () => {
      // Mock avatar lookup
      const mockAvatarFrom = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { id: 'avatar-123', user_id: 'user-123' }, error: null })
          }))
        }))
      };

      // Mock memory fragments query
      const mockMemoryFrom = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            ilike: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({ data: [], error: null })
              }))
            }))
          }))
        }))
      };

      mockSupabase.from
        .mockReturnValueOnce(mockAvatarFrom as any)
        .mockReturnValueOnce(mockMemoryFrom as any);

      // Mock facts available
      const mockFacts = [
        {
          id: 'fact-1',
          key: 'birth_year',
          value: '1985',
          confidence: 0.95,
          priority: 1,
          source: 'heuristic',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'fact-2',
          key: 'full_name',
          value: 'John Doe',
          confidence: 0.9,
          priority: 1,
          source: 'heuristic',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      mockSupabase.rpc
        .mockResolvedValueOnce({ data: mockFacts, error: null }) // fetchQuickFacts
        .mockResolvedValueOnce({ data: [{ speaking_style: 'casual' }], error: null }); // fetchStyleProfile

      const result = await promptBuilder.buildSystemPromptWithValidation(
        'test-avatar',
        'What is your name and birth year?'
      );

      expect(result.validation.isValid).toBe(true);
      expect(result.prompt).toContain('CORE IDENTITY & STYLE');
      expect(result.prompt).toContain('Birth Year: 1985');
      expect(result.prompt).toContain('Full Name: John Doe');
      expect(result.prompt).toContain('ENHANCED GUARDRAILS');
      expect(result.prompt).toContain('NEVER contradict information in CORE IDENTITY');
    });
  });

  describe('Fact Contradiction Detection', () => {
    it('should detect and warn about contradictions between facts and memories', async () => {
      // Mock avatar lookup for getAvatarIdFromSlug
      const mockAvatarFromSlug = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { id: 'avatar-123' }, error: null })
          }))
        }))
      };

      // Mock avatar lookup for fetchRelevantMemories (user_id lookup)
      const mockAvatarFromUserId = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { user_id: 'user-123' }, error: null })
          }))
        }))
      };

      // Mock memory with contradictory information
      const mockMemoryFrom = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            ilike: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({ 
                  data: [{
                    id: 'memory-1',
                    fragment_text: 'I was born in 1990 in New York',
                    created_at: '2024-01-01T00:00:00Z'
                  }], 
                  error: null 
                })
              }))
            }))
          }))
        }))
      };

      mockSupabase.from
        .mockReturnValueOnce(mockAvatarFromSlug as any) // getAvatarIdFromSlug
        .mockReturnValueOnce(mockAvatarFromUserId as any) // fetchRelevantMemories avatar lookup
        .mockReturnValueOnce(mockMemoryFrom as any); // fetchRelevantMemories memory query

      // Mock facts with different birth year
      const mockFacts = [
        {
          id: 'fact-1',
          key: 'birth_year',
          value: '1985',
          confidence: 0.95,
          priority: 1,
          source: 'heuristic',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      mockSupabase.rpc
        .mockResolvedValueOnce({ data: mockFacts, error: null }) // fetchQuickFacts
        .mockResolvedValueOnce({ data: [], error: null }); // fetchStyleProfile

      const result = await promptBuilder.buildSystemPromptWithValidation(
        'test-avatar',
        'When were you born?'
      );

      expect(result.validation.contradictions.length).toBeGreaterThan(0);
      expect(result.validation.contradictions[0]).toContain('Birth year mismatch');
      expect(result.prompt).toContain('CONSISTENCY ALERTS');
      expect(result.prompt).toContain('Prioritizing CORE IDENTITY facts');
    });
  });

  describe('Hallucination Risk Logging', () => {
    it('should log critical hallucination risk for core identity queries with no information', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock avatar lookup for getAvatarIdFromSlug
      const mockAvatarFromSlug = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { id: 'avatar-123' }, error: null })
          }))
        }))
      };

      // Mock avatar lookup for fetchRelevantMemories (user_id lookup) - return error to trigger graceful fallback
      const mockAvatarFromUserId = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') })
          }))
        }))
      };

      mockSupabase.from
        .mockReturnValueOnce(mockAvatarFromSlug as any) // getAvatarIdFromSlug
        .mockReturnValueOnce(mockAvatarFromUserId as any); // fetchRelevantMemories avatar lookup

      mockSupabase.rpc
        .mockResolvedValueOnce({ data: [], error: null }) // fetchQuickFacts
        .mockResolvedValueOnce({ data: [], error: null }); // fetchStyleProfile

      await promptBuilder.buildSystemPromptWithValidation(
        'test-avatar',
        'Who are you? Tell me your name and when you were born.'
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL HALLUCINATION RISK')
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('HIGH HALLUCINATION RISK detected')
      );

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('should log moderate risk when some information is available', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Mock avatar lookup for getAvatarIdFromSlug
      const mockAvatarFromSlug = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { id: 'avatar-123' }, error: null })
          }))
        }))
      };

      // Mock avatar lookup for fetchRelevantMemories (user_id lookup) - return error to trigger graceful fallback
      const mockAvatarFromUserId = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') })
          }))
        }))
      };

      mockSupabase.from
        .mockReturnValueOnce(mockAvatarFromSlug as any) // getAvatarIdFromSlug
        .mockReturnValueOnce(mockAvatarFromUserId as any); // fetchRelevantMemories avatar lookup

      // Mock some facts available but not for queried category
      const mockFacts = [
        {
          id: 'fact-1',
          key: 'current_city',
          value: 'Chicago',
          confidence: 0.8,
          priority: 3,
          source: 'heuristic',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      mockSupabase.rpc
        .mockResolvedValueOnce({ data: mockFacts, error: null }) // fetchQuickFacts
        .mockResolvedValueOnce({ data: [], error: null }); // fetchStyleProfile

      await promptBuilder.buildSystemPromptWithValidation(
        'test-avatar',
        'Tell me about your family'
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Moderate hallucination risk')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Fact Validation', () => {
    it('should validate new facts against existing ones and detect contradictions', async () => {
      const existingFacts = [
        {
          id: 'fact-1',
          key: 'birth_year',
          value: '1985',
          confidence: 0.95,
          priority: 1,
          source: 'heuristic',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      const newFacts = [
        {
          id: 'fact-2',
          key: 'birth_year',
          value: '1990',
          confidence: 0.8,
          priority: 1,
          source: 'llm',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      mockSupabase.rpc.mockResolvedValue({ data: existingFacts, error: null });

      const result = await promptBuilder.validateFactConsistency('avatar-123', newFacts);

      expect(result.isValid).toBe(false);
      expect(result.contradictions.length).toBeGreaterThan(0);
      expect(result.contradictions[0]).toContain('Contradiction detected for birth_year');
    });

    it('should allow legitimate updates for changeable facts', async () => {
      const existingFacts = [
        {
          id: 'fact-1',
          key: 'current_city',
          value: 'Chicago',
          confidence: 0.8,
          priority: 3,
          source: 'heuristic',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      const newFacts = [
        {
          id: 'fact-2',
          key: 'current_city',
          value: 'New York',
          confidence: 0.9,
          priority: 3,
          source: 'llm',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z'
        }
      ];

      mockSupabase.rpc.mockResolvedValue({ data: existingFacts, error: null });

      const result = await promptBuilder.validateFactConsistency('avatar-123', newFacts);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Updating current_city');
    });
  });
});