// src/lib/memoryPerformanceMonitor.ts
import { MemoryFragment } from './memoryService'

/**
 * Performance metrics for memory operations
 */
export interface PerformanceMetrics {
  operationType: string
  duration: number
  timestamp: Date
  success: boolean
  context: Record<string, any>
  memoryUsage?: {
    heapUsed: number
    heapTotal: number
    external: number
  }
}

/**
 * Aggregated performance statistics
 */
export interface PerformanceStats {
  operationType: string
  totalOperations: number
  successfulOperations: number
  failedOperations: number
  averageDuration: number
  minDuration: number
  maxDuration: number
  p95Duration: number
  p99Duration: number
  operationsPerSecond: number
  lastUpdated: Date
}

/**
 * Cache entry with TTL
 */
interface CacheEntry<T> {
  data: T
  timestamp: Date
  ttl: number
  accessCount: number
  lastAccessed: Date
}

/**
 * Performance monitoring and caching service for memory operations
 */
export class MemoryPerformanceMonitor {
  private static metrics: PerformanceMetrics[] = []
  private static cache: Map<string, CacheEntry<any>> = new Map()
  private static readonly MAX_METRICS_HISTORY = 10000
  private static readonly CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 minutes
  private static readonly DEFAULT_CACHE_TTL = 10 * 60 * 1000 // 10 minutes
  
  // Cache TTL configurations for different operation types
  private static readonly CACHE_TTL_CONFIG = {
    user_memories: 5 * 60 * 1000, // 5 minutes
    memory_stats: 15 * 60 * 1000, // 15 minutes
    relevant_memories: 2 * 60 * 1000, // 2 minutes
    embeddings: 60 * 60 * 1000, // 1 hour
    memory_fragment: 10 * 60 * 1000, // 10 minutes
  }

  static {
    // Start cache cleanup interval
    setInterval(() => {
      this.cleanupExpiredCache()
    }, this.CACHE_CLEANUP_INTERVAL)
  }

  /**
   * Record performance metrics for an operation
   */
  static recordMetrics(
    operationType: string,
    startTime: number,
    success: boolean,
    context: Record<string, any> = {}
  ): void {
    const duration = Date.now() - startTime
    const memoryUsage = process.memoryUsage()

    const metric: PerformanceMetrics = {
      operationType,
      duration,
      timestamp: new Date(),
      success,
      context,
      memoryUsage: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external
      }
    }

    this.metrics.push(metric)

    // Keep metrics history within limits
    if (this.metrics.length > this.MAX_METRICS_HISTORY) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS_HISTORY)
    }

    // Log slow operations
    if (duration > 5000) { // 5 seconds
      console.warn(`Slow memory operation detected: ${operationType} took ${duration}ms`, {
        context,
        memoryUsage: metric.memoryUsage
      })
    }

    // Log memory usage warnings
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024
    if (heapUsedMB > 500) { // 500MB
      console.warn(`High memory usage detected: ${heapUsedMB.toFixed(2)}MB heap used`, {
        operationType,
        context
      })
    }
  }

  /**
   * Decorator to automatically track performance metrics
   */
  static withPerformanceTracking<T>(
    operationType: string,
    operation: () => Promise<T>,
    context: Record<string, any> = {}
  ): Promise<T> {
    const startTime = Date.now()
    
    return operation()
      .then(result => {
        this.recordMetrics(operationType, startTime, true, context)
        return result
      })
      .catch(error => {
        this.recordMetrics(operationType, startTime, false, { ...context, error: error.message })
        throw error
      })
  }

  /**
   * Get performance statistics for a specific operation type
   */
  static getPerformanceStats(operationType: string, timeWindowMs: number = 24 * 60 * 60 * 1000): PerformanceStats {
    const cutoffTime = new Date(Date.now() - timeWindowMs)
    const relevantMetrics = this.metrics.filter(
      m => m.operationType === operationType && m.timestamp >= cutoffTime
    )

    if (relevantMetrics.length === 0) {
      return {
        operationType,
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        p95Duration: 0,
        p99Duration: 0,
        operationsPerSecond: 0,
        lastUpdated: new Date()
      }
    }

    const durations = relevantMetrics.map(m => m.duration).sort((a, b) => a - b)
    const successfulOps = relevantMetrics.filter(m => m.success).length
    const totalDuration = durations.reduce((sum, d) => sum + d, 0)
    const timeWindowSeconds = timeWindowMs / 1000

    return {
      operationType,
      totalOperations: relevantMetrics.length,
      successfulOperations: successfulOps,
      failedOperations: relevantMetrics.length - successfulOps,
      averageDuration: totalDuration / relevantMetrics.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      p95Duration: durations[Math.floor(durations.length * 0.95)],
      p99Duration: durations[Math.floor(durations.length * 0.99)],
      operationsPerSecond: relevantMetrics.length / timeWindowSeconds,
      lastUpdated: new Date()
    }
  }

  /**
   * Get comprehensive performance report
   */
  static getPerformanceReport(timeWindowMs: number = 24 * 60 * 60 * 1000): {
    summary: {
      totalOperations: number
      successRate: number
      averageDuration: number
      slowOperations: number
      memoryUsage: {
        current: number
        peak: number
        average: number
      }
    }
    operationStats: PerformanceStats[]
    recommendations: string[]
  } {
    const cutoffTime = new Date(Date.now() - timeWindowMs)
    const relevantMetrics = this.metrics.filter(m => m.timestamp >= cutoffTime)
    
    const operationTypes = [...new Set(relevantMetrics.map(m => m.operationType))]
    const operationStats = operationTypes.map(type => this.getPerformanceStats(type, timeWindowMs))
    
    const totalOps = relevantMetrics.length
    const successfulOps = relevantMetrics.filter(m => m.success).length
    const slowOps = relevantMetrics.filter(m => m.duration > 5000).length
    
    const durations = relevantMetrics.map(m => m.duration)
    const avgDuration = durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0
    
    const memoryUsages = relevantMetrics
      .filter(m => m.memoryUsage)
      .map(m => m.memoryUsage!.heapUsed / 1024 / 1024) // Convert to MB
    
    const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024
    const peakMemory = memoryUsages.length > 0 ? Math.max(...memoryUsages) : currentMemory
    const avgMemory = memoryUsages.length > 0 ? memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length : currentMemory

    // Generate recommendations
    const recommendations: string[] = []
    
    if (totalOps > 0 && successfulOps / totalOps < 0.95) {
      recommendations.push('Success rate is below 95%. Consider investigating error patterns.')
    }
    
    if (slowOps > totalOps * 0.1) {
      recommendations.push('More than 10% of operations are slow (>5s). Consider optimization.')
    }
    
    if (avgDuration > 2000) {
      recommendations.push('Average operation duration is high. Consider caching or optimization.')
    }
    
    if (peakMemory > 1000) {
      recommendations.push('Peak memory usage is high (>1GB). Consider memory optimization.')
    }
    
    // Check cache hit rates
    const cacheStats = this.getCacheStats()
    if (cacheStats.hitRate < 0.5) {
      recommendations.push('Cache hit rate is low. Consider adjusting cache TTL or strategy.')
    }

    return {
      summary: {
        totalOperations: totalOps,
        successRate: totalOps > 0 ? successfulOps / totalOps : 1,
        averageDuration: avgDuration,
        slowOperations: slowOps,
        memoryUsage: {
          current: currentMemory,
          peak: peakMemory,
          average: avgMemory
        }
      },
      operationStats,
      recommendations
    }
  }

  /**
   * Cache management methods
   */
  static getCacheKey(operation: string, params: Record<string, any>): string {
    // Create deterministic cache key from operation and parameters
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key]
        return result
      }, {} as Record<string, any>)
    
    return `${operation}:${JSON.stringify(sortedParams)}`
  }

  /**
   * Get data from cache
   */
  static getCached<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }
    
    // Check if expired
    if (Date.now() - entry.timestamp.getTime() > entry.ttl) {
      this.cache.delete(key)
      return null
    }
    
    // Update access statistics
    entry.accessCount++
    entry.lastAccessed = new Date()
    
    return entry.data
  }

  /**
   * Set data in cache
   */
  static setCached<T>(key: string, data: T, operationType?: string): void {
    const ttl = operationType && this.CACHE_TTL_CONFIG[operationType as keyof typeof this.CACHE_TTL_CONFIG] 
      || this.DEFAULT_CACHE_TTL
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: new Date(),
      ttl,
      accessCount: 0,
      lastAccessed: new Date()
    }
    
    this.cache.set(key, entry)
  }

  /**
   * Execute operation with caching
   */
  static async withCaching<T>(
    operationType: string,
    cacheKey: string,
    operation: () => Promise<T>,
    context: Record<string, any> = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = this.getCached<T>(cacheKey)
    if (cached !== null) {
      // Record cache hit
      this.recordMetrics(`${operationType}_cache_hit`, Date.now(), true, { 
        ...context, 
        cacheKey,
        cached: true 
      })
      return cached
    }

    // Cache miss - execute operation and cache result
    const startTime = Date.now()
    try {
      const result = await operation()
      
      // Cache the result
      this.setCached(cacheKey, result, operationType)
      
      // Record cache miss with successful operation
      this.recordMetrics(`${operationType}_cache_miss`, startTime, true, { 
        ...context, 
        cacheKey,
        cached: false 
      })
      
      return result
    } catch (error) {
      // Record cache miss with failed operation
      this.recordMetrics(`${operationType}_cache_miss`, startTime, false, { 
        ...context, 
        cacheKey,
        cached: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Invalidate cache entries by pattern
   */
  static invalidateCache(pattern: string): number {
    let invalidatedCount = 0
    const regex = new RegExp(pattern)
    
    for (const [key] of this.cache.entries()) {
      if (regex.test(key)) {
        this.cache.delete(key)
        invalidatedCount++
      }
    }
    
    return invalidatedCount
  }

  /**
   * Clear all cache
   */
  static clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): {
    totalEntries: number
    totalSize: number
    hitRate: number
    averageAccessCount: number
    expiredEntries: number
  } {
    const now = Date.now()
    let totalSize = 0
    let totalAccessCount = 0
    let expiredEntries = 0
    
    for (const [key, entry] of this.cache.entries()) {
      totalSize += JSON.stringify(entry.data).length
      totalAccessCount += entry.accessCount
      
      if (now - entry.timestamp.getTime() > entry.ttl) {
        expiredEntries++
      }
    }
    
    const totalEntries = this.cache.size
    const cacheHits = this.metrics.filter(m => m.operationType.includes('cache_hit')).length
    const cacheMisses = this.metrics.filter(m => m.operationType.includes('cache_miss')).length
    const hitRate = (cacheHits + cacheMisses) > 0 ? cacheHits / (cacheHits + cacheMisses) : 0
    
    return {
      totalEntries,
      totalSize,
      hitRate,
      averageAccessCount: totalEntries > 0 ? totalAccessCount / totalEntries : 0,
      expiredEntries
    }
  }

  /**
   * Clean up expired cache entries
   */
  private static cleanupExpiredCache(): void {
    const now = Date.now()
    let cleanedCount = 0
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp.getTime() > entry.ttl) {
        this.cache.delete(key)
        cleanedCount++
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired cache entries`)
    }
  }

  /**
   * Get memory usage optimization recommendations
   */
  static getOptimizationRecommendations(): string[] {
    const recommendations: string[] = []
    const cacheStats = this.getCacheStats()
    const performanceReport = this.getPerformanceReport()
    
    // Cache optimization recommendations
    if (cacheStats.hitRate < 0.3) {
      recommendations.push('Cache hit rate is very low. Consider increasing cache TTL or reviewing cache strategy.')
    }
    
    if (cacheStats.totalSize > 50 * 1024 * 1024) { // 50MB
      recommendations.push('Cache size is large. Consider implementing cache size limits or more aggressive cleanup.')
    }
    
    if (cacheStats.expiredEntries > cacheStats.totalEntries * 0.2) {
      recommendations.push('Many expired cache entries detected. Consider more frequent cleanup or shorter TTL.')
    }
    
    // Performance optimization recommendations
    const slowOperations = performanceReport.operationStats.filter(stat => stat.averageDuration > 3000)
    if (slowOperations.length > 0) {
      recommendations.push(`Slow operations detected: ${slowOperations.map(op => op.operationType).join(', ')}. Consider optimization or caching.`)
    }
    
    const highFailureOperations = performanceReport.operationStats.filter(stat => 
      stat.totalOperations > 10 && (stat.failedOperations / stat.totalOperations) > 0.1
    )
    if (highFailureOperations.length > 0) {
      recommendations.push(`High failure rate operations: ${highFailureOperations.map(op => op.operationType).join(', ')}. Review error handling.`)
    }
    
    // Memory usage recommendations
    if (performanceReport.summary.memoryUsage.current > 1000) {
      recommendations.push('High current memory usage. Consider implementing memory cleanup or optimization.')
    }
    
    if (performanceReport.summary.memoryUsage.peak > 2000) {
      recommendations.push('Very high peak memory usage detected. Review memory-intensive operations.')
    }
    
    return recommendations
  }

  /**
   * Export performance data for analysis
   */
  static exportPerformanceData(timeWindowMs: number = 24 * 60 * 60 * 1000): {
    metrics: PerformanceMetrics[]
    stats: PerformanceStats[]
    cacheStats: ReturnType<typeof this.getCacheStats>
    recommendations: string[]
  } {
    const cutoffTime = new Date(Date.now() - timeWindowMs)
    const relevantMetrics = this.metrics.filter(m => m.timestamp >= cutoffTime)
    
    const operationTypes = [...new Set(relevantMetrics.map(m => m.operationType))]
    const stats = operationTypes.map(type => this.getPerformanceStats(type, timeWindowMs))
    
    return {
      metrics: relevantMetrics,
      stats,
      cacheStats: this.getCacheStats(),
      recommendations: this.getOptimizationRecommendations()
    }
  }
}