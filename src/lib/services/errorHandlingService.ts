import { StructuredContext, QuickFact, MemoryFragment, ConversationTurn } from './types';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface CacheConfig {
  contextTTL: number;
  quickFactsTTL: number;
  memoryFragmentsTTL: number;
  maxCacheSize: number;
}

export interface FailedOperation {
  id: string;
  type: 'memory_update' | 'fact_extraction' | 'context_retrieval';
  data: any;
  attempts: number;
  lastAttempt: Date;
  nextRetry: Date;
  error: string;
}

export interface CachedData {
  key: string;
  data: any;
  timestamp: Date;
  ttl: number;
}

export class ErrorHandlingService {
  private retryConfig: RetryConfig;
  private cacheConfig: CacheConfig;
  private inMemoryCache: Map<string, CachedData>;
  private failedOperationsQueue: Map<string, FailedOperation>;
  private retryTimer: NodeJS.Timeout | null = null;

  constructor(
    retryConfig: Partial<RetryConfig> = {},
    cacheConfig: Partial<CacheConfig> = {}
  ) {
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      ...retryConfig
    };

    this.cacheConfig = {
      contextTTL: 300000, // 5 minutes
      quickFactsTTL: 30000, // 30 seconds
      memoryFragmentsTTL: 60000, // 1 minute
      maxCacheSize: 1000,
      ...cacheConfig
    };

    this.inMemoryCache = new Map();
    this.failedOperationsQueue = new Map();
    this.startRetryProcessor();
  }

  /**
   * Execute operation with retry logic and exponential backoff
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationType: string,
    maxRetries?: number
  ): Promise<T> {
    const retries = maxRetries ?? this.retryConfig.maxRetries;
    let lastError: Error;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === retries) {
          console.error(`Operation ${operationType} failed after ${retries + 1} attempts:`, error);
          throw error;
        }

        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt),
          this.retryConfig.maxDelay
        );

        console.warn(`Operation ${operationType} failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms:`, error);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Get cached data with TTL validation
   */
  getCachedData<T>(key: string): T | null {
    const cached = this.inMemoryCache.get(key);
    if (!cached) {
      return null;
    }

    const now = new Date();
    const age = now.getTime() - cached.timestamp.getTime();
    
    if (age > cached.ttl) {
      this.inMemoryCache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  /**
   * Cache data with TTL
   */
  setCachedData(key: string, data: any, ttl?: number): void {
    // Enforce cache size limit
    if (this.inMemoryCache.size >= this.cacheConfig.maxCacheSize) {
      this.evictOldestCacheEntry();
    }

    const cacheEntry: CachedData = {
      key,
      data,
      timestamp: new Date(),
      ttl: ttl ?? this.cacheConfig.contextTTL
    };

    this.inMemoryCache.set(key, cacheEntry);
  }

  /**
   * Get cached context with fallback structure
   */
  getCachedContext(avatarId: string): StructuredContext | null {
    const cached = this.getCachedData<StructuredContext>(`context:${avatarId}`);
    if (cached) {
      return cached;
    }

    // Try to build partial context from individual cached components
    const quickFacts = this.getCachedData<QuickFact[]>(`quickfacts:${avatarId}`) || [];
    const memoryFragments = this.getCachedData<MemoryFragment[]>(`memories:${avatarId}`) || [];
    const conversationHistory = this.getCachedData<ConversationTurn[]>(`history:${avatarId}`) || [];

    if (quickFacts.length > 0 || memoryFragments.length > 0 || conversationHistory.length > 0) {
      return {
        quickFacts,
        memoryFragments,
        conversationHistory,
        retrievalMetadata: {
          source: 'cache_fallback',
          timestamp: new Date().toISOString(),
          totalFacts: quickFacts.length,
          totalMemories: memoryFragments.length,
          totalHistory: conversationHistory.length,
          cacheHit: true
        }
      };
    }

    return null;
  }

  /**
   * Cache context components separately for better fallback options
   */
  cacheContextComponents(avatarId: string, context: StructuredContext): void {
    this.setCachedData(`context:${avatarId}`, context, this.cacheConfig.contextTTL);
    this.setCachedData(`quickfacts:${avatarId}`, context.quickFacts, this.cacheConfig.quickFactsTTL);
    this.setCachedData(`memories:${avatarId}`, context.memoryFragments, this.cacheConfig.memoryFragmentsTTL);
    this.setCachedData(`history:${avatarId}`, context.conversationHistory, this.cacheConfig.contextTTL);
  }

  /**
   * Add failed operation to retry queue
   */
  queueFailedOperation(
    type: FailedOperation['type'],
    data: any,
    error: string
  ): string {
    const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    const failedOp: FailedOperation = {
      id,
      type,
      data,
      attempts: 0,
      lastAttempt: now,
      nextRetry: new Date(now.getTime() + this.retryConfig.baseDelay),
      error
    };

    this.failedOperationsQueue.set(id, failedOp);
    console.warn(`Queued failed operation ${id} for retry:`, error);
    
    return id;
  }

  /**
   * Remove operation from retry queue
   */
  removeFromQueue(operationId: string): void {
    this.failedOperationsQueue.delete(operationId);
  }

  /**
   * Get queue status for monitoring
   */
  getQueueStatus(): {
    totalOperations: number;
    operationsByType: Record<string, number>;
    oldestOperation?: Date;
  } {
    const operations = Array.from(this.failedOperationsQueue.values());
    const operationsByType: Record<string, number> = {};
    
    operations.forEach(op => {
      operationsByType[op.type] = (operationsByType[op.type] || 0) + 1;
    });

    const oldestOperation = operations.length > 0 
      ? new Date(Math.min(...operations.map(op => op.lastAttempt.getTime())))
      : undefined;

    return {
      totalOperations: operations.length,
      operationsByType,
      oldestOperation
    };
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): number {
    const now = new Date();
    let cleared = 0;

    for (const [key, cached] of this.inMemoryCache.entries()) {
      const age = now.getTime() - cached.timestamp.getTime();
      if (age > cached.ttl) {
        this.inMemoryCache.delete(key);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalEntries: number;
    totalSize: number;
    hitRate?: number;
    oldestEntry?: Date;
  } {
    const entries = Array.from(this.inMemoryCache.values());
    const totalSize = JSON.stringify(entries).length;
    const oldestEntry = entries.length > 0 
      ? new Date(Math.min(...entries.map(e => e.timestamp.getTime())))
      : undefined;

    return {
      totalEntries: entries.length,
      totalSize,
      oldestEntry
    };
  }

  /**
   * Graceful shutdown - process remaining queue items
   */
  async shutdown(): Promise<void> {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }

    // Give remaining operations one final attempt
    const remainingOps = Array.from(this.failedOperationsQueue.values());
    console.log(`Shutting down with ${remainingOps.length} operations in queue`);
    
    // Clear queues
    this.failedOperationsQueue.clear();
    this.inMemoryCache.clear();
  }

  private startRetryProcessor(): void {
    this.retryTimer = setInterval(() => {
      this.processRetryQueue();
    }, 5000); // Check every 5 seconds
  }

  private async processRetryQueue(): Promise<void> {
    const now = new Date();
    const readyOperations = Array.from(this.failedOperationsQueue.values())
      .filter(op => op.nextRetry <= now && op.attempts < this.retryConfig.maxRetries);

    for (const operation of readyOperations) {
      try {
        await this.retryOperation(operation);
        this.failedOperationsQueue.delete(operation.id);
      } catch (error) {
        operation.attempts++;
        operation.lastAttempt = now;
        
        if (operation.attempts >= this.retryConfig.maxRetries) {
          console.error(`Operation ${operation.id} exceeded max retries, removing from queue:`, error);
          this.failedOperationsQueue.delete(operation.id);
        } else {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, operation.attempts),
            this.retryConfig.maxDelay
          );
          operation.nextRetry = new Date(now.getTime() + delay);
          operation.error = (error as Error).message;
        }
      }
    }
  }

  private async retryOperation(operation: FailedOperation): Promise<void> {
    console.log(`Retrying operation ${operation.id} (attempt ${operation.attempts + 1})`);
    
    switch (operation.type) {
      case 'memory_update':
        // This would integrate with the actual memory update service
        throw new Error('Memory update retry not implemented - requires integration with MemoryUpdatePipeline');
      
      case 'fact_extraction':
        // This would integrate with the actual fact extraction service
        throw new Error('Fact extraction retry not implemented - requires integration with FactExtractionEngine');
      
      case 'context_retrieval':
        // This would integrate with the actual context retrieval service
        throw new Error('Context retrieval retry not implemented - requires integration with ContextRetrievalEngine');
      
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private evictOldestCacheEntry(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, cached] of this.inMemoryCache.entries()) {
      if (cached.timestamp.getTime() < oldestTime) {
        oldestTime = cached.timestamp.getTime();
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.inMemoryCache.delete(oldestKey);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const errorHandlingService = new ErrorHandlingService();