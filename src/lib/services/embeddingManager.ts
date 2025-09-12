// src/lib/services/embeddingManager.ts
// Main embedding manager that orchestrates all embedding components

import path from 'path';
import { FactbookService } from './factbookService';
import { EmbeddingService, EmbeddingConfig } from './embeddingService';
import { EmbeddingStore, createEmbeddingStore } from './embeddingStore';
import { EmbeddingCache, createEmbeddingCache } from './embeddingCache';
import { EmbeddingBatchProcessor, BatchProcessingConfig, BatchProgress } from './embeddingBatchProcessor';

/**
 * Configuration for embedding manager
 */
export interface EmbeddingManagerConfig {
  // Embedding service configuration
  embeddingModel: 'text-embedding-3-small' | 'text-embedding-3-large';
  embeddingDimensions: number;
  
  // Storage configuration
  storePath: string;
  cacheType: 'memory' | 'file';
  cacheDir?: string;
  memoryCacheSize?: number;
  
  // Batch processing configuration
  batchProcessing: BatchProcessingConfig;
  
  // Cache warming configuration
  warmupOnBoot: boolean;
  warmupTimeout: number; // milliseconds
  
  // OpenAI API configuration
  openaiApiKey?: string;
}

/**
 * Health status for embedding manager
 */
export interface EmbeddingManagerHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    embeddingService: 'healthy' | 'degraded' | 'unhealthy';
    embeddingStore: 'healthy' | 'degraded' | 'unhealthy';
    embeddingCache: 'healthy' | 'degraded' | 'unhealthy';
    factbookService: 'healthy' | 'degraded' | 'unhealthy';
  };
  details: string[];
  lastCheck: number;
  statistics: {
    totalEmbeddings: number;
    cacheHitRate: number;
    storeSizeBytes: number;
    lastWarmup: number;
  };
}

/**
 * Main embedding manager class
 */
export class EmbeddingManager {
  private factbookService: FactbookService;
  private embeddingService: EmbeddingService;
  private embeddingStore: EmbeddingStore;
  private embeddingCache: EmbeddingCache;
  private batchProcessor: EmbeddingBatchProcessor;
  private config: EmbeddingManagerConfig;
  private isWarmedUp = false;
  private lastWarmupTime = 0;

  constructor(config: EmbeddingManagerConfig, factbookService?: FactbookService) {
    this.config = config;
    this.factbookService = factbookService || FactbookService.getInstance();

    // Initialize embedding service
    const embeddingConfig: EmbeddingConfig = {
      model: this.config.embeddingModel,
      dimensions: this.config.embeddingDimensions,
      batchSize: this.config.batchProcessing.batchSize,
      maxRetries: this.config.batchProcessing.retryAttempts,
      timeoutMs: 30000
    };

    this.embeddingService = new EmbeddingService(embeddingConfig, this.config.openaiApiKey);

    // Initialize embedding store
    this.embeddingStore = createEmbeddingStore(
      this.config.storePath,
      this.config.embeddingModel,
      this.config.embeddingDimensions
    );

    // Initialize embedding cache
    this.embeddingCache = createEmbeddingCache(this.config.cacheType, {
      maxSize: this.config.memoryCacheSize || 1000,
      cacheDir: this.config.cacheDir,
      memoryCacheSize: this.config.memoryCacheSize || 500
    });

    // Initialize batch processor
    this.batchProcessor = new EmbeddingBatchProcessor(
      this.factbookService,
      this.embeddingService,
      this.embeddingStore,
      this.config.batchProcessing,
      this.embeddingCache
    );

    console.log('embedding_manager_initialized', {
      model: this.config.embeddingModel,
      dimensions: this.config.embeddingDimensions,
      store_path: this.config.storePath,
      cache_type: this.config.cacheType,
      warmup_on_boot: this.config.warmupOnBoot
    });
  }

  /**
   * Initialize and warm up the embedding manager
   */
  async warmup(): Promise<void> {
    const startTime = Date.now();

    try {
      console.log('embedding_manager_warmup_start', {
        warmup_on_boot: this.config.warmupOnBoot,
        timeout_ms: this.config.warmupTimeout
      });

      // Ensure factbook service is loaded
      if (!this.factbookService.isLoaded()) {
        throw new Error('FactbookService not loaded - cannot warmup embedding manager');
      }

      // Load existing embeddings from store
      console.log('embedding_manager_loading_store');
      await this.embeddingStore.loadEmbeddings();

      // Validate store integrity
      const isStoreValid = await this.embeddingStore.validateStore();
      if (!isStoreValid) {
        console.warn('embedding_manager_store_validation_failed');
      }

      // Warm up cache if configured
      if (this.config.warmupOnBoot) {
        await this.warmupCache();
      }

      this.isWarmedUp = true;
      this.lastWarmupTime = Date.now();

      const elapsedMs = Date.now() - startTime;
      const stats = await this.embeddingStore.getStats();

      console.log('embedding_manager_warmup_complete', {
        warmup_time_ms: elapsedMs,
        embeddings_loaded: stats.totalEmbeddings,
        store_size_bytes: stats.fileSizeBytes,
        cache_warmed: this.config.warmupOnBoot
      });

    } catch (error) {
      const elapsedMs = Date.now() - startTime;
      console.error('embedding_manager_warmup_error', {
        error: error instanceof Error ? error.message : error,
        time_ms: elapsedMs
      });

      throw new Error(`Embedding manager warmup failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Warm up the embedding cache with existing embeddings
   */
  private async warmupCache(): Promise<void> {
    const startTime = Date.now();

    try {
      console.log('embedding_cache_warmup_start');

      const allSnippets = this.factbookService.getAllSnippets();
      const allEmbeddings = this.embeddingStore.getAllEmbeddings();

      // Prepare cache entries
      const cacheEntries = new Map<string, number[]>();
      for (const snippet of allSnippets) {
        const embedding = allEmbeddings.get(snippet.id);
        if (embedding) {
          // Use the same text preparation as batch processor
          const text = this.prepareTextForEmbedding(snippet);
          cacheEntries.set(text, embedding);
        }
      }

      // Warm up cache in batches
      if (cacheEntries.size > 0) {
        await this.embeddingCache.setBatch(cacheEntries);
      }

      const elapsedMs = Date.now() - startTime;
      console.log('embedding_cache_warmup_complete', {
        cache_entries: cacheEntries.size,
        warmup_time_ms: elapsedMs
      });

    } catch (error) {
      const elapsedMs = Date.now() - startTime;
      console.warn('embedding_cache_warmup_error', {
        error: error instanceof Error ? error.message : error,
        time_ms: elapsedMs
      });
      // Don't fail warmup if cache warming fails
    }
  }

  /**
   * Generate embeddings for all factbook snippets
   */
  async generateAllEmbeddings(
    progressCallback?: (progress: BatchProgress) => void
  ): Promise<{
    success: boolean;
    totalEmbeddings: number;
    errors: string[];
    processingTimeMs: number;
  }> {
    const startTime = Date.now();

    if (!this.isWarmedUp) {
      throw new Error('Embedding manager not warmed up - call warmup() first');
    }

    try {
      console.log('embedding_generation_all_start');

      const result = await this.batchProcessor.processAllSnippets(progressCallback);

      const elapsedMs = Date.now() - startTime;
      console.log('embedding_generation_all_complete', {
        success: result.success,
        total_embeddings: result.embeddings.size,
        errors_count: result.errors.length,
        processing_time_ms: elapsedMs
      });

      return {
        success: result.success,
        totalEmbeddings: result.embeddings.size,
        errors: result.errors,
        processingTimeMs: elapsedMs
      };

    } catch (error) {
      const elapsedMs = Date.now() - startTime;
      const errorMsg = `Embedding generation failed: ${error instanceof Error ? error.message : error}`;

      console.error('embedding_generation_all_error', {
        error: errorMsg,
        time_ms: elapsedMs
      });

      return {
        success: false,
        totalEmbeddings: 0,
        errors: [errorMsg],
        processingTimeMs: elapsedMs
      };
    }
  }

  /**
   * Get embedding for a specific text with cache fallback
   */
  async getEmbedding(text: string): Promise<number[] | null> {
    if (!this.isWarmedUp) {
      throw new Error('Embedding manager not warmed up');
    }

    try {
      // Check cache first
      const cachedEmbedding = await this.embeddingCache.get(text);
      if (cachedEmbedding) {
        return cachedEmbedding;
      }

      // Generate new embedding
      const result = await this.embeddingService.generateEmbedding(text);
      
      // Store in cache
      await this.embeddingCache.set(text, result.embedding);

      return result.embedding;

    } catch (error) {
      console.error('embedding_get_error', {
        text_length: text.length,
        error: error instanceof Error ? error.message : error
      });

      return null;
    }
  }

  /**
   * Get embeddings for multiple texts with batch processing
   */
  async getBatchEmbeddings(texts: string[]): Promise<Map<string, number[]>> {
    if (!this.isWarmedUp) {
      throw new Error('Embedding manager not warmed up');
    }

    try {
      // Check cache for all texts
      const cachedResults = await this.embeddingCache.getBatch(texts);
      const uncachedTexts = texts.filter(text => !cachedResults.has(text));

      // Generate embeddings for uncached texts
      if (uncachedTexts.length > 0) {
        const batchResult = await this.embeddingService.generateBatchEmbeddings(uncachedTexts);
        
        // Store new embeddings in cache
        const newEmbeddings = new Map<string, number[]>();
        for (const result of batchResult.results) {
          newEmbeddings.set(result.text, result.embedding);
          cachedResults.set(result.text, result.embedding);
        }

        if (newEmbeddings.size > 0) {
          await this.embeddingCache.setBatch(newEmbeddings);
        }
      }

      return cachedResults;

    } catch (error) {
      console.error('embedding_get_batch_error', {
        text_count: texts.length,
        error: error instanceof Error ? error.message : error
      });

      return new Map();
    }
  }

  /**
   * Get embedding for a factbook snippet by ID
   */
  getSnippetEmbedding(snippetId: string): number[] | null {
    return this.embeddingStore.getEmbedding(snippetId);
  }

  /**
   * Get embeddings for multiple snippets by ID
   */
  getBatchSnippetEmbeddings(snippetIds: string[]): Map<string, number[]> {
    return this.embeddingStore.getBatchEmbeddings(snippetIds);
  }

  /**
   * Get all stored embeddings
   */
  getAllStoredEmbeddings(): Map<string, number[]> {
    return this.embeddingStore.getAllEmbeddings();
  }

  /**
   * Get health status of all components
   */
  async getHealthStatus(): Promise<EmbeddingManagerHealth> {
    const startTime = Date.now();

    // Check embedding service health
    const embeddingServiceHealth = await this.embeddingService.getHealthStatus();
    
    // Check embedding store health
    const storeStats = await this.embeddingStore.getStats();
    const storeValid = await this.embeddingStore.validateStore();
    
    // Check cache health
    const cacheStats = await this.embeddingCache.getStats();
    
    // Check factbook service health
    const factbookHealthy = this.factbookService.isLoaded() && this.factbookService.validateIndex();

    const health: EmbeddingManagerHealth = {
      status: 'healthy',
      components: {
        embeddingService: embeddingServiceHealth.status,
        embeddingStore: storeValid ? 'healthy' : 'degraded',
        embeddingCache: cacheStats.totalEntries >= 0 ? 'healthy' : 'degraded',
        factbookService: factbookHealthy ? 'healthy' : 'unhealthy'
      },
      details: [],
      lastCheck: Date.now(),
      statistics: {
        totalEmbeddings: storeStats.totalEmbeddings,
        cacheHitRate: cacheStats.hitRate,
        storeSizeBytes: storeStats.fileSizeBytes,
        lastWarmup: this.lastWarmupTime
      }
    };

    // Collect component details
    health.details.push(...embeddingServiceHealth.details);
    
    if (!storeValid) {
      health.details.push('Embedding store validation failed');
    }
    
    if (!factbookHealthy) {
      health.details.push('FactbookService not loaded or invalid');
    }

    if (!this.isWarmedUp) {
      health.details.push('Embedding manager not warmed up');
    }

    // Determine overall status
    const componentStatuses = Object.values(health.components);
    if (componentStatuses.includes('unhealthy')) {
      health.status = 'unhealthy';
    } else if (componentStatuses.includes('degraded') || !this.isWarmedUp) {
      health.status = 'degraded';
    }

    const elapsedMs = Date.now() - startTime;
    console.log('embedding_manager_health_check', {
      status: health.status,
      check_time_ms: elapsedMs,
      total_embeddings: health.statistics.totalEmbeddings,
      cache_hit_rate: health.statistics.cacheHitRate.toFixed(3)
    });

    return health;
  }

  /**
   * Estimate processing requirements
   */
  async estimateProcessing(): Promise<{
    totalSnippets: number;
    snippetsToProcess: number;
    estimatedTokens: number;
    estimatedTimeMinutes: number;
    estimatedCostUSD: number;
  }> {
    return await this.batchProcessor.estimateProcessing();
  }

  /**
   * Get current configuration
   */
  getConfig(): EmbeddingManagerConfig {
    return { ...this.config };
  }

  /**
   * Check if manager is warmed up
   */
  isReady(): boolean {
    return this.isWarmedUp;
  }

  /**
   * Prepare text for embedding (same as batch processor)
   */
  private prepareTextForEmbedding(snippet: any): string {
    const parts: string[] = [];

    parts.push(snippet.text);

    if (snippet.topics && snippet.topics.length > 0) {
      parts.push(`Topics: ${snippet.topics.join(', ')}`);
    }

    if (snippet.keywords && snippet.keywords.length > 0) {
      parts.push(`Keywords: ${snippet.keywords.join(', ')}`);
    }

    return parts.join('\n');
  }

  /**
   * Create default configuration
   */
  static getDefaultConfig(storePath: string): EmbeddingManagerConfig {
    return {
      embeddingModel: 'text-embedding-3-small',
      embeddingDimensions: 1536,
      storePath,
      cacheType: 'file',
      cacheDir: path.join(path.dirname(storePath), 'embedding-cache'),
      memoryCacheSize: 500,
      batchProcessing: EmbeddingBatchProcessor.getDefaultConfig(),
      warmupOnBoot: true,
      warmupTimeout: 30000
    };
  }
}

/**
 * Create embedding manager with default configuration
 */
export function createEmbeddingManager(
  storePath: string,
  options: Partial<EmbeddingManagerConfig> = {}
): EmbeddingManager {
  const config = {
    ...EmbeddingManager.getDefaultConfig(storePath),
    ...options
  };

  return new EmbeddingManager(config);
}