/**
 * Onboarding Fact Availability Tests
 * 
 * Tests that facts stored during onboarding are immediately available
 * for the first conversation without any delay or missing data.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AvatarOnboardingService } from '../avatarOnboardingService';
import { MemoryInjectionService } from '../memoryInjectionService';
import { ContextRetrievalEngine } from '../contextRetrievalEngine';

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

describe('Onboarding Fact Availability', () => {
  const testAvatarId = 'test-avatar-123';
  const testUserId = 'test-user-456';
  let mockSupabase: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get the mocked supabase instance
    const { createClient } = await import('@supabase/supabase-js');
    mockSupabase = (createClient as any)();
    
    // Mock successful avatar creation
    mockSupabase.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: testAvatarId },
            error: null
          })
        })
      })
    });

    // Mock successful fact storage
    mockSupabase.rpc.mockImplementation((functionName, params) => {
      if (functionName === 'upsert_quick_fact') {
        return Promise.resolve({ 
          data: `fact-${params.in_key}`, 
          error: null 
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Immediate Fact Storage', () => {
    it('should store all onboarding facts immediately upon avatar creation', async () => {
      const onboardingData = {
        name: 'Test Avatar',
        speaking_style: 'Friendly and professional',
        expressions: ['awesome!', 'fantastic!'],
        catchphrases: ['you know what I mean?'],
        address_terms: { male_friend: ['buddy', 'friend'] },
        core_facts: [
          { key: 'full_name', value: 'Test Avatar Johnson', priority: 1 },
          { key: 'profession', value: 'Software Engineer', priority: 2 },
          { key: 'pet_name', value: 'Fluffy', priority: 2 },
          { key: 'pet_type', value: 'cat', priority: 3 }
        ]
      };

      const result = await AvatarOnboardingService.createAvatarWithStyle(
        onboardingData,
        testUserId
      );

      expect(result.success).toBe(true);
      expect(result.factCount).toBeGreaterThan(0);

      // Verify all expected facts were stored
      const upsertCalls = mockSupabase.rpc.mock.calls.filter(call => call[0] === 'upsert_quick_fact');
      
      // Should have calls for: core_facts (4) + speaking_style (1) + expressions (2) + catchphrases (1) + address_terms (1)
      expect(upsertCalls.length).toBeGreaterThanOrEqual(9);

      // Verify core facts were stored
      const coreFactKeys = upsertCalls
        .map(call => call[1].in_key)
        .filter(key => ['full_name', 'profession', 'pet_name', 'pet_type'].includes(key));
      expect(coreFactKeys).toHaveLength(4);

      // Verify style facts were stored
      const styleFactKeys = upsertCalls
        .map(call => call[1].in_key)
        .filter(key => key.includes('speaking_style') || key.includes('expression_') || key.includes('catchphrase_'));
      expect(styleFactKeys.length).toBeGreaterThan(0);
    });

    it('should assign correct priorities to different fact types', async () => {
      const onboardingData = {
        name: 'Priority Test Avatar',
        speaking_style: 'Test style',
        core_facts: [
          { key: 'full_name', value: 'Priority Test', priority: 1 },
          { key: 'hobby', value: 'testing', priority: 4 }
        ]
      };

      await AvatarOnboardingService.createAvatarWithStyle(onboardingData, testUserId);

      const upsertCalls = mockSupabase.rpc.mock.calls.filter(call => call[0] === 'upsert_quick_fact');

      // Check that speaking_style gets priority 1 (core personality)
      const speakingStyleCall = upsertCalls.find(call => call[1].in_key === 'speaking_style');
      expect(speakingStyleCall[1].in_priority).toBe(1);

      // Check that full_name keeps its specified priority
      const fullNameCall = upsertCalls.find(call => call[1].in_key === 'full_name');
      expect(fullNameCall[1].in_priority).toBe(1);

      // Check that hobby keeps its specified priority
      const hobbyCall = upsertCalls.find(call => call[1].in_key === 'hobby');
      expect(hobbyCall[1].in_priority).toBe(4);
    });

    it('should handle fact storage errors gracefully without breaking onboarding', async () => {
      // Mock one fact failing to store
      mockSupabase.rpc.mockImplementation((functionName, params) => {
        if (functionName === 'upsert_quick_fact') {
          if (params.in_key === 'failing_fact') {
            return Promise.resolve({ 
              data: null, 
              error: { message: 'Storage failed' } 
            });
          }
          return Promise.resolve({ 
            data: `fact-${params.in_key}`, 
            error: null 
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const onboardingData = {
        name: 'Error Test Avatar',
        core_facts: [
          { key: 'good_fact', value: 'good value', priority: 1 },
          { key: 'failing_fact', value: 'will fail', priority: 2 }
        ]
      };

      const result = await AvatarOnboardingService.createAvatarWithStyle(
        onboardingData,
        testUserId
      );

      // Should still succeed overall but report errors
      expect(result.success).toBe(false); // Because there were storage errors
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Storage failed'))).toBe(true);
    });
  });

  describe('Context Preparation for First Conversation', () => {
    beforeEach(() => {
      // Mock fetch_quick_facts to return stored facts
      mockSupabase.rpc.mockImplementation((functionName, params) => {
        if (functionName === 'fetch_quick_facts') {
          return Promise.resolve({
            data: [
              { key: 'full_name', value: 'Test Avatar Johnson', priority: 1, confidence: 1.0, created_at: new Date().toISOString() },
              { key: 'speaking_style', value: 'Friendly and professional', priority: 1, confidence: 1.0, created_at: new Date().toISOString() },
              { key: 'profession', value: 'Software Engineer', priority: 2, confidence: 1.0, created_at: new Date().toISOString() },
              { key: 'pet_name', value: 'Fluffy', priority: 2, confidence: 1.0, created_at: new Date().toISOString() },
              { key: 'pet_type', value: 'cat', priority: 3, confidence: 1.0, created_at: new Date().toISOString() },
              { key: 'expression_awesome', value: 'awesome!', priority: 4, confidence: 1.0, created_at: new Date().toISOString() },
              { key: 'catchphrase_you_know', value: 'you know what I mean?', priority: 4, confidence: 1.0, created_at: new Date().toISOString() }
            ],
            error: null
          });
        }
        if (functionName === 'upsert_quick_fact') {
          return Promise.resolve({ data: 'fact-id', error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });
    });

    it('should prepare complete context immediately after onboarding', async () => {
      const onboardingData = {
        name: 'Context Test Avatar',
        speaking_style: 'Friendly and professional',
        expressions: ['awesome!'],
        catchphrases: ['you know what I mean?'],
        core_facts: [
          { key: 'full_name', value: 'Test Avatar Johnson', priority: 1 },
          { key: 'profession', value: 'Software Engineer', priority: 2 },
          { key: 'pet_name', value: 'Fluffy', priority: 2 },
          { key: 'pet_type', value: 'cat', priority: 3 }
        ]
      };

      // Create avatar
      const createResult = await AvatarOnboardingService.createAvatarWithStyle(
        onboardingData,
        testUserId
      );

      expect(createResult.success).toBe(true);

      // Immediately prepare context for first conversation
      const { context, factCount, errors } = await MemoryInjectionService.prepareOnboardingContext(
        createResult.avatarId,
        onboardingData
      );

      expect(errors).toHaveLength(0);
      expect(factCount).toBe(7); // All facts should be available
      expect(context.length).toBeGreaterThan(0);

      // Verify context contains all expected information
      expect(context).toContain('Test Avatar Johnson');
      expect(context).toContain('Software Engineer');
      expect(context).toContain('Fluffy');
      expect(context).toContain('cat');
      expect(context).toContain('awesome!');
      expect(context).toContain('you know what I mean?');
      expect(context).toContain('Friendly and professional');
    });

    it('should include proper sections in first conversation context', async () => {
      const onboardingData = {
        name: 'Section Test Avatar',
        speaking_style: 'Test style',
        core_facts: [
          { key: 'full_name', value: 'Section Test', priority: 1 }
        ]
      };

      const { context } = await MemoryInjectionService.prepareOnboardingContext(
        testAvatarId,
        onboardingData
      );

      // Should have all required sections
      expect(context).toContain('=== CORE IDENTITY ===');
      expect(context).toContain('=== PERSONALITY & STYLE ===');
      expect(context).toContain('=== FIRST CONVERSATION INSTRUCTIONS ===');

      // Should have specific first conversation instructions
      expect(context).toContain('This is your first conversation after setup');
      expect(context).toContain('do not ask for it again');
      expect(context).toContain('Reference your knowledge naturally');
      expect(context).toContain('ready to have meaningful conversations');
    });

    it('should organize facts by priority and category', async () => {
      const { context } = await MemoryInjectionService.prepareOnboardingContext(
        testAvatarId,
        { name: 'Organization Test' }
      );

      const lines = context.split('\n');
      
      // Core identity should come before personality & style
      const coreIdentityIndex = lines.findIndex(line => line.includes('CORE IDENTITY'));
      const personalityStyleIndex = lines.findIndex(line => line.includes('PERSONALITY & STYLE'));
      const additionalContextIndex = lines.findIndex(line => line.includes('ADDITIONAL CONTEXT'));

      expect(coreIdentityIndex).toBeGreaterThan(-1);
      expect(personalityStyleIndex).toBeGreaterThan(coreIdentityIndex);
      
      if (additionalContextIndex > -1) {
        expect(additionalContextIndex).toBeGreaterThan(personalityStyleIndex);
      }
    });
  });

  describe('Seamless Transition to Conversation', () => {
    it('should ensure no gap between setup completion and conversation readiness', async () => {
      const onboardingData = {
        name: 'Seamless Test Avatar',
        speaking_style: 'Warm and friendly',
        core_facts: [
          { key: 'full_name', value: 'Seamless Test', priority: 1 },
          { key: 'favorite_color', value: 'blue', priority: 3 }
        ]
      };

      // Simulate the complete flow: create avatar -> immediate conversation
      const startTime = Date.now();

      // Step 1: Create avatar
      const createResult = await AvatarOnboardingService.createAvatarWithStyle(
        onboardingData,
        testUserId
      );

      expect(createResult.success).toBe(true);

      // Step 2: Immediately prepare for conversation (no delay)
      const { context, factCount, errors } = await MemoryInjectionService.prepareOnboardingContext(
        createResult.avatarId,
        onboardingData
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify immediate availability
      expect(errors).toHaveLength(0);
      expect(factCount).toBeGreaterThan(0);
      expect(context).toContain('Seamless Test');
      expect(context).toContain('blue');
      expect(context).toContain('Warm and friendly');

      // Should complete quickly (under 1 second in tests)
      expect(totalTime).toBeLessThan(1000);
    });

    it('should demonstrate avatar knows setup information in first response', async () => {
      // Mock a typical first conversation scenario
      const onboardingData = {
        name: 'Demo Avatar',
        speaking_style: 'Enthusiastic and helpful',
        core_facts: [
          { key: 'full_name', value: 'Demo Avatar Smith', priority: 1 },
          { key: 'profession', value: 'AI Assistant', priority: 2 },
          { key: 'pet_name', value: 'Pixel', priority: 2 },
          { key: 'pet_type', value: 'digital pet', priority: 3 }
        ]
      };

      const { context } = await MemoryInjectionService.prepareOnboardingContext(
        testAvatarId,
        onboardingData
      );

      // Context should be ready for GPT-5 to demonstrate knowledge
      expect(context).toContain('Demo Avatar Smith');
      expect(context).toContain('AI Assistant');
      expect(context).toContain('Pixel');
      expect(context).toContain('digital pet');
      expect(context).toContain('Enthusiastic and helpful');

      // Should include instructions to demonstrate knowledge
      expect(context).toContain('You already know all the information above');
      expect(context).toContain('Reference your knowledge naturally');
      expect(context).toContain('confidently share what you know');
    });
  });

  describe('Error Recovery and Validation', () => {
    it('should validate that all essential facts are available before marking ready', async () => {
      // Mock scenario where some facts fail to store
      mockSupabase.rpc.mockImplementation((functionName, params) => {
        if (functionName === 'upsert_quick_fact') {
          // Simulate some facts failing to store
          if (params.in_key === 'full_name') {
            return Promise.resolve({ data: null, error: { message: 'Failed to store name' } });
          }
          return Promise.resolve({ data: 'fact-id', error: null });
        }
        if (functionName === 'fetch_quick_facts') {
          // Return only successfully stored facts
          return Promise.resolve({
            data: [
              { key: 'speaking_style', value: 'Test style', priority: 1, confidence: 1.0 }
            ],
            error: null
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const onboardingData = {
        name: 'Validation Test Avatar',
        speaking_style: 'Test style',
        core_facts: [
          { key: 'full_name', value: 'Will Fail', priority: 1 },
          { key: 'hobby', value: 'Will Succeed', priority: 3 }
        ]
      };

      const createResult = await AvatarOnboardingService.createAvatarWithStyle(
        onboardingData,
        testUserId
      );

      // Should report the error
      expect(createResult.success).toBe(false);
      expect(createResult.errors.some(e => e.includes('Failed to store name'))).toBe(true);

      // Context preparation should still work with available facts
      const { context, factCount, errors } = await MemoryInjectionService.prepareOnboardingContext(
        createResult.avatarId,
        onboardingData
      );

      expect(errors).toHaveLength(0);
      expect(factCount).toBe(1); // Only speaking_style stored successfully
      expect(context).toContain('Test style');
      expect(context).not.toContain('Will Fail'); // Failed fact not in context
    });

    it('should provide meaningful warnings when essential facts are missing', async () => {
      const onboardingData = {
        name: 'Minimal Avatar'
        // Missing speaking_style and other important facts
      };

      const result = await AvatarOnboardingService.createAvatarWithStyle(
        onboardingData,
        testUserId
      );

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('personality') || w.includes('style'))).toBe(true);
    });
  });
});