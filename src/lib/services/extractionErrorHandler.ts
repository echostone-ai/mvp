/**
 * Extraction Error Handler - Specialized error handling for Hot Facts Pipeline
 * 
 * Provides comprehensive error recovery, retry logic, and graceful degradation
 * specifically for fact extraction operations including pattern matching,
 * LLM processing, and storage operations.
 */

import { MemoryErrorHandler, MemoryError, MemoryErrorType } from '../memoryErrorHandler';

/**
 * Extraction-specific error types
 */
export enum ExtractionErrorType {
  // Pattern Extraction Errors
  PATTERN_PARSING_FAILED = 'pattern_parsing_failed',
  PATTERN_REGEX_ERROR = 'pattern_regex_error',
  PATTERN_NORMALIZATION_FAILED = 'pattern_normalization_failed',
  
  // LLM Extraction Errors
  LLM_PROMPT_CONSTRUCTION_FAILED = 'llm_prompt_construction_failed',
  LLM_RESPONSE_PARSING_FAILED = 'llm_response_parsing_failed',
  LLM_VALIDATION_FAILED = 'llm_validation_failed',
  LLM_CONFIDENCE_CALCULATION_FAILED = 'llm_confidence_calculation_failed',
  
  // Storage Errors
  QUICK_FACTS_INSERT_FAILED = 'quick_facts_insert_failed',
  QUICK_FACTS_UPDATE_FAILED = 'quick_facts_update_failed',
  FACT_HISTORY_INSERT_FAILED = 'fact_history_insert_failed',
  FACT_DEDUPLICATION_FAILED = 'fact_deduplication_failed',
  
  // Orchestration Errors
  EXTRACTION_TIMEOUT = 'extraction_timeout',
  STAGE_COORDINATION_FAILED = 'stage_coordination_failed',
  RESULT_COMBINATION_FAILED = 'result_combination_failed',
  
  // Validation Errors
  FACT_VALIDATION_FAILED = 'fact_validation_failed',
  CONFIDENCE_THRESHOLD_ERROR = 'confidence_threshold_error',
  FACT_KEY_NORMALIZATION_FAILED = 'fact_key_normalization_failed'
}

/**
 * Extraction-specific error class
 */
export class ExtractionError extends Error {
  public readonly type: ExtractionErrorType;
  public readonly isRetryable: boolean;
  public readonly context: Record<string, any>;
  public readonly timestamp: Date;
  public readonly originalError?: Error;
  public readonly stage: 'pattern' | 'llm' | 'storage' | 'orchestration';

  constructor(
    type: ExtractionErrorType,
    message: string,
    stage: 'pattern' | 'llm' | 'storage' | 'orchestration',
    options: {
      isRetryable?: boolean;
      context?: Record<string, any>;
      originalError?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'ExtractionError';
    this.type = type;
    this.stage = stage;
    this.isRetryable = options.isRetryable ?? false;
    this.context = options.context ?? {};
    this.timestamp = new Date();
    this.originalError = options.originalError;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ExtractionError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      type: this.type,
      stage: this.stage,
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
    };
  }
}

/**
 * Retry configuration for extraction operations
 */
interface ExtractionRetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: ExtractionErrorType[];
}

const EXTRACTION_RETRY_CONFIGS: Record<string, ExtractionRetryConfig> = {
  pattern: {
    maxAttempts: 2,
    baseDelay: 100,
    maxDelay: 500,
    backoffMultiplier: 2,
    retryableErrors: [
      ExtractionErrorType.PATTERN_REGEX_ERROR,
      ExtractionErrorType.PATTERN_NORMALIZATION_FAILED
    ]
  },
  llm: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    retryableErrors: [
      ExtractionErrorType.LLM_RESPONSE_PARSING_FAILED,
      ExtractionErrorType.LLM_VALIDATION_FAILED
    ]
  },
  storage: {
    maxAttempts: 2,
    baseDelay: 500,
    maxDelay: 2000,
    backoffMultiplier: 2,
    retryableErrors: [
      ExtractionErrorType.QUICK_FACTS_INSERT_FAILED,
      ExtractionErrorType.QUICK_FACTS_UPDATE_FAILED,
      ExtractionErrorType.FACT_HISTORY_INSERT_FAILED
    ]
  }
};

/**
 * Extraction metrics for monitoring
 */
export interface ExtractionMetrics {
  total_extractions: number;
  successful_extractions: number;
  pattern_failures: number;
  llm_failures: number;
  storage_failures: number;
  average_processing_time_ms: number;
  facts_extracted_per_extraction: number;
  error_rates_by_type: Record<ExtractionErrorType, number>;
  graceful_degradations: number;
  circuit_breaker_activations: number;
}

/**
 * Comprehensive error handler for fact extraction pipeline
 */
export class ExtractionErrorHandler {
  private static metrics: ExtractionMetrics = {
    total_extractions: 0,
    successful_extractions: 0,
    pattern_failures: 0,
    llm_failures: 0,
    storage_failures: 0,
    average_processing_time_ms: 0,
    facts_extracted_per_extraction: 0,
    error_rates_by_type: {} as Record<ExtractionErrorType, number>,
    graceful_degradations: 0,
    circuit_breaker_activations: 0
  };

  private static errorCounts: Map<string, number> = new Map();
  private static lastMetricsReset: Date = new Date();

  /**
   * Categorize and wrap extraction-specific errors
   */
  static categorizeExtractionError(
    error: any,
    stage: 'pattern' | 'llm' | 'storage' | 'orchestration',
    context: Record<string, any> = {}
  ): ExtractionError {
    // Handle existing MemoryError instances
    if (error instanceof MemoryError) {
      return this.convertMemoryErrorToExtractionError(error, stage, context);
    }

    // Handle null/undefined errors
    if (!error) {
      return new ExtractionError(
        ExtractionErrorType.STAGE_COORDINATION_FAILED,
        'Unknown error occurred',
        stage,
        {
          isRetryable: false,
          context
        }
      );
    }

    // Pattern extraction errors
    if (stage === 'pattern') {
      if (error.message?.includes('regex') || error.name === 'SyntaxError') {
        return new ExtractionError(
          ExtractionErrorType.PATTERN_REGEX_ERROR,
          `Pattern regex compilation failed: ${error.message}`,
          stage,
          {
            isRetryable: false,
            context: { ...context, patternType: context.patternType },
            originalError: error
          }
        );
      }

      if (error.message?.includes('normalization') || error.message?.includes('format')) {
        return new ExtractionError(
          ExtractionErrorType.PATTERN_NORMALIZATION_FAILED,
          `Pattern normalization failed: ${error.message}`,
          stage,
          {
            isRetryable: true,
            context: { ...context, extractedValue: context.extractedValue },
            originalError: error
          }
        );
      }

      return new ExtractionError(
        ExtractionErrorType.PATTERN_PARSING_FAILED,
        `Pattern parsing failed: ${error.message}`,
        stage,
        {
          isRetryable: false,
          context,
          originalError: error
        }
      );
    }

    // LLM extraction errors
    if (stage === 'llm') {
      if (error.message?.includes('JSON') || error.message?.includes('parse')) {
        return new ExtractionError(
          ExtractionErrorType.LLM_RESPONSE_PARSING_FAILED,
          `LLM response parsing failed: ${error.message}`,
          stage,
          {
            isRetryable: true,
            context: { ...context, llmResponse: context.llmResponse?.substring(0, 200) },
            originalError: error
          }
        );
      }

      if (error.message?.includes('validation') || error.message?.includes('invalid')) {
        return new ExtractionError(
          ExtractionErrorType.LLM_VALIDATION_FAILED,
          `LLM fact validation failed: ${error.message}`,
          stage,
          {
            isRetryable: true,
            context: { ...context, factKey: context.factKey, factValue: context.factValue },
            originalError: error
          }
        );
      }

      if (error.message?.includes('confidence')) {
        return new ExtractionError(
          ExtractionErrorType.LLM_CONFIDENCE_CALCULATION_FAILED,
          `LLM confidence calculation failed: ${error.message}`,
          stage,
          {
            isRetryable: false,
            context,
            originalError: error
          }
        );
      }

      return new ExtractionError(
        ExtractionErrorType.LLM_PROMPT_CONSTRUCTION_FAILED,
        `LLM prompt construction failed: ${error.message}`,
        stage,
        {
          isRetryable: false,
          context,
          originalError: error
        }
      );
    }

    // Storage errors
    if (stage === 'storage') {
      if (error.message?.includes('quick_facts') && error.message?.includes('insert')) {
        return new ExtractionError(
          ExtractionErrorType.QUICK_FACTS_INSERT_FAILED,
          `Quick facts insertion failed: ${error.message}`,
          stage,
          {
            isRetryable: true,
            context: { ...context, avatarId: context.avatarId, factCount: context.factCount },
            originalError: error
          }
        );
      }

      if (error.message?.includes('quick_facts') && error.message?.includes('update')) {
        return new ExtractionError(
          ExtractionErrorType.QUICK_FACTS_UPDATE_FAILED,
          `Quick facts update failed: ${error.message}`,
          stage,
          {
            isRetryable: true,
            context: { ...context, avatarId: context.avatarId, factKey: context.factKey },
            originalError: error
          }
        );
      }

      if (error.message?.includes('fact_history')) {
        return new ExtractionError(
          ExtractionErrorType.FACT_HISTORY_INSERT_FAILED,
          `Fact history insertion failed: ${error.message}`,
          stage,
          {
            isRetryable: true,
            context,
            originalError: error
          }
        );
      }

      if (error.message?.includes('deduplication')) {
        return new ExtractionError(
          ExtractionErrorType.FACT_DEDUPLICATION_FAILED,
          `Fact deduplication failed: ${error.message}`,
          stage,
          {
            isRetryable: false,
            context,
            originalError: error
          }
        );
      }
    }

    // Orchestration errors
    if (stage === 'orchestration') {
      if (error.message?.includes('timeout')) {
        return new ExtractionError(
          ExtractionErrorType.EXTRACTION_TIMEOUT,
          `Extraction timeout: ${error.message}`,
          stage,
          {
            isRetryable: false,
            context: { ...context, timeoutMs: context.timeoutMs },
            originalError: error
          }
        );
      }

      if (error.message?.includes('combination') || error.message?.includes('merge')) {
        return new ExtractionError(
          ExtractionErrorType.RESULT_COMBINATION_FAILED,
          `Result combination failed: ${error.message}`,
          stage,
          {
            isRetryable: false,
            context,
            originalError: error
          }
        );
      }

      return new ExtractionError(
        ExtractionErrorType.STAGE_COORDINATION_FAILED,
        `Stage coordination failed: ${error.message}`,
        stage,
        {
          isRetryable: false,
          context,
          originalError: error
        }
      );
    }

    // Default extraction error
    return new ExtractionError(
      ExtractionErrorType.PATTERN_PARSING_FAILED,
      `Unknown extraction error: ${error.message || 'No error message'}`,
      stage,
      {
        isRetryable: false,
        context,
        originalError: error
      }
    );
  }

  /**
   * Convert MemoryError to ExtractionError for consistency
   */
  private static convertMemoryErrorToExtractionError(
    memoryError: MemoryError,
    stage: 'pattern' | 'llm' | 'storage' | 'orchestration',
    context: Record<string, any>
  ): ExtractionError {
    let extractionType: ExtractionErrorType;

    // Map memory error types to extraction error types
    switch (memoryError.type) {
      case MemoryErrorType.OPENAI_RATE_LIMIT:
      case MemoryErrorType.OPENAI_API_ERROR:
      case MemoryErrorType.OPENAI_TIMEOUT:
        extractionType = ExtractionErrorType.LLM_RESPONSE_PARSING_FAILED;
        break;
      case MemoryErrorType.DATABASE_CONNECTION:
      case MemoryErrorType.DATABASE_QUERY:
        extractionType = ExtractionErrorType.QUICK_FACTS_INSERT_FAILED;
        break;
      default:
        extractionType = ExtractionErrorType.STAGE_COORDINATION_FAILED;
    }

    return new ExtractionError(
      extractionType,
      memoryError.message,
      stage,
      {
        isRetryable: memoryError.isRetryable,
        context: { ...context, ...memoryError.context },
        originalError: memoryError.originalError || memoryError
      }
    );
  }

  /**
   * Execute extraction operation with retry logic and error handling
   */
  static async withExtractionRetry<T>(
    operation: () => Promise<T>,
    stage: 'pattern' | 'llm' | 'storage',
    context: Record<string, any> = {}
  ): Promise<T> {
    const config = EXTRACTION_RETRY_CONFIGS[stage];
    let lastError: ExtractionError | null = null;
    
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        // Reset error count on success
        if (lastError) {
          this.resetErrorCount(stage);
        }
        
        return result;
      } catch (error) {
        const extractionError = this.categorizeExtractionError(error, stage, {
          ...context,
          attempt,
          maxAttempts: config.maxAttempts
        });

        lastError = extractionError;
        this.incrementErrorCount(stage, extractionError.type);
        this.logExtractionError(extractionError);

        // Don't retry if error is not retryable or we've reached max attempts
        if (!extractionError.isRetryable || attempt === config.maxAttempts) {
          break;
        }

        // Don't retry if error type is not in retryable list
        if (!config.retryableErrors.includes(extractionError.type)) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        );

        // Add jitter to prevent thundering herd
        const jitteredDelay = delay + Math.random() * 100;

        console.log(`Retrying ${stage} extraction in ${jitteredDelay}ms (attempt ${attempt}/${config.maxAttempts})`);
        
        await new Promise(resolve => setTimeout(resolve, jitteredDelay));
      }
    }

    // All retries exhausted, throw the last error
    throw lastError;
  }

  /**
   * Execute extraction with graceful degradation
   */
  static async withGracefulDegradation<T>(
    operation: () => Promise<T>,
    fallback: () => Promise<T> | T,
    stage: 'pattern' | 'llm' | 'storage' | 'orchestration',
    context: Record<string, any> = {}
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const extractionError = this.categorizeExtractionError(error, stage, {
        ...context,
        gracefulDegradation: true
      });

      this.logExtractionError(extractionError);
      this.metrics.graceful_degradations++;
      
      console.warn(`${stage} extraction failed, using fallback:`, extractionError.message);
      
      return await fallback();
    }
  }

  /**
   * Execute extraction with timeout and comprehensive error handling
   */
  static async withExtractionTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    stage: 'pattern' | 'llm' | 'storage' | 'orchestration',
    context: Record<string, any> = {}
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new ExtractionError(
          ExtractionErrorType.EXTRACTION_TIMEOUT,
          `${stage} extraction timeout after ${timeoutMs}ms`,
          stage,
          {
            isRetryable: false,
            context: { ...context, timeoutMs }
          }
        ));
      }, timeoutMs);
    });

    try {
      return await Promise.race([operation(), timeoutPromise]);
    } catch (error) {
      if (error instanceof ExtractionError) {
        this.logExtractionError(error);
        throw error;
      }
      
      const extractionError = this.categorizeExtractionError(error, stage, context);
      this.logExtractionError(extractionError);
      throw extractionError;
    }
  }

  /**
   * Log extraction errors with structured format
   */
  private static logExtractionError(error: ExtractionError): void {
    const logData = {
      timestamp: error.timestamp.toISOString(),
      type: error.type,
      stage: error.stage,
      message: error.message,
      isRetryable: error.isRetryable,
      context: error.context,
      errorCount: this.getErrorCount(error.stage, error.type)
    };

    // Log at appropriate level based on error type and stage
    if (error.type === ExtractionErrorType.EXTRACTION_TIMEOUT) {
      console.error('CRITICAL: Extraction timeout', logData);
    } else if (error.stage === 'storage') {
      console.error('Storage error in extraction pipeline', logData);
    } else if (error.isRetryable) {
      console.warn('Retryable extraction error', logData);
    } else {
      console.error('Non-retryable extraction error', logData);
    }

    // In development, also log the full error object
    if (process.env.NODE_ENV === 'development') {
      console.error('Full extraction error details:', error.toJSON());
    }
  }

  /**
   * Track error counts for monitoring
   */
  private static incrementErrorCount(stage: string, errorType: ExtractionErrorType): void {
    const key = `${stage}_${errorType}_${new Date().toISOString().split('T')[0]}`;
    const current = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, current + 1);

    // Update metrics
    this.metrics.error_rates_by_type[errorType] = (this.metrics.error_rates_by_type[errorType] || 0) + 1;

    switch (stage) {
      case 'pattern':
        this.metrics.pattern_failures++;
        break;
      case 'llm':
        this.metrics.llm_failures++;
        break;
      case 'storage':
        this.metrics.storage_failures++;
        break;
    }

    // Reset counts daily
    const now = new Date();
    if (now.getTime() - this.lastMetricsReset.getTime() > 24 * 60 * 60 * 1000) {
      this.resetDailyMetrics();
    }
  }

  private static resetErrorCount(stage: string): void {
    const today = new Date().toISOString().split('T')[0];
    const keysToDelete = Array.from(this.errorCounts.keys()).filter(key => 
      key.startsWith(`${stage}_`) && key.endsWith(`_${today}`)
    );
    
    keysToDelete.forEach(key => this.errorCounts.delete(key));
  }

  private static getErrorCount(stage: string, errorType: ExtractionErrorType): number {
    const key = `${stage}_${errorType}_${new Date().toISOString().split('T')[0]}`;
    return this.errorCounts.get(key) || 0;
  }

  /**
   * Update extraction metrics
   */
  static updateExtractionMetrics(
    processingTime: number,
    factsCount: number,
    success: boolean
  ): void {
    this.metrics.total_extractions++;
    
    if (success) {
      this.metrics.successful_extractions++;
    }

    // Update running average for processing time
    const totalTime = this.metrics.average_processing_time_ms * (this.metrics.total_extractions - 1) + processingTime;
    this.metrics.average_processing_time_ms = totalTime / this.metrics.total_extractions;

    // Update running average for facts per extraction
    const totalFacts = this.metrics.facts_extracted_per_extraction * (this.metrics.total_extractions - 1) + factsCount;
    this.metrics.facts_extracted_per_extraction = totalFacts / this.metrics.total_extractions;
  }

  /**
   * Get extraction metrics
   */
  static getExtractionMetrics(): ExtractionMetrics {
    return { ...this.metrics };
  }

  /**
   * Get extraction success rate
   */
  static getExtractionSuccessRate(): number {
    if (this.metrics.total_extractions === 0) {
      return 0;
    }
    return (this.metrics.successful_extractions / this.metrics.total_extractions) * 100;
  }

  /**
   * Check if extraction pipeline is healthy
   */
  static isExtractionPipelineHealthy(): boolean {
    const successRate = this.getExtractionSuccessRate();
    const avgProcessingTime = this.metrics.average_processing_time_ms;
    const totalFailures = this.metrics.pattern_failures + this.metrics.llm_failures + this.metrics.storage_failures;
    
    return successRate >= 80 && avgProcessingTime < 15000 && totalFailures < 20; // Daily thresholds
  }

  /**
   * Get comprehensive extraction health report
   */
  static getExtractionHealthReport(): {
    isHealthy: boolean;
    successRate: number;
    totalExtractions: number;
    failuresByStage: {
      pattern: number;
      llm: number;
      storage: number;
    };
    errorsByType: Record<ExtractionErrorType, number>;
    averageProcessingTime: number;
    recommendations: string[];
  } {
    const successRate = this.getExtractionSuccessRate();
    const recommendations: string[] = [];
    
    // Analyze error patterns and provide recommendations
    if (successRate < 80) {
      recommendations.push('Low extraction success rate. Review extraction logic and error handling.');
    }
    
    if (this.metrics.average_processing_time_ms > 15000) {
      recommendations.push('High average processing time. Consider optimizing extraction algorithms.');
    }
    
    if (this.metrics.pattern_failures > this.metrics.llm_failures) {
      recommendations.push('High pattern extraction failures. Review regex patterns and normalization logic.');
    }
    
    if (this.metrics.llm_failures > 10) {
      recommendations.push('High LLM extraction failures. Check API connectivity and prompt templates.');
    }
    
    if (this.metrics.storage_failures > 5) {
      recommendations.push('Storage failures detected. Check database connectivity and schema.');
    }
    
    if (this.metrics.graceful_degradations > this.metrics.total_extractions * 0.1) {
      recommendations.push('High graceful degradation rate. Review fallback mechanisms.');
    }
    
    return {
      isHealthy: this.isExtractionPipelineHealthy(),
      successRate,
      totalExtractions: this.metrics.total_extractions,
      failuresByStage: {
        pattern: this.metrics.pattern_failures,
        llm: this.metrics.llm_failures,
        storage: this.metrics.storage_failures
      },
      errorsByType: this.metrics.error_rates_by_type,
      averageProcessingTime: this.metrics.average_processing_time_ms,
      recommendations
    };
  }

  /**
   * Reset daily metrics
   */
  private static resetDailyMetrics(): void {
    this.errorCounts.clear();
    this.metrics.error_rates_by_type = {} as Record<ExtractionErrorType, number>;
    this.lastMetricsReset = new Date();
  }

  /**
   * Reset all metrics (for testing)
   */
  static resetAllMetrics(): void {
    this.metrics = {
      total_extractions: 0,
      successful_extractions: 0,
      pattern_failures: 0,
      llm_failures: 0,
      storage_failures: 0,
      average_processing_time_ms: 0,
      facts_extracted_per_extraction: 0,
      error_rates_by_type: {} as Record<ExtractionErrorType, number>,
      graceful_degradations: 0,
      circuit_breaker_activations: 0
    };
    this.errorCounts.clear();
    this.lastMetricsReset = new Date();
  }

  /**
   * Create user-friendly error messages for extraction failures
   */
  static getUserFriendlyMessage(error: ExtractionError): string {
    switch (error.type) {
      case ExtractionErrorType.PATTERN_PARSING_FAILED:
        return 'Unable to extract information using pattern matching. Your avatar will still be created.';
      
      case ExtractionErrorType.LLM_RESPONSE_PARSING_FAILED:
        return 'AI processing encountered an issue. Basic information extraction will continue.';
      
      case ExtractionErrorType.QUICK_FACTS_INSERT_FAILED:
        return 'Unable to save extracted facts. Your avatar and memories are still being processed.';
      
      case ExtractionErrorType.EXTRACTION_TIMEOUT:
        return 'Information extraction is taking longer than expected. Your avatar will be created with available data.';
      
      case ExtractionErrorType.LLM_VALIDATION_FAILED:
        return 'Some extracted information could not be validated. Only verified facts will be saved.';
      
      default:
        return 'Information extraction encountered an issue. Your avatar creation will continue normally.';
    }
  }
}

/**
 * Decorator for automatic extraction error handling
 */
export function withExtractionErrorHandling(
  stage: 'pattern' | 'llm' | 'storage' | 'orchestration',
  gracefulDegradation: boolean = false
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    if (!descriptor || !descriptor.value) {
      throw new Error('Decorator can only be applied to methods');
    }

    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const context = {
        method: `${target.constructor.name}.${propertyName}`,
        args: args.length
      };

      if (gracefulDegradation) {
        return ExtractionErrorHandler.withGracefulDegradation(
          () => method.apply(this, args),
          () => [], // Default fallback for most extraction operations
          stage,
          context
        );
      } else if (stage !== 'orchestration') {
        return ExtractionErrorHandler.withExtractionRetry(
          () => method.apply(this, args),
          stage as 'pattern' | 'llm' | 'storage',
          context
        );
      } else {
        // Orchestration stage doesn't use retry, just error categorization
        try {
          return await method.apply(this, args);
        } catch (error) {
          const extractionError = ExtractionErrorHandler.categorizeExtractionError(error, stage, context);
          ExtractionErrorHandler['logExtractionError'](extractionError);
          throw extractionError;
        }
      }
    };

    return descriptor;
  };
}