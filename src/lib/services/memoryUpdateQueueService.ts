import { ExtractedFact, QuickFact, MemoryFragment } from './types';
import { ErrorHandlingService, FailedOperation } from './errorHandlingService';

export interface MemoryUpdateOperation {
  id: string;
  type: 'quick_fact_update' | 'memory_fragment_update' | 'fact_extraction';
  avatarId: string;
  data: any;
  priority: number;
  attempts: number;
  maxRetries: number;
  createdAt: Date;
  lastAttempt?: Date;
  nextRetry?: Date;
  error?: string;
}

export interface QueueStats {
  totalOperations: number;
  operationsByType: Record<string, number>;
  operationsByPriority: Record<number, number>;
  averageRetries: number;
  oldestOperation?: Date;
  successRate: number;
}

export class MemoryUpdateQueueService {
  private errorHandler: ErrorHandlingService;
  private processingInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private successCount = 0;
  private failureCount = 0;

  constructor(errorHandler: ErrorHandlingService) {
    this.errorHandler = errorHandler;
    this.startQueueProcessor();
  }

  /**
   * Queue a quick fact update operation
   */
  async queueQuickFactUpdate(
    avatarId: string,
    facts: ExtractedFact[],
    priority: number = 5
  ): Promise<string> {
    const operation: MemoryUpdateOperation = {
      id: this.generateOperationId('quick_fact'),
      type: 'quick_fact_update',
      avatarId,
      data: { facts },
      priority,
      attempts: 0,
      maxRetries: 3,
      createdAt: new Date()
    };

    try {
      // Try immediate execution first
      await this.executeQuickFactUpdate(operation);
      this.successCount++;
      return operation.id;
    } catch (error) {
      console.warn(`Quick fact update failed, queuing for retry:`, error);
      this.queueOperation(operation, error as Error);
      return operation.id;
    }
  }

  /**
   * Queue a memory fragment update operation
   */
  async queueMemoryFragmentUpdate(
    avatarId: string,
    fragmentText: string,
    conversationContext: any,
    priority: number = 5
  ): Promise<string> {
    const operation: MemoryUpdateOperation = {
      id: this.generateOperationId('memory_fragment'),
      type: 'memory_fragment_update',
      avatarId,
      data: { fragmentText, conversationContext },
      priority,
      attempts: 0,
      maxRetries: 3,
      createdAt: new Date()
    };

    try {
      // Try immediate execution first
      await this.executeMemoryFragmentUpdate(operation);
      this.successCount++;
      return operation.id;
    } catch (error) {
      console.warn(`Memory fragment update failed, queuing for retry:`, error);
      this.queueOperation(operation, error as Error);
      return operation.id;
    }
  }

  /**
   * Queue a fact extraction operation
   */
  async queueFactExtraction(
    avatarId: string,
    userInput: string,
    assistantResponse: string,
    priority: number = 7
  ): Promise<string> {
    const operation: MemoryUpdateOperation = {
      id: this.generateOperationId('fact_extraction'),
      type: 'fact_extraction',
      avatarId,
      data: { userInput, assistantResponse },
      priority,
      attempts: 0,
      maxRetries: 2, // Fewer retries for extraction
      createdAt: new Date()
    };

    try {
      // Try immediate execution first
      await this.executeFactExtraction(operation);
      this.successCount++;
      return operation.id;
    } catch (error) {
      console.warn(`Fact extraction failed, queuing for retry:`, error);
      this.queueOperation(operation, error as Error);
      return operation.id;
    }
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): QueueStats {
    const queueStatus = this.errorHandler.getQueueStatus();
    const totalAttempts = this.successCount + this.failureCount;
    
    return {
      totalOperations: queueStatus.totalOperations,
      operationsByType: queueStatus.operationsByType,
      operationsByPriority: {}, // Would need to track this separately
      averageRetries: totalAttempts > 0 ? this.failureCount / totalAttempts : 0,
      oldestOperation: queueStatus.oldestOperation,
      successRate: totalAttempts > 0 ? this.successCount / totalAttempts : 1
    };
  }

  /**
   * Clear completed operations and get summary
   */
  clearCompleted(): { cleared: number; remaining: number } {
    // This would integrate with the error handler's queue management
    const stats = this.getQueueStats();
    return {
      cleared: 0, // Placeholder
      remaining: stats.totalOperations
    };
  }

  /**
   * Pause queue processing
   */
  pauseProcessing(): void {
    this.isProcessing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * Resume queue processing
   */
  resumeProcessing(): void {
    if (!this.processingInterval) {
      this.startQueueProcessor();
    }
  }

  /**
   * Shutdown queue service
   */
  async shutdown(): Promise<void> {
    this.pauseProcessing();
    
    // Process any high-priority operations one final time
    const stats = this.getQueueStats();
    console.log(`Shutting down memory update queue with ${stats.totalOperations} remaining operations`);
  }

  /**
   * Execute quick fact update operation
   */
  private async executeQuickFactUpdate(operation: MemoryUpdateOperation): Promise<void> {
    const { facts } = operation.data;
    
    // This would integrate with the actual database service
    // For now, simulate the operation
    await this.simulateAsyncOperation('quick_fact_update', 200);
    
    console.log(`Updated ${facts.length} quick facts for avatar ${operation.avatarId}`);
  }

  /**
   * Execute memory fragment update operation
   */
  private async executeMemoryFragmentUpdate(operation: MemoryUpdateOperation): Promise<void> {
    const { fragmentText, conversationContext } = operation.data;
    
    // This would integrate with the actual database service
    // For now, simulate the operation
    await this.simulateAsyncOperation('memory_fragment_update', 300);
    
    console.log(`Updated memory fragment for avatar ${operation.avatarId}: ${fragmentText.substring(0, 50)}...`);
  }

  /**
   * Execute fact extraction operation
   */
  private async executeFactExtraction(operation: MemoryUpdateOperation): Promise<void> {
    const { userInput, assistantResponse } = operation.data;
    
    // This would integrate with the actual fact extraction service
    // For now, simulate the operation
    await this.simulateAsyncOperation('fact_extraction', 500);
    
    console.log(`Extracted facts from conversation for avatar ${operation.avatarId}`);
  }

  /**
   * Queue operation for retry
   */
  private queueOperation(operation: MemoryUpdateOperation, error: Error): void {
    const failedOp = this.errorHandler.queueFailedOperation(
      'memory_update',
      operation,
      error.message
    );
    
    this.failureCount++;
    console.log(`Queued operation ${operation.id} as ${failedOp} for retry`);
  }

  /**
   * Start the queue processor
   */
  private startQueueProcessor(): void {
    this.isProcessing = true;
    this.processingInterval = setInterval(async () => {
      if (this.isProcessing) {
        await this.processQueuedOperations();
      }
    }, 10000); // Process every 10 seconds
  }

  /**
   * Process queued operations
   */
  private async processQueuedOperations(): Promise<void> {
    // This would integrate with the error handler's retry queue
    // For now, just log that we're processing
    const stats = this.getQueueStats();
    if (stats.totalOperations > 0) {
      console.log(`Processing ${stats.totalOperations} queued memory operations`);
    }
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(type: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${type}_${timestamp}_${random}`;
  }

  /**
   * Simulate async operation for testing
   */
  private async simulateAsyncOperation(type: string, baseDelay: number): Promise<void> {
    const delay = baseDelay + Math.random() * 100;
    
    // Simulate occasional failures
    if (Math.random() < 0.1) {
      throw new Error(`Simulated ${type} failure`);
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}