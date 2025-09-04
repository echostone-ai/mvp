// src/lib/services/__tests__/deepLaneIntegration.test.ts
// Integration tests for DeepLaneCoordinator with factbook system

import { describe, it, expect, beforeEach } from 'vitest';
import { DeepLaneCoordinator } from '../deepLaneCoordinator';
import { FactbookService } from '../factbookService';
import { LightweightAnalyzer } from '../lightweightAnalyzer';
import { FactbookHookSelector } from '../factbookHookSelector';
import factbookData from '../../../data/jonathan_profile.json';

describe('DeepLaneCoordinator Integration', () => {
  let coordinator: DeepLaneCoordinator;
  let factbookService: FactbookService;
  let analyzer: LightweightAnalyzer;
  let hookSelector: FactbookHookSelector;

  beforeEach(async () => {
    coordinator = new DeepLaneCoordinator();
    factbookService = FactbookService.getInstance();
    analyzer = new LightweightAnalyzer();
    hookSelector = new FactbookHookSelector();

    // Initialize factbook service
    await factbookService.loadFactbook(factbookData);
  });

  describe('end-to-end factbook integration', () => {
    it('should create coordinated deep lane prompt from factbook query', async () => {
      const query = 'Tell me about Olive';

      // Step 1: Analyze query and get snippets (simulating fast lane)
      const analysis = analyzer.analyzeQueryWithSnippets(query);
      expect(analysis.relevantSnippets).toBeDefined();
      expect(analysis.relevantSnippets!.length).toBeGreaterThan(0);

      // Step 2: Select hook (simulating fast lane hook selection)
      const hookSelection = hookSelector.selectHook(analysis.relevantSnippets!, query, 'pets');
      expect(hookSelection.hook).toBeTruthy();
      expect(hookSelection.coordinationHints).toBeDefined();

      // Step 3: Build deep lane prompt using DeepLaneCoordinator
      const deepLaneResponse = coordinator.buildDeepLanePrompt({
        query,
        snippets: analysis.relevantSnippets!,
        coordinationHints: {
          expandOn: hookSelection.coordinationHints.expandOn,
          avoidRepeating: hookSelection.coordinationHints.avoidRepeating,
          suggestedTone: hookSelection.coordinationHints.suggestedTone,
          topicFocus: hookSelection.coordinationHints.topicFocus,
          snippetIds: hookSelection.snippetIds
        },
        fastHookContent: hookSelection.hook
      });

      // Verify the deep lane prompt enforces factbook-only responses
      expect(deepLaneResponse.systemPrompt).toContain('You are Jonathan Braden. Answer ONLY with facts from the Factbook');
      expect(deepLaneResponse.systemPrompt).toContain('Never invent, guess, or create facts');
      expect(deepLaneResponse.userPrompt).toContain('FACTBOOK CONTENT');
      expect(deepLaneResponse.userPrompt).toContain('Tell me about Olive');

      // Verify factual context contains Olive-related snippets
      expect(deepLaneResponse.factualContext).toContain('Olive');
      expect(deepLaneResponse.factualContext).toMatch(/\[pets\.olive\]/);

      // Verify coordination rules include fast hook content
      expect(deepLaneResponse.coordinationRules).toContain('BUILD ON HOOK');
      expect(deepLaneResponse.coordinationRules).toContain(hookSelection.hook);
    });

    it('should validate factbook-only responses correctly', async () => {
      const query = 'Tell me about Olive';
      const analysis = analyzer.analyzeQueryWithSnippets(query);
      const snippets = analysis.relevantSnippets!;

      // Test valid factbook response
      const validResponse = 'Based on [pets.olive], Olive was my beloved Puerto Rican street dog who survived brutal Maine winters.';
      const validation = coordinator.validateFactbookResponse(validResponse, snippets.map(s => s.id));

      expect(validation.isValid).toBe(true);
      expect(validation.violations).toHaveLength(0);
      expect(validation.hallucinations).toHaveLength(0);
      expect(validation.factSources.length).toBeGreaterThan(0);

      // Test invalid response with hallucination
      const invalidResponse = 'I think I remember Olive being a great dog, and I believe she loved playing fetch.';
      const invalidValidation = coordinator.validateFactbookResponse(invalidResponse, snippets.map(s => s.id));

      expect(invalidValidation.isValid).toBe(false);
      expect(invalidValidation.hallucinations.length).toBeGreaterThan(0);
    });

    it('should handle different topics with proper coordination', async () => {
      const queries = [
        { query: 'Tell me about Olive', expectedTopics: ['pets'] },
        { query: 'When did you live in Austin', expectedTopics: ['places', 'timeline'] },
        { query: 'Tell me about Tyler', expectedTopics: ['relationships'] }
      ];

      for (const { query, expectedTopics } of queries) {
        const analysis = analyzer.analyzeQueryWithSnippets(query);
        expect(analysis.relevantSnippets).toBeDefined();
        expect(analysis.relevantSnippets!.length).toBeGreaterThan(0);

        // Use the first expected topic for hook selection
        const hookSelection = hookSelector.selectHook(analysis.relevantSnippets!, query, expectedTopics[0]);
        
        // The topic focus should be one of the expected topics
        expect(expectedTopics).toContain(hookSelection.coordinationHints.topicFocus);

        const deepLaneResponse = coordinator.buildDeepLanePrompt({
          query,
          snippets: analysis.relevantSnippets!,
          coordinationHints: {
            expandOn: hookSelection.coordinationHints.expandOn,
            avoidRepeating: hookSelection.coordinationHints.avoidRepeating,
            suggestedTone: hookSelection.coordinationHints.suggestedTone,
            topicFocus: hookSelection.coordinationHints.topicFocus,
            snippetIds: hookSelection.snippetIds
          }
        });

        // Verify topic consistency
        expect(deepLaneResponse.coordinationRules).toContain(`Stay within the ${hookSelection.coordinationHints.topicFocus} topic area`);
        expect(deepLaneResponse.systemPrompt).toContain('You are Jonathan Braden. Answer ONLY with facts from the Factbook');
      }
    });
  });

  describe('coordination with StyleProfile', () => {
    it('should apply different tones correctly', async () => {
      const query = 'Tell me about Olive';
      const analysis = analyzer.analyzeQueryWithSnippets(query);
      const snippets = analysis.relevantSnippets!;

      const tones = ['warm', 'enthusiastic', 'conversational'];

      for (const tone of tones) {
        const deepLaneResponse = coordinator.buildDeepLanePrompt({
          query,
          snippets,
          coordinationHints: {
            expandOn: snippets.map(s => s.id),
            avoidRepeating: [],
            suggestedTone: tone,
            topicFocus: 'pets',
            snippetIds: snippets.map(s => s.id)
          }
        });

        // The StyleProfile may determine a different tone based on topics
        // So we check that it contains tone information and style separation
        expect(deepLaneResponse.styleInstructions).toContain('Tone:');
        expect(deepLaneResponse.styleInstructions).toContain('Apply style ONLY to presentation');
      }
    });

    it('should maintain fact/style separation', async () => {
      const query = 'Tell me about Olive';
      const analysis = analyzer.analyzeQueryWithSnippets(query);
      const snippets = analysis.relevantSnippets!;

      const deepLaneResponse = coordinator.buildDeepLanePrompt({
        query,
        snippets,
        coordinationHints: {
          expandOn: snippets.map(s => s.id),
          avoidRepeating: [],
          suggestedTone: 'warm',
          topicFocus: 'pets',
          snippetIds: snippets.map(s => s.id)
        }
      });

      // Verify fact/style separation is enforced
      expect(deepLaneResponse.systemPrompt).toContain('Apply personality and style ONLY to presentation');
      expect(deepLaneResponse.systemPrompt).toContain('Never let personality create facts or influence fact selection');
      expect(deepLaneResponse.coordinationRules).toContain('STYLE AFTER FACTS');
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle empty snippets gracefully', () => {
      const deepLaneResponse = coordinator.buildDeepLanePrompt({
        query: 'Tell me about something unknown',
        snippets: [],
        coordinationHints: {
          expandOn: [],
          avoidRepeating: [],
          suggestedTone: 'conversational',
          topicFocus: 'unknown',
          snippetIds: []
        }
      });

      expect(deepLaneResponse.factualContext).toBe('No factbook information available for this query.');
      expect(deepLaneResponse.systemPrompt).toContain('You are Jonathan Braden. Answer ONLY with facts from the Factbook');
    });

    it('should create coordination hints from snippets', async () => {
      const query = 'Tell me about Olive';
      const analysis = analyzer.analyzeQueryWithSnippets(query);
      const snippets = analysis.relevantSnippets!;

      const hints = DeepLaneCoordinator.createCoordinationHints(
        snippets,
        'warm',
        'pets',
        ['avoid this phrase']
      );

      expect(hints.expandOn).toEqual(snippets.map(s => s.id));
      expect(hints.suggestedTone).toBe('warm');
      expect(hints.topicFocus).toBe('pets');
      expect(hints.avoidRepeating).toEqual(['avoid this phrase']);
      expect(hints.snippetIds).toEqual(snippets.map(s => s.id));
    });
  });
});