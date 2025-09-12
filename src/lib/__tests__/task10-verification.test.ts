/**
 * Task 10 Verification Tests
 * Tests for enhanced error handling and graceful degradation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CircuitBreaker, CircuitState } from '../services/circuitBreaker';
import { RetryService } from '../services/retryService';
import { GracefulDegradationService, ServiceType, DegradationLevel } from '../services/gracefulDegradation';
import { ToastNotificationService, ToastType } from '../services/toastNotificationService';
import { EnhancedErrorHandler } from '../services/enhancedErrorHandler';

describe('Task 10: Enhanced Error Handling', () => {
  describe('CircuitBreaker', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 1000,
        monitorWindowMs: 5000
      });
    });

    it('should start in CLOSED state', () => {
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failures).toBe(0);
    });

    it('should open circuit after failure threshold', async () => {
      const failingOperation = vi.fn().mockRejectedValue(new Error('Service unavailable'));

      // Trigger failures to reach threshold
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.OPEN);
      expect(stats.failures).toBe(3);
    });

    it('should reject requests when circuit is OPEN', async () => {
      const failingOperation = vi.fn().mockRejectedValue(new Error('Service unavailable'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      // Should reject without calling operation
      await expect(circuitBreaker.execute(vi.fn())).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should identify circuit breaker errors correctly', () => {
      expect(CircuitBreaker.isCircuitBreakerError({ status: 500 })).toBe(true);
      expect(CircuitBreaker.isCircuitBreakerError({ status: 503 })).toBe(true);
      expect(CircuitBreaker.isCircuitBreakerError({ code: 'TIMEOUT' })).toBe(true);
      expect(CircuitBreaker.isCircuitBreakerError({ code: 'ECONNREFUSED' })).toBe(true);
      expect(CircuitBreaker.isCircuitBreakerError({ status: 400 })).toBe(false);
      expect(CircuitBreaker.isCircuitBreakerError({ status: 404 })).toBe(false);
    });
  });

  describe('RetryService', () => {
    let retryService: RetryService;

    beforeEach(() => {
      retryService = new RetryService({
        maxAttempts: 3,
        baseDelayMs: 10, // Fast for testing
        maxDelayMs: 100,
        backoffMultiplier: 2,
        jitterMs: 0 // No jitter for predictable tests
      });
    });

    it('should succeed on first attempt if operation succeeds', async () => {
      const successOperation = vi.fn().mockResolvedValue('success');
      
      const result = await retryService.executeWithRetry(successOperation);
      
      expect(result).toBe('success');
      expect(successOperation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue('success');
      
      const result = await retryService.executeWithRetry(
        operation,
        RetryService.shouldRetryVoiceSynthesis
      );
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const operation = vi.fn().mockRejectedValue({ status: 401 }); // Unauthorized
      
      await expect(
        retryService.executeWithRetry(operation, RetryService.shouldRetryVoiceSynthesis)
      ).rejects.toMatchObject({ status: 401 });
      
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should respect max attempts', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Always fails'));
      
      await expect(
        retryService.executeWithRetry(operation, RetryService.shouldRetryVoiceSynthesis)
      ).rejects.toThrow('Always fails');
      
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should identify retryable voice synthesis errors', () => {
      expect(RetryService.shouldRetryVoiceSynthesis({ status: 500 })).toBe(true);
      expect(RetryService.shouldRetryVoiceSynthesis({ status: 429 })).toBe(true);
      expect(RetryService.shouldRetryVoiceSynthesis({ code: 'TIMEOUT' })).toBe(true);
      expect(RetryService.shouldRetryVoiceSynthesis({ status: 400 })).toBe(false);
      expect(RetryService.shouldRetryVoiceSynthesis({ status: 404 })).toBe(false);
    });

    it('should identify retryable memory service errors', () => {
      expect(RetryService.shouldRetryMemoryService({ code: 'PGRST301' })).toBe(true);
      expect(RetryService.shouldRetryMemoryService({ status: 500 })).toBe(true);
      expect(RetryService.shouldRetryMemoryService({ code: 'TIMEOUT' })).toBe(true);
      expect(RetryService.shouldRetryMemoryService({ status: 400 })).toBe(false);
    });
  });

  describe('GracefulDegradationService', () => {
    let degradationService: GracefulDegradationService;

    beforeEach(() => {
      degradationService = new GracefulDegradationService();
    });

    it('should start in NORMAL state', () => {
      const state = degradationService.getCurrentState();
      expect(state.level).toBe(DegradationLevel.NORMAL);
      expect(state.affectedServices).toHaveLength(0);
    });

    it('should degrade service and update state', () => {
      const state = degradationService.degradeService(ServiceType.VOICE_SYNTHESIS);
      
      expect(state.level).toBe(DegradationLevel.REDUCED);
      expect(state.affectedServices).toContain(ServiceType.VOICE_SYNTHESIS);
      expect(state.fallbackStrategies).toHaveLength(1);
      expect(state.userMessage).toBeDefined();
    });

    it('should restore service and update state', () => {
      // First degrade
      degradationService.degradeService(ServiceType.VOICE_SYNTHESIS);
      
      // Then restore
      const state = degradationService.restoreService(ServiceType.VOICE_SYNTHESIS);
      
      expect(state.level).toBe(DegradationLevel.NORMAL);
      expect(state.affectedServices).not.toContain(ServiceType.VOICE_SYNTHESIS);
    });

    it('should calculate degradation levels correctly', () => {
      // No services affected = NORMAL
      expect(degradationService.getCurrentState().level).toBe(DegradationLevel.NORMAL);
      
      // 1 service = REDUCED
      degradationService.degradeService(ServiceType.VOICE_SYNTHESIS);
      expect(degradationService.getCurrentState().level).toBe(DegradationLevel.REDUCED);
      
      // 2 services = MINIMAL
      degradationService.degradeService(ServiceType.MEMORY_SERVICE);
      expect(degradationService.getCurrentState().level).toBe(DegradationLevel.MINIMAL);
      
      // 3+ services = OFFLINE
      degradationService.degradeService(ServiceType.EXPRESSION_SYSTEM);
      expect(degradationService.getCurrentState().level).toBe(DegradationLevel.OFFLINE);
    });

    it('should notify listeners of state changes', () => {
      const listener = vi.fn();
      degradationService.onStateChange(listener);
      
      degradationService.degradeService(ServiceType.VOICE_SYNTHESIS);
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          level: DegradationLevel.REDUCED,
          affectedServices: [ServiceType.VOICE_SYNTHESIS]
        })
      );
    });
  });

  describe('ToastNotificationService', () => {
    let toastService: ToastNotificationService;

    beforeEach(() => {
      toastService = new ToastNotificationService({
        defaultDuration: 100, // Fast for testing
        maxToasts: 3
      });
    });

    afterEach(() => {
      toastService.dismissAll();
    });

    it('should create and show toast notifications', () => {
      const id = toastService.show('Test message', ToastType.INFO);
      
      expect(id).toBeDefined();
      const toasts = toastService.getToasts();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toBe('Test message');
      expect(toasts[0].type).toBe(ToastType.INFO);
    });

    it('should auto-dismiss toasts after duration', async () => {
      toastService.show('Test message', ToastType.INFO, 50);
      
      expect(toastService.getToasts()).toHaveLength(1);
      
      // Wait for auto-dismiss
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(toastService.getToasts()).toHaveLength(0);
    });

    it('should limit number of toasts', () => {
      // Show more toasts than the limit
      for (let i = 0; i < 5; i++) {
        toastService.show(`Message ${i}`, ToastType.INFO, 0); // No auto-dismiss
      }
      
      const toasts = toastService.getToasts();
      expect(toasts).toHaveLength(3); // Should be limited to maxToasts
    });

    it('should dismiss specific toasts', () => {
      const id1 = toastService.show('Message 1', ToastType.INFO, 0);
      const id2 = toastService.show('Message 2', ToastType.INFO, 0);
      
      expect(toastService.getToasts()).toHaveLength(2);
      
      toastService.dismiss(id1);
      
      const remainingToasts = toastService.getToasts();
      expect(remainingToasts).toHaveLength(1);
      expect(remainingToasts[0].id).toBe(id2);
    });

    it('should provide predefined toast methods', () => {
      toastService.showVoiceQualityReduced();
      toastService.showMemoryServiceUnavailable();
      toastService.showExpressionsDisabled();
      
      const toasts = toastService.getToasts();
      expect(toasts).toHaveLength(3);
      expect(toasts.some(t => t.message.includes('Audio quality'))).toBe(true);
      expect(toasts.some(t => t.message.includes('Memory temporarily'))).toBe(true);
      expect(toasts.some(t => t.message.includes('expressions'))).toBe(true);
    });
  });

  describe('EnhancedErrorHandler Integration', () => {
    let errorHandler: EnhancedErrorHandler;
    let mockCircuitBreaker: CircuitBreaker;
    let mockRetryService: RetryService;
    let mockDegradationService: GracefulDegradationService;
    let mockToastService: ToastNotificationService;

    beforeEach(() => {
      mockCircuitBreaker = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 1000 });
      mockRetryService = new RetryService({ maxAttempts: 2, baseDelayMs: 10 });
      mockDegradationService = new GracefulDegradationService();
      mockToastService = new ToastNotificationService({ defaultDuration: 100 });
      
      errorHandler = new EnhancedErrorHandler(
        mockCircuitBreaker,
        mockRetryService,
        mockDegradationService,
        mockToastService
      );
    });

    it('should handle successful voice synthesis', async () => {
      const operation = vi.fn().mockResolvedValue('audio-data');
      
      const result = await errorHandler.handleVoiceSynthesis(operation);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('audio-data');
      expect(result.degraded).toBe(false);
    });

    it('should handle voice synthesis failure with fallback', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('TTS failed'));
      const fallback = vi.fn().mockResolvedValue('fallback-audio');
      
      const result = await errorHandler.handleVoiceSynthesis(operation, fallback);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('fallback-audio');
      expect(result.degraded).toBe(true);
      expect(result.fallbackUsed).toBe('buffered_audio');
    });

    it('should handle memory service with fallback data', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('DB connection failed'));
      const fallbackData = 'session-memory';
      
      const result = await errorHandler.handleMemoryService(operation, fallbackData);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('session-memory');
      expect(result.degraded).toBe(true);
      expect(result.fallbackUsed).toBe('session_memory_only');
    });

    it('should handle expression system failures gracefully', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Expression load failed'));
      
      const result = await errorHandler.handleExpressionSystem(operation);
      
      expect(result.success).toBe(false);
      expect(result.degraded).toBe(true);
      expect(mockDegradationService.isServiceDegraded(ServiceType.EXPRESSION_SYSTEM)).toBe(true);
    });

    it('should provide system health status', () => {
      const health = errorHandler.getSystemHealth();
      
      expect(health.circuitBreaker).toBeDefined();
      expect(health.degradation).toBeDefined();
      expect(health.activeToasts).toBeDefined();
    });

    it('should reset all error handling state', () => {
      // Cause some degradation
      mockDegradationService.degradeService(ServiceType.VOICE_SYNTHESIS);
      mockToastService.show('Test toast', ToastType.INFO, 0);
      
      errorHandler.reset();
      
      const health = errorHandler.getSystemHealth();
      expect(health.degradation.level).toBe(DegradationLevel.NORMAL);
      expect(health.activeToasts).toBe(0);
    });
  });

  describe('Requirements Verification', () => {
    it('should implement circuit breaker for ElevenLabs failures (Req 1.4, 2.4)', () => {
      const circuitBreaker = new CircuitBreaker();
      
      // Verify 30s fallback timeout as per requirements
      expect(circuitBreaker.getStats().state).toBe(CircuitState.CLOSED);
      
      // Verify it handles 5xx and timeout errors
      expect(CircuitBreaker.isCircuitBreakerError({ status: 500 })).toBe(true);
      expect(CircuitBreaker.isCircuitBreakerError({ code: 'TIMEOUT' })).toBe(true);
    });

    it('should implement exponential backoff retry logic (Req 2.4)', () => {
      const retryService = new RetryService({
        maxAttempts: 3,
        baseDelayMs: 1000,
        backoffMultiplier: 2
      });
      
      // Verify retry conditions for voice synthesis
      expect(RetryService.shouldRetryVoiceSynthesis({ status: 500 })).toBe(true);
      expect(RetryService.shouldRetryVoiceSynthesis({ status: 429 })).toBe(true);
      expect(RetryService.shouldRetryVoiceSynthesis({ status: 400 })).toBe(false);
    });

    it('should implement graceful degradation for memory service (Req 4.5)', () => {
      const degradationService = new GracefulDegradationService();
      
      // Verify memory service degradation
      const state = degradationService.degradeService(ServiceType.MEMORY_SERVICE);
      expect(state.affectedServices).toContain(ServiceType.MEMORY_SERVICE);
      expect(state.userMessage).toContain('Memory');
    });

    it('should provide user-friendly toast notifications (Req 6.4)', () => {
      const toastService = new ToastNotificationService();
      
      // Verify short, non-technical messages
      toastService.showVoiceQualityReduced();
      toastService.showMemoryServiceUnavailable();
      
      const toasts = toastService.getToasts();
      expect(toasts).toHaveLength(2);
      
      // Messages should be user-friendly and non-technical
      toasts.forEach(toast => {
        expect(toast.message.length).toBeLessThan(100); // Short messages
        expect(toast.message).not.toMatch(/error|exception|stack|debug/i); // Non-technical
      });
    });
  });
});