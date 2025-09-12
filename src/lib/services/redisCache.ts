// src/lib/services/redisCache.ts
// Redis integration for distributed caching in hybrid retrieval system

import { createHash } from 'crypto';

/**
 * Redis cache configuration
 */
export interface RedisCacheConfig {
  url: string;
  keyPrefix: string;
  defaultTTL: number; // seconds
  maxRetries: number;
  retryDelayMs: number;
  connectionTimeout: number;
  commandTimeout: number;
  enableCompression: boolean;
  maxKeyLength: number;
}

/**
 * Redis cache statistics
 */
export interface RedisCacheStats {
  connected: boolean;
  hits: number;
  misses: number;
  errors: number;
  hitRate: number;
  missRate: number;
  errorRate: number;
  averageResponseTimeMs: number;
  totalKeys: number;
  memoryUsageMB: number;
  lastError?: string;
  connectionUptime: number;
}

/**
 * Redis cache implementation with connection management and error handling
 */
export class RedisCache {
  private client: any = null;
  private config: RedisCacheConfig;
  private connected = false;
  private connectionAttempts = 0;
  private lastConnectionAttempt = 0;
  private connectionStartTime = 0;
  
  // Statistics
  private hits = 0;
  private misses = 0;
  private errors = 0;
  private responseTimes: number[] = [];
  private lastError?: string;

  constructor(config: RedisCacheConfig) {
    this.config = config;
    this.initializeConnection();
  }

  /**
   * Initialize Redis connection with retry logic
   */
  private async initializeConnection(): Promise<void> {
    try {
      // Check if Redis is available in the environment
      if (!this.isRedisAvailable()) {
        console.warn('redis_not_available', {
          message: 'Redis client not found in dependencies, distributed caching disabled'
        });
        return;
      }

      // Dynamic import of Redis client
      const Redis = await this.importRedisClient();
      if (!Redis) {
        console.warn('redis_import_failed', {
          message: 'Could not import Redis client'
        });
        return;
      }

      this.client = new Redis(this.config.url, {
        retryDelayOnFailover: this.config.retryDelayMs,
        maxRetriesPerRequest: this.config.maxRetries,
        connectTimeout: this.config.connectionTimeout,
        commandTimeout: this.config.commandTimeout,
        lazyConnect: true
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Attempt connection
      await this.client.connect();
      this.connected = true;
      this.connectionStartTime = Date.now();

      console.log('redis_connected', {
        url: this.maskUrl(this.config.url),
        prefix: this.config.keyPrefix,
        ttl: this.config.defaultTTL
      });

    } catch (error) {
      this.handleConnectionError(error);
    }
  }

  /**
   * Check if Redis client is available in the environment
   */
  private isRedisAvailable(): boolean {
    try {
      require.resolve('ioredis');
      return true;
    } catch {
      try {
        require.resolve('redis');
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Dynamically import Redis client
   */
  private async importRedisClient(): Promise<any> {
    try {
      // Try ioredis first (more feature-rich)
      const { default: Redis } = await import('ioredis');
      return Redis;
    } catch {
      try {
        // Fallback to redis client
        const { createClient } = await import('redis');
        return createClient;
      } catch {
        return null;
      }
    }
  }

  /**
   * Set up Redis event handlers
   */
  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      console.log('redis_event_connect');
      this.connected = true;
      this.connectionAttempts = 0;
    });

    this.client.on('ready', () => {
      console.log('redis_event_ready');
    });

    this.client.on('error', (error: Error) => {
      console.error('redis_event_error', {
        error: error.message,
        code: (error as any).code
      });
      this.handleConnectionError(error);
    });

    this.client.on('close', () => {
      console.warn('redis_event_close');
      this.connected = false;
    });

    this.client.on('reconnecting', () => {
      console.log('redis_event_reconnecting', {
        attempt: this.connectionAttempts + 1
      });
      this.connectionAttempts++;
    });
  }

  /**
   * Handle connection errors with exponential backoff
   */
  private handleConnectionError(error: any): void {
    this.connected = false;
    this.errors++;
    this.lastError = error.message;

    const now = Date.now();
    const timeSinceLastAttempt = now - this.lastConnectionAttempt;
    const backoffDelay = Math.min(1000 * Math.pow(2, this.connectionAttempts), 30000);

    console.error('redis_connection_error', {
      error: error.message,
      attempt: this.connectionAttempts + 1,
      next_retry_ms: backoffDelay,
      time_since_last_attempt_ms: timeSinceLastAttempt
    });

    this.lastConnectionAttempt = now;

    // Schedule reconnection attempt
    setTimeout(() => {
      if (!this.connected && this.connectionAttempts < this.config.maxRetries) {
        this.initializeConnection();
      }
    }, backoffDelay);
  }

  /**
   * Get value from Redis with error handling and metrics
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected()) {
      this.misses++;
      return null;
    }

    const startTime = Date.now();
    const fullKey = this.buildKey(key);

    try {
      const value = await this.client.get(fullKey);
      const responseTime = Date.now() - startTime;
      this.recordResponseTime(responseTime);

      if (value !== null) {
        this.hits++;
        const parsed = this.config.enableCompression ? 
          this.decompress(value) : JSON.parse(value);
        return parsed;
      } else {
        this.misses++;
        return null;
      }

    } catch (error) {
      this.errors++;
      this.lastError = error instanceof Error ? error.message : String(error);
      
      console.warn('redis_get_error', {
        key: fullKey,
        error: this.lastError,
        response_time_ms: Date.now() - startTime
      });

      this.misses++;
      return null;
    }
  }

  /**
   * Set value in Redis with TTL and compression
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    if (!this.isConnected()) {
      return false;
    }

    const startTime = Date.now();
    const fullKey = this.buildKey(key);
    const effectiveTTL = ttl || this.config.defaultTTL;

    try {
      const serialized = this.config.enableCompression ? 
        this.compress(value) : JSON.stringify(value);

      const result = await this.client.setex(fullKey, effectiveTTL, serialized);
      const responseTime = Date.now() - startTime;
      this.recordResponseTime(responseTime);

      return result === 'OK';

    } catch (error) {
      this.errors++;
      this.lastError = error instanceof Error ? error.message : String(error);
      
      console.warn('redis_set_error', {
        key: fullKey,
        ttl: effectiveTTL,
        error: this.lastError,
        response_time_ms: Date.now() - startTime
      });

      return false;
    }
  }

  /**
   * Delete key from Redis
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isConnected()) {
      return false;
    }

    const startTime = Date.now();
    const fullKey = this.buildKey(key);

    try {
      const result = await this.client.del(fullKey);
      const responseTime = Date.now() - startTime;
      this.recordResponseTime(responseTime);

      return result > 0;

    } catch (error) {
      this.errors++;
      this.lastError = error instanceof Error ? error.message : String(error);
      
      console.warn('redis_delete_error', {
        key: fullKey,
        error: this.lastError,
        response_time_ms: Date.now() - startTime
      });

      return false;
    }
  }

  /**
   * Check if key exists in Redis
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isConnected()) {
      return false;
    }

    const fullKey = this.buildKey(key);

    try {
      const result = await this.client.exists(fullKey);
      return result > 0;

    } catch (error) {
      console.warn('redis_exists_error', {
        key: fullKey,
        error: error instanceof Error ? error.message : error
      });
      return false;
    }
  }

  /**
   * Get multiple values at once (batch operation)
   */
  async getBatch<T>(keys: string[]): Promise<Map<string, T>> {
    if (!this.isConnected() || keys.length === 0) {
      return new Map();
    }

    const startTime = Date.now();
    const fullKeys = keys.map(key => this.buildKey(key));
    const results = new Map<string, T>();

    try {
      const values = await this.client.mget(...fullKeys);
      const responseTime = Date.now() - startTime;
      this.recordResponseTime(responseTime);

      for (let i = 0; i < keys.length; i++) {
        const value = values[i];
        if (value !== null) {
          try {
            const parsed = this.config.enableCompression ? 
              this.decompress(value) : JSON.parse(value);
            results.set(keys[i], parsed);
            this.hits++;
          } catch (parseError) {
            console.warn('redis_batch_parse_error', {
              key: keys[i],
              error: parseError instanceof Error ? parseError.message : parseError
            });
            this.misses++;
          }
        } else {
          this.misses++;
        }
      }

      return results;

    } catch (error) {
      this.errors++;
      this.lastError = error instanceof Error ? error.message : String(error);
      
      console.warn('redis_batch_get_error', {
        key_count: keys.length,
        error: this.lastError,
        response_time_ms: Date.now() - startTime
      });

      // Record all as misses
      this.misses += keys.length;
      return new Map();
    }
  }

  /**
   * Set multiple values at once (batch operation)
   */
  async setBatch<T>(entries: Map<string, T>, ttl?: number): Promise<number> {
    if (!this.isConnected() || entries.size === 0) {
      return 0;
    }

    const startTime = Date.now();
    const effectiveTTL = ttl || this.config.defaultTTL;
    let successCount = 0;

    try {
      // Use pipeline for batch operations
      const pipeline = this.client.pipeline();

      for (const [key, value] of entries.entries()) {
        try {
          const fullKey = this.buildKey(key);
          const serialized = this.config.enableCompression ? 
            this.compress(value) : JSON.stringify(value);
          
          pipeline.setex(fullKey, effectiveTTL, serialized);
        } catch (serializeError) {
          console.warn('redis_batch_serialize_error', {
            key,
            error: serializeError instanceof Error ? serializeError.message : serializeError
          });
        }
      }

      const results = await pipeline.exec();
      const responseTime = Date.now() - startTime;
      this.recordResponseTime(responseTime);

      // Count successful operations
      if (results) {
        successCount = results.filter(([error, result]) => !error && result === 'OK').length;
      }

      console.log('redis_batch_set_complete', {
        total_entries: entries.size,
        successful: successCount,
        failed: entries.size - successCount,
        response_time_ms: responseTime
      });

      return successCount;

    } catch (error) {
      this.errors++;
      this.lastError = error instanceof Error ? error.message : String(error);
      
      console.warn('redis_batch_set_error', {
        entry_count: entries.size,
        error: this.lastError,
        response_time_ms: Date.now() - startTime
      });

      return 0;
    }
  }

  /**
   * Clear all keys with the configured prefix
   */
  async clear(): Promise<number> {
    if (!this.isConnected()) {
      return 0;
    }

    const startTime = Date.now();

    try {
      const pattern = `${this.config.keyPrefix}*`;
      const keys = await this.client.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }

      const result = await this.client.del(...keys);
      const responseTime = Date.now() - startTime;
      this.recordResponseTime(responseTime);

      // Reset statistics
      this.hits = 0;
      this.misses = 0;
      this.errors = 0;
      this.responseTimes = [];

      console.log('redis_clear_complete', {
        keys_deleted: result,
        response_time_ms: responseTime
      });

      return result;

    } catch (error) {
      this.errors++;
      this.lastError = error instanceof Error ? error.message : String(error);
      
      console.warn('redis_clear_error', {
        error: this.lastError,
        response_time_ms: Date.now() - startTime
      });

      return 0;
    }
  }

  /**
   * Get Redis server info and statistics
   */
  async getStats(): Promise<RedisCacheStats> {
    const totalRequests = this.hits + this.misses;
    const totalOperations = totalRequests + this.errors;
    
    let memoryUsageMB = 0;
    let totalKeys = 0;

    if (this.isConnected()) {
      try {
        const info = await this.client.info('memory');
        const memoryMatch = info.match(/used_memory:(\d+)/);
        if (memoryMatch) {
          memoryUsageMB = Math.round(parseInt(memoryMatch[1]) / 1024 / 1024);
        }

        const dbInfo = await this.client.info('keyspace');
        const keyMatch = dbInfo.match(/keys=(\d+)/);
        if (keyMatch) {
          totalKeys = parseInt(keyMatch[1]);
        }
      } catch (error) {
        // Ignore errors when getting stats
      }
    }

    return {
      connected: this.connected,
      hits: this.hits,
      misses: this.misses,
      errors: this.errors,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.misses / totalRequests : 0,
      errorRate: totalOperations > 0 ? this.errors / totalOperations : 0,
      averageResponseTimeMs: this.calculateAverageResponseTime(),
      totalKeys,
      memoryUsageMB,
      lastError: this.lastError,
      connectionUptime: this.connected ? Date.now() - this.connectionStartTime : 0
    };
  }

  /**
   * Health check for monitoring
   */
  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    if (!this.isConnected()) {
      return {
        healthy: false,
        latencyMs: 0,
        error: 'Not connected to Redis'
      };
    }

    const startTime = Date.now();

    try {
      await this.client.ping();
      const latencyMs = Date.now() - startTime;

      return {
        healthy: true,
        latencyMs
      };

    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Check if Redis is connected and ready
   */
  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  /**
   * Gracefully disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        console.log('redis_disconnected');
      } catch (error) {
        console.warn('redis_disconnect_error', {
          error: error instanceof Error ? error.message : error
        });
      } finally {
        this.client = null;
        this.connected = false;
      }
    }
  }

  // Private helper methods

  private buildKey(key: string): string {
    const hashedKey = key.length > this.config.maxKeyLength ? 
      createHash('sha256').update(key).digest('hex').substring(0, 32) : key;
    
    return `${this.config.keyPrefix}${hashedKey}`;
  }

  private compress(value: any): string {
    // Simple compression using JSON + base64
    // In production, you might want to use a proper compression library
    const json = JSON.stringify(value);
    return Buffer.from(json).toString('base64');
  }

  private decompress(compressed: string): any {
    try {
      const json = Buffer.from(compressed, 'base64').toString('utf-8');
      return JSON.parse(json);
    } catch (error) {
      // Fallback to direct JSON parsing (for backwards compatibility)
      return JSON.parse(compressed);
    }
  }

  private recordResponseTime(timeMs: number): void {
    this.responseTimes.push(timeMs);
    
    // Keep only last 1000 response times for memory efficiency
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }
  }

  private calculateAverageResponseTime(): number {
    if (this.responseTimes.length === 0) {
      return 0;
    }

    const sum = this.responseTimes.reduce((acc, time) => acc + time, 0);
    return Math.round(sum / this.responseTimes.length);
  }

  private maskUrl(url: string): string {
    try {
      const parsed = new URL(url);
      if (parsed.password) {
        parsed.password = '***';
      }
      return parsed.toString();
    } catch {
      return 'redis://***';
    }
  }
}

/**
 * Factory function to create Redis cache with environment configuration
 */
export function createRedisCache(): RedisCache | null {
  const redisUrl = process.env.CACHE_REDIS_URL;
  
  if (!redisUrl) {
    console.log('redis_cache_disabled', { reason: 'CACHE_REDIS_URL not configured' });
    return null;
  }

  const config: RedisCacheConfig = {
    url: redisUrl,
    keyPrefix: process.env.CACHE_REDIS_PREFIX || 'hybrid-retrieval:',
    defaultTTL: parseInt(process.env.CACHE_REDIS_TTL_HOURS || '24') * 60 * 60,
    maxRetries: parseInt(process.env.CACHE_REDIS_MAX_RETRIES || '3'),
    retryDelayMs: parseInt(process.env.CACHE_REDIS_RETRY_DELAY_MS || '1000'),
    connectionTimeout: parseInt(process.env.CACHE_REDIS_CONNECTION_TIMEOUT_MS || '5000'),
    commandTimeout: parseInt(process.env.CACHE_REDIS_COMMAND_TIMEOUT_MS || '2000'),
    enableCompression: process.env.CACHE_REDIS_COMPRESSION?.toLowerCase() === 'true',
    maxKeyLength: parseInt(process.env.CACHE_REDIS_MAX_KEY_LENGTH || '250')
  };

  return new RedisCache(config);
}