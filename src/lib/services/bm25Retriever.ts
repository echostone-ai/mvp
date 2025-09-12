// src/lib/services/bm25Retriever.ts
// BM25 text retrieval component with proper scoring algorithm

import { FactbookService, FactbookSnippet } from './factbookService';

/**
 * Configuration for BM25 retrieval
 */
export interface BM25Config {
  k1: number; // Term frequency saturation parameter (default: 1.2)
  b: number;  // Length normalization parameter (default: 0.75)
  maxResults: number; // Maximum results to return (default: 20)
}

/**
 * Result from BM25 search with scoring details
 */
export interface BM25Result {
  snippet: FactbookSnippet;
  score: number;
  termMatches: string[];
}

/**
 * BM25 index structure for efficient retrieval
 */
export interface BM25Index {
  termFreq: Map<string, Map<string, number>>; // term -> docId -> frequency
  docFreq: Map<string, number>; // term -> document frequency
  docLengths: Map<string, number>; // docId -> document length
  avgDocLength: number;
  totalDocs: number;
}

/**
 * BM25 retrieval component that implements proper BM25 scoring algorithm
 * Wraps existing FactbookService with enhanced scoring capabilities
 */
export class BM25Retriever {
  private factbookService: FactbookService;
  private config: BM25Config;
  private index: BM25Index | null = null;
  private isIndexBuilt = false;

  constructor(factbookService: FactbookService, config: BM25Config) {
    this.factbookService = factbookService;
    this.config = config;
  }

  /**
   * Build BM25 index from factbook snippets
   * Creates term frequency and document frequency maps for efficient scoring
   */
  async buildIndex(): Promise<void> {
    const startTime = Date.now();

    if (!this.factbookService.isLoaded()) {
      throw new Error('FactbookService not loaded - cannot build BM25 index');
    }

    const snippets = this.factbookService.getAllSnippets();
    if (snippets.length === 0) {
      throw new Error('No snippets available for BM25 indexing');
    }

    // Initialize index structures
    const termFreq = new Map<string, Map<string, number>>();
    const docFreq = new Map<string, number>();
    const docLengths = new Map<string, number>();
    let totalDocLength = 0;

    console.log('bm25_index_build_start', {
      snippet_count: snippets.length,
      config: this.config
    });

    // Process each snippet to build term frequency maps
    for (const snippet of snippets) {
      const docId = snippet.id;
      const terms = this.extractTerms(snippet);
      const termCounts = new Map<string, number>();

      // Count term frequencies in this document
      for (const term of terms) {
        termCounts.set(term, (termCounts.get(term) || 0) + 1);
      }

      // Store document length
      docLengths.set(docId, terms.length);
      totalDocLength += terms.length;

      // Update term frequency index
      for (const [term, count] of termCounts.entries()) {
        if (!termFreq.has(term)) {
          termFreq.set(term, new Map());
        }
        termFreq.get(term)!.set(docId, count);

        // Update document frequency
        docFreq.set(term, (docFreq.get(term) || 0) + 1);
      }
    }

    // Calculate average document length
    const avgDocLength = totalDocLength / snippets.length;

    // Create index
    this.index = {
      termFreq,
      docFreq,
      docLengths,
      avgDocLength,
      totalDocs: snippets.length
    };

    this.isIndexBuilt = true;

    const elapsedMs = Date.now() - startTime;
    console.log('bm25_index_build_complete', {
      snippet_count: snippets.length,
      unique_terms: termFreq.size,
      avg_doc_length: avgDocLength.toFixed(2),
      build_time_ms: elapsedMs
    });

    if (elapsedMs > 100) {
      console.warn('bm25_index_build_slow', {
        elapsed_ms: elapsedMs,
        target_ms: 100
      });
    }
  }

  /**
   * Search using BM25 scoring algorithm
   * Returns ranked results with BM25 scores and term match information
   */
  search(query: string, maxResults?: number): BM25Result[] {
    const startTime = Date.now();
    const resultLimit = maxResults || this.config.maxResults;

    if (!this.index) {
      throw new Error('BM25 index not built - call buildIndex() first');
    }

    if (!query.trim()) {
      return [];
    }

    const queryTerms = this.extractQueryTerms(query);
    if (queryTerms.length === 0) {
      return [];
    }

    console.log('bm25_search_start', {
      query,
      query_terms: queryTerms,
      max_results: resultLimit
    });

    // Calculate BM25 scores for all documents
    const scores = new Map<string, { score: number; termMatches: string[] }>();
    const snippets = this.factbookService.getAllSnippets();

    for (const snippet of snippets) {
      const docId = snippet.id;
      let totalScore = 0;
      const termMatches: string[] = [];

      for (const term of queryTerms) {
        const score = this.calculateBM25Score(term, docId);
        if (score > 0) {
          totalScore += score;
          termMatches.push(term);
        }
      }

      if (totalScore > 0) {
        scores.set(docId, { score: totalScore, termMatches });
      }
    }

    // Convert to results and sort by score
    const results: BM25Result[] = [];
    for (const snippet of snippets) {
      const scoreData = scores.get(snippet.id);
      if (scoreData) {
        results.push({
          snippet,
          score: scoreData.score,
          termMatches: scoreData.termMatches
        });
      }
    }

    // Sort by score (descending) with deterministic tie-breaking
    results.sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      // Tie-breaking: prefer shorter text, then lexicographic ID
      if (a.snippet.text.length !== b.snippet.text.length) {
        return a.snippet.text.length - b.snippet.text.length;
      }
      return a.snippet.id.localeCompare(b.snippet.id);
    });

    // Limit results
    const finalResults = results.slice(0, resultLimit);

    const elapsedMs = Date.now() - startTime;
    console.log('bm25_search_complete', {
      query,
      query_terms: queryTerms,
      result_count: finalResults.length,
      top_scores: finalResults.slice(0, 3).map(r => ({
        id: r.snippet.id,
        score: r.score.toFixed(3),
        term_matches: r.termMatches
      })),
      search_time_ms: elapsedMs
    });

    if (elapsedMs > 50) {
      console.warn('bm25_search_slow', {
        elapsed_ms: elapsedMs,
        target_ms: 50,
        query_terms: queryTerms.length,
        total_docs: this.index.totalDocs
      });
    }

    return finalResults;
  }

  /**
   * Calculate BM25 score for a specific term in a document
   * Uses standard BM25 formula: IDF * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * |d| / avgdl))
   */
  private calculateBM25Score(term: string, docId: string): number {
    if (!this.index) {
      return 0;
    }

    // Get term frequency in document
    const tf = this.index.termFreq.get(term)?.get(docId) || 0;
    if (tf === 0) {
      return 0;
    }

    // Get document frequency for IDF calculation
    const df = this.index.docFreq.get(term) || 0;
    if (df === 0) {
      return 0;
    }

    // Get document length
    const docLength = this.index.docLengths.get(docId) || 0;
    if (docLength === 0) {
      return 0;
    }

    // Calculate IDF: log((N - df + 0.5) / (df + 0.5))
    const N = this.index.totalDocs;
    const idf = Math.log((N - df + 0.5) / (df + 0.5));

    // Calculate BM25 score
    const k1 = this.config.k1;
    const b = this.config.b;
    const avgdl = this.index.avgDocLength;

    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + b * (docLength / avgdl));

    const score = idf * (numerator / denominator);

    return Math.max(0, score); // Ensure non-negative scores
  }

  /**
   * Extract terms from a snippet for indexing
   * Combines text, topics, and keywords with appropriate weighting
   */
  private extractTerms(snippet: FactbookSnippet): string[] {
    const terms: string[] = [];

    // Extract terms from text (weight: 1x)
    const textTerms = this.tokenizeText(snippet.text);
    terms.push(...textTerms);

    // Extract terms from keywords (weight: 2x for importance)
    for (const keyword of snippet.keywords) {
      const keywordTerms = this.tokenizeText(keyword);
      terms.push(...keywordTerms, ...keywordTerms); // Add twice for 2x weight
    }

    // Extract terms from topics (weight: 1.5x for importance)
    for (const topic of snippet.topics) {
      const topicTerms = this.tokenizeText(topic);
      terms.push(...topicTerms);
      // Add half again for 1.5x weight
      for (let i = 0; i < topicTerms.length; i += 2) {
        if (topicTerms[i]) {
          terms.push(topicTerms[i]);
        }
      }
    }

    return terms;
  }

  /**
   * Extract query terms with normalization
   */
  private extractQueryTerms(query: string): string[] {
    return this.tokenizeText(query);
  }

  /**
   * Tokenize text into normalized terms
   * Handles normalization, filtering, and stemming
   */
  private tokenizeText(text: string): string[] {
    if (!text) {
      return [];
    }

    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^\w\s]/g, ' ') // Replace non-word chars with spaces
      .split(/\s+/)
      .filter(term => term.length > 2) // Filter short terms
      .filter(term => !this.isStopWord(term)) // Filter stop words
      .slice(0, 20); // Limit to 20 terms to prevent excessive processing
  }

  /**
   * Check if a term is a stop word
   */
  private isStopWord(term: string): boolean {
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before',
      'after', 'above', 'below', 'between', 'among', 'within', 'without',
      'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be',
      'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall'
    ]);

    return stopWords.has(term);
  }

  /**
   * Get index statistics for monitoring
   */
  getIndexStats(): {
    isBuilt: boolean;
    totalDocs: number;
    uniqueTerms: number;
    avgDocLength: number;
  } {
    return {
      isBuilt: this.isIndexBuilt,
      totalDocs: this.index?.totalDocs || 0,
      uniqueTerms: this.index?.termFreq.size || 0,
      avgDocLength: this.index?.avgDocLength || 0
    };
  }

  /**
   * Check if index is built and ready
   */
  isReady(): boolean {
    return this.isIndexBuilt && this.index !== null;
  }

  /**
   * Get configuration for debugging
   */
  getConfig(): BM25Config {
    return { ...this.config };
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(newConfig: Partial<BM25Config>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('bm25_config_updated', {
      new_config: newConfig,
      full_config: this.config
    });
  }
}