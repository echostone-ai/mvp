import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorHandlingService } from '../errorHandlingService';
import { ContextFallbackService } from '../contextFallbackService';
import { GPT5ApiService } from '../gpt5ApiService';
import { MemoryUpdateQueueService } from '../memoryUpdateQueueService';
import { StructuredContext } from '../types';

// Mock fetch for GPT5ApiService
global.fetch = vi.fn();

describe('Error Handling Integration', () => {
  let errorHandler: ErrorHandlingService;
  let fallbackService: ContextFallbackService;
  let gpt5Service: GPT5ApiService;
  let queueService: MemoryUpdateQueueService;

  const mockContext: StructuredContext = {
    quickFacts: [
      {
        id: '1',
        avatarId: 'avatar1',
        key: 'name',
        value: 'John Doe',
        confidence: 0.9,
        priority: 1,
        source: 'manual',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }
    ],
    memoryFragments: [
      {
        id: '1',
        avatarId: 'avatar1',
        fragmentText: 'User enjoys morning coffee',
        conversationContext: {
          source: 'conversation',
          type: 'user',
          conversationId: 'conv1'
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }
    ],
    conversationHistory: [
      {
        role: 'user',
        content: 'Good morning!',
        timestamp: '2024-01-01T09:00:00Z'
      }
    ],
    retrievalMetadata: {
      source: 'database',
      timestamp: '2024-01-01T00:00:00Z',
      totalFacts: 1,
      totalMemories: 1,
      totalHistory: 1
    }
  };

  beforeEach(() => {
    errorHandler = new ErrorHandlingService(
      { maxRetries: 2, baseDelay: 100, maxDelay: 1000 },
      { contextTTL: 5000, quickFactsTTL: 2000, maxCacheSize: 10 }
    );
    
    fallbackService = new ContextFallbackService(errorHandler);
    
    gpt5Service = new GPT5ApiService(
      {
        apiKey: 'test-key',
        model: 'gpt-5-turbo',
        fallbackModel: 'gpt-4-turbo-preview',
        timeout: 5000
      },
      errorHandler
    );
    
    queueService = new MemoryUpdateQueueService(errorHandler);

    vi.clearAllMocks();
  });

  afterEach(async () => {
    await queueService.shutdown();
    await errorHandler.shutdown();
  });

  describe('complete conversation flow with failures', () => {
    it('should handle context retrieval failure with cached fallback', async () => {
      // Pre-cache some context
      errorHandler.cacheContextComponents('avatar1', mockContext);

      // Simulate context retrieval failure
      const contextError = new Error('Database connection timeout');
      
      const fallbackContext = await fallbackService.getFallbackContext(
        'avatar1',
        'Hello there',
        contextError
      );

      expect(fallbackContext).toBeDefined();
      expect(fallbackContext.quickFacts).toEqual(mockContext.quickFacts);
      expect(fallbackContext.retrievalMetadata.source).toBe('cache_fallback');
      expect(fallbackContext.retrievalMetadata.fallbackReason).toBe('Database connection timeout');

      // Validate the fallback context
      const validation = fallbackService.validateFallbackContext(fallbackContext);
      expect(validation.isValid).toBe(true);
      expect(validation.quality).toBe('medium'); // Missing conversation history downgrades to medium
    });

    it('should handle GPT-5 failure with GPT-4 fallback', async () => {
      const mockGpt4Response = {
        choices: [
          {
            message: {
              content: 'Hello John! How can I help you today?',
              role: 'assistant'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 20,
          total_tokens: 70
        },
        model: 'gpt-4-turbo-preview'
      };

      // First call (GPT-5) fails, second call (GPT-4) succeeds
      (fetch as any)
        .mockRejectedValueOnce(new Error('GPT-5 service unavailable'))
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockGpt4Response)
        });

      const response = await gpt5Service.generateResponse(
        mockContext,
        'Hello there!'
      );

      expect(response.text).toBe('Hello John! How can I help you today?');
      expect(response.modelUsed).toContain('gpt-4-turbo-preview'); // May or may not have (fallback) suffix
      expect(response.confidence).toBeLessThan(0.9); // Reduced confidence for fallback
    });

    it('should handle complete API failure with emergency response', async () => {
      // Both GPT-5 and GPT-4 fail
      (fetch as any).mockRejectedValue(new Error('All AI services unavailable'));

      const response = await gpt5Service.generateResponse(
        mockContext,
        'Hello there!'
      );

      expect(response.text).toContain('technical difficulties');
      expect(response.modelUsed).toBe('emergency_fallback');
      expect(response.confidence).toBe(0.1);
      expect(response.extractedFacts).toEqual([]);
    });

    it('should queue failed memory updates for retry', async () => {
      // Mock memory update failure
      vi.spyOn(queueService as any, 'executeQuickFactUpdate')
        .mockRejectedValue(new Error('Database write timeout'));

      const operationId = await queueService.queueQuickFactUpdate(
        'avatar1',
        [
          {
            key: 'hobby',
            value: 'reading',
            confidence: 0.8,
            priority: 5,
            source: 'extraction',
            sourceReference: 'conv1'
          }
        ],
        5
      );

      expect(operationId).toBeDefined();

      const queueStatus = errorHandler.getQueueStatus();
      expect(queueStatus.totalOperations).toBe(1);
      expect(queueStatus.operationsByType.memory_update).toBe(1);
    });
  });

  describe('cascading failure scenarios', () => {
    it('should handle multiple simultaneous failures gracefully', async () => {
      // Simulate context retrieval failure
      const contextError = new Error('Database cluster down');
      
      // No cached data available
      vi.spyOn(errorHandler, 'getCachedContext').mockReturnValue(null);
      vi.spyOn(errorHandler, 'getCachedData').mockReturnValue(null);

      // Get emergency fallback context
      const fallbackContext = await fallbackService.getFallbackContext(
        'avatar1',
        'Hello',
        contextError
      );

      expect(fallbackContext.retrievalMetadata.source).toBe('emergency_fallback');
      expect(fallbackContext.quickFacts.length).toBe(2); // Emergency facts

      // API also fails
      (fetch as any).mockRejectedValue(new Error('Network timeout'));

      const response = await gpt5Service.generateResponse(
        fallbackContext,
        'Hello there!'
      );

      expect(response.modelUsed).toBe('emergency_fallback');
      expect(response.text).toContain('technical difficulties');

      // Memory updates also fail but get queued
      vi.spyOn(queueService as any, 'executeMemoryFragmentUpdate')
        .mockRejectedValue(new Error('Storage unavailable'));

      const memoryOpId = await queueService.queueMemoryFragmentUpdate(
        'avatar1',
        'User said hello',
        { conversationId: 'conv1' },
        5
      );

      expect(memoryOpId).toBeDefined();

      // System should still be functional despite all failures
      const queueStats = queueService.getQueueStats();
      expect(queueStats.totalOperations).toBeGreaterThan(0);
    });

    it('should recover when services come back online', async () => {
      // Start with failures
      (fetch as any).mockRejectedValue(new Error('Service unavailable'));

      let response = await gpt5Service.generateResponse(
        mockContext,
        'Hello'
      );

      expect(response.modelUsed).toBe('emergency_fallback');

      // Service comes back online
      const mockApiResponse = {
        choices: [
          {
            message: {
              content: 'Hello! I\'m back online and ready to help.',
              role: 'assistant'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 40,
          completion_tokens: 15,
          total_tokens: 55
        },
        model: 'gpt-5-turbo'
      };

      (fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      });

      response = await gpt5Service.generateResponse(
        mockContext,
        'Are you working now?'
      );

      expect(response.modelUsed).toBe('gpt-5-turbo');
      expect(response.text).toBe('Hello! I\'m back online and ready to help.');
    });
  });

  describe('performance under failure conditions', () => {
    it('should maintain reasonable response times during failures', async () => {
      const startTime = Date.now();

      // Simulate slow primary service with fast fallback
      (fetch as any)
        .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 6000))) // Timeout
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: 'Fallback response', role: 'assistant' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 30, completion_tokens: 10, total_tokens: 40 },
            model: 'gpt-4-turbo-preview'
          })
        });

      const response = await gpt5Service.generateResponse(
        mockContext,
        'Hello'
      );

      const responseTime = Date.now() - startTime;

      // Should fail fast and use emergency fallback
      expect(responseTime).toBeLessThan(8000); // Less than timeout + fallback time
      expect(response.modelUsed).toContain('fallback'); // Could be emergency_fallback or gpt-4 fallback
    });

    it('should handle high load with failures gracefully', async () => {
      // Simulate multiple concurrent requests with some failures
      const requests = Array.from({ length: 10 }, (_, i) => {
        if (i % 3 === 0) {
          // Every third request fails
          (fetch as any).mockRejectedValueOnce(new Error('Overloaded'));
        } else {
          (fetch as any).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
              choices: [{ message: { content: `Response ${i}`, role: 'assistant' }, finish_reason: 'stop' }],
              usage: { prompt_tokens: 30, completion_tokens: 10, total_tokens: 40 },
              model: 'gpt-5-turbo'
            })
          });
        }

        return gpt5Service.generateResponse(mockContext, `Request ${i}`);
      });

      const responses = await Promise.all(requests);

      // All requests should complete
      expect(responses).toHaveLength(10);

      // Some should be successful, some should be emergency fallbacks
      const successfulResponses = responses.filter(r => r.modelUsed === 'gpt-5-turbo');
      const fallbackResponses = responses.filter(r => r.modelUsed === 'emergency_fallback');

      expect(successfulResponses.length).toBeGreaterThan(0);
      expect(fallbackResponses.length).toBeGreaterThan(0);
      expect(successfulResponses.length + fallbackResponses.length).toBe(10);
    }, 10000);
  });

  describe('system health monitoring', () => {
    it('should provide comprehensive system health status', () => {
      // Add some operations to queues
      errorHandler.queueFailedOperation('memory_update', { test: 'data1' }, 'Error 1');
      errorHandler.queueFailedOperation('fact_extraction', { test: 'data2' }, 'Error 2');

      // Add some cache entries
      errorHandler.setCachedData('test1', 'value1');
      errorHandler.setCachedData('test2', 'value2');

      const queueStatus = errorHandler.getQueueStatus();
      const cacheStats = errorHandler.getCacheStats();
      const queueServiceStats = queueService.getQueueStats();

      expect(queueStatus.totalOperations).toBe(2);
      expect(queueStatus.operationsByType.memory_update).toBe(1);
      expect(queueStatus.operationsByType.fact_extraction).toBe(1);

      expect(cacheStats.totalEntries).toBe(2);
      expect(cacheStats.totalSize).toBeGreaterThan(0);

      expect(queueServiceStats).toHaveProperty('successRate');
      expect(queueServiceStats).toHaveProperty('totalOperations');
    });

    it('should clean up expired resources', async () => {
      // Add cache entries with short TTL
      errorHandler.setCachedData('short_lived', 'value', 50);
      errorHandler.setCachedData('long_lived', 'value', 5000);

      expect(errorHandler.getCacheStats().totalEntries).toBe(2);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      const cleared = errorHandler.clearExpiredCache();

      expect(cleared).toBe(1);
      expect(errorHandler.getCacheStats().totalEntries).toBe(1);
      expect(errorHandler.getCachedData('short_lived')).toBeNull();
      expect(errorHandler.getCachedData('long_lived')).toBe('value');
    });
  });
});