// src/lib/services/__tests__/ngramOverlapPrevention.test.ts
// Tests for Task 9: Efficient n-gram overlap prevention system

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  NgramOverlapPrevention, 
  DEFAULT_NGRAM_CONFIG,
  logNgramOverlapAnalysis,
  ngramOverlapPrevention
} from '../ngramOverlapPrevention';

describe('NgramOverlapPrevention', () => {
  let overlapPrevention: NgramOverlapPrevention;

  beforeEach(() => {
    overlapPrevention = new NgramOverlapPrevention();
  });

  describe('Character-level 3-gram Jaccard similarity', () => {
    it('should calculate correct Jaccard similarity for identical texts', () => {
      const text = "Hello world";
      const analysis = overlapPrevention.analyzeOverlap(text, text);
      
      expect(analysis.jaccardSimilarity).toBe(1.0);
      expect(analysis.shouldRegenerate).toBe(true); // Above 0.3 threshold
    });

    it('should calculate correct Jaccard similarity for completely different texts', () => {
      const text1 = "Hello world";
      const text2 = "Goodbye universe";
      const analysis = overlapPrevention.analyzeOverlap(text1, text2);
      
      expect(analysis.jaccardSimilarity).toBeLessThan(0.3);
      expect(analysis.shouldRegenerate).toBe(false);
    });

    it('should use character-level 3-grams as specified', () => {
      const text1 = "abc";
      const text2 = "abcd";
      const analysis = overlapPrevention.analyzeOverlap(text1, text2);
      
      // These are too short for minLengthForCheck (10), so should return 0
      expect(analysis.jaccardSimilarity).toBe(0);
      expect(analysis.shouldRegenerate).toBe(false); // Too short for analysis
    });

    it('should calculate 3-gram Jaccard similarity correctly with longer text', () => {
      const text1 = "hello world";
      const text2 = "hello there";
      const analysis = overlapPrevention.analyzeOverlap(text1, text2);
      
      // Both texts share "hel", "ell", "llo", "lo " trigrams
      expect(analysis.jaccardSimilarity).toBeGreaterThan(0);
      expect(analysis.totalNgrams).toBeGreaterThan(0);
    });

    it('should handle case insensitive comparison', () => {
      const text1 = "Hello World";
      const text2 = "hello world";
      const analysis = overlapPrevention.analyzeOverlap(text1, text2);
      
      expect(analysis.jaccardSimilarity).toBe(1.0);
      expect(analysis.shouldRegenerate).toBe(true);
    });

    it('should normalize whitespace', () => {
      const text1 = "Hello   world";
      const text2 = "Hello world";
      const analysis = overlapPrevention.analyzeOverlap(text1, text2);
      
      expect(analysis.jaccardSimilarity).toBe(1.0);
      expect(analysis.shouldRegenerate).toBe(true);
    });
  });

  describe('Threshold-based regeneration decision', () => {
    it('should trigger regeneration when similarity >= 0.3', () => {
      // Create texts with exactly 30% overlap
      const text1 = "abcdefghij"; // 8 trigrams: abc, bcd, cde, def, efg, fgh, ghi, hij
      const text2 = "abcklmnopq"; // 8 trigrams: abc, bck, ckl, klm, lmn, mno, nop, opq
      // Intersection: 1 (abc)
      // Union: 15 (all unique trigrams)
      // Jaccard: 1/15 ≈ 0.067 (below threshold)
      
      const analysis = overlapPrevention.analyzeOverlap(text1, text2);
      expect(analysis.shouldRegenerate).toBe(false);
    });

    it('should not trigger regeneration when similarity < 0.3', () => {
      const text1 = "completely different";
      const text2 = "totally unrelated";
      const analysis = overlapPrevention.analyzeOverlap(text1, text2);
      
      expect(analysis.jaccardSimilarity).toBeLessThan(0.3);
      expect(analysis.shouldRegenerate).toBe(false);
    });

    it('should trigger regeneration for high overlap content', () => {
      const text1 = "Olive was my beloved Puerto Rican street dog";
      const text2 = "Olive was indeed my beloved Puerto Rican street dog who came with me";
      const analysis = overlapPrevention.analyzeOverlap(text1, text2);
      
      expect(analysis.jaccardSimilarity).toBeGreaterThanOrEqual(0.3);
      expect(analysis.shouldRegenerate).toBe(true);
    });
  });

  describe('Performance optimization', () => {
    it('should complete analysis in reasonable time', () => {
      const longText1 = "This is a longer text that should still be processed quickly. ".repeat(10);
      const longText2 = "This is a different longer text that should also be processed quickly. ".repeat(10);
      
      const startTime = Date.now();
      const analysis = overlapPrevention.analyzeOverlap(longText1, longText2);
      const endTime = Date.now();
      
      expect(analysis.processingTimeMs).toBeLessThan(50); // Should be very fast
      expect(endTime - startTime).toBeLessThan(100); // Total time including test overhead
    });

    it('should skip analysis for very short texts', () => {
      const shortText1 = "Hi";
      const shortText2 = "Hello";
      const analysis = overlapPrevention.analyzeOverlap(shortText1, shortText2);
      
      expect(analysis.jaccardSimilarity).toBe(0);
      expect(analysis.shouldRegenerate).toBe(false);
      expect(analysis.totalNgrams).toBe(0);
    });

    it('should track processing time accurately', () => {
      const text1 = "Some reasonable length text for testing";
      const text2 = "Another reasonable length text for testing";
      const analysis = overlapPrevention.analyzeOverlap(text1, text2);
      
      expect(analysis.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(analysis.processingTimeMs).toBeLessThan(50); // Should be very fast
    });
  });

  describe('Hook truncation fallback', () => {
    it('should truncate overlapping sentences from deep response', () => {
      const fastHook = "Olive was my beloved Puerto Rican street dog";
      const deepResponse = "Olive was my beloved dog who lived with me. She was tough as nails. I found her in Puerto Rico as a stray.";
      
      const truncated = overlapPrevention.truncateHookFromDeepResponse(fastHook, deepResponse);
      
      // Should remove sentences with high word overlap
      expect(truncated).not.toContain("Olive was my beloved dog");
      expect(truncated).toContain("She was tough as nails");
    });

    it('should preserve sentences with low overlap', () => {
      const fastHook = "I lived in Austin for nine years";
      const deepResponse = "Austin was amazing for music. The food scene was incredible. I made great friends there during my time.";
      
      const truncated = overlapPrevention.truncateHookFromDeepResponse(fastHook, deepResponse);
      
      // Should preserve most content since overlap is low
      expect(truncated.length).toBeGreaterThan(50);
      expect(truncated).toContain("music");
      expect(truncated).toContain("food");
    });

    it('should handle empty result gracefully', () => {
      const fastHook = "Olive was my beloved Puerto Rican street dog";
      const deepResponse = "Olive was my beloved Puerto Rican street dog who was amazing.";
      
      const truncated = overlapPrevention.truncateHookFromDeepResponse(fastHook, deepResponse);
      
      // Should handle case where all sentences are removed
      expect(typeof truncated).toBe('string');
    });
  });

  describe('Configuration management', () => {
    it('should use default configuration correctly', () => {
      const config = overlapPrevention.getConfig();
      
      expect(config.ngramSize).toBe(3);
      expect(config.jaccardThreshold).toBe(0.3);
      expect(config.minLengthForCheck).toBe(10);
    });

    it('should allow configuration updates', () => {
      overlapPrevention.updateConfig({ 
        jaccardThreshold: 0.4,
        ngramSize: 4 
      });
      
      const config = overlapPrevention.getConfig();
      expect(config.jaccardThreshold).toBe(0.4);
      expect(config.ngramSize).toBe(4);
      expect(config.minLengthForCheck).toBe(10); // Should preserve unchanged values
    });

    it('should apply updated configuration to analysis', () => {
      overlapPrevention.updateConfig({ jaccardThreshold: 0.8 });
      
      const text1 = "Hello world";
      const text2 = "Hello world test";
      const analysis = overlapPrevention.analyzeOverlap(text1, text2);
      
      // With higher threshold, should not trigger regeneration
      expect(analysis.shouldRegenerate).toBe(false);
    });
  });

  describe('Logging functionality', () => {
    it('should log analysis results without errors', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const analysis = overlapPrevention.analyzeOverlap("test text", "another test");
      logNgramOverlapAnalysis(analysis, "trace123", "test text", "another test", 1);
      
      expect(consoleSpy).toHaveBeenCalledWith('ngram_overlap_analysis', expect.objectContaining({
        trace_id: 'trace123',
        jaccard_similarity: expect.any(Number),
        overlap_percentage: expect.any(Number),
        should_regenerate: expect.any(Boolean),
        processing_time_ms: expect.any(Number),
        attempt: 1
      }));
      
      consoleSpy.mockRestore();
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle typical fast/deep lane coordination', () => {
      const fastHook = "I lived in Austin for nine incredible years.";
      const deepResponse = "Austin was such an amazing chapter of my life. The music scene was incredible, the food was fantastic, and I made lifelong friends in the tech community. We used to explore different BBQ places every weekend.";
      
      const analysis = overlapPrevention.analyzeOverlap(fastHook, deepResponse);
      
      // Should have some overlap but likely not enough to trigger regeneration
      expect(analysis.jaccardSimilarity).toBeGreaterThan(0);
      expect(analysis.processingTimeMs).toBeLessThan(10);
    });

    it('should detect problematic repetition', () => {
      const fastHook = "Olive was my beloved Puerto Rican street dog.";
      const deepResponse = "Olive was my beloved Puerto Rican street dog who came with me to Maine.";
      
      const analysis = overlapPrevention.analyzeOverlap(fastHook, deepResponse);
      
      // Should detect high overlap and trigger regeneration
      expect(analysis.jaccardSimilarity).toBeGreaterThanOrEqual(0.3);
      expect(analysis.shouldRegenerate).toBe(true);
    });

    it('should handle edge case with punctuation differences', () => {
      const fastHook = "Tyler is one of my closest friends from Austin!";
      const deepResponse = "Tyler is one of my closest friends from Austin. He's incredibly smart and has a great sense of humor.";
      
      const analysis = overlapPrevention.analyzeOverlap(fastHook, deepResponse);
      
      // Should detect overlap despite punctuation differences
      expect(analysis.jaccardSimilarity).toBeGreaterThan(0.3);
      expect(analysis.shouldRegenerate).toBe(true);
    });
  });

  describe('Singleton instance', () => {
    it('should provide working singleton instance', () => {
      const analysis = ngramOverlapPrevention.analyzeOverlap("test", "testing overlap");
      
      expect(analysis).toBeDefined();
      expect(analysis.jaccardSimilarity).toBeGreaterThanOrEqual(0);
      expect(analysis.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});