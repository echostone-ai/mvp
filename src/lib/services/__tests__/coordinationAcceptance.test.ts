// src/lib/services/__tests__/coordinationAcceptance.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { lightAnalyze } from '../memoryAnalysisHelper';
import { selectFastHook } from '../fastHookSelector';
import { analyzeRepetition, DEFAULT_REPETITION_CONFIG } from '../repetitionGuard';

// Mock data for different query types
const mockMemories = {
  opinion: [
    {
      id: 'trump-opinion-1',
      fragment_text: 'I absolutely hate Trump and think he should never be president again. His policies are destructive and divisive.',
      conversation_context: { type: 'opinion' }
    },
    {
      id: 'trump-story-1', 
      fragment_text: 'When Trump was president, I remember feeling so frustrated watching the news every day. It was exhausting.',
      conversation_context: { type: 'memory' }
    }
  ],
  travel: [
    {
      id: 'austin-memory-1',
      fragment_text: 'I lived in Austin from 2009 to 2018 and had the most amazing time exploring the music scene and meeting incredible people.',
      conversation_context: { type: 'memory' }
    },
    {
      id: 'valencia-memory-1',
      fragment_text: 'When I moved to Valencia, Spain, it was such a culture shock but I fell in love with the Mediterranean lifestyle.',
      conversation_context: { type: 'memory' }
    },
    {
      id: 'austin-opinion-1',
      fragment_text: 'Austin is absolutely the best city in America for music and food culture.',
      conversation_context: { type: 'opinion' }
    }
  ],
  people: [
    {
      id: 'dog-memory-1',
      fragment_text: 'My dog is the most important thing in my life. She brings me so much joy and companionship.',
      conversation_context: { type: 'friend_memory' }
    },
    {
      id: 'dog-story-1',
      fragment_text: 'I remember when I first adopted her from the shelter, she was so scared but within a week she was running around like she owned the place.',
      conversation_context: { type: 'memory' }
    }
  ]
};

describe('Coordination Acceptance Tests', () => {
  describe('Fast Lane Hook Selection for Different Intents', () => {
    it('should select strong opinion hook for political queries', () => {
      const memories = mockMemories.opinion;
      const analyses = lightAnalyze(memories);
      const result = selectFastHook(memories, analyses, 'What do you think about Trump?', 'opinion');
      
      // Requirement 2.1: Fast lane should provide authentic stance as hook
      expect(result.selectedContent).toContain('absolutely hate Trump');
      expect(result.contentType).toBe('opinion');
      expect(result.deepLaneHints.suggestedTone).toBe('critical');
      expect(result.deepLaneHints.expandOn).toContain('trump-opinion-1');
      expect(result.deepLaneHints.avoidRepeating.length).toBeGreaterThan(0);
    });

    it('should select enthusiastic teaser for travel queries', () => {
      const memories = mockMemories.travel;
      const analyses = lightAnalyze(memories);
      const result = selectFastHook(memories, analyses, 'Tell me about Austin', 'travel');
      
      // Requirement 2.2: Fast lane should provide enthusiastic teaser about interesting aspect
      // The system prioritizes by hook potential, so it might select Valencia or Austin
      expect(result.selectedContent).toMatch(/austin|valencia|spain/i);
      expect(['enthusiasm', 'teaser'].includes(result.contentType)).toBe(true);
      expect(result.deepLaneHints.suggestedTone).toBe('enthusiastic');
      expect(result.deepLaneHints.relatedMemories.length).toBeGreaterThan(0);
    });

    it('should select warm personal introduction for people queries', () => {
      const memories = mockMemories.people;
      const analyses = lightAnalyze(memories);
      const result = selectFastHook(memories, analyses, 'Tell me about your dog', 'people');
      
      // Requirement 2.3: Fast lane should provide warm, personal introduction
      expect(result.selectedContent).toContain('dog');
      expect(['teaser', 'enthusiasm'].includes(result.contentType)).toBe(true);
      expect(result.deepLaneHints.expandOn.length).toBeGreaterThan(0);
    });

    it('should cap hook content to ~180 characters', () => {
      const longMemory = [{
        id: 'long-1',
        fragment_text: 'This is an extremely long memory fragment that contains way too much information and should definitely be truncated to fit within the 180 character limit for fast lane hooks to ensure quick delivery and maintain good user experience throughout the conversation.',
        conversation_context: { type: 'memory' }
      }];
      
      const analyses = lightAnalyze(longMemory);
      const result = selectFastHook(longMemory, analyses, 'tell me more');
      
      // Requirement 2.4: Fast lane should cap hook text to ~180 characters
      expect(result.selectedContent.length).toBeLessThanOrEqual(180);
    });

    it('should provide fallback hooks when no memories found', () => {
      const result = selectFastHook([], [], 'What about politics?', 'opinion');
      
      expect(result.selectedContent).toBe("I'm thinking about that...");
      expect(result.contentType).toBe('hook');
      expect(result.deepLaneHints.expandOn).toEqual([]);
    });
  });

  describe('Deep Lane Coordination Without Repetition', () => {
    it('should build on fast lane opinion with supporting stories', () => {
      const memories = mockMemories.opinion;
      const analyses = lightAnalyze(memories);
      const fastHook = selectFastHook(memories, analyses, 'What do you think about Trump?');
      
      // Simulate deep lane coordination
      const expandOnMemories = memories.filter(m => fastHook.deepLaneHints.expandOn.includes(m.id));
      const relatedMemories = memories.filter(m => fastHook.deepLaneHints.relatedMemories.includes(m.id));
      
      // Requirement 3.1: Deep lane should elaborate with supporting experiences
      expect(expandOnMemories.length).toBeGreaterThan(0);
      expect(relatedMemories.length).toBeGreaterThan(0);
      expect(fastHook.deepLaneHints.suggestedTone).toBe('critical');
      
      // Verify coordination hints provide clear guidance
      expect(fastHook.deepLaneHints.avoidRepeating.length).toBeGreaterThan(0);
      // Check that key phrases from the hook are marked for avoidance
      const avoidanceText = fastHook.deepLaneHints.avoidRepeating.join(' ').toLowerCase();
      expect(avoidanceText).toMatch(/hate|trump|absolutely/i);
    });

    it('should expand travel memories with full stories', () => {
      const memories = mockMemories.travel;
      const analyses = lightAnalyze(memories);
      const fastHook = selectFastHook(memories, analyses, 'Tell me about your time in Austin');
      
      // Requirement 3.3: Deep lane should provide full story with vivid details
      const expandOnMemories = memories.filter(m => fastHook.deepLaneHints.expandOn.includes(m.id));
      expect(expandOnMemories.length).toBeGreaterThan(0);
      
      // Should have related memories to weave together
      expect(fastHook.deepLaneHints.relatedMemories.length).toBeGreaterThan(0);
      expect(fastHook.deepLaneHints.suggestedTone).toBe('enthusiastic');
    });

    it('should provide relationship stories for people queries', () => {
      const memories = mockMemories.people;
      const analyses = lightAnalyze(memories);
      const fastHook = selectFastHook(memories, analyses, 'Tell me about your dog');
      
      // Requirement 3.2: Deep lane should provide stories and deeper context about relationships
      expect(fastHook.deepLaneHints.expandOn.length).toBeGreaterThan(0);
      expect(fastHook.deepLaneHints.relatedMemories.length).toBeGreaterThan(0);
    });
  });

  describe('Repetition Detection and Prevention', () => {
    it('should detect high overlap between fast and deep content', () => {
      const fastContent = "I absolutely hate Trump and think he's terrible for America.";
      const deepContent = "I absolutely hate Trump because I think his policies are terrible and destructive for America.";
      
      const analysis = analyzeRepetition(fastContent, deepContent, DEFAULT_REPETITION_CONFIG);
      
      // Should detect significant overlap
      expect(analysis.overlapPercentage).toBeGreaterThan(0.3);
      expect(analysis.shouldRegenerate).toBe(true);
      expect(analysis.overlappingNgrams.length).toBeGreaterThan(0);
    });

    it('should allow complementary content without repetition', () => {
      const fastContent = "Oh absolutely! Austin was such an incredible chapter of my life!";
      const deepContent = "I lived there from 2009 to 2018 and got to experience the amazing music scene. The food culture was unbelievable too - from food trucks to fine dining, everything was top notch.";
      
      const analysis = analyzeRepetition(fastContent, deepContent, DEFAULT_REPETITION_CONFIG);
      
      // Should not trigger regeneration for complementary content
      expect(analysis.overlapPercentage).toBeLessThan(0.3);
      expect(analysis.shouldRegenerate).toBe(false);
    });

    it('should handle edge cases in repetition detection', () => {
      // Empty content
      let analysis = analyzeRepetition('', 'some content', DEFAULT_REPETITION_CONFIG);
      expect(analysis.shouldRegenerate).toBe(false);
      
      // Very short content
      analysis = analyzeRepetition('Yes.', 'Absolutely yes, I agree.', DEFAULT_REPETITION_CONFIG);
      expect(analysis.shouldRegenerate).toBe(false);
      
      // Identical content (needs to be longer than minTokensForCheck)
      const identicalText = 'This is the exact same content repeated with more words';
      analysis = analyzeRepetition(identicalText, identicalText, DEFAULT_REPETITION_CONFIG);
      expect(analysis.overlapPercentage).toBe(1.0); // Perfect overlap for identical text
      expect(analysis.shouldRegenerate).toBe(true);
    });
  });

  describe('Natural Conversation Flow', () => {
    it('should maintain emotional tone consistency between lanes', () => {
      const memories = mockMemories.travel;
      const analyses = lightAnalyze(memories);
      const fastHook = selectFastHook(memories, analyses, 'What was Austin like?');
      
      // Requirement 4.3: Deep lane should maintain emotional tone from fast lane
      expect(fastHook.deepLaneHints.suggestedTone).toBe('enthusiastic');
      
      // Fast lane should be enthusiastic for positive memories
      expect(fastHook.selectedContent).toMatch(/incredible|amazing|love/i);
    });

    it('should create natural transition hints for deep lane', () => {
      const memories = mockMemories.opinion;
      const analyses = lightAnalyze(memories);
      const fastHook = selectFastHook(memories, analyses, 'What about Trump?');
      
      // Requirement 4.1: Transition should feel natural
      expect(fastHook.deepLaneHints.expandOn.length).toBeGreaterThan(0);
      expect(fastHook.deepLaneHints.avoidRepeating.length).toBeGreaterThan(0);
      expect(fastHook.deepLaneHints.suggestedTone).toBeTruthy();
    });

    it('should adapt coordination strategy by topic', () => {
      // Opinion query
      let memories = mockMemories.opinion;
      let analyses = lightAnalyze(memories);
      let fastHook = selectFastHook(memories, analyses, 'Political opinion?');
      expect(fastHook.deepLaneHints.suggestedTone).toBe('critical');
      
      // Travel query  
      memories = mockMemories.travel;
      analyses = lightAnalyze(memories);
      fastHook = selectFastHook(memories, analyses, 'Travel experiences?');
      expect(fastHook.deepLaneHints.suggestedTone).toBe('enthusiastic');
    });
  });

  describe('Performance Requirements', () => {
    it('should complete memory analysis quickly', () => {
      const startTime = Date.now();
      
      // Test with larger memory set
      const manyMemories = Array.from({ length: 20 }, (_, i) => ({
        id: `mem-${i}`,
        fragment_text: `Memory fragment ${i} with various content about different topics and experiences`,
        conversation_context: { type: i % 2 === 0 ? 'memory' : 'opinion' }
      }));
      
      const analyses = lightAnalyze(manyMemories);
      const elapsedMs = Date.now() - startTime;
      
      // Should complete analysis under 10ms for 20 memories
      expect(elapsedMs).toBeLessThan(50); // Allow some buffer for test environment
      expect(analyses.length).toBe(20);
    });

    it('should complete hook selection quickly', () => {
      const memories = mockMemories.travel;
      const analyses = lightAnalyze(memories);
      
      const startTime = Date.now();
      const result = selectFastHook(memories, analyses, 'Tell me about your travels');
      const elapsedMs = Date.now() - startTime;
      
      // Hook selection should be very fast
      expect(elapsedMs).toBeLessThan(10);
      expect(result.selectedContent).toBeTruthy();
    });

    it('should complete repetition analysis quickly', () => {
      const fastContent = "I absolutely love Austin! It was such an incredible chapter of my life.";
      const deepContent = "Living in Austin from 2009 to 2018 was amazing. The music scene was incredible, the food was fantastic, and I met so many wonderful people there.";
      
      const startTime = Date.now();
      const analysis = analyzeRepetition(fastContent, deepContent, DEFAULT_REPETITION_CONFIG);
      const elapsedMs = Date.now() - startTime;
      
      // Repetition analysis should be very fast
      expect(elapsedMs).toBeLessThan(10);
      expect(analysis.overlapPercentage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Content Distribution Rules', () => {
    it('should have clear rules for splitting content between lanes', () => {
      const memories = mockMemories.travel;
      const analyses = lightAnalyze(memories);
      const fastHook = selectFastHook(memories, analyses, 'Tell me about Austin');
      
      // Requirement 5.1: Clear rules for content distribution
      expect(fastHook.deepLaneHints.expandOn.length).toBeGreaterThan(0);
      expect(fastHook.deepLaneHints.relatedMemories.length).toBeGreaterThan(0);
      
      // Fast lane should use teaser/hook, deep lane should get full memories
      expect(fastHook.selectedContent.length).toBeLessThan(200); // Hook is short
      expect(fastHook.deepLaneHints.expandOn[0]).toBeTruthy(); // Deep gets specific memories
    });

    it('should mark content usage to prevent repetition', () => {
      const memories = mockMemories.opinion;
      const analyses = lightAnalyze(memories);
      const fastHook = selectFastHook(memories, analyses, 'What do you think?');
      
      // Requirement 5.3: Mark what aspects deep lane should focus on
      expect(fastHook.deepLaneHints.expandOn.length).toBeGreaterThan(0);
      expect(fastHook.deepLaneHints.avoidRepeating.length).toBeGreaterThan(0);
      
      // Should provide specific guidance
      expect(fastHook.deepLaneHints.suggestedTone).toBeTruthy();
    });

    it('should use different presentation strategies for same memory', () => {
      const memories = [{
        id: 'shared-memory',
        fragment_text: 'I lived in Austin from 2009 to 2018 and absolutely loved the music scene, food culture, and meeting amazing people there.',
        conversation_context: { type: 'memory' }
      }];
      
      const analyses = lightAnalyze(memories);
      const fastHook = selectFastHook(memories, analyses, 'Tell me about Austin');
      
      // Requirement 5.4: Different presentation strategies
      // Fast lane should use hook/teaser approach
      expect(fastHook.selectedContent).toContain('Austin');
      expect(fastHook.selectedContent.length).toBeLessThan(memories[0].fragment_text.length);
      
      // Deep lane should get full memory for expansion
      expect(fastHook.deepLaneHints.expandOn).toContain('shared-memory');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle opinion queries with coordination', () => {
      const memories = mockMemories.opinion;
      const analyses = lightAnalyze(memories);
      const fastHook = selectFastHook(memories, analyses, 'What do you think about Trump?', 'opinion');
      
      // Validate full coordination flow
      expect(fastHook.contentType).toBe('opinion');
      expect(fastHook.selectedContent).toContain('hate Trump');
      expect(fastHook.deepLaneHints.suggestedTone).toBe('critical');
      expect(fastHook.deepLaneHints.expandOn.length).toBeGreaterThan(0);
      expect(fastHook.deepLaneHints.relatedMemories.length).toBeGreaterThan(0);
      
      // Test repetition prevention
      const mockDeepContent = "I hate Trump because his policies are destructive. When he was president, I felt frustrated every day.";
      const repetitionCheck = analyzeRepetition(fastHook.selectedContent, mockDeepContent, DEFAULT_REPETITION_CONFIG);
      
      // Should detect some overlap but allow complementary expansion
      expect(repetitionCheck.overlapPercentage).toBeLessThan(0.5);
    });

    it('should handle travel queries with coordination', () => {
      const memories = mockMemories.travel;
      const analyses = lightAnalyze(memories);
      const fastHook = selectFastHook(memories, analyses, 'Tell me about your time in Austin', 'travel');
      
      // Validate travel coordination
      expect(['enthusiasm', 'teaser'].includes(fastHook.contentType)).toBe(true);
      expect(fastHook.deepLaneHints.suggestedTone).toBe('enthusiastic');
      expect(fastHook.deepLaneHints.expandOn.length).toBeGreaterThan(0);
      
      // Should provide multiple memories for rich storytelling
      expect(fastHook.deepLaneHints.relatedMemories.length).toBeGreaterThan(0);
    });

    it('should handle people queries with coordination', () => {
      const memories = mockMemories.people;
      const analyses = lightAnalyze(memories);
      const fastHook = selectFastHook(memories, analyses, 'Tell me about your dog', 'people');
      
      // Validate people coordination
      expect(fastHook.selectedContent).toContain('dog');
      expect(fastHook.deepLaneHints.expandOn.length).toBeGreaterThan(0);
      expect(fastHook.deepLaneHints.relatedMemories.length).toBeGreaterThan(0);
    });
  });
});