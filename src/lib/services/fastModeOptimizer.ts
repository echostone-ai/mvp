/**
 * Fast Mode Optimizer
 * 
 * Provides sub-200ms response optimization through advanced caching,
 * parallel data retrieval, and selective loading strategies.
 */

import { ContextRetrievalEngine, QuickFact, MemoryFragment, ConversationTurn, RetrievalOptions } from './contextRetrievalEngine';

export interface FastModeCache {
  quickFacts: Map<string, { data: QuickFact[]; expiry: number }>;
  memoryFragments: Map<string, { data: MemoryFragment[]; expiry: number }>;
  conversationHistory: Map<string, { data: ConversationTurn[]; expiry: number }>;
  queryAnalysis: Map<string, { analysis: QueryAnalysis; expiry: number }>;
}

export interface QueryAnalysis {
  isSimple: boolean;
  requiresMemoryFragments: boolean;
  requiresFullHistory: boolean;
  estimatedComplexity: 'low' | 'medium' | 'high';
  keyEntities: string[];
  suggestedCacheStrategy: 'aggressive' | 'moderate' | 'minimal';
}

export interface FastModeOptions extends RetrievalOptions {
  maxResponseTimeMs?: number;
  aggressiveCaching?: boolean;
  skipMemoryForSimpleQueries?: boolean;
  parallelismLevel?: 'low' | 'medium' | 'high';
}

export interface FastModeResult {
  success: boolean;
  responseTimeMs: number;
  cacheHitRate: number;
  optimizationsApplied: string[];
  fallbackUsed: boolean;
}

/**
 * Fast Mode Optimizer
 * 
 * Enhances the context retrieval engine with aggressive optimization
 * strategies for sub-200ms response times.
 */
export class FastModeOptimizer {
  private contextEngine: ContextRetrievalEngine;
  private cache: FastModeCache;
  private readonly QUICK_FACTS_TTL = 30 * 1000; // 30 seconds
  private readonly MEMORY_FRAGMENTS_TTL = 60 * 1000; // 1 minute
  private readonly CONVERSATION_HISTORY_TTL = 10 * 1000; // 10 seconds
  private readonly QUERY_ANALYSIS_TTL = 300 * 1000; // 5 minutes
  private readonly TARGET_RESPONSE_TIME = 200; // milliseconds

  constructor(contextEngine: ContextRetrievalEngine) {
    this.contextEngine = contextEngine;
    this.cache = {
      quickFacts: new Map(),
      memoryFragments: new Map(),
      conversationHistory: new Map(),
      queryAnalysis: new Map()
    };
  }

  /**
   * Retrieve context with fast-mode optimizations
   */
  async retrieveContextFast(
    avatarId: string,
    query: string,
    options: FastModeOptions = {}
  ): Promise<{ context: any; metadata: FastModeResult }> {
    const startTime = Date.now();
    const {
      maxResponseTimeMs = this.TARGET_RESPONSE_TIME,
      aggressiveCaching = true,
      skipMemoryForSimpleQueries = true,
      parallelismLevel = 'high'
    } = options;

    try {
      // Step 1: Analyze query for optimization strategy
      const queryAnalysis = await this.analyzeQuery(query);
      
      // Step 2: Determine optimization strategy
      const optimizationStrategy = this.determineOptimizationStrategy(
        queryAnalysis,
        options,
        maxResponseTimeMs
      );

      // Step 3: Execute optimized retrieval
      const context = await this.executeOptimizedRetrieval(
        avatarId,
        query,
        queryAnalysis,
        optimizationStrategy
      );

      const responseTimeMs = Date.now() - startTime;
      const cacheHitRate = this.calculateCacheHitRate(avatarId);

      const metadata: FastModeResult = {
        success: responseTimeMs <= maxResponseTimeMs,
        responseTimeMs,
        cacheHitRate,
        optimizationsApplied: optimizationStrategy.optimizations,
        fallbackUsed: false
      };

      return { context, metadata };

    } catch (error) {
      console.error('Fast mode retrieval failed:', error);
      
      // Fallback to basic retrieval
      const fallbackContext = await this.contextEngine.retrieveContext(
        avatarId,
        query,
        { fastMode: true, memoryLimit: 5, historyLimit: 3 }
      );

      const responseTimeMs = Date.now() - startTime;

      return {
        context: fallbackContext,
        metadata: {
          success: false,
          responseTimeMs,
          cacheHitRate: 0,
          optimizationsApplied: ['fallback'],
          fallbackUsed: true
        }
      };
    }
  }

  /**
   * Analyze query to determine optimization strategy
   */
  private async analyzeQuery(query: string): Promise<QueryAnalysis> {
    const cacheKey = `query_analysis:${this.hashQuery(query)}`;
    const cached = this.getFromCache(this.cache.queryAnalysis, cacheKey);
    
    if (cached) {
      return cached;
    }

    const queryLower = query.toLowerCase();
    const queryLength = query.length;
    
    // Simple heuristics for query analysis
    const isSimple = queryLength < 50 && 
      !queryLower.includes('remember') && 
      !queryLower.includes('tell me about') &&
      !queryLower.includes('what did') &&
      !queryLower.includes('when did');

    const requiresMemoryFragments = 
      queryLower.includes('remember') ||
      queryLower.includes('story') ||
      queryLower.includes('experience') ||
      queryLower.includes('time when') ||
      queryLower.includes('tell me about');

    const requiresFullHistory = 
      queryLower.includes('we talked about') ||
      queryLower.includes('earlier') ||
      queryLower.includes('before') ||
      queryLower.includes('conversation');

    // Extract key entities (simple keyword extraction)
    const keyEntities = this.extractKeyEntities(query);

    const estimatedComplexity: 'low' | 'medium' | 'high' = 
      isSimple ? 'low' :
      requiresMemoryFragments || requiresFullHistory ? 'high' :
      'medium';

    const suggestedCacheStrategy: 'aggressive' | 'moderate' | 'minimal' =
      estimatedComplexity === 'low' ? 'aggressive' :
      estimatedComplexity === 'medium' ? 'moderate' :
      'minimal';

    const analysis: QueryAnalysis = {
      isSimple,
      requiresMemoryFragments,
      requiresFullHistory,
      estimatedComplexity,
      keyEntities,
      suggestedCacheStrategy
    };

    this.setCache(this.cache.queryAnalysis, cacheKey, analysis, this.QUERY_ANALYSIS_TTL);
    return analysis;
  }

  /**
   * Determine optimization strategy based on query analysis
   */
  private determineOptimizationStrategy(
    analysis: QueryAnalysis,
    options: FastModeOptions,
    maxResponseTimeMs: number
  ): {
    useCache: boolean;
    skipMemoryFragments: boolean;
    limitQuickFacts: number;
    limitMemoryFragments: number;
    limitHistory: number;
    parallelQueries: boolean;
    optimizations: string[];
  } {
    const optimizations: string[] = [];
    
    // Base strategy
    let useCache = true;
    let skipMemoryFragments = false;
    let limitQuickFacts = 20;
    let limitMemoryFragments = 10;
    let limitHistory = 5;
    let parallelQueries = true;

    // Adjust based on query complexity
    if (analysis.isSimple) {
      skipMemoryFragments = options.skipMemoryForSimpleQueries ?? true;
      limitQuickFacts = 10;
      limitHistory = 3;
      optimizations.push('simple_query_optimization');
    }

    // Adjust based on time constraints
    if (maxResponseTimeMs <= 150) {
      skipMemoryFragments = true;
      limitQuickFacts = 8;
      limitHistory = 2;
      optimizations.push('ultra_fast_mode');
    }

    // Adjust based on requirements
    if (!analysis.requiresMemoryFragments && options.skipMemoryForSimpleQueries) {
      skipMemoryFragments = true;
      optimizations.push('skip_memory_fragments');
    }

    if (!analysis.requiresFullHistory) {
      limitHistory = 3;
      optimizations.push('limited_history');
    }

    // Cache strategy
    if (analysis.suggestedCacheStrategy === 'aggressive') {
      optimizations.push('aggressive_caching');
    }

    // Parallelism
    if (options.parallelismLevel === 'high') {
      parallelQueries = true;
      optimizations.push('parallel_retrieval');
    }

    return {
      useCache,
      skipMemoryFragments,
      limitQuickFacts,
      limitMemoryFragments,
      limitHistory,
      parallelQueries,
      optimizations
    };
  }

  /**
   * Execute optimized retrieval with caching and parallel processing
   */
  private async executeOptimizedRetrieval(
    avatarId: string,
    query: string,
    analysis: QueryAnalysis,
    strategy: any
  ): Promise<any> {
    const retrievalPromises: Promise<any>[] = [];

    // Quick facts retrieval (always needed)
    retrievalPromises.push(
      this.getQuickFactsCached(avatarId, {
        limit: strategy.limitQuickFacts,
        useCache: strategy.useCache
      })
    );

    // Memory fragments retrieval (conditional)
    if (!strategy.skipMemoryFragments) {
      retrievalPromises.push(
        this.getMemoryFragmentsCached(avatarId, query, {
          limit: strategy.limitMemoryFragments,
          useCache: strategy.useCache
        })
      );
    } else {
      retrievalPromises.push(Promise.resolve([]));
    }

    // Conversation history retrieval
    retrievalPromises.push(
      this.getConversationHistoryCached(avatarId, {
        limit: strategy.limitHistory,
        useCache: strategy.useCache
      })
    );

    // Execute in parallel
    const [quickFacts, memoryFragments, conversationHistory] = await Promise.all(retrievalPromises);

    // Apply final limits based on strategy
    const finalQuickFacts = (quickFacts || []).slice(0, strategy.limitQuickFacts);
    const finalMemoryFragments = (memoryFragments || []).slice(0, strategy.limitMemoryFragments);
    const finalConversationHistory = (conversationHistory || []).slice(0, strategy.limitHistory);

    return {
      quickFacts: finalQuickFacts,
      memoryFragments: finalMemoryFragments,
      conversationHistory: finalConversationHistory,
      retrievalMetadata: {
        totalQuickFacts: finalQuickFacts.length,
        totalMemoryFragments: finalMemoryFragments.length,
        totalConversationTurns: finalConversationHistory.length,
        retrievalTimeMs: 0, // Will be calculated by caller
        confidenceThreshold: 0.35,
        queryOptimizations: strategy.optimizations,
        cacheHits: this.getCacheHitKeys(avatarId)
      }
    };
  }

  /**
   * Get quick facts with caching
   */
  private async getQuickFactsCached(
    avatarId: string,
    options: { limit: number; useCache: boolean }
  ): Promise<QuickFact[]> {
    const cacheKey = `quick_facts:${avatarId}:${options.limit}`;
    
    if (options.useCache) {
      const cached = this.getFromCache(this.cache.quickFacts, cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      // Use the context engine to fetch quick facts
      const context = await this.contextEngine.retrieveContext(avatarId, '', {
        fastMode: false, // Avoid recursion
        memoryLimit: 0,
        historyLimit: 0
      });

      const quickFacts = (context.quickFacts || []).slice(0, options.limit);
      
      if (options.useCache) {
        this.setCache(this.cache.quickFacts, cacheKey, quickFacts, this.QUICK_FACTS_TTL);
      }

      return quickFacts;
    } catch (error) {
      console.error('Error fetching quick facts:', error);
      return [];
    }
  }

  /**
   * Get memory fragments with caching
   */
  private async getMemoryFragmentsCached(
    avatarId: string,
    query: string,
    options: { limit: number; useCache: boolean }
  ): Promise<MemoryFragment[]> {
    const cacheKey = `memory_fragments:${avatarId}:${this.hashQuery(query)}:${options.limit}`;
    
    if (options.useCache) {
      const cached = this.getFromCache(this.cache.memoryFragments, cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      // Use the context engine to fetch memory fragments
      const context = await this.contextEngine.retrieveContext(avatarId, query, {
        fastMode: false, // Avoid recursion
        memoryLimit: options.limit,
        historyLimit: 0
      });

      const memoryFragments = context.memoryFragments || [];
      
      if (options.useCache) {
        this.setCache(this.cache.memoryFragments, cacheKey, memoryFragments, this.MEMORY_FRAGMENTS_TTL);
      }

      return memoryFragments;
    } catch (error) {
      console.error('Error fetching memory fragments:', error);
      return [];
    }
  }

  /**
   * Get conversation history with caching
   */
  private async getConversationHistoryCached(
    avatarId: string,
    options: { limit: number; useCache: boolean }
  ): Promise<ConversationTurn[]> {
    const cacheKey = `conversation_history:${avatarId}:${options.limit}`;
    
    if (options.useCache) {
      const cached = this.getFromCache(this.cache.conversationHistory, cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      // Use the context engine to fetch conversation history
      const context = await this.contextEngine.retrieveContext(avatarId, '', {
        fastMode: false, // Avoid recursion
        memoryLimit: 0,
        historyLimit: options.limit
      });

      const conversationHistory = context.conversationHistory || [];
      
      if (options.useCache) {
        this.setCache(this.cache.conversationHistory, cacheKey, conversationHistory, this.CONVERSATION_HISTORY_TTL);
      }

      return conversationHistory;
    } catch (error) {
      console.error('Error fetching conversation history:', error);
      return [];
    }
  }

  /**
   * Extract key entities from query (simple implementation)
   */
  private extractKeyEntities(query: string): string[] {
    const entities: string[] = [];
    const words = query.toLowerCase().split(/\s+/);
    
    // Look for common entity patterns
    const entityPatterns = [
      /\b(mom|dad|mother|father|parent|family)\b/,
      /\b(dog|cat|pet|animal)\b/,
      /\b(work|job|career|office)\b/,
      /\b(home|house|apartment|place)\b/,
      /\b(friend|buddy|pal)\b/,
      /\b(school|college|university|education)\b/
    ];

    entityPatterns.forEach(pattern => {
      const match = query.match(pattern);
      if (match) {
        entities.push(match[1]);
      }
    });

    return entities;
  }

  /**
   * Hash query for caching
   */
  private hashQuery(query: string): string {
    // Simple hash function for query caching
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Generic cache operations
   */
  private getFromCache<T>(cache: Map<string, { data: T; expiry: number }>, key: string): T | null {
    const cached = cache.get(key);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }
    cache.delete(key);
    return null;
  }

  private setCache<T>(
    cache: Map<string, { data: T; expiry: number }>,
    key: string,
    data: T,
    ttl: number
  ): void {
    cache.set(key, {
      data,
      expiry: Date.now() + ttl
    });
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(avatarId: string): number {
    let totalRequests = 0;
    let cacheHits = 0;

    [this.cache.quickFacts, this.cache.memoryFragments, this.cache.conversationHistory].forEach(cache => {
      cache.forEach((value, key) => {
        if (key.includes(avatarId)) {
          totalRequests++;
          if (Date.now() < value.expiry) {
            cacheHits++;
          }
        }
      });
    });

    return totalRequests > 0 ? cacheHits / totalRequests : 0;
  }

  /**
   * Get cache hit keys for metadata
   */
  private getCacheHitKeys(avatarId: string): string[] {
    const hits: string[] = [];
    
    [
      { cache: this.cache.quickFacts, type: 'quick_facts' },
      { cache: this.cache.memoryFragments, type: 'memory_fragments' },
      { cache: this.cache.conversationHistory, type: 'conversation_history' }
    ].forEach(({ cache, type }) => {
      cache.forEach((value, key) => {
        if (key.includes(avatarId) && Date.now() < value.expiry) {
          hits.push(type);
        }
      });
    });

    return [...new Set(hits)]; // Remove duplicates
  }

  /**
   * Clear all caches
   */
  public clearCache(): void {
    this.cache.quickFacts.clear();
    this.cache.memoryFragments.clear();
    this.cache.conversationHistory.clear();
    this.cache.queryAnalysis.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    quickFacts: number;
    memoryFragments: number;
    conversationHistory: number;
    queryAnalysis: number;
    totalSize: number;
  } {
    return {
      quickFacts: this.cache.quickFacts.size,
      memoryFragments: this.cache.memoryFragments.size,
      conversationHistory: this.cache.conversationHistory.size,
      queryAnalysis: this.cache.queryAnalysis.size,
      totalSize: this.cache.quickFacts.size + 
                 this.cache.memoryFragments.size + 
                 this.cache.conversationHistory.size + 
                 this.cache.queryAnalysis.size
    };
  }

  /**
   * Preload cache for an avatar (useful for warming up)
   */
  async preloadCache(avatarId: string): Promise<void> {
    try {
      // Preload most common quick facts
      await this.getQuickFactsCached(avatarId, { limit: 20, useCache: true });
      
      // Preload empty conversation history to establish cache entry
      await this.getConversationHistoryCached(avatarId, { limit: 5, useCache: true });
      
    } catch (error) {
      console.error('Cache preload failed:', error);
    }
  }
}

/**
 * Convenience function to create a fast mode optimizer
 */
export function createFastModeOptimizer(contextEngine: ContextRetrievalEngine): FastModeOptimizer {
  return new FastModeOptimizer(contextEngine);
}