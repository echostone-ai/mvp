// src/lib/services/__tests__/ngramOverlapIntegration.test.ts
// Integration tests for Task 9: N-gram overlap prevention in chat flow

import { describe, it, expect, beforeEach } from 'vitest';
import { ngramOverlapPrevention, logNgramOverlapAnalysis } from '../ngramOverlapPrevention';

describe('N-gram Overlap Prevention Integration', () => {
  describe('Real-world chat scenarios', () => {
    it('should handle typical factbook fast/deep coordination without triggering regeneration', () => {
      const fastHook = "I lived in Austin for nine incredible years.";
      const deepResponse = "Austin was such an amazing chapter of my life. The music scene was incredible, the food was fantastic, and I made lifelong friends in the tech community. We used to explore different BBQ places every weekend.";
      
      const analysis = ngramOverlapPrevention.analyzeOverlap(fastHook, deepResponse);
      
      // Should have some overlap but not enough to trigger regeneration
      expect(analysis.jaccardSimilarity).toBeGreaterThan(0);
      expect(analysis.jaccardSimilarity).toBeLessThan(0.3); // Below threshold
      expect(analysis.shouldRegenerate).toBe(false);
      expect(analysis.processingTimeMs).toBeLessThan(10); // Fast processing
    });

    it('should detect problematic repetition and trigger regeneration', () => {
      const fastHook = "Olive was my beloved Puerto Rican street dog.";
      const deepResponse = "Olive was my beloved Puerto Rican street dog who came with me to Maine. She was tough as nails and survived brutal winters.";
      
      const analysis = ngramOverlapPrevention.analyzeOverlap(fastHook, deepResponse);
      
      // Should detect high overlap and trigger regeneration
      expect(analysis.jaccardSimilarity).toBeGreaterThanOrEqual(0.3);
      expect(analysis.shouldRegenerate).toBe(true);
      expect(analysis.overlappingNgrams.length).toBeGreaterThan(0);
    });

    it('should handle edge cases with punctuation and capitalization', () => {
      const fastHook = "Tyler is one of my closest friends from Austin!";
      const deepResponse = "Tyler is one of my closest friends from Austin. He's incredibly smart and has a great sense of humor.";
      
      const analysis = ngramOverlapPrevention.analyzeOverlap(fastHook, deepResponse);
      
      // Should normalize and detect overlap despite punctuation differences
      expect(analysis.jaccardSimilarity).toBeGreaterThan(0.3);
      expect(analysis.shouldRegenerate).toBe(true);
    });

    it('should truncate hook content when regeneration fails', () => {
      const fastHook = "Olive was my beloved Puerto Rican street dog";
      const deepResponse = "Olive was my beloved dog who lived with me. She was tough as nails. I found her in Puerto Rico as a stray.";
      
      const truncated = ngramOverlapPrevention.truncateHookFromDeepResponse(fastHook, deepResponse);
      
      // Should remove sentences with high word overlap
      expect(truncated).not.toContain("Olive was my beloved dog");
      expect(truncated).toContain("She was tough as nails");
      expect(truncated.length).toBeGreaterThan(0);
    });
  });

  describe('Performance requirements', () => {
    it('should complete analysis within 1s deep lane budget', () => {
      const longFastHook = "I lived in Austin for nine incredible years and it was amazing. ".repeat(5);
      const longDeepResponse = "Austin was such an incredible chapter of my life with amazing experiences. ".repeat(10);
      
      const startTime = Date.now();
      const analysis = ngramOverlapPrevention.analyzeOverlap(longFastHook, longDeepResponse);
      const totalTime = Date.now() - startTime;
      
      // Should be very fast to avoid blowing 1s deep lane budget
      expect(analysis.processingTimeMs).toBeLessThan(50);
      expect(totalTime).toBeLessThan(100);
      expect(analysis.jaccardSimilarity).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple regeneration attempts efficiently', () => {
      const fastHook = "Olive was my beloved Puerto Rican street dog.";
      const attempts = [
        "Olive was my beloved Puerto Rican street dog who was amazing.",
        "Olive was indeed my beloved Puerto Rican street dog.",
        "She was a tough and loyal companion from Puerto Rico."
      ];
      
      let totalProcessingTime = 0;
      
      for (let i = 0; i < attempts.length; i++) {
        const analysis = ngramOverlapPrevention.analyzeOverlap(fastHook, attempts[i]);
        totalProcessingTime += analysis.processingTimeMs;
        
        // Each analysis should be fast
        expect(analysis.processingTimeMs).toBeLessThan(20);
      }
      
      // Total time for multiple attempts should still be reasonable
      expect(totalProcessingTime).toBeLessThan(100);
    });
  });

  describe('Logging integration', () => {
    it('should log analysis results in correct format for monitoring', () => {
      const fastHook = "I lived in Austin for nine years.";
      const deepResponse = "Austin was an amazing chapter of my life.";
      
      const analysis = ngramOverlapPrevention.analyzeOverlap(fastHook, deepResponse);
      
      // Should have all required fields for chat_metrics logging
      expect(analysis).toHaveProperty('jaccardSimilarity');
      expect(analysis).toHaveProperty('shouldRegenerate');
      expect(analysis).toHaveProperty('shouldTruncateHook');
      expect(analysis).toHaveProperty('overlappingNgrams');
      expect(analysis).toHaveProperty('totalNgrams');
      expect(analysis).toHaveProperty('processingTimeMs');
      
      // Values should be in expected ranges
      expect(analysis.jaccardSimilarity).toBeGreaterThanOrEqual(0);
      expect(analysis.jaccardSimilarity).toBeLessThanOrEqual(1);
      expect(typeof analysis.shouldRegenerate).toBe('boolean');
      expect(Array.isArray(analysis.overlappingNgrams)).toBe(true);
      expect(typeof analysis.totalNgrams).toBe('number');
      expect(typeof analysis.processingTimeMs).toBe('number');
    });
  });

  describe('Configuration edge cases', () => {
    it('should handle very short texts gracefully', () => {
      const shortHook = "Hi";
      const shortResponse = "Hello";
      
      const analysis = ngramOverlapPrevention.analyzeOverlap(shortHook, shortResponse);
      
      // Should skip analysis for very short texts
      expect(analysis.jaccardSimilarity).toBe(0);
      expect(analysis.shouldRegenerate).toBe(false);
      expect(analysis.totalNgrams).toBe(0);
    });

    it('should handle empty or whitespace-only texts', () => {
      const emptyHook = "";
      const whitespaceResponse = "   \n\t  ";
      
      const analysis = ngramOverlapPrevention.analyzeOverlap(emptyHook, whitespaceResponse);
      
      // Should handle gracefully without errors
      expect(analysis.jaccardSimilarity).toBe(0);
      expect(analysis.shouldRegenerate).toBe(false);
    });

    it('should normalize whitespace consistently', () => {
      const hookWithSpaces = "Hello    world   test";
      const responseWithSpaces = "Hello world    test   more";
      
      const analysis = ngramOverlapPrevention.analyzeOverlap(hookWithSpaces, responseWithSpaces);
      
      // Should normalize whitespace and detect overlap
      expect(analysis.jaccardSimilarity).toBeGreaterThan(0);
      expect(analysis.totalNgrams).toBeGreaterThan(0);
    });
  });
});