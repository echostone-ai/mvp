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

describe('MemoryErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset error counts
    MemoryErrorHandler['errorCounts'].clear()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('MemoryError', () => {
    it('should create a memory error with correct properties', () => {
      const error = new MemoryError(
        MemoryErrorType.OPENAI_RATE_LIMIT,
        'Rate limit exceeded',
        {
          isRetryable: true,
          context: { userId: 'test-user' },
          originalError: new Error('Original error')
        }
      )

      expect(error.type).toBe(MemoryErrorType.OPENAI_RATE_LIMIT)
      expect(error.message).toBe('Rate limit exceeded')
      expect(error.isRetryable).toBe(true)
      expect(error.context).toEqual({ userId: 'test-user' })
      expect(error.originalError).toBeInstanceOf(Error)
      expect(error.timestamp).toBeInstanceOf(Date)
    })

    it('should serialize to JSON correctly', () => {
      const error = new MemoryError(
        MemoryErrorType.DATABASE_CONNECTION,
        'Connection failed'
      )

      const json = error.toJSON()
      expect(json.name).toBe('MemoryError')
      expect(json.type).toBe(MemoryErrorType.DATABASE_CONNECTION)
      expect(json.message).toBe('Connection failed')
      expect(json.timestamp).toBeDefined()
    })
  })

  describe('categorizeError', () => {
    it('should categorize OpenAI rate limit errors correctly', () => {
      const openaiError = new OpenAI.APIError('Rate limit exceeded', null, 429, {})
      const memoryError = MemoryErrorHandler.categorizeError(openaiError)

      expect(memoryError.type).toBe(MemoryErrorType.OPENAI_RATE_LIMIT)
      expect(memoryError.isRetryable).toBe(true)
    })

    it('should categorize OpenAI quota exceeded errors correctly', () => {
      const openaiError = new OpenAI.APIError('Quota exceeded', null, 402, {})
      const memoryError = MemoryErrorHandler.categorizeError(openaiError)

      expect(memoryError.type).toBe(MemoryErrorType.OPENAI_QUOTA_EXCEEDED)
      expect(memoryError.isRetryable).toBe(false)
    })

    it('should categorize OpenAI server errors as retryable', () => {
      const openaiError = new OpenAI.APIError('Internal server error', null, 500, {})
      const memoryError = MemoryErrorHandler.categorizeError(openaiError)

      expect(memoryError.type).toBe(MemoryErrorType.OPENAI_API_ERROR)
      expect(memoryError.isRetryable).toBe(true)
    })

    it('should categorize timeout errors correctly', () => {
      const timeoutError = new Error('Request timeout')
      timeoutError.name = 'TimeoutError'
      
      const memoryError = MemoryErrorHandler.categorizeError(timeoutError, { operation: 'openai_embedding' })

      expect(memoryError.type).toBe(MemoryErrorType.OPENAI_TIMEOUT)
      expect(memoryError.isRetryable).toBe(true)
    })

    it('should categorize database connection errors correctly', () => {
      const dbError = new Error('Connection refused')
      ;(dbError as any).code = '08001' // PostgreSQL connection error

      const memoryError = MemoryErrorHandler.categorizeError(dbError)

      expect(memoryError.type).toBe(MemoryErrorType.DATABASE_CONNECTION)
      expect(memoryError.isRetryable).toBe(true)
    })

    it('should categorize constraint violations as non-retryable', () => {
      const dbError = new Error('Unique constraint violation')
      ;(dbError as any).code = '23505' // PostgreSQL unique violation

      const memoryError = MemoryErrorHandler.categorizeError(dbError)

      expect(memoryError.type).toBe(MemoryErrorType.DATABASE_CONSTRAINT)
      expect(memoryError.isRetryable).toBe(false)
    })

    it('should categorize Supabase not found errors correctly', () => {
      const supabaseError = new Error('No rows returned')
      ;(supabaseError as any).code = 'PGRST116'

      const memoryError = MemoryErrorHandler.categorizeError(supabaseError)

      expect(memoryError.type).toBe(MemoryErrorType.INVALID_MEMORY_ID)
      expect(memoryError.isRetryable).toBe(false)
    })

    it('should categorize auth errors correctly', () => {
      const authError = new Error('JWT token invalid')

      const memoryError = MemoryErrorHandler.categorizeError(authError)

      expect(memoryError.type).toBe(MemoryErrorType.UNAUTHORIZED)
      expect(memoryError.isRetryable).toBe(false)
    })

    it('should categorize unknown errors correctly', () => {
      const unknownError = new Error('Something went wrong')

      const memoryError = MemoryErrorHandler.categorizeError(unknownError)

      expect(memoryError.type).toBe(MemoryErrorType.UNKNOWN)
      expect(memoryError.isRetryable).toBe(false)
    })
  })

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success')

      const result = await MemoryErrorHandler.withRetry(operation, 'openai')

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry on retryable errors', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new OpenAI.APIError('Rate limit', null, 429, {}))
        .mockResolvedValue('success')

      vi.useFakeTimers()

      const resultPromise = MemoryErrorHandler.withRetry(operation, 'openai')
      
      // Fast-forward through the retry delay
      await vi.advanceTimersByTimeAsync(2000)
      
      const result = await resultPromise

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })

    it('should not retry non-retryable errors', async () => {
      const operation = vi.fn()
        .mockRejectedValue(new OpenAI.APIError('Bad request', null, 400, {}))

      await expect(MemoryErrorHandler.withRetry(operation, 'openai')).rejects.toThrow()
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should exhaust retries and throw last error', async () => {
      const operation = vi.fn()
        .mockRejectedValue(new OpenAI.APIError('Rate limit', null, 429, {}))

      vi.useFakeTimers()

      const resultPromise = MemoryErrorHandler.withRetry(operation, 'openai')
      
      // Fast-forward through all retry delays
      await vi.advanceTimersByTimeAsync(20000)
      
      await expect(resultPromise).rejects.toThrow('OpenAI API rate limit exceeded')
      expect(operation).toHaveBeenCalledTimes(3) // Initial + 2 retries

      vi.useRealTimers()
    })

    it('should apply exponential backoff', async () => {
      const operation = vi.fn()
        .mockRejectedValue(new OpenAI.APIError('Rate limit', null, 429, {}))

      vi.useFakeTimers()
      const startTime = Date.now()

      const resultPromise = MemoryErrorHandler.withRetry(operation, 'openai')
      
      // Fast-forward and check timing
      await vi.advanceTimersByTimeAsync(1000) // First retry delay
      await vi.advanceTimersByTimeAsync(2000) // Second retry delay (exponential)
      await vi.advanceTimersByTimeAsync(1000) // Buffer for jitter
      
      await expect(resultPromise).rejects.toThrow()

      vi.useRealTimers()
    })
  })

  describe('withGracefulDegradation', () => {
    it('should return operation result on success', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      const fallback = vi.fn().mockResolvedValue('fallback')

      const result = await MemoryErrorHandler.withGracefulDegradation(
        operation,
        fallback,
        'test_operation'
      )

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
      expect(fallback).not.toHaveBeenCalled()
    })

    it('should use fallback on operation failure', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Operation failed'))
      const fallback = vi.fn().mockResolvedValue('fallback')

      const result = await MemoryErrorHandler.withGracefulDegradation(
        operation,
        fallback,
        'test_operation'
      )

      expect(result).toBe('fallback')
      expect(operation).toHaveBeenCalledTimes(1)
      expect(fallback).toHaveBeenCalledTimes(1)
    })

    it('should handle async fallback functions', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Operation failed'))
      const fallback = vi.fn().mockResolvedValue('async fallback')

      const result = await MemoryErrorHandler.withGracefulDegradation(
        operation,
        fallback,
        'test_operation'
      )

      expect(result).toBe('async fallback')
    })

    it('should handle sync fallback functions', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Operation failed'))
      const fallback = vi.fn().mockReturnValue('sync fallback')

      const result = await MemoryErrorHandler.withGracefulDegradation(
        operation,
        fallback,
        'test_operation'
      )

      expect(result).toBe('sync fallback')
    })
  })

  describe('getUserFriendlyMessage', () => {
    it('should return appropriate message for rate limit errors', () => {
      const error = new MemoryError(MemoryErrorType.OPENAI_RATE_LIMIT, 'Rate limit')
      const message = MemoryErrorHandler.getUserFriendlyMessage(error)

      expect(message).toBe('The AI service is currently busy. Please try again in a moment.')
    })

    it('should return appropriate message for quota exceeded errors', () => {
      const error = new MemoryError(MemoryErrorType.OPENAI_QUOTA_EXCEEDED, 'Quota exceeded')
      const message = MemoryErrorHandler.getUserFriendlyMessage(error)

      expect(message).toBe('The AI service quota has been exceeded. Please contact support.')
    })

    it('should return appropriate message for database connection errors', () => {
      const error = new MemoryError(MemoryErrorType.DATABASE_CONNECTION, 'Connection failed')
      const message = MemoryErrorHandler.getUserFriendlyMessage(error)

      expect(message).toBe('Unable to connect to the database. Please check your connection and try again.')
    })

    it('should return appropriate message for unauthorized errors', () => {
      const error = new MemoryError(MemoryErrorType.UNAUTHORIZED, 'Not authorized')
      const message = MemoryErrorHandler.getUserFriendlyMessage(error)

      expect(message).toBe('Please log in to access your memories.')
    })

    it('should return generic message for unknown errors', () => {
      const error = new MemoryError(MemoryErrorType.UNKNOWN, 'Unknown error')
      const message = MemoryErrorHandler.getUserFriendlyMessage(error)

      expect(message).toBe('An unexpected error occurred. Please try again.')
    })
  })

  describe('error tracking and monitoring', () => {
    it('should track error counts', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Test error'))

      try {
        await MemoryErrorHandler.withRetry(operation, 'openai')
      } catch (error) {
        // Expected to fail
      }

      const stats = MemoryErrorHandler.getErrorStats()
      expect(Object.keys(stats).length).toBeGreaterThan(0)
    })

    it('should report system health correctly', () => {
      // Initially healthy
      expect(MemoryErrorHandler.isSystemHealthy()).toBe(true)

      // Simulate many errors
      for (let i = 0; i < 60; i++) {
        MemoryErrorHandler['incrementErrorCount']('test_operation')
      }

      expect(MemoryErrorHandler.isSystemHealthy()).toBe(false)
    })

    it('should reset error counts daily', () => {
      MemoryErrorHandler['incrementErrorCount']('test_operation')
      
      // Simulate day passing
      const originalDate = MemoryErrorHandler['lastErrorReset']
      MemoryErrorHandler['lastErrorReset'] = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
      
      MemoryErrorHandler['incrementErrorCount']('test_operation')
      
      const stats = MemoryErrorHandler.getErrorStats()
      expect(Object.keys(stats).length).toBe(1) // Should have cleared old errors
    })
  })

  describe('circuit breaker functionality', () => {
    beforeEach(() => {
      // Reset circuit breakers
      MemoryErrorHandler['circuitBreakers'].clear()
    })

    it('should open circuit breaker after threshold failures', async () => {
      const operation = vi.fn().mockRejectedValue(new OpenAI.APIError('Server error', null, 500, {}))

      // Trigger failures to open circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await MemoryErrorHandler.withRetry(operation, 'openai')
        } catch (error) {
          // Expected to fail
        }
      }

      const status = MemoryErrorHandler.getCircuitBreakerStatus()
      expect(status.openai?.isOpen).toBe(true)
      expect(status.openai?.failureCount).toBe(5)
    })

    it('should prevent operations when circuit breaker is open', async () => {
      const operation = vi.fn().mockRejectedValue(new OpenAI.APIError('Server error', null, 500, {}))

      // Open the circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await MemoryErrorHandler.withRetry(operation, 'openai')
        } catch (error) {
          // Expected to fail
        }
      }

      // Next operation should fail immediately due to open circuit breaker
      await expect(MemoryErrorHandler.withRetry(operation, 'openai')).rejects.toThrow('Circuit breaker is open')
      
      // Operation should not have been called
      expect(operation).toHaveBeenCalledTimes(15) // 5 attempts × 3 retries each
    })

    it('should reset circuit breaker on successful operation', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new OpenAI.APIError('Server error', null, 500, {}))
        .mockResolvedValue('success')

      await MemoryErrorHandler.withRetry(operation, 'openai')

      const status = MemoryErrorHandler.getCircuitBreakerStatus()
      expect(status.openai?.failureCount).toBe(0)
      expect(status.openai?.isOpen).toBe(false)
    })

    it('should allow manual circuit breaker reset', async () => {
      const operation = vi.fn().mockRejectedValue(new OpenAI.APIError('Server error', null, 500, {}))

      // Open the circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await MemoryErrorHandler.withRetry(operation, 'openai')
        } catch (error) {
          // Expected to fail
        }
      }

      // Manually reset
      MemoryErrorHandler.resetCircuitBreaker('openai')

      const status = MemoryErrorHandler.getCircuitBreakerStatus()
      expect(status.openai?.isOpen).toBe(false)
      expect(status.openai?.failureCount).toBe(0)
    })

    it('should enter half-open state after recovery time', async () => {
      vi.useFakeTimers()
      
      const operation = vi.fn().mockRejectedValue(new OpenAI.APIError('Server error', null, 500, {}))

      // Open the circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await MemoryErrorHandler.withRetry(operation, 'openai')
        } catch (error) {
          // Expected to fail
        }
      }

      // Fast-forward past recovery time
      vi.advanceTimersByTime(61000) // 61 seconds

      // Next operation should be allowed (half-open state)
      operation.mockResolvedValueOnce('success')
      const result = await MemoryErrorHandler.withRetry(operation, 'openai')
      
      expect(result).toBe('success')

      vi.useRealTimers()
    })
  })

  describe('enhanced monitoring and health reporting', () => {
    beforeEach(() => {
      MemoryErrorHandler['errorCounts'].clear()
      MemoryErrorHandler['circuitBreakers'].clear()
    })

    it('should provide comprehensive system health report', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Test error'))

      // Generate some errors
      for (let i = 0; i < 3; i++) {
        try {
          await MemoryErrorHandler.withRetry(operation, 'database')
        } catch (error) {
          // Expected to fail
        }
      }

      const healthReport = MemoryErrorHandler.getSystemHealthReport()

      expect(healthReport.isHealthy).toBeDefined()
      expect(healthReport.totalErrors).toBeGreaterThan(0)
      expect(healthReport.errorsByType).toBeDefined()
      expect(healthReport.circuitBreakers).toBeDefined()
      expect(Array.isArray(healthReport.recommendations)).toBe(true)
    })

    it('should provide recommendations based on error patterns', async () => {
      const openaiOperation = vi.fn().mockRejectedValue(new OpenAI.APIError('Rate limit', null, 429, {}))

      // Generate many OpenAI rate limit errors
      for (let i = 0; i < 15; i++) {
        try {
          await MemoryErrorHandler.withRetry(openaiOperation, 'openai')
        } catch (error) {
          // Expected to fail
        }
      }

      const healthReport = MemoryErrorHandler.getSystemHealthReport()
      
      expect(healthReport.recommendations).toContain(
        expect.stringContaining('OpenAI rate limit errors')
      )
    })

    it('should track circuit breaker status in health report', async () => {
      const operation = vi.fn().mockRejectedValue(new OpenAI.APIError('Server error', null, 500, {}))

      // Open circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await MemoryErrorHandler.withRetry(operation, 'openai')
        } catch (error) {
          // Expected to fail
        }
      }

      const healthReport = MemoryErrorHandler.getSystemHealthReport()
      
      expect(healthReport.circuitBreakers.openai?.isOpen).toBe(true)
      expect(healthReport.recommendations).toContain(
        expect.stringContaining('Circuit breakers open for: openai')
      )
    })

    it('should report system as unhealthy when circuit breakers are open', async () => {
      const operation = vi.fn().mockRejectedValue(new OpenAI.APIError('Server error', null, 500, {}))

      // Open circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await MemoryErrorHandler.withRetry(operation, 'openai')
        } catch (error) {
          // Expected to fail
        }
      }

      expect(MemoryErrorHandler.isSystemHealthy()).toBe(false)
    })

    it('should calculate time until recovery for open circuit breakers', () => {
      // Manually create an open circuit breaker
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

  describe('error recovery scenarios', () => {
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
      const openaiOperation = vi.fn().mockRejectedValue(new OpenAI.APIError('Server error', null, 500, {}))
      const databaseOperation = vi.fn().mockResolvedValue('database success')

      // Open OpenAI circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await MemoryErrorHandler.withRetry(openaiOperation, 'openai')
        } catch (error) {
          // Expected to fail
        }
      }

      // Database operations should still work
      const result = await MemoryErrorHandler.withRetry(databaseOperation, 'database')
      expect(result).toBe('database success')

      const status = MemoryErrorHandler.getCircuitBreakerStatus()
      expect(status.openai?.isOpen).toBe(true)
      expect(status.database?.isOpen).toBeFalsy()
    })

    it('should handle partial service recovery', async () => {
      vi.useFakeTimers()
      
      const openaiOperation = vi.fn()
        .mockRejectedValue(new OpenAI.APIError('Server error', null, 500, {}))

      // Open circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await MemoryErrorHandler.withRetry(openaiOperation, 'openai')
        } catch (error) {
          // Expected to fail
        }
      }

      // Fast-forward to recovery time
      vi.advanceTimersByTime(61000)

      // Service recovers
      openaiOperation.mockResolvedValue('recovered')
      
      const result = await MemoryErrorHandler.withRetry(openaiOperation, 'openai')
      expect(result).toBe('recovered')

      const status = MemoryErrorHandler.getCircuitBreakerStatus()
      expect(status.openai?.isOpen).toBe(false)
      expect(status.openai?.failureCount).toBe(0)

      vi.useRealTimers()
    })
  })

  describe('context and logging', () => {
    it('should include context in error categorization', () => {
      const error = new Error('Test error')
      const context = { userId: 'test-user', operation: 'test_op' }

      const memoryError = MemoryErrorHandler.categorizeError(error, context)

      expect(memoryError.context).toEqual(context)
    })

    it('should log errors with structured format', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const operation = vi.fn().mockRejectedValue(new Error('Test error'))
      const fallback = vi.fn().mockReturnValue('fallback')

      MemoryErrorHandler.withGracefulDegradation(operation, fallback, 'test_operation')

      expect(consoleSpy).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })

    it('should log circuit breaker events', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const operation = vi.fn().mockRejectedValue(new OpenAI.APIError('Server error', null, 500, {}))

      // Open circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await MemoryErrorHandler.withRetry(operation, 'openai')
        } catch (error) {
          // Expected to fail
        }
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker opened for openai')
      )
      
      consoleSpy.mockRestore()
    })
  })
})