/**
 * Tests for ExtractionErrorHandler
 * 
 * Tests comprehensive error handling, retry logic, graceful degradation,
 * and monitoring capabilities for the fact extraction pipeline.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  ExtractionErrorHandler, 
  ExtractionError, 
  ExtractionErrorType
} from '../extractionErrorHandler';
import { MemoryError, MemoryErrorType } from '../../memoryErrorHandler';

// Mock console methods
const consoleSpy = {
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {})
};

describe('ExtractionErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    ExtractionErrorHandler.resetAllMetrics();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('error categorization', () => {
    it('should categorize pattern extraction errors correctly', () => {
      const regexError = new Error('Invalid regular expression');
      regexError.name = 'SyntaxError';
      
      const extractionError = ExtractionErrorHandler.categorizeExtractionError(
        regexError, 
        'pattern',
        { patternType: 'birth_year' }
      );

      expect(extractionError).toBeInstanceOf(ExtractionError);
      expect(extractionError.type).toBe(ExtractionErrorType.PATTERN_REGEX_ERROR);
      expect(extractionError.stage).toBe('pattern');
      expect(extractionError.isRetryable).toBe(false);
      expect(extractionError.context.patternType).toBe('birth_year');
    });

    it('should categorize LLM extraction errors correctly', () => {
      const parseError = new Error('JSON parse error in response');
      
      const extractionError = ExtractionErrorHandler.categorizeExtractionError(
        parseError,
        'llm',
        { llmResponse: 'invalid json response' }
      );

      expect(extractionError.type).toBe(ExtractionErrorType.LLM_RESPONSE_PARSING_FAILED);
      expect(extractionError.stage).toBe('llm');
      expect(extractionError.isRetryable).toBe(true);
    });

    it('should categorize storage errors correctly', () => {
      const storageError = new Error('quick_facts insert failed');
      
      const extractionError = ExtractionErrorHandler.categorizeExtractionError(
        storageError,
        'storage',
        { avatarId: 'test-avatar', factCount: 5 }
      );

      expect(extractionError.type).toBe(ExtractionErrorType.QUICK_FACTS_INSERT_FAILED);
      expect(extractionError.stage).toBe('storage');
      expect(extractionError.isRetryable).toBe(true);
      expect(extractionError.context.avatarId).toBe('test-avatar');
    });

    it('should handle null/undefined errors gracefully', () => {
      const extractionError = ExtractionErrorHandler.categorizeExtractionError(
        null,
        'pattern'
      );

      expect(extractionError).toBeInstanceOf(ExtractionError);
      expect(extractionError.message).toContain('Unknown error occurred');
    });
  });

  describe('retry logic', () => {
    it('should retry retryable pattern errors', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('pattern normalization failed'))
        .mockResolvedValueOnce('success');

      // Fast-forward timers to avoid waiting for delays
      const promise = ExtractionErrorHandler.withExtractionRetry(
        operation,
        'pattern',
        { patternType: 'birth_year' }
      );

      await vi.advanceTimersByTimeAsync(2000);
      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    }, 10000);

    it('should not retry non-retryable errors', async () => {
      const regexError = new Error('Invalid regular expression');
      regexError.name = 'SyntaxError';
      
      const operation = vi.fn().mockRejectedValue(regexError);

      await expect(
        ExtractionErrorHandler.withExtractionRetry(operation, 'pattern')
      ).rejects.toThrow('Pattern regex compilation failed');

      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('graceful degradation', () => {
    it('should use fallback when operation fails', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Pattern extraction failed'));
      const fallback = vi.fn().mockResolvedValue('fallback result');

      const result = await ExtractionErrorHandler.withGracefulDegradation(
        operation,
        fallback,
        'pattern',
        { text: 'test text' }
      );

      expect(result).toBe('fallback result');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(fallback).toHaveBeenCalledTimes(1);
    });

    it('should return operation result when successful', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const fallback = vi.fn().mockResolvedValue('fallback');

      const result = await ExtractionErrorHandler.withGracefulDegradation(
        operation,
        fallback,
        'pattern'
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(fallback).not.toHaveBeenCalled();
    });
  });

  describe('metrics tracking', () => {
    it('should track extraction metrics', () => {
      ExtractionErrorHandler.updateExtractionMetrics(1500, 5, true);
      ExtractionErrorHandler.updateExtractionMetrics(2000, 3, false);

      const metrics = ExtractionErrorHandler.getExtractionMetrics();

      expect(metrics.total_extractions).toBe(2);
      expect(metrics.successful_extractions).toBe(1);
      expect(metrics.average_processing_time_ms).toBe(1750);
      expect(metrics.facts_extracted_per_extraction).toBe(4);
    });

    it('should calculate success rate correctly', () => {
      ExtractionErrorHandler.updateExtractionMetrics(1000, 5, true);
      ExtractionErrorHandler.updateExtractionMetrics(1000, 0, false);
      ExtractionErrorHandler.updateExtractionMetrics(1000, 3, true);

      const successRate = ExtractionErrorHandler.getExtractionSuccessRate();
      expect(successRate).toBeCloseTo(66.67, 1);
    });
  });

  describe('health monitoring', () => {
    it('should report healthy status with good metrics', () => {
      // Simulate successful extractions
      for (let i = 0; i < 10; i++) {
        ExtractionErrorHandler.updateExtractionMetrics(5000, 3, true);
      }

      const isHealthy = ExtractionErrorHandler.isExtractionPipelineHealthy();
      expect(isHealthy).toBe(true);
    });

    it('should report unhealthy status with poor success rate', () => {
      // Simulate mostly failed extractions
      for (let i = 0; i < 10; i++) {
        ExtractionErrorHandler.updateExtractionMetrics(5000, 0, i < 3); // 30% success rate
      }

      const isHealthy = ExtractionErrorHandler.isExtractionPipelineHealthy();
      expect(isHealthy).toBe(false);
    });

    it('should provide comprehensive health report', () => {
      // Simulate mixed results
      ExtractionErrorHandler.updateExtractionMetrics(5000, 3, true);
      ExtractionErrorHandler.updateExtractionMetrics(15000, 0, false);
      ExtractionErrorHandler.updateExtractionMetrics(8000, 2, true);

      const healthReport = ExtractionErrorHandler.getExtractionHealthReport();

      expect(healthReport).toHaveProperty('isHealthy');
      expect(healthReport).toHaveProperty('successRate');
      expect(healthReport).toHaveProperty('totalExtractions', 3);
      expect(healthReport).toHaveProperty('failuresByStage');
      expect(healthReport).toHaveProperty('recommendations');
      expect(Array.isArray(healthReport.recommendations)).toBe(true);
    });
  });

  describe('user-friendly messages', () => {
    it('should provide user-friendly messages for different error types', () => {
      const patternError = new ExtractionError(
        ExtractionErrorType.PATTERN_PARSING_FAILED,
        'Pattern failed',
        'pattern'
      );

      const llmError = new ExtractionError(
        ExtractionErrorType.LLM_RESPONSE_PARSING_FAILED,
        'LLM failed',
        'llm'
      );

      const storageError = new ExtractionError(
        ExtractionErrorType.QUICK_FACTS_INSERT_FAILED,
        'Storage failed',
        'storage'
      );

      expect(ExtractionErrorHandler.getUserFriendlyMessage(patternError))
        .toContain('pattern matching');
      expect(ExtractionErrorHandler.getUserFriendlyMessage(llmError))
        .toContain('AI processing');
      expect(ExtractionErrorHandler.getUserFriendlyMessage(storageError))
        .toContain('save extracted facts');
    });
  });

  describe('edge cases', () => {
    it('should handle errors without messages', () => {
      const errorWithoutMessage = new Error();
      errorWithoutMessage.message = '';

      const extractionError = ExtractionErrorHandler.categorizeExtractionError(
        errorWithoutMessage,
        'llm'
      );

      expect(extractionError.message).toContain('LLM prompt construction failed');
    });

    it('should reset metrics correctly', () => {
      ExtractionErrorHandler.updateExtractionMetrics(1000, 5, true);
      ExtractionErrorHandler.resetAllMetrics();

      const metrics = ExtractionErrorHandler.getExtractionMetrics();
      expect(metrics.total_extractions).toBe(0);
      expect(metrics.successful_extractions).toBe(0);
      expect(metrics.average_processing_time_ms).toBe(0);
    });
  });
});