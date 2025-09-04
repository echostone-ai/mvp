/**
 * Circuit Breaker Service for ElevenLabs API
 * Implements circuit breaker pattern to handle service failures gracefully
 */

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  monitorWindowMs: number;
}

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: number;
  nextRetryTime?: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime?: number;
  private nextRetryTime?: number;
  private readonly config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: 5, // 5 failures trigger open state
      resetTimeoutMs: 30000, // 30 seconds before retry
      monitorWindowMs: 60000, // 1 minute monitoring window
      ...config
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new Error('Circuit breaker is OPEN - service temporarily unavailable');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.successes++;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextRetryTime = Date.now() + this.config.resetTimeoutMs;
    }
  }

  private shouldAttemptReset(): boolean {
    return this.nextRetryTime ? Date.now() >= this.nextRetryTime : false;
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      nextRetryTime: this.nextRetryTime
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = undefined;
    this.nextRetryTime = undefined;
  }

  // Check if error should trigger circuit breaker
  static isCircuitBreakerError(error: any): boolean {
    if (!error) return false;
    
    // HTTP 5xx errors
    if (error.status >= 500 && error.status < 600) return true;
    
    // Timeout errors
    if (error.code === 'TIMEOUT' || error.message?.includes('timeout')) return true;
    
    // Network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') return true;
    
    return false;
  }
}

// Global circuit breaker instance for ElevenLabs
export const elevenLabsCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 30000, // 30 seconds as per requirements
  monitorWindowMs: 60000
});