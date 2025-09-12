// src/lib/services/embeddingService.ts
// Embedding service with pluggable model support and caching

import OpenAI from 'openai';

/**
 * Configuration for embedding service
 */
export interface EmbeddingConfig {
  model: 'text-embedding-3-small' | 'text-embedding-3-large';
  dimensions: number; // 1536 for small, 3072 for large
  batchSize: number; // Default: 100 - batch size for processing
  maxRetries: number; // Default: 3 - retry attempts for failed requests
  timeoutMs: number; // Default: 30000 - timeout for API calls
}

/**
 * Embedding result with metadata
 */
export interface EmbeddingResult {
  text: string;
  embedding: number[];
  model: string;
  dimensions: number;
  tokenCount?: number;
}

/**
 * Batch embedding result
 */
export interface BatchEmbeddingResult {
  results: EmbeddingResult[];
  totalTokens: number;
  processingTimeMs: number;
  errors: string[];
}

/**
 * Embedding service with pluggable model support
 * Handles OpenAI embedding generation with batching and error handling
 */
export class EmbeddingService {
  private openai: OpenAI;
  private config: EmbeddingConfig;

  constructor(config: EmbeddingConfig, apiKey?: string) {
    this.config = config;
    
    if (!apiKey && !process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key required for embedding service');
    }

    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
      timeout: this.config.timeoutMs
    });

    console.log('embedding_service_initialized', {
      model: this.config.model,
      dimensions: this.config.dimensions,
      batch_size: this.config.batchSize,
      timeout_ms: this.config.timeoutMs
    });
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    if (!text.trim()) {
      throw new Error('Cannot generate embedding for empty text');
    }

    const startTime = Date.now();

    try {
      console.log('embedding_generation_start', {
        text_length: text.length,
        model: this.config.model
      });

      const response = await this.openai.embeddings.create({
        model: this.config.model,
        input: text,
        dimensions: this.config.dimensions
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding data returned from OpenAI');
      }

      const embedding = response.data[0].embedding;
      if (embedding.length !== this.config.dimensions) {
        throw new Error(`Expected ${this.config.dimensions} dimensions, got ${embedding.length}`);
      }

      const result: EmbeddingResult = {
        text,
        embedding,
        model: this.config.model,
        dimensions: this.config.dimensions,
        tokenCount: response.usage?.total_tokens
      };

      const elapsedMs = Date.now() - startTime;
      console.log('embedding_generation_complete', {
        text_length: text.length,
        dimensions: embedding.length,
        tokens_used: result.tokenCount,
        time_ms: elapsedMs
      });

      return result;

    } catch (error) {
      const elapsedMs = Date.now() - startTime;
      console.error('embedding_generation_error', {
        text_length: text.length,
        error: error instanceof Error ? error.message : error,
        time_ms: elapsedMs
      });

      throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batches
   */
  async generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
    if (texts.length === 0) {
      return {
        results: [],
        totalTokens: 0,
        processingTimeMs: 0,
        errors: []
      };
    }

    const startTime = Date.now();
    const results: EmbeddingResult[] = [];
    const errors: string[] = [];
    let totalTokens = 0;

    console.log('batch_embedding_start', {
      text_count: texts.length,
      batch_size: this.config.batchSize,
      model: this.config.model
    });

    // Process in batches
    for (let i = 0; i < texts.length; i += this.config.batchSize) {
      const batch = texts.slice(i, i + this.config.batchSize);
      const batchIndex = Math.floor(i / this.config.batchSize) + 1;
      const totalBatches = Math.ceil(texts.length / this.config.batchSize);

      try {
        console.log('batch_processing', {
          batch_index: batchIndex,
          total_batches: totalBatches,
          batch_size: batch.length
        });

        const batchResult = await this.processBatch(batch);
        results.push(...batchResult.results);
        totalTokens += batchResult.totalTokens;

        // Add small delay between batches to respect rate limits
        if (i + this.config.batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        const errorMsg = `Batch ${batchIndex} failed: ${error instanceof Error ? error.message : error}`;
        errors.push(errorMsg);
        console.error('batch_processing_error', {
          batch_index: batchIndex,
          error: errorMsg
        });

        // Continue with next batch on error
        continue;
      }
    }

    const elapsedMs = Date.now() - startTime;
    console.log('batch_embedding_complete', {
      text_count: texts.length,
      results_count: results.length,
      total_tokens: totalTokens,
      errors_count: errors.length,
      time_ms: elapsedMs
    });

    return {
      results,
      totalTokens,
      processingTimeMs: elapsedMs,
      errors
    };
  }

  /**
   * Process a single batch of texts
   */
  private async processBatch(texts: string[]): Promise<{
    results: EmbeddingResult[];
    totalTokens: number;
  }> {
    // Filter out empty texts
    const validTexts = texts.filter(text => text.trim().length > 0);
    if (validTexts.length === 0) {
      return { results: [], totalTokens: 0 };
    }

    let retries = 0;
    while (retries <= this.config.maxRetries) {
      try {
        const response = await this.openai.embeddings.create({
          model: this.config.model,
          input: validTexts,
          dimensions: this.config.dimensions
        });

        if (!response.data || response.data.length !== validTexts.length) {
          throw new Error(`Expected ${validTexts.length} embeddings, got ${response.data?.length || 0}`);
        }

        const results: EmbeddingResult[] = response.data.map((item, index) => ({
          text: validTexts[index],
          embedding: item.embedding,
          model: this.config.model,
          dimensions: this.config.dimensions,
          tokenCount: undefined // Individual token counts not available in batch
        }));

        // Validate embedding dimensions
        for (const result of results) {
          if (result.embedding.length !== this.config.dimensions) {
            throw new Error(`Invalid embedding dimensions: expected ${this.config.dimensions}, got ${result.embedding.length}`);
          }
        }

        return {
          results,
          totalTokens: response.usage?.total_tokens || 0
        };

      } catch (error) {
        retries++;
        if (retries > this.config.maxRetries) {
          throw error;
        }

        console.warn('batch_retry', {
          retry_attempt: retries,
          max_retries: this.config.maxRetries,
          error: error instanceof Error ? error.message : error
        });

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
      }
    }

    throw new Error('Max retries exceeded');
  }

  /**
   * Get default configuration for text-embedding-3-small
   */
  static getDefaultConfig(): EmbeddingConfig {
    return {
      model: 'text-embedding-3-small',
      dimensions: 1536,
      batchSize: 100,
      maxRetries: 3,
      timeoutMs: 30000
    };
  }

  /**
   * Get configuration for text-embedding-3-large
   */
  static getLargeModelConfig(): EmbeddingConfig {
    return {
      model: 'text-embedding-3-large',
      dimensions: 3072,
      batchSize: 50, // Smaller batch size for larger model
      maxRetries: 3,
      timeoutMs: 45000 // Longer timeout for larger model
    };
  }

  /**
   * Validate embedding dimensions
   */
  validateEmbedding(embedding: number[]): boolean {
    if (!Array.isArray(embedding)) {
      return false;
    }

    if (embedding.length !== this.config.dimensions) {
      return false;
    }

    // Check for valid numbers
    return embedding.every(value => typeof value === 'number' && !isNaN(value) && isFinite(value));
  }

  /**
   * Get service configuration
   */
  getConfig(): EmbeddingConfig {
    return { ...this.config };
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<EmbeddingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('embedding_service_config_updated', {
      new_config: newConfig,
      full_config: this.config
    });
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: string[];
  }> {
    try {
      // Test with a simple embedding
      const testResult = await this.generateEmbedding('test');
      
      if (this.validateEmbedding(testResult.embedding)) {
        return {
          status: 'healthy',
          details: ['Service operational', `Model: ${this.config.model}`, `Dimensions: ${this.config.dimensions}`]
        };
      } else {
        return {
          status: 'degraded',
          details: ['Service responding but embeddings invalid']
        };
      }

    } catch (error) {
      return {
        status: 'unhealthy',
        details: [`Service error: ${error instanceof Error ? error.message : error}`]
      };
    }
  }
}