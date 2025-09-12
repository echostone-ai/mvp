/**
 * Retry Service with Exponential Backoff
 * Provides automatic retry logic for voice synthesis and other operations
 */

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterMs: number;
}

export interface RetryStats {
  attempt: number;
  totalAttempts: number;
  lastError?: Error;
  nextRetryDelayMs?: number;
}

export class RetryService {
  private readonly config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxAttempts: 3,
      baseDelayMs: 1000, // Start with 1 second
      maxDelayMs: 10000, // Cap at 10 seconds
      backoffMultiplier: 2, // Double each time
      jitterMs: 100, // Add randomness
      ...config
    };
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    shouldRetry?: (error: any) => boolean
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry if we're on the last attempt
        if (attempt === this.config.maxAttempts) {
          break;
        }
        
        // Check if we should retry this error
        if (shouldRetry && !shouldRetry(error)) {
          break;
        }
        
        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs);
    const jitter = Math.random() * this.config.jitterMs;
    
    return cappedDelay + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Predefined retry conditions for common scenarios
  static shouldRetryVoiceSynthesis(error: any): boolean {
    if (!error) return false;
    
    // Retry on temporary server errors
    if (error.status >= 500 && error.status < 600) return true;
    
    // Retry on timeout
    if (error.code === 'TIMEOUT' || error.message?.includes('timeout')) return true;
    
    // Retry on rate limiting (429)
    if (error.status === 429) return true;
    
    // Retry on network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') return true;
    
    // Don't retry on client errors (4xx except 429)
    if (error.status >= 400 && error.status < 500 && error.status !== 429) return false;
    
    return true;
  }

  static shouldRetryMemoryService(error: any): boolean {
    if (!error) return false;
    
    // Retry on database connection issues
    if (error.code === 'PGRST301' || error.message?.includes('connection')) return true;
    
    // Retry on temporary server errors
    if (error.status >= 500 && error.status < 600) return true;
    
    // Retry on timeout
    if (error.code === 'TIMEOUT' || error.message?.includes('timeout')) return true;
    
    return false;
  }
}

// Global retry service instances
export const voiceSynthesisRetry = new RetryService({
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
  backoffMultiplier: 2,
  jitterMs: 200
});

export const memoryServiceRetry = new RetryService({
  maxAttempts: 2, // Fewer retries for memory to avoid blocking
  baseDelayMs: 500,
  maxDelayMs: 2000,
  backoffMultiplier: 2,
  jitterMs: 100
});