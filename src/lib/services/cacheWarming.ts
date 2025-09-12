// src/lib/services/cacheWarming.ts
// Cache warming strategies for hybrid retrieval system

import { CacheManager } from './cacheManager';
import { EmbeddingService } from './embeddingService';
import { QueryExpander, ExpansionRequest } from './queryExpander';
import { FactbookService } from './factbookService';
import { HybridRetriever } from './hybridRetrieval';

/**
 * Cache warming configuration
 */
export interface CacheWarmingConfig {
  // Query warming
  commonQueries: string[];
  maxQueriesPerBatch: number;
  queryWarmingEnabled: boolean;
  
  // Embedding warming
  embeddingWarmingEnabled: boolean;
  precomputeAllSnippets: boolean;
  embeddingBatchSize: number;
  
  // Expansion warming
  expansionWarmingEnabled: boolean;
  precomputeExpansions: boolean;
  
  // Performance settings
  maxConcurrentOperations: number;
  warmingTimeoutMs: number;
  retryFailedOperations: boolean;
  maxRetries: number;
  
  // Scheduling
  enableScheduledWarming: boolean;
  warmingIntervalHours: number;
  warmOnFactbookUpdate: boolean;
  warmOnModelUpdate: boolean;
}

/**
 * Cache warming statistics
 */
export interface CacheWarmingStats {
  // Overall stats
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  totalTimeMs: number;
  
  // Query warming stats
  queriesWarmed: number;
  queryWarmingTimeMs: number;
  queryFailures: number;
  
  // Embedding warming stats
  embeddingsWarmed: number;
  embeddingWarmingTimeMs: number;
  embeddingFailures: number;
  
  // Expansion warming stats
  expansionsWarmed: number;
  expansionWarmingTimeMs: number;
  expansionFailures: number;
  
  // Performance metrics
  averageOperationTimeMs: number;
  operationsPerSecond: number;
  cacheHitRateImprovement: number;
  
  // Last warming info
  lastWarmingTime: number;
  nextScheduledWarming?: number;
}

/**
 * Cache warming service for hybrid retrieval system
 */
export class CacheWarmingService {
  private config: CacheWarmingConfig;
  private cacheManager: CacheManager;
  private embeddingService: EmbeddingService | null = null;
  private queryExpander: QueryExpander | null = null;
  private factbookService: FactbookService;
  private hybridRetriever: HybridRetriever | null = null;
  
  private warmingInterval: NodeJS.Timeout | null = null;
  private isWarming = false;
  private lastWarmingStats: CacheWarmingStats | null = null;

  constructor(
    config: Partial<CacheWarmingConfig>,
    cacheManager: CacheManager,
    factbookService?: FactbookService
  ) {
    this.config = {
      // Query warming defaults
      commonQueries: config.commonQueries || this.getDefaultCommonQueries(),
      maxQueriesPerBatch: config.maxQueriesPerBatch || 10,
      queryWarmingEnabled: config.queryWarmingEnabled !== false,
      
      // Embedding warming defaults
      embeddingWarmingEnabled: config.embeddingWarmingEnabled !== false,
      precomputeAllSnippets: config.precomputeAllSnippets !== false,
      embeddingBatchSize: config.embeddingBatchSize || 50,
      
      // Expansion warming defaults
      expansionWarmingEnabled: config.expansionWarmingEnabled !== false,
      precomputeExpansions: config.precomputeExpansions !== false,
      
      // Performance defaults
      maxConcurrentOperations: config.maxConcurrentOperations || 5,
      warmingTimeoutMs: config.warmingTimeoutMs || 30000,
      retryFailedOperations: config.retryFailedOperations !== false,
      maxRetries: config.maxRetries || 2,
      
      // Scheduling defaults
      enableScheduledWarming: config.enableScheduledWarming !== false,
      warmingIntervalHours: config.warmingIntervalHours || 6,
      warmOnFactbookUpdate: config.warmOnFactbookUpdate !== false,
      warmOnModelUpdate: config.warmOnModelUpdate !== false
    };

    this.cacheManager = cacheManager;
    this.factbookService = factbookService || FactbookService.getInstance();

    // Initialize optional services
    this.initializeServices();

    // Start scheduled warming if enabled
    if (this.config.enableScheduledWarming) {
      this.startScheduledWarming();
    }

    console.log('cache_warming_service_initialized', {
      query_warming: this.config.queryWarmingEnabled,
      embedding_warming: this.config.embeddingWarmingEnabled,
      expansion_warming: this.config.expansionWarmingEnabled,
      scheduled_warming: this.config.enableScheduledWarming,
      interval_hours: this.config.warmingIntervalHours,
      common_queries_count: this.config.commonQueries.length
    });
  }

  /**
   * Initialize optional services for warming
   */
  private initializeServices(): void {
    try {
      // Initialize embedding service if available
      if (process.env.OPENAI_API_KEY) {
        this.embeddingService = new EmbeddingService({
          model: 'text-embedding-3-small',
          dimensions: 1536,
          batchSize: this.config.embeddingBatchSize
        });
      }

      // Initialize query expander if available
      if (process.env.OPENAI_API_KEY) {
        this.queryExpander = new QueryExpander({
          model: 'gpt-4',
          timeoutMs: 5000, // Longer timeout for warming
          enableCache: true
        });
      }

    } catch (error) {
      console.warn('cache_warming_service_init_partial', {
        error: error instanceof Error ? error.message : error,
        embedding_service: this.embeddingService !== null,
        query_expander: this.queryExpander !== null
      });
    }
  }

  /**
   * Perform comprehensive cache warming
   */
  async warmCache(): Promise<CacheWarmingStats> {
    if (this.isWarming) {
      console.warn('cache_warming_already_in_progress');
      return this.lastWarmingStats || this.createEmptyStats();
    }

    this.isWarming = true;
    const startTime = Date.now();

    console.log('cache_warming_start', {
      query_warming: this.config.queryWarmingEnabled,
      embedding_warming: this.config.embeddingWarmingEnabled,
      expansion_warming: this.config.expansionWarmingEnabled
    });

    const stats: CacheWarmingStats = this.createEmptyStats();

    try {
      // Phase 1: Warm embeddings for all factbook snippets
      if (this.config.embeddingWarmingEnabled && this.embeddingService) {
        await this.warmEmbeddings(stats);
      }

      // Phase 2: Warm common query results
      if (this.config.queryWarmingEnabled) {
        await this.warmQueries(stats);
      }

      // Phase 3: Warm query expansions
      if (this.config.expansionWarmingEnabled && this.queryExpander) {
        await this.warmExpansions(stats);
      }

      // Calculate final statistics
      stats.totalTimeMs = Date.now() - startTime;
      stats.totalOperations = stats.queriesWarmed + stats.embeddingsWarmed + stats.expansionsWarmed;
      stats.successfulOperations = stats.totalOperations - stats.queryFailures - stats.embeddingFailures - stats.expansionFailures;
      stats.failedOperations = stats.queryFailures + stats.embeddingFailures + stats.expansionFailures;
      stats.averageOperationTimeMs = stats.totalOperations > 0 ? stats.totalTimeMs / stats.totalOperations : 0;
      stats.operationsPerSecond = stats.totalTimeMs > 0 ? (stats.totalOperations * 1000) / stats.totalTimeMs : 0;
      stats.lastWarmingTime = Date.now();

      this.lastWarmingStats = stats;

      console.log('cache_warming_complete', {
        total_operations: stats.totalOperations,
        successful: stats.successfulOperations,
        failed: stats.failedOperations,
        total_time_ms: stats.totalTimeMs,
        operations_per_second: Math.round(stats.operationsPerSecond),
        queries_warmed: stats.queriesWarmed,
        embeddings_warmed: stats.embeddingsWarmed,
        expansions_warmed: stats.expansionsWarmed
      });

      return stats;

    } catch (error) {
      console.error('cache_warming_error', {
        error: error instanceof Error ? error.message : error,
        elapsed_ms: Date.now() - startTime
      });

      stats.totalTimeMs = Date.now() - startTime;
      stats.failedOperations = stats.totalOperations;
      return stats;

    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Warm embeddings for all factbook snippets
   */
  private async warmEmbeddings(stats: CacheWarmingStats): Promise<void> {
    if (!this.embeddingService) {
      console.warn('embedding_warming_skipped', { reason: 'EmbeddingService not available' });
      return;
    }

    const startTime = Date.now();
    console.log('embedding_warming_start');

    try {
      // Get all factbook snippets
      const snippets = this.factbookService.getAllSnippets();
      const texts = snippets.map(snippet => snippet.text);

      console.log('embedding_warming_processing', {
        total_snippets: texts.length,
        batch_size: this.config.embeddingBatchSize
      });

      // Process in batches to avoid overwhelming the API
      const batches = this.createBatches(texts, this.config.embeddingBatchSize);
      let processedCount = 0;

      for (const batch of batches) {
        try {
          // Check if embeddings are already cached
          const uncachedTexts: string[] = [];
          for (const text of batch) {
            const cacheKey = `embedding:${text}`;
            const cached = await this.cacheManager.get(cacheKey);
            if (!cached) {
              uncachedTexts.push(text);
            }
          }

          if (uncachedTexts.length > 0) {
            // Generate embeddings for uncached texts
            const embeddings = await this.embeddingService.generateEmbeddings(uncachedTexts);

            // Cache the embeddings
            for (let i = 0; i < uncachedTexts.length; i++) {
              const text = uncachedTexts[i];
              const embedding = embeddings[i];
              const cacheKey = `embedding:${text}`;
              
              await this.cacheManager.set(cacheKey, embedding, 24 * 60 * 60 * 1000); // 24 hour TTL
              stats.embeddingsWarmed++;
            }

            console.log('embedding_batch_complete', {
              batch_size: uncachedTexts.length,
              total_processed: processedCount + batch.length,
              total_snippets: texts.length,
              cached_count: batch.length - uncachedTexts.length,
              generated_count: uncachedTexts.length
            });
          } else {
            console.log('embedding_batch_cached', {
              batch_size: batch.length,
              total_processed: processedCount + batch.length,
              total_snippets: texts.length
            });
          }

          processedCount += batch.length;

          // Add small delay between batches to be respectful to the API
          if (batches.indexOf(batch) < batches.length - 1) {
            await this.sleep(100);
          }

        } catch (error) {
          console.warn('embedding_batch_error', {
            batch_size: batch.length,
            error: error instanceof Error ? error.message : error
          });
          stats.embeddingFailures += batch.length;
        }
      }

      stats.embeddingWarmingTimeMs = Date.now() - startTime;

      console.log('embedding_warming_complete', {
        total_snippets: texts.length,
        embeddings_warmed: stats.embeddingsWarmed,
        failures: stats.embeddingFailures,
        time_ms: stats.embeddingWarmingTimeMs
      });

    } catch (error) {
      console.error('embedding_warming_error', {
        error: error instanceof Error ? error.message : error
      });
      stats.embeddingWarmingTimeMs = Date.now() - startTime;
    }
  }

  /**
   * Warm cache with common query results
   */
  private async warmQueries(stats: CacheWarmingStats): Promise<void> {
    const startTime = Date.now();
    console.log('query_warming_start', {
      query_count: this.config.commonQueries.length
    });

    try {
      // Process queries in batches to control concurrency
      const batches = this.createBatches(this.config.commonQueries, this.config.maxQueriesPerBatch);

      for (const batch of batches) {
        const promises = batch.map(async (query) => {
          try {
            // Check if query result is already cached
            const cacheKey = `query_result:${query}`;
            const cached = await this.cacheManager.get(cacheKey);

            if (!cached && this.hybridRetriever) {
              // Execute query to warm the cache
              const result = await this.hybridRetriever.retrieve(query);
              
              // Cache the result
              await this.cacheManager.set(cacheKey, result, 2 * 60 * 60 * 1000); // 2 hour TTL
              
              stats.queriesWarmed++;
              
              console.log('query_warmed', {
                query,
                result_count: result.results.length,
                methods_used: result.metrics.methodsUsed
              });
            } else {
              console.log('query_already_cached', { query });
            }

          } catch (error) {
            console.warn('query_warming_error', {
              query,
              error: error instanceof Error ? error.message : error
            });
            stats.queryFailures++;
          }
        });

        // Wait for batch to complete
        await Promise.allSettled(promises);

        // Add delay between batches
        if (batches.indexOf(batch) < batches.length - 1) {
          await this.sleep(200);
        }
      }

      stats.queryWarmingTimeMs = Date.now() - startTime;

      console.log('query_warming_complete', {
        total_queries: this.config.commonQueries.length,
        queries_warmed: stats.queriesWarmed,
        failures: stats.queryFailures,
        time_ms: stats.queryWarmingTimeMs
      });

    } catch (error) {
      console.error('query_warming_error', {
        error: error instanceof Error ? error.message : error
      });
      stats.queryWarmingTimeMs = Date.now() - startTime;
    }
  }

  /**
   * Warm query expansions for common queries
   */
  private async warmExpansions(stats: CacheWarmingStats): Promise<void> {
    if (!this.queryExpander) {
      console.warn('expansion_warming_skipped', { reason: 'QueryExpander not available' });
      return;
    }

    const startTime = Date.now();
    console.log('expansion_warming_start', {
      query_count: this.config.commonQueries.length
    });

    try {
      for (const query of this.config.commonQueries) {
        try {
          // Create expansion request
          const expansionRequest: ExpansionRequest = {
            originalQuery: query,
            lowConfidenceResults: [], // Empty for warming
            context: 'Cache warming'
          };

          // Generate expansion (this will cache the result internally)
          const expansion = await this.queryExpander.expandQuery(expansionRequest);
          
          if (!expansion.cached) {
            stats.expansionsWarmed++;
            
            console.log('expansion_warmed', {
              query,
              alternates_count: expansion.alternates.length,
              concepts_count: expansion.related_concepts.length,
              confidence: expansion.confidence.toFixed(3)
            });
          } else {
            console.log('expansion_already_cached', { query });
          }

          // Small delay between expansions
          await this.sleep(50);

        } catch (error) {
          console.warn('expansion_warming_error', {
            query,
            error: error instanceof Error ? error.message : error
          });
          stats.expansionFailures++;
        }
      }

      stats.expansionWarmingTimeMs = Date.now() - startTime;

      console.log('expansion_warming_complete', {
        total_queries: this.config.commonQueries.length,
        expansions_warmed: stats.expansionsWarmed,
        failures: stats.expansionFailures,
        time_ms: stats.expansionWarmingTimeMs
      });

    } catch (error) {
      console.error('expansion_warming_error', {
        error: error instanceof Error ? error.message : error
      });
      stats.expansionWarmingTimeMs = Date.now() - startTime;
    }
  }

  /**
   * Set hybrid retriever for query warming
   */
  setHybridRetriever(hybridRetriever: HybridRetriever): void {
    this.hybridRetriever = hybridRetriever;
    console.log('cache_warming_hybrid_retriever_set');
  }

  /**
   * Trigger cache warming on factbook update
   */
  async onFactbookUpdate(version: string): Promise<void> {
    if (!this.config.warmOnFactbookUpdate) {
      return;
    }

    console.log('cache_warming_factbook_update', { version });
    
    // Clear existing cache first
    await this.cacheManager.clear('factbook_updated');
    
    // Warm cache with new content
    await this.warmCache();
  }

  /**
   * Trigger cache warming on model update
   */
  async onModelUpdate(modelVersion: string): Promise<void> {
    if (!this.config.warmOnModelUpdate) {
      return;
    }

    console.log('cache_warming_model_update', { version: modelVersion });
    
    // Clear model-specific caches
    await this.cacheManager.clear('model_version_changed');
    
    // Warm cache with new model
    await this.warmCache();
  }

  /**
   * Get cache warming statistics
   */
  getStats(): CacheWarmingStats | null {
    return this.lastWarmingStats;
  }

  /**
   * Check if warming is currently in progress
   */
  isWarmingInProgress(): boolean {
    return this.isWarming;
  }

  /**
   * Start scheduled cache warming
   */
  private startScheduledWarming(): void {
    const intervalMs = this.config.warmingIntervalHours * 60 * 60 * 1000;
    
    this.warmingInterval = setInterval(async () => {
      console.log('scheduled_cache_warming_start');
      try {
        await this.warmCache();
      } catch (error) {
        console.error('scheduled_cache_warming_error', {
          error: error instanceof Error ? error.message : error
        });
      }
    }, intervalMs);

    console.log('scheduled_cache_warming_enabled', {
      interval_hours: this.config.warmingIntervalHours,
      next_warming: new Date(Date.now() + intervalMs).toISOString()
    });
  }

  /**
   * Stop scheduled cache warming
   */
  stopScheduledWarming(): void {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
      this.warmingInterval = null;
      console.log('scheduled_cache_warming_stopped');
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopScheduledWarming();
    console.log('cache_warming_service_destroyed');
  }

  // Private helper methods

  private getDefaultCommonQueries(): string[] {
    return [
      'where did you grow up',
      'tell me about your childhood',
      'what happened with the snake',
      'tell me about the cobra story',
      'who is your brother',
      'tell me about tyler',
      'who is tyler',
      'tyler partner',
      'tell me about cansu',
      'tell me about olive',
      'what about george',
      'tell me about your pets',
      'what happened at sxsw',
      'meetings at sxsw',
      'bill murray story',
      'gza concert',
      'tell me about your family',
      'what do you do for work',
      'tell me about your career',
      'what are your hobbies',
      'tell me about your interests',
      'what makes you happy',
      'tell me about your friends',
      'what was your childhood like',
      'tell me about growing up'
    ];
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private createEmptyStats(): CacheWarmingStats {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      totalTimeMs: 0,
      
      queriesWarmed: 0,
      queryWarmingTimeMs: 0,
      queryFailures: 0,
      
      embeddingsWarmed: 0,
      embeddingWarmingTimeMs: 0,
      embeddingFailures: 0,
      
      expansionsWarmed: 0,
      expansionWarmingTimeMs: 0,
      expansionFailures: 0,
      
      averageOperationTimeMs: 0,
      operationsPerSecond: 0,
      cacheHitRateImprovement: 0,
      
      lastWarmingTime: 0
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create cache warming service
 */
export function createCacheWarmingService(
  cacheManager: CacheManager,
  factbookService?: FactbookService
): CacheWarmingService {
  const config: Partial<CacheWarmingConfig> = {
    queryWarmingEnabled: process.env.CACHE_WARM_QUERIES?.toLowerCase() !== 'false',
    embeddingWarmingEnabled: process.env.CACHE_WARM_EMBEDDINGS?.toLowerCase() !== 'false',
    expansionWarmingEnabled: process.env.CACHE_WARM_EXPANSIONS?.toLowerCase() !== 'false',
    
    maxConcurrentOperations: parseInt(process.env.CACHE_WARM_MAX_CONCURRENT || '5'),
    warmingTimeoutMs: parseInt(process.env.CACHE_WARM_TIMEOUT_MS || '30000'),
    
    enableScheduledWarming: process.env.CACHE_WARM_SCHEDULED?.toLowerCase() !== 'false',
    warmingIntervalHours: parseInt(process.env.CACHE_WARM_INTERVAL_HOURS || '6'),
    
    warmOnFactbookUpdate: process.env.CACHE_WARM_ON_FACTBOOK_UPDATE?.toLowerCase() !== 'false',
    warmOnModelUpdate: process.env.CACHE_WARM_ON_MODEL_UPDATE?.toLowerCase() !== 'false'
  };

  return new CacheWarmingService(config, cacheManager, factbookService);
}