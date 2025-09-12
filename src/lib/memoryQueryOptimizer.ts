// src/lib/memoryQueryOptimizer.ts
// Task 7: Optimize memory retrieval performance with indexing

import { supabase } from './supabase'
import { MemoryFragment } from './memoryService'
import { MemoryErrorHandler, MemoryError, MemoryErrorType } from './memoryErrorHandler'
import { resolveAvatarId } from './services/identity'

export interface OptimizedMemoryQuery {
  query: string
  userId: string
  avatarId?: string
  maxFragments?: number
  maxTokens?: number
  similarityThreshold?: number
}

export interface MemoryRetrievalResult {
  fragments: MemoryFragment[]
  retrievalTimeMs: number
  totalTokens: number
  cacheHit: boolean
  fallbackUsed: boolean
}

export interface MemoryPerformanceMetrics {
  averageRetrievalTime: number
  cacheHitRate: number
  fallbackUsageRate: number
  totalQueries: number
}

/**
 * Memory cache for warming and performance optimization
 */
class MemoryCache {
  private cache = new Map<string, { data: MemoryFragment[], timestamp: number, tokens: number }>()
  private readonly TTL_MS = 5 * 60 * 1000 // 5 minutes
  private readonly MAX_CACHE_SIZE = 100

  private getCacheKey(query: OptimizedMemoryQuery): string {
    return `${query.userId}:${query.avatarId || 'null'}:${query.query.substring(0, 50)}:${query.maxFragments}:${query.maxTokens}`
  }

  get(query: OptimizedMemoryQuery): MemoryFragment[] | null {
    const key = this.getCacheKey(query)
    const cached = this.cache.get(key)
    
    if (!cached) {
      return null
    }
    
    // Check if expired
    if (Date.now() - cached.timestamp > this.TTL_MS) {
      this.cache.delete(key)
      return null
    }
    
    return cached.data
  }

  set(query: OptimizedMemoryQuery, fragments: MemoryFragment[], totalTokens: number): void {
    const key = this.getCacheKey(query)
    
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }
    
    this.cache.set(key, {
      data: fragments,
      timestamp: Date.now(),
      tokens: totalTokens
    })
  }

  clear(): void {
    this.cache.clear()
  }

  getStats(): { size: number, hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0 // TODO: Implement hit rate tracking
    }
  }
}

/**
 * Performance metrics tracker
 */
class PerformanceTracker {
  private metrics: {
    retrievalTimes: number[]
    cacheHits: number
    cacheMisses: number
    fallbackUsage: number
    totalQueries: number
  } = {
    retrievalTimes: [],
    cacheHits: 0,
    cacheMisses: 0,
    fallbackUsage: 0,
    totalQueries: 0
  }

  recordQuery(retrievalTimeMs: number, cacheHit: boolean, fallbackUsed: boolean): void {
    this.metrics.totalQueries++
    this.metrics.retrievalTimes.push(retrievalTimeMs)
    
    if (cacheHit) {
      this.metrics.cacheHits++
    } else {
      this.metrics.cacheMisses++
    }
    
    if (fallbackUsed) {
      this.metrics.fallbackUsage++
    }
    
    // Keep only last 1000 retrieval times to prevent memory bloat
    if (this.metrics.retrievalTimes.length > 1000) {
      this.metrics.retrievalTimes = this.metrics.retrievalTimes.slice(-1000)
    }
  }

  getMetrics(): MemoryPerformanceMetrics {
    const totalCacheQueries = this.metrics.cacheHits + this.metrics.cacheMisses
    
    return {
      averageRetrievalTime: this.metrics.retrievalTimes.length > 0 
        ? this.metrics.retrievalTimes.reduce((a, b) => a + b, 0) / this.metrics.retrievalTimes.length 
        : 0,
      cacheHitRate: totalCacheQueries > 0 ? this.metrics.cacheHits / totalCacheQueries : 0,
      fallbackUsageRate: this.metrics.totalQueries > 0 ? this.metrics.fallbackUsage / this.metrics.totalQueries : 0,
      totalQueries: this.metrics.totalQueries
    }
  }

  reset(): void {
    this.metrics = {
      retrievalTimes: [],
      cacheHits: 0,
      cacheMisses: 0,
      fallbackUsage: 0,
      totalQueries: 0
    }
  }
}

/**
 * Helper function to resolve avatar ID from slug or return as-is if already a UUID
 */
async function resolveAvatarIdIfNeeded(avatarId: string | undefined): Promise<string | undefined> {
  if (!avatarId) return undefined;
  
  // If it's already a UUID format, return as-is
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(avatarId)) {
    return avatarId;
  }
  
  // If it's a slug like "jonathan-demo", resolve it to UUID
  try {
    const resolvedId = await resolveAvatarId({ avatarSlug: avatarId }, supabase);
    return resolvedId;
  } catch (error) {
    console.warn(`Failed to resolve avatar ID for "${avatarId}":`, error);
    return undefined;
  }
}

/**
 * Optimized memory query service with caching and performance monitoring
 */
export class MemoryQueryOptimizer {
  private static cache = new MemoryCache()
  private static performanceTracker = new PerformanceTracker()
  
  // Default configuration matching task requirements
  private static readonly DEFAULT_MAX_FRAGMENTS = 6
  private static readonly DEFAULT_MAX_TOKENS = 300
  private static readonly DEFAULT_SIMILARITY_THRESHOLD = 0.7
  private static readonly SLA_TARGET_MS = 200

  /**
   * Optimized memory retrieval with caching and token limits
   * Implements requirement 4.2: <200ms SLA
   */
  static async retrieveOptimizedMemories(query: OptimizedMemoryQuery): Promise<MemoryRetrievalResult> {
    const startTime = Date.now()
    let cacheHit = false
    let fallbackUsed = false
    
    try {
      // Normalize query parameters
      const normalizedQuery: Required<OptimizedMemoryQuery> = {
        query: query.query,
        userId: query.userId,
        avatarId: query.avatarId || '',
        maxFragments: query.maxFragments || this.DEFAULT_MAX_FRAGMENTS,
        maxTokens: query.maxTokens || this.DEFAULT_MAX_TOKENS,
        similarityThreshold: query.similarityThreshold || this.DEFAULT_SIMILARITY_THRESHOLD
      }

      // Check cache first
      const cachedResult = this.cache.get(normalizedQuery)
      if (cachedResult) {
        cacheHit = true
        const retrievalTimeMs = Date.now() - startTime
        
        this.performanceTracker.recordQuery(retrievalTimeMs, cacheHit, fallbackUsed)
        
        return {
          fragments: cachedResult,
          retrievalTimeMs,
          totalTokens: this.calculateTotalTokens(cachedResult),
          cacheHit,
          fallbackUsed
        }
      }

      // Try optimized vector search first
      let fragments: MemoryFragment[] = []
      
      try {
        fragments = await this.executeOptimizedVectorSearch(normalizedQuery)
      } catch (vectorError) {
        console.warn('[MemoryQueryOptimizer] Vector search failed, falling back to text search:', vectorError)
        fallbackUsed = true
        fragments = await this.executeOptimizedTextSearch(normalizedQuery)
      }

      const retrievalTimeMs = Date.now() - startTime
      const totalTokens = this.calculateTotalTokens(fragments)
      
      // Cache the result
      this.cache.set(normalizedQuery, fragments, totalTokens)
      
      // Record performance metrics
      this.performanceTracker.recordQuery(retrievalTimeMs, cacheHit, fallbackUsed)
      
      // Log performance warning if SLA exceeded
      if (retrievalTimeMs > this.SLA_TARGET_MS) {
        console.warn(`[MemoryQueryOptimizer] Retrieval took ${retrievalTimeMs}ms, exceeding ${this.SLA_TARGET_MS}ms SLA`)
      }
      
      return {
        fragments,
        retrievalTimeMs,
        totalTokens,
        cacheHit,
        fallbackUsed
      }
    } catch (error) {
      const retrievalTimeMs = Date.now() - startTime
      this.performanceTracker.recordQuery(retrievalTimeMs, cacheHit, true) // Count errors as fallback usage
      
      console.error('[MemoryQueryOptimizer] Memory retrieval failed:', error)
      
      // Return empty result on error
      return {
        fragments: [],
        retrievalTimeMs,
        totalTokens: 0,
        cacheHit,
        fallbackUsed: true
      }
    }
  }

  /**
   * Execute optimized hybrid search using the enhanced database function
   */
  private static async executeOptimizedVectorSearch(query: Required<OptimizedMemoryQuery>): Promise<MemoryFragment[]> {
    return MemoryErrorHandler.withRetry(
      async () => {
        // Resolve avatarId if it's a slug
        const resolvedAvatarId = await resolveAvatarIdIfNeeded(query.avatarId);
        
        // Use enhanced hybrid search function
        const { data, error } = await supabase.rpc('get_enhanced_memories', {
          target_user_id: query.userId,
          target_avatar_id: resolvedAvatarId || null,
          search_query: query.query,
          match_count: Math.max(query.maxFragments, 64), // Ensure minimum 64 candidates
          similarity_threshold: query.similarityThreshold,
          include_bio_facts: true
        })

        if (error) {
          throw MemoryErrorHandler.categorizeError(error, {
            operation: 'enhanced_hybrid_search',
            userId: query.userId,
            avatarId: query.avatarId,
            queryLength: query.query.length
          })
        }

        if (!data) {
          return []
        }

        // Filter by token budget if specified
        let results = data.map((item: any) => ({
          id: item.id,
          userId: item.user_id,
          avatarId: item.avatar_id,
          fragmentText: item.fragment_text,
          embedding: undefined, // Don't return embeddings to save memory
          conversationContext: {
            ...item.conversation_context,
            similarity: item.similarity_score,
            matchType: item.match_type
          },
          createdAt: new Date(item.created_at),
          updatedAt: new Date(item.updated_at)
        }));

        // Apply token budget if specified
        if (query.maxTokens > 0) {
          let tokenCount = 0;
          results = results.filter(fragment => {
            const fragmentTokens = this.calculateTotalTokens([fragment]);
            if (tokenCount + fragmentTokens <= query.maxTokens) {
              tokenCount += fragmentTokens;
              return true;
            }
            return false;
          });
        }

        return results.slice(0, query.maxFragments);
      },
      'database',
      {
        operation: 'enhanced_hybrid_search',
        userId: query.userId,
        avatarId: query.avatarId,
        queryLength: query.query.length
      }
    )
  }

  /**
   * Execute optimized text search fallback using the enhanced database function
   */
  private static async executeOptimizedTextSearch(query: Required<OptimizedMemoryQuery>): Promise<MemoryFragment[]> {
    return MemoryErrorHandler.withRetry(
      async () => {
        // Resolve avatarId if it's a slug
        const resolvedAvatarId = await resolveAvatarIdIfNeeded(query.avatarId);
        
        // Use the same enhanced function but with lower similarity threshold for text fallback
        const { data, error } = await supabase.rpc('get_enhanced_memories', {
          target_user_id: query.userId,
          target_avatar_id: resolvedAvatarId || null,
          search_query: query.query,
          match_count: Math.max(query.maxFragments, 32), // Smaller pool for fallback
          similarity_threshold: 0.5, // Lower threshold for text search
          include_bio_facts: true
        })

        if (error) {
          throw MemoryErrorHandler.categorizeError(error, {
            operation: 'enhanced_text_search',
            userId: query.userId,
            avatarId: query.avatarId,
            queryLength: query.query.length
          })
        }

        if (!data) {
          return []
        }

        // Convert to MemoryFragment format and apply token budget
        let results = data.map((item: any) => ({
          id: item.id,
          userId: item.user_id,
          avatarId: item.avatar_id,
          fragmentText: item.fragment_text,
          embedding: undefined,
          conversationContext: {
            ...item.conversation_context,
            similarity: item.similarity_score,
            matchType: item.match_type
          },
          createdAt: new Date(item.created_at),
          updatedAt: new Date(item.updated_at)
        }));

        // Apply token budget if specified
        if (query.maxTokens > 0) {
          let tokenCount = 0;
          results = results.filter(fragment => {
            const fragmentTokens = this.calculateTotalTokens([fragment]);
            if (tokenCount + fragmentTokens <= query.maxTokens) {
              tokenCount += fragmentTokens;
              return true;
            }
            return false;
          });
        }

        return results.slice(0, query.maxFragments);
      },
      'database',
      {
        operation: 'enhanced_text_search',
        userId: query.userId,
        avatarId: query.avatarId,
        queryLength: query.query.length
      }
    )
  }

  /**
   * Calculate total tokens for a set of memory fragments
   */
  private static calculateTotalTokens(fragments: MemoryFragment[]): number {
    return fragments.reduce((total, fragment) => {
      // Rough token estimation: words * 1.3 (accounting for subwords)
      const words = fragment.fragmentText.split(' ').length
      return total + Math.ceil(words * 1.3)
    }, 0)
  }

  /**
   * Warm cache with common queries for a user/avatar
   * Implements memory cache warming on first conversation turn
   */
  static async warmCache(userId: string, avatarId?: string, commonQueries: string[] = []): Promise<void> {
    console.log('[MemoryQueryOptimizer] Warming cache for user:', userId, 'avatar:', avatarId)
    
    // Default common queries if none provided
    const defaultQueries = [
      'personal information',
      'family and relationships',
      'hobbies and interests',
      'work and career',
      'recent conversations'
    ]
    
    const queriesToWarm = commonQueries.length > 0 ? commonQueries : defaultQueries
    
    // Warm cache with common queries in parallel
    const warmingPromises = queriesToWarm.map(query => 
      this.retrieveOptimizedMemories({
        query,
        userId,
        avatarId,
        maxFragments: this.DEFAULT_MAX_FRAGMENTS,
        maxTokens: this.DEFAULT_MAX_TOKENS
      }).catch(error => {
        console.warn(`[MemoryQueryOptimizer] Failed to warm cache for query "${query}":`, error)
      })
    )
    
    await Promise.all(warmingPromises)
    console.log('[MemoryQueryOptimizer] Cache warming completed')
  }

  /**
   * Get performance metrics for monitoring
   */
  static getPerformanceMetrics(): MemoryPerformanceMetrics {
    return this.performanceTracker.getMetrics()
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number, hitRate: number } {
    return this.cache.getStats()
  }

  /**
   * Clear cache (useful for testing or memory management)
   */
  static clearCache(): void {
    this.cache.clear()
  }

  /**
   * Reset performance metrics (useful for testing)
   */
  static resetMetrics(): void {
    this.performanceTracker.reset()
  }

  /**
   * Check if retrieval performance meets SLA
   */
  static checkPerformanceSLA(): { meetsSLA: boolean, averageTime: number, targetTime: number } {
    const metrics = this.getPerformanceMetrics()
    return {
      meetsSLA: metrics.averageRetrievalTime <= this.SLA_TARGET_MS,
      averageTime: metrics.averageRetrievalTime,
      targetTime: this.SLA_TARGET_MS
    }
  }
}