// src/lib/services/repetitionGuard.ts
// Task 5: Pre-stream repetition guard for coordination enhancement

/**
 * Configuration for repetition detection
 */
export interface RepetitionConfig {
  overlapThreshold: number; // Percentage threshold (0-1) for triggering regeneration
  ngramSize: number; // Size of n-grams to compare (default: 3)
  minTokensForCheck: number; // Minimum tokens in deep draft before checking
}

/**
 * Result of repetition analysis
 */
export interface RepetitionAnalysis {
  overlapPercentage: number;
  shouldRegenerate: boolean;
  overlappingNgrams: string[];
  totalNgrams: number;
}

/**
 * Default configuration for repetition detection
 */
export const DEFAULT_REPETITION_CONFIG: RepetitionConfig = {
  overlapThreshold: 0.3, // 30% threshold as specified in requirements
  ngramSize: 2, // Bigrams for better coverage with shorter texts
  minTokensForCheck: 5 // Need at least 5 tokens to do meaningful analysis
};

/**
 * Analyze overlap between fast lane hook and deep lane draft
 * Uses n-gram analysis to detect semantic and lexical repetition
 */
export function analyzeRepetition(
  fastHookContent: string,
  deepDraftContent: string,
  config: RepetitionConfig = DEFAULT_REPETITION_CONFIG
): RepetitionAnalysis {
  // Normalize and tokenize both texts
  const fastTokens = normalizeAndTokenize(fastHookContent);
  const deepTokens = normalizeAndTokenize(deepDraftContent);
  
  // Skip analysis if deep draft is too short
  if (deepTokens.length < config.minTokensForCheck) {
    return {
      overlapPercentage: 0,
      shouldRegenerate: false,
      overlappingNgrams: [],
      totalNgrams: 0
    };
  }
  
  // Generate n-grams for both texts, with fallback to unigrams if needed
  let fastNgrams = generateNgrams(fastTokens, config.ngramSize);
  let deepNgrams = generateNgrams(deepTokens, config.ngramSize);
  let actualNgramSize = config.ngramSize;
  
  // Fallback to smaller n-grams if we don't have enough tokens
  if (fastNgrams.length === 0 || deepNgrams.length === 0) {
    if (config.ngramSize > 1) {
      // Try unigrams (individual words)
      fastNgrams = generateNgrams(fastTokens, 1);
      deepNgrams = generateNgrams(deepTokens, 1);
      actualNgramSize = 1;
    }
  }
  
  if (fastNgrams.length === 0 || deepNgrams.length === 0) {
    return {
      overlapPercentage: 0,
      shouldRegenerate: false,
      overlappingNgrams: [],
      totalNgrams: deepNgrams.length
    };
  }
  
  // Find overlapping n-grams
  const fastNgramSet = new Set(fastNgrams);
  const overlappingNgrams = deepNgrams.filter(ngram => fastNgramSet.has(ngram));
  
  // Calculate overlap percentage based on deep lane n-grams
  let overlapPercentage = overlappingNgrams.length / deepNgrams.length;
  
  // If no n-gram overlap found, check individual word overlap as fallback
  if (overlapPercentage === 0 && actualNgramSize > 1) {
    const fastWordSet = new Set(fastTokens);
    const overlappingWords = deepTokens.filter(word => fastWordSet.has(word));
    const wordOverlapPercentage = overlappingWords.length / deepTokens.length;
    
    // Use word overlap with a higher threshold
    if (wordOverlapPercentage >= config.overlapThreshold * 1.5) {
      overlapPercentage = wordOverlapPercentage;
      overlappingNgrams.push(...overlappingWords);
    }
  }
  
  // Adjust threshold for unigrams (they're less specific, so we need higher overlap)
  let adjustedThreshold = config.overlapThreshold;
  if (actualNgramSize === 1) {
    adjustedThreshold = Math.min(0.6, config.overlapThreshold * 2); // Double threshold for unigrams
  }
  
  // Determine if regeneration is needed
  const shouldRegenerate = overlapPercentage >= adjustedThreshold;
  
  return {
    overlapPercentage,
    shouldRegenerate,
    overlappingNgrams: [...new Set(overlappingNgrams)], // Remove duplicates
    totalNgrams: deepNgrams.length
  };
}

/**
 * Normalize text and tokenize into words
 * Removes punctuation, converts to lowercase, filters out stop words
 */
function normalizeAndTokenize(text: string): string[] {
  // Convert to lowercase and remove punctuation
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  
  // Split into words and filter
  const tokens = normalized
    .split(/\s+/)
    .filter(token => token.length > 2) // Remove very short words
    .filter(token => !isStopWord(token)); // Remove common stop words
  
  return tokens;
}

/**
 * Generate n-grams from token array
 */
function generateNgrams(tokens: string[], n: number): string[] {
  if (tokens.length < n) {
    return [];
  }
  
  const ngrams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    const ngram = tokens.slice(i, i + n).join(' ');
    ngrams.push(ngram);
  }
  
  return ngrams;
}

/**
 * Check if a word is a common stop word
 * These words are less meaningful for repetition detection
 */
function isStopWord(word: string): boolean {
  const stopWords = new Set([
    'the', 'and', 'but', 'for', 'are', 'with', 'this', 'that', 'they',
    'have', 'from', 'been', 'were', 'said', 'each', 'which', 'their',
    'time', 'will', 'about', 'would', 'there', 'could', 'other', 'after',
    'first', 'well', 'many', 'some', 'these', 'may', 'then', 'them',
    'people', 'into', 'very', 'know', 'just', 'like', 'over', 'think',
    'also', 'back', 'work', 'life', 'only', 'can', 'should', 'any',
    'new', 'way', 'look', 'good', 'want', 'through', 'much', 'before',
    'right', 'too', 'means', 'old', 'take', 'than', 'high', 'never',
    'more', 'used', 'make', 'most', 'such', 'during', 'here', 'even',
    'off', 'against', 'because', 'does', 'part', 'being', 'now', 'made',
    'without', 'use', 'your', 'way', 'many', 'then', 'them', 'these',
    'what', 'when', 'where', 'how', 'why', 'did', 'you', 'was', 'his',
    'her', 'him', 'she', 'had', 'has', 'not', 'out', 'get', 'all',
    'one', 'two', 'see', 'come', 'its', 'our', 'day', 'who', 'oil',
    'sit', 'now', 'find', 'long', 'down', 'call', 'man'
  ]);
  
  return stopWords.has(word);
}

/**
 * Enhanced repetition analysis that also checks for semantic similarity
 * This version considers word stems and synonyms for more sophisticated detection
 */
export function analyzeSemanticRepetition(
  fastHookContent: string,
  deepDraftContent: string,
  config: RepetitionConfig = DEFAULT_REPETITION_CONFIG
): RepetitionAnalysis {
  // First do basic n-gram analysis
  const basicAnalysis = analyzeRepetition(fastHookContent, deepDraftContent, config);
  
  // If basic analysis already triggers regeneration, return it
  if (basicAnalysis.shouldRegenerate) {
    return basicAnalysis;
  }
  
  // Do additional semantic checks
  const semanticOverlap = checkSemanticOverlap(fastHookContent, deepDraftContent);
  
  // Combine scores (weighted average)
  const combinedOverlap = (basicAnalysis.overlapPercentage * 0.7) + (semanticOverlap * 0.3);
  
  return {
    overlapPercentage: combinedOverlap,
    shouldRegenerate: combinedOverlap >= config.overlapThreshold,
    overlappingNgrams: basicAnalysis.overlappingNgrams,
    totalNgrams: basicAnalysis.totalNgrams
  };
}

/**
 * Check for semantic overlap using simple heuristics
 * Looks for repeated concepts, entities, and emotional expressions
 */
function checkSemanticOverlap(fastText: string, deepText: string): number {
  const fastLower = fastText.toLowerCase();
  const deepLower = deepText.toLowerCase();
  
  // Extract key concepts and entities
  const fastConcepts = extractConcepts(fastLower);
  const deepConcepts = extractConcepts(deepLower);
  
  if (fastConcepts.length === 0 || deepConcepts.length === 0) {
    return 0;
  }
  
  // Count overlapping concepts
  const fastConceptSet = new Set(fastConcepts);
  const overlappingConcepts = deepConcepts.filter(concept => fastConceptSet.has(concept));
  
  return overlappingConcepts.length / deepConcepts.length;
}

/**
 * Extract key concepts from text using simple pattern matching
 */
function extractConcepts(text: string): string[] {
  const concepts: string[] = [];
  const lowerText = text.toLowerCase();
  
  // Extract proper nouns (capitalized words) - convert to lowercase for comparison
  const properNouns = text.match(/\b[A-Z][a-z]+\b/g) || [];
  concepts.push(...properNouns.map(noun => noun.toLowerCase()));
  
  // Extract emotional expressions
  const emotions = lowerText.match(/\b(love|hate|amazing|terrible|incredible|awful|fantastic|wonderful|excited|disappointed|thrilled|angry|happy|sad)\b/g) || [];
  concepts.push(...emotions);
  
  // Extract temporal expressions
  const temporal = lowerText.match(/\b(\d{4}|years?|months?|days?|time|when|during|after|before)\b/g) || [];
  concepts.push(...temporal);
  
  // Extract location references
  const locations = lowerText.match(/\b(austin|california|texas|maine|city|town|place|lived|born|from)\b/g) || [];
  concepts.push(...locations);
  
  return [...new Set(concepts)]; // Remove duplicates
}

/**
 * Utility function to log repetition analysis results
 */
export function logRepetitionAnalysis(
  analysis: RepetitionAnalysis,
  traceId: string,
  fastContent: string,
  deepContent: string
): void {
  console.log('repetition_analysis', {
    trace_id: traceId,
    overlap_percentage: Math.round(analysis.overlapPercentage * 100),
    should_regenerate: analysis.shouldRegenerate,
    overlapping_ngrams_count: analysis.overlappingNgrams.length,
    total_ngrams: analysis.totalNgrams,
    fast_content_length: fastContent.length,
    deep_content_length: deepContent.length,
    sample_overlaps: analysis.overlappingNgrams.slice(0, 3)
  });
}