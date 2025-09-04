/**
 * Expression Buffer Manager
 * 
 * Handles preloading, validation, and memory management of expression audio buffers.
 * Implements Task 6: Expression preloading and buffer management
 * 
 * Requirements: 3.6, 6.2
 */

import { StoredExpression } from './services/expressionStorageService';
import { logger } from './logger';
import { expressionMetrics, expressionMetricsRecorder } from './expressionMetrics';
import { AudioQualityValidator, globalAudioQualityValidator, quickValidateAudio } from './audioQualityValidator';

export interface BufferValidationResult {
  isValid: boolean;
  duration: number;
  sampleRate: number;
  channels: number;
  errors: string[];
}

export interface BufferManagerOptions {
  /** Maximum number of buffers to keep in memory */
  maxBuffers?: number;
  /** Maximum total memory usage in bytes */
  maxMemoryBytes?: number;
  /** Enable audio quality validation during preload */
  enableValidation?: boolean;
  /** Timeout for individual buffer loads (ms) */
  loadTimeoutMs?: number;
  /** Maximum concurrent buffer loads */
  maxConcurrentLoads?: number;
}

export interface BufferManagerStats {
  totalBuffers: number;
  loadedBuffers: number;
  failedBuffers: number;
  memoryUsageBytes: number;
  averageLoadTimeMs: number;
  validationStats: {
    validated: number;
    passed: number;
    failed: number;
  };
}

/**
 * Manages expression audio buffer preloading and memory management
 */
export class ExpressionBufferManager {
  private buffers = new Map<string, AudioBuffer>();
  private loadingPromises = new Map<string, Promise<AudioBuffer | null>>();
  private loadTimes = new Map<string, number>();
  private validationResults = new Map<string, BufferValidationResult>();
  private audioContext: AudioContext | null = null;
  private qualityValidator: AudioQualityValidator | null = null;
  
  private options: Required<BufferManagerOptions>;
  private stats: BufferManagerStats;

  constructor(options: BufferManagerOptions = {}) {
    this.options = {
      maxBuffers: options.maxBuffers ?? 50,
      maxMemoryBytes: options.maxMemoryBytes ?? 50 * 1024 * 1024, // 50MB
      enableValidation: options.enableValidation ?? true,
      loadTimeoutMs: options.loadTimeoutMs ?? 10000, // 10 seconds
      maxConcurrentLoads: options.maxConcurrentLoads ?? 5
    };

    this.stats = {
      totalBuffers: 0,
      loadedBuffers: 0,
      failedBuffers: 0,
      memoryUsageBytes: 0,
      averageLoadTimeMs: 0,
      validationStats: {
        validated: 0,
        passed: 0,
        failed: 0
      }
    };
  }

  /**
   * Initialize the buffer manager
   */
  async initialize(): Promise<boolean> {
    try {
      // Create or reuse AudioContext
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Initialize quality validator if enabled
      if (this.options.enableValidation) {
        this.qualityValidator = globalAudioQualityValidator;
        await this.qualityValidator.initialize();
      }

      logger.debug('ExpressionBufferManager initialized', {
        maxBuffers: this.options.maxBuffers,
        maxMemoryMB: Math.round(this.options.maxMemoryBytes / 1024 / 1024),
        validationEnabled: this.options.enableValidation
      });

      return true;
    } catch (error) {
      logger.error('Failed to initialize ExpressionBufferManager', { error });
      return false;
    }
  }

  /**
   * Preload buffers for multiple expressions with error handling and validation
   * Task 6: Add expression buffer preloading to StreamingAudioManager initialization
   */
  async preloadExpressions(expressions: StoredExpression[]): Promise<Map<string, AudioBuffer>> {
    if (!this.audioContext) {
      throw new Error('BufferManager not initialized');
    }

    const startTime = performance.now();
    const loadedBuffers = new Map<string, AudioBuffer>();
    
    logger.debug('Starting expression buffer preload', {
      expressionCount: expressions.length,
      maxConcurrent: this.options.maxConcurrentLoads
    });

    // Track preload metrics
    expressionMetricsRecorder.startPreload(expressions.length);

    try {
      // Load buffers in batches to control concurrency
      const batches = this.createBatches(expressions, this.options.maxConcurrentLoads);
      
      for (const batch of batches) {
        const batchPromises = batch.map(expression => 
          this.preloadSingleExpression(expression)
        );
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Process batch results
        batchResults.forEach((result, index) => {
          const expression = batch[index];
          
          if (result.status === 'fulfilled' && result.value) {
            loadedBuffers.set(expression.id, result.value);
            this.stats.loadedBuffers++;
          } else {
            this.stats.failedBuffers++;
            logger.warn('Failed to preload expression buffer', {
              expressionId: expression.id,
              cdnUrl: expression.cdnUrl,
              error: result.status === 'rejected' ? result.reason : 'Unknown error'
            });
          }
        });
      }

      // Update memory usage stats and enforce final limits
      this.updateMemoryStats();
      
      // Create final result map with only buffers that are actually stored
      const finalBuffers = new Map<string, AudioBuffer>();
      for (const [id, buffer] of loadedBuffers) {
        if (this.buffers.has(id)) {
          finalBuffers.set(id, buffer);
        }
      }
      
      // Calculate average load time
      const totalTime = performance.now() - startTime;
      this.stats.averageLoadTimeMs = totalTime / expressions.length;

      // Record preload completion metrics
      expressionMetricsRecorder.recordPreloadComplete(
        expressions.length,
        finalBuffers.size,
        totalTime
      );

      logger.info('Expression buffer preload completed', {
        totalExpressions: expressions.length,
        loadedBuffers: finalBuffers.size,
        failedBuffers: this.stats.failedBuffers,
        totalTimeMs: Math.round(totalTime),
        averageTimeMs: Math.round(this.stats.averageLoadTimeMs),
        memoryUsageMB: Math.round(this.stats.memoryUsageBytes / 1024 / 1024)
      });

      return finalBuffers;

    } catch (error) {
      logger.error('Expression buffer preload failed', { error });
      
      // Record error metrics
      expressionMetrics.errorCount.inc({
        error_type: 'PRELOAD_ERROR',
        error_stage: 'BUFFER_LOADING',
        owner_type: 'unknown'
      });

      throw error;
    }
  }

  /**
   * Preload a single expression with timeout and validation
   * Task 6: Add error handling for failed expression loads without blocking TTS
   */
  private async preloadSingleExpression(expression: StoredExpression): Promise<AudioBuffer | null> {
    const startTime = performance.now();
    
    try {
      // Check if already loaded
      if (this.buffers.has(expression.id)) {
        return this.buffers.get(expression.id)!;
      }

      // Check if already loading
      if (this.loadingPromises.has(expression.id)) {
        return await this.loadingPromises.get(expression.id)!;
      }

      // Create loading promise with timeout
      const loadPromise = this.loadExpressionBuffer(expression);
      this.loadingPromises.set(expression.id, loadPromise);

      // Add timeout wrapper
      const timeoutPromise = new Promise<AudioBuffer | null>((_, reject) => {
        setTimeout(() => reject(new Error('Load timeout')), this.options.loadTimeoutMs);
      });

      const buffer = await Promise.race([loadPromise, timeoutPromise]);
      
      if (buffer) {
        // Validate buffer format and quality
        const validation = await this.validateBuffer(buffer, expression);
        this.validationResults.set(expression.id, validation);
        
        if (validation.isValid) {
          // Store buffer and track memory
          this.buffers.set(expression.id, buffer);
          this.loadTimes.set(expression.id, performance.now() - startTime);
          
          // Enforce memory limits
          await this.enforceMemoryLimits();
          
          return buffer;
        } else {
          logger.warn('Expression buffer failed validation', {
            expressionId: expression.id,
            errors: validation.errors
          });
          return null;
        }
      }

      return null;

    } catch (error) {
      logger.warn('Failed to preload expression buffer', {
        expressionId: expression.id,
        cdnUrl: expression.cdnUrl,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    } finally {
      // Clean up loading promise
      this.loadingPromises.delete(expression.id);
    }
  }

  /**
   * Load audio buffer from CDN URL
   */
  private async loadExpressionBuffer(expression: StoredExpression): Promise<AudioBuffer | null> {
    if (!this.audioContext) {
      throw new Error('AudioContext not available');
    }

    try {
      const response = await fetch(expression.cdnUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      
      // Validate array buffer size
      if (arrayBuffer.byteLength === 0) {
        throw new Error('Empty audio file');
      }

      if (arrayBuffer.byteLength > 5 * 1024 * 1024) { // 5MB limit
        throw new Error('Audio file too large');
      }

      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      logger.debug('Expression buffer loaded successfully', {
        expressionId: expression.id,
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        sizeBytes: arrayBuffer.byteLength
      });

      return audioBuffer;

    } catch (error) {
      throw new Error(`Failed to load ${expression.cdnUrl}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate audio buffer format and quality
   * Task 6: Create expression buffer validation and format checking
   */
  private async validateBuffer(buffer: AudioBuffer, expression: StoredExpression): Promise<BufferValidationResult> {
    const errors: string[] = [];
    
    try {
      // Basic format validation
      if (buffer.duration <= 0) {
        errors.push('Invalid duration');
      }
      
      if (buffer.duration > 5.0) { // 5 second limit
        errors.push('Duration exceeds limit (5s)');
      }
      
      if (buffer.sampleRate < 16000) {
        errors.push('Sample rate too low (minimum 16kHz)');
      }
      
      if (buffer.numberOfChannels < 1 || buffer.numberOfChannels > 2) {
        errors.push('Invalid channel count (must be 1 or 2)');
      }

      // Audio quality validation if enabled
      if (this.qualityValidator && this.options.enableValidation) {
        try {
          const qualityResult = await quickValidateAudio(buffer, this.qualityValidator);
          this.stats.validationStats.validated++;
          
          if (!qualityResult.isValid) {
            this.stats.validationStats.failed++;
            errors.push(...qualityResult.errors);
          } else {
            this.stats.validationStats.passed++;
          }
        } catch (validationError) {
          logger.warn('Audio quality validation failed', {
            expressionId: expression.id,
            error: validationError
          });
          // Don't fail validation due to quality check errors
        }
      }

      const result: BufferValidationResult = {
        isValid: errors.length === 0,
        duration: buffer.duration,
        sampleRate: buffer.sampleRate,
        channels: buffer.numberOfChannels,
        errors
      };

      if (!result.isValid) {
        logger.debug('Buffer validation failed', {
          expressionId: expression.id,
          errors: result.errors
        });
      }

      return result;

    } catch (error) {
      return {
        isValid: false,
        duration: 0,
        sampleRate: 0,
        channels: 0,
        errors: [`Validation error: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  /**
   * Get a preloaded buffer by expression ID
   */
  getBuffer(expressionId: string): AudioBuffer | null {
    return this.buffers.get(expressionId) || null;
  }

  /**
   * Check if a buffer is loaded and ready
   */
  isBufferReady(expressionId: string): boolean {
    return this.buffers.has(expressionId);
  }

  /**
   * Get validation result for an expression
   */
  getValidationResult(expressionId: string): BufferValidationResult | null {
    return this.validationResults.get(expressionId) || null;
  }

  /**
   * Get current buffer manager statistics
   */
  getStats(): BufferManagerStats {
    this.updateMemoryStats();
    return { ...this.stats };
  }

  /**
   * Clear specific buffers to free memory
   * Task 6: Implement buffer cleanup and memory management for expression audio
   */
  clearBuffers(expressionIds?: string[]): void {
    if (expressionIds) {
      // Clear specific buffers
      for (const id of expressionIds) {
        this.buffers.delete(id);
        this.loadTimes.delete(id);
        this.validationResults.delete(id);
      }
    } else {
      // Clear all buffers
      this.buffers.clear();
      this.loadTimes.clear();
      this.validationResults.clear();
    }
    
    this.updateMemoryStats();
    
    logger.debug('Buffers cleared', {
      clearedCount: expressionIds ? expressionIds.length : 'all',
      remainingBuffers: this.buffers.size
    });
  }

  /**
   * Enforce memory limits by removing least recently used buffers
   */
  private async enforceMemoryLimits(): Promise<void> {
    this.updateMemoryStats();
    
    // Check buffer count limit
    if (this.buffers.size > this.options.maxBuffers) {
      const excess = this.buffers.size - this.options.maxBuffers;
      const oldestBuffers = Array.from(this.loadTimes.entries())
        .sort((a, b) => a[1] - b[1])
        .slice(0, excess)
        .map(([id]) => id);
      
      this.clearBuffers(oldestBuffers);
      
      logger.debug('Enforced buffer count limit', {
        removedBuffers: excess,
        remainingBuffers: this.buffers.size
      });
    }
    
    // Check memory usage limit
    if (this.stats.memoryUsageBytes > this.options.maxMemoryBytes) {
      const targetReduction = this.stats.memoryUsageBytes - this.options.maxMemoryBytes;
      let removedBytes = 0;
      const buffersToRemove: string[] = [];
      
      // Remove oldest buffers until under limit
      const sortedBuffers = Array.from(this.loadTimes.entries())
        .sort((a, b) => a[1] - b[1]);
      
      for (const [id] of sortedBuffers) {
        const buffer = this.buffers.get(id);
        if (buffer) {
          const bufferSize = this.calculateBufferSize(buffer);
          buffersToRemove.push(id);
          removedBytes += bufferSize;
          
          if (removedBytes >= targetReduction) {
            break;
          }
        }
      }
      
      this.clearBuffers(buffersToRemove);
      
      logger.debug('Enforced memory limit', {
        removedBuffers: buffersToRemove.length,
        freedMB: Math.round(removedBytes / 1024 / 1024),
        remainingMB: Math.round(this.stats.memoryUsageBytes / 1024 / 1024)
      });
    }
  }

  /**
   * Update memory usage statistics
   */
  private updateMemoryStats(): void {
    let totalBytes = 0;
    
    for (const buffer of this.buffers.values()) {
      totalBytes += this.calculateBufferSize(buffer);
    }
    
    this.stats.memoryUsageBytes = totalBytes;
    this.stats.totalBuffers = this.buffers.size;
    
    // Record memory usage metrics
    expressionMetrics.bufferMemoryUsage.set(
      { owner_type: 'avatar', buffer_count: this.buffers.size.toString() },
      totalBytes
    );
  }

  /**
   * Calculate memory usage of an audio buffer
   */
  private calculateBufferSize(buffer: AudioBuffer): number {
    return buffer.length * buffer.numberOfChannels * 4; // 4 bytes per float32 sample
  }

  /**
   * Create batches for concurrent loading
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    // Clear all buffers
    this.clearBuffers();
    
    // Cancel any pending loads
    this.loadingPromises.clear();
    
    // Clear references
    this.audioContext = null;
    this.qualityValidator = null;
    
    logger.debug('ExpressionBufferManager disposed');
  }
}

/**
 * Global buffer manager instance
 */
let globalBufferManager: ExpressionBufferManager | null = null;

/**
 * Get or create the global buffer manager
 */
export async function getGlobalBufferManager(options?: BufferManagerOptions): Promise<ExpressionBufferManager> {
  if (!globalBufferManager) {
    globalBufferManager = new ExpressionBufferManager(options);
    await globalBufferManager.initialize();
  }
  return globalBufferManager;
}

/**
 * Dispose of the global buffer manager
 */
export function disposeGlobalBufferManager(): void {
  if (globalBufferManager) {
    globalBufferManager.dispose();
    globalBufferManager = null;
  }
}