// src/lib/services/lightweightAnalyzer.ts
// Lightweight query analysis with token normalization and topic fencing

import { FactbookService, FactbookSnippet } from './factbookService';

export interface QueryAnalysis {
  keywords: string[];
  entities: string[];
  topics: string[];
  intent: 'factual' | 'opinion' | 'story' | 'general';
  processingTimeMs: number;
  relevantSnippets?: FactbookSnippet[]; // ≤3 snippets mapped from analysis
}

// Stopwords to filter out (common English words that don't add meaning)
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in', 'is', 'it',
  'its', 'of', 'on', 'that', 'the', 'to', 'was', 'will', 'with', 'you', 'your', 'me', 'my',
  'what', 'when', 'where', 'how', 'why', 'who', 'did', 'do', 'does', 'can', 'could', 'would',
  'should', 'tell', 'about', 'like', 'think', 'know', 'want', 'get', 'got', 'have', 'had', 'but', 'or'
]);

// Entity patterns for recognition
const ENTITY_PATTERNS = {
  people: /\b(jonathan|jon|jb|braden|tyler|krissy|trump|biden)\b/gi,
  places: /\b(austin|texas|maine|sofia|bulgaria|vancouver|island|america|verteillac|france)\b/gi,
  pets: /\b(olive|romeo|dog|cat|pet)\b/gi,
  years: /\b(19\d{2}|20\d{2})\b/g,
  timeframes: /\b(2009.*2018|nine.*years|years?)\b/gi
};

// Topic classification patterns
const TOPIC_PATTERNS = {
  pets: /\b(olive|romeo|dog|cat|pet|animal|puppy|doggy)\b/gi,
  politics: /\b(trump|biden|politics|political|immigration|america|president)\b/gi,
  places: /\b(austin|texas|maine|sofia|bulgaria|live|lived|city|place|where)\b/gi,
  timeline: /\b(when|year|time|period|2009|2018|lived|moved|born)\b/gi,
  relationships: /\b(tyler|krissy|friend|partner|relationship|meet|met)\b/gi,
  identity: /\b(name|who|jonathan|jon|jb|braden|age|birthday|born)\b/gi,
  opinions: /\b(think|opinion|believe|feel|stance|view|hate|love|terrible|amazing)\b/gi
};

// Intent classification patterns
const INTENT_PATTERNS = {
  factual: /\b(when|where|what|who|how|old|name|live|born|year)\b/gi,
  opinion: /\b(think|opinion|believe|feel|stance|view|like|hate|love)\b/gi,
  story: /\b(tell|story|experience|remember|happened|time|once)\b/gi
};

export class LightweightAnalyzer {
  private factbookService: FactbookService;
  
  constructor() {
    this.factbookService = FactbookService.getInstance();
  }
  
  analyzeQuery(query: string, includeSnippets: boolean = false): QueryAnalysis {
    const startTime = Date.now();
    
    // Extract and normalize keywords
    const keywords = this.extractKeywords(query);
    
    // Detect entities
    const entities = this.detectEntities(query);
    
    // Classify topics
    const topics = this.classifyTopics(query, keywords, entities);
    
    // Apply topic fencing
    const fencedTopics = this.applyTopicFences(topics);
    
    // Detect intent
    const intent = this.detectIntent(query);
    
    // Map to relevant snippets if requested and factbook is available
    let relevantSnippets: FactbookSnippet[] | undefined;
    if (includeSnippets && keywords.length > 0) {
      try {
        // Combine keywords and entities for snippet mapping
        const searchTerms = [...new Set([...keywords, ...entities])];
        relevantSnippets = this.factbookService.querySnippets(searchTerms, 3);
      } catch (error) {
        // Factbook might not be loaded yet, continue without snippets
        console.warn('factbook_not_available', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    
    const processingTimeMs = Date.now() - startTime;
    
    console.log('query_analysis', {
      query: query.substring(0, 50),
      keywords_count: keywords.length,
      entities_count: entities.length,
      topics: fencedTopics,
      intent,
      snippets_found: relevantSnippets?.length || 0,
      processing_ms: processingTimeMs
    });
    
    if (processingTimeMs > 10) {
      console.warn('query_analysis_slow', { elapsed_ms: processingTimeMs, target_ms: 10 });
    }
    
    return {
      keywords,
      entities,
      topics: fencedTopics,
      intent,
      processingTimeMs,
      relevantSnippets: relevantSnippets || []
    };
  }
  
  extractKeywords(text: string): string[] {
    // Normalize and tokenize
    const normalized = this.normalizeText(text);
    const tokens = normalized.split(/\s+/).filter(token => token.length > 2);
    
    // Remove stopwords
    const keywords = tokens.filter(token => !STOPWORDS.has(token));
    
    // Light stemming (remove common suffixes)
    const stemmed = keywords.map(keyword => this.lightStem(keyword));
    
    // Apply consistent token normalization (matches FactbookService)
    const normalizedKeywords = stemmed.map(keyword => this.normalizeToken(keyword));
    
    // Remove duplicates and empty tokens, sort for deterministic output
    const uniqueKeywords = [...new Set(normalizedKeywords)].filter(k => k.length > 0);
    return uniqueKeywords.sort(); // Deterministic ordering
  }
  
  detectEntities(text: string): string[] {
    const entities: string[] = [];
    
    // Normalize text first to handle accented characters
    const normalizedText = this.normalizeText(text);
    
    for (const [category, pattern] of Object.entries(ENTITY_PATTERNS)) {
      const matches = normalizedText.match(pattern);
      if (matches) {
        // Apply consistent normalization to entities
        entities.push(...matches.map(match => this.normalizeToken(match)));
      }
    }
    
    // Remove duplicates and empty tokens, sort for deterministic output
    const uniqueEntities = [...new Set(entities)].filter(e => e.length > 0);
    return uniqueEntities.sort(); // Deterministic ordering
  }
  
  classifyTopics(query: string, keywords: string[], entities: string[]): string[] {
    const topics: string[] = [];
    
    // Normalize query for pattern matching
    const normalizedQuery = this.normalizeText(query);
    
    // Check each topic pattern against normalized query
    for (const [topic, pattern] of Object.entries(TOPIC_PATTERNS)) {
      if (pattern.test(normalizedQuery)) {
        topics.push(topic);
      }
    }
    
    // Entity-based topic classification (entities are already normalized)
    if (entities.some(e => ['olive', 'romeo'].includes(e))) {
      topics.push('pets');
    }
    if (entities.some(e => ['tyler', 'krissy'].includes(e))) {
      topics.push('relationships');
    }
    if (entities.some(e => ['austin', 'texas', 'maine', 'sofia'].includes(e))) {
      topics.push('places');
    }
    if (entities.some(e => ['trump', 'biden'].includes(e))) {
      topics.push('politics');
    }
    
    // Remove duplicates and sort for deterministic output
    return [...new Set(topics)].sort();
  }
  
  applyTopicFences(topics: string[]): string[] {
    // Topic fencing rules to prevent cross-contamination
    // Priority order: pets > politics > places > relationships > identity
    
    // If pets topic is detected, filter out politics
    if (topics.includes('pets')) {
      const filtered = topics.filter(topic => !['politics', 'opinions'].includes(topic));
      return filtered.sort(); // Deterministic ordering
    }
    
    // If politics topic is detected, filter out pets
    if (topics.includes('politics')) {
      const filtered = topics.filter(topic => !['pets'].includes(topic));
      return filtered.sort(); // Deterministic ordering
    }
    
    // Return sorted topics for deterministic output
    return [...topics].sort();
  }
  
  detectIntent(query: string): QueryAnalysis['intent'] {
    const lowerQuery = query.toLowerCase();
    
    // Check intent patterns in order of specificity
    if (INTENT_PATTERNS.opinion.test(lowerQuery)) {
      return 'opinion';
    }
    
    if (INTENT_PATTERNS.story.test(lowerQuery)) {
      return 'story';
    }
    
    if (INTENT_PATTERNS.factual.test(lowerQuery)) {
      return 'factual';
    }
    
    return 'general';
  }
  
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD') // Decompose accented characters (Unicode normalization)
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics (ASCII folding)
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();
  }
  
  // Enhanced normalization that matches FactbookService token normalization
  private normalizeToken(token: string): string {
    return token.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics (ASCII folding)
      .replace(/[^\w]/g, ''); // Remove non-word characters
  }
  
  private lightStem(word: string): string {
    // Simple suffix removal for common English patterns
    if (word.length <= 3) return word;
    
    // Remove common suffixes in order of specificity
    const suffixes = ['ing', 'ed', 'er', 'est', 'ly', 'es', 's'];
    
    for (const suffix of suffixes) {
      if (word.endsWith(suffix) && word.length > suffix.length + 2) {
        const stemmed = word.slice(0, -suffix.length);
        // Special case: if removing 'es' or 's' from adventures -> adventur
        if (suffix === 'es' && word === 'adventures') {
          return 'adventur';
        }
        return stemmed;
      }
    }
    
    return word;
  }
  
  // Deterministic query analysis that maps to ≤3 relevant snippets using weighted scoring
  analyzeQueryWithSnippets(query: string): QueryAnalysis & { relevantSnippets: FactbookSnippet[] } {
    const analysis = this.analyzeQuery(query, true);
    
    // Ensure we have snippets (fallback to empty array if factbook not available)
    const relevantSnippets = analysis.relevantSnippets || [];
    
    return {
      ...analysis,
      relevantSnippets
    };
  }
  
  // Utility method for testing and debugging
  analyzeKeywords(keywords: string[]): { 
    entities: string[]; 
    topics: string[]; 
    fencedTopics: string[] 
  } {
    const query = keywords.join(' ');
    const entities = this.detectEntities(query);
    const topics = this.classifyTopics(query, keywords, entities);
    const fencedTopics = this.applyTopicFences(topics);
    
    return { entities, topics, fencedTopics };
  }
  
  // Performance testing method - ensures <10ms processing time
  benchmarkAnalysis(query: string, iterations: number = 100): { 
    avgTimeMs: number; 
    maxTimeMs: number; 
    passesTarget: boolean 
  } {
    const times: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      this.analyzeQuery(query);
      const elapsedMs = Date.now() - startTime;
      times.push(elapsedMs);
    }
    
    const avgTimeMs = times.reduce((sum, time) => sum + time, 0) / times.length;
    const maxTimeMs = Math.max(...times);
    const passesTarget = maxTimeMs < 10;
    
    return { avgTimeMs, maxTimeMs, passesTarget };
  }
}

export const lightweightAnalyzer = new LightweightAnalyzer();