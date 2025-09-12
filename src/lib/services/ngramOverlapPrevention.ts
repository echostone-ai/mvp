// src/lib/services/ngramOverlapPrevention.ts
// Task 9: Efficient n-gram overlap prevention system with character-level 3-gram Jaccard similarity

/**
 * Configuration for n-gram overlap prevention
 */
export interface NgramOverlapConfig {
  ngramSize: number; // Size of character-level n-grams (default: 3)
  jaccardThreshold: number; // Jaccard similarity threshold (default: 0.3)
  minLengthForCheck: number; // Minimum text length to perform check
}

/**
 * Result of n-gram overlap analysis
 */
export interface NgramOverlapAnalysis {
  jaccardSimilarity: number;
  shouldRegenerate: boolean;
  shouldTruncateHook: boolean;
  overlappingNgrams: string[];
  totalNgrams: number;
  processingTimeMs: number;
}

/**
 * Default configuration for n-gram overlap prevention
 * Implements requirements: character-level 3-gram Jaccard similarity with 0.3 threshold
 */
export const DEFAULT_NGRAM_CONFIG: NgramOverlapConfig = {
  ngramSize: 3, // Character-level 3-grams as specified
  jaccardThreshold: 0.3, // 0.3 threshold as specified
  minLengthForCheck: 10 // Need at least 10 characters for meaningful analysis
};

/**
 * Efficient n-gram overlap prevention system
 * Implements character-level 3-gram Jaccard similarity check with 0.3 threshold
 * Optimized for speed to avoid blowing 1s deep lane budget
 */
export class NgramOverlapPrevention {
  private config: NgramOverlapConfig;

  constructor(config: NgramOverlapConfig = DEFAULT_NGRAM_CONFIG) {
    this.config = config;
  }

  /**
   * Analyze overlap between fast hook and deep response using character-level n-grams
   * Returns analysis with regeneration and truncation recommendations
   */
  analyzeOverlap(
    fastHookContent: string,
    deepResponseContent: string
  ): NgramOverlapAnalysis {
    const startTime = Date.now();

    // Skip analysis if either text is too short
    if (fastHookContent.length < this.config.minLengthForCheck || 
        deepResponseContent.length < this.config.minLengthForCheck) {
      return {
        jaccardSimilarity: 0,
        shouldRegenerate: false,
        shouldTruncateHook: false,
        overlappingNgrams: [],
        totalNgrams: 0,
        processingTimeMs: Date.now() - startTime
      };
    }

    // Normalize texts for comparison (lowercase, remove extra whitespace)
    const normalizedFast = this.normalizeText(fastHookContent);
    const normalizedDeep = this.normalizeText(deepResponseContent);

    // Generate character-level n-grams
    const fastNgrams = this.generateCharacterNgrams(normalizedFast, this.config.ngramSize);
    const deepNgrams = this.generateCharacterNgrams(normalizedDeep, this.config.ngramSize);

    // Calculate Jaccard similarity
    const jaccardSimilarity = this.calculateJaccardSimilarity(fastNgrams, deepNgrams);

    // Determine actions based on threshold
    const shouldRegenerate = jaccardSimilarity >= this.config.jaccardThreshold;
    const shouldTruncateHook = false; // Will be set by caller if regeneration fails

    // Find overlapping n-grams for debugging
    const overlappingNgrams = this.findOverlappingNgrams(fastNgrams, deepNgrams);

    const processingTimeMs = Date.now() - startTime;

    return {
      jaccardSimilarity,
      shouldRegenerate,
      shouldTruncateHook,
      overlappingNgrams: overlappingNgrams.slice(0, 10), // Limit for logging
      totalNgrams: deepNgrams.size,
      processingTimeMs
    };
  }

  /**
   * Truncate hook content from deep response if overlap still exists after regeneration
   * This is the fallback when regeneration doesn't solve the overlap issue
   */
  truncateHookFromDeepResponse(
    fastHookContent: string,
    deepResponseContent: string
  ): string {
    // Simple approach: remove sentences from deep response that have high word overlap with hook
    const hookWords = new Set(
      this.normalizeText(fastHookContent)
        .split(/\s+/)
        .filter(word => word.length > 2)
    );

    const sentences = deepResponseContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const filteredSentences: string[] = [];

    for (const sentence of sentences) {
      const sentenceWords = this.normalizeText(sentence)
        .split(/\s+/)
        .filter(word => word.length > 2);
      
      const overlapCount = sentenceWords.filter(word => hookWords.has(word)).length;
      const overlapRatio = sentenceWords.length > 0 ? overlapCount / sentenceWords.length : 0;

      // Keep sentences with low word overlap (< 50%)
      if (overlapRatio < 0.5) {
        filteredSentences.push(sentence.trim());
      }
    }

    return filteredSentences.join('. ').trim() + (filteredSentences.length > 0 ? '.' : '');
  }

  /**
   * Normalize text for consistent comparison
   * Removes extra whitespace, converts to lowercase, preserves punctuation for n-grams
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Generate character-level n-grams from text
   * Optimized for speed with Set for O(1) lookups
   */
  private generateCharacterNgrams(text: string, n: number): Set<string> {
    const ngrams = new Set<string>();
    
    if (text.length < n) {
      return ngrams;
    }

    // Generate overlapping character n-grams
    for (let i = 0; i <= text.length - n; i++) {
      const ngram = text.substring(i, i + n);
      ngrams.add(ngram);
    }

    return ngrams;
  }

  /**
   * Calculate Jaccard similarity between two sets of n-grams
   * Jaccard = |intersection| / |union|
   * Optimized for speed using Set operations
   */
  private calculateJaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
    if (set1.size === 0 && set2.size === 0) {
      return 0;
    }

    // Calculate intersection size efficiently
    const smaller = set1.size <= set2.size ? set1 : set2;
    const larger = set1.size <= set2.size ? set2 : set1;

    let intersectionSize = 0;
    for (const item of smaller) {
      if (larger.has(item)) {
        intersectionSize++;
      }
    }

    // Union size = size1 + size2 - intersection
    const unionSize = set1.size + set2.size - intersectionSize;

    return unionSize > 0 ? intersectionSize / unionSize : 0;
  }

  /**
   * Find overlapping n-grams for debugging purposes
   * Returns array of overlapping n-grams (limited for performance)
   */
  private findOverlappingNgrams(set1: Set<string>, set2: Set<string>): string[] {
    const overlapping: string[] = [];
    const smaller = set1.size <= set2.size ? set1 : set2;
    const larger = set1.size <= set2.size ? set2 : set1;

    for (const item of smaller) {
      if (larger.has(item)) {
        overlapping.push(item);
        // Limit for performance and logging
        if (overlapping.length >= 20) {
          break;
        }
      }
    }

    return overlapping;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<NgramOverlapConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): NgramOverlapConfig {
    return { ...this.config };
  }
}

/**
 * Utility function to log n-gram overlap analysis results
 * Logs overlap percentages in chat_metrics for monitoring
 */
export function logNgramOverlapAnalysis(
  analysis: NgramOverlapAnalysis,
  traceId: string,
  fastContent: string,
  deepContent: string,
  attempt: number = 1
): void {
  console.log('ngram_overlap_analysis', {
    trace_id: traceId,
    jaccard_similarity: Math.round(analysis.jaccardSimilarity * 1000) / 1000, // 3 decimal places
    overlap_percentage: Math.round(analysis.jaccardSimilarity * 100), // For chat_metrics
    should_regenerate: analysis.shouldRegenerate,
    should_truncate_hook: analysis.shouldTruncateHook,
    overlapping_ngrams_count: analysis.overlappingNgrams.length,
    total_ngrams: analysis.totalNgrams,
    processing_time_ms: analysis.processingTimeMs,
    fast_content_length: fastContent.length,
    deep_content_length: deepContent.length,
    attempt: attempt,
    sample_overlaps: analysis.overlappingNgrams.slice(0, 3)
  });
}

/**
 * Singleton instance for global use
 */
export const ngramOverlapPrevention = new NgramOverlapPrevention();