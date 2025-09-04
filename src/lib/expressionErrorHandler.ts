/**
 * Expression Error Handler
 * 
 * Comprehensive error handling system for expression overlays that ensures
 * graceful degradation without breaking TTS flow.
 * 
 * Requirements: 6.3, 6.4, 7.1, 7.2, 7.3, 9.5
 */

import { logger } from './logger';
import { expressionMetrics } from './expressionMetrics';

export enum ExpressionErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  BUFFER_NOT_READY = 'BUFFER_NOT_READY',
  AUDIO_CONTEXT_ERROR = 'AUDIO_CONTEXT_ERROR',
  DECODE_ERROR = 'DECODE_ERROR',
  PLAYBACK_ERROR = 'PLAYBACK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  FEATURE_DISABLED = 'FEATURE_DISABLED',
  PRIVACY_BLOCKED = 'PRIVACY_BLOCKED',
  DURATION_EXCEEDED = 'DURATION_EXCEEDED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export enum ExpressionErrorStage {
  INITIALIZATION = 'INITIALIZATION',
  LOADING = 'LOADING',
  PRELOADING = 'PRELOADING',
  SCHEDULING = 'SCHEDULING',
  PLAYBACK = 'PLAYBACK',
  MIXING = 'MIXING',
  CLEANUP = 'CLEANUP'
}

export interface ExpressionError {
  type: ExpressionErrorType;
  stage: ExpressionErrorStage;
  message: string;
  expressionId?: string;
  ownerId?: string;
  originalError?: Error;
  timestamp: number;
  context?: Record<string, any>;
}

export interface PlaybackContext {
  sessionId: string;
  ownerId: string;
  ownerType: 'user' | 'avatar';
  turnId?: string;
  skipExpressions: boolean;
  disabledExpressions: Set<string>;
  temporaryDisableUntil: number;
  isExpressionsEnabled: boolean;
  
  removeExpression(expressionId: string): void;
  disableExpressions(): void;
  temporaryDisable(durationMs: number): void;
}

export interface ErrorHandlingOptions {
  /** Maximum number of errors before disabling expressions for session */
  maxErrorsPerSession?: number;
  /** Duration to temporarily disable expressions after errors (ms) */
  temporaryDisableDuration?: number;
  /** Whether to retry failed operations */
  enableRetries?: boolean;
  /** Maximum number of retries for network operations */
  maxRetries?: number;
  /** Base delay for exponential backoff (ms) */
  retryBaseDelay?: number;
}

/**
 * Comprehensive error handler for expression system
 */
export class ExpressionErrorHandler {
  private options: Required<ErrorHandlingOptions>;
  private sessionErrors = new Map<string, ExpressionError[]>();
  private globalErrorCount = 0;

  constructor(options: ErrorHandlingOptions = {}) {
    this.options = {
      maxErrorsPerSession: options.maxErrorsPerSession ?? 5,
      temporaryDisableDuration: options.temporaryDisableDuration ?? 30000, // 30 seconds
      enableRetries: options.enableRetries ?? true,
      maxRetries: options.maxRetries ?? 3,
      retryBaseDelay: options.retryBaseDelay ?? 100
    };
  }

  /**
   * Handle expression-related errors with graceful degradation
   */
  async handleExpressionFailure(
    error: ExpressionError, 
    context: PlaybackContext
  ): Promise<void> {
    // Record error for monitoring
    this.recordError(error, context);
    
    // Log error with appropriate level
    this.logError(error, context);
    
    // Update metrics
    this.updateErrorMetrics(error, context);
    
    // Apply graceful fallback strategy
    await this.applyFallbackStrategy(error, context);
    
    // Check if we should disable expressions for this session
    this.checkSessionErrorThreshold(context);
  }

  /**
   * Create a standardized expression error
   */
  createError(
    type: ExpressionErrorType,
    stage: ExpressionErrorStage,
    message: string,
    options: {
      expressionId?: string;
      ownerId?: string;
      originalError?: Error;
      context?: Record<string, any>;
    } = {}
  ): ExpressionError {
    return {
      type,
      stage,
      message,
      expressionId: options.expressionId,
      ownerId: options.ownerId,
      originalError: options.originalError,
      timestamp: Date.now(),
      context: options.context
    };
  }

  /**
   * Handle network errors with retry logic
   */
  async handleNetworkError(
    url: string,
    originalError: Error,
    context: PlaybackContext,
    retryCount: number = 0
  ): Promise<Response | null> {
    const error = this.createError(
      ExpressionErrorType.NETWORK_ERROR,
      ExpressionErrorStage.LOADING,
      `Network request failed: ${originalError.message}`,
      {
        ownerId: context.ownerId,
        originalError,
        context: { url, retryCount }
      }
    );

    // If retries are disabled or max retries reached, handle as failure
    if (!this.options.enableRetries || retryCount >= this.options.maxRetries) {
      await this.handleExpressionFailure(error, context);
      return null;
    }

    // Calculate exponential backoff delay
    const delay = this.options.retryBaseDelay * Math.pow(2, retryCount);
    
    logger.warn('Retrying expression network request', {
      url,
      retryCount,
      delay,
      error: originalError.message
    });

    // Wait before retry
    await this.delay(delay);

    try {
      const response = await fetch(url, {
        cache: 'force-cache',
        priority: 'low',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Success - record recovery
      expressionMetrics.networkRetrySuccess.inc({
        owner_type: context.ownerType,
        retry_count: retryCount.toString()
      });

      return response;
    } catch (retryError) {
      // Recursive retry
      return this.handleNetworkError(
        url, 
        retryError instanceof Error ? retryError : new Error('Unknown retry error'),
        context,
        retryCount + 1
      );
    }
  }

  /**
   * Handle audio decoding errors
   */
  async handleDecodeError(
    expressionId: string,
    originalError: Error,
    context: PlaybackContext
  ): Promise<void> {
    const error = this.createError(
      ExpressionErrorType.DECODE_ERROR,
      ExpressionErrorStage.PRELOADING,
      `Audio decode failed: ${originalError.message}`,
      {
        expressionId,
        ownerId: context.ownerId,
        originalError
      }
    );

    await this.handleExpressionFailure(error, context);
    
    // Remove this specific expression from future attempts
    context.removeExpression(expressionId);
  }

  /**
   * Handle playback errors during audio mixing
   */
  async handlePlaybackError(
    expressionId: string,
    originalError: Error,
    context: PlaybackContext
  ): Promise<void> {
    const error = this.createError(
      ExpressionErrorType.PLAYBACK_ERROR,
      ExpressionErrorStage.PLAYBACK,
      `Playback failed: ${originalError.message}`,
      {
        expressionId,
        ownerId: context.ownerId,
        originalError
      }
    );

    await this.handleExpressionFailure(error, context);
  }

  /**
   * Handle duration exceeded errors (expressions too long)
   */
  async handleDurationExceeded(
    expressionId: string,
    actualDuration: number,
    maxDuration: number,
    context: PlaybackContext
  ): Promise<void> {
    const error = this.createError(
      ExpressionErrorType.DURATION_EXCEEDED,
      ExpressionErrorStage.SCHEDULING,
      `Expression duration ${actualDuration}ms exceeds limit ${maxDuration}ms`,
      {
        expressionId,
        ownerId: context.ownerId,
        context: { actualDuration, maxDuration }
      }
    );

    await this.handleExpressionFailure(error, context);
    
    // Remove this expression as it's too long
    context.removeExpression(expressionId);
  }

  /**
   * Record error for session tracking
   */
  private recordError(error: ExpressionError, context: PlaybackContext): void {
    const sessionId = context.sessionId;
    
    if (!this.sessionErrors.has(sessionId)) {
      this.sessionErrors.set(sessionId, []);
    }
    
    const sessionErrorList = this.sessionErrors.get(sessionId)!;
    sessionErrorList.push(error);
    
    // Keep only recent errors (last 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const recentErrors = sessionErrorList.filter(e => e.timestamp > tenMinutesAgo);
    this.sessionErrors.set(sessionId, recentErrors);
    
    this.globalErrorCount++;
  }

  /**
   * Log error with appropriate level and context
   */
  private logError(error: ExpressionError, context: PlaybackContext): void {
    const logContext = {
      errorType: error.type,
      errorStage: error.stage,
      expressionId: error.expressionId,
      ownerId: error.ownerId,
      sessionId: context.sessionId,
      turnId: context.turnId,
      ownerType: context.ownerType,
      originalError: error.originalError?.message,
      context: error.context
    };

    // Use different log levels based on error severity
    switch (error.type) {
      case ExpressionErrorType.NETWORK_ERROR:
      case ExpressionErrorType.TIMEOUT_ERROR:
        logger.warn('Expression network/timeout error', logContext);
        break;
        
      case ExpressionErrorType.BUFFER_NOT_READY:
      case ExpressionErrorType.DURATION_EXCEEDED:
        logger.info('Expression graceful degradation', logContext);
        break;
        
      case ExpressionErrorType.AUDIO_CONTEXT_ERROR:
      case ExpressionErrorType.DECODE_ERROR:
      case ExpressionErrorType.PLAYBACK_ERROR:
        logger.error('Expression audio error', logContext);
        break;
        
      case ExpressionErrorType.FEATURE_DISABLED:
      case ExpressionErrorType.PRIVACY_BLOCKED:
        logger.debug('Expression disabled by configuration', logContext);
        break;
        
      default:
        logger.error('Unknown expression error', logContext);
    }
  }

  /**
   * Update error metrics for monitoring
   */
  private updateErrorMetrics(error: ExpressionError, context: PlaybackContext): void {
    // Increment error counter
    expressionMetrics.errorCount.inc({
      error_type: error.type,
      error_stage: error.stage,
      owner_type: context.ownerType
    });

    // Track error rate
    expressionMetrics.errorRate.inc({
      owner_type: context.ownerType
    });

    // Update session error gauge
    const sessionErrorCount = this.sessionErrors.get(context.sessionId)?.length || 0;
    expressionMetrics.sessionErrors.set(
      { session_id: context.sessionId },
      sessionErrorCount
    );
  }

  /**
   * Apply appropriate fallback strategy based on error type
   */
  private async applyFallbackStrategy(
    error: ExpressionError, 
    context: PlaybackContext
  ): Promise<void> {
    switch (error.type) {
      case ExpressionErrorType.NETWORK_ERROR:
      case ExpressionErrorType.TIMEOUT_ERROR:
        // Skip expressions for this turn, retry next turn
        context.skipExpressions = true;
        break;
        
      case ExpressionErrorType.BUFFER_NOT_READY:
        // Continue without this specific expression
        if (error.expressionId) {
          context.removeExpression(error.expressionId);
        }
        break;
        
      case ExpressionErrorType.AUDIO_CONTEXT_ERROR:
      case ExpressionErrorType.DECODE_ERROR:
        // Disable expressions for session
        context.disableExpressions();
        break;
        
      case ExpressionErrorType.PLAYBACK_ERROR:
        // Temporary disable, then retry
        context.temporaryDisable(this.options.temporaryDisableDuration);
        break;
        
      case ExpressionErrorType.DURATION_EXCEEDED:
        // Remove problematic expression
        if (error.expressionId) {
          context.removeExpression(error.expressionId);
        }
        break;
        
      case ExpressionErrorType.FEATURE_DISABLED:
      case ExpressionErrorType.PRIVACY_BLOCKED:
        // Respect user settings - disable for session
        context.disableExpressions();
        break;
        
      default:
        // Unknown error - temporary disable as safety measure
        context.temporaryDisable(this.options.temporaryDisableDuration);
    }
  }

  /**
   * Check if session has exceeded error threshold
   */
  private checkSessionErrorThreshold(context: PlaybackContext): void {
    const sessionErrors = this.sessionErrors.get(context.sessionId) || [];
    
    if (sessionErrors.length >= this.options.maxErrorsPerSession) {
      logger.warn('Expression error threshold exceeded, disabling for session', {
        sessionId: context.sessionId,
        errorCount: sessionErrors.length,
        threshold: this.options.maxErrorsPerSession
      });
      
      context.disableExpressions();
      
      // Update metrics
      expressionMetrics.sessionDisabled.inc({
        owner_type: context.ownerType,
        reason: 'error_threshold'
      });
    }
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStats(): {
    totalErrors: number;
    sessionErrorCounts: Record<string, number>;
    errorsByType: Record<ExpressionErrorType, number>;
    errorsByStage: Record<ExpressionErrorStage, number>;
  } {
    const errorsByType: Record<ExpressionErrorType, number> = {} as any;
    const errorsByStage: Record<ExpressionErrorStage, number> = {} as any;
    
    // Initialize counters
    Object.values(ExpressionErrorType).forEach(type => {
      errorsByType[type] = 0;
    });
    Object.values(ExpressionErrorStage).forEach(stage => {
      errorsByStage[stage] = 0;
    });
    
    // Count errors by type and stage
    for (const sessionErrors of this.sessionErrors.values()) {
      for (const error of sessionErrors) {
        errorsByType[error.type]++;
        errorsByStage[error.stage]++;
      }
    }
    
    const sessionErrorCounts: Record<string, number> = {};
    for (const [sessionId, errors] of this.sessionErrors.entries()) {
      sessionErrorCounts[sessionId] = errors.length;
    }
    
    return {
      totalErrors: this.globalErrorCount,
      sessionErrorCounts,
      errorsByType,
      errorsByStage
    };
  }

  /**
   * Clear old session data to prevent memory leaks
   */
  cleanup(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    for (const [sessionId, errors] of this.sessionErrors.entries()) {
      const recentErrors = errors.filter(e => e.timestamp > oneHourAgo);
      
      if (recentErrors.length === 0) {
        this.sessionErrors.delete(sessionId);
      } else {
        this.sessionErrors.set(sessionId, recentErrors);
      }
    }
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Global error handler instance
 */
export const expressionErrorHandler = new ExpressionErrorHandler();

/**
 * Utility function to wrap async operations with error handling
 */
export async function withExpressionErrorHandling<T>(
  operation: () => Promise<T>,
  context: PlaybackContext,
  errorType: ExpressionErrorType,
  errorStage: ExpressionErrorStage,
  expressionId?: string
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    const expressionError = expressionErrorHandler.createError(
      errorType,
      errorStage,
      error instanceof Error ? error.message : 'Unknown error',
      {
        expressionId,
        ownerId: context.ownerId,
        originalError: error instanceof Error ? error : undefined
      }
    );
    
    await expressionErrorHandler.handleExpressionFailure(expressionError, context);
    return null;
  }
}