// src/lib/services/__tests__/repetitionGuard.test.ts
// Unit tests for repetition guard functionality

import { describe, it, expect } from 'vitest';
import {
  analyzeRepetition,
  analyzeSemanticRepetition,
  RepetitionConfig,
  DEFAULT_REPETITION_CONFIG
} from '../repetitionGuard';

describe('RepetitionGuard', () => {
  describe('analyzeRepetition', () => {
    it('should detect high overlap and trigger regeneration', () => {
      const fastHook = "I absolutely love Austin! It was such an incredible chapter of my life.";
      const deepDraft = "Austin was absolutely incredible and I love talking about that amazing chapter of my life in Texas.";
      
      const result = analyzeRepetition(fastHook, deepDraft);
      
      expect(result.shouldRegenerate).toBe(true);
      expect(result.overlapPercentage).toBeGreaterThan(0.3);
      expect(result.overlappingNgrams.length).toBeGreaterThan(0);
    });

    it('should not trigger regeneration for low overlap', () => {
      const fastHook = "I absolutely love Austin! It was such an incredible chapter.";
      const deepDraft = "Let me tell you about my experiences in Texas during those years. The music scene was vibrant and the food culture was amazing.";
      
      const result = analyzeRepetition(fastHook, deepDraft);
      
      expect(result.shouldRegenerate).toBe(false);
      expect(result.overlapPercentage).toBeLessThan(0.3);
    });

    it('should handle empty or very short deep drafts', () => {
      const fastHook = "I love Austin!";
      const deepDraft = "Yes.";
      
      const result = analyzeRepetition(fastHook, deepDraft);
      
      expect(result.shouldRegenerate).toBe(false);
      expect(result.overlapPercentage).toBe(0);
      expect(result.totalNgrams).toBe(0);
    });

    it('should use custom configuration', () => {
      const fastHook = "Austin is amazing and incredible.";
      const deepDraft = "Austin is truly amazing and absolutely incredible place to live.";
      
      const strictConfig: RepetitionConfig = {
        overlapThreshold: 0.1, // Very strict threshold
        ngramSize: 2,
        minTokensForCheck: 5
      };
      
      const result = analyzeRepetition(fastHook, deepDraft, strictConfig);
      
      expect(result.shouldRegenerate).toBe(true);
      expect(result.overlapPercentage).toBeGreaterThan(0.1);
    });

    it('should ignore stop words in analysis', () => {
      const fastHook = "I think that Austin is the best place.";
      const deepDraft = "The city of Austin has the most amazing culture and the best food scene.";
      
      const result = analyzeRepetition(fastHook, deepDraft);
      
      // Should have some overlap but not trigger regeneration due to stop word filtering
      expect(result.shouldRegenerate).toBe(false);
    });

    it('should handle punctuation and case differences', () => {
      const fastHook = "Austin, Texas is AMAZING!";
      const deepDraft = "austin texas is amazing and wonderful place to visit";
      
      const result = analyzeRepetition(fastHook, deepDraft);
      
      expect(result.shouldRegenerate).toBe(true);
      expect(result.overlappingNgrams.some(ngram => ngram.includes('austin') || ngram.includes('texas') || ngram.includes('amazing'))).toBe(true);
    });
  });

  describe('analyzeSemanticRepetition', () => {
    it('should detect semantic overlap beyond n-grams', () => {
      const fastHook = "I love Austin! It's incredible.";
      const deepDraft = "Austin is amazing and I love that incredible city very much.";
      
      const result = analyzeSemanticRepetition(fastHook, deepDraft);
      
      // Should detect word overlap (austin, love, incredible)
      expect(result.overlapPercentage).toBeGreaterThan(0);
    });

    it('should combine n-gram and semantic analysis', () => {
      const fastHook = "Austin is absolutely incredible!";
      const deepDraft = "Austin is absolutely incredible and amazing city that I love.";
      
      const result = analyzeSemanticRepetition(fastHook, deepDraft);
      
      expect(result.shouldRegenerate).toBe(true);
      expect(result.overlapPercentage).toBeGreaterThan(0.3);
    });
  });

  describe('edge cases', () => {
    it('should handle empty strings', () => {
      const result = analyzeRepetition("", "");
      
      expect(result.shouldRegenerate).toBe(false);
      expect(result.overlapPercentage).toBe(0);
    });

    it('should handle very long texts', () => {
      const fastHook = "Austin is amazing!";
      const longDeepDraft = "Austin is amazing and wonderful. ".repeat(20) + "This is a very long text with repetition.";
      
      const result = analyzeRepetition(fastHook, longDeepDraft);
      
      expect(result.shouldRegenerate).toBe(true);
      expect(result.totalNgrams).toBeGreaterThan(0);
    });

    it('should handle special characters and numbers', () => {
      const fastHook = "I lived in Austin from 2009-2018!";
      const deepDraft = "Austin (2009-2018) was my home for nearly a decade.";
      
      const result = analyzeRepetition(fastHook, deepDraft);
      
      expect(result.overlapPercentage).toBeGreaterThan(0);
    });
  });

  describe('configuration validation', () => {
    it('should use default configuration when none provided', () => {
      const fastHook = "Test content";
      const deepDraft = "Different test content with more words to analyze properly";
      
      const result = analyzeRepetition(fastHook, deepDraft);
      
      // Should use default threshold of 0.3
      expect(result.shouldRegenerate).toBe(false);
    });

    it('should respect custom n-gram size', () => {
      const fastHook = "Austin Texas city";
      const deepDraft = "Austin Texas city is amazing";
      
      const unigramConfig: RepetitionConfig = {
        overlapThreshold: 0.3,
        ngramSize: 1, // Unigrams
        minTokensForCheck: 3
      };
      
      const result = analyzeRepetition(fastHook, deepDraft, unigramConfig);
      
      expect(result.shouldRegenerate).toBe(true);
      expect(result.overlappingNgrams).toContain('austin');
      expect(result.overlappingNgrams).toContain('texas');
    });
  });

  describe('real-world scenarios', () => {
    it('should handle typical fast/deep coordination scenario', () => {
      const fastHook = "Oh absolutely! Austin was such an incredible chapter of my life!";
      const deepDraft = "Living in Austin from 2009 to 2018 was transformative. The music scene was vibrant, with live shows every night on Sixth Street. The food culture was incredible too - from food trucks to fine dining, everything was amazing. I made lifelong friends there and really grew as a person during those years.";
      
      const result = analyzeRepetition(fastHook, deepDraft);
      
      // Should not trigger regeneration - good coordination
      expect(result.shouldRegenerate).toBe(false);
      expect(result.overlapPercentage).toBeLessThan(0.3);
    });

    it('should detect problematic repetition in coordination', () => {
      const fastHook = "I absolutely love Austin! It was such an incredible chapter of my life!";
      const deepDraft = "I absolutely love Austin because it was such an incredible chapter of my life. Austin was amazing and I love how incredible that chapter was.";
      
      const result = analyzeRepetition(fastHook, deepDraft);
      
      // Should trigger regeneration - too much repetition
      expect(result.shouldRegenerate).toBe(true);
      expect(result.overlapPercentage).toBeGreaterThan(0.3);
    });

    it('should handle opinion-based coordination', () => {
      const fastHook = "Trump is absolutely terrible for America.";
      const deepDraft = "His policies on immigration, healthcare, and the environment are destructive. The way he divides people and spreads misinformation is dangerous for democracy. I believe his leadership style is authoritarian and harmful to our institutions.";
      
      const result = analyzeRepetition(fastHook, deepDraft);
      
      // Should not trigger regeneration - good expansion without repetition
      expect(result.shouldRegenerate).toBe(false);
    });
  });
});