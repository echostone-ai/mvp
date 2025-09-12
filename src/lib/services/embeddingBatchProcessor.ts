// src/lib/services/embeddingBatchProcessor.ts
// Batch processing utility for generating embeddings for all factbook snippets

import { FactbookService, FactbookSnippet } from './factbookService';
import { EmbeddingService, EmbeddingConfig } from './embeddingService';
import { EmbeddingStore } from './embeddingStore';
import { EmbeddingCache } from './embeddingCache';

/**
 * Configuration for batch processing
 */
export interface BatchProcessingConfig {
  batchSize: number; // Number of snippets to process at once
  maxConcurrency: number; // Maximum concurrent batches
  progressInterval: number; // Progress logging interval (in processed items)
  retryAttempts: number; // Retry attempts for failed batches
  skipExisting: boolean; // Skip snippets that already have embeddings
}

/**
 * Progress information for batch processing
 */
export interface BatchProgress {
  totalSnippets: number;
  processedSnippets: number;
  successfulEmbeddings: number;
  failedEmbeddings: number;
  skippedEmbeddings: number;
  currentBatch: number;
  totalBatches: number;
  elapsedTimeMs: number;
  estimatedRemainingMs: number;
  tokensUsed: number;
  errorsEncountered: string[];
}

/**
 * Result of batch processing operation
 */
export interface BatchProcessingResult {
  success: boolean;
  progress: BatchProgress;
  embeddings: Map<string, number[]>;
  errors: string[];
  warnings: string[];
}

/**
 * Batch processor for generating embeddings for all factbook snippets
 */
export class EmbeddingBatchProcessor {
  private factbookService: FactbookService;
  private embeddingService: EmbeddingService;
  private embeddingStore: EmbeddingStore;
  private embeddingCache?: EmbeddingCache;
  private config: BatchProcessingConfig;

  constructor(
    factbookService: FactbookService,
    embeddingService: EmbeddingService,
    embeddingStore: EmbeddingStore,
    config: BatchProcessingConfig,
    embeddingCache?: EmbeddingCache
  ) {
    this.factbookService = factbookService;
    this.embeddingService = embeddingService;
    this.embeddingStore = embeddingStore;
    this.embeddingCache = embeddingCache;
    this.config = config;

    console.log('embedding_batch_processor_initialized', {
      batch_size: this.config.batchSize,
      max_concurrency: this.config.maxConcurrency,
      skip_existing: this.config.skipExisting
    });
  }

  /**
   * Process all factbook snippets to generate embeddings
   */
  async processAllSnippets(
    progressCallback?: (progress: BatchProgress) => void
  ): Promise<BatchProcessingResult> {
    const startTime = Date.now();

    if (!this.factbookService.isLoaded()) {
      throw new Error('FactbookService not loaded - cannot process snippets');
    }

    const allSnippets = this.factbookService.getAllSnippets();
    if (allSnippets.length === 0) {
      throw new Error('No snippets available for embedding generation');
    }

    console.log('embedding_batch_processing_start', {
      total_snippets: allSnippets.length,
      batch_size: this.config.batchSize,
      skip_existing: this.config.skipExisting
    });

    // Initialize progress tracking
    const progress: BatchProgress = {
      totalSnippets: allSnippets.length,
      processedSnippets: 0,
      successfulEmbeddings: 0,
      failedEmbeddings: 0,
      skippedEmbeddings: 0,
      currentBatch: 0,
      totalBatches: Math.ceil(allSnippets.length / this.config.batchSize),
      elapsedTimeMs: 0,
      estimatedRemainingMs: 0,
      tokensUsed: 0,
      errorsEncountered: []
    };

    const result: BatchProcessingResult = {
      success: false,
      progress,
      embeddings: new Map(),
      errors: [],
      warnings: []
    };

    try {
      // Filter snippets based on skipExisting setting
      const snippetsToProcess = this.config.skipExisting
        ? allSnippets.filter(snippet => !this.embeddingStore.hasEmbedding(snippet.id))
        : allSnippets;

      if (snippetsToProcess.length === 0) {
        console.log('embedding_batch_processing_no_work', {
          total_snippets: allSnippets.length,
          skip_existing: this.config.skipExisting
        });

        result.success = true;
        result.progress.skippedEmbeddings = allSnippets.length;
        result.progress.processedSnippets = allSnippets.length;
        return result;
      }

      console.log('embedding_batch_processing_filtered', {
        total_snippets: allSnippets.length,
        snippets_to_process: snippetsToProcess.length,
        skipped_existing: allSnippets.length - snippetsToProcess.length
      });

      // Update progress with skipped count
      progress.skippedEmbeddings = allSnippets.length - snippetsToProcess.length;
      progress.totalBatches = Math.ceil(snippetsToProcess.length / this.config.batchSize);

      // Process snippets in batches
      const batches = this.createBatches(snippetsToProcess);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        progress.currentBatch = i + 1;

        try {
          const batchResult = await this.processBatch(batch, i + 1);
          
          // Update progress
          progress.processedSnippets += batch.length;
          progress.successfulEmbeddings += batchResult.successCount;
          progress.failedEmbeddings += batchResult.failureCount;
          progress.tokensUsed += batchResult.tokensUsed;
          progress.elapsedTimeMs = Date.now() - startTime;

          // Calculate estimated remaining time
          if (progress.processedSnippets > 0) {
            const avgTimePerSnippet = progress.elapsedTimeMs / progress.processedSnippets;
            const remainingSnippets = snippetsToProcess.length - progress.processedSnippets;
            progress.estimatedRemainingMs = Math.round(avgTimePerSnippet * remainingSnippets);
          }

          // Store successful embeddings
          for (const [snippetId, embedding] of batchResult.embeddings.entries()) {
            result.embeddings.set(snippetId, embedding);
            this.embeddingStore.setEmbedding(snippetId, embedding);
          }

          // Add batch errors to result
          result.errors.push(...batchResult.errors);
          progress.errorsEncountered.push(...batchResult.errors);

          // Call progress callback
          if (progressCallback) {
            progressCallback({ ...progress });
          }

          // Log progress at intervals
          if (progress.processedSnippets % this.config.progressInterval === 0 || i === batches.length - 1) {
            console.log('embedding_batch_processing_progress', {
              batch: i + 1,
              total_batches: batches.length,
              processed: progress.processedSnippets,
              total: snippetsToProcess.length,
              successful: progress.successfulEmbeddings,
              failed: progress.failedEmbeddings,
              tokens_used: progress.tokensUsed,
              elapsed_ms: progress.elapsedTimeMs,
              estimated_remaining_ms: progress.estimatedRemainingMs
            });
          }

        } catch (error) {
          const errorMsg = `Batch ${i + 1} failed: ${error instanceof Error ? error.message : error}`;
          result.errors.push(errorMsg);
          progress.errorsEncountered.push(errorMsg);
          progress.failedEmbeddings += batch.length;
          progress.processedSnippets += batch.length;

          console.error('embedding_batch_processing_batch_error', {
            batch: i + 1,
            batch_size: batch.length,
            error: errorMsg
          });
        }
      }

      // Save embeddings to store
      if (result.embeddings.size > 0) {
        console.log('embedding_batch_processing_saving', {
          embeddings_count: result.embeddings.size
        });

        await this.embeddingStore.saveEmbeddings(this.embeddingStore.getAllEmbeddings());
      }

      // Update cache if available
      if (this.embeddingCache && result.embeddings.size > 0) {
        try {
          const cacheEntries = new Map<string, number[]>();
          for (const [snippetId, embedding] of result.embeddings.entries()) {
            const snippet = allSnippets.find(s => s.id === snippetId);
            if (snippet) {
              cacheEntries.set(snippet.text, embedding);
            }
          }
          await this.embeddingCache.setBatch(cacheEntries);
        } catch (error) {
          result.warnings.push(`Cache update failed: ${error instanceof Error ? error.message : error}`);
        }
      }

      // Determine overall success
      result.success = progress.failedEmbeddings === 0 || 
                      (progress.successfulEmbeddings > 0 && progress.failedEmbeddings < progress.successfulEmbeddings);

      const elapsedMs = Date.now() - startTime;
      console.log('embedding_batch_processing_complete', {
        success: result.success,
        total_snippets: allSnippets.length,
        processed: progress.processedSnippets,
        successful: progress.successfulEmbeddings,
        failed: progress.failedEmbeddings,
        skipped: progress.skippedEmbeddings,
        tokens_used: progress.tokensUsed,
        total_time_ms: elapsedMs,
        errors_count: result.errors.length,
        warnings_count: result.warnings.length
      });

      return result;

    } catch (error) {
      const elapsedMs = Date.now() - startTime;
      const errorMsg = `Batch processing failed: ${error instanceof Error ? error.message : error}`;
      
      result.errors.push(errorMsg);
      result.success = false;
      progress.elapsedTimeMs = elapsedMs;

      console.error('embedding_batch_processing_error', {
        error: errorMsg,
        processed: progress.processedSnippets,
        total: progress.totalSnippets,
        time_ms: elapsedMs
      });

      return result;
    }
  }

  /**
   * Process a single batch of snippets
   */
  private async processBatch(
    snippets: FactbookSnippet[],
    batchNumber: number
  ): Promise<{
    embeddings: Map<string, number[]>;
    successCount: number;
    failureCount: number;
    tokensUsed: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    const embeddings = new Map<string, number[]>();
    const errors: string[] = [];
    let tokensUsed = 0;

    console.log('embedding_batch_start', {
      batch_number: batchNumber,
      snippet_count: snippets.length
    });

    try {
      // Extract texts for embedding generation
      const texts = snippets.map(snippet => this.prepareTextForEmbedding(snippet));

      // Generate embeddings for the batch
      const batchResult = await this.embeddingService.generateBatchEmbeddings(texts);
      tokensUsed = batchResult.totalTokens;

      // Map results back to snippet IDs
      for (let i = 0; i < batchResult.results.length; i++) {
        const embeddingResult = batchResult.results[i];
        const snippet = snippets[i];
        
        if (embeddingResult && snippet) {
          embeddings.set(snippet.id, embeddingResult.embedding);
        }
      }

      // Add any batch-level errors
      errors.push(...batchResult.errors);

      const elapsedMs = Date.now() - startTime;
      console.log('embedding_batch_complete', {
        batch_number: batchNumber,
        successful_embeddings: embeddings.size,
        failed_embeddings: snippets.length - embeddings.size,
        tokens_used: tokensUsed,
        time_ms: elapsedMs,
        errors_count: errors.length
      });

      return {
        embeddings,
        successCount: embeddings.size,
        failureCount: snippets.length - embeddings.size,
        tokensUsed,
        errors
      };

    } catch (error) {
      const elapsedMs = Date.now() - startTime;
      const errorMsg = `Batch processing error: ${error instanceof Error ? error.message : error}`;
      errors.push(errorMsg);

      console.error('embedding_batch_error', {
        batch_number: batchNumber,
        snippet_count: snippets.length,
        error: errorMsg,
        time_ms: elapsedMs
      });

      return {
        embeddings,
        successCount: 0,
        failureCount: snippets.length,
        tokensUsed: 0,
        errors
      };
    }
  }

  /**
   * Prepare snippet text for embedding generation
   * Combines text, topics, and keywords with appropriate weighting
   */
  private prepareTextForEmbedding(snippet: FactbookSnippet): string {
    const parts: string[] = [];

    // Add main text
    parts.push(snippet.text);

    // Add topics (for context)
    if (snippet.topics.length > 0) {
      parts.push(`Topics: ${snippet.topics.join(', ')}`);
    }

    // Add keywords (for enhanced matching)
    if (snippet.keywords.length > 0) {
      parts.push(`Keywords: ${snippet.keywords.join(', ')}`);
    }

    return parts.join('\n');
  }

  /**
   * Create batches from snippets array
   */
  private createBatches(snippets: FactbookSnippet[]): FactbookSnippet[][] {
    const batches: FactbookSnippet[][] = [];
    
    for (let i = 0; i < snippets.length; i += this.config.batchSize) {
      const batch = snippets.slice(i, i + this.config.batchSize);
      batches.push(batch);
    }

    return batches;
  }

  /**
   * Get default batch processing configuration
   */
  static getDefaultConfig(): BatchProcessingConfig {
    return {
      batchSize: 50, // Smaller batches for better error handling
      maxConcurrency: 1, // Sequential processing to respect rate limits
      progressInterval: 10, // Log progress every 10 processed items
      retryAttempts: 2, // Retry failed batches twice
      skipExisting: true // Skip snippets that already have embeddings
    };
  }

  /**
   * Estimate processing time and cost
   */
  async estimateProcessing(): Promise<{
    totalSnippets: number;
    snippetsToProcess: number;
    estimatedTokens: number;
    estimatedTimeMinutes: number;
    estimatedCostUSD: number;
  }> {
    if (!this.factbookService.isLoaded()) {
      throw new Error('FactbookService not loaded');
    }

    const allSnippets = this.factbookService.getAllSnippets();
    const snippetsToProcess = this.config.skipExisting
      ? allSnippets.filter(snippet => !this.embeddingStore.hasEmbedding(snippet.id))
      : allSnippets;

    // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
    const totalChars = snippetsToProcess.reduce((sum, snippet) => {
      return sum + this.prepareTextForEmbedding(snippet).length;
    }, 0);
    const estimatedTokens = Math.ceil(totalChars / 4);

    // Estimate time (based on typical API response times)
    const batchCount = Math.ceil(snippetsToProcess.length / this.config.batchSize);
    const estimatedTimeMinutes = Math.ceil((batchCount * 2) / 60); // ~2 seconds per batch

    // Estimate cost (text-embedding-3-small: $0.00002 per 1K tokens)
    const estimatedCostUSD = (estimatedTokens / 1000) * 0.00002;

    return {
      totalSnippets: allSnippets.length,
      snippetsToProcess: snippetsToProcess.length,
      estimatedTokens,
      estimatedTimeMinutes,
      estimatedCostUSD
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): BatchProcessingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<BatchProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('embedding_batch_processor_config_updated', {
      new_config: newConfig,
      full_config: this.config
    });
  }
}