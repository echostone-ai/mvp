// src/lib/services/resultReranker.ts
// LLM-powered result reranking for relevance optimization

import OpenAI from 'openai';
import { RetrievalResult } from './hybridRetrieval';

/**
 * Configuration for result reranking
 */
export interface RerankConfig {
  model: 'gpt-3.5-turbo' | 'gpt-4' | 'gpt-4-turbo';
  maxCandidates: number;        // Default: 10 - limit candidates to bound cost
  timeoutMs: number;            // Default: 150 - timeout for reranking
  enableCache: boolean;         // Default: true - cache reranking results
  temperature: number;          // Default: 0.1 - low temperature for consistency
}

/**
 * Request for reranking candidates
 */
export interface RerankRequest {
  query: string;
  candidates: RetrievalResult[];
  maxResults: number;
}

/**
 * Response from LLM reranking with relevance scores
 */
export interface RerankResponse {
  id: string;
  relevanceScore: number; // 0-1 relevance score from LLM
}

/**
 * Cached reranking result
 */
interface CachedRerankResult {
  query: string;
  candidateIds: string[];
  responses: RerankResponse[];
  timestamp: number;
  model: string;
}

/**
 * Statistics for monitoring reranking performance
 */
export interface RerankStats {
  totalRequests: number;
  cacheHits: number;
  cacheHitRate: number;
  averageLatencyMs: number;
  timeouts: number;
  errors: number;
}

/**
 * LLM-powered result reranker for final relevance optimization
 * Uses GPT-3.5-turbo to score candidate snippets for relevance to query
 */
export class ResultReranker {
  private openai: OpenAI;
  private config: RerankConfig;
  private cache: Map<string, CachedRerankResult> = new Map();
  private stats: RerankStats = {
    totalRequests: 0,
    cacheHits: 0,
    cacheHitRate: 0,
    averageLatencyMs: 0,
    timeouts: 0,
    errors: 0
  };
  private latencies: number[] = [];
  private lastOperationSuccessful: boolean = true;

  constructor(config: Partial<RerankConfig> = {}) {
    // Validate OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required for result reranking');
    }

    this.openai = new OpenAI({ apiKey });
    
    // Set default configuration
    this.config = {
      model: 'gpt-3.5-turbo',
      maxCandidates: 10,
      timeoutMs: 150,
      enableCache: true,
      temperature: 0.1,
      ...config
    };

    console.log('result_reranker_initialized', {
      model: this.config.model,
      max_candidates: this.config.maxCandidates,
      timeout_ms: this.config.timeoutMs,
      cache_enabled: this.config.enableCache
    });
  }

  /**
   * Rerank candidates using LLM relevance scoring
   * Limits to top maxCandidates to bound cost and latency
   */
  async rerank(request: RerankRequest): Promise<RetrievalResult[]> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      // Limit candidates to maxCandidates to bound cost
      const candidates = request.candidates.slice(0, this.config.maxCandidates);
      
      if (candidates.length === 0) {
        console.warn('rerank_no_candidates', { query: request.query });
        return [];
      }

      console.log('rerank_start', {
        query: request.query,
        candidate_count: candidates.length,
        max_results: request.maxResults
      });

      // Check cache first
      let rerankResponses: RerankResponse[];
      if (this.config.enableCache) {
        const cached = this.getCachedResult(request.query, candidates);
        if (cached) {
          rerankResponses = cached.responses;
          this.stats.cacheHits++;
          console.log('rerank_cache_hit', { 
            query: request.query,
            cached_count: rerankResponses.length 
          });
        } else {
          rerankResponses = await this.performLLMReranking(request.query, candidates);
          this.cacheResult(request.query, candidates, rerankResponses);
        }
      } else {
        rerankResponses = await this.performLLMReranking(request.query, candidates);
      }

      // Apply reranking scores to candidates
      const rerankedResults = this.applyRerankingScores(candidates, rerankResponses);
      
      // Sort by relevance score and limit to maxResults
      const finalResults = rerankedResults
        .sort((a, b) => b.score - a.score)
        .slice(0, request.maxResults);

      const latency = Date.now() - startTime;
      this.updateStats(latency);

      console.log('rerank_complete', {
        query: request.query,
        original_count: candidates.length,
        reranked_count: finalResults.length,
        latency_ms: latency,
        top_scores: finalResults.slice(0, 3).map(r => ({
          id: r.snippet.id,
          original_score: candidates.find(c => c.snippet.id === r.snippet.id)?.score.toFixed(3),
          rerank_score: r.score.toFixed(3)
        }))
      });

      this.lastOperationSuccessful = true;
      return finalResults;

    } catch (error) {
      const latency = Date.now() - startTime;
      this.stats.errors++;
      this.updateStats(latency);

      console.error('rerank_error', {
        query: request.query,
        error: error instanceof Error ? error.message : error,
        latency_ms: latency
      });

      // Fallback to original fusion scores on error
      console.warn('rerank_fallback_to_fusion_scores', { 
        query: request.query,
        candidate_count: request.candidates.length 
      });
      
      this.lastOperationSuccessful = false;
      return request.candidates.slice(0, request.maxResults);
    }
  }

  /**
   * Perform LLM reranking with timeout handling
   */
  private async performLLMReranking(query: string, candidates: RetrievalResult[]): Promise<RerankResponse[]> {
    const prompt = this.buildRerankPrompt(query, candidates);
    
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Reranking timeout')), this.config.timeoutMs);
      });

      // Race between LLM call and timeout
      const completion = await Promise.race([
        this.openai.chat.completions.create({
          model: this.config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: this.config.temperature,
          max_tokens: 500, // Limit tokens for cost control
        }),
        timeoutPromise
      ]);

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('Empty response from LLM');
      }

      return this.parseRerankResponse(response, candidates);

    } catch (error) {
      if (error instanceof Error && error.message === 'Reranking timeout') {
        this.stats.timeouts++;
        console.warn('rerank_timeout', { 
          query, 
          timeout_ms: this.config.timeoutMs 
        });
      }
      throw error;
    }
  }

  /**
   * Build reranking prompt that presents query and candidate snippets
   */
  private buildRerankPrompt(query: string, candidates: RetrievalResult[]): string {
    const snippetsText = candidates.map((candidate, index) => 
      `${index + 1}. ID: ${candidate.snippet.id}\n   Text: ${candidate.snippet.text.substring(0, 200)}${candidate.snippet.text.length > 200 ? '...' : ''}`
    ).join('\n\n');

    return `Rate the relevance of each text snippet to the user query on a scale of 0-1, where:
- 1.0 = Perfectly relevant and directly answers the query
- 0.8 = Highly relevant with good information
- 0.6 = Moderately relevant with some useful information  
- 0.4 = Somewhat relevant but not very helpful
- 0.2 = Barely relevant with little useful information
- 0.0 = Not relevant at all

Query: "${query}"

Text Snippets:
${snippetsText}

Return ONLY a JSON array with id and relevanceScore for each snippet. Do not include any other text.

Example format:
[
  {"id": "snippet1", "relevanceScore": 0.85},
  {"id": "snippet2", "relevanceScore": 0.72}
]`;
  }

  /**
   * Parse LLM response and validate reranking scores
   */
  private parseRerankResponse(response: string, candidates: RetrievalResult[]): RerankResponse[] {
    try {
      // Clean response - remove any markdown formatting
      const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      
      const parsed = JSON.parse(cleanResponse);
      
      if (!Array.isArray(parsed)) {
        throw new Error('Response is not an array');
      }

      const rerankResponses: RerankResponse[] = [];
      const candidateIds = new Set(candidates.map(c => c.snippet.id));

      for (const item of parsed) {
        if (!item.id || typeof item.relevanceScore !== 'number') {
          console.warn('rerank_invalid_item', { item });
          continue;
        }

        // Validate ID exists in candidates
        if (!candidateIds.has(item.id)) {
          console.warn('rerank_unknown_id', { id: item.id });
          continue;
        }

        // Clamp relevance score to 0-1 range
        const relevanceScore = Math.max(0, Math.min(1, item.relevanceScore));
        
        rerankResponses.push({
          id: item.id,
          relevanceScore
        });
      }

      // Ensure we have scores for all candidates (fallback to 0.5 for missing)
      for (const candidate of candidates) {
        if (!rerankResponses.find(r => r.id === candidate.snippet.id)) {
          console.warn('rerank_missing_score', { 
            id: candidate.snippet.id,
            fallback_score: 0.5 
          });
          rerankResponses.push({
            id: candidate.snippet.id,
            relevanceScore: 0.5
          });
        }
      }

      console.log('rerank_parse_success', {
        response_length: response.length,
        parsed_count: rerankResponses.length,
        candidate_count: candidates.length,
        score_range: {
          min: Math.min(...rerankResponses.map(r => r.relevanceScore)).toFixed(2),
          max: Math.max(...rerankResponses.map(r => r.relevanceScore)).toFixed(2)
        }
      });

      return rerankResponses;

    } catch (error) {
      console.error('rerank_parse_error', {
        error: error instanceof Error ? error.message : error,
        response_preview: response.substring(0, 200)
      });

      // Fallback: return neutral scores for all candidates
      return candidates.map(candidate => ({
        id: candidate.snippet.id,
        relevanceScore: 0.5
      }));
    }
  }

  /**
   * Apply reranking scores to candidates, preserving original metadata
   */
  private applyRerankingScores(candidates: RetrievalResult[], rerankResponses: RerankResponse[]): RetrievalResult[] {
    const scoreMap = new Map(rerankResponses.map(r => [r.id, r.relevanceScore]));

    return candidates.map(candidate => {
      const rerankScore = scoreMap.has(candidate.snippet.id) 
        ? scoreMap.get(candidate.snippet.id)! 
        : 0.5;
      
      return {
        ...candidate,
        score: rerankScore, // Replace fusion score with rerank score
        metadata: {
          ...candidate.metadata,
          originalScore: candidate.score, // Preserve original fusion score
          rerankScore: rerankScore
        }
      };
    });
  }

  /**
   * Get cached reranking result if available and valid
   */
  private getCachedResult(query: string, candidates: RetrievalResult[]): CachedRerankResult | null {
    const cacheKey = this.getCacheKey(query, candidates);
    const cached = this.cache.get(cacheKey);

    if (!cached) {
      return null;
    }

    // Check if cache is still valid (1 hour TTL)
    const maxAge = 60 * 60 * 1000; // 1 hour
    if (Date.now() - cached.timestamp > maxAge) {
      this.cache.delete(cacheKey);
      return null;
    }

    // Verify candidate IDs match (same candidates)
    const currentIds = candidates.map(c => c.snippet.id).sort();
    const cachedIds = [...cached.candidateIds].sort();
    
    if (currentIds.length !== cachedIds.length || 
        !currentIds.every((id, index) => id === cachedIds[index])) {
      return null;
    }

    return cached;
  }

  /**
   * Cache reranking result for future use
   */
  private cacheResult(query: string, candidates: RetrievalResult[], responses: RerankResponse[]): void {
    if (!this.config.enableCache) {
      return;
    }

    const cacheKey = this.getCacheKey(query, candidates);
    const cached: CachedRerankResult = {
      query,
      candidateIds: candidates.map(c => c.snippet.id),
      responses,
      timestamp: Date.now(),
      model: this.config.model
    };

    this.cache.set(cacheKey, cached);

    // Limit cache size to prevent memory issues
    if (this.cache.size > 1000) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Generate cache key from query and candidate IDs
   */
  private getCacheKey(query: string, candidates: RetrievalResult[]): string {
    const candidateIds = candidates.map(c => c.snippet.id).sort().join(',');
    return `${query.toLowerCase().trim()}|${candidateIds}`;
  }

  /**
   * Update performance statistics
   */
  private updateStats(latencyMs: number): void {
    this.latencies.push(latencyMs);
    
    // Keep only last 100 latencies for rolling average
    if (this.latencies.length > 100) {
      this.latencies.shift();
    }

    this.stats.averageLatencyMs = this.latencies.reduce((sum, lat) => sum + lat, 0) / this.latencies.length;
    this.stats.cacheHitRate = this.stats.totalRequests > 0 ? this.stats.cacheHits / this.stats.totalRequests : 0;
  }

  /**
   * Get reranking statistics for monitoring
   */
  getStats(): RerankStats {
    return { ...this.stats };
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: this.stats.cacheHitRate
    };
  }

  /**
   * Clear cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.cache.clear();
    console.log('rerank_cache_cleared');
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(newConfig: Partial<RerankConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('rerank_config_updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  getConfig(): RerankConfig {
    return { ...this.config };
  }

  /**
   * Check if the last reranking operation was successful
   */
  wasLastOperationSuccessful(): boolean {
    return this.lastOperationSuccessful;
  }
}