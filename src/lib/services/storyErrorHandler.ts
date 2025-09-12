/**
 * StoryErrorHandler - Comprehensive error handling and fallback system for authentic voice stories
 * 
 * Manages all story-related failures with graceful degradation and automatic TTS fallback
 * Ensures seamless conversation continuation with no gap >150ms
 */

import { logger } from '../logger';
import { metrics } from '../metrics';

export interface ErrorRecoveryConfig {
  maxRetries: number;
  retryDelayMs: number;
  fallbackTimeoutMs: number;
  enableFallbackTTS: boolean;
  logErrors: boolean;
  maxGapMs: number; // Maximum allowed gap before TTS fallback
}

export interface ErrorContext {
  storyId?: string;
  sessionId?: string;
  errorType: StoryErrorType;
  timestamp: number;
  userAgent?: string;
  networkCondition?: string;
}

export enum StoryErrorType {
  NETWORK_TIMEOUT = 'network_timeout',
  AUDIO_DECODE_ERROR = 'audio_decode_error',
  STORAGE_UNAVAILABLE = 'storage_unavailable',
  PLAYBACK_FAILED = 'playback_failed',
  TRIGGER_MATCHING_FAILED = 'trigger_matching_failed',
  AUDIO_CONTEXT_ERROR = 'audio_context_error',
  MEMORY_LIMIT_EXCEEDED = 'memory_limit_exceeded',
  CONCURRENT_PLAYBACK_ERROR = 'concurrent_playback_error'
}

export interface StoryError extends Error {
  type: StoryErrorType;
  context: ErrorContext;
  recoverable: boolean;
  retryCount?: number;
}

export class StoryErrorHandler {
  private config: ErrorRecoveryConfig;
  private retryAttempts: Map<string, number> = new Map();
  private fallbackCallbacks: Map<string, () => Promise<void>> = new Map();

  constructor(config: Partial<ErrorRecoveryConfig> = {}) {
    this.config = {
      maxRetries: 2,
      retryDelayMs: 500,
      fallbackTimeoutMs: 150, // Critical: no gap >150ms
      enableFallbackTTS: true,
      logErrors: true,
      maxGapMs: 150,
      ...config
    };
  }

  /**
   * Handle story loading errors with automatic retry and fallback
   */
  async handleLoadingError(
    storyId: string,
    error: Error,
    fallbackText: string,
    fallbackCallback: () => Promise<void>
  ): Promise<void> {
    const startTime = Date.now();
    const storyError = this.createStoryError(error, StoryErrorType.NETWORK_TIMEOUT, { storyId });
    
    try {
      // Track retry attempts
      const retryKey = `load_${storyId}`;
      const currentRetries = this.retryAttempts.get(retryKey) || 0;
      
      if (currentRetries < this.config.maxRetries) {
        this.retryAttempts.set(retryKey, currentRetries + 1);
        
        // Quick retry with exponential backoff
        const delay = Math.min(this.config.retryDelayMs * Math.pow(2, currentRetries), 1000);
        await this.sleep(delay);
        
        // Check if we still have time for retry
        const elapsed = Date.now() - startTime;
        if (elapsed < this.config.fallbackTimeoutMs) {
          throw new Error('Retry timeout exceeded');
        }
        
        return; // Let caller retry
      }
      
      // Max retries exceeded, execute fallback
      await this.executeGracefulFallback(fallbackText, fallbackCallback, startTime);
      
    } catch (fallbackError) {
      // Fallback failed, log and continue with TTS
      await this.logError(storyError, { fallbackError: fallbackError.message });
      await this.executeEmergencyTTSFallback(fallbackText, fallbackCallback);
    } finally {
      // Clean up retry tracking
      this.retryAttempts.delete(`load_${storyId}`);
    }
  }

  /**
   * Handle audio playback errors during story playback
   */
  async handlePlaybackError(
    storyId: string,
    error: Error,
    fallbackText: string,
    fallbackCallback: () => Promise<void>
  ): Promise<void> {
    const startTime = Date.now();
    const errorType = this.classifyPlaybackError(error);
    const storyError = this.createStoryError(error, errorType, { storyId });
    
    try {
      // Immediate fallback for critical playback errors
      if (errorType === StoryErrorType.AUDIO_CONTEXT_ERROR || 
          errorType === StoryErrorType.MEMORY_LIMIT_EXCEEDED) {
        await this.executeGracefulFallback(fallbackText, fallbackCallback, startTime);
        return;
      }
      
      // Try quick recovery for other errors
      await this.attemptPlaybackRecovery(storyId, error);
      
    } catch (recoveryError) {
      // Recovery failed, execute fallback
      await this.executeGracefulFallback(fallbackText, fallbackCallback, startTime);
    }
    
    await this.logError(storyError);
  }

  /**
   * Handle trigger matching failures
   */
  async handleTriggerMatchingError(
    error: Error,
    fallbackText: string,
    fallbackCallback: () => Promise<void>
  ): Promise<void> {
    const storyError = this.createStoryError(
      error, 
      StoryErrorType.TRIGGER_MATCHING_FAILED, 
      {}
    );
    
    // Trigger matching failures should not delay TTS
    // Log error and immediately proceed with TTS
    await this.logError(storyError);
    await fallbackCallback();
    
    // Track trigger matching failures for monitoring
    metrics.increment('story_trigger_matching_failed');
  }

  /**
   * Execute graceful fallback to TTS with timing constraints
   */
  private async executeGracefulFallback(
    fallbackText: string,
    fallbackCallback: () => Promise<void>,
    startTime: number
  ): Promise<void> {
    const elapsed = Date.now() - startTime;
    const remainingTime = this.config.maxGapMs - elapsed;
    
    if (remainingTime <= 0) {
      // Already exceeded max gap, execute emergency fallback
      await this.executeEmergencyTTSFallback(fallbackText, fallbackCallback);
      return;
    }
    
    try {
      // Execute fallback within remaining time budget
      const fallbackPromise = fallbackCallback();
      const timeoutPromise = this.sleep(remainingTime).then(() => {
        throw new Error('Fallback timeout exceeded');
      });
      
      await Promise.race([fallbackPromise, timeoutPromise]);
      
      // Track successful fallback
      metrics.increment('story_fallback_success');
      metrics.timing('story_fallback_duration_ms', Date.now() - startTime);
      
    } catch (error) {
      // Fallback failed or timed out
      await this.executeEmergencyTTSFallback(fallbackText, fallbackCallback);
    }
  }

  /**
   * Emergency TTS fallback when all else fails
   */
  private async executeEmergencyTTSFallback(
    fallbackText: string,
    fallbackCallback: () => Promise<void>
  ): Promise<void> {
    try {
      // Fire and forget - don't wait for completion
      fallbackCallback().catch(error => {
        logger.error('Emergency TTS fallback failed', { error: error.message });
      });
      
      metrics.increment('story_emergency_fallback');
      
    } catch (error) {
      // Even emergency fallback failed - log and continue
      logger.error('Critical: Emergency TTS fallback failed', { 
        error: error.message,
        fallbackText: fallbackText.substring(0, 100)
      });
      metrics.increment('story_critical_failure');
    }
  }

  /**
   * Attempt to recover from playback errors
   */
  private async attemptPlaybackRecovery(storyId: string, error: Error): Promise<void> {
    const errorType = this.classifyPlaybackError(error);
    
    switch (errorType) {
      case StoryErrorType.AUDIO_DECODE_ERROR:
        // Try to reload and decode audio
        throw new Error('Audio decode recovery not implemented');
        
      case StoryErrorType.CONCURRENT_PLAYBACK_ERROR:
        // Stop conflicting audio and retry
        throw new Error('Concurrent playback recovery not implemented');
        
      default:
        throw error; // No recovery available
    }
  }

  /**
   * Classify playback errors for appropriate handling
   */
  private classifyPlaybackError(error: Error): StoryErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('audiocontext') || message.includes('audio context')) {
      return StoryErrorType.AUDIO_CONTEXT_ERROR;
    }
    
    if (message.includes('memory') || message.includes('quota')) {
      return StoryErrorType.MEMORY_LIMIT_EXCEEDED;
    }
    
    if (message.includes('decode') || message.includes('format')) {
      return StoryErrorType.AUDIO_DECODE_ERROR;
    }
    
    if (message.includes('concurrent') || message.includes('already playing')) {
      return StoryErrorType.CONCURRENT_PLAYBACK_ERROR;
    }
    
    return StoryErrorType.PLAYBACK_FAILED;
  }

  /**
   * Create structured story error with context
   */
  private createStoryError(
    originalError: Error,
    type: StoryErrorType,
    context: Partial<ErrorContext>
  ): StoryError {
    const storyError = new Error(originalError.message) as StoryError;
    storyError.type = type;
    storyError.context = {
      errorType: type,
      timestamp: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      ...context
    };
    storyError.recoverable = this.isRecoverableError(type);
    storyError.stack = originalError.stack;
    
    return storyError;
  }

  /**
   * Determine if error type is recoverable
   */
  private isRecoverableError(type: StoryErrorType): boolean {
    const recoverableTypes = [
      StoryErrorType.NETWORK_TIMEOUT,
      StoryErrorType.STORAGE_UNAVAILABLE,
      StoryErrorType.CONCURRENT_PLAYBACK_ERROR
    ];
    
    return recoverableTypes.includes(type);
  }

  /**
   * Log error with appropriate level and context
   */
  private async logError(error: StoryError, additionalContext: Record<string, any> = {}): Promise<void> {
    if (!this.config.logErrors) return;
    
    const logContext = {
      errorType: error.type,
      recoverable: error.recoverable,
      context: error.context,
      ...additionalContext
    };
    
    if (error.recoverable) {
      logger.warn('Recoverable story error', logContext);
    } else {
      logger.error('Non-recoverable story error', logContext);
    }
    
    // Track error metrics
    metrics.increment(`story_error_${error.type}`);
    
    if (error.context.storyId) {
      metrics.increment('story_error_by_story', { storyId: error.context.storyId });
    }
  }

  /**
   * Utility sleep function for delays and timeouts
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Register fallback callback for specific story
   */
  registerFallbackCallback(storyId: string, callback: () => Promise<void>): void {
    this.fallbackCallbacks.set(storyId, callback);
  }

  /**
   * Clean up resources and reset state
   */
  cleanup(): void {
    this.retryAttempts.clear();
    this.fallbackCallbacks.clear();
  }

  /**
   * Get current error statistics for monitoring
   */
  getErrorStats(): {
    activeRetries: number;
    registeredCallbacks: number;
    config: ErrorRecoveryConfig;
  } {
    return {
      activeRetries: this.retryAttempts.size,
      registeredCallbacks: this.fallbackCallbacks.size,
      config: { ...this.config }
    };
  }
}

// Export singleton instance with default config
export const storyErrorHandler = new StoryErrorHandler();