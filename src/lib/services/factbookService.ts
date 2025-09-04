// src/lib/services/factbookService.ts
// Core factbook service with in-memory indexing and deterministic ranking

import Ajv from 'ajv';
import factbookSchema from '@/data/factbook.schema.json';

export interface FactbookSnippet {
  id: string;
  path: string; // e.g., "pets.olive"
  text: string; // ≤400 chars
  topics: string[]; // ["pets", "dogs", "olive"]
  keywords: string[]; // ["olive", "puerto", "rican", "street", "dog"]
}

export interface FactbookIndex {
  snippets: Map<string, FactbookSnippet>; // path → snippet
  keywordMap: Map<string, string[]>; // keyword → snippet paths
  topicFences: Map<string, Set<string>>; // topic → allowed paths
}

export interface QueryResult {
  snippet: FactbookSnippet;
  score: number;
  matchType: 'exact_entity' | 'topic_match' | 'keyword_match' | 'no_entities';
}

// Topic fence definitions to prevent cross-contamination
const TOPIC_FENCES = {
  'pets': new Set(['pets', 'dogs', 'animals', 'olive', 'romeo']),
  'politics': new Set(['politics', 'trump', 'immigration', 'america', 'opinions']),
  'places': new Set(['places', 'austin', 'texas', 'maine', 'sofia', 'bulgaria', 'timeline']),
  'people': new Set(['relationships', 'friends', 'krissy', 'tyler', 'partner']),
  'identity': new Set(['identity', 'name', 'birthday', 'location'])
};

export class FactbookService {
  private static instance: FactbookService;
  private index: FactbookIndex | null = null;
  private ajv = new Ajv();
  private validateFactbook = this.ajv.compile(factbookSchema);
  
  static getInstance(): FactbookService {
    if (!FactbookService.instance) {
      FactbookService.instance = new FactbookService();
    }
    return FactbookService.instance;
  }
  
  async loadFactbook(factbookData: any): Promise<void> {
    const startTime = Date.now();
    
    // Validate factbook structure
    const isValid = this.validateFactbook(factbookData);
    if (!isValid) {
      const errors = this.validateFactbook.errors?.map(err => `${err.schemaPath} ${err.message}`).join(', ');
      throw new Error(`Invalid factbook structure: ${errors}`);
    }
    
    // Build index
    this.index = this.buildIndex(factbookData);
    
    const elapsedMs = Date.now() - startTime;
    console.log('factbook_loaded', {
      snippets_count: this.index.snippets.size,
      keywords_count: this.index.keywordMap.size,
      topic_fences: Object.keys(TOPIC_FENCES).length,
      load_time_ms: elapsedMs
    });
    
    if (elapsedMs > 50) {
      console.warn('factbook_load_slow', { elapsed_ms: elapsedMs, target_ms: 50 });
    }
  }
  
  buildIndex(factbook: any): FactbookIndex {
    const snippets = new Map<string, FactbookSnippet>();
    const keywordMap = new Map<string, string[]>();
    const topicFences = new Map<string, Set<string>>();
    
    // Initialize topic fences
    for (const [topic, allowedTopics] of Object.entries(TOPIC_FENCES)) {
      topicFences.set(topic, allowedTopics);
    }
    
    // Process each section
    for (const [sectionName, section] of Object.entries(factbook)) {
      if (typeof section === 'object' && section !== null) {
        for (const [itemName, item] of Object.entries(section)) {
          if (typeof item === 'object' && item !== null && 'id' in item) {
            const snippet = item as any;
            const path = `${sectionName}.${itemName}`;
            
            const factbookSnippet: FactbookSnippet = {
              id: snippet.id,
              path,
              text: snippet.text,
              topics: snippet.topics || [],
              keywords: snippet.keywords || []
            };
            
            snippets.set(path, factbookSnippet);
            
            // Build keyword index
            for (const keyword of factbookSnippet.keywords) {
              const normalizedKeyword = this.normalizeToken(keyword);
              if (!keywordMap.has(normalizedKeyword)) {
                keywordMap.set(normalizedKeyword, []);
              }
              keywordMap.get(normalizedKeyword)!.push(path);
            }
          }
        }
      }
    }
    
    return { snippets, keywordMap, topicFences };
  }
  
  querySnippets(keywords: string[], maxResults: number = 3): FactbookSnippet[] {
    if (!this.index) {
      throw new Error('Factbook not loaded');
    }
    
    const startTime = Date.now();
    const normalizedKeywords = keywords.map(k => this.normalizeToken(k));
    const results: QueryResult[] = [];
    const seenPaths = new Set<string>();
    
    // Find matching snippets
    for (const keyword of normalizedKeywords) {
      const paths = this.index.keywordMap.get(keyword) || [];
      
      for (const path of paths) {
        if (seenPaths.has(path)) continue;
        seenPaths.add(path);
        
        const snippet = this.index.snippets.get(path);
        if (!snippet) continue;
        
        const score = this.calculateScore(snippet, normalizedKeywords);
        const matchType = this.getMatchType(snippet, normalizedKeywords);
        
        results.push({ snippet, score, matchType });
      }
    }
    
    // Apply topic fencing
    const fencedResults = this.applyTopicFencing(results, normalizedKeywords);
    
    // Filter out results with -Infinity scores (topic fence violations)
    const validResults = fencedResults.filter(result => result.score !== -Infinity);
    
    // Sort by deterministic ranking
    validResults.sort((a, b) => {
      // Primary: score (higher is better)
      if (a.score !== b.score) return b.score - a.score;
      
      // Secondary: shorter text (more concise)
      if (a.snippet.text.length !== b.snippet.text.length) {
        return a.snippet.text.length - b.snippet.text.length;
      }
      
      // Tertiary: lexicographic ID (deterministic tie-breaking)
      return a.snippet.id.localeCompare(b.snippet.id);
    });
    
    const finalResults = validResults.slice(0, maxResults).map(r => r.snippet);
    
    const elapsedMs = Date.now() - startTime;
    console.log('factbook_query', {
      keywords: normalizedKeywords,
      results_count: finalResults.length,
      query_time_ms: elapsedMs,
      snippet_ids: finalResults.map(s => s.id)
    });
    
    if (elapsedMs > 10) {
      console.warn('factbook_query_slow', { elapsed_ms: elapsedMs, target_ms: 10 });
    }
    
    return finalResults;
  }
  
  private calculateScore(snippet: FactbookSnippet, keywords: string[]): number {
    let score = 0;
    
    // Check for topic fence violations first (-∞)
    if (this.isTopicFenceViolation(snippet, keywords)) {
      return -Infinity;
    }
    
    // +2: exact entity match (high-value keywords)
    const exactMatches = keywords.filter(keyword => 
      snippet.keywords.some(sk => this.normalizeToken(sk) === keyword)
    ).length;
    score += exactMatches * 2;
    
    // +1: topic match
    const topicMatches = keywords.filter(keyword =>
      snippet.topics.some(topic => this.normalizeToken(topic) === keyword)
    ).length;
    score += topicMatches * 1;
    
    // -0.4: snippet lacks entities (no proper nouns or names)
    const hasEntities = /\b[A-Z][a-z]+\b/.test(snippet.text) || 
                       /\b(austin|texas|trump|biden|america|maine|portland|dog|cat|pet|olive|romeo|tyler|krissy)\b/i.test(snippet.text);
    if (!hasEntities) {
      score -= 0.4;
    }
    
    return score;
  }
  
  private getMatchType(snippet: FactbookSnippet, keywords: string[]): QueryResult['matchType'] {
    // Check for exact entity matches
    const hasExactMatch = keywords.some(keyword => 
      snippet.keywords.some(sk => this.normalizeToken(sk) === keyword)
    );
    if (hasExactMatch) return 'exact_entity';
    
    // Check for topic matches
    const hasTopicMatch = keywords.some(keyword =>
      snippet.topics.some(topic => this.normalizeToken(topic) === keyword)
    );
    if (hasTopicMatch) return 'topic_match';
    
    // Check if snippet has entities
    const hasEntities = /\b[A-Z][a-z]+\b/.test(snippet.text);
    if (!hasEntities) return 'no_entities';
    
    return 'keyword_match';
  }
  
  private isTopicFenceViolation(snippet: FactbookSnippet, keywords: string[]): boolean {
    if (!this.index) return false;
    
    // Determine primary topic from keywords - prioritize by order of appearance in TOPIC_FENCES
    let primaryTopic: string | null = null;
    let primaryTopicPriority = -1;
    
    const topicPriorities = ['pets', 'politics', 'places', 'people', 'identity'];
    
    for (const keyword of keywords) {
      for (const [topic, allowedTopics] of this.index.topicFences.entries()) {
        if (allowedTopics.has(keyword)) {
          const priority = topicPriorities.indexOf(topic);
          if (priority !== -1 && (primaryTopicPriority === -1 || priority < primaryTopicPriority)) {
            primaryTopic = topic;
            primaryTopicPriority = priority;
          }
        }
      }
    }
    
    // If no primary topic detected, no violation
    if (!primaryTopic) return false;
    
    // Check if snippet violates the topic fence
    const allowedTopics = this.index.topicFences.get(primaryTopic);
    if (!allowedTopics) return false;
    
    return !snippet.topics.some(topic => allowedTopics.has(topic));
  }
  
  private applyTopicFencing(results: QueryResult[], keywords: string[]): QueryResult[] {
    // Topic fencing is now handled in scoring with -∞ penalty
    // This method can now just return all results since scoring handles fencing
    return results;
  }
  
  private normalizeToken(token: string): string {
    return token.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^\w]/g, ''); // Remove non-word characters
  }
  
  getSnippetsByTopic(topic: string): FactbookSnippet[] {
    if (!this.index) return [];
    
    const results: FactbookSnippet[] = [];
    for (const snippet of this.index.snippets.values()) {
      if (snippet.topics.includes(topic)) {
        results.push(snippet);
      }
    }
    
    return results;
  }
  
  getIndexStats(): { snippets: number; keywords: number; topics: number } {
    if (!this.index) return { snippets: 0, keywords: 0, topics: 0 };
    
    return {
      snippets: this.index.snippets.size,
      keywords: this.index.keywordMap.size,
      topics: this.index.topicFences.size
    };
  }
  
  /**
   * Health monitoring methods for dashboard
   */
  
  isLoaded(): boolean {
    return this.index !== null;
  }
  
  getSnippetCount(): number {
    return this.index?.snippets.size || 0;
  }
  
  getIndexSizeBytes(): number {
    if (!this.index) return 0;
    
    // Estimate index size in bytes
    let totalSize = 0;
    
    // Snippets map
    for (const snippet of this.index.snippets.values()) {
      totalSize += JSON.stringify(snippet).length * 2; // UTF-16 encoding
    }
    
    // Keyword map
    for (const [keyword, paths] of this.index.keywordMap.entries()) {
      totalSize += keyword.length * 2;
      totalSize += paths.join('').length * 2;
    }
    
    return totalSize;
  }
  
  validateIndex(): boolean {
    if (!this.index) return false;
    
    try {
      // Check if all snippets have required fields
      for (const snippet of this.index.snippets.values()) {
        if (!snippet.id || !snippet.path || !snippet.text || !Array.isArray(snippet.topics) || !Array.isArray(snippet.keywords)) {
          return false;
        }
        
        // Check text length constraint
        if (snippet.text.length > 400) {
          return false;
        }
      }
      
      // Check if keyword map is consistent with snippets
      for (const [keyword, paths] of this.index.keywordMap.entries()) {
        for (const path of paths) {
          if (!this.index.snippets.has(path)) {
            return false;
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('index_validation_error', error);
      return false;
    }
  }
  
  async rebuildIndex(): Promise<boolean> {
    try {
      if (!this.index) return false;
      
      // Get current factbook data by reconstructing from existing snippets
      // In a real implementation, this would reload from the JSON file
      const factbookData: any = {};
      
      for (const snippet of this.index.snippets.values()) {
        const pathParts = snippet.path.split('.');
        if (pathParts.length === 2) {
          const [section, item] = pathParts;
          
          if (!factbookData[section]) {
            factbookData[section] = {};
          }
          
          factbookData[section][item] = {
            id: snippet.id,
            text: snippet.text,
            topics: snippet.topics,
            keywords: snippet.keywords
          };
        }
      }
      
      // Rebuild index atomically
      const newIndex = this.buildIndex(factbookData);
      
      // Validate new index
      const oldIndex = this.index;
      this.index = newIndex;
      
      if (!this.validateIndex()) {
        // Rollback on validation failure
        this.index = oldIndex;
        return false;
      }
      
      console.log('factbook_index_rebuilt', {
        snippets_count: newIndex.snippets.size,
        keywords_count: newIndex.keywordMap.size
      });
      
      return true;
    } catch (error) {
      console.error('index_rebuild_error', error);
      return false;
    }
  }
}

export const factbookService = FactbookService.getInstance();