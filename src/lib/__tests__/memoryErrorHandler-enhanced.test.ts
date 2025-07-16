import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OpenAI } from 'openai'
import { 
  MemoryErrorHandler, 
  MemoryError, 
  MemoryErrorType 
} from '../memoryErrorHandler'

// Mock OpenAI
vi.mock('openai', () => ({
  OpenAI: {
    APIError: class APIError extends Error {
      status: number
      type: string
      
      constructor(message: string, request: any, status: number, headers: any) {
        super(message)
        this.name = 'APIError'
        this.status = status
        this.type = 'api_error'
      }
    }
  }
}))

describe('MemoryErrorHandler - Enhanced Features', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset error counts and circuit breakers
    MemoryErrorHandler['errorCounts'].clear()
    MemoryErrorHandler['circuitBreakers'].clear()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  describe('Circuit Breaker Functionality', () => {
    it('should open circuit breaker after threshold failures', async () => {
      vi.useFakeTimers()
      const operation = vi.fn().mockRejectedValue(new OpenAI.APIError('Server error', null, 500, {}))

      // Trigger failures to open circuit breaker (5 failures)
      for (let i = 0; i < 5; i++) {
        try {
          const promise = MemoryErrorHandler.withRetry(operation, 'openai')
          // Fast-forward through retry delays
          await vi.advanceTimersByTimeAsync(15000)
          await promise
        } catch (error) {
          // Expected to fail
        }
      }

      const status = MemoryErrorHandler.getCircuitBreakerStatus()
      expect(status.openai?.isOpen).toBe(true)
      expect(status.openai?.failureCount).toBeGreaterThanOrEqual(5)
    })

    it('should prevent operations when circuit breaker is open', async () => {
      vi.useFakeTimers()
      const operation = vi.fn().mockRejectedValue(new OpenAI.APIError('Server error', null, 500, {}))

      // Open the circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          const promise = MemoryErrorHandler.withRetry(operation, 'openai')
          await vi.advanceTimersByTimeAsync(15000)
          await promise
        } catch (error) {
          // Expected to fail
        }
      }

      // Reset call count to test next operation
      operation.mockClear()

      // Next operation should fail immediately due to open circuit breaker
      await expect(MemoryErrorHandler.withRetry(operation, 'openai')).rejects.toThrow('Circuit breaker is open')
      
      // Operation should not have been called at all
      expect(operation).not.toHaveBeenCalled()
    })

    it('should reset circuit breaker on successful operation', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new OpenAI.APIError('Server error', null, 500, {}))
        .mockResolvedValue('success')

      vi.useFakeTimers()
      const promise = MemoryErrorHandler.withRetry(operation, 'openai')
      await vi.advanceTimersByTimeAsync(5000)
      const result = await promise

      expect(result).toBe('success')

      const status = MemoryErrorHandler.getCircuitBreakerStatus()
      expect(status.openai?.failureCount).toBe(0)
      expect(status.openai?.isOpen).toBe(false)
    })

    it('should allow manual circuit breaker reset', () => {
      // Manually create an open circuit breaker
      MemoryErrorHandler['circuitBreakers'].set('openai', {
        isOpen: true,
        failureCount: 5,
        lastFailureTime: new Date(),
        nextAttemptTime: new Date(Date.now() + 60000)
      })

      // Manually reset
      MemoryErrorHandler.resetCircuitBreaker('openai')

      const status = MemoryErrorHandler.getCircuitBreakerStatus()
      expect(status.openai?.isOpen).toBe(false)
      expect(status.openai?.failureCount).toBe(0)
    })

    it('should enter half-open state after recovery time', async () => {
      vi.useFakeTimers()
      
      // Manually create an open circuit breaker
      const now = new Date()
      MemoryErrorHandler['circuitBreakers'].set('openai', {
        isOpen: true,
        failureCount: 5,
        lastFailureTime: now,
        nextAttemptTime: new Date(now.getTime() + 60000)
      })

      // Fast-forward past recovery time
      vi.advanceTimersByTime(61000)

      const operation = vi.fn().mockResolvedValue('success')
      const result = await MemoryErrorHandler.withRetry(operation, 'openai')
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })
  })

  describe('Enhanced Monitoring and Health Reporting', () => {
    it('should provide comprehensive system health report', () => {
      // Manually add some error counts
      MemoryErrorHandler['errorCounts'].set('openai_2025-07-16', 5)
      MemoryErrorHandler['errorCounts'].set('database_2025-07-16', 2)

      const healthReport = MemoryErrorHandler.getSystemHealthReport()

      expect(healthReport.isHealthy).toBeDefined()
      expect(healthReport.totalErrors).toBe(7)
      expect(healthReport.errorsByType).toEqual({
        'openai_2025-07-16': 5,
        'database_2025-07-16': 2
      })
      expect(healthReport.circuitBreakers).toBeDefined()
      expect(Array.isArray(healthReport.recommendations)).toBe(true)
    })

    it('should provide recommendations based on error patterns', () => {
      // Simulate high OpenAI rate limit errors
      MemoryErrorHandler['errorCounts'].set('openai_2025-07-16', 15)

      const healthReport = MemoryErrorHandler.getSystemHealthReport()
      
      expect(healthReport.recommendations).toContain(
        'High OpenAI rate limit errors. Consider implementing request throttling.'
      )
    })

    it('should track circuit breaker status in health report', () => {
      // Create an open circuit breaker
      MemoryErrorHandler['circuitBreakers'].set('openai', {
        isOpen: true,
        failureCount: 5,
        lastFailureTime: new Date(),
        nextAttemptTime: new Date(Date.now() + 30000)
      })

      const healthReport = MemoryErrorHandler.getSystemHealthReport()
      
      expect(healthReport.circuitBreakers.openai?.isOpen).toBe(true)
      expect(healthReport.recommendations).toContain(
        'Circuit breakers open for: openai'
      )
    })

    it('should report system as unhealthy when circuit breakers are open', () => {
      // Create an open circuit breaker
      MemoryErrorHandler['circuitBreakers'].set('openai', {
        isOpen: true,
        failureCount: 5,
        lastFailureTime: new Date(),
        nextAttemptTime: new Date(Date.now() + 30000)
      })

      expect(MemoryErrorHandler.isSystemHealthy()).toBe(false)
    })

    it('should calculate time until recovery for open circuit breakers', () => {
      // Create an open circuit breaker with future recovery time
      const now = new Date()
      const nextAttempt = new Date(now.getTime() + 30000) // 30 seconds from now
      
      MemoryErrorHandler['circuitBreakers'].set('test_service', {
        isOpen: true,
        failureCount: 5,
        lastFailureTime: now,
        nextAttemptTime: nextAttempt
      })

      const status = MemoryErrorHandler.getCircuitBreakerStatus()
      
      expect(status.test_service?.timeUntilRecovery).toBeGreaterThan(0)
      expect(status.test_service?.timeUntilRecovery).toBeLessThanOrEqual(30000)
    })
  })

  describe('Error Recovery Scenarios', () => {
    it('should handle cascading failures gracefully', async () => {
      const extractionOperation = vi.fn().mockRejectedValue(new OpenAI.APIError('Rate limit', null, 429, {}))
      const embeddingOperation = vi.fn().mockRejectedValue(new OpenAI.APIError('Rate limit', null, 429, {}))
      const databaseOperation = vi.fn().mockRejectedValue(new Error('Connection failed'))

      // Test that multiple service failures don't crash the system
      const results = await Promise.allSettled([
        MemoryErrorHandler.withGracefulDegradation(extractionOperation, () => [], 'memory_extraction'),
        MemoryErrorHandler.withGracefulDegradation(embeddingOperation, () => [], 'embedding_generation'),
        MemoryErrorHandler.withGracefulDegradation(databaseOperation, () => [], 'database_query')
      ])

      // All should resolve with fallback values
      results.forEach(result => {
        expect(result.status).toBe('fulfilled')
        expect((result as PromiseFulfilledResult<any>).value).toEqual([])
      })
    })

    it('should maintain service isolation during failures', async () => {
      vi.useFakeTimers()
      
      // Create an open circuit breaker for OpenAI
      MemoryErrorHandler['circuitBreakers'].set('openai', {
        isOpen: true,
        failureCount: 5,
        lastFailureTime: new Date(),
        nextAttemptTime: new Date(Date.now() + 60000)
      })

      const databaseOperation = vi.fn().mockResolvedValue('database success')

      // Database operations should still work
      const result = await MemoryErrorHandler.withRetry(databaseOperation, 'database')
      expect(result).toBe('database success')

      const status = MemoryErrorHandler.getCircuitBreakerStatus()
      expect(status.openai?.isOpen).toBe(true)
      expect(status.database?.isOpen).toBeFalsy()
    })

    it('should handle partial service recovery', async () => {
      vi.useFakeTimers()
      
      // Create an open circuit breaker
      const now = new Date()
      MemoryErrorHandler['circuitBreakers'].set('openai', {
        isOpen: true,
        failureCount: 5,
        lastFailureTime: now,
        nextAttemptTime: new Date(now.getTime() + 60000)
      })

      // Fast-forward to recovery time
      vi.advanceTimersByTime(61000)

      // Service recovers
      const openaiOperation = vi.fn().mockResolvedValue('recovered')
      
      const result = await MemoryErrorHandler.withRetry(openaiOperation, 'openai')
      expect(result).toBe('recovered')

      const status = MemoryErrorHandler.getCircuitBreakerStatus()
      expect(status.openai?.isOpen).toBe(false)
      expect(status.openai?.failureCount).toBe(0)
    })
  })

  describe('Error Logging and Context', () => {
    it('should log circuit breaker events', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      // Manually trigger circuit breaker opening
      MemoryErrorHandler['updateCircuitBreaker']('test_service', false)
      MemoryErrorHandler['updateCircuitBreaker']('test_service', false)
      MemoryErrorHandler['updateCircuitBreaker']('test_service', false)
      MemoryErrorHandler['updateCircuitBreaker']('test_service', false)
      MemoryErrorHandler['updateCircuitBreaker']('test_service', false) // This should open the breaker

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker opened for test_service')
      )
      
      consoleSpy.mockRestore()
    })

    it('should log graceful degradation events', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const operation = vi.fn().mockRejectedValue(new Error('Test error'))
      const fallback = vi.fn().mockReturnValue('fallback')

      await MemoryErrorHandler.withGracefulDegradation(operation, fallback, 'test_operation')

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Operation test_operation failed, using fallback:'),
        expect.any(String)
      )
      
      consoleSpy.mockRestore()
    })

    it('should include enhanced context in error categorization', () => {
      const error = new OpenAI.APIError('Rate limit exceeded', null, 429, {})
      const context = { 
        userId: 'test-user', 
        operation: 'test_op',
        attempt: 1,
        maxAttempts: 3
      }

      const memoryError = MemoryErrorHandler.categorizeError(error, context)

      expect(memoryError.context).toEqual({
        userId: 'test-user',
        operation: 'test_op',
        attempt: 1,
        maxAttempts: 3,
        status: 429,
        type: 'api_error'
      })
      expect(memoryError.type).toBe(MemoryErrorType.OPENAI_RATE_LIMIT)
      expect(memoryError.isRetryable).toBe(true)
    })
  })

  describe('System Health Monitoring', () => {
    it('should track error counts correctly', () => {
      // Manually increment error counts
      MemoryErrorHandler['incrementErrorCount']('test_operation')
      MemoryErrorHandler['incrementErrorCount']('test_operation')
      MemoryErrorHandler['incrementErrorCount']('another_operation')

      const stats = MemoryErrorHandler.getErrorStats()
      const today = new Date().toISOString().split('T')[0]
      
      expect(stats[`test_operation_${today}`]).toBe(2)
      expect(stats[`another_operation_${today}`]).toBe(1)
    })

    it('should report system health based on error counts and circuit breakers', () => {
      // Initially healthy
      expect(MemoryErrorHandler.isSystemHealthy()).toBe(true)

      // Add many errors
      for (let i = 0; i < 60; i++) {
        MemoryErrorHandler['incrementErrorCount']('test_operation')
      }

      expect(MemoryErrorHandler.isSystemHealthy()).toBe(false)

      // Reset errors but add open circuit breaker
      MemoryErrorHandler['errorCounts'].clear()
      MemoryErrorHandler['circuitBreakers'].set('openai', {
        isOpen: true,
        failureCount: 5,
        lastFailureTime: new Date(),
        nextAttemptTime: new Date(Date.now() + 60000)
      })

      expect(MemoryErrorHandler.isSystemHealthy()).toBe(false)
    })

    it('should provide actionable recommendations', () => {
      // High error rate
      for (let i = 0; i < 35; i++) {
        MemoryErrorHandler['incrementErrorCount']('test_operation')
      }

      // High OpenAI errors
      for (let i = 0; i < 15; i++) {
        MemoryErrorHandler['incrementErrorCount']('openai')
      }

      // High database errors
      for (let i = 0; i < 8; i++) {
        MemoryErrorHandler['incrementErrorCount']('database')
      }

      // Open circuit breaker
      MemoryErrorHandler['circuitBreakers'].set('openai', {
        isOpen: true,
        failureCount: 5,
        lastFailureTime: new Date(),
        nextAttemptTime: new Date(Date.now() + 60000)
      })

      const healthReport = MemoryErrorHandler.getSystemHealthReport()

      expect(healthReport.recommendations).toContain(
        'High error rate detected. Consider investigating root causes.'
      )
      expect(healthReport.recommendations).toContain(
        'Circuit breakers open for: openai'
      )
      expect(healthReport.recommendations).toContain(
        'High OpenAI rate limit errors. Consider implementing request throttling.'
      )
      expect(healthReport.recommendations).toContain(
        'Database connection issues detected. Check database health.'
      )
    })
  })
})