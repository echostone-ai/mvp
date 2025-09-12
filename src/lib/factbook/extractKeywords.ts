/**
 * Generic keyword extraction utility for factbook entries
 * Extracts keywords from text while preserving proper nouns
 */

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'will', 'with',
  'his', 'her', 'him', 'she', 'they', 'them', 'their', 'this', 'these', 'those',
  'but', 'or', 'not', 'no', 'can', 'had', 'have', 'been', 'were', 'said', 'each',
  'which', 'do', 'how', 'if', 'up', 'out', 'many', 'then', 'more', 'so', 'very',
  'what', 'know', 'just', 'first', 'get', 'over', 'think', 'also', 'back', 'after',
  'use', 'two', 'way', 'even', 'new', 'want', 'because', 'any', 'may', 'say', 'one'
]);

/**
 * Normalize text for keyword extraction
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
}

/**
 * Check if a word should be preserved as a proper noun
 */
function isProperNoun(word: string, originalText: string): boolean {
  // Look for the word capitalized in the original text (not at sentence start)
  const regex = new RegExp(`(?<!^|[.!?]\\s)\\b${word.charAt(0).toUpperCase()}${word.slice(1)}\\b`, 'g');
  return regex.test(originalText);
}

/**
 * Extract meaningful keywords from text
 */
export function extractKeywords(text: string, existingKeywords: string[] = []): string[] {
  if (!text || typeof text !== 'string') {
    return existingKeywords;
  }

  const normalized = normalize(text);
  const words = normalized.split(' ').filter(Boolean);
  
  const keywords = new Set<string>(existingKeywords.map(k => k.toLowerCase()));
  
  for (const word of words) {
    // Skip if too short, is stop word, or is numeric
    if (word.length < 2 || STOP_WORDS.has(word) || /^\d+$/.test(word)) {
      continue;
    }
    
    // Preserve proper nouns in their original case
    if (isProperNoun(word, text)) {
      // Find the original case version
      const properNounMatch = text.match(new RegExp(`\\b${word.charAt(0).toUpperCase()}${word.slice(1)}\\b`));
      if (properNounMatch) {
        keywords.add(properNounMatch[0]);
        continue;
      }
    }
    
    // Add as lowercase for common words
    keywords.add(word);
  }
  
  // Extract meaningful phrases (2-3 words)
  const phrases = extractPhrases(text);
  phrases.forEach(phrase => keywords.add(phrase));
  
  return Array.from(keywords).sort();
}

/**
 * Extract meaningful phrases from text
 */
function extractPhrases(text: string): string[] {
  const phrases: string[] = [];
  const normalized = normalize(text);
  const words = normalized.split(' ').filter(Boolean);
  
  // Extract 2-word phrases
  for (let i = 0; i < words.length - 1; i++) {
    const word1 = words[i];
    const word2 = words[i + 1];
    
    // Skip if either word is a stop word or too short
    if (STOP_WORDS.has(word1) || STOP_WORDS.has(word2) || 
        word1.length < 2 || word2.length < 2) {
      continue;
    }
    
    const phrase = `${word1} ${word2}`;
    
    // Only include phrases that seem meaningful
    if (isMeaningfulPhrase(phrase)) {
      phrases.push(phrase);
    }
  }
  
  return phrases;
}

/**
 * Check if a phrase is meaningful enough to include as a keyword
 */
function isMeaningfulPhrase(phrase: string): boolean {
  const meaningfulPatterns = [
    /\b(new york|costa rica|puerto rico|red hot|chili peppers)\b/i,
    /\b(vancouver island|austin city|electric aquatic)\b/i,
    /\b(hunter thompson|philip glass|werner herzog)\b/i,
    /\b(there will|no country|old men)\b/i,
    /\b(hip hop|stand up|social media)\b/i
  ];
  
  return meaningfulPatterns.some(pattern => pattern.test(phrase));
}

/**
 * Extract keywords from a factbook entry
 */
export function extractFactKeywords(fact: {
  id: string;
  text: string;
  topics?: string[];
  keywords?: string[];
}): string[] {
  const existingKeywords = fact.keywords || [];
  const textKeywords = extractKeywords(fact.text, existingKeywords);
  
  // Add topic-derived keywords
  const topicKeywords = (fact.topics || []).map(topic => topic.toLowerCase());
  
  // Combine and deduplicate
  const allKeywords = new Set([...textKeywords, ...topicKeywords]);
  
  return Array.from(allKeywords).sort();
}