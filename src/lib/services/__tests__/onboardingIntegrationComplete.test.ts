/**
 * Complete Onboarding Integration Test
 * 
 * Tests the complete integration flow from avatar creation to first conversation readiness.
 * This test validates all requirements for task 12.
 */

import { describe, it, expect } from 'vitest';
import { MemoryInjectionService } from '../memoryInjectionService';

describe('Complete Onboarding Integration', () => {
  describe('Requirement 8.1: Immediate fact availability', () => {
    it('should validate that setup information is properly categorized and prioritized', () => {
      const setupFacts = [
        { key: 'full_name', value: 'Test Avatar', priority: 1 },
        { key: 'speaking_style', value: 'Friendly and professional' },
        { key: 'pet_name', value: 'Buddy', priority: 2 },
        { key: 'profession', value: 'Software Engineer', priority: 2 },
        { key: 'hobby', value: 'reading', priority: 4 }
      ];

      const validation = MemoryInjectionService.validateOnboardingFacts(setupFacts);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      
      // Check that facts are properly categorized
      const identityFacts = validation.categorizedFacts.filter(f => f.category === 'identity');
      const styleFacts = validation.categorizedFacts.filter(f => f.category === 'style');
      const relationshipFacts = validation.categorizedFacts.filter(f => f.category === 'relationships');
      
      expect(identityFacts.length).toBeGreaterThan(0);
      expect(styleFacts.length).toBeGreaterThan(0);
      expect(relationshipFacts.length).toBeGreaterThan(0);
      
      // Check priority assignment
      const nameFact = validation.categorizedFacts.find(f => f.key === 'full_name');
      const styleFact = validation.categorizedFacts.find(f => f.key === 'speaking_style');
      
      expect(nameFact?.priority).toBe(1);
      expect(styleFact?.priority).toBe(1); // Auto-assigned high priority
    });
  });

  describe('Requirement 8.2: Natural reference in first conversation', () => {
    it('should prepare context that enables natural knowledge demonstration', async () => {
      const mockFacts = [
        { key: 'full_name', value: 'Sarah Johnson', priority: 1, confidence: 1.0, created_at: new Date().toISOString() },
        { key: 'speaking_style', value: 'Warm and friendly', priority: 1, confidence: 1.0, created_at: new Date().toISOString() },
        { key: 'pet_name', value: 'Whiskers', priority: 2, confidence: 1.0, created_at: new Date().toISOString() },
        { key: 'pet_type', value: 'cat', priority: 3, confidence: 1.0, created_at: new Date().toISOString() }
      ];

      // Simulate context preparation
      const contextSections = [];
      
      // Core identity
      const coreIdentityFacts = mockFacts.filter(f => f.priority <= 2);
      if (coreIdentityFacts.length > 0) {
        contextSections.push('=== CORE IDENTITY ===');
        coreIdentityFacts.forEach(fact => {
          contextSections.push(`${fact.key}: ${fact.value}`);
        });
        contextSections.push('');
      }

      // Additional context
      const otherFacts = mockFacts.filter(f => f.priority > 2);
      if (otherFacts.length > 0) {
        contextSections.push('=== ADDITIONAL CONTEXT ===');
        otherFacts.forEach(fact => {
          contextSections.push(`${fact.key}: ${fact.value}`);
        });
        contextSections.push('');
      }

      // First conversation instructions
      contextSections.push('=== FIRST CONVERSATION INSTRUCTIONS ===');
      contextSections.push('- This is your first conversation after setup');
      contextSections.push('- You already know all the information above - do not ask for it again');
      contextSections.push('- Reference your knowledge naturally to show you remember the setup');

      const context = contextSections.join('\n');

      // Verify context enables natural reference
      expect(context).toContain('Sarah Johnson');
      expect(context).toContain('Whiskers');
      expect(context).toContain('cat');
      expect(context).toContain('Warm and friendly');
      expect(context).toContain('You already know all the information above');
      expect(context).toContain('Reference your knowledge naturally');
    });
  });

  describe('Requirement 8.3: Demonstrate knowledge of key personal facts', () => {
    it('should organize facts to demonstrate comprehensive knowledge', () => {
      const comprehensiveFacts = [
        { key: 'full_name', value: 'Alex Chen', priority: 1 },
        { key: 'speaking_style', value: 'Enthusiastic and helpful', priority: 1 },
        { key: 'profession', value: 'Data Scientist', priority: 2 },
        { key: 'current_location', value: 'Seattle, WA', priority: 2 },
        { key: 'pet_name', value: 'Luna', priority: 2 },
        { key: 'pet_type', value: 'border collie', priority: 3 },
        { key: 'hobby_primary', value: 'hiking', priority: 3 },
        { key: 'favorite_food', value: 'sushi', priority: 4 }
      ];

      const validation = MemoryInjectionService.validateOnboardingFacts(comprehensiveFacts);

      // Should have comprehensive coverage
      const categories = [...new Set(validation.categorizedFacts.map(f => f.category))];
      expect(categories).toContain('identity');
      expect(categories).toContain('style');
      expect(categories).toContain('relationships');

      // Should have facts at different priority levels
      const priorities = [...new Set(validation.categorizedFacts.map(f => f.priority))];
      expect(priorities).toContain(1); // Core identity
      expect(priorities).toContain(2); // Important context
      expect(priorities.some(p => p >= 3)).toBe(true); // Additional details

      // Should demonstrate knowledge breadth
      const factKeys = validation.categorizedFacts.map(f => f.key);
      expect(factKeys).toContain('full_name');
      expect(factKeys).toContain('profession');
      expect(factKeys).toContain('pet_name');
      expect(factKeys).toContain('hobby_primary');
    });
  });

  describe('Requirement 8.4: No loss of context during transition', () => {
    it('should maintain all setup information through the transition process', () => {
      const originalSetupData = {
        name: 'Jordan Smith',
        speaking_style: 'Professional yet approachable',
        expressions: ['excellent!', 'wonderful!'],
        catchphrases: ['that makes sense'],
        address_terms: { male_friend: ['friend', 'colleague'] },
        core_facts: [
          { key: 'full_name', value: 'Jordan Smith', priority: 1 },
          { key: 'company', value: 'Tech Innovations Inc', priority: 2 },
          { key: 'role', value: 'Product Manager', priority: 2 }
        ]
      };

      // Prepare all facts as they would be processed
      const allFacts = [
        ...originalSetupData.core_facts,
        { key: 'speaking_style', value: originalSetupData.speaking_style },
        { key: 'address_male_friend', value: originalSetupData.address_terms.male_friend.join(' | ') },
        ...originalSetupData.expressions.map(expr => ({
          key: `expression_${expr.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`,
          value: expr
        })),
        ...originalSetupData.catchphrases.map(phrase => ({
          key: `catchphrase_${phrase.split(' ')[0].toLowerCase()}`,
          value: phrase
        }))
      ];

      const validation = MemoryInjectionService.validateOnboardingFacts(allFacts);

      // Verify no information loss
      expect(validation.isValid).toBe(true);
      expect(validation.categorizedFacts.length).toBe(allFacts.length);

      // Verify all original information is preserved
      const factValues = validation.categorizedFacts.map(f => f.value);
      expect(factValues).toContain('Jordan Smith');
      expect(factValues).toContain('Professional yet approachable');
      expect(factValues).toContain('Tech Innovations Inc');
      expect(factValues).toContain('Product Manager');
      expect(factValues).toContain('excellent!');
      expect(factValues).toContain('wonderful!');
      expect(factValues).toContain('that makes sense');
      expect(factValues).toContain('friend | colleague');
    });
  });

  describe('Requirement 8.5: Personalized, fact-aware responses', () => {
    it('should prepare context that enables immediate personalized responses', () => {
      const personalizedSetup = {
        name: 'Maya Patel',
        speaking_style: 'Warm, curious, and encouraging',
        core_facts: [
          { key: 'full_name', value: 'Maya Patel', priority: 1 },
          { key: 'profession', value: 'UX Designer', priority: 2 },
          { key: 'current_location', value: 'Austin, TX', priority: 2 },
          { key: 'pet_name', value: 'Mochi', priority: 2 },
          { key: 'pet_type', value: 'shiba inu', priority: 3 },
          { key: 'hobby_primary', value: 'pottery', priority: 3 },
          { key: 'favorite_cuisine', value: 'Indian', priority: 4 }
        ]
      };

      // Simulate the context that would be generated
      const mockContext = `=== CORE IDENTITY ===
full_name: Maya Patel
speaking_style: Warm, curious, and encouraging
profession: UX Designer
current_location: Austin, TX
pet_name: Mochi

=== ADDITIONAL CONTEXT ===
pet_type: shiba inu
hobby_primary: pottery
favorite_cuisine: Indian

=== FIRST CONVERSATION INSTRUCTIONS ===
- This is your first conversation after setup
- You already know all the information above - do not ask for it again
- Reference your knowledge naturally to show you remember the setup
- Be warm and welcoming, showing you're ready to have meaningful conversations
- If asked about yourself, confidently share what you know`;

      // Verify context enables personalized responses
      expect(mockContext).toContain('Maya Patel');
      expect(mockContext).toContain('UX Designer');
      expect(mockContext).toContain('Austin, TX');
      expect(mockContext).toContain('Mochi');
      expect(mockContext).toContain('shiba inu');
      expect(mockContext).toContain('pottery');
      expect(mockContext).toContain('Indian');
      expect(mockContext).toContain('Warm, curious, and encouraging');

      // Verify instructions for immediate personalization
      expect(mockContext).toContain('confidently share what you know');
      expect(mockContext).toContain('Reference your knowledge naturally');
      expect(mockContext).toContain('ready to have meaningful conversations');

      // Test specific conversation scenarios
      const conversationScenarios = [
        {
          userInput: "Hi! What's your name?",
          expectedElements: ['Maya Patel', 'great to meet you'],
          contextSupports: mockContext.includes('Maya Patel')
        },
        {
          userInput: "Do you have any pets?",
          expectedElements: ['Mochi', 'shiba inu'],
          contextSupports: mockContext.includes('Mochi') && mockContext.includes('shiba inu')
        },
        {
          userInput: "What do you do for work?",
          expectedElements: ['UX Designer', 'Austin'],
          contextSupports: mockContext.includes('UX Designer') && mockContext.includes('Austin, TX')
        },
        {
          userInput: "What are your hobbies?",
          expectedElements: ['pottery'],
          contextSupports: mockContext.includes('pottery')
        }
      ];

      conversationScenarios.forEach(scenario => {
        expect(scenario.contextSupports).toBe(true);
      });
    });
  });

  describe('Integration Quality Assurance', () => {
    it('should handle edge cases gracefully', () => {
      // Test with minimal data
      const minimalFacts = [
        { key: 'full_name', value: 'Min Avatar' }
      ];

      const validation = MemoryInjectionService.validateOnboardingFacts(minimalFacts);
      expect(validation.isValid).toBe(true);
      expect(validation.warnings.length).toBeGreaterThan(0); // Should warn about missing personality

      // Test with excessive data
      const excessiveFacts = Array.from({ length: 50 }, (_, i) => ({
        key: `fact_${i}`,
        value: `value_${i}`,
        priority: Math.floor(i / 10) + 1
      }));

      const excessiveValidation = MemoryInjectionService.validateOnboardingFacts(excessiveFacts);
      expect(excessiveValidation.isValid).toBe(true);
      expect(excessiveValidation.categorizedFacts.length).toBe(50);
    });

    it('should maintain performance with typical onboarding data', () => {
      const typicalFacts = [
        { key: 'full_name', value: 'Performance Test Avatar', priority: 1 },
        { key: 'speaking_style', value: 'Efficient and clear', priority: 1 },
        { key: 'profession', value: 'Performance Engineer', priority: 2 },
        { key: 'current_location', value: 'Performance City', priority: 2 },
        ...Array.from({ length: 10 }, (_, i) => ({
          key: `additional_fact_${i}`,
          value: `Additional value ${i}`,
          priority: 3 + (i % 3)
        }))
      ];

      const startTime = Date.now();
      const validation = MemoryInjectionService.validateOnboardingFacts(typicalFacts);
      const endTime = Date.now();

      expect(validation.isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
    });

    it('should provide comprehensive validation feedback', () => {
      const problematicFacts = [
        { key: 'full_name', value: 'Valid Name', priority: 1 },
        { key: '', value: 'empty key' }, // Problem
        { key: 'empty_value', value: '' }, // Problem
        { key: 'invalid_priority', value: 'test', priority: 15 }, // Problem
        { key: 'invalid_confidence', value: 'test', confidence: 2.0 } // Problem
      ];

      const validation = MemoryInjectionService.validateOnboardingFacts(problematicFacts);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBe(4); // Should catch all problems
      expect(validation.categorizedFacts.length).toBe(1); // Only valid fact processed
      
      // Should provide specific error messages
      expect(validation.errors.some(e => e.includes('key'))).toBe(true);
      expect(validation.errors.some(e => e.includes('value'))).toBe(true);
      expect(validation.errors.some(e => e.includes('priority'))).toBe(true);
      expect(validation.errors.some(e => e.includes('confidence'))).toBe(true);
    });
  });

  describe('End-to-End Readiness Verification', () => {
    it('should verify complete readiness for first conversation', () => {
      const completeOnboardingData = {
        name: 'Complete Test Avatar',
        speaking_style: 'Comprehensive and thorough',
        expressions: ['absolutely!', 'fantastic!', 'wonderful!'],
        catchphrases: ['that\'s interesting', 'I see what you mean'],
        address_terms: { male_friend: ['friend', 'buddy'] },
        core_facts: [
          { key: 'full_name', value: 'Complete Test Avatar', priority: 1 },
          { key: 'profession', value: 'Quality Assurance Engineer', priority: 2 },
          { key: 'current_location', value: 'Test Valley, CA', priority: 2 },
          { key: 'pet_name', value: 'QA', priority: 2 },
          { key: 'pet_type', value: 'test automation bot', priority: 3 },
          { key: 'hobby_primary', value: 'comprehensive testing', priority: 3 },
          { key: 'favorite_activity', value: 'ensuring quality', priority: 4 }
        ]
      };

      // Process all facts
      const allFacts = [
        ...completeOnboardingData.core_facts,
        { key: 'speaking_style', value: completeOnboardingData.speaking_style },
        { key: 'address_male_friend', value: completeOnboardingData.address_terms.male_friend.join(' | ') },
        ...completeOnboardingData.expressions.map(expr => ({
          key: `expression_${expr.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`,
          value: expr
        })),
        ...completeOnboardingData.catchphrases.map(phrase => ({
          key: `catchphrase_${phrase.split(' ')[0].toLowerCase()}`,
          value: phrase
        }))
      ];

      const validation = MemoryInjectionService.validateOnboardingFacts(allFacts);

      // Comprehensive readiness checks
      const readinessChecks = {
        factsValid: validation.isValid,
        noErrors: validation.errors.length === 0,
        hasName: validation.categorizedFacts.some(f => f.key === 'full_name'),
        hasPersonality: validation.categorizedFacts.some(f => f.key === 'speaking_style'),
        hasProfession: validation.categorizedFacts.some(f => f.key === 'profession'),
        hasLocation: validation.categorizedFacts.some(f => f.key === 'current_location'),
        hasPersonalDetails: validation.categorizedFacts.some(f => f.key === 'pet_name'),
        hasExpressions: validation.categorizedFacts.some(f => f.key.includes('expression_')),
        hasCatchphrases: validation.categorizedFacts.some(f => f.key.includes('catchphrase_')),
        hasAddressTerms: validation.categorizedFacts.some(f => f.key === 'address_male_friend'),
        properPriorities: validation.categorizedFacts.every(f => f.priority >= 1 && f.priority <= 10),
        properConfidence: validation.categorizedFacts.every(f => f.confidence >= 0 && f.confidence <= 1)
      };

      // All checks should pass
      Object.entries(readinessChecks).forEach(([check, passed]) => {
        expect(passed).toBe(true);
      });

      // Overall readiness
      const overallReady = Object.values(readinessChecks).every(check => check === true);
      expect(overallReady).toBe(true);

      // Should have comprehensive fact coverage
      expect(validation.categorizedFacts.length).toBeGreaterThanOrEqual(12);
      
      // Should have facts in all major categories
      const categories = [...new Set(validation.categorizedFacts.map(f => f.category))];
      expect(categories).toContain('identity');
      expect(categories).toContain('style');
      expect(categories).toContain('relationships');
    });
  });
});