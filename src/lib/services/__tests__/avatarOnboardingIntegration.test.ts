/**
 * Avatar Onboarding Integration Tests
 * 
 * Tests the complete integration between avatar onboarding and the GPT-5 memory system
 * to ensure facts are immediately available for the first conversation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AvatarOnboardingService, AvatarOnboardingData } from '../avatarOnboardingService';
import { MemoryInjectionService } from '../memoryInjectionService';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => {
  const mockSupabase = {
    from: vi.fn(),
    rpc: vi.fn()
  };
  
  return {
    createClient: vi.fn(() => mockSupabase)
  };
});

// Mock environment variables
vi.mock('process', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key'
  }
}));

describe('Avatar Onboarding Integration', () => {
  let mockSupabase: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get the mocked supabase instance
    const { createClient } = await import('@supabase/supabase-js');
    mockSupabase = (createClient as any)();
    
    // Default successful responses
    mockSupabase.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'test-avatar-id' },
            error: null
          })
        })
      })
    });

    mockSupabase.rpc.mockResolvedValue({
      data: 'test-fact-id',
      error: null
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Fact Validation', () => {
    it('should validate core identity facts correctly', () => {
      const facts = [
        { key: 'full_name', value: 'John Doe', priority: 1 },
        { key: 'age', value: '30', priority: 2 },
        { key: 'occupation', value: 'Engineer', priority: 2 }
      ];

      const result = MemoryInjectionService.validateOnboardingFacts(facts);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.categorizedFacts).toHaveLength(3);
      
      // Check auto-categorization
      const nameFact = result.categorizedFacts.find(f => f.key === 'full_name');
      expect(nameFact?.category).toBe('identity');
      expect(nameFact?.priority).toBe(1);
    });

    it('should validate style facts correctly', () => {
      const facts = [
        { key: 'speaking_style', value: 'Casual and friendly' },
        { key: 'expression_awesome', value: 'awesome!' },
        { key: 'catchphrase_wild', value: 'that\'s wild!' }
      ];

      const result = MemoryInjectionService.validateOnboardingFacts(facts);

      expect(result.isValid).toBe(true);
      expect(result.categorizedFacts.every(f => f.category === 'style')).toBe(true);
      
      // Speaking style should get priority 1
      const styleFact = result.categorizedFacts.find(f => f.key === 'speaking_style');
      expect(styleFact?.priority).toBe(1);
    });

    it('should detect validation errors', () => {
      const facts = [
        { key: '', value: 'empty key' }, // Invalid: empty key
        { key: 'valid_key', value: '' }, // Invalid: empty value
        { key: 'invalid_priority', value: 'test', priority: 15 }, // Invalid: priority > 10
        { key: 'invalid_confidence', value: 'test', confidence: 1.5 } // Invalid: confidence > 1
      ];

      const result = MemoryInjectionService.validateOnboardingFacts(facts);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('empty key'))).toBe(true);
      expect(result.errors.some(e => e.includes('priority'))).toBe(true);
      expect(result.errors.some(e => e.includes('confidence'))).toBe(true);
    });

    it('should provide helpful warnings', () => {
      const facts = [
        { key: 'hobby', value: 'reading', priority: 5 }
        // Missing name and personality facts
      ];

      const result = MemoryInjectionService.validateOnboardingFacts(facts);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('name'))).toBe(true);
      expect(result.warnings.some(w => w.includes('personality'))).toBe(true);
    });
  });

  describe('Batch Fact Storage', () => {
    it('should store facts successfully', async () => {
      const facts = [
        { key: 'full_name', value: 'John Doe', priority: 1 },
        { key: 'speaking_style', value: 'Friendly', priority: 1 }
      ];

      const result = await MemoryInjectionService.batchStoreFacts(
        'test-avatar-id',
        facts,
        'manual',
        'test'
      );

      expect(result.success).toBe(true);
      expect(result.storedCount).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
    });

    it('should handle storage errors gracefully', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' }
      });

      const facts = [
        { key: 'test_key', value: 'test_value', priority: 1 }
      ];

      const result = await MemoryInjectionService.batchStoreFacts(
        'test-avatar-id',
        facts,
        'manual',
        'test'
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Database error');
    });

    it('should validate fact data before storage', async () => {
      const facts = [
        { key: 'valid_fact', value: 'valid value', priority: 1 },
        { key: '', value: 'invalid fact' }, // Invalid
        { key: 'invalid_priority', value: 'test', priority: 15 } // Invalid
      ];

      const result = await MemoryInjectionService.batchStoreFacts(
        'test-avatar-id',
        facts,
        'manual',
        'test'
      );

      expect(result.success).toBe(false);
      expect(result.storedCount).toBe(1); // Only valid fact stored
      expect(result.errors.length).toBe(2); // Two validation errors
    });
  });

  describe('Context Preparation', () => {
    beforeEach(() => {
      // Mock fetch_quick_facts response
      mockSupabase.rpc.mockImplementation((functionName) => {
        if (functionName === 'fetch_quick_facts') {
          return Promise.resolve({
            data: [
              { key: 'full_name', value: 'John Doe', priority: 1, confidence: 1.0 },
              { key: 'speaking_style', value: 'Friendly', priority: 1, confidence: 1.0 },
              { key: 'pet_name', value: 'Buddy', priority: 2, confidence: 0.9 },
              { key: 'expression_awesome', value: 'awesome!', priority: 4, confidence: 1.0 }
            ],
            error: null
          });
        }
        return Promise.resolve({ data: null, error: null });
      });
    });

    it('should prepare context for first conversation', async () => {
      const onboardingData = {
        name: 'John Doe',
        speaking_style: 'Friendly',
        expressions: ['awesome!'],
        core_facts: [
          { key: 'pet_name', value: 'Buddy', priority: 2 }
        ]
      };

      const result = await MemoryInjectionService.prepareOnboardingContext(
        'test-avatar-id',
        onboardingData
      );

      expect(result.errors).toHaveLength(0);
      expect(result.factCount).toBe(4);
      expect(result.context).toContain('CORE IDENTITY');
      expect(result.context).toContain('PERSONALITY & STYLE');
      expect(result.context).toContain('FIRST CONVERSATION INSTRUCTIONS');
      expect(result.context).toContain('John Doe');
      expect(result.context).toContain('Buddy');
      expect(result.context).toContain('awesome!');
    });

    it('should include proper first conversation instructions', async () => {
      const result = await MemoryInjectionService.prepareOnboardingContext(
        'test-avatar-id',
        { name: 'Test' }
      );

      expect(result.context).toContain('This is your first conversation after setup');
      expect(result.context).toContain('do not ask for it again');
      expect(result.context).toContain('Reference your knowledge naturally');
      expect(result.context).toContain('ready to have meaningful conversations');
    });

    it('should handle missing facts gracefully', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await MemoryInjectionService.prepareOnboardingContext(
        'test-avatar-id',
        { name: 'Test' }
      );

      expect(result.errors).toHaveLength(0);
      expect(result.factCount).toBe(0);
      expect(result.context).toContain('FIRST CONVERSATION INSTRUCTIONS');
    });
  });

  describe('Complete Onboarding Flow', () => {
    beforeEach(() => {
      // Mock successful avatar creation
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'test-avatar-id' },
              error: null
            })
          })
        })
      });

      // Mock successful fact storage
      mockSupabase.rpc.mockImplementation((functionName) => {
        if (functionName === 'upsert_quick_fact') {
          return Promise.resolve({ data: 'fact-id', error: null });
        }
        if (functionName === 'fetch_quick_facts') {
          return Promise.resolve({
            data: [
              { key: 'full_name', value: 'Test Avatar', priority: 1 },
              { key: 'speaking_style', value: 'Friendly', priority: 1 },
              { key: 'pet_name', value: 'Max', priority: 2 }
            ],
            error: null
          });
        }
        return Promise.resolve({ data: null, error: null });
      });
    });

    it('should create avatar with immediate fact availability', async () => {
      const onboardingData: AvatarOnboardingData = {
        name: 'Test Avatar',
        speaking_style: 'Friendly and casual',
        expressions: ['awesome!', 'great!'],
        catchphrases: ['you know?'],
        address_terms: { male_friend: ['buddy'] },
        core_facts: [
          { key: 'full_name', value: 'Test Avatar Johnson', priority: 1 },
          { key: 'pet_name', value: 'Max', priority: 2 }
        ]
      };

      const result = await AvatarOnboardingService.createAvatarWithStyle(
        onboardingData,
        'test-user'
      );

      expect(result.success).toBe(true);
      expect(result.avatarId).toBe('test-avatar-id');
      expect(result.factCount).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate facts before storage', async () => {
      const onboardingData: AvatarOnboardingData = {
        name: 'Test Avatar',
        core_facts: [
          { key: 'valid_fact', value: 'valid value', priority: 1 },
          { key: 'invalid_fact', value: 'invalid', priority: 15 } // Invalid priority
        ]
      };

      const result = await AvatarOnboardingService.createAvatarWithStyle(
        onboardingData,
        'test-user'
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('priority'))).toBe(true);
    });

    it('should handle style facts properly', async () => {
      const onboardingData: AvatarOnboardingData = {
        name: 'Test Avatar',
        speaking_style: 'Casual and warm',
        expressions: ['awesome!', 'great!', 'fantastic!'],
        catchphrases: ['you know?', 'totally'],
        address_terms: { male_friend: ['buddy', 'friend'] }
      };

      const result = await AvatarOnboardingService.createAvatarWithStyle(
        onboardingData,
        'test-user'
      );

      expect(result.success).toBe(true);
      expect(result.factCount).toBeGreaterThan(0);
      
      // Should have called upsert for speaking_style, expressions, catchphrases, and address terms
      const upsertCalls = mockSupabase.rpc.mock.calls.filter(call => call[0] === 'upsert_quick_fact');
      expect(upsertCalls.length).toBeGreaterThan(5); // At least speaking_style + expressions + catchphrases + address_terms
    });

    it('should provide warnings for missing essential facts', async () => {
      const onboardingData: AvatarOnboardingData = {
        name: 'Test Avatar'
        // Missing speaking_style and other important facts
      };

      const result = await AvatarOnboardingService.createAvatarWithStyle(
        onboardingData,
        'test-user'
      );

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('personality'))).toBe(true);
    });
  });

  describe('Integration with Existing Systems', () => {
    it('should work with jonathan-demo setup', async () => {
      const result = await AvatarOnboardingService.setupJonathanDemo();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      
      // Should have created avatar and stored facts
      expect(mockSupabase.from).toHaveBeenCalled();
      expect(mockSupabase.rpc).toHaveBeenCalled();
    });

    it('should handle avatar profile creation fallback', async () => {
      // Mock avatar_profiles failure, avatars success
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'avatar_profiles') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockRejectedValue(new Error('Table not found'))
              })
            })
          };
        } else if (table === 'avatars') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'fallback-avatar-id' },
                  error: null
                })
              })
            })
          };
        }
        return mockSupabase.from(table);
      });

      const onboardingData: AvatarOnboardingData = {
        name: 'Test Avatar'
      };

      const result = await AvatarOnboardingService.createAvatarWithStyle(
        onboardingData,
        'test-user'
      );

      expect(result.success).toBe(true);
      expect(result.avatarId).toBe('fallback-avatar-id');
    });
  });

  describe('Performance and Limits', () => {
    it('should limit expressions to prevent context overflow', () => {
      const manyExpressions = Array.from({ length: 10 }, (_, i) => `expression_${i}`);
      
      const onboardingData: AvatarOnboardingData = {
        name: 'Test Avatar',
        expressions: manyExpressions
      };

      const styleFacts = (AvatarOnboardingService as any).prepareStyleFacts(onboardingData);
      
      // Should limit individual expressions and create combined fact for extras
      const expressionFacts = styleFacts.filter(f => f.key.startsWith('expression_'));
      const additionalFacts = styleFacts.filter(f => f.key === 'additional_expressions');
      
      expect(expressionFacts.length).toBeLessThanOrEqual(5);
      expect(additionalFacts.length).toBe(1);
    });

    it('should limit catchphrases to prevent context overflow', () => {
      const manyCatchphrases = Array.from({ length: 8 }, (_, i) => `catchphrase_${i}`);
      
      const onboardingData: AvatarOnboardingData = {
        name: 'Test Avatar',
        catchphrases: manyCatchphrases
      };

      const styleFacts = (AvatarOnboardingService as any).prepareStyleFacts(onboardingData);
      
      // Should limit individual catchphrases and create combined fact for extras
      const catchphraseFacts = styleFacts.filter(f => f.key.startsWith('catchphrase_'));
      const additionalFacts = styleFacts.filter(f => f.key === 'additional_catchphrases');
      
      expect(catchphraseFacts.length).toBeLessThanOrEqual(5);
      expect(additionalFacts.length).toBe(1);
    });
  });
});