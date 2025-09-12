/**
 * Context Retrieval Engine
 * 
 * Orchestrates data fetching from multiple sources (quick_facts, memory_fragments, conversation history)
 * and merges them in priority order for GPT-5 processing. Implements confidence-based filtering
 * and query optimization for sub-500ms performance.
 */

import { sbAdmin } from '@/lib/data/client';
import { dbQueryDuration } from '@/lib/metrics';
import { logger } from '@/lib/logger';
import { quickFactsCache } from '@/lib/cache';
import { getSchemaCompatibilityLayer } from './schemaCompatibilityLayer';

export interface QuickFact {
  id: string;
  avatarId: string;
  key: string;
  value: string;
  confidence?: number;
  priority?: number;
  source?: 'heuristic' | 'llm' | 'manual' | 'extraction';
  sourceReference?: string;
  dateContext?: {
    year?: number;
    month?: number;
    day?: number;
  };
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  category?: string;
}

export interface MemoryFragment {
  id: string;
  userId?: string;
  avatarId: string;
  fragmentText: string;
  embedding?: number[];
  conversationContext: {
    source: string;
    type: 'user' | 'assistant';
    conversationId: string;
    visitorId?: string;
    gist?: string;
    tags?: string[];
    title?: string;
    people?: string[];
    startDate?: string;
    endDate?: string;
    year?: number;
  };
  similarity?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    confidence?: number;
    extractedEntities?: string[];
    emotionalTone?: string;
  };
}

export interface StructuredContext {
  quickFacts: QuickFact[];
  memoryFragments: MemoryFragment[];
  conversationHistory: ConversationTurn[];
  retrievalMetadata: RetrievalMetadata;
}

export interface RetrievalMetadata {
  totalQuickFacts: number;
  totalMemoryFragments: number;
  totalConversationTurns: number;
  retrievalTimeMs: number;
  confidenceThreshold: number;
  queryOptimizations: string[];
  cacheHits: string[];
}

export interface RetrievalOptions {
  priorityFilter?: number;
  memoryLimit?: number;
  historyLimit?: number;
  fastMode?: boolean;
  confidenceThreshold?: number;
  includeExpired?: boolean;
  categoryFilter?: string[];
  timeRangeFilter?: {
    startDate?: string;
    endDate?: string;
  };
}

export interface QueryOptimization {
  useParallelQueries: boolean;
  skipMemoryFragments: boolean;
  limitQuickFacts: number;
  cacheStrategy: 'none' | 'quick_facts' | 'full';
  estimatedTimeMs: number;
}

/**
 * Context Retrieval Engine
 * 
 * Fetches and merges context data from multiple sources with performance optimization
 * and confidence-based filtering.
 */
export class ContextRetrievalEngine {
  private schemaLayer = getSchemaCompatibilityLayer();
  private cache = new Map<string, { data: any; expiry: number }>();
  private readonly CACHE_TTL = 30 * 1000; // 30 seconds for quick facts
  private readonly DEFAULT_CONFIDENCE_THRESHOLD = 0.35;
  private readonly PLACE_CONFIDENCE_THRESHOLD = 0.25;
  private fastModeOptimizer?: any; // Will be set by fast mode optimizer

  /**
   * Retrieve structured context for an avatar with ordered data merging
   */
  async retrieveContext(
    avatarId: string, 
    query: string, 
    options: RetrievalOptions = {}
  ): Promise<StructuredContext> {
    const startTime = Date.now();
    
    // Use fast mode optimizer if available and fast mode is requested
    if (options.fastMode && this.fastModeOptimizer) {
      try {
        const result = await this.fastModeOptimizer.retrieveContextFast(avatarId, query, options);
        return result.context;
      } catch (error) {
        console.warn('Fast mode failed, falling back to standard retrieval:', error);
        // Continue with standard retrieval
      }
    }
    
    const optimization = this.optimizeQuery(query, options);
    
    const {
      priorityFilter = 10,
      memoryLimit = 20,
      historyLimit = 10,
      fastMode = false,
      confidenceThreshold = this.DEFAULT_CONFIDENCE_THRESHOLD,
      includeExpired = false,
      categoryFilter,
      timeRangeFilter
    } = options;

    try {
      // Execute queries in parallel for performance
      const [quickFacts, memoryFragments, conversationHistory] = await Promise.all([
        this.fetchQuickFacts(avatarId, {
          priorityFilter,
          confidenceThreshold,
          includeExpired,
          categoryFilter,
          useCache: optimization.cacheStrategy !== 'none',
          limit: optimization.limitQuickFacts
        }),
        optimization.skipMemoryFragments 
          ? Promise.resolve([])
          : this.fetchMemoryFragments(avatarId, query, {
              limit: memoryLimit,
              confidenceThreshold,
              timeRangeFilter
            }),
        this.fetchConversationHistory(avatarId, {
          limit: historyLimit,
          timeRangeFilter
        })
      ]);

      const retrievalTimeMs = Date.now() - startTime;

      // Apply confidence-based filtering
      const filteredQuickFacts = this.filterByConfidence(quickFacts, confidenceThreshold);
      const filteredMemoryFragments = this.filterMemoryFragmentsByConfidence(
        memoryFragments, 
        confidenceThreshold
      );

      const retrievalMetadata: RetrievalMetadata = {
        totalQuickFacts: filteredQuickFacts.length,
        totalMemoryFragments: filteredMemoryFragments.length,
        totalConversationTurns: conversationHistory.length,
        retrievalTimeMs,
        confidenceThreshold,
        queryOptimizations: this.getOptimizationSummary(optimization),
        cacheHits: this.getCacheHits(avatarId)
      };

      return {
        quickFacts: filteredQuickFacts,
        memoryFragments: filteredMemoryFragments,
        conversationHistory,
        retrievalMetadata
      };

    } catch (error) {
      console.error('Context retrieval failed:', error);
      throw new Error(`Failed to retrieve context for avatar ${avatarId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Optimize query execution based on query analysis
   */
  optimizeQuery(query: string, options: RetrievalOptions = {}): QueryOptimization {
    const queryLower = query.toLowerCase();
    const isSimpleQuery = queryLower.length < 50 && 
      !queryLower.includes('remember') && 
      !queryLower.includes('tell me about');

    return {
      useParallelQueries: true,
      skipMemoryFragments: options.fastMode && isSimpleQuery,
      limitQuickFacts: options.fastMode ? 10 : 50,
      // Cache quick facts in both modes (30s TTL) – safe and reduces DB load
      cacheStrategy: 'quick_facts',
      estimatedTimeMs: options.fastMode ? 200 : 400
    };
  }

  /**
   * Fetch quick facts with caching and filtering
   */
  private async fetchQuickFacts(
    avatarId: string, 
    options: {
      priorityFilter: number;
      confidenceThreshold: number;
      includeExpired: boolean;
      categoryFilter?: string[];
      useCache: boolean;
      limit: number;
    }
  ): Promise<QuickFact[]> {
    const cacheKey = `quick_facts:${avatarId}:${JSON.stringify(options)}`;
    
    if (options.useCache) {
      const cached = quickFactsCache.get(cacheKey) || this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const qStart = Date.now();
      let query = sbAdmin
        .from('quick_facts')
        .select('*')
        .eq('avatar_id', avatarId)
        .lte('priority', options.priorityFilter)
        .order('priority', { ascending: true })
        .limit(options.limit);

      // Filter by category if specified
      if (options.categoryFilter && options.categoryFilter.length > 0) {
        query = query.in('category', options.categoryFilter);
      }

      // Filter expired facts unless explicitly included
      if (!options.includeExpired) {
        query = query.or('expires_at.is.null,expires_at.gt.now()');
      }

      const { data, error } = await query;
      const elapsed = Date.now() - qStart;
      try { dbQueryDuration.observe({ query: 'quick_facts', cache: 'miss' }, elapsed); } catch {}
      if (elapsed > 160) logger.warn({ query: 'quick_facts', elapsed }, 'slow-db-query');

      if (error) {
        throw new Error(`Quick facts query failed: ${error.message}`);
      }

      const quickFacts: QuickFact[] = (data || []).map(row => ({
        id: row.id,
        avatarId: row.avatar_id,
        key: row.key,
        value: row.value,
        confidence: row.confidence || 1.0,
        priority: row.priority || 5,
        source: row.source || 'manual',
        sourceReference: row.source_reference,
        dateContext: row.date_context,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        category: row.category
      }));

      if (options.useCache) {
        try { quickFactsCache.set(cacheKey, quickFacts); } catch {}
        this.setCache(cacheKey, quickFacts);
      }

      return quickFacts;

    } catch (error) {
      console.error('Error fetching quick facts:', error);
      throw error;
    }
  }

  /**
   * Fetch memory fragments with similarity search
   */
  private async fetchMemoryFragments(
    avatarId: string,
    query: string,
    options: {
      limit: number;
      confidenceThreshold: number;
      timeRangeFilter?: {
        startDate?: string;
        endDate?: string;
      };
    }
  ): Promise<MemoryFragment[]> {
    try {
      const qStart2 = Date.now();
      let dbQuery = sbAdmin
        .from('memory_fragments')
        .select('*')
        .eq('avatar_id', avatarId)
        .order('created_at', { ascending: false })
        .limit(options.limit);

      // Apply time range filter if specified
      if (options.timeRangeFilter?.startDate) {
        dbQuery = dbQuery.gte('created_at', options.timeRangeFilter.startDate);
      }
      if (options.timeRangeFilter?.endDate) {
        dbQuery = dbQuery.lte('created_at', options.timeRangeFilter.endDate);
      }

      const { data, error } = await dbQuery;
      const elapsed2 = Date.now() - qStart2;
      try { dbQueryDuration.observe({ query: 'memory_fragments', cache: 'miss' }, elapsed2); } catch {}
      if (elapsed2 > 160) logger.warn({ query: 'memory_fragments', elapsed: elapsed2 }, 'slow-db-query');

      if (error) {
        throw new Error(`Memory fragments query failed: ${error.message}`);
      }

      return (data || []).map(row => ({
        id: row.id,
        userId: row.user_id,
        avatarId: row.avatar_id,
        fragmentText: row.fragment_text,
        embedding: row.embedding,
        conversationContext: row.conversation_context || {
          source: 'unknown',
          type: 'user',
          conversationId: 'unknown'
        },
        similarity: row.similarity,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

    } catch (error) {
      console.error('Error fetching memory fragments:', error);
      return [];
    }
  }

  /**
   * Fetch conversation history
   */
  private async fetchConversationHistory(
    avatarId: string,
    options: {
      limit: number;
      timeRangeFilter?: {
        startDate?: string;
        endDate?: string;
      };
    }
  ): Promise<ConversationTurn[]> {
    try {
      // For now, return empty array as conversation history structure needs to be defined
      // This would typically fetch from a conversations table
      return [];

    } catch (error) {
      console.error('Error fetching conversation history:', error);
      return [];
    }
  }

  /**
   * Filter quick facts by confidence threshold
   */
  private filterByConfidence(facts: QuickFact[], threshold: number): QuickFact[] {
    // Group facts by key to handle conflicts
    const factGroups = new Map<string, QuickFact[]>();
    
    facts.forEach(fact => {
      if (!factGroups.has(fact.key)) {
        factGroups.set(fact.key, []);
      }
      factGroups.get(fact.key)!.push(fact);
    });

    const filteredFacts: QuickFact[] = [];

    factGroups.forEach((groupFacts, key) => {
      // Sort by confidence and priority
      const sortedFacts = groupFacts.sort((a, b) => {
        const confidenceA = a.confidence || 0;
        const confidenceB = b.confidence || 0;
        const priorityA = a.priority || 10;
        const priorityB = b.priority || 10;
        
        // Higher confidence wins, then lower priority number wins
        if (confidenceA !== confidenceB) {
          return confidenceB - confidenceA;
        }
        return priorityA - priorityB;
      });

      // Take the highest confidence fact that meets threshold
      const bestFact = sortedFacts[0];
      const effectiveThreshold = key.toLowerCase().includes('place') || key.toLowerCase().includes('location')
        ? this.PLACE_CONFIDENCE_THRESHOLD
        : threshold;

      if ((bestFact.confidence || 0) >= effectiveThreshold) {
        filteredFacts.push(bestFact);
      } else if (groupFacts.length === 1) {
        // Include single facts even if below threshold (no alternatives exist)
        filteredFacts.push(bestFact);
      }
    });

    return filteredFacts;
  }

  /**
   * Filter memory fragments by confidence
   */
  private filterMemoryFragmentsByConfidence(
    fragments: MemoryFragment[], 
    threshold: number
  ): MemoryFragment[] {
    return fragments.filter(fragment => {
      // If no similarity score, include by default
      if (fragment.similarity === undefined) {
        return true;
      }
      return fragment.similarity >= threshold;
    });
  }

  /**
   * Cache management
   */
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.CACHE_TTL
    });
  }

  private getCacheHits(avatarId: string): string[] {
    const hits: string[] = [];
    this.cache.forEach((value, key) => {
      if (key.includes(avatarId) && Date.now() < value.expiry) {
        hits.push(key.split(':')[0]); // Extract cache type
      }
    });
    return hits;
  }

  /**
   * Get optimization summary for metadata
   */
  private getOptimizationSummary(optimization: QueryOptimization): string[] {
    const summary: string[] = [];
    
    if (optimization.useParallelQueries) {
      summary.push('parallel_queries');
    }
    if (optimization.skipMemoryFragments) {
      summary.push('skip_memory_fragments');
    }
    if (optimization.cacheStrategy !== 'none') {
      summary.push(`cache_${optimization.cacheStrategy}`);
    }
    if (optimization.limitQuickFacts < 50) {
      summary.push(`limited_quick_facts_${optimization.limitQuickFacts}`);
    }

    return summary;
  }

  /**
   * Clear all caches (useful for testing)
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Set fast mode optimizer (used by FastModeOptimizer)
   */
  public setFastModeOptimizer(optimizer: any): void {
    this.fastModeOptimizer = optimizer;
  }

  /**
   * Enable fast mode with sub-200ms optimization
   */
  async retrieveContextFast(
    avatarId: string,
    query: string,
    options: RetrievalOptions = {}
  ): Promise<StructuredContext> {
    return this.retrieveContext(avatarId, query, { ...options, fastMode: true });
  }
}

/**
 * Convenience function to create a new context retrieval engine
 */
export function createContextRetrievalEngine(): ContextRetrievalEngine {
  return new ContextRetrievalEngine();
}