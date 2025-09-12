// src/lib/services/embeddingStore.ts
// Embedding store with JSON persistence and version tracking

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { FactbookSnippet } from './factbookService';

/**
 * Embedding storage format for JSON persistence
 */
export interface EmbeddingFile {
  version: string;
  model: string;
  dimensions: number;
  embeddings: {
    [snippetId: string]: number[];
  };
  metadata: {
    createdAt: number;
    updatedAt: number;
    snippetCount: number;
    totalSize: number;
    checksum: string;
  };
}

/**
 * Configuration for embedding store
 */
export interface EmbeddingStoreConfig {
  storePath: string;
  model: string;
  dimensions: number;
  compressionLevel?: number; // 0-9, 0 = no compression
  backupCount?: number; // Number of backup files to keep
}

/**
 * Statistics about the embedding store
 */
export interface EmbeddingStoreStats {
  totalEmbeddings: number;
  fileSizeBytes: number;
  lastUpdated: number;
  version: string;
  model: string;
  dimensions: number;
  isValid: boolean;
}

/**
 * Embedding store class that saves/loads embeddings to JSON with version tracking
 */
export class EmbeddingStore {
  private config: EmbeddingStoreConfig;
  private embeddings = new Map<string, number[]>();
  private version: string;
  private isLoaded = false;

  constructor(config: EmbeddingStoreConfig) {
    this.config = config;
    this.version = this.generateVersion();

    console.log('embedding_store_initialized', {
      store_path: this.config.storePath,
      model: this.config.model,
      dimensions: this.config.dimensions,
      version: this.version
    });
  }

  /**
   * Load embeddings from JSON file with version validation
   */
  async loadEmbeddings(): Promise<Map<string, number[]>> {
    const startTime = Date.now();

    try {
      if (!(await this.fileExists(this.config.storePath))) {
        console.log('embedding_store_file_not_found', {
          store_path: this.config.storePath
        });
        this.embeddings.clear();
        this.isLoaded = true;
        return new Map(this.embeddings);
      }

      const data = await fs.readFile(this.config.storePath, 'utf-8');
      const embeddingFile: EmbeddingFile = JSON.parse(data);

      // Validate file structure
      if (!this.validateEmbeddingFile(embeddingFile)) {
        throw new Error('Invalid embedding file structure');
      }

      // Check version compatibility
      if (!this.isVersionCompatible(embeddingFile.version)) {
        console.warn('embedding_store_version_mismatch', {
          file_version: embeddingFile.version,
          current_version: this.version,
          model: embeddingFile.model,
          dimensions: embeddingFile.dimensions
        });

        // Clear embeddings if version is incompatible
        this.embeddings.clear();
        this.isLoaded = true;
        return new Map(this.embeddings);
      }

      // Validate checksum
      const calculatedChecksum = this.calculateChecksum(embeddingFile.embeddings);
      if (calculatedChecksum !== embeddingFile.metadata.checksum) {
        throw new Error('Embedding file checksum validation failed');
      }

      // Load embeddings
      this.embeddings.clear();
      for (const [snippetId, embedding] of Object.entries(embeddingFile.embeddings)) {
        if (Array.isArray(embedding) && embedding.length === this.config.dimensions) {
          this.embeddings.set(snippetId, embedding);
        } else {
          console.warn('embedding_store_invalid_embedding', {
            snippet_id: snippetId,
            expected_dimensions: this.config.dimensions,
            actual_dimensions: Array.isArray(embedding) ? embedding.length : 'not_array'
          });
        }
      }

      this.isLoaded = true;
      const elapsedMs = Date.now() - startTime;

      console.log('embedding_store_loaded', {
        embeddings_count: this.embeddings.size,
        file_size_bytes: data.length,
        load_time_ms: elapsedMs,
        version: embeddingFile.version,
        model: embeddingFile.model
      });

      return new Map(this.embeddings);

    } catch (error) {
      const elapsedMs = Date.now() - startTime;
      console.error('embedding_store_load_error', {
        store_path: this.config.storePath,
        error: error instanceof Error ? error.message : error,
        time_ms: elapsedMs
      });

      // Initialize empty embeddings on error
      this.embeddings.clear();
      this.isLoaded = true;
      return new Map(this.embeddings);
    }
  }

  /**
   * Save embeddings to JSON file with version tracking and backup
   */
  async saveEmbeddings(embeddings: Map<string, number[]>): Promise<void> {
    const startTime = Date.now();

    try {
      // Update internal embeddings
      this.embeddings = new Map(embeddings);

      // Create embedding file structure
      const embeddingData: { [key: string]: number[] } = {};
      for (const [snippetId, embedding] of embeddings.entries()) {
        embeddingData[snippetId] = embedding;
      }

      const embeddingFile: EmbeddingFile = {
        version: this.version,
        model: this.config.model,
        dimensions: this.config.dimensions,
        embeddings: embeddingData,
        metadata: {
          createdAt: this.isLoaded ? Date.now() : Date.now(),
          updatedAt: Date.now(),
          snippetCount: embeddings.size,
          totalSize: this.calculateTotalSize(embeddingData),
          checksum: this.calculateChecksum(embeddingData)
        }
      };

      // Ensure directory exists
      await this.ensureDirectory(path.dirname(this.config.storePath));

      // Create backup if file exists
      if (await this.fileExists(this.config.storePath)) {
        await this.createBackup();
      }

      // Write to temporary file first
      const tempPath = `${this.config.storePath}.tmp`;
      const jsonData = JSON.stringify(embeddingFile, null, 2);
      await fs.writeFile(tempPath, jsonData, 'utf-8');

      // Atomic move to final location
      await fs.rename(tempPath, this.config.storePath);

      const elapsedMs = Date.now() - startTime;
      console.log('embedding_store_saved', {
        embeddings_count: embeddings.size,
        file_size_bytes: jsonData.length,
        save_time_ms: elapsedMs,
        version: this.version,
        checksum: embeddingFile.metadata.checksum
      });

    } catch (error) {
      const elapsedMs = Date.now() - startTime;
      console.error('embedding_store_save_error', {
        store_path: this.config.storePath,
        embeddings_count: embeddings.size,
        error: error instanceof Error ? error.message : error,
        time_ms: elapsedMs
      });

      throw new Error(`Failed to save embeddings: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Get embedding for a specific snippet
   */
  getEmbedding(snippetId: string): number[] | null {
    return this.embeddings.get(snippetId) || null;
  }

  /**
   * Set embedding for a specific snippet
   */
  setEmbedding(snippetId: string, embedding: number[]): void {
    if (embedding.length !== this.config.dimensions) {
      throw new Error(`Invalid embedding dimensions: expected ${this.config.dimensions}, got ${embedding.length}`);
    }

    this.embeddings.set(snippetId, [...embedding]); // Store copy to prevent mutation
  }

  /**
   * Check if embedding exists for snippet
   */
  hasEmbedding(snippetId: string): boolean {
    return this.embeddings.has(snippetId);
  }

  /**
   * Get all embeddings
   */
  getAllEmbeddings(): Map<string, number[]> {
    return new Map(this.embeddings);
  }

  /**
   * Get embeddings for multiple snippets
   */
  getBatchEmbeddings(snippetIds: string[]): Map<string, number[]> {
    const results = new Map<string, number[]>();
    
    for (const snippetId of snippetIds) {
      const embedding = this.embeddings.get(snippetId);
      if (embedding) {
        results.set(snippetId, [...embedding]); // Return copy
      }
    }

    return results;
  }

  /**
   * Set embeddings for multiple snippets
   */
  setBatchEmbeddings(embeddings: Map<string, number[]>): void {
    for (const [snippetId, embedding] of embeddings.entries()) {
      this.setEmbedding(snippetId, embedding);
    }
  }

  /**
   * Remove embedding for snippet
   */
  removeEmbedding(snippetId: string): boolean {
    return this.embeddings.delete(snippetId);
  }

  /**
   * Clear all embeddings
   */
  clear(): void {
    this.embeddings.clear();
  }

  /**
   * Get store statistics
   */
  async getStats(): Promise<EmbeddingStoreStats> {
    let fileSizeBytes = 0;
    let lastUpdated = 0;

    try {
      if (await this.fileExists(this.config.storePath)) {
        const stats = await fs.stat(this.config.storePath);
        fileSizeBytes = stats.size;
        lastUpdated = stats.mtime.getTime();
      }
    } catch (error) {
      // File might not exist yet
    }

    return {
      totalEmbeddings: this.embeddings.size,
      fileSizeBytes,
      lastUpdated,
      version: this.version,
      model: this.config.model,
      dimensions: this.config.dimensions,
      isValid: this.isLoaded
    };
  }

  /**
   * Validate store integrity
   */
  async validateStore(): Promise<boolean> {
    try {
      if (!await this.fileExists(this.config.storePath)) {
        return true; // Empty store is valid
      }

      const data = await fs.readFile(this.config.storePath, 'utf-8');
      const embeddingFile: EmbeddingFile = JSON.parse(data);

      // Validate structure
      if (!this.validateEmbeddingFile(embeddingFile)) {
        return false;
      }

      // Validate checksum
      const calculatedChecksum = this.calculateChecksum(embeddingFile.embeddings);
      if (calculatedChecksum !== embeddingFile.metadata.checksum) {
        return false;
      }

      // Validate embeddings
      for (const [snippetId, embedding] of Object.entries(embeddingFile.embeddings)) {
        if (!Array.isArray(embedding) || embedding.length !== embeddingFile.dimensions) {
          return false;
        }

        // Check for valid numbers
        if (!embedding.every(value => typeof value === 'number' && !isNaN(value) && isFinite(value))) {
          return false;
        }
      }

      return true;

    } catch (error) {
      console.error('embedding_store_validation_error', {
        error: error instanceof Error ? error.message : error
      });
      return false;
    }
  }

  /**
   * Get current version
   */
  getVersion(): string {
    return this.version;
  }

  /**
   * Set version (for cache invalidation)
   */
  setVersion(version: string): void {
    this.version = version;
  }

  /**
   * Check if store is loaded
   */
  isStoreLoaded(): boolean {
    return this.isLoaded;
  }

  private validateEmbeddingFile(file: any): file is EmbeddingFile {
    return (
      typeof file === 'object' &&
      typeof file.version === 'string' &&
      typeof file.model === 'string' &&
      typeof file.dimensions === 'number' &&
      typeof file.embeddings === 'object' &&
      typeof file.metadata === 'object' &&
      typeof file.metadata.createdAt === 'number' &&
      typeof file.metadata.updatedAt === 'number' &&
      typeof file.metadata.snippetCount === 'number' &&
      typeof file.metadata.totalSize === 'number' &&
      typeof file.metadata.checksum === 'string'
    );
  }

  private isVersionCompatible(fileVersion: string): boolean {
    // For now, require exact version match
    // In the future, could implement semantic versioning compatibility
    return fileVersion === this.version;
  }

  private generateVersion(): string {
    // Version based on model and dimensions
    const versionString = `${this.config.model}-${this.config.dimensions}`;
    return crypto.createHash('md5').update(versionString).digest('hex').substring(0, 8);
  }

  private calculateChecksum(embeddings: { [key: string]: number[] }): string {
    const sortedKeys = Object.keys(embeddings).sort();
    const dataString = sortedKeys.map(key => `${key}:${embeddings[key].join(',')}`).join('|');
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  private calculateTotalSize(embeddings: { [key: string]: number[] }): number {
    let totalSize = 0;
    for (const [key, embedding] of Object.entries(embeddings)) {
      totalSize += key.length * 2; // UTF-16 encoding
      totalSize += embedding.length * 8; // 8 bytes per float64
    }
    return totalSize;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private async createBackup(): Promise<void> {
    try {
      const backupCount = this.config.backupCount || 3;
      const backupPath = `${this.config.storePath}.backup`;

      // Rotate existing backups
      for (let i = backupCount - 1; i > 0; i--) {
        const oldBackup = `${backupPath}.${i}`;
        const newBackup = `${backupPath}.${i + 1}`;

        if (await this.fileExists(oldBackup)) {
          await fs.rename(oldBackup, newBackup);
        }
      }

      // Create new backup
      if (await this.fileExists(this.config.storePath)) {
        await fs.copyFile(this.config.storePath, `${backupPath}.1`);
      }

    } catch (error) {
      console.warn('embedding_store_backup_error', {
        error: error instanceof Error ? error.message : error
      });
      // Don't fail the save operation if backup fails
    }
  }
}

/**
 * Factory function to create embedding store with default configuration
 */
export function createEmbeddingStore(
  storePath: string,
  model: string = 'text-embedding-3-small',
  dimensions: number = 1536,
  options: {
    compressionLevel?: number;
    backupCount?: number;
  } = {}
): EmbeddingStore {
  const config: EmbeddingStoreConfig = {
    storePath,
    model,
    dimensions,
    compressionLevel: options.compressionLevel || 0,
    backupCount: options.backupCount || 3
  };

  return new EmbeddingStore(config);
}