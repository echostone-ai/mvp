// src/lib/services/__tests__/fastHookSelector.test.ts
import { describe, it, expect } from 'vitest';
import { selectFastHook, FastHookSelection } from '../fastHookSelector';
import { MemoryAnalysis } from '../memoryAnalysisHelper';

describe('selectFastHook', () => {
  it('should return fallback hook for empty memories', () => {
    const result = selectFastHook([], [], 'test query');
    
    expect(result.selectedContent).toBe("I'm thinking about that...");
    expect(result.contentType).toBe('hook');
    expect(result.deepLaneHints.expandOn).toEqual([]);
  });

  it('should return intent-specific fallback for travel queries with no memories', () => {
    const result = selectFastHook([], [], 'where did you live?', 'travel');
    
    expect(result.selectedContent).toBe("Let me check my memories about that...");
    expect(result.contentType).toBe('hook');
  });

  it('should select Austin memory with enthusiasm', () => {
    const memories = [{
      id: 'austin-1',
      fragment_text: 'I lived in Austin from 2009 to 2018 and had amazing experiences',
      conversation_context: { type: 'memory' }
    }];
    
    const analyses: MemoryAnalysis[] = [{
      memoryId: 'austin-1',
      contentTypes: ['story', 'context'],
      hookPotential: 0.8,
      storyDepth: 0.9,
      emotionalTone: 'positive',
      keyElements: ['austin']
    }];

    const result = selectFastHook(memories, analyses, 'tell me about austin');
    
    expect(result.selectedContent).toBe("Oh absolutely! Austin was such an incredible chapter of my life!");
    expect(result.contentType).toBe('enthusiasm');
    expect(result.deepLaneHints.expandOn).toContain('austin-1');
  });

  it('should select opinion-based hook for political content', () => {
    const memories = [{
      id: 'trump-opinion',
      fragment_text: 'I absolutely hate Trump and think he should never be president again',
      conversation_context: { type: 'opinion' }
    }];
    
    const analyses: MemoryAnalysis[] = [{
      memoryId: 'trump-opinion',
      contentTypes: ['opinion', 'emotion'],
      hookPotential: 0.9,
      storyDepth: 0.3,
      emotionalTone: 'negative',
      keyElements: ['trump', 'politics']
    }];

    const result = selectFastHook(memories, analyses, 'what do you think about trump?');
    
    expect(result.selectedContent).toContain('absolutely hate Trump');
    expect(result.contentType).toBe('opinion');
    expect(result.deepLaneHints.suggestedTone).toBe('critical');
  });

  it('should create story teaser for narrative memories', () => {
    const memories = [{
      id: 'story-1',
      fragment_text: 'When I moved to Valencia, Spain, it was such a culture shock but I fell in love with the Mediterranean lifestyle and the incredible food scene there.',
      conversation_context: { type: 'memory' }
    }];
    
    const analyses: MemoryAnalysis[] = [{
      memoryId: 'story-1',
      contentTypes: ['story', 'context'],
      hookPotential: 0.7,
      storyDepth: 0.8,
      emotionalTone: 'positive',
      keyElements: ['valencia', 'spain']
    }];

    const result = selectFastHook(memories, analyses, 'tell me about spain');
    
    expect(result.selectedContent).toContain('When I moved to Valencia');
    expect(result.contentType).toBe('teaser');
    expect(result.deepLaneHints.suggestedTone).toBe('enthusiastic');
  });

  it('should create bio hook for biographical facts', () => {
    const memories = [{
      id: 'bio-1',
      fragment_text: 'Born in California, studied computer science',
      conversation_context: { type: 'bio' }
    }];
    
    const analyses: MemoryAnalysis[] = [{
      memoryId: 'bio-1',
      contentTypes: ['fact'],
      hookPotential: 0.6,
      storyDepth: 0.2,
      emotionalTone: 'neutral',
      keyElements: ['california']
    }];

    const result = selectFastHook(memories, analyses, 'where are you from?');
    
    expect(result.selectedContent).toBe("I'm originally from california!");
    expect(result.contentType).toBe('hook');
  });

  it('should cap hook content to ~180 characters', () => {
    const longText = 'This is a very long memory fragment that contains way too much information and should be truncated to fit within the 180 character limit for fast lane hooks to ensure quick delivery and good user experience.';
    
    const memories = [{
      id: 'long-1',
      fragment_text: longText,
      conversation_context: { type: 'memory' }
    }];
    
    const analyses: MemoryAnalysis[] = [{
      memoryId: 'long-1',
      contentTypes: ['story'],
      hookPotential: 0.5,
      storyDepth: 0.7,
      emotionalTone: 'neutral',
      keyElements: []
    }];

    const result = selectFastHook(memories, analyses, 'tell me more');
    
    expect(result.selectedContent.length).toBeLessThanOrEqual(180);
    expect(result.selectedContent).toMatch(/\.\.\.$/); // Should end with ellipsis
  });

  it('should generate proper deep lane hints', () => {
    const memories = [
      {
        id: 'main-memory',
        fragment_text: 'I love living in Valencia because of the amazing food',
        conversation_context: { type: 'opinion' }
      },
      {
        id: 'related-memory',
        fragment_text: 'The paella in Valencia is absolutely incredible, especially at this local restaurant',
        conversation_context: { type: 'memory' }
      }
    ];
    
    const analyses: MemoryAnalysis[] = [
      {
        memoryId: 'main-memory',
        contentTypes: ['opinion'],
        hookPotential: 0.8,
        storyDepth: 0.4,
        emotionalTone: 'positive',
        keyElements: ['valencia', 'food']
      },
      {
        memoryId: 'related-memory',
        contentTypes: ['story'],
        hookPotential: 0.6,
        storyDepth: 0.8,
        emotionalTone: 'positive',
        keyElements: ['paella', 'valencia']
      }
    ];

    const result = selectFastHook(memories, analyses, 'what about valencia food?');
    
    expect(result.deepLaneHints.expandOn).toContain('main-memory');
    expect(result.deepLaneHints.relatedMemories).toContain('related-memory');
    expect(result.deepLaneHints.avoidRepeating.length).toBeGreaterThan(0);
    expect(result.deepLaneHints.suggestedTone).toBe('enthusiastic');
  });

  it('should handle memories with cleaned prefixes', () => {
    const memories = [{
      id: 'prefixed-1',
      fragment_text: 'Opinion on politics: I think the current system needs major reform',
      conversation_context: { type: 'opinion' }
    }];
    
    const analyses: MemoryAnalysis[] = [{
      memoryId: 'prefixed-1',
      contentTypes: ['opinion'],
      hookPotential: 0.7,
      storyDepth: 0.3,
      emotionalTone: 'neutral',
      keyElements: ['politics']
    }];

    const result = selectFastHook(memories, analyses, 'what about politics?');
    
    expect(result.selectedContent).not.toContain('Opinion on politics:');
    expect(result.selectedContent).toContain('think the current system');
  });

  it('should prioritize memories by hook potential', () => {
    const memories = [
      {
        id: 'low-hook',
        fragment_text: 'Some boring conversation fragment',
        conversation_context: { type: 'user' }
      },
      {
        id: 'high-hook',
        fragment_text: 'I absolutely love this topic and have strong feelings about it',
        conversation_context: { type: 'opinion' }
      }
    ];
    
    const analyses: MemoryAnalysis[] = [
      {
        memoryId: 'low-hook',
        contentTypes: ['fact'],
        hookPotential: 0.2,
        storyDepth: 0.1,
        emotionalTone: 'neutral',
        keyElements: []
      },
      {
        memoryId: 'high-hook',
        contentTypes: ['opinion', 'emotion'],
        hookPotential: 0.9,
        storyDepth: 0.4,
        emotionalTone: 'positive',
        keyElements: []
      }
    ];

    const result = selectFastHook(memories, analyses, 'what do you think?');
    
    expect(result.deepLaneHints.expandOn).toContain('high-hook');
    expect(result.selectedContent).toContain('absolutely love');
  });

  it('should extract key phrases for avoidance', () => {
    const memories = [{
      id: 'phrase-test',
      fragment_text: 'The incredible music scene in Austin was absolutely amazing',
      conversation_context: { type: 'memory' }
    }];
    
    const analyses: MemoryAnalysis[] = [{
      memoryId: 'phrase-test',
      contentTypes: ['story', 'emotion'],
      hookPotential: 0.8,
      storyDepth: 0.7,
      emotionalTone: 'positive',
      keyElements: ['austin', 'music']
    }];

    const result = selectFastHook(memories, analyses, 'tell me about austin music');
    
    const avoidRepeating = result.deepLaneHints.avoidRepeating;
    expect(avoidRepeating.length).toBeGreaterThan(0);
    expect(avoidRepeating.some(phrase => phrase.includes('incredible') || phrase.includes('amazing'))).toBe(true);
  });
});