// src/lib/memoryErrorHandler.ts
import { OpenAI } from 'openai'

/**
 * Error types for memory operations
 */
export enum MemoryErrorType {
  // OpenAI API Errors
  OPENAI_RATE_LIMIT = 'openai_rate_limit',
  OPENAI_API_ERROR = 'openai_api_error',
  OPENAI_TIMEOUT = 'openai_timeout',
  OPENAI_QUOTA_EXCEEDED = 'openai_quota_exceeded',
  
  // Database Errors
  DATABASE_CONNECTION = 'database_connection',
  DATABASE_QUERY = 'database_query',
  DATABASE_CONSTRAINT = 'database_constraint',
  DATABASE_TIMEOUT = 'database_timeout',
  
  // Validation Errors
  INVALID_INPUT = 'invalid_input',
  INVALID_USER_ID = 'invalid_user_id',
  INVALID_MEMORY_ID = 'invalid_memory_id',
  
  // Authorization Errors
  UNAUTHORIZED = 'unauthorized',
  FORBIDDEN = 'forbidden',
  
  // System Errors
  MEMORY_EXTRACTION_FAILED = 'memory_extraction_failed',
  EMBEDDING_GENERATION_FAILED = 'embedding_generation_failed',
  VECTOR_SEARCH_FAILED = 'vector_search_failed',
  
  // Unknown Errors
  UNKNOWN = 'unknown'
}

/**
 * Memory operation error with enhanced context
 */
export class MemoryError extends Error {
  public readonly type: MemoryErrorType
  public readonly isRetryable: boolean
  public readonly context: Record<string, any>
  public readonly timestamp: Date
  public readonly originalError?: Error

  constructor(
    type: MemoryErrorType,
    message: string,
    options: {
      isRetryable?: boolean
      context?: Record<string, any>
      originalError?: Error
    } = {}
  ) {
    super(message)
    this.name = 'MemoryError'
    this.type = type
    this.isRetryable = options.isRetryable ?? false
    this.context = options.context ?? {}
    this.timestamp = new Date()
    this.originalError = options.originalError

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MemoryError)
    }
  }

  /**
   * Convert to JSON for logging
   */
  toJSON() {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      isRetryable: this.isRetryable,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack
      } : undefined
    }
  }
}

/**
 * Retry configuration for different operation types
 */
interface RetryConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  retryableErrors: MemoryErrorType[]
}

const DEFAULT_RETRY_CONFIGS: Record<string, RetryConfig> = {
  openai: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    retryableErrors: [
      MemoryErrorType.OPENAI_RATE_LIMIT,
      MemoryErrorType.OPENAI_TIMEOUT,
      MemoryErrorType.OPENAI_API_ERROR
    ]
  },
  database: {
    maxAttempts: 2,
    baseDelay: 500,
    maxDelay: 2000,
    backoffMultiplier: 2,
    retryableErrors: [
      MemoryErrorType.DATABASE_CONNECTION,
      MemoryErrorType.DATABASE_TIMEOUT
    ]
  },
  vector_search: {
    maxAttempts: 2,
    baseDelay: 1000,
    maxDelay: 3000,
    backoffMultiplier: 2,
    retryableErrors: [
      MemoryErrorType.VECTOR_SEARCH_FAILED,
      MemoryErrorType.DATABASE_CONNECTION
    ]
  }
}

/**
 * Circuit breaker state for different services
 */
interface CircuitBreakerState {
  isOpen: boolean
  failureCount: number
  lastFailureTime: Date
  nextAttemptTime: Date
}

/**
 * Enhanced error handler with retry logic, monitoring, and circuit breaker
 */
export class MemoryErrorHandler {
  private static errorCounts: Map<string, number> = new Map()
  private static lastErrorReset: Date = new Date()
  private static circuitBreakers: Map<string, CircuitBreakerState> = new Map()
  
  // Circuit breaker configuration
  private static readonly CIRCUIT_BREAKER_CONFIG = {
    failureThreshold: 5,
    recoveryTimeMs: 60000, // 1 minute
    halfOpenMaxAttempts: 3
  }

  /**
   * Categorize and wrap errors with enhanced context
   */
  static categorizeError(error: any, context: Record<string, any> = {}): MemoryError {
    // OpenAI API errors
    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        return new MemoryError(
          MemoryErrorType.OPENAI_RATE_LIMIT,
          'OpenAI API rate limit exceeded',
          {
            isRetryable: true,
            context: { ...context, status: error.status, type: error.type },
            originalError: error
          }
        )
      }
      
      if (error.status === 402) {
        return new MemoryError(
          MemoryErrorType.OPENAI_QUOTA_EXCEEDED,
          'OpenAI API quota exceeded',
          {
            isRetryable: false,
            context: { ...context, status: error.status, type: error.type },
            originalError: error
          }
        )
      }

      if (error.status >= 500) {
        return new MemoryError(
          MemoryErrorType.OPENAI_API_ERROR,
          `OpenAI API server error: ${error.message}`,
          {
            isRetryable: true,
            context: { ...context, status: error.status, type: error.type },
            originalError: error
          }
        )
      }

      return new MemoryError(
        MemoryErrorType.OPENAI_API_ERROR,
        `OpenAI API error: ${error.message}`,
        {
          isRetryable: false,
          context: { ...context, status: error.status, type: error.type },
          originalError: error
        }
      )
    }

    // Timeout errors
    if (error.name === 'TimeoutError' || error.code === 'ETIMEDOUT') {
      const isOpenAI = context.operation?.includes('openai') || context.operation?.includes('embedding')
      return new MemoryError(
        isOpenAI ? MemoryErrorType.OPENAI_TIMEOUT : MemoryErrorType.DATABASE_TIMEOUT,
        `Operation timed out: ${error.message}`,
        {
          isRetryable: true,
          context,
          originalError: error
        }
      )
    }

    // Database errors (Supabase/PostgreSQL)
    if (error.code && typeof error.code === 'string') {
      // PostgreSQL error codes
      if (error.code.startsWith('08')) { // Connection errors
        return new MemoryError(
          MemoryErrorType.DATABASE_CONNECTION,
          `Database connection error: ${error.message}`,
          {
            isRetryable: true,
            context: { ...context, pgCode: error.code },
            originalError: error
          }
        )
      }

      if (error.code.startsWith('23')) { // Constraint violations
        return new MemoryError(
          MemoryErrorType.DATABASE_CONSTRAINT,
          `Database constraint violation: ${error.message}`,
          {
            isRetryable: false,
            context: { ...context, pgCode: error.code },
            originalError: error
          }
        )
      }

      if (error.code === 'PGRST116') { // Supabase: no rows returned
        return new MemoryError(
          MemoryErrorType.INVALID_MEMORY_ID,
          'Memory fragment not found',
          {
            isRetryable: false,
            context,
            originalError: error
          }
        )
      }
    }

    // Supabase auth errors
    if (error.message?.includes('JWT') || error.message?.includes('auth')) {
      return new MemoryError(
        MemoryErrorType.UNAUTHORIZED,
        'Authentication failed',
        {
          isRetryable: false,
          context,
          originalError: error
        }
      )
    }

    // Network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new MemoryError(
        MemoryErrorType.DATABASE_CONNECTION,
        `Network connection failed: ${error.message}`,
        {
          isRetryable: true,
          context: { ...context, networkCode: error.code },
          originalError: error
        }
      )
    }

    // Default to unknown error
    return new MemoryError(
      MemoryErrorType.UNKNOWN,
      error.message || 'Unknown error occurred',
      {
        isRetryable: false,
        context,
        originalError: error
      }
    )
  }

  /**
   * Check circuit breaker state before executing operation
   */
  private static checkCircuitBreaker(operationType: string): void {
    const breaker = this.circuitBreakers.get(operationType)
    if (!breaker) return

    const now = new Date()
    
    if (breaker.isOpen) {
      if (now < breaker.nextAttemptTime) {
        throw new MemoryError(
          MemoryErrorType.OPENAI_API_ERROR,
          `Circuit breaker is open for ${operationType}. Service temporarily unavailable.`,
          {
            isRetryable: false,
            context: { 
              circuitBreakerOpen: true,
              nextAttemptTime: breaker.nextAttemptTime.toISOString(),
              failureCount: breaker.failureCount
            }
          }
        )
      } else {
        // Half-open state - allow limited attempts
        breaker.isOpen = false
        console.log(`Circuit breaker for ${operationType} entering half-open state`)
      }
    }
  }

  /**
   * Update circuit breaker state based on operation result
   */
  private static updateCircuitBreaker(operationType: string, success: boolean): void {
    let breaker = this.circuitBreakers.get(operationType)
    
    if (!breaker) {
      breaker = {
        isOpen: false,
        failureCount: 0,
        lastFailureTime: new Date(),
        nextAttemptTime: new Date()
      }
      this.circuitBreakers.set(operationType, breaker)
    }

    if (success) {
      // Reset on success
      breaker.failureCount = 0
      breaker.isOpen = false
    } else {
      // Increment failure count
      breaker.failureCount++
      breaker.lastFailureTime = new Date()

      // Open circuit breaker if threshold exceeded
      if (breaker.failureCount >= this.CIRCUIT_BREAKER_CONFIG.failureThreshold) {
        breaker.isOpen = true
        breaker.nextAttemptTime = new Date(
          Date.now() + this.CIRCUIT_BREAKER_CONFIG.recoveryTimeMs
        )
        console.error(`Circuit breaker opened for ${operationType} after ${breaker.failureCount} failures`)
      }
    }
  }

  /**
   * Execute operation with retry logic, circuit breaker, and error handling
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    operationType: keyof typeof DEFAULT_RETRY_CONFIGS,
    context: Record<string, any> = {}
  ): Promise<T> {
    // Check circuit breaker before attempting operation
    this.checkCircuitBreaker(operationType)

    const config = DEFAULT_RETRY_CONFIGS[operationType]
    let lastError: MemoryError | null = null
    
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const result = await operation()
        
        // Update circuit breaker on success
        this.updateCircuitBreaker(operationType, true)
        
        // Reset error count on success
        if (lastError) {
          this.resetErrorCount(operationType)
        }
        
        return result
      } catch (error) {
        const memoryError = this.categorizeError(error, {
          ...context,
          operation: operationType,
          attempt,
          maxAttempts: config.maxAttempts
        })

        lastError = memoryError
        this.incrementErrorCount(operationType)

        // Update circuit breaker on failure
        this.updateCircuitBreaker(operationType, false)

        // Log the error with enhanced context
        this.logError(memoryError)

        // Don't retry if error is not retryable or we've reached max attempts
        if (!memoryError.isRetryable || attempt === config.maxAttempts) {
          break
        }

        // Don't retry if error type is not in retryable list
        if (!config.retryableErrors.includes(memoryError.type)) {
          break
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        )

        // Add jitter to prevent thundering herd
        const jitteredDelay = delay + Math.random() * 1000

        console.log(`Retrying ${operationType} operation in ${jitteredDelay}ms (attempt ${attempt}/${config.maxAttempts})`)
        
        await new Promise(resolve => setTimeout(resolve, jitteredDelay))
      }
    }

    // All retries exhausted, throw the last error
    throw lastError
  }

  /**
   * Execute operation with graceful degradation
   */
  static async withGracefulDegradation<T>(
    operation: () => Promise<T>,
    fallback: () => Promise<T> | T,
    operationType: string,
    context: Record<string, any> = {}
  ): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      const memoryError = this.categorizeError(error, {
        ...context,
        operation: operationType,
        gracefulDegradation: true
      })

      this.logError(memoryError)
      
      console.warn(`Operation ${operationType} failed, using fallback:`, memoryError.message)
      
      return await fallback()
    }
  }

  /**
   * Log errors with structured format
   */
  private static logError(error: MemoryError): void {
    const logData = {
      timestamp: error.timestamp.toISOString(),
      type: error.type,
      message: error.message,
      isRetryable: error.isRetryable,
      context: error.context,
      errorCount: this.getErrorCount(error.context.operation || 'unknown')
    }

    // Log at appropriate level based on error type
    if (error.type === MemoryErrorType.OPENAI_QUOTA_EXCEEDED) {
      console.error('CRITICAL: OpenAI quota exceeded', logData)
    } else if (error.isRetryable) {
      console.warn('Retryable error occurred', logData)
    } else {
      console.error('Non-retryable error occurred', logData)
    }

    // In development, also log the full error object
    if (process.env.NODE_ENV === 'development') {
      console.error('Full error details:', error.toJSON())
    }
  }

  /**
   * Track error counts for monitoring
   */
  private static incrementErrorCount(operation: string): void {
    const key = `${operation}_${new Date().toISOString().split('T')[0]}`
    const current = this.errorCounts.get(key) || 0
    this.errorCounts.set(key, current + 1)

    // Reset counts daily
    const now = new Date()
    if (now.getTime() - this.lastErrorReset.getTime() > 24 * 60 * 60 * 1000) {
      this.errorCounts.clear()
      this.lastErrorReset = now
    }
  }

  private static resetErrorCount(operation: string): void {
    const key = `${operation}_${new Date().toISOString().split('T')[0]}`
    this.errorCounts.delete(key)
  }

  private static getErrorCount(operation: string): number {
    const key = `${operation}_${new Date().toISOString().split('T')[0]}`
    return this.errorCounts.get(key) || 0
  }

  /**
   * Get error statistics for monitoring
   */
  static getErrorStats(): Record<string, number> {
    const stats: Record<string, number> = {}
    for (const [key, count] of this.errorCounts.entries()) {
      stats[key] = count
    }
    return stats
  }

  /**
   * Get circuit breaker status for all services
   */
  static getCircuitBreakerStatus(): Record<string, {
    isOpen: boolean
    failureCount: number
    lastFailureTime?: string
    nextAttemptTime?: string
    timeUntilRecovery?: number
  }> {
    const status: Record<string, any> = {}
    const now = new Date()
    
    for (const [service, breaker] of this.circuitBreakers.entries()) {
      status[service] = {
        isOpen: breaker.isOpen,
        failureCount: breaker.failureCount,
        lastFailureTime: breaker.lastFailureTime.toISOString(),
        nextAttemptTime: breaker.nextAttemptTime.toISOString(),
        timeUntilRecovery: breaker.isOpen ? 
          Math.max(0, breaker.nextAttemptTime.getTime() - now.getTime()) : 0
      }
    }
    
    return status
  }

  /**
   * Reset circuit breaker for a specific service (for manual recovery)
   */
  static resetCircuitBreaker(operationType: string): void {
    const breaker = this.circuitBreakers.get(operationType)
    if (breaker) {
      breaker.isOpen = false
      breaker.failureCount = 0
      breaker.nextAttemptTime = new Date()
      console.log(`Circuit breaker manually reset for ${operationType}`)
    }
  }

  /**
   * Check if system is experiencing high error rates
   */
  static isSystemHealthy(): boolean {
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0)
    const openCircuitBreakers = Array.from(this.circuitBreakers.values()).filter(b => b.isOpen).length
    
    return totalErrors < 50 && openCircuitBreakers === 0 // Threshold for daily errors and no open breakers
  }

  /**
   * Get comprehensive system health report
   */
  static getSystemHealthReport(): {
    isHealthy: boolean
    totalErrors: number
    errorsByType: Record<string, number>
    circuitBreakers: Record<string, any>
    recommendations: string[]
  } {
    const errorStats = this.getErrorStats()
    const circuitBreakerStatus = this.getCircuitBreakerStatus()
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0)
    const openBreakers = Object.entries(circuitBreakerStatus).filter(([_, status]) => status.isOpen)
    
    const recommendations: string[] = []
    
    // Analyze error patterns and provide recommendations
    if (totalErrors > 30) {
      recommendations.push('High error rate detected. Consider investigating root causes.')
    }
    
    if (openBreakers.length > 0) {
      recommendations.push(`Circuit breakers open for: ${openBreakers.map(([service]) => service).join(', ')}`)
    }
    
    // Check for specific error patterns
    const rateLimitErrors = Object.entries(errorStats)
      .filter(([key]) => key.includes('openai'))
      .reduce((sum, [_, count]) => sum + count, 0)
    
    if (rateLimitErrors > 10) {
      recommendations.push('High OpenAI rate limit errors. Consider implementing request throttling.')
    }
    
    const dbErrors = Object.entries(errorStats)
      .filter(([key]) => key.includes('database'))
      .reduce((sum, [_, count]) => sum + count, 0)
    
    if (dbErrors > 5) {
      recommendations.push('Database connection issues detected. Check database health.')
    }
    
    return {
      isHealthy: this.isSystemHealthy(),
      totalErrors,
      errorsByType: errorStats,
      circuitBreakers: circuitBreakerStatus,
      recommendations
    }
  }

  /**
   * Create user-friendly error messages
   */
  static getUserFriendlyMessage(error: MemoryError): string {
    switch (error.type) {
      case MemoryErrorType.OPENAI_RATE_LIMIT:
        return 'The AI service is currently busy. Please try again in a moment.'
      
      case MemoryErrorType.OPENAI_QUOTA_EXCEEDED:
        return 'The AI service quota has been exceeded. Please contact support.'
      
      case MemoryErrorType.DATABASE_CONNECTION:
        return 'Unable to connect to the database. Please check your connection and try again.'
      
      case MemoryErrorType.UNAUTHORIZED:
        return 'Please log in to access your memories.'
      
      case MemoryErrorType.INVALID_MEMORY_ID:
        return 'The requested memory was not found.'
      
      case MemoryErrorType.INVALID_INPUT:
        return 'Please check your input and try again.'
      
      case MemoryErrorType.MEMORY_EXTRACTION_FAILED:
        return 'Unable to process your message for memory extraction. Your conversation will continue normally.'
      
      case MemoryErrorType.EMBEDDING_GENERATION_FAILED:
        return 'Unable to process memory content. Please try again.'
      
      case MemoryErrorType.VECTOR_SEARCH_FAILED:
        return 'Unable to search your memories at the moment. Please try again.'
      
      default:
        return 'An unexpected error occurred. Please try again.'
    }
  }
}

/**
 * Decorator for automatic error handling and retry
 */
export function withMemoryErrorHandling(
  operationType: keyof typeof DEFAULT_RETRY_CONFIGS,
  gracefulDegradation: boolean = false
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const context = {
        method: `${target.constructor.name}.${propertyName}`,
        args: args.length
      }

      if (gracefulDegradation) {
        return MemoryErrorHandler.withGracefulDegradation(
          () => method.apply(this, args),
          () => [], // Default fallback for most memory operations
          operationType,
          context
        )
      } else {
        return MemoryErrorHandler.withRetry(
          () => method.apply(this, args),
          operationType,
          context
        )
      }
    }

    return descriptor
  }
}