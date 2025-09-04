// src/lib/services/__tests__/deepLaneCoordinator.test.ts
// Tests for DeepLaneCoordinator with factbook-only responses

import { describe, it, expect, beforeEach } from 'vitest';
import { DeepLaneCoordinator, DeepLaneCoordinationHints } from '../deepLaneCoordinator';
import { FactbookSnippet } from '../factbookService';

describe('DeepLaneCoordinator', () => {
  let coordinator: DeepLaneCoordinator;
  let mockSnippets: FactbookSnippet[];
  let mockCoordinationHints: DeepLaneCoordinationHints;

  beforeEach(() => {
    coordinator = new DeepLaneCoordinator();
    
    mockSnippets = [
      {
        id: 'pets.olive.description',
        path: 'pets.olive.description',
        text: 'Olive was my beloved Puerto Rican street dog who came with me to Maine. She was tough as nails but sweet as pie.',
        topics: ['pets', 'dogs', 'maine', 'puerto_rico'],
        keywords: ['olive', 'puerto', 'rican', 'street', 'dog', 'maine', 'tough']
      },
      {
        id: 'pets.olive.story',
        path: 'pets.olive.story',
        text: 'Found her as a stray in Puerto Rico. She survived a brutal Maine winter and became the toughest, most loyal companion. When she passed, we buried her in Texas.',
        topics: ['pets', 'dogs', 'maine', 'puerto_rico', 'texas'],
        keywords: ['found', 'stray', 'puerto', 'rico', 'maine', 'winter', 'loyal', 'texas', 'buried']
      }
    ];

    mockCoordinationHints = {
      expandOn: ['pets.olive.description'],
      avoidRepeating: ['Puerto Rican street dog'],
      suggestedTone: 'warm',
      topicFocus: 'pets',
      snippetIds: ['pets.olive.description', 'pets.olive.story']
    };
  });

  describe('buildDeepLanePrompt', () => {
    it('should create factbook-only prompt with proper structure', () => {
      const options = {
        query: 'Tell me about Olive',
        snippets: mockSnippets,
        coordinationHints: mockCoordinationHints,
        fastHookContent: 'Olive was such a special dog!'
      };

      const result = coordinator.buildDeepLanePrompt(options);

      // Should have all required components
      expect(result.systemPrompt).toContain('You are Jonathan Braden. Answer ONLY with facts from the Factbook');
      expect(result.systemPrompt).toContain('FACTBOOK ONLY');
      expect(result.systemPrompt).toContain('Never invent, guess, or create facts');
      
      expect(result.userPrompt).toContain('FACTBOOK CONTENT');
      expect(result.userPrompt).toContain('[pets.olive.description]');
      expect(result.userPrompt).toContain('[pets.olive.story]');
      expect(result.userPrompt).toContain('Tell me about Olive');
      
      expect(result.factualContext).toContain('Olive was my beloved Puerto Rican street dog');
      expect(result.factualContext).toContain('Found her as a stray in Puerto Rico');
      
      expect(result.coordinationRules).toContain('BUILD ON HOOK');
      expect(result.coordinationRules).toContain('Olive was such a special dog!');
      expect(result.coordinationRules).toContain('Do not repeat these phrases: Puerto Rican street dog');
    });

    it('should prioritize snippets marked for expansion', () => {
      const options = {
        query: 'Tell me more about Olive',
        snippets: mockSnippets,
        coordinationHints: {
          ...mockCoordinationHints,
          expandOn: ['pets.olive.story'] // Prioritize the story snippet
        }
      };

      const result = coordinator.buildDeepLanePrompt(options);
      
      // Story snippet should appear first in factual context
      expect(result.factualContext).toMatch(/\[pets\.olive\.story\].*\[pets\.olive\.description\]/s);
    });

    it('should handle empty snippets gracefully', () => {
      const options = {
        query: 'Tell me about something unknown',
        snippets: [],
        coordinationHints: {
          expandOn: [],
          avoidRepeating: [],
          suggestedTone: 'conversational',
          topicFocus: 'unknown',
          snippetIds: []
        }
      };

      const result = coordinator.buildDeepLanePrompt(options);
      
      expect(result.factualContext).toBe('No factbook information available for this query.');
      expect(result.systemPrompt).toContain('You are Jonathan Braden. Answer ONLY with facts from the Factbook');
    });

    it('should include proper coordination rules without fast hook', () => {
      const options = {
        query: 'Tell me about Olive',
        snippets: mockSnippets,
        coordinationHints: mockCoordinationHints
        // No fastHookContent
      };

      const result = coordinator.buildDeepLanePrompt(options);
      
      expect(result.coordinationRules).toContain('FACTBOOK ONLY');
      expect(result.coordinationRules).toContain('FACT VALIDATION');
      expect(result.coordinationRules).toContain('NO HALLUCINATION');
      expect(result.coordinationRules).not.toContain('BUILD ON HOOK');
    });

    it('should apply style instructions for deep lane', () => {
      const options = {
        query: 'Tell me about Olive',
        snippets: mockSnippets,
        coordinationHints: mockCoordinationHints
      };

      const result = coordinator.buildDeepLanePrompt(options);
      
      expect(result.styleInstructions).toContain('STYLE GUIDELINES');
      expect(result.styleInstructions).toContain('Tone: warm');
      expect(result.styleInstructions).toContain('Deep lane: Build on facts');
      expect(result.styleInstructions).toContain('Apply style ONLY to presentation');
    });
  });

  describe('validateFactbookResponse', () => {
    it('should validate response with proper snippet references', () => {
      const response = 'Based on [pets.olive.description], Olive was my beloved Puerto Rican street dog. As mentioned in [pets.olive.story], I found her as a stray in Puerto Rico.';
      const allowedIds = ['pets.olive.description', 'pets.olive.story'];

      const result = coordinator.validateFactbookResponse(response, allowedIds);

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.hallucinations).toHaveLength(0);
      expect(result.factSources).toEqual(['pets.olive.description', 'pets.olive.story']);
    });

    it('should detect unauthorized fact sources', () => {
      const response = 'Based on [unauthorized.snippet], Olive was amazing. Also from [pets.olive.description], she was tough.';
      const allowedIds = ['pets.olive.description', 'pets.olive.story'];

      const result = coordinator.validateFactbookResponse(response, allowedIds);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Unauthorized fact sources: unauthorized.snippet');
      expect(result.factSources).toEqual(['unauthorized.snippet', 'pets.olive.description']);
    });

    it('should detect hallucination indicators', () => {
      const response = 'I think I remember Olive being a great dog. If I recall correctly, she loved playing fetch.';
      const allowedIds = ['pets.olive.description'];

      const result = coordinator.validateFactbookResponse(response, allowedIds);

      expect(result.isValid).toBe(false);
      expect(result.hallucinations.length).toBeGreaterThan(0);
      expect(result.hallucinations[0]).toContain('Uncertainty indicator');
    });

    it('should handle response without snippet references', () => {
      const response = 'Olive was a wonderful dog who brought joy to my life.';
      const allowedIds = ['pets.olive.description'];

      const result = coordinator.validateFactbookResponse(response, allowedIds);

      expect(result.factSources).toHaveLength(0);
      // Should still be valid if no unauthorized sources or hallucinations
    });

    it('should detect multiple hallucination patterns', () => {
      const response = 'I believe I had a dog named Olive. I might have found her in Puerto Rico, and I probably loved her very much.';
      const allowedIds = ['pets.olive.description'];

      const result = coordinator.validateFactbookResponse(response, allowedIds);

      expect(result.isValid).toBe(false);
      expect(result.hallucinations.length).toBeGreaterThanOrEqual(3); // Multiple patterns detected
    });
  });

  describe('createCoordinationHints', () => {
    it('should create proper coordination hints from snippets', () => {
      const hints = DeepLaneCoordinator.createCoordinationHints(
        mockSnippets,
        'enthusiastic',
        'pets',
        ['avoid this phrase']
      );

      expect(hints.expandOn).toEqual(['pets.olive.description', 'pets.olive.story']);
      expect(hints.avoidRepeating).toEqual(['avoid this phrase']);
      expect(hints.suggestedTone).toBe('enthusiastic');
      expect(hints.topicFocus).toBe('pets');
      expect(hints.snippetIds).toEqual(['pets.olive.description', 'pets.olive.story']);
    });

    it('should handle empty avoid repeating array', () => {
      const hints = DeepLaneCoordinator.createCoordinationHints(
        mockSnippets,
        'warm',
        'pets'
      );

      expect(hints.avoidRepeating).toEqual([]);
      expect(hints.expandOn).toEqual(['pets.olive.description', 'pets.olive.story']);
    });
  });

  describe('system prompt requirements', () => {
    it('should enforce the required system prompt format', () => {
      const options = {
        query: 'Tell me about Olive',
        snippets: mockSnippets,
        coordinationHints: mockCoordinationHints
      };

      const result = coordinator.buildDeepLanePrompt(options);

      // Must contain the exact required system prompt
      expect(result.systemPrompt).toContain('You are Jonathan Braden. Answer ONLY with facts from the Factbook unless asked for opinions or style');
      
      // Must enforce factbook-only constraints
      expect(result.systemPrompt).toContain('Use ONLY the factbook content provided');
      expect(result.systemPrompt).toContain('Never invent, guess, or create facts');
      expect(result.systemPrompt).toContain('Every factual claim must trace to a specific factbook snippet ID');
    });

    it('should maintain fact/style separation in system prompt', () => {
      const options = {
        query: 'Tell me about Olive',
        snippets: mockSnippets,
        coordinationHints: mockCoordinationHints
      };

      const result = coordinator.buildDeepLanePrompt(options);

      expect(result.systemPrompt).toContain('Apply personality and style ONLY to presentation');
      expect(result.systemPrompt).toContain('Never let personality create facts or influence fact selection');
      expect(result.systemPrompt).toContain('MAINTAIN SEPARATION');
    });
  });

  describe('factual context extraction', () => {
    it('should include snippet IDs for traceability', () => {
      const options = {
        query: 'Tell me about Olive',
        snippets: mockSnippets,
        coordinationHints: mockCoordinationHints
      };

      const result = coordinator.buildDeepLanePrompt(options);

      expect(result.factualContext).toContain('[pets.olive.description]');
      expect(result.factualContext).toContain('[pets.olive.story]');
      expect(result.factualContext).toContain('Olive was my beloved Puerto Rican street dog');
      expect(result.factualContext).toContain('Found her as a stray in Puerto Rico');
    });

    it('should preserve original factbook text without modification', () => {
      const options = {
        query: 'Tell me about Olive',
        snippets: mockSnippets,
        coordinationHints: mockCoordinationHints
      };

      const result = coordinator.buildDeepLanePrompt(options);

      // Should contain exact text from snippets
      expect(result.factualContext).toContain('Olive was my beloved Puerto Rican street dog who came with me to Maine. She was tough as nails but sweet as pie.');
      expect(result.factualContext).toContain('Found her as a stray in Puerto Rico. She survived a brutal Maine winter and became the toughest, most loyal companion. When she passed, we buried her in Texas.');
    });
  });

  describe('integration with StyleProfile', () => {
    it('should get StyleProfile instance', () => {
      const styleProfile = coordinator.getStyleProfile();
      expect(styleProfile).toBeDefined();
      expect(styleProfile.constructor.name).toBe('StyleProfile');
    });

    it('should apply style instructions for different tones', () => {
      const warmOptions = {
        query: 'Tell me about Olive',
        snippets: mockSnippets,
        coordinationHints: { ...mockCoordinationHints, suggestedTone: 'warm' }
      };

      const enthusiasticOptions = {
        query: 'Tell me about Olive',
        snippets: mockSnippets,
        coordinationHints: { ...mockCoordinationHints, suggestedTone: 'enthusiastic' }
      };

      const warmResult = coordinator.buildDeepLanePrompt(warmOptions);
      const enthusiasticResult = coordinator.buildDeepLanePrompt(enthusiasticOptions);

      expect(warmResult.styleInstructions).toContain('Tone: warm');
      expect(enthusiasticResult.styleInstructions).toContain('Tone: enthusiastic');
    });
  });
});