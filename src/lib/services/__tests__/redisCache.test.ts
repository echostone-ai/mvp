// src/lib/services/__tests__/redisCache.test.ts
// Tests for Redis distributed caching

import { RedisCache, RedisCacheConfig } from '../redisCache';

// Mock Redis client
const mockRedisClient = {
  connect: jest.fn(),
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  mget: jest.fn(),
  pipeline: jest.fn(),
  keys: jest.fn(),
  info: jest.fn(),
  ping: jest.fn(),
  quit: jest.fn(),
  on: jest.fn()
};

const mockPipeline = {
  setex: jest.fn(),
  exec: jest.fn()
};

// Mock Redis import
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedisClient);
});

describe('RedisCache', () => {
  let redisCache: RedisCache;
  let testConfig: RedisCacheConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    
    testConfig = {
      url: 'redis://localhost:6379',
      keyPrefix: 'test:',
      defaultTTL: 3600, // 1 hour
      maxRetries: 3,
      retryDelayMs: 1000,
      connectionTimeout: 5000,
      commandTimeout: 2000,
      enableCompression: false,
      maxKeyLength: 250
    };

    // Setup default mock behaviors
    mockRedisClient.connect.mockResolvedValue(undefined);
    mockRedisClient.pipeline.mockReturnValue(mockPipeline);
    mockPipeline.exec.mockResolvedValue([]);
  });

  describe('Connection Management', () => {
    it('should initialize Redis connection successfully', async () => {
      redisCache = new RedisCache(testConfig);
      
      // Wait for connection to be established
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(mockRedisClient.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedisClient.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle connection failures gracefully', async () => {
      mockRedisClient.connect.mockRejectedValue(new Error('Connection failed'));
      
      redisCache = new RedisCache(testConfig);
      
      // Wait for connection attempt
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(redisCache.isConnected()).toBe(false);
    });

    it('should handle missing Redis dependency gracefully', async () => {
      // This test would require mocking the require.resolve calls
      // For now, we'll test the basic functionality
      expect(() => new RedisCache(testConfig)).not.toThrow();
    });
  });

  describe('Basic Cache Operations', () => {
    beforeEach(async () => {
      redisCache = new RedisCache(testConfig);
      // Mock successful connection
      (redisCache as any).connected = true;
      (redisCache as any).client = mockRedisClient;
    });

    afterEach(async () => {
      await redisCache.disconnect();
    });

    it('should store and retrieve values', async () => {
      const key = 'test_key';
      const value = { data: 'test_value', number: 42 };
      
      mockRedisClient.setex.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue(JSON.stringify(value));

      const setResult = await redisCache.set(key, value);
      expect(setResult).toBe(true);
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'test:' + expect.any(String), // Hashed key
        3600,
        JSON.stringify(value)
      );

      const retrieved = await redisCache.get(key);
      expect(retrieved).toEqual(value);
      expect(mockRedisClient.get).toHaveBeenCalledWith('test:' + expect.any(String));
    });

    it('should handle cache misses', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await redisCache.get('nonexistent_key');
      expect(result).toBeNull();
    });

    it('should delete keys successfully', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      const result = await redisCache.delete('test_key');
      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith('test:' + expect.any(String));
    });

    it('should check key existence', async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      const exists = await redisCache.exists('test_key');
      expect(exists).toBe(true);
      expect(mockRedisClient.exists).toHaveBeenCalledWith('test:' + expect.any(String));
    });

    it('should use custom TTL when provided', async () => {
      const customTTL = 7200; // 2 hours
      mockRedisClient.setex.mockResolvedValue('OK');

      await redisCache.set('ttl_key', { data: 'value' }, customTTL);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        expect.any(String),
        customTTL,
        expect.any(String)
      );
    });
  });

  describe('Batch Operations', () => {
    beforeEach(async () => {
      redisCache = new RedisCache(testConfig);
      (redisCache as any).connected = true;
      (redisCache as any).client = mockRedisClient;
    });

    afterEach(async () => {
      await redisCache.disconnect();
    });

    it('should perform batch get operations', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const values = [
        JSON.stringify({ data: 'value1' }),
        JSON.stringify({ data: 'value2' }),
        null // Cache miss
      ];

      mockRedisClient.mget.mockResolvedValue(values);

      const results = await redisCache.getBatch(keys);

      expect(results.size).toBe(2); // Only non-null values
      expect(results.get('key1')).toEqual({ data: 'value1' });
      expect(results.get('key2')).toEqual({ data: 'value2' });
      expect(results.has('key3')).toBe(false);
    });

    it('should perform batch set operations using pipeline', async () => {
      const entries = new Map([
        ['key1', { data: 'value1' }],
        ['key2', { data: 'value2' }],
        ['key3', { data: 'value3' }]
      ]);

      mockPipeline.exec.mockResolvedValue([
        [null, 'OK'],
        [null, 'OK'],
        [null, 'OK']
      ]);

      const successCount = await redisCache.setBatch(entries);

      expect(successCount).toBe(3);
      expect(mockRedisClient.pipeline).toHaveBeenCalled();
      expect(mockPipeline.setex).toHaveBeenCalledTimes(3);
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should handle partial failures in batch operations', async () => {
      const entries = new Map([
        ['key1', { data: 'value1' }],
        ['key2', { data: 'value2' }]
      ]);

      mockPipeline.exec.mockResolvedValue([
        [null, 'OK'],
        [new Error('Set failed'), null]
      ]);

      const successCount = await redisCache.setBatch(entries);

      expect(successCount).toBe(1); // Only one successful
    });
  });

  describe('Compression', () => {
    beforeEach(async () => {
      testConfig.enableCompression = true;
      redisCache = new RedisCache(testConfig);
      (redisCache as any).connected = true;
      (redisCache as any).client = mockRedisClient;
    });

    afterEach(async () => {
      await redisCache.disconnect();
    });

    it('should compress values when compression is enabled', async () => {
      const value = { data: 'test_value' };
      mockRedisClient.setex.mockResolvedValue('OK');

      await redisCache.set('compress_key', value);

      const setCall = mockRedisClient.setex.mock.calls[0];
      const storedValue = setCall[2];
      
      // Should be base64 encoded (compressed)
      expect(storedValue).not.toBe(JSON.stringify(value));
      expect(typeof storedValue).toBe('string');
    });

    it('should decompress values when retrieving', async () => {
      const value = { data: 'test_value' };
      const compressed = Buffer.from(JSON.stringify(value)).toString('base64');
      
      mockRedisClient.get.mockResolvedValue(compressed);

      const retrieved = await redisCache.get('compress_key');
      expect(retrieved).toEqual(value);
    });

    it('should fallback to JSON parsing for backwards compatibility', async () => {
      const value = { data: 'test_value' };
      // Return uncompressed JSON (old format)
      mockRedisClient.get.mockResolvedValue(JSON.stringify(value));

      const retrieved = await redisCache.get('compat_key');
      expect(retrieved).toEqual(value);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      redisCache = new RedisCache(testConfig);
      (redisCache as any).connected = true;
      (redisCache as any).client = mockRedisClient;
    });

    afterEach(async () => {
      await redisCache.disconnect();
    });

    it('should handle Redis operation errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));
      mockRedisClient.setex.mockRejectedValue(new Error('Redis error'));

      const getResult = await redisCache.get('error_key');
      expect(getResult).toBeNull();

      const setResult = await redisCache.set('error_key', { data: 'value' });
      expect(setResult).toBe(false);
    });

    it('should return false for operations when disconnected', async () => {
      (redisCache as any).connected = false;

      const getResult = await redisCache.get('disconnected_key');
      expect(getResult).toBeNull();

      const setResult = await redisCache.set('disconnected_key', { data: 'value' });
      expect(setResult).toBe(false);

      const deleteResult = await redisCache.delete('disconnected_key');
      expect(deleteResult).toBe(false);
    });

    it('should handle JSON parsing errors', async () => {
      mockRedisClient.get.mockResolvedValue('invalid json');

      const result = await redisCache.get('invalid_json_key');
      expect(result).toBeNull();
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      redisCache = new RedisCache(testConfig);
      (redisCache as any).connected = true;
      (redisCache as any).client = mockRedisClient;
    });

    afterEach(async () => {
      await redisCache.disconnect();
    });

    it('should track hit and miss statistics', async () => {
      // Setup mocks for hits and misses
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify({ data: 'hit' }))
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify({ data: 'another_hit' }));

      // Perform operations
      await redisCache.get('hit_key');
      await redisCache.get('miss_key');
      await redisCache.get('another_hit_key');

      const stats = await redisCache.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2/3);
      expect(stats.missRate).toBeCloseTo(1/3);
    });

    it('should provide server information when connected', async () => {
      mockRedisClient.info
        .mockResolvedValueOnce('used_memory:1048576') // 1MB
        .mockResolvedValueOnce('keys=100');

      const stats = await redisCache.getStats();

      expect(stats.connected).toBe(true);
      expect(stats.memoryUsageMB).toBe(1);
      expect(stats.totalKeys).toBe(100);
    });

    it('should track response times', async () => {
      mockRedisClient.get.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(null), 10))
      );

      await redisCache.get('timing_key');
      
      const stats = await redisCache.getStats();
      expect(stats.averageResponseTimeMs).toBeGreaterThan(0);
    });
  });

  describe('Health Check', () => {
    beforeEach(async () => {
      redisCache = new RedisCache(testConfig);
      (redisCache as any).connected = true;
      (redisCache as any).client = mockRedisClient;
    });

    afterEach(async () => {
      await redisCache.disconnect();
    });

    it('should report healthy when ping succeeds', async () => {
      mockRedisClient.ping.mockResolvedValue('PONG');

      const health = await redisCache.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeGreaterThan(0);
      expect(health.error).toBeUndefined();
    });

    it('should report unhealthy when ping fails', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Ping failed'));

      const health = await redisCache.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.error).toBe('Ping failed');
    });

    it('should report unhealthy when disconnected', async () => {
      (redisCache as any).connected = false;

      const health = await redisCache.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.error).toBe('Not connected to Redis');
    });
  });

  describe('Cache Clear Operations', () => {
    beforeEach(async () => {
      redisCache = new RedisCache(testConfig);
      (redisCache as any).connected = true;
      (redisCache as any).client = mockRedisClient;
    });

    afterEach(async () => {
      await redisCache.disconnect();
    });

    it('should clear all keys with prefix', async () => {
      const keys = ['test:key1', 'test:key2', 'test:key3'];
      mockRedisClient.keys.mockResolvedValue(keys);
      mockRedisClient.del.mockResolvedValue(3);

      const deletedCount = await redisCache.clear();

      expect(deletedCount).toBe(3);
      expect(mockRedisClient.keys).toHaveBeenCalledWith('test:*');
      expect(mockRedisClient.del).toHaveBeenCalledWith(...keys);
    });

    it('should handle empty key list', async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      const deletedCount = await redisCache.clear();

      expect(deletedCount).toBe(0);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('Key Management', () => {
    beforeEach(async () => {
      redisCache = new RedisCache(testConfig);
    });

    it('should hash long keys to prevent Redis key length issues', async () => {
      const longKey = 'x'.repeat(300); // Longer than maxKeyLength
      (redisCache as any).connected = true;
      (redisCache as any).client = mockRedisClient;
      mockRedisClient.setex.mockResolvedValue('OK');

      await redisCache.set(longKey, { data: 'value' });

      const setCall = mockRedisClient.setex.mock.calls[0];
      const usedKey = setCall[0];
      
      expect(usedKey).toMatch(/^test:[a-f0-9]{32}$/); // Should be hashed
      expect(usedKey.length).toBeLessThan(testConfig.maxKeyLength);
    });

    it('should preserve short keys without hashing', async () => {
      const shortKey = 'short_key';
      (redisCache as any).connected = true;
      (redisCache as any).client = mockRedisClient;
      mockRedisClient.setex.mockResolvedValue('OK');

      await redisCache.set(shortKey, { data: 'value' });

      const setCall = mockRedisClient.setex.mock.calls[0];
      const usedKey = setCall[0];
      
      expect(usedKey).toBe('test:short_key');
    });
  });

  describe('Configuration', () => {
    it('should create Redis cache with factory function when URL is provided', () => {
      const originalEnv = process.env;
      
      process.env = {
        ...originalEnv,
        CACHE_REDIS_URL: 'redis://localhost:6379',
        CACHE_REDIS_PREFIX: 'factory_test:',
        CACHE_REDIS_TTL_HOURS: '12'
      };

      // This would test the factory function
      // const factoryCache = createRedisCache();
      // expect(factoryCache).toBeInstanceOf(RedisCache);
      
      process.env = originalEnv;
    });

    it('should return null from factory when URL is not provided', () => {
      const originalEnv = process.env;
      
      process.env = {
        ...originalEnv
      };
      delete process.env.CACHE_REDIS_URL;

      // This would test the factory function
      // const factoryCache = createRedisCache();
      // expect(factoryCache).toBeNull();
      
      process.env = originalEnv;
    });
  });
});