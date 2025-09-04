// src/lib/services/__tests__/deepLaneStyleCoordinator.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { DeepLaneStyleCoordinator } from '../deepLaneStyleCoordinator';
import { FactbookSnippet } from '../factbookService';

describe('DeepLaneStyleCoordinator', () => {
  let coordinator: DeepLaneStyleCoordinator;
  
  const mockSnippets: FactbookSnippet[] = [
    {
      id: 'pets.olive',
      path: 'pets.olive',
      text: 'Olive was my beloved Puerto Rican street dog. She survived brutal Maine winters and we buried her in Texas.',
      topics: ['pets', 'dogs', 'olive'],
      keywords: ['olive', 'puerto', 'rican', 'street', 'dog', 'maine', 'buried', 'texas']
    },
    {
      id: 'timeline.austin_years',
      path: 'timeline.austin_years',
      text: 'I lived in Austin, Texas from 2009 to 2018 - nine incredible years. The music scene was amazing.',
      topics: ['timeline', 'places', 'austin'],
      keywords: ['austin', 'texas', '2009', '2018', 'nine', 'years', 'music', 'amazing']
    }
  ];

  const mockCoordinationHints = {
    expandOn: ['pets.olive'],
    avoidRepeating: ['beloved', 'puerto rican'],
    suggestedTone: 'warm',
    topicFocus: 'pets'
  };

  beforeEach(() => {
    coordinator = new DeepLaneStyleCoordinator();
  });

  describe('buildDeepLanePrompt', () => {
    it('should build prompt with facts first pattern', () => {
      const prompt = coordinator.buildDeepLanePrompt({
        query: "Tell me about Olive",
        snippets: mockSnippets,
        coordinationHints: mockCoordinationHints
      });

      // Should contain factual content first
      expect(prompt).toContain('[pets.olive] Olive was my beloved Puerto Rican street dog');
      expect(prompt).toContain('FACTUAL MEMORIES (facts first)');
      
      // Should contain style instructions after facts
      expect(prompt).toContain('STYLE GUIDELINES');
      expect(prompt).toContain('Tone: warm');
      
      // Should contain coordination rules
      expect(prompt).toContain('COORDINATION RULES');
      expect(prompt).toContain('Use ONLY the factual content provided');
      expect(prompt).toContain('Never invent or embellish facts');
    });

    it('should include snippet IDs for traceability', () => {
      const prompt = coordinator.buildDeepLanePrompt({
        query: "Tell me about Olive",
        snippets: mockSnippets,
        coordinationHints: mockCoordinationHints
      });

      expect(prompt).toContain('Available snippet IDs for reference: pets.olive, timeline.austin_years');
      expect(prompt).toContain('[pets.olive]');
      // Austin snippet should be in the available IDs but not in the factual context since we're only expanding on Olive
      expect(prompt).toContain('timeline.austin_years');
    });

    it('should enforce fact/style separation in instructions', () => {
      const prompt = coordinator.buildDeepLanePrompt({
        query: "Tell me about Olive",
        snippets: mockSnippets,
        coordinationHints: mockCoordinationHints
      });

      expect(prompt).toContain('SELECT FACTS: Choose relevant facts');
      expect(prompt).toContain('APPLY STYLE: Then apply the style guidelines');
      expect(prompt).toContain('MAINTAIN SEPARATION: Never let personality create facts');
      expect(prompt).toContain('Never let personality influence fact selection');
    });

    it('should include coordination hints without mixing with facts', () => {
      const prompt = coordinator.buildDeepLanePrompt({
        query: "Tell me about Olive",
        snippets: mockSnippets,
        coordinationHints: mockCoordinationHints,
        fastHookContent: "Olive was such a special dog!"
      });

      expect(prompt).toContain('Do not repeat these phrases: beloved, puerto rican');
      expect(prompt).toContain('Focus on expanding the facts from snippets: pets.olive');
      expect(prompt).toContain('BUILD ON HOOK: This follows the fast response: "Olive was such a special dog!"');
    });

    it('should apply appropriate style instructions for different tones', () => {
      const enthusiasticHints = {
        ...mockCoordinationHints,
        suggestedTone: 'enthusiastic',
        topicFocus: 'austin'
      };

      const prompt = coordinator.buildDeepLanePrompt({
        query: "Tell me about Austin",
        snippets: mockSnippets,
        coordinationHints: enthusiasticHints
      });

      expect(prompt).toContain('Tone: enthusiastic');
      expect(prompt).toContain('Deep lane: Build on facts');
    });
  });

  describe('validateResponse', () => {
    it('should validate clean factual responses', () => {
      const response = "Based on [pets.olive], Olive was my Puerto Rican street dog who survived Maine winters.";
      const result = coordinator.validateResponse(response, ['pets.olive']);

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.factSources).toContain('pets.olive');
    });

    it('should detect personality-driven uncertainty', () => {
      const response = "I think I remember Olive being a great dog.";
      const result = coordinator.validateResponse(response, ['pets.olive']);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Personality-driven uncertainty: "I think I remember"');
    });

    it('should detect unauthorized fact sources', () => {
      const response = "Based on [unauthorized.snippet], this is a fact.";
      const result = coordinator.validateResponse(response, ['pets.olive']);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Unauthorized fact sources: unauthorized.snippet');
    });

    it('should extract referenced snippet IDs', () => {
      const response = "From [pets.olive] and [timeline.austin_years], I can tell you about both.";
      const result = coordinator.validateResponse(response, ['pets.olive', 'timeline.austin_years']);

      expect(result.factSources).toContain('pets.olive');
      expect(result.factSources).toContain('timeline.austin_years');
      expect(result.isValid).toBe(true);
    });

    it('should handle responses without snippet references', () => {
      const response = "This is a response without any snippet references.";
      const result = coordinator.validateResponse(response, ['pets.olive']);

      expect(result.factSources).toHaveLength(0);
      // Should still be valid if no violations detected
      expect(result.isValid).toBe(true);
    });
  });

  describe('fact/style separation enforcement', () => {
    it('should separate factual context from style instructions', () => {
      const prompt = coordinator.buildDeepLanePrompt({
        query: "Tell me about Olive",
        snippets: [mockSnippets[0]], // Only Olive snippet
        coordinationHints: mockCoordinationHints
      });

      // Facts should come first
      const factsSectionStart = prompt.indexOf('FACTUAL MEMORIES');
      const styleSectionStart = prompt.indexOf('STYLE GUIDELINES');
      
      expect(factsSectionStart).toBeLessThan(styleSectionStart);
      expect(factsSectionStart).toBeGreaterThan(-1);
      expect(styleSectionStart).toBeGreaterThan(-1);
    });

    it('should emphasize fact selection before style application', () => {
      const prompt = coordinator.buildDeepLanePrompt({
        query: "Tell me about Olive",
        snippets: mockSnippets,
        coordinationHints: mockCoordinationHints
      });

      expect(prompt).toContain('1. SELECT FACTS: Choose relevant facts');
      expect(prompt).toContain('2. APPLY STYLE: Then apply the style guidelines');
      expect(prompt).toContain('based purely on factual relevance');
    });

    it('should require fact traceability', () => {
      const prompt = coordinator.buildDeepLanePrompt({
        query: "Tell me about Olive",
        snippets: mockSnippets,
        coordinationHints: mockCoordinationHints
      });

      expect(prompt).toContain('TRACE SOURCES: Reference snippet IDs');
      expect(prompt).toContain('Every claim must trace back to a specific snippet ID');
    });
  });

  describe('coordination rules', () => {
    it('should build coordination rules without mixing facts and style', () => {
      const prompt = coordinator.buildDeepLanePrompt({
        query: "Tell me about Olive",
        snippets: mockSnippets,
        coordinationHints: mockCoordinationHints
      });

      expect(prompt).toContain('maintain fact/style separation');
      expect(prompt).toContain('Apply personality and tone AFTER selecting facts');
      expect(prompt).toContain('never during fact selection');
    });

    it('should handle fast hook coordination', () => {
      const prompt = coordinator.buildDeepLanePrompt({
        query: "Tell me about Olive",
        snippets: mockSnippets,
        coordinationHints: mockCoordinationHints,
        fastHookContent: "Olive was amazing!"
      });

      expect(prompt).toContain('BUILD ON HOOK');
      expect(prompt).toContain('Olive was amazing!');
      expect(prompt).toContain('Add depth without repetition');
    });
  });

  describe('StyleProfile integration', () => {
    it('should use StyleProfile for generating instructions', () => {
      const styleProfile = coordinator.getStyleProfile();
      expect(styleProfile).toBeDefined();
      
      const prompt = coordinator.buildDeepLanePrompt({
        query: "Tell me about Olive",
        snippets: mockSnippets,
        coordinationHints: mockCoordinationHints
      });

      // Should contain StyleProfile-generated instructions
      expect(prompt).toContain('STYLE GUIDELINES');
      expect(prompt).toContain('Deep lane: Build on facts');
    });

    it('should validate responses using StyleProfile', () => {
      const response = "I think I remember Olive being great.";
      const result = coordinator.validateResponse(response, ['pets.olive']);

      // Should use StyleProfile validation
      expect(result.violations).toContain('Personality-driven uncertainty: "I think I remember"');
    });
  });
});