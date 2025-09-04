/**
 * Expression Network Manager
 * 
 * Handles network resilience for expression loading with retry logic,
 * graceful degradation, and performance optimization.
 * 
 * Requirements: 6.3, 6.4, 7.1
 */

import { logger } from './logger';
import { expressionMetrics } from './expressionMetrics';
import { 
  ExpressionErrorHandler, 
  ExpressionErrorType, 
  ExpressionErrorStage,
  PlaybackContext 
} from './expressionErrorHandler';

export interface NetworkOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Base delay for exponential backoff (ms) */
  baseDelay?: number;
  /** Maximum delay between retries (ms) */
  maxDelay?: number;
  /** Request timeout (ms) */
  timeout?: number;
  /** Whether to use exponential backoff */
  useExponentialBackoff?: boolean;
  /** Cache strategy */
  cacheStrategy?: 'force-cache' | 'no-cache' | 'default';
  /** Request priority */
  priority?: 'high' | 'low';
}

export interface NetworkResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  retryCount: number;
  totalTime: number;
  cacheHit: boolean;
}

export interface ConnectionQuality {
  /** Estimated bandwidth (Mbps) */
  bandwidth: number;
  /** Network latency (ms) */
  latency: number;
  /** Connection type */
  connectionType: 'slow-2g' | '2g' | '3g' | '4g' | 'wifi' | 'unknown';
  /** Whether connection is metered */
  isMetered: boolean;
}

/**
 * Network manager for expression loading with resilience features
 */
export class ExpressionNetworkManager {
  private options: Required<NetworkOptions>;
  private errorHandler: ExpressionErrorHandler;
  private connectionQuality: ConnectionQuality | null = null;
  private requestCache = new Map<string, Promise<Response>>();
  private failedUrls = new Set<string>();
  private retryDelays = new Map<string, number>();

  constructor(
    options: NetworkOptions = {},
    errorHandler?: ExpressionErrorHandler
  ) {
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      baseDelay: options.baseDelay ?? 100,
      maxDelay: options.maxDelay ?? 5000,
      timeout: options.timeout ?? 10000,
      useExponentialBackoff: options.useExponentialBackoff ?? true,
      cacheStrategy: options.cacheStrategy ?? 'force-cache',
      priority: options.priority ?? 'low'
    };

    this.errorHandler = errorHandler || new ExpressionErrorHandler();
    this.detectConnectionQuality();
  }

  /**
   * Load expression audio with retry logic and graceful degradation
   */
  async loadExpressionAudio(
    url: string,
    context: PlaybackContext,
    options: Partial<NetworkOptions> = {}
  ): Promise<NetworkResult<ArrayBuffer>> {
    const startTime = performance.now();
    const mergedOptions = { ...this.options, ...options };
    
    // Check if URL has failed recently
    if (this.failedUrls.has(url)) {
      logger.debug('Skipping recently failed URL', { url });
      return {
        success: false,
        error: new Error('URL recently failed'),
        retryCount: 0,
        totalTime: 0,
        cacheHit: false
      };
    }

    // Check for existing request to avoid duplicate fetches
    const existingRequest = this.requestCache.get(url);
    if (existingRequest) {
      try {
        const response = await existingRequest;
        const arrayBuffer = await response.clone().arrayBuffer();
        return {
          success: true,
          data: arrayBuffer,
          retryCount: 0,
          totalTime: performance.now() - startTime,
          cacheHit: true
        };
      } catch (error) {
        // Remove failed request from cache
        this.requestCache.delete(url);
      }
    }

    let lastError: Error | null = null;
    let retryCount = 0;
    let cacheHit = false;

    for (let attempt = 0; attempt <= mergedOptions.maxRetries; attempt++) {
      try {
        // Calculate delay for this attempt
        if (attempt > 0) {
          const delay = this.calculateDelay(url, attempt, mergedOptions);
          await this.delay(delay);
        }

        // Create request with appropriate options
        const requestPromise = this.createRequest(url, mergedOptions, context);
        
        // Cache the request promise to avoid duplicates
        this.requestCache.set(url, requestPromise);

        const response = await requestPromise;
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Check if response came from cache
        cacheHit = this.isResponseFromCache(response);
        if (cacheHit) {
          expressionMetrics.cacheHitRate.inc({
            cache_type: 'browser',
            owner_type: context.ownerType
          });
        }

        // Convert to ArrayBuffer
        const arrayBuffer = await response.arrayBuffer();
        
        // Clean up
        this.requestCache.delete(url);
        this.retryDelays.delete(url);
        
        // Record success metrics
        if (attempt > 0) {
          expressionMetrics.networkRetrySuccess.inc({
            owner_type: context.ownerType,
            retry_count: attempt.toString()
          });
        }

        const totalTime = performance.now() - startTime;
        
        logger.debug('Expression audio loaded successfully', {
          url,
          attempt,
          totalTime,
          cacheHit,
          size: arrayBuffer.byteLength
        });

        return {
          success: true,
          data: arrayBuffer,
          retryCount: attempt,
          totalTime,
          cacheHit
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        retryCount = attempt;
        
        logger.warn('Expression audio load attempt failed', {
          url,
          attempt,
          error: lastError.message,
          willRetry: attempt < mergedOptions.maxRetries
        });

        // Handle specific error types
        await this.handleNetworkError(lastError, url, context, attempt);
        
        // Don't retry on certain errors
        if (this.shouldNotRetry(lastError)) {
          break;
        }
      }
    }

    // All attempts failed
    this.requestCache.delete(url);
    this.markUrlAsFailed(url);
    
    const totalTime = performance.now() - startTime;
    
    logger.error('Expression audio load failed after all retries', {
      url,
      retryCount,
      totalTime,
      finalError: lastError?.message
    });

    return {
      success: false,
      error: lastError || new Error('Unknown error'),
      retryCount,
      totalTime,
      cacheHit: false
    };
  }

  /**
   * Preload multiple expressions with concurrency control
   */
  async preloadExpressions(
    urls: string[],
    context: PlaybackContext,
    maxConcurrent: number = 3
  ): Promise<Map<string, ArrayBuffer>> {
    const results = new Map<string, ArrayBuffer>();
    const semaphore = new Array(maxConcurrent).fill(null);
    
    const loadExpression = async (url: string): Promise<void> => {
      const result = await this.loadExpressionAudio(url, context);
      if (result.success && result.data) {
        results.set(url, result.data);
      }
    };

    // Process URLs in batches to control concurrency
    for (let i = 0; i < urls.length; i += maxConcurrent) {
      const batch = urls.slice(i, i + maxConcurrent);
      await Promise.allSettled(batch.map(loadExpression));
    }

    return results;
  }

  /**
   * Create HTTP request with appropriate options
   */
  private async createRequest(
    url: string,
    options: Required<NetworkOptions>,
    context: PlaybackContext
  ): Promise<Response> {
    const controller = new AbortController();
    
    // Set timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, options.timeout);

    try {
      const requestInit: RequestInit = {
        signal: controller.signal,
        cache: options.cacheStrategy,
        priority: options.priority,
        mode: 'cors',
        credentials: 'omit' // Don't send cookies for CDN requests
      };

      // Add headers for better caching and performance
      const headers = new Headers();
      headers.set('Accept', 'audio/*');
      
      // Add connection quality hints if available
      if (this.connectionQuality) {
        if (this.connectionQuality.connectionType === 'slow-2g' || this.connectionQuality.connectionType === '2g') {
          headers.set('Save-Data', 'on');
        }
      }

      requestInit.headers = headers;

      const response = await fetch(url, requestInit);
      clearTimeout(timeoutId);
      
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Calculate delay for retry attempts
   */
  private calculateDelay(
    url: string,
    attempt: number,
    options: Required<NetworkOptions>
  ): number {
    if (!options.useExponentialBackoff) {
      return options.baseDelay;
    }

    // Exponential backoff with jitter
    const exponentialDelay = options.baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay; // ±10% jitter
    const delay = Math.min(exponentialDelay + jitter, options.maxDelay);

    // Store delay for this URL to track retry patterns
    this.retryDelays.set(url, delay);

    return delay;
  }

  /**
   * Handle network errors with appropriate error types
   */
  private async handleNetworkError(
    error: Error,
    url: string,
    context: PlaybackContext,
    attempt: number
  ): Promise<void> {
    let errorType: ExpressionErrorType;

    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      errorType = ExpressionErrorType.TIMEOUT_ERROR;
    } else if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
      errorType = ExpressionErrorType.NETWORK_ERROR;
    } else {
      errorType = ExpressionErrorType.UNKNOWN_ERROR;
    }

    const expressionError = this.errorHandler.createError(
      errorType,
      ExpressionErrorStage.LOADING,
      `Network request failed: ${error.message}`,
      {
        ownerId: context.ownerId,
        originalError: error,
        context: { url, attempt }
      }
    );

    // Only handle as failure on final attempt
    if (attempt >= this.options.maxRetries) {
      await this.errorHandler.handleExpressionFailure(expressionError, context);
    }
  }

  /**
   * Check if response came from cache
   */
  private isResponseFromCache(response: Response): boolean {
    // Check various cache indicators
    const cacheControl = response.headers.get('cache-control');
    const age = response.headers.get('age');
    const xCache = response.headers.get('x-cache');
    
    // If age header exists and is > 0, likely from cache
    if (age && parseInt(age) > 0) {
      return true;
    }
    
    // Check for CDN cache headers
    if (xCache && (xCache.includes('HIT') || xCache.includes('hit'))) {
      return true;
    }
    
    // Check if response was served very quickly (likely cached)
    return response.headers.has('cf-cache-status') || 
           response.headers.has('x-served-by') ||
           response.headers.has('x-cache-status');
  }

  /**
   * Determine if error should not be retried
   */
  private shouldNotRetry(error: Error): boolean {
    // Don't retry on certain HTTP status codes
    if (error.message.includes('HTTP 404') || 
        error.message.includes('HTTP 403') ||
        error.message.includes('HTTP 401')) {
      return true;
    }

    // Don't retry on decode errors
    if (error.message.includes('decode') || error.message.includes('format')) {
      return true;
    }

    return false;
  }

  /**
   * Mark URL as failed to avoid immediate retries
   */
  private markUrlAsFailed(url: string): void {
    this.failedUrls.add(url);
    
    // Remove from failed list after 5 minutes
    setTimeout(() => {
      this.failedUrls.delete(url);
    }, 5 * 60 * 1000);
  }

  /**
   * Detect connection quality for adaptive loading
   */
  private detectConnectionQuality(): void {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      
      if (connection) {
        this.connectionQuality = {
          bandwidth: connection.downlink || 10, // Default to 10 Mbps
          latency: connection.rtt || 100, // Default to 100ms
          connectionType: connection.effectiveType || 'unknown',
          isMetered: connection.saveData || false
        };

        logger.debug('Connection quality detected', this.connectionQuality);
      }
    }
  }

  /**
   * Adapt loading strategy based on connection quality
   */
  getAdaptiveOptions(): Partial<NetworkOptions> {
    if (!this.connectionQuality) {
      return {};
    }

    const options: Partial<NetworkOptions> = {};

    // Adjust timeouts based on connection
    if (this.connectionQuality.connectionType === 'slow-2g' || this.connectionQuality.connectionType === '2g') {
      options.timeout = 20000; // 20 seconds for slow connections
      options.maxRetries = 1; // Fewer retries on slow connections
    } else if (this.connectionQuality.connectionType === '3g') {
      options.timeout = 15000; // 15 seconds
      options.maxRetries = 2;
    }

    // Use aggressive caching on metered connections
    if (this.connectionQuality.isMetered) {
      options.cacheStrategy = 'force-cache';
      options.maxRetries = 1; // Minimize data usage
    }

    return options;
  }

  /**
   * Get network statistics
   */
  getStats(): {
    failedUrlCount: number;
    cachedRequestCount: number;
    connectionQuality: ConnectionQuality | null;
    averageRetryDelay: number;
  } {
    const retryDelays = Array.from(this.retryDelays.values());
    const averageRetryDelay = retryDelays.length > 0 
      ? retryDelays.reduce((sum, delay) => sum + delay, 0) / retryDelays.length 
      : 0;

    return {
      failedUrlCount: this.failedUrls.size,
      cachedRequestCount: this.requestCache.size,
      connectionQuality: this.connectionQuality,
      averageRetryDelay
    };
  }

  /**
   * Clear caches and reset state
   */
  cleanup(): void {
    this.requestCache.clear();
    this.failedUrls.clear();
    this.retryDelays.clear();
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Global network manager instance
 */
export const expressionNetworkManager = new ExpressionNetworkManager();