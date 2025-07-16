// src/lib/__tests__/memoryPerformance.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MemoryPerformanceMonitor } from '../memoryPerformanceMonitor'
import { MemoryService, MemoryFragment } from '../memoryService'

// Mock dependencies
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            range: vi.fn(() => Promise.resolve({ data: [], error: null })),
            single: vi.fn(() => Promise.resolve({ data: null, error: null }))
          }))
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [{ id: 'test-id' }], error: null }))
      })),
      update: vi.fn(() => Promise.resolve({ data: null, error: null })),
      delete: vi.fn(() => Promise.resolve({ data: null, error: null }))
    })),
    rpc: vi.fn(() => Promise.resolve({ data: [], error: null }))
  }
}))

vi.mock('openai', () => ({
  OpenAI: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn(() => Promise.resolve({
          choices: [{ message: { content: '[]' } }]
        }))
      }
    },
    embeddings: {
      create: vi.fn(() => Promise.resolve({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      }))
    }
  }))
}))

describe('MemoryPerformanceMonitor', () => {
  beforeEach(() => {
    // Clear performance data before each test
    MemoryPerformanceMonitor.clearCache()
    vi.clearAllMocks()
  })

  afterEach(() => {
    MemoryPerformanceMonitor.clearCache()
  })

  describe('Performance Tracking', () => {
    it('should record performance metrics', async () => {
      const startTime = Date.now() - 1000 // 1 second ago
      
      MemoryPerformanceMonitor.recordMetrics(
        'test_operation',
        startTime,
        true,
        { testContext: 'value' }
      )

      const stats = MemoryPerformanceMonitor.getPerformanceStats('test_operation')
      
      expect(stats.totalOperations).toBe(1)
      expect(stats.successfulOperations).toBe(1)
      expect(stats.failedOperations).toBe(0)
      expect(stats.averageDuration).toBeGreaterThan(0)
    })

    it('should track failed operations', async () => {
      const startTime = Date.now() - 500
      
      MemoryPerformanceMonitor.recordMetrics(
        'test_operation',
        startTime,
        false,
        { error: 'Test error' }
      )

      const stats = MemoryPerformanceMonitor.getPerformanceStats('test_operation')
      
      expect(stats.totalOperations).toBe(1)
      expect(stats.successfulOperations).toBe(0)
      expect(stats.failedOperations).toBe(1)
    })

    it('should calculate percentiles correctly', async () => {
      // Record multiple operations with different durations
      const durations = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
      
      durations.forEach(duration => {
        MemoryPerformanceMonitor.recordMetrics(
          'percentile_test',
          Date.now() - duration,
          true
        )
      })

      const stats = MemoryPerformanceMonitor.getPerformanceStats('percentile_test')
      
      expect(stats.totalOperations).toBe(10)
      expect(stats.minDuration).toBe(100)
      expect(stats.maxDuration).toBe(1000)
      expect(stats.p95Duration).toBeGreaterThan(stats.averageDuration)
      expect(stats.p99Duration).toBeGreaterThan(stats.p95Duration)
    })

    it('should track operations per second', async () => {
      // Record 10 operations
      for (let i = 0; i < 10; i++) {
        MemoryPerformanceMonitor.recordMetrics(
          'ops_per_second_test',
          Date.now() - 100,
          true
        )
      }

      const stats = MemoryPerformanceMonitor.getPerformanceStats('ops_per_second_test', 1000) // 1 second window
      
      expect(stats.operationsPerSecond).toBeGreaterThan(0)
    })
  })

  describe('Performance Tracking Decorator', () => {
    it('should automatically track successful operations', async () => {
      const testOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return 'success'
      }

      const result = await MemoryPerformanceMonitor.withPerformanceTracking(
        'decorator_test',
        testOperation,
        { testParam: 'value' }
      )

      expect(result).toBe('success')
      
      const stats = MemoryPerformanceMonitor.getPerformanceStats('decorator_test')
      expect(stats.totalOperations).toBe(1)
      expect(stats.successfulOperations).toBe(1)
      expect(stats.averageDuration).toBeGreaterThan(90) // Should be around 100ms
    })

    it('should track failed operations and re-throw errors', async () => {
      const testOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
        throw new Error('Test error')
      }

      await expect(
        MemoryPerformanceMonitor.withPerformanceTracking(
          'decorator_error_test',
          testOperation
        )
      ).rejects.toThrow('Test error')

      const stats = MemoryPerformanceMonitor.getPerformanceStats('decorator_error_test')
      expect(stats.totalOperations).toBe(1)
      expect(stats.failedOperations).toBe(1)
    })
  })

  describe('Caching', () => {
    it('should cache and retrieve data', async () => {
      const testData = { test: 'data', timestamp: Date.now() }
      const cacheKey = 'test_cache_key'

      // Should return null for non-existent key
      expect(MemoryPerformanceMonitor.getCached(cacheKey)).toBeNull()

      // Set cache
      MemoryPerformanceMonitor.setCached(cacheKey, testData, 'test_operation')

      // Should retrieve cached data
      const cached = MemoryPerformanceMonitor.getCached(cacheKey)
      expect(cached).toEqual(testData)
    })

    it('should expire cached data after TTL', async () => {
      const testData = { test: 'data' }
      const cacheKey = 'test_expire_key'

      // Set cache with very short TTL
      MemoryPerformanceMonitor.setCached(cacheKey, testData)
      
      // Mock time passage
      vi.useFakeTimers()
      vi.advanceTimersByTime(15 * 60 * 1000) // 15 minutes

      // Should return null after expiration
      expect(MemoryPerformanceMonitor.getCached(cacheKey)).toBeNull()
      
      vi.useRealTimers()
    })

    it('should generate consistent cache keys', () => {
      const params1 = { userId: '123', limit: 10, query: 'test' }
      const params2 = { query: 'test', userId: '123', limit: 10 } // Different order

      const key1 = MemoryPerformanceMonitor.getCacheKey('test_op', params1)
      const key2 = MemoryPerformanceMonitor.getCacheKey('test_op', params2)

      expect(key1).toBe(key2) // Should be same despite parameter order
    })

    it('should track cache hit/miss metrics', async () => {
      const cacheKey = 'metrics_test_key'
      const testData = { test: 'data' }

      // First call should be cache miss
      const operation = vi.fn().mockResolvedValue(testData)
      
      const result1 = await MemoryPerformanceMonitor.withCaching(
        'cache_metrics_test',
        cacheKey,
        operation
      )

      expect(result1).toEqual(testData)
      expect(operation).toHaveBeenCalledTimes(1)

      // Second call should be cache hit
      const result2 = await MemoryPerformanceMonitor.withCaching(
        'cache_metrics_test',
        cacheKey,
        operation
      )

      expect(result2).toEqual(testData)
      expect(operation).toHaveBeenCalledTimes(1) // Should not be called again

      // Check metrics
      const missStats = MemoryPerformanceMonitor.getPerformanceStats('cache_metrics_test_cache_miss')
      const hitStats = MemoryPerformanceMonitor.getPerformanceStats('cache_metrics_test_cache_hit')

      expect(missStats.totalOperations).toBe(1)
      expect(hitStats.totalOperations).toBe(1)
    })

    it('should invalidate cache by pattern', () => {
      // Set multiple cache entries
      MemoryPerformanceMonitor.setCached('user_123_memories', { data: 1 })
      MemoryPerformanceMonitor.setCached('user_123_stats', { data: 2 })
      MemoryPerformanceMonitor.setCached('user_456_memories', { data: 3 })
      MemoryPerformanceMonitor.setCached('other_data', { data: 4 })

      // Invalidate user_123 entries
      const invalidated = MemoryPerformanceMonitor.invalidateCache('user_123_.*')

      expect(invalidated).toBe(2)
      expect(MemoryPerformanceMonitor.getCached('user_123_memories')).toBeNull()
      expect(MemoryPerformanceMonitor.getCached('user_123_stats')).toBeNull()
      expect(MemoryPerformanceMonitor.getCached('user_456_memories')).not.toBeNull()
      expect(MemoryPerformanceMonitor.getCached('other_data')).not.toBeNull()
    })
  })

  describe('Cache Statistics', () => {
    it('should provide accurate cache statistics', () => {
      // Add some cache entries
      MemoryPerformanceMonitor.setCached('key1', { data: 'test1' })
      MemoryPerformanceMonitor.setCached('key2', { data: 'test2' })
      
      // Access one entry multiple times
      MemoryPerformanceMonitor.getCached('key1')
      MemoryPerformanceMonitor.getCached('key1')
      MemoryPerformanceMonitor.getCached('key2')

      const stats = MemoryPerformanceMonitor.getCacheStats()

      expect(stats.totalEntries).toBe(2)
      expect(stats.totalSize).toBeGreaterThan(0)
      expect(stats.averageAccessCount).toBeGreaterThan(0)
    })
  })

  describe('Performance Reports', () => {
    it('should generate comprehensive performance report', async () => {
      // Record some test metrics
      MemoryPerformanceMonitor.recordMetrics('test_op_1', Date.now() - 1000, true)
      MemoryPerformanceMonitor.recordMetrics('test_op_1', Date.now() - 2000, false)
      MemoryPerformanceMonitor.recordMetrics('test_op_2', Date.now() - 500, true)

      const report = MemoryPerformanceMonitor.getPerformanceReport()

      expect(report.summary.totalOperations).toBe(3)
      expect(report.summary.successRate).toBeCloseTo(2/3, 2)
      expect(report.operationStats).toHaveLength(2)
      expect(report.recommendations).toBeInstanceOf(Array)
    })

    it('should provide optimization recommendations', () => {
      // Simulate high failure rate
      for (let i = 0; i < 10; i++) {
        MemoryPerformanceMonitor.recordMetrics('high_failure_op', Date.now() - 1000, false)
      }

      const recommendations = MemoryPerformanceMonitor.getOptimizationRecommendations()
      
      expect(recommendations.length).toBeGreaterThan(0)
      expect(recommendations.some(r => r.includes('failure rate'))).toBe(true)
    })
  })

  describe('Memory Usage Monitoring', () => {
    it('should track memory usage in metrics', () => {
      MemoryPerformanceMonitor.recordMetrics('memory_test', Date.now() - 1000, true)

      const stats = MemoryPerformanceMonitor.getPerformanceStats('memory_test')
      expect(stats.totalOperations).toBe(1)

      const report = MemoryPerformanceMonitor.getPerformanceReport()
      expect(report.summary.memoryUsage.current).toBeGreaterThan(0)
    })
  })

  describe('Export Functionality', () => {
    it('should export performance data', () => {
      // Record some test data
      MemoryPerformanceMonitor.recordMetrics('export_test', Date.now() - 1000, true)
      MemoryPerformanceMonitor.setCached('export_cache_key', { test: 'data' })

      const exportData = MemoryPerformanceMonitor.exportPerformanceData()

      expect(exportData.metrics).toBeInstanceOf(Array)
      expect(exportData.stats).toBeInstanceOf(Array)
      expect(exportData.cacheStats).toBeDefined()
      expect(exportData.recommendations).toBeInstanceOf(Array)
    })
  })
})

describe('Memory Service Performance Integration', () => {
  beforeEach(() => {
    MemoryPerformanceMonitor.clearCache()
    vi.clearAllMocks()
  })

  afterEach(() => {
    MemoryPerformanceMonitor.clearCache()
  })

  it('should track performance for memory extraction', async () => {
    const result = await MemoryService.Extraction.extractMemoryFragments(
      'I love hiking with my dog Max',
      'user-123'
    )

    expect(result).toBeInstanceOf(Array)

    const stats = MemoryPerformanceMonitor.getPerformanceStats('memory_extraction')
    expect(stats.totalOperations).toBe(1)
  })

  it('should use caching for user memories retrieval', async () => {
    const userId = 'user-123'
    
    // First call should hit database
    const result1 = await MemoryService.Retrieval.getUserMemories(userId)
    
    // Second call should use cache
    const result2 = await MemoryService.Retrieval.getUserMemories(userId)

    expect(result1).toEqual(result2)

    // Check cache metrics
    const cacheStats = MemoryPerformanceMonitor.getCacheStats()
    expect(cacheStats.totalEntries).toBeGreaterThan(0)
  })

  it('should use caching for relevant memories retrieval', async () => {
    const query = 'hiking'
    const userId = 'user-123'
    
    // First call
    const result1 = await MemoryService.Retrieval.retrieveRelevantMemories(query, userId)
    
    // Second call with same parameters should use cache
    const result2 = await MemoryService.Retrieval.retrieveRelevantMemories(query, userId)

    expect(result1).toEqual(result2)

    const cacheStats = MemoryPerformanceMonitor.getCacheStats()
    expect(cacheStats.totalEntries).toBeGreaterThan(0)
  })
})

describe('Load Testing Simulation', () => {
  beforeEach(() => {
    MemoryPerformanceMonitor.clearCache()
    vi.clearAllMocks()
  })

  afterEach(() => {
    MemoryPerformanceMonitor.clearCache()
  })

  it('should handle concurrent operations efficiently', async () => {
    const concurrentOperations = 50
    const operations: Promise<any>[] = []

    // Simulate concurrent memory extractions
    for (let i = 0; i < concurrentOperations; i++) {
      operations.push(
        MemoryService.Extraction.extractMemoryFragments(
          `Test message ${i} with some personal information`,
          `user-${i % 10}` // 10 different users
        )
      )
    }

    const startTime = Date.now()
    const results = await Promise.all(operations)
    const duration = Date.now() - startTime

    expect(results).toHaveLength(concurrentOperations)
    expect(duration).toBeLessThan(10000) // Should complete within 10 seconds

    const stats = MemoryPerformanceMonitor.getPerformanceStats('memory_extraction')
    expect(stats.totalOperations).toBe(concurrentOperations)
    expect(stats.operationsPerSecond).toBeGreaterThan(0)
  })

  it('should maintain cache efficiency under load', async () => {
    const userId = 'load-test-user'
    const operations: Promise<any>[] = []

    // Simulate multiple requests for the same user's memories
    for (let i = 0; i < 20; i++) {
      operations.push(
        MemoryService.Retrieval.getUserMemories(userId, { limit: 10 })
      )
    }

    const results = await Promise.all(operations)
    
    // All results should be identical (cached)
    expect(results.every(result => JSON.stringify(result) === JSON.stringify(results[0]))).toBe(true)

    const cacheStats = MemoryPerformanceMonitor.getCacheStats()
    expect(cacheStats.hitRate).toBeGreaterThan(0.8) // Should have high cache hit rate
  })

  it('should handle memory pressure gracefully', async () => {
    // Simulate operations that would use significant memory
    const largeOperations: Promise<any>[] = []

    for (let i = 0; i < 100; i++) {
      // Create large cache entries
      const largeData = new Array(1000).fill(`Large data item ${i}`)
      MemoryPerformanceMonitor.setCached(`large_key_${i}`, largeData)
    }

    // Check that system is still responsive
    const testOperation = async () => {
      return await MemoryService.Extraction.extractMemoryFragments(
        'Test message for memory pressure test',
        'pressure-test-user'
      )
    }

    const result = await MemoryPerformanceMonitor.withPerformanceTracking(
      'memory_pressure_test',
      testOperation
    )

    expect(result).toBeInstanceOf(Array)

    const report = MemoryPerformanceMonitor.getPerformanceReport()
    expect(report.recommendations).toBeInstanceOf(Array)
  })

  it('should provide performance insights for optimization', () => {
    // Simulate various operation patterns
    const operationTypes = ['extraction', 'storage', 'retrieval', 'search']
    
    operationTypes.forEach(opType => {
      // Simulate different performance characteristics
      for (let i = 0; i < 20; i++) {
        const duration = Math.random() * 5000 // 0-5 seconds
        const success = Math.random() > 0.1 // 90% success rate
        
        MemoryPerformanceMonitor.recordMetrics(
          opType,
          Date.now() - duration,
          success,
          { simulatedLoad: true }
        )
      }
    })

    const report = MemoryPerformanceMonitor.getPerformanceReport()
    
    expect(report.operationStats).toHaveLength(4)
    expect(report.summary.totalOperations).toBe(80)
    expect(report.recommendations).toBeInstanceOf(Array)

    // Check that we get meaningful performance insights
    const slowOperations = report.operationStats.filter(stat => stat.averageDuration > 2000)
    if (slowOperations.length > 0) {
      expect(report.recommendations.some(r => r.includes('optimization'))).toBe(true)
    }
  })
})