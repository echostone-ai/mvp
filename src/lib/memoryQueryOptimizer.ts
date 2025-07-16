// src/lib/memoryQueryOptimizer.ts
import { supabase } from './supabase'

/**
 * Database query optimization utilities for memory operations
 */
export class MemoryQueryOptimizer {
  /**
   * Optimize vector search queries with better indexing strategies
   */
  static async optimizeVectorSearchQuery(
    queryEmbedding: number[],
    userId: string,
    options: {
      threshold?: number
      limit?: number
      useApproximateSearch?: boolean
    } = {}
  ) {
    const {
      threshold = 0.7,
      limit = 10,
      useApproximateSearch = true
    } = options

    // Use different search strategies based on requirements
    if (useApproximateSearch && limit <= 50) {
      // Use IVFFlat index for faster approximate search
      return supabase.rpc('match_memory_fragments_fast', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit,
        user_id: userId
      })
    } else {
      // Use exact search for higher accuracy requirements
      return supabase.rpc('match_memory_fragments_exact', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit,
        user_id: userId
      })
    }
  }

  /**
   * Batch operations for better database performance
   */
  static async batchInsertOptimized(fragments: Array<{
    user_id: string
    fragment_text: string
    embedding: number[]
    conversation_context?: any
  }>) {
    // Use batch insert with optimized chunk size
    const OPTIMAL_BATCH_SIZE = 100
    const results: string[] = []

    for (let i = 0; i < fragments.length; i += OPTIMAL_BATCH_SIZE) {
      const batch = fragments.slice(i, i + OPTIMAL_BATCH_SIZE)
      
      const { data, error } = await supabase
        .from('memory_fragments')
        .insert(batch)
        .select('id')

      if (error) throw error
      if (data) {
        results.push(...data.map(item => item.id))
      }
    }

    return results
  }

  /**
   * Optimized user memory retrieval with smart pagination
   */
  static async getUserMemoriesOptimized(
    userId: string,
    options: {
      limit?: number
      offset?: number
      orderBy?: 'created_at' | 'updated_at'
      orderDirection?: 'asc' | 'desc'
      includeEmbeddings?: boolean
    } = {}
  ) {
    const {
      limit = 100,
      offset = 0,
      orderBy = 'created_at',
      orderDirection = 'desc',
      includeEmbeddings = false
    } = options

    // Select only necessary columns to reduce data transfer
    const selectColumns = includeEmbeddings 
      ? '*' 
      : 'id, user_id, fragment_text, conversation_context, created_at, updated_at'

    let query = supabase
      .from('memory_fragments')
      .select(selectColumns)
      .eq('user_id', userId)
      .order(orderBy, { ascending: orderDirection === 'asc' })

    if (limit > 0) {
      query = query.range(offset, offset + limit - 1)
    }

    return query
  }

  /**
   * Create optimized database indexes for better performance
   */
  static async createOptimizedIndexes() {
    const indexQueries = [
      // Composite index for user-specific queries with ordering
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memory_fragments_user_created 
       ON memory_fragments (user_id, created_at DESC)`,
      
      // Partial index for recent memories (last 30 days)
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memory_fragments_recent 
       ON memory_fragments (user_id, created_at) 
       WHERE created_at > NOW() - INTERVAL '30 days'`,
      
      // Text search index for fallback searches
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memory_fragments_text_search 
       ON memory_fragments USING gin(to_tsvector('english', fragment_text))`,
      
      // Optimized vector index with better parameters
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memory_fragments_embedding_optimized 
       ON memory_fragments USING ivfflat (embedding vector_cosine_ops) 
       WITH (lists = 200)` // Increased lists for better performance
    ]

    const results = []
    for (const query of indexQueries) {
      try {
        const { error } = await supabase.rpc('execute_sql', { sql: query })
        results.push({ query, success: !error, error })
      } catch (error) {
        results.push({ query, success: false, error })
      }
    }

    return results
  }

  /**
   * Analyze query performance and provide recommendations
   */
  static async analyzeQueryPerformance(userId: string) {
    const analyses = []

    try {
      // Analyze table statistics
      const { data: tableStats } = await supabase.rpc('get_table_stats', {
        table_name: 'memory_fragments'
      })

      // Analyze user-specific data distribution
      const { data: userStats } = await supabase
        .from('memory_fragments')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })

      // Check index usage
      const { data: indexUsage } = await supabase.rpc('get_index_usage', {
        table_name: 'memory_fragments'
      })

      analyses.push({
        type: 'table_stats',
        data: tableStats,
        recommendations: this.generateTableRecommendations(tableStats)
      })

      analyses.push({
        type: 'user_distribution',
        data: userStats,
        recommendations: this.generateUserDistributionRecommendations(userStats)
      })

      analyses.push({
        type: 'index_usage',
        data: indexUsage,
        recommendations: this.generateIndexRecommendations(indexUsage)
      })

    } catch (error) {
      console.warn('Query performance analysis failed:', error)
    }

    return analyses
  }

  /**
   * Generate recommendations based on table statistics
   */
  private static generateTableRecommendations(tableStats: any): string[] {
    const recommendations: string[] = []

    if (!tableStats) return recommendations

    if (tableStats.row_count > 100000) {
      recommendations.push('Large table detected. Consider partitioning by user_id or date.')
    }

    if (tableStats.table_size_mb > 1000) {
      recommendations.push('Table size is large. Consider archiving old memories or compression.')
    }

    if (tableStats.index_size_mb > tableStats.table_size_mb * 0.5) {
      recommendations.push('Index size is large relative to table. Review index necessity.')
    }

    return recommendations
  }

  /**
   * Generate recommendations based on user data distribution
   */
  private static generateUserDistributionRecommendations(userStats: any[]): string[] {
    const recommendations: string[] = []

    if (!userStats || userStats.length === 0) return recommendations

    const totalMemories = userStats.length
    const oldestMemory = new Date(userStats[0]?.created_at)
    const newestMemory = new Date(userStats[userStats.length - 1]?.created_at)
    const timeSpanDays = (newestMemory.getTime() - oldestMemory.getTime()) / (1000 * 60 * 60 * 24)

    if (totalMemories > 10000) {
      recommendations.push('User has many memories. Consider implementing memory archiving.')
    }

    if (timeSpanDays > 365) {
      recommendations.push('Memories span over a year. Consider time-based partitioning.')
    }

    const memoriesPerDay = totalMemories / timeSpanDays
    if (memoriesPerDay > 50) {
      recommendations.push('High memory creation rate. Consider batch processing optimizations.')
    }

    return recommendations
  }

  /**
   * Generate recommendations based on index usage
   */
  private static generateIndexRecommendations(indexUsage: any[]): string[] {
    const recommendations: string[] = []

    if (!indexUsage) return recommendations

    const unusedIndexes = indexUsage.filter(idx => idx.scans === 0)
    if (unusedIndexes.length > 0) {
      recommendations.push(`Unused indexes detected: ${unusedIndexes.map(idx => idx.indexname).join(', ')}`)
    }

    const lowUsageIndexes = indexUsage.filter(idx => idx.scans > 0 && idx.scans < 10)
    if (lowUsageIndexes.length > 0) {
      recommendations.push(`Low usage indexes: ${lowUsageIndexes.map(idx => idx.indexname).join(', ')}`)
    }

    return recommendations
  }

  /**
   * Optimize vector search parameters based on data characteristics
   */
  static async optimizeVectorSearchParameters(userId: string) {
    try {
      // Analyze user's memory distribution
      const { data: memoryStats } = await supabase
        .from('memory_fragments')
        .select('created_at, fragment_text')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1000) // Sample recent memories

      if (!memoryStats || memoryStats.length === 0) {
        return {
          recommendedThreshold: 0.7,
          recommendedLimit: 10,
          useApproximateSearch: true
        }
      }

      // Calculate optimal parameters based on data characteristics
      const avgTextLength = memoryStats.reduce((sum, m) => sum + m.fragment_text.length, 0) / memoryStats.length
      const totalMemories = memoryStats.length

      // Adjust threshold based on text complexity
      let recommendedThreshold = 0.7
      if (avgTextLength > 200) {
        recommendedThreshold = 0.65 // Lower threshold for longer, more complex texts
      } else if (avgTextLength < 50) {
        recommendedThreshold = 0.75 // Higher threshold for shorter texts
      }

      // Adjust search strategy based on data volume
      const useApproximateSearch = totalMemories > 1000

      // Adjust limit based on data density
      let recommendedLimit = 10
      if (totalMemories > 5000) {
        recommendedLimit = 15 // More results for users with many memories
      } else if (totalMemories < 100) {
        recommendedLimit = 5 // Fewer results for users with few memories
      }

      return {
        recommendedThreshold,
        recommendedLimit,
        useApproximateSearch,
        dataCharacteristics: {
          totalMemories,
          avgTextLength,
          analysisDate: new Date()
        }
      }

    } catch (error) {
      console.warn('Vector search optimization failed:', error)
      return {
        recommendedThreshold: 0.7,
        recommendedLimit: 10,
        useApproximateSearch: true
      }
    }
  }

  /**
   * Connection pool optimization
   */
  static async optimizeConnectionPool() {
    // These would typically be configured at the Supabase client level
    const recommendations = {
      poolSize: {
        min: 2,
        max: 20,
        reasoning: 'Balanced pool size for memory operations'
      },
      connectionTimeout: {
        value: 30000, // 30 seconds
        reasoning: 'Adequate timeout for vector operations'
      },
      idleTimeout: {
        value: 300000, // 5 minutes
        reasoning: 'Keep connections alive for frequent memory operations'
      },
      statementTimeout: {
        value: 60000, // 1 minute
        reasoning: 'Allow time for complex vector searches'
      }
    }

    return recommendations
  }

  /**
   * Query plan analysis for optimization
   */
  static async analyzeQueryPlans() {
    const queries = [
      {
        name: 'vector_similarity_search',
        sql: `EXPLAIN (ANALYZE, BUFFERS) 
              SELECT * FROM match_memory_fragments($1, $2, $3, $4)`,
        params: [new Array(1536).fill(0.1), 0.7, 10, 'sample-user-id']
      },
      {
        name: 'user_memories_retrieval',
        sql: `EXPLAIN (ANALYZE, BUFFERS) 
              SELECT * FROM memory_fragments 
              WHERE user_id = $1 
              ORDER BY created_at DESC 
              LIMIT $2`,
        params: ['sample-user-id', 100]
      },
      {
        name: 'text_search_fallback',
        sql: `EXPLAIN (ANALYZE, BUFFERS) 
              SELECT * FROM memory_fragments 
              WHERE user_id = $1 AND fragment_text ILIKE $2 
              ORDER BY created_at DESC`,
        params: ['sample-user-id', '%test%']
      }
    ]

    const analyses = []
    for (const query of queries) {
      try {
        const { data, error } = await supabase.rpc('explain_query', {
          query_sql: query.sql,
          query_params: query.params
        })

        analyses.push({
          name: query.name,
          plan: data,
          error,
          recommendations: this.analyzeQueryPlan(data)
        })
      } catch (error) {
        analyses.push({
          name: query.name,
          plan: null,
          error,
          recommendations: []
        })
      }
    }

    return analyses
  }

  /**
   * Analyze query execution plan and provide recommendations
   */
  private static analyzeQueryPlan(plan: any): string[] {
    const recommendations: string[] = []

    if (!plan) return recommendations

    // Look for sequential scans
    if (plan.includes('Seq Scan')) {
      recommendations.push('Sequential scan detected. Consider adding appropriate indexes.')
    }

    // Look for expensive operations
    if (plan.includes('cost=') && plan.match(/cost=\d+\.\d+\.\.(\d+\.\d+)/)?.[1]) {
      const cost = parseFloat(plan.match(/cost=\d+\.\d+\.\.(\d+\.\d+)/)[1])
      if (cost > 1000) {
        recommendations.push('High query cost detected. Consider query optimization.')
      }
    }

    // Look for memory usage
    if (plan.includes('Memory:') && plan.match(/Memory: (\d+)kB/)?.[1]) {
      const memoryKB = parseInt(plan.match(/Memory: (\d+)kB/)[1])
      if (memoryKB > 10000) { // 10MB
        recommendations.push('High memory usage in query. Consider optimization.')
      }
    }

    return recommendations
  }
}