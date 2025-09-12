// src/lib/services/vectorRetriever.ts
// Vector search and similarity matching for semantic retrieval

import { EmbeddingService, EmbeddingConfig } from './embeddingService';
import { EmbeddingCache } from './embeddingCache';
import { FactbookSnippet } from './factbookService';
import { HNSWIndex, HNSWConfig } from './hnswIndex';

/**
 * Configuration for vector retrieval
 */
export interface VectorConfig {
  model: 'text-embedding-3-small' | 'text-embedding-3-large';
  dimensions: number; // 1536 for small, 3072 for large
  maxResults: number; // Default: 20
  similarityThreshold: number; // Default: 0.3
  cacheEnabled: boolean; // Default: true
  indexType: 'linear' | 'hnsw'; // Default: 'hnsw'
  hnswConfig?: Partial<HNSWConfig>; // HNSW-specific configuration
}

/**
 * Vector search result with similarity score
 */
export interface VectorResult {
  snippet: FactbookSnippet;
  similarity: number;
  embedding: number[];
}

/**
 * Vector index for fast similarity search
 */
export interface VectorIndex {
  add(id: string, vector: number[]): void;
  search(query: number[], k: number): { id: string; distance: number }[];
  size(): number;
  clear(): void;
}

/**
 * Simple linear search vector index implementation
 * Will be optimized to HNSW later if needed
 */
class LinearVectorIndex implements VectorIndex {
  private vectors: Map<string, number[]> = new Map();

  add(id: string, vector: number[]): void {
    this.vectors.set(id, vector);
  }

  search(query: number[], k: number): { id: string; distance: number }[] {
    const results: { id: string; distance: number }[] = [];

    for (const [id, vector] of this.vectors.entries()) {
      const similarity = this.cosineSimilarity(query, vector);
      // Convert similarity to distance (1 - similarity for sorting)
      const distance = 1 - similarity;
      results.push({ id, distance });
    }

    // Sort by distance (ascending - lower distance = higher similarity)
    results.sort((a, b) => a.distance - b.distance);

    // Return top k results
    return results.slice(0, k);
  }

  size(): number {
    return this.vectors.size;
  }

  clear(): void {
    this.vectors.clear();
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }
}

/**
 * Vector retriever for semantic search using embeddings
 */
export class VectorRetriever {
  private embeddingService: EmbeddingService;
  private vectorIndex: VectorIndex;
  private cache: EmbeddingCache;
  private config: VectorConfig;
  private snippetMap: Map<string, FactbookSnippet> = new Map();
  private queryEmbeddingCache: Map<string, number[]> = new Map();

  constructor(config: VectorConfig, cache: EmbeddingCache) {
    this.config = config;
    this.cache = cache;
    
    // Initialize vector index based on configuration
    if (config.indexType === 'hnsw') {
      this.vectorIndex = new HNSWIndex(config.hnswConfig);
    } else {
      this.vectorIndex = new LinearVectorIndex();
    }

    // Initialize embedding service
    const embeddingConfig: EmbeddingConfig = {
      model: config.model,
      dimensions: config.dimensions,
      batchSize: 100,
      maxRetries: 3,
      timeoutMs: 30000
    };

    this.embeddingService = new EmbeddingService(embeddingConfig);

    console.log('vector_retriever_initialized', {
      model: config.model,
      dimensions: config.dimensions,
      max_results: config.maxResults,
      similarity_threshold: config.similarityThreshold,
      cache_enabled: config.cacheEnabled,
      index_type: config.indexType
    });
  }

  /**
   * Build vector index from factbook snippets
   */
  async buildIndex(snippets: FactbookSnippet[]): Promise<void> {
    const startTime = Date.now();
    
    console.log('vector_index_build_start', {
      snippet_count: snippets.length,
      model: this.config.model
    });

    // Clear existing index
    this.vectorIndex.clear();
    this.snippetMap.clear();

    // Store snippets for lookup
    for (const snippet of snippets) {
      this.snippetMap.set(snippet.id, snippet);
    }

    // Generate embeddings for all snippets
    const texts = snippets.map(s => s.text);
    const embeddings: number[][] = [];

    // Check cache first if enabled
    if (this.config.cacheEnabled) {
      const cachedEmbeddings = await this.getCachedEmbeddings(texts);
      embeddings.push(...cachedEmbeddings.embeddings);
      
      // Generate missing embeddings
      if (cachedEmbeddings.missingTexts.length > 0) {
        console.log('vector_index_generating_missing_embeddings', {
          missing_count: cachedEmbeddings.missingTexts.length,
          total_count: texts.length
        });

        const batchResult = await this.embeddingService.generateBatchEmbeddings(
          cachedEmbeddings.missingTexts
        );

        // Cache new embeddings
        for (const result of batchResult.results) {
          await this.cache.set(result.text, result.embedding);
          embeddings[texts.indexOf(result.text)] = result.embedding;
        }
      }
    } else {
      // Generate all embeddings without caching
      const batchResult = await this.embeddingService.generateBatchEmbeddings(texts);
      embeddings.push(...batchResult.results.map(r => r.embedding));
    }

    // Add embeddings to vector index
    for (let i = 0; i < snippets.length; i++) {
      if (embeddings[i]) {
        this.vectorIndex.add(snippets[i].id, embeddings[i]);
      }
    }

    const elapsedMs = Date.now() - startTime;
    console.log('vector_index_build_complete', {
      snippet_count: snippets.length,
      index_size: this.vectorIndex.size(),
      build_time_ms: elapsedMs
    });

    if (elapsedMs > 10000) { // 10 seconds
      console.warn('vector_index_build_slow', {
        elapsed_ms: elapsedMs,
        target_ms: 10000
      });
    }
  }

  /**
   * Search for similar snippets using vector similarity
   */
  async search(query: string, maxResults?: number): Promise<VectorResult[]> {
    const startTime = Date.now();
    const limit = maxResults || this.config.maxResults;

    console.log('vector_search_start', {
      query_length: query.length,
      max_results: limit,
      similarity_threshold: this.config.similarityThreshold,
      index_type: this.config.indexType
    });

    if (this.vectorIndex.size() === 0) {
      console.warn('vector_search_empty_index');
      return [];
    }

    try {
      // Get query embedding
      const queryEmbedding = await this.getQueryEmbedding(query);

      // Search vector index
      const searchResults = this.vectorIndex.search(queryEmbedding, limit * 2); // Get more to filter

      // Convert to VectorResult and filter by threshold
      const results: VectorResult[] = [];
      
      for (const result of searchResults) {
        let similarity: number;
        
        // For HNSW, distance is Euclidean, convert to cosine similarity approximation
        if (this.config.indexType === 'hnsw') {
          // For normalized vectors, Euclidean distance relates to cosine similarity
          // similarity ≈ 1 - (euclidean_distance^2 / 2)
          // This is an approximation that works well for normalized embeddings
          similarity = Math.max(0, 1 - (result.distance * result.distance) / 2);
        } else {
          // Linear index returns cosine distance (1 - cosine_similarity)
          similarity = 1 - result.distance;
        }
        
        if (similarity >= this.config.similarityThreshold) {
          const snippet = this.snippetMap.get(result.id);
          if (snippet) {
            results.push({
              snippet,
              similarity,
              embedding: queryEmbedding // Include query embedding for debugging
            });
          }
        }
      }

      // Limit to requested number of results
      const finalResults = results.slice(0, limit);

      const elapsedMs = Date.now() - startTime;
      console.log('vector_search_complete', {
        query_length: query.length,
        results_count: finalResults.length,
        search_time_ms: elapsedMs,
        index_type: this.config.indexType,
        snippet_ids: finalResults.map(r => r.snippet.id),
        similarities: finalResults.map(r => r.similarity.toFixed(3))
      });

      // Performance warning threshold depends on index type
      const targetMs = this.config.indexType === 'hnsw' ? 50 : 100;
      if (elapsedMs > targetMs) {
        console.warn('vector_search_slow', {
          elapsed_ms: elapsedMs,
          target_ms: targetMs,
          index_type: this.config.indexType
        });
      }

      return finalResults;

    } catch (error) {
      const elapsedMs = Date.now() - startTime;
      console.error('vector_search_error', {
        query_length: query.length,
        error: error instanceof Error ? error.message : error,
        time_ms: elapsedMs,
        index_type: this.config.indexType
      });

      throw new Error(`Vector search failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Get query embedding with caching to avoid redundant API calls
   */
  private async getQueryEmbedding(query: string): Promise<number[]> {
    // Check in-memory cache first
    const cacheKey = this.getCacheKey(query);
    if (this.queryEmbeddingCache.has(cacheKey)) {
      console.log('query_embedding_cache_hit', { query_length: query.length });
      return this.queryEmbeddingCache.get(cacheKey)!;
    }

    // Check persistent cache if enabled
    if (this.config.cacheEnabled) {
      const cachedEmbedding = await this.cache.get(query);
      if (cachedEmbedding) {
        console.log('query_embedding_persistent_cache_hit', { query_length: query.length });
        this.queryEmbeddingCache.set(cacheKey, cachedEmbedding);
        return cachedEmbedding;
      }
    }

    // Generate new embedding
    console.log('query_embedding_generation', { query_length: query.length });
    const result = await this.embeddingService.generateEmbedding(query);
    
    // Cache the result
    this.queryEmbeddingCache.set(cacheKey, result.embedding);
    
    if (this.config.cacheEnabled) {
      await this.cache.set(query, result.embedding);
    }

    return result.embedding;
  }

  /**
   * Get cached embeddings for texts, returning both cached and missing
   */
  private async getCachedEmbeddings(texts: string[]): Promise<{
    embeddings: number[][];
    missingTexts: string[];
  }> {
    const embeddings: number[][] = new Array(texts.length);
    const missingTexts: string[] = [];

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      const cachedEmbedding = await this.cache.get(text);
      
      if (cachedEmbedding) {
        embeddings[i] = cachedEmbedding;
      } else {
        missingTexts.push(text);
      }
    }

    return { embeddings, missingTexts };
  }

  /**
   * Generate cache key for query
   */
  private getCacheKey(query: string): string {
    // Simple hash function for cache key
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `query_${hash}_${this.config.model}`;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Get default configuration for text-embedding-3-small with HNSW
   */
  static getDefaultConfig(): VectorConfig {
    return {
      model: 'text-embedding-3-small',
      dimensions: 1536,
      maxResults: 20,
      similarityThreshold: 0.3,
      cacheEnabled: true,
      indexType: 'hnsw',
      hnswConfig: HNSWIndex.getDefaultConfig()
    };
  }

  /**
   * Get configuration for text-embedding-3-large with HNSW
   */
  static getLargeModelConfig(): VectorConfig {
    return {
      model: 'text-embedding-3-large',
      dimensions: 3072,
      maxResults: 20,
      similarityThreshold: 0.3,
      cacheEnabled: true,
      indexType: 'hnsw',
      hnswConfig: HNSWIndex.getDefaultConfig()
    };
  }

  /**
   * Get configuration for linear search (legacy)
   */
  static getLinearConfig(): VectorConfig {
    return {
      model: 'text-embedding-3-small',
      dimensions: 1536,
      maxResults: 20,
      similarityThreshold: 0.3,
      cacheEnabled: true,
      indexType: 'linear'
    };
  }

  /**
   * Get optimized configuration for small datasets
   */
  static getSmallDatasetConfig(): VectorConfig {
    return {
      model: 'text-embedding-3-small',
      dimensions: 1536,
      maxResults: 20,
      similarityThreshold: 0.3,
      cacheEnabled: true,
      indexType: 'hnsw',
      hnswConfig: HNSWIndex.getSmallDatasetConfig()
    };
  }

  /**
   * Get optimized configuration for large datasets
   */
  static getLargeDatasetConfig(): VectorConfig {
    return {
      model: 'text-embedding-3-small',
      dimensions: 1536,
      maxResults: 20,
      similarityThreshold: 0.3,
      cacheEnabled: true,
      indexType: 'hnsw',
      hnswConfig: HNSWIndex.getLargeDatasetConfig()
    };
  }

  /**
   * Get retriever configuration
   */
  getConfig(): VectorConfig {
    return { ...this.config };
  }

  /**
   * Update retriever configuration
   */
  updateConfig(newConfig: Partial<VectorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('vector_retriever_config_updated', {
      new_config: newConfig,
      full_config: this.config
    });
  }

  /**
   * Get index statistics
   */
  getIndexStats(): {
    size: number;
    dimensions: number;
    model: string;
    cacheSize: number;
    indexType: string;
    hnswStats?: any;
  } {
    const baseStats = {
      size: this.vectorIndex.size(),
      dimensions: this.config.dimensions,
      model: this.config.model,
      cacheSize: this.queryEmbeddingCache.size,
      indexType: this.config.indexType
    };

    // Add HNSW-specific stats if using HNSW index
    if (this.config.indexType === 'hnsw' && this.vectorIndex instanceof HNSWIndex) {
      return {
        ...baseStats,
        hnswStats: this.vectorIndex.getStats()
      };
    }

    return baseStats;
  }

  /**
   * Clear query embedding cache
   */
  clearQueryCache(): void {
    this.queryEmbeddingCache.clear();
    console.log('vector_retriever_query_cache_cleared');
  }

  /**
   * Save index to file for persistence
   */
  async saveIndex(filePath: string): Promise<void> {
    if (this.config.indexType === 'hnsw' && this.vectorIndex instanceof HNSWIndex) {
      const serialized = this.vectorIndex.serialize();
      const fs = await import('fs/promises');
      await fs.writeFile(filePath, serialized, 'utf8');
      
      console.log('hnsw_index_saved', {
        file_path: filePath,
        index_size: this.vectorIndex.size()
      });
    } else {
      console.warn('index_save_not_supported', {
        index_type: this.config.indexType
      });
    }
  }

  /**
   * Load index from file
   */
  async loadIndex(filePath: string): Promise<void> {
    if (this.config.indexType === 'hnsw') {
      try {
        const fs = await import('fs/promises');
        const serialized = await fs.readFile(filePath, 'utf8');
        this.vectorIndex = HNSWIndex.deserialize(serialized);
        
        console.log('hnsw_index_loaded', {
          file_path: filePath,
          index_size: this.vectorIndex.size()
        });
      } catch (error) {
        console.warn('hnsw_index_load_failed', {
          file_path: filePath,
          error: error instanceof Error ? error.message : error
        });
        
        // Fall back to creating new index
        this.vectorIndex = new HNSWIndex(this.config.hnswConfig);
      }
    } else {
      console.warn('index_load_not_supported', {
        index_type: this.config.indexType
      });
    }
  }

  /**
   * Get memory usage estimation
   */
  getMemoryUsage(): {
    totalMB: number;
    indexMB: number;
    cacheMB: number;
    snippetsMB: number;
  } {
    const bytesPerFloat = 8;
    const bytesPerMB = 1024 * 1024;

    // Estimate index memory usage
    let indexMB = 0;
    if (this.config.indexType === 'hnsw' && this.vectorIndex instanceof HNSWIndex) {
      indexMB = this.vectorIndex.getStats().memoryUsageMB;
    } else {
      // Linear index: vectors + overhead
      indexMB = (this.vectorIndex.size() * this.config.dimensions * bytesPerFloat) / bytesPerMB;
    }

    // Estimate cache memory usage
    const cacheMB = (this.queryEmbeddingCache.size * this.config.dimensions * bytesPerFloat) / bytesPerMB;

    // Estimate snippets memory usage (rough)
    const avgSnippetSize = 200; // bytes
    const snippetsMB = (this.snippetMap.size * avgSnippetSize) / bytesPerMB;

    const totalMB = indexMB + cacheMB + snippetsMB;

    return {
      totalMB,
      indexMB,
      cacheMB,
      snippetsMB
    };
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: string[];
  }> {
    try {
      // Check if index is built
      if (this.vectorIndex.size() === 0) {
        return {
          status: 'degraded',
          details: ['Vector index is empty - needs to be built']
        };
      }

      // Test embedding service
      const embeddingHealth = await this.embeddingService.getHealthStatus();
      if (embeddingHealth.status !== 'healthy') {
        return {
          status: 'degraded',
          details: [`Embedding service ${embeddingHealth.status}`, ...embeddingHealth.details]
        };
      }

      // Test search functionality
      const testResults = await this.search('test query', 1);
      
      const memoryUsage = this.getMemoryUsage();
      
      return {
        status: 'healthy',
        details: [
          'Vector retriever operational',
          `Index size: ${this.vectorIndex.size()}`,
          `Index type: ${this.config.indexType}`,
          `Model: ${this.config.model}`,
          `Dimensions: ${this.config.dimensions}`,
          `Memory usage: ${memoryUsage.totalMB.toFixed(1)}MB`,
          `Test search returned ${testResults.length} results`
        ]
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        details: [`Vector retriever error: ${error instanceof Error ? error.message : error}`]
      };
    }
  }
}