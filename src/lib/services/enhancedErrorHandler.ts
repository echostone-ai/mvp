/**
 * Enhanced Error Handler
 * Integrates circuit breaker, retry logic, graceful degradation, and user notifications
 */

import { CircuitBreaker, elevenLabsCircuitBreaker } from './circuitBreaker';
import { RetryService, voiceSynthesisRetry, memoryServiceRetry } from './retryService';
import { 
  GracefulDegradationService, 
  gracefulDegradationService, 
  ServiceType, 
  DegradationLevel 
} from './gracefulDegradation';
import { 
  ToastNotificationService, 
  toastNotificationService, 
  ToastType 
} from './toastNotificationService';

export interface ErrorHandlingResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  degraded: boolean;
  fallbackUsed?: string;
}

export class EnhancedErrorHandler {
  constructor(
    private circuitBreaker: CircuitBreaker = elevenLabsCircuitBreaker,
    private retryService: RetryService = voiceSynthesisRetry,
    private degradationService: GracefulDegradationService = gracefulDegradationService,
    private toastService: ToastNotificationService = toastNotificationService
  ) {
    // Listen for degradation state changes to show appropriate notifications
    this.degradationService.onStateChange((state) => {
      this.handleDegradationStateChange(state);
    });
  }

  /**
   * Handle ElevenLabs voice synthesis with full error handling
   */
  async handleVoiceSynthesis<T>(
    operation: () => Promise<T>,
    fallbackOperation?: () => Promise<T>
  ): Promise<ErrorHandlingResult<T>> {
    try {
      // Try with circuit breaker and retry logic
      const result = await this.circuitBreaker.execute(async () => {
        return await this.retryService.executeWithRetry(
          operation,
          RetryService.shouldRetryVoiceSynthesis
        );
      });

      // Success - restore service if it was degraded
      if (this.degradationService.isServiceDegraded(ServiceType.VOICE_SYNTHESIS)) {
        this.degradationService.restoreService(ServiceType.VOICE_SYNTHESIS);
      }

      return {
        success: true,
        data: result,
        degraded: false
      };

    } catch (error) {
      console.error('Voice synthesis failed:', error);

      // Degrade service and try fallback
      const degradationState = this.degradationService.degradeService(
        ServiceType.VOICE_SYNTHESIS, 
        error as Error
      );

      if (fallbackOperation) {
        try {
          const fallbackResult = await fallbackOperation();
          return {
            success: true,
            data: fallbackResult,
            degraded: true,
            fallbackUsed: 'buffered_audio'
          };
        } catch (fallbackError) {
          console.error('Fallback operation also failed:', fallbackError);
        }
      }

      return {
        success: false,
        error: error as Error,
        degraded: true
      };
    }
  }

  /**
   * Handle memory service operations with error handling
   */
  async handleMemoryService<T>(
    operation: () => Promise<T>,
    fallbackData?: T
  ): Promise<ErrorHandlingResult<T>> {
    try {
      const result = await memoryServiceRetry.executeWithRetry(
        operation,
        RetryService.shouldRetryMemoryService
      );

      // Success - restore service if it was degraded
      if (this.degradationService.isServiceDegraded(ServiceType.MEMORY_SERVICE)) {
        this.degradationService.restoreService(ServiceType.MEMORY_SERVICE);
      }

      return {
        success: true,
        data: result,
        degraded: false
      };

    } catch (error) {
      console.error('Memory service failed:', error);

      // Degrade service
      this.degradationService.degradeService(ServiceType.MEMORY_SERVICE, error as Error);

      // Use fallback data if available
      if (fallbackData !== undefined) {
        return {
          success: true,
          data: fallbackData,
          degraded: true,
          fallbackUsed: 'session_memory_only'
        };
      }

      return {
        success: false,
        error: error as Error,
        degraded: true
      };
    }
  }

  /**
   * Handle expression system operations
   */
  async handleExpressionSystem<T>(
    operation: () => Promise<T>
  ): Promise<ErrorHandlingResult<T>> {
    try {
      const result = await operation();

      // Success - restore service if it was degraded
      if (this.degradationService.isServiceDegraded(ServiceType.EXPRESSION_SYSTEM)) {
        this.degradationService.restoreService(ServiceType.EXPRESSION_SYSTEM);
      }

      return {
        success: true,
        data: result,
        degraded: false
      };

    } catch (error) {
      console.error('Expression system failed:', error);

      // Degrade service - expressions are non-critical
      this.degradationService.degradeService(ServiceType.EXPRESSION_SYSTEM, error as Error);

      return {
        success: false,
        error: error as Error,
        degraded: true
      };
    }
  }

  /**
   * Handle streaming audio operations
   */
  async handleStreamingAudio<T>(
    operation: () => Promise<T>,
    fallbackOperation?: () => Promise<T>
  ): Promise<ErrorHandlingResult<T>> {
    try {
      const result = await operation();

      // Success - restore service if it was degraded
      if (this.degradationService.isServiceDegraded(ServiceType.STREAMING_AUDIO)) {
        this.degradationService.restoreService(ServiceType.STREAMING_AUDIO);
      }

      return {
        success: true,
        data: result,
        degraded: false
      };

    } catch (error) {
      console.error('Streaming audio failed:', error);

      // Degrade service and try fallback
      this.degradationService.degradeService(ServiceType.STREAMING_AUDIO, error as Error);

      if (fallbackOperation) {
        try {
          const fallbackResult = await fallbackOperation();
          return {
            success: true,
            data: fallbackResult,
            degraded: true,
            fallbackUsed: 'buffered_audio'
          };
        } catch (fallbackError) {
          console.error('Streaming audio fallback failed:', fallbackError);
        }
      }

      return {
        success: false,
        error: error as Error,
        degraded: true
      };
    }
  }

  private handleDegradationStateChange(state: any): void {
    if (state.level === DegradationLevel.NORMAL && state.affectedServices.length === 0) {
      // All services restored
      this.toastService.showServiceRestored();
    } else if (state.userMessage) {
      // Show appropriate notification based on the service and degradation
      if (state.affectedServices.includes(ServiceType.VOICE_SYNTHESIS)) {
        if (state.fallbackStrategies.includes('lower_quality')) {
          this.toastService.showVoiceQualityReduced();
        } else if (state.fallbackStrategies.includes('buffered_fallback')) {
          this.toastService.showStreamingFallback();
        }
      }

      if (state.affectedServices.includes(ServiceType.MEMORY_SERVICE)) {
        this.toastService.showMemoryServiceUnavailable();
      }

      if (state.affectedServices.includes(ServiceType.EXPRESSION_SYSTEM)) {
        this.toastService.showExpressionsDisabled();
      }
    }
  }

  /**
   * Get current system health status
   */
  getSystemHealth(): {
    circuitBreaker: any;
    degradation: any;
    activeToasts: number;
  } {
    return {
      circuitBreaker: this.circuitBreaker.getStats(),
      degradation: this.degradationService.getCurrentState(),
      activeToasts: this.toastService.getToasts().length
    };
  }

  /**
   * Reset all error handling state
   */
  reset(): void {
    this.circuitBreaker.reset();
    this.degradationService.reset();
    this.toastService.dismissAll();
  }
}

// Global enhanced error handler instance
export const enhancedErrorHandler = new EnhancedErrorHandler();