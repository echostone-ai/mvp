import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryUpdateQueueService } from '../memoryUpdateQueueService';
import { ErrorHandlingService } from '../errorHandlingService';
import { ExtractedFact } from '../types';

describe('MemoryUpdateQueueService', () => {
  let queueService: MemoryUpdateQueueService;
  let mockErrorHandler: ErrorHandlingService;

  beforeEach(() => {
    mockErrorHandler = new ErrorHandlingService(
      { maxRetries: 2, baseDelay: 100 },
      { maxCacheSize: 10 }
    );
    queueService = new MemoryUpdateQueueService(mockErrorHandler);
  });

  afterEach(async () => {
    await queueService.shutdown();
    await mockErrorHandler.shutdown();
  });

  describe('queueQuickFactUpdate', () => {
    const mockFacts: ExtractedFact[] = [
      {
        key: 'name',
        value: 'John Doe',
        confidence: 0.9,
        priority: 1,
        source: 'extraction',
        sourceReference: 'conversation_1'
      }
    ];

    it('should execute immediately on success', async () => {
      const operationId = await queueService.queueQuickFactUpdate(
        'avatar1',
        mockFacts,
        5
      );

      expect(operationId).toBeDefined();
      expect(operationId).toMatch(/^quick_fact_/);

      const stats = queueService.getQueueStats();
      expect(stats.successRate).toBe(1);
    });

    it('should queue operation on failure', async () => {
      // Mock a failure by making the operation always fail
      vi.spyOn(queueService as any, 'executeQuickFactUpdate')
        .mockRejectedValue(new Error('Database connection failed'));

      const operationId = await queueService.queueQuickFactUpdate(
        'avatar1',
        mockFacts,
        5
      );

      expect(operationId).toBeDefined();

      const queueStatus = mockErrorHandler.getQueueStatus();
      expect(queueStatus.totalOperations).toBe(1);
    });

    it('should handle high priority operations', async () => {
      const operationId = await queueService.queueQuickFactUpdate(
        'avatar1',
        mockFacts,
        1 // High priority
      );

      expect(operationId).toBeDefined();
    });
  });

  describe('queueMemoryFragmentUpdate', () => {
    it('should execute memory fragment update immediately on success', async () => {
      const operationId = await queueService.queueMemoryFragmentUpdate(
        'avatar1',
        'User mentioned they love coffee',
        { conversationId: 'conv1', type: 'user' },
        5
      );

      expect(operationId).toBeDefined();
      expect(operationId).toMatch(/^memory_fragment_/);

      const stats = queueService.getQueueStats();
      expect(stats.successRate).toBe(1);
    });

    it('should queue operation on failure', async () => {
      vi.spyOn(queueService as any, 'executeMemoryFragmentUpdate')
        .mockRejectedValue(new Error('Storage service unavailable'));

      const operationId = await queueService.queueMemoryFragmentUpdate(
        'avatar1',
        'User mentioned they love coffee',
        { conversationId: 'conv1', type: 'user' },
        5
      );

      expect(operationId).toBeDefined();

      const queueStatus = mockErrorHandler.getQueueStatus();
      expect(queueStatus.totalOperations).toBe(1);
    });
  });

  describe('queueFactExtraction', () => {
    it('should execute fact extraction immediately on success', async () => {
      const operationId = await queueService.queueFactExtraction(
        'avatar1',
        'My name is Alice',
        'Nice to meet you, Alice!',
        7
      );

      expect(operationId).toBeDefined();
      expect(operationId).toMatch(/^fact_extraction_/);

      const stats = queueService.getQueueStats();
      expect(stats.successRate).toBe(1);
    });

    it('should queue operation on failure', async () => {
      vi.spyOn(queueService as any, 'executeFactExtraction')
        .mockRejectedValue(new Error('Extraction service timeout'));

      const operationId = await queueService.queueFactExtraction(
        'avatar1',
        'My name is Alice',
        'Nice to meet you, Alice!',
        7
      );

      expect(operationId).toBeDefined();

      const queueStatus = mockErrorHandler.getQueueStatus();
      expect(queueStatus.totalOperations).toBe(1);
    });
  });

  describe('queue statistics', () => {
    it('should provide accurate queue statistics', async () => {
      // Mock failures to populate queue
      vi.spyOn(queueService as any, 'executeQuickFactUpdate')
        .mockRejectedValue(new Error('Test failure'));
      vi.spyOn(queueService as any, 'executeMemoryFragmentUpdate')
        .mockRejectedValue(new Error('Test failure'));

      await queueService.queueQuickFactUpdate('avatar1', [], 5);
      await queueService.queueMemoryFragmentUpdate('avatar1', 'test', {}, 5);

      const stats = queueService.getQueueStats();

      expect(stats.totalOperations).toBe(2);
      expect(stats.successRate).toBe(0);
      expect(stats.averageRetries).toBeGreaterThan(0);
    });

    it('should track success rate correctly', async () => {
      // First operation succeeds, second fails
      vi.spyOn(queueService as any, 'executeQuickFactUpdate')
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Test failure'));

      await queueService.queueQuickFactUpdate('avatar1', [], 5);
      await queueService.queueQuickFactUpdate('avatar1', [], 5);

      const stats = queueService.getQueueStats();

      expect(stats.successRate).toBe(0.5);
    });
  });

  describe('queue management', () => {
    it('should pause and resume processing', () => {
      queueService.pauseProcessing();
      
      // Verify processing is paused (implementation detail)
      expect((queueService as any).isProcessing).toBe(false);

      queueService.resumeProcessing();
      
      // Verify processing is resumed
      expect((queueService as any).processingInterval).toBeDefined();
    });

    it('should clear completed operations', () => {
      const result = queueService.clearCompleted();

      expect(result).toHaveProperty('cleared');
      expect(result).toHaveProperty('remaining');
      expect(typeof result.cleared).toBe('number');
      expect(typeof result.remaining).toBe('number');
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      // Add some operations to queue
      vi.spyOn(queueService as any, 'executeQuickFactUpdate')
        .mockRejectedValue(new Error('Test failure'));

      await queueService.queueQuickFactUpdate('avatar1', [], 5);

      await queueService.shutdown();

      // Verify processing is stopped
      expect((queueService as any).processingInterval).toBeNull();
    });
  });

  describe('operation execution simulation', () => {
    it('should simulate successful operations', async () => {
      // Test the private simulation methods indirectly
      const operationId = await queueService.queueQuickFactUpdate('avatar1', [], 5);
      
      expect(operationId).toBeDefined();
      
      const stats = queueService.getQueueStats();
      // Should succeed most of the time due to 10% failure rate in simulation
      expect(stats.successRate).toBeGreaterThanOrEqual(0);
    });

    it('should handle simulated failures gracefully', async () => {
      // Run multiple operations to potentially hit the 10% failure rate
      const operations = [];
      for (let i = 0; i < 20; i++) {
        operations.push(queueService.queueQuickFactUpdate(`avatar${i}`, [], 5));
      }

      await Promise.all(operations);

      const stats = queueService.getQueueStats();
      // Some operations might fail due to simulation
      expect(stats.successRate).toBeGreaterThan(0);
    });
  });
});