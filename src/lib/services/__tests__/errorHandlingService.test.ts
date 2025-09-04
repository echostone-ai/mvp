import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorHandlingService } from '../errorHandlingService';
import { StructuredContext } from '../types';

describe('ErrorHandlingService', () => {
  let errorHandler: ErrorHandlingService;

  beforeEach(() => {
    errorHandler = new ErrorHandlingService(
      { maxRetries: 2, baseDelay: 100, maxDelay: 1000 },
      { contextTTL: 5000, quickFactsTTL: 2000, maxCacheSize: 10 }
    );
  });

  afterEach(async () => {
    await errorHandler.shutdown();
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await errorHandler.executeWithRetry(operation, 'test_operation');
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValue('success');
      
      const result = await errorHandler.executeWithRetry(operation, 'test_operation');
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Persistent failure'));
      
      await expect(
        errorHandler.executeWithRetry(operation, 'test_operation')
      ).rejects.toThrow('Persistent failure');
      
      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should respect custom max retries', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Failure'));
      
      await expect(
        errorHandler.executeWithRetry(operation, 'test_operation', 1)
      ).rejects.toThrow('Failure');
      
      expect(operation).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });

  describe('cache management', () => {
    it('should cache and retrieve data', () => {
      const testData = { test: 'value' };
      
      errorHandler.setCachedData('test_key', testData);
      const retrieved = errorHandler.getCachedData('test_key');
      
      expect(retrieved).toEqual(testData);
    });

    it('should return null for expired cache', async () => {
      const testData = { test: 'value' };
      
      errorHandler.setCachedData('test_key', testData, 50); // 50ms TTL
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const retrieved = errorHandler.getCachedData('test_key');
      expect(retrieved).toBeNull();
    });

    it('should evict oldest entries when cache is full', () => {
      // Fill cache to limit
      for (let i = 0; i < 10; i++) {
        errorHandler.setCachedData(`key_${i}`, `value_${i}`);
      }
      
      // Add one more to trigger eviction
      errorHandler.setCachedData('new_key', 'new_value');
      
      // First key should be evicted
      expect(errorHandler.getCachedData('key_0')).toBeNull();
      expect(errorHandler.getCachedData('new_key')).toBe('new_value');
    });
  });

  describe('context caching', () => {
    const mockContext: StructuredContext = {
      quickFacts: [
        {
          id: '1',
          avatarId: 'avatar1',
          key: 'name',
          value: 'John',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ],
      memoryFragments: [
        {
          id: '1',
          avatarId: 'avatar1',
          fragmentText: 'Test memory',
          conversationContext: {
            source: 'test',
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
          content: 'Hello',
          timestamp: '2024-01-01T00:00:00Z'
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

    it('should cache and retrieve full context', () => {
      errorHandler.cacheContextComponents('avatar1', mockContext);
      
      const retrieved = errorHandler.getCachedContext('avatar1');
      
      expect(retrieved).toEqual(mockContext);
    });

    it('should build partial context from components', () => {
      // Cache only quick facts
      errorHandler.setCachedData('quickfacts:avatar1', mockContext.quickFacts);
      
      const retrieved = errorHandler.getCachedContext('avatar1');
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.quickFacts).toEqual(mockContext.quickFacts);
      expect(retrieved!.memoryFragments).toEqual([]);
      expect(retrieved!.conversationHistory).toEqual([]);
      expect(retrieved!.retrievalMetadata.source).toBe('cache_fallback');
    });

    it('should return null when no context available', () => {
      const retrieved = errorHandler.getCachedContext('nonexistent');
      
      expect(retrieved).toBeNull();
    });
  });

  describe('failed operations queue', () => {
    it('should queue failed operations', () => {
      const operationId = errorHandler.queueFailedOperation(
        'memory_update',
        { test: 'data' },
        'Test error'
      );
      
      expect(operationId).toBeDefined();
      
      const status = errorHandler.getQueueStatus();
      expect(status.totalOperations).toBe(1);
      expect(status.operationsByType.memory_update).toBe(1);
    });

    it('should remove operations from queue', () => {
      const operationId = errorHandler.queueFailedOperation(
        'memory_update',
        { test: 'data' },
        'Test error'
      );
      
      errorHandler.removeFromQueue(operationId);
      
      const status = errorHandler.getQueueStatus();
      expect(status.totalOperations).toBe(0);
    });

    it('should track queue statistics', () => {
      errorHandler.queueFailedOperation('memory_update', {}, 'Error 1');
      errorHandler.queueFailedOperation('fact_extraction', {}, 'Error 2');
      errorHandler.queueFailedOperation('memory_update', {}, 'Error 3');
      
      const status = errorHandler.getQueueStatus();
      
      expect(status.totalOperations).toBe(3);
      expect(status.operationsByType.memory_update).toBe(2);
      expect(status.operationsByType.fact_extraction).toBe(1);
      expect(status.oldestOperation).toBeDefined();
    });
  });

  describe('cache statistics', () => {
    it('should provide cache statistics', () => {
      errorHandler.setCachedData('key1', 'value1');
      errorHandler.setCachedData('key2', 'value2');
      
      const stats = errorHandler.getCacheStats();
      
      expect(stats.totalEntries).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.oldestEntry).toBeDefined();
    });

    it('should clear expired cache entries', async () => {
      errorHandler.setCachedData('key1', 'value1', 50); // 50ms TTL
      errorHandler.setCachedData('key2', 'value2', 5000); // 5s TTL
      
      // Wait for first entry to expire
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const cleared = errorHandler.clearExpiredCache();
      
      expect(cleared).toBe(1);
      expect(errorHandler.getCachedData('key1')).toBeNull();
      expect(errorHandler.getCachedData('key2')).toBe('value2');
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      errorHandler.queueFailedOperation('memory_update', {}, 'Test error');
      
      await errorHandler.shutdown();
      
      const status = errorHandler.getQueueStatus();
      expect(status.totalOperations).toBe(0);
    });
  });
});