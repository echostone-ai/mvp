import { describe, it, expect, beforeEach } from 'vitest';
import { FactbookHookSelector } from '../factbookHookSelector';
import { FactbookSnippet } from '../factbookService';
import { StyleProfile } from '../styleProfile';

describe('FactbookHookSelector', () => {
  let selector: FactbookHookSelector;
  
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
    },
    {
      id: 'opinions.trump',
      path: 'opinions.trump',
      text: 'I think Trump is absolutely terrible for America. His policies on immigration are cruel.',
      topics: ['opinions', 'politics', 'trump'],
      keywords: ['trump', 'terrible', 'america', 'immigration', 'cruel', 'politics']
    }
  ];
  
  beforeEach(() => {
    selector = new FactbookHookSelector();
  });
  
  describe('selectHook', () => {
    it('should select appropriate hook for pet queries', () => {
      const result = selector.selectHook(mockSnippets, "Tell me about Olive");
      
      expect(result.hook).toContain('Olive');
      expect(result.hook).toContain('Puerto Rican');
      expect(result.snippetIds).toContain('pets.olive');
      expect(result.coordinationHints.topicFocus).toBe('pets');
      expect(result.coordinationHints.suggestedTone).toBe('warm');
    });
    
    it('should select appropriate hook for Austin queries', () => {
      const result = selector.selectHook(mockSnippets, "When did you live in Austin?");
      
      expect(result.hook).toContain('Austin');
      expect(result.hook).toContain('incredible');
      expect(result.snippetIds).toContain('timeline.austin_years');
      expect(result.coordinationHints.topicFocus).toBe('timeline');
      expect(result.coordinationHints.suggestedTone).toBe('enthusiastic');
    });
    
    it('should select appropriate hook for political queries', () => {
      const result = selector.selectHook(mockSnippets, "What do you think about Trump?");
      
      expect(result.hook).toContain('Trump');
      expect(result.hook).toContain('terrible');
      expect(result.snippetIds).toContain('opinions.trump');
      expect(result.coordinationHints.topicFocus).toBe('opinions');
      expect(result.coordinationHints.suggestedTone).toBe('assertive');
    });
    
    it('should handle empty snippets gracefully', () => {
      const result = selector.selectHook([], "Tell me about something");
      
      expect(result.hook).toBe("I'm not sure I have information about that.");
      expect(result.snippetIds).toHaveLength(0);
      expect(result.coordinationHints.topicFocus).toBe('general');
    });
  });
  
  describe('generateHookFromSnippet', () => {
    it('should apply formatting guardrails', () => {
      const longSnippet: FactbookSnippet = {
        id: 'test.long',
        path: 'test.long',
        text: 'This is a very long text that exceeds the 160 character limit and should be truncated properly while maintaining readability and proper punctuation.',
        topics: ['test'],
        keywords: ['long', 'text']
      };
      
      const hook = selector.generateHookFromSnippet(longSnippet, "test query");
      
      expect(hook.length).toBeLessThanOrEqual(160);
      expect(hook).toMatch(/[.!?]$/); // Should end with punctuation
      expect(hook).not.toContain('\n'); // No newlines
    });
    
    it('should remove emojis', () => {
      const emojiSnippet: FactbookSnippet = {
        id: 'test.emoji',
        path: 'test.emoji',
        text: 'This text has emojis 😀 🎉 that should be removed!',
        topics: ['test'],
        keywords: ['emoji', 'text']
      };
      
      const hook = selector.generateHookFromSnippet(emojiSnippet, "test query");
      
      expect(hook).not.toMatch(/[\u{1F600}-\u{1F64F}]/u);
      expect(hook).toBe('This text has emojis that should be removed!');
    });
    
    it('should handle newlines properly', () => {
      const newlineSnippet: FactbookSnippet = {
        id: 'test.newline',
        path: 'test.newline',
        text: 'This text has\nnewlines that\nshould be removed.',
        topics: ['test'],
        keywords: ['newline', 'text']
      };
      
      const hook = selector.generateHookFromSnippet(newlineSnippet, "test query");
      
      expect(hook).not.toContain('\n');
      expect(hook).toBe('This text has newlines that should be removed.');
    });
  });
  
  describe('scoring system', () => {
    it('should score exact keyword matches highest', () => {
      const oliveSnippet = mockSnippets.find(s => s.id === 'pets.olive')!;
      const austinSnippet = mockSnippets.find(s => s.id === 'timeline.austin_years')!;
      
      // Query about Olive should score Olive snippet higher
      const result = selector.selectHook([oliveSnippet, austinSnippet], "Tell me about Olive");
      expect(result.snippetIds[0]).toBe('pets.olive');
      
      // Query about Austin should score Austin snippet higher
      const result2 = selector.selectHook([oliveSnippet, austinSnippet], "When did you live in Austin?");
      expect(result2.snippetIds[0]).toBe('timeline.austin_years');
    });
  });
  
  describe('coordination hints', () => {
    it('should generate appropriate coordination hints', () => {
      const result = selector.selectHook(mockSnippets, "Tell me about Olive");
      
      expect(result.coordinationHints.expandOn).toContain('pets.olive');
      expect(result.coordinationHints.avoidRepeating.length).toBeGreaterThan(0);
      expect(result.coordinationHints.suggestedTone).toBe('warm');
      expect(result.coordinationHints.topicFocus).toBe('pets');
    });
    
    it('should extract key phrases to avoid repeating', () => {
      const result = selector.selectHook(mockSnippets, "Tell me about Austin");
      
      // Should extract both 2-word phrases and distinctive single words
      expect(result.coordinationHints.avoidRepeating).toContain('austin was');
      expect(result.coordinationHints.avoidRepeating).toContain('incredible chapter');
      expect(result.coordinationHints.avoidRepeating.length).toBeGreaterThan(0);
      
      // Should contain some distinctive words
      const hasDistinctiveWords = result.coordinationHints.avoidRepeating.some(phrase => 
        phrase.length > 3 && !['austin', 'was', 'such'].includes(phrase)
      );
      expect(hasDistinctiveWords).toBe(true);
    });
    
    it('should include source snippet IDs for deep lane handoff', () => {
      const result = selector.selectHook(mockSnippets, "Tell me about Olive");
      
      // Should include the primary snippet ID
      expect(result.snippetIds).toContain('pets.olive');
      expect(result.snippetIds.length).toBeGreaterThan(0);
      
      // Coordination hints should reference the same snippet for expansion
      expect(result.coordinationHints.expandOn).toContain('pets.olive');
    });
    
    it('should suggest appropriate tones based on content', () => {
      const oliveResult = selector.selectHook([mockSnippets[0]], "Tell me about Olive");
      expect(oliveResult.coordinationHints.suggestedTone).toBe('warm');
      
      const austinResult = selector.selectHook([mockSnippets[1]], "Tell me about Austin");
      expect(austinResult.coordinationHints.suggestedTone).toBe('enthusiastic');
      
      const trumpResult = selector.selectHook([mockSnippets[2]], "What do you think about Trump?");
      expect(trumpResult.coordinationHints.suggestedTone).toBe('assertive');
    });
  });
  
  describe('fallback behavior', () => {
    it('should provide intent-specific fallbacks', () => {
      const factualResult = selector.selectHook([], "When did something happen?", 'factual');
      expect(factualResult.hook).toBe("Let me think about that.");
      
      const opinionResult = selector.selectHook([], "What do you think?", 'opinion');
      expect(opinionResult.hook).toBe("That's an interesting question.");
      
      const storyResult = selector.selectHook([], "Tell me a story", 'story');
      expect(storyResult.hook).toBe("I have some thoughts on that.");
    });
  });
  
  describe('strict formatting guardrails', () => {
    it('should enforce 160 character limit strictly', () => {
      const veryLongSnippet: FactbookSnippet = {
        id: 'test.very_long',
        path: 'test.very_long',
        text: 'This is an extremely long text that definitely exceeds the 160 character limit and should be truncated properly while maintaining readability and proper punctuation for the hook generation system.',
        topics: ['test'],
        keywords: ['long', 'text', 'truncated']
      };
      
      const hook = selector.generateHookFromSnippet(veryLongSnippet, "test query");
      
      expect(hook.length).toBeLessThanOrEqual(160);
      expect(hook).toMatch(/[.!?]$/); // Should end with punctuation
    });
    
    it('should never include newlines in hooks', () => {
      const multilineSnippet: FactbookSnippet = {
        id: 'test.multiline',
        path: 'test.multiline',
        text: 'First line\nSecond line\nThird line with more content',
        topics: ['test'],
        keywords: ['multiline', 'content']
      };
      
      const hook = selector.generateHookFromSnippet(multilineSnippet, "test query");
      
      expect(hook).not.toContain('\n');
      expect(hook).not.toContain('\r');
    });
    
    it('should remove all emojis from hooks', () => {
      const emojiSnippet: FactbookSnippet = {
        id: 'test.emoji_heavy',
        path: 'test.emoji_heavy',
        text: 'I love Austin! 😍🎉 It was amazing! 🌟✨ Best years ever! 🎊🎈',
        topics: ['test'],
        keywords: ['austin', 'amazing', 'love']
      };
      
      const hook = selector.generateHookFromSnippet(emojiSnippet, "austin query");
      
      expect(hook).not.toMatch(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u);
      expect(hook).toBe('I love Austin! It was amazing! Best years ever!');
    });
  });
  
  describe('testHookGeneration utility', () => {
    it('should provide detailed hook generation analysis', () => {
      const snippet = mockSnippets[0];
      const result = selector.testHookGeneration(snippet, "Tell me about Olive");
      
      expect(result.originalText).toBe(snippet.text);
      expect(result.generatedHook).toBeTruthy();
      expect(result.lengthCheck).toBe(true);
      expect(result.formatCheck).toBe(true);
    });
  });

  describe('StyleProfile integration', () => {
    it('should apply facts first then style pattern', () => {
      const snippet = mockSnippets.find(s => s.id === 'pets.olive')!;
      const hook = selector.generateHookFromSnippet(snippet, "Tell me about Olive");
      
      // Should contain factual content
      expect(hook).toContain('Olive');
      expect(hook).toContain('Puerto Rican');
      
      // Should be properly formatted (style applied)
      expect(hook.length).toBeLessThanOrEqual(160);
      expect(hook).not.toContain('\n');
    });

    it('should generate deep lane style instructions', () => {
      const snippets = [mockSnippets[0], mockSnippets[1]]; // Olive and Austin
      const instructions = selector.generateDeepLaneStyleInstructions(
        snippets,
        'warm',
        'pets'
      );

      expect(instructions).toContain('STYLE GUIDELINES');
      expect(instructions).toContain('Tone: warm');
      expect(instructions).toContain('Deep lane');
      expect(instructions).toContain('Apply style ONLY to presentation');
      expect(instructions).toContain('Never let personality influence fact selection');
    });

    it('should maintain fact/style separation in hook generation', () => {
      const styleProfile = StyleProfile.getInstance();
      
      // Mock validation to test separation
      const snippet = mockSnippets[0];
      const hook = selector.generateHookFromSnippet(snippet, "Tell me about Olive");
      
      const validation = styleProfile.validateFactStyleSeparation(hook, ['pets.olive']);
      expect(validation.isValid).toBe(true);
      expect(validation.violations).toHaveLength(0);
    });

    it('should apply appropriate tone based on snippet topics', () => {
      // Austin should get enthusiastic tone
      const austinResult = selector.selectHook([mockSnippets[1]], "Tell me about Austin");
      expect(austinResult.coordinationHints.suggestedTone).toBe('enthusiastic');
      
      // Olive should get warm tone
      const oliveResult = selector.selectHook([mockSnippets[0]], "Tell me about Olive");
      expect(oliveResult.coordinationHints.suggestedTone).toBe('warm');
      
      // Trump should get assertive tone
      const trumpResult = selector.selectHook([mockSnippets[2]], "What about Trump?");
      expect(trumpResult.coordinationHints.suggestedTone).toBe('assertive');
    });

    it('should generate style instructions for different tones', () => {
      const snippets = [mockSnippets[2]]; // Trump snippet
      const instructions = selector.generateDeepLaneStyleInstructions(
        snippets,
        'assertive',
        'politics'
      );

      expect(instructions).toContain('Tone: assertive');
      expect(instructions).toContain('assertive tone');
      expect(instructions).toContain('CRITICAL: Apply style ONLY to presentation');
    });
  });
});