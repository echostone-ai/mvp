// src/lib/services/queryExpander.ts
// LLM-powered query expansion for low-confidence retrieval results

import OpenAI from 'openai';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { RetrievalResult } from './hybridRetrieval';

/**
 * Request for query expansion
 */
export interface ExpansionRequest {
  originalQuery: string;
  lowConfidenceResults: RetrievalResult[];
  context?: string;
}

/**
 * Response from query expansion with structured terms
 */
export interface ExpansionResponse {
  canonical_query: string;
  alternates: string[]; // ≤10 terms
  related_concepts: string[]; // ≤10 concepts
  confidence: number;
  cached: boolean;
  generatedAt: number;
}

/**
 * Configuration for query expansion
 */
export interface QueryExpansionConfig {
  model: string; // Default: 'gpt-4'
  maxAlternates: number; // Default: 10
  maxConcepts: number; // Default: 10
  timeoutMs: number; // Default: 200ms
  cacheDir: string; // Default: '.cache/query-expansion'
  enableCache: boolean; // Default: true
}

/**
 * Cache entry for persistent storage
 */
interface CacheEntry {
  query: string;
  response: ExpansionResponse;
  createdAt: number;
  accessCount: number;
  lastAccessed: number;
}

/**
 * Query expansion prompt template
 */
const EXPANSION_PROMPT = `You are a query expansion expert. Given a user query that returned few relevant results, generate semantically related terms that might help find relevant information.

Rules:
- Return JSON with canonical_query, alternates (≤10), related_concepts (≤10)
- Keep terms noun-heavy, lowercase, and tightly focused
- Do not paraphrase answers or create content
- Focus on synonyms, related terms, and concept variations
- Alternates should be direct synonyms or variations of the original query
- Related concepts should be broader concepts that might contain relevant information

Query: "{query}"

Response format:
{
  "canonical_query": "cleaned version of original query",
  "alternates": ["synonym1", "synonym2", ...],
  "related_concepts": ["concept1", "concept2", ...]
}`;

/**
 * QueryExpander class for LLM-powered semantic query expansion
 */
export class QueryExpander {
  private openai: OpenAI;
  private config: QueryExpansionConfig;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private cacheLoaded: boolean = false;

  constructor(config: Partial<QueryExpansionConfig> = {}) {
    this.config = {
      model: config.model || 'gpt-4',
      maxAlternates: config.maxAlternates || 10,
      maxConcepts: config.maxConcepts || 10,
      timeoutMs: config.timeoutMs || 200,
      cacheDir: config.cacheDir || '.cache/query-expansion',
      enableCache: config.enableCache !== false
    };

    // Initialize OpenAI client
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required for query expansion');
    }

    this.openai = new OpenAI({ apiKey });

    console.log('query_expander_initialized', {
      model: this.config.model,
      timeout_ms: this.config.timeoutMs,
      cache_enabled: this.config.enableCache,
      cache_dir: this.config.cacheDir
    });
  }

  /**
   * Expand a query using LLM with caching and timeout handling
   */
  async expandQuery(request: ExpansionRequest): Promise<ExpansionResponse> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(request.originalQuery);

    try {
      // Load cache if not already loaded
      if (this.config.enableCache && !this.cacheLoaded) {
        await this.loadCache();
      }

      // Check cache first
      if (this.config.enableCache) {
        const cached = this.memoryCache.get(cacheKey);
        if (cached && this.isCacheValid(cached)) {
          cached.accessCount++;
          cached.lastAccessed = Date.now();
          
          console.log('query_expansion_cache_hit', {
            query: request.originalQuery,
            cache_key: cacheKey,
            access_count: cached.accessCount
          });

          return {
            ...cached.response,
            cached: true
          };
        }
      }

      // Perform LLM expansion with timeout
      const expansionResponse = await this.performExpansion(request);
      
      // Cache the result
      if (this.config.enableCache) {
        await this.cacheResult(cacheKey, request.originalQuery, expansionResponse);
      }

      const elapsedMs = Date.now() - startTime;
      console.log('query_expansion_complete', {
        query: request.originalQuery,
        alternates_count: expansionResponse.alternates.length,
        concepts_count: expansionResponse.related_concepts.length,
        time_ms: elapsedMs,
        cached: false
      });

      return {
        ...expansionResponse,
        cached: false
      };

    } catch (error) {
      const elapsedMs = Date.now() - startTime;
      console.error('query_expansion_error', {
        query: request.originalQuery,
        error: error instanceof Error ? error.message : error,
        time_ms: elapsedMs
      });

      // Return fallback response
      return this.createFallbackResponse(request.originalQuery);
    }
  }

  /**
   * Perform the actual LLM expansion with timeout
   */
  private async performExpansion(request: ExpansionRequest): Promise<ExpansionResponse> {
    const prompt = EXPANSION_PROMPT.replace('{query}', request.originalQuery);

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Query expansion timeout')), this.config.timeoutMs);
    });

    // Create LLM call promise
    const llmPromise = this.openai.chat.completions.create({
      model: this.config.model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 300,
      response_format: { type: 'json_object' }
    });

    // Race between LLM call and timeout
    const completion = await Promise.race([llmPromise, timeoutPromise]);
    const responseText = completion.choices[0]?.message?.content;

    if (!responseText) {
      throw new Error('Empty response from LLM');
    }

    // Parse and validate response
    const parsedResponse = JSON.parse(responseText);
    return this.validateAndCleanResponse(parsedResponse, request.originalQuery);
  }

  /**
   * Validate and clean the LLM response
   */
  private validateAndCleanResponse(response: any, originalQuery: string): ExpansionResponse {
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response format');
    }

    const canonical_query = typeof response.canonical_query === 'string' 
      ? response.canonical_query.toLowerCase().trim()
      : originalQuery.toLowerCase().trim();

    const alternates = Array.isArray(response.alternates)
      ? response.alternates
          .filter((alt: any) => typeof alt === 'string' && alt.trim().length > 0)
          .map((alt: string) => alt.toLowerCase().trim())
          .slice(0, this.config.maxAlternates)
      : [];

    const related_concepts = Array.isArray(response.related_concepts)
      ? response.related_concepts
          .filter((concept: any) => typeof concept === 'string' && concept.trim().length > 0)
          .map((concept: string) => concept.toLowerCase().trim())
          .slice(0, this.config.maxConcepts)
      : [];

    // Remove duplicates and empty strings
    const uniqueAlternates = [...new Set(alternates)].filter(alt => alt !== canonical_query);
    const uniqueConcepts = [...new Set(related_concepts)].filter(concept => 
      concept !== canonical_query && !uniqueAlternates.includes(concept)
    );

    return {
      canonical_query,
      alternates: uniqueAlternates,
      related_concepts: uniqueConcepts,
      confidence: this.calculateExpansionConfidence(uniqueAlternates, uniqueConcepts),
      cached: false,
      generatedAt: Date.now()
    };
  }

  /**
   * Calculate confidence score for expansion quality
   */
  private calculateExpansionConfidence(alternates: string[], concepts: string[]): number {
    // Base confidence on number and quality of expansions
    const alternateScore = Math.min(alternates.length * 0.1, 0.5);
    const conceptScore = Math.min(concepts.length * 0.05, 0.3);
    const baseScore = 0.2; // Minimum confidence for any expansion
    
    return Math.min(baseScore + alternateScore + conceptScore, 1.0);
  }

  /**
   * Create fallback response when expansion fails
   */
  private createFallbackResponse(originalQuery: string): ExpansionResponse {
    return {
      canonical_query: originalQuery.toLowerCase().trim(),
      alternates: [],
      related_concepts: [],
      confidence: 0.1,
      cached: false,
      generatedAt: Date.now()
    };
  }

  /**
   * Generate cache key from query
   */
  private getCacheKey(query: string): string {
    const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ');
    return createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(entry: CacheEntry): boolean {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    return (Date.now() - entry.createdAt) < maxAge;
  }

  /**
   * Load cache from disk
   */
  private async loadCache(): Promise<void> {
    try {
      const cacheFile = path.join(this.config.cacheDir, 'expansions.json');
      const cacheData = await fs.readFile(cacheFile, 'utf-8');
      const entries: CacheEntry[] = JSON.parse(cacheData);

      // Load valid entries into memory cache
      let validCount = 0;
      for (const entry of entries) {
        if (this.isCacheValid(entry)) {
          const cacheKey = this.getCacheKey(entry.query);
          this.memoryCache.set(cacheKey, entry);
          validCount++;
        }
      }

      this.cacheLoaded = true;
      console.log('query_expansion_cache_loaded', {
        total_entries: entries.length,
        valid_entries: validCount,
        cache_file: cacheFile
      });

    } catch (error) {
      // Cache file doesn't exist or is invalid - start fresh
      this.cacheLoaded = true;
      console.log('query_expansion_cache_init', {
        reason: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Save cache result to memory and disk
   */
  private async cacheResult(cacheKey: string, query: string, response: ExpansionResponse): Promise<void> {
    const entry: CacheEntry = {
      query,
      response,
      createdAt: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now()
    };

    // Add to memory cache
    this.memoryCache.set(cacheKey, entry);

    // Save to disk (async, don't wait)
    this.saveCacheToDisk().catch(error => {
      console.warn('query_expansion_cache_save_error', {
        error: error instanceof Error ? error.message : error
      });
    });
  }

  /**
   * Save entire cache to disk
   */
  private async saveCacheToDisk(): Promise<void> {
    try {
      // Ensure cache directory exists
      await fs.mkdir(this.config.cacheDir, { recursive: true });

      // Convert memory cache to array
      const entries: CacheEntry[] = Array.from(this.memoryCache.values())
        .filter(entry => this.isCacheValid(entry))
        .sort((a, b) => b.lastAccessed - a.lastAccessed)
        .slice(0, 1000); // Keep only top 1000 entries

      const cacheFile = path.join(this.config.cacheDir, 'expansions.json');
      await fs.writeFile(cacheFile, JSON.stringify(entries, null, 2));

      console.log('query_expansion_cache_saved', {
        entries_count: entries.length,
        cache_file: cacheFile
      });

    } catch (error) {
      console.error('query_expansion_cache_save_error', {
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    oldestEntry: number;
    newestEntry: number;
  } {
    const entries = Array.from(this.memoryCache.values());
    const totalAccesses = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
    const cacheHits = entries.reduce((sum, entry) => sum + (entry.accessCount - 1), 0);

    return {
      size: entries.length,
      hitRate: totalAccesses > 0 ? cacheHits / totalAccesses : 0,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.createdAt)) : 0,
      newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.createdAt)) : 0
    };
  }

  /**
   * Clear cache (for testing)
   */
  async clearCache(): Promise<void> {
    this.memoryCache.clear();
    
    try {
      const cacheFile = path.join(this.config.cacheDir, 'expansions.json');
      await fs.unlink(cacheFile);
    } catch (error) {
      // File doesn't exist - that's fine
    }

    console.log('query_expansion_cache_cleared');
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<QueryExpansionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('query_expansion_config_updated', { new_config: newConfig });
  }
}