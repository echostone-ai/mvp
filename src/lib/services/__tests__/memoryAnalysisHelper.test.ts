// src/lib/services/__tests__/memoryAnalysisHelper.test.ts
import { describe, it, expect } from 'vitest';
import { lightAnalyze, MemoryAnalysis } from '../memoryAnalysisHelper';

describe('lightAnalyze', () => {
  it('should return empty array for empty input', () => {
    const result = lightAnalyze([]);
    expect(result).toEqual([]);
  });

  it('should analyze opinion memories correctly', () => {
    const memories = [{
      id: '1',
      fragment_text: 'I absolutely hate Trump and think he should never be president again',
      conversation_context: { type: 'opinion' }
    }];

    const result = lightAnalyze(memories);
    
    expect(result).toHaveLength(1);
    expect(result[0].contentTypes).toContain('opinion');
    expect(result[0].hookPotential).toBeGreaterThan(0.7); // High hook potential for strong opinion
    expect(result[0].emotionalTone).toBe('negative');
    expect(result[0].keyElements).toContain('trump');
  });

  it('should analyze story memories correctly', () => {
    const memories = [{
      id: '2',
      fragment_text: 'When I lived in Austin from 2009 to 2018, I had the most amazing time exploring the music scene and meeting incredible people',
      conversation_context: { type: 'memory' }
    }];

    const result = lightAnalyze(memories);
    
    expect(result).toHaveLength(1);
    expect(result[0].contentTypes).toContain('story');
    expect(result[0].storyDepth).toBeGreaterThan(0.6); // High story depth for narrative
    expect(result[0].emotionalTone).toBe('positive');
    expect(result[0].keyElements).toContain('austin');
  });

  it('should analyze biographical facts correctly', () => {
    const memories = [{
      id: '3',
      fragment_text: 'Born in California, studied computer science',
      conversation_context: { type: 'bio' }
    }];

    const result = lightAnalyze(memories);
    
    expect(result).toHaveLength(1);
    expect(result[0].contentTypes).toContain('fact');
    expect(result[0].hookPotential).toBeGreaterThan(0.5); // Decent hook potential for bio facts
    expect(result[0].keyElements).toContain('california');
  });

  it('should penalize conversation fragments', () => {
    const memories = [{
      id: '4',
      fragment_text: 'User said hello and I responded with greeting',
      conversation_context: { type: 'user' }
    }];

    const result = lightAnalyze(memories);
    
    expect(result).toHaveLength(1);
    expect(result[0].hookPotential).toBeLessThan(0.5); // Low hook potential for conversation
  });

  it('should handle mixed emotional tone', () => {
    const memories = [{
      id: '5',
      fragment_text: 'I love Austin but hate the traffic there',
      conversation_context: { type: 'opinion' }
    }];

    const result = lightAnalyze(memories);
    
    expect(result).toHaveLength(1);
    expect(result[0].emotionalTone).toBe('mixed');
  });

  it('should complete analysis quickly', () => {
    const memories = Array.from({ length: 50 }, (_, i) => ({
      id: `${i}`,
      fragment_text: `Memory fragment ${i} with some content about various topics`,
      conversation_context: { type: 'memory' }
    }));

    const startTime = Date.now();
    const result = lightAnalyze(memories);
    const elapsedMs = Date.now() - startTime;
    
    expect(result).toHaveLength(50);
    expect(elapsedMs).toBeLessThan(50); // Should complete in under 50ms for 50 memories
  });

  it('should extract multiple content types', () => {
    const memories = [{
      id: '6',
      fragment_text: 'I think Austin is amazing and I have wonderful memories of living there with my dog',
      conversation_context: { type: 'memory' }
    }];

    const result = lightAnalyze(memories);
    
    expect(result).toHaveLength(1);
    expect(result[0].contentTypes).toContain('opinion'); // "I think"
    expect(result[0].contentTypes).toContain('story'); // "memories of living"
    expect(result[0].contentTypes).toContain('emotion'); // "amazing", "wonderful"
    expect(result[0].contentTypes).toContain('context'); // "austin", "dog"
  });
});