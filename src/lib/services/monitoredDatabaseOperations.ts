/**
 * Monitored Database Operations - Database wrapper with performance monitoring
 * 
 * Wraps database operations to automatically track performance metrics,
 * query times, success rates, and slow query detection for the extraction pipeline.
 */

import { ExtractionPerformanceMonitor } from './extractionPerformanceMonitor';

/**
 * Database operation wrapper with performance monitoring
 */
export class MonitoredDatabaseOperations {
  private performanceMonitor: ExtractionPerformanceMonitor;

  constructor() {
    this.performanceMonitor = ExtractionPerformanceMonitor.getInstance();
  }

  /**
   * Execute a monitored database query
   */
  async executeQuery<T>(
    operation: () => Promise<T>,
    table: 'quick_facts' | 'fact_history' | 'memory_fragments',
    queryType: 'select' | 'insert' | 'update' | 'delete' = 'select',
    context?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      
      // Record successful query performance
      this.performanceMonitor.recordDatabaseQuery(table, duration, true, queryType);
      
      // Log slow queries for investigation
      if (duration > 100) {
        console.warn(`Slow ${queryType} query on ${table}: ${duration}ms`, context);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record failed query performance
      this.performanceMonitor.recordDatabaseQuery(table, duration, false, queryType);
      
      console.error(`Database ${queryType} query failed on ${table}: ${duration}ms`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        context
      });
      
      throw error;
    }
  }

  /**
   * Insert quick facts with monitoring
   */
  async insertQuickFacts(
    operation: () => Promise<any>,
    avatarId: string,
    facts: Array<{ key: string; value: string; [key: string]: any }>
  ): Promise<any> {
    return this.executeQuery(
      operation,
      'quick_facts',
      'insert',
      { 
        avatarId, 
        factCount: facts.length,
        factKeys: facts.map(f => f.key).join(', ')
      }
    );
  }

  /**
   * Update quick facts with monitoring
   */
  async updateQuickFacts(
    operation: () => Promise<any>,
    avatarId: string,
    factKey: string,
    oldValue?: string,
    newValue?: string
  ): Promise<any> {
    return this.executeQuery(
      operation,
      'quick_facts',
      'update',
      { 
        avatarId, 
        factKey,
        oldValue: oldValue?.substring(0, 50),
        newValue: newValue?.substring(0, 50)
      }
    );
  }

  /**
   * Select quick facts with monitoring
   */
  async selectQuickFacts(
    operation: () => Promise<any>,
    avatarId: string,
    filters?: Record<string, any>
  ): Promise<any> {
    return this.executeQuery(
      operation,
      'quick_facts',
      'select',
      { 
        avatarId,
        filters: filters ? Object.keys(filters).join(', ') : 'none'
      }
    );
  }

  /**
   * Insert fact history with monitoring
   */
  async insertFactHistory(
    operation: () => Promise<any>,
    avatarId: string,
    factKey: string,
    changeType: 'create' | 'update' | 'delete'
  ): Promise<any> {
    return this.executeQuery(
      operation,
      'fact_history',
      'insert',
      { 
        avatarId, 
        factKey,
        changeType
      }
    );
  }

  /**
   * Select memory fragments with monitoring
   */
  async selectMemoryFragments(
    operation: () => Promise<any>,
    avatarId: string,
    limit?: number,
    searchQuery?: string
  ): Promise<any> {
    return this.executeQuery(
      operation,
      'memory_fragments',
      'select',
      { 
        avatarId,
        limit,
        hasSearchQuery: !!searchQuery,
        searchQueryLength: searchQuery?.length || 0
      }
    );
  }

  /**
   * Insert memory fragments with monitoring
   */
  async insertMemoryFragments(
    operation: () => Promise<any>,
    avatarId: string,
    fragments: string[]
  ): Promise<any> {
    return this.executeQuery(
      operation,
      'memory_fragments',
      'insert',
      { 
        avatarId,
        fragmentCount: fragments.length,
        totalLength: fragments.reduce((sum, f) => sum + f.length, 0)
      }
    );
  }

  /**
   * Batch operation with monitoring
   */
  async executeBatch<T>(
    operations: Array<{
      operation: () => Promise<T>;
      table: 'quick_facts' | 'fact_history' | 'memory_fragments';
      queryType: 'select' | 'insert' | 'update' | 'delete';
      context?: Record<string, any>;
    }>
  ): Promise<T[]> {
    const startTime = Date.now();
    const results: T[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const { operation, table, queryType, context } of operations) {
      try {
        const result = await this.executeQuery(operation, table, queryType, context);
        results.push(result);
        successCount++;
      } catch (error) {
        failureCount++;
        console.error(`Batch operation failed:`, { table, queryType, error, context });
        throw error; // Re-throw to maintain transaction semantics
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`Batch operation completed: ${successCount} success, ${failureCount} failures, ${totalDuration}ms total`);

    return results;
  }

  /**
   * Transaction wrapper with monitoring
   */
  async executeTransaction<T>(
    transactionFn: (monitoredOps: MonitoredDatabaseOperations) => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await transactionFn(this);
      const duration = Date.now() - startTime;
      
      console.log(`Transaction completed successfully: ${duration}ms`, context);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.error(`Transaction failed: ${duration}ms`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        context
      });
      
      throw error;
    }
  }

  /**
   * Get database performance summary
   */
  getDatabasePerformanceSummary(): {
    quick_facts: { queries: number; avg_time: number; slow_queries: number };
    fact_history: { queries: number; avg_time: number; slow_queries: number };
    memory_fragments: { queries: number; avg_time: number; slow_queries: number };
  } {
    const dbMetrics = this.performanceMonitor.getDatabasePerformanceMetrics();
    
    return {
      quick_facts: {
        queries: dbMetrics.quick_facts_queries.total_queries,
        avg_time: dbMetrics.quick_facts_queries.average_response_time_ms,
        slow_queries: dbMetrics.quick_facts_queries.slow_queries_count
      },
      fact_history: {
        queries: dbMetrics.fact_history_queries.total_queries,
        avg_time: dbMetrics.fact_history_queries.average_response_time_ms,
        slow_queries: dbMetrics.fact_history_queries.slow_queries_count
      },
      memory_fragments: {
        queries: dbMetrics.memory_fragments_queries.total_queries,
        avg_time: dbMetrics.memory_fragments_queries.average_response_time_ms,
        slow_queries: dbMetrics.memory_fragments_queries.slow_queries_count
      }
    };
  }
}

/**
 * Singleton instance for global use
 */
export const monitoredDb = new MonitoredDatabaseOperations();