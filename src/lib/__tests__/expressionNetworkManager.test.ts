/**
 * Expression Network Manager Tests
 * 
 * Tests for network resilience and graceful degradation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExpressionNetworkManager } from '../expressionNetworkManager';
import { PlaybackContext } from '../expressionErrorHandler';

// Mock dependencies
vi.mock('../logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../expressionMetrics', () => ({
  expressionMetrics: {
    cacheHitRate: { inc: vi.fn() },
    networkRetrySuccess: { inc: vi.fn() }
  }
}));

vi.mock('../expressionErrorHandler', () => ({
  ExpressionErrorHandler: vi.fn().mockImplementation(() => ({
    createError: vi.fn(),
    handleExpressionFailure: vi.fn()
  })),
  ExpressionErrorType: {
    NETWORK_ERROR: 'NETWORK_ERROR',
    BUFFER_NOT_READY: 'BUFFER_NOT_READY',
    AUDIO_CONTEXT_ERROR: 'AUDIO_CONTEXT_ERROR',
    DECODE_ERROR: 'DECODE_ERROR',
    PLAYBACK_ERROR: 'PLAYBACK_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    FEATURE_DISABLED: 'FEATURE_DISABLED',
    PRIVACY_BLOCKED: 'PRIVACY_BLOCKED',
    DURATION_EXCEEDED: 'DURATION_EXCEEDED',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
  },
  ExpressionErrorStage: {
    INITIALIZATION: 'INITIALIZATION',
    LOADING: 'LOADING',
    PRELOADING: 'PRELOADING',
    SCHEDULING: 'SCHEDULING',
    PLAYBACK: 'PLAYBACK',
    MIXING: 'MIXING',
    CLEANUP: 'CLEANUP'
  }
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock AbortSignal.timeout
global.AbortSignal = {
  timeout: vi.fn().mockImplementation((ms) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  })
} as any;

describe('ExpressionNetworkManager', () => {
  let networkManager: ExpressionNetworkManager;
  let mockContext: PlaybackContext;

  beforeEach(() => {
    networkManager = new ExpressionNetworkManager();
    mockContext = {
      sessionId: 'test-session',
      ownerId: 'test-user',
      ownerType: 'user',
      skipExpressions: false,
      disabledExpressions: new Set(),
      temporaryDisableUntil: 0,
      isExpressionsEnabled: true,
      removeExpression: vi.fn(),
      disableExpressions: vi.fn(),
      temporaryDisable: vi.fn()
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    networkManager.cleanup();
  });

  describe('loadExpressionAudio', () => {
    it('should successfully load audio on first attempt', async () => {
      const mockArrayBuffer = new ArrayBuffer(1024);
      const mockResponse = {
        ok: true,
        status: 200,
        arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
        clone: vi.fn().mockReturnThis(),
        headers: new Headers()
      };
      
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await networkManager.loadExpressionAudio(
        'https://example.com/test.mp3',
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe(mockArrayBuffer);
      expect(result.retryCount).toBe(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on network failures', async () => {
      const mockArrayBuffer = new ArrayBuffer(1024);
      const mockResponse = {
        ok: true,
        status: 200,
        arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
        clone: vi.fn().mockReturnThis(),
        headers: new Headers()
      };

      // Fail first two attempts, succeed on third
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockResponse);

      const result = await networkManager.loadExpressionAudio(
        'https://example.com/test.mp3',
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe(mockArrayBuffer);
      expect(result.retryCount).toBe(2);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries exceeded', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent network error'));

      const result = await networkManager.loadExpressionAudio(
        'https://example.com/test.mp3',
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.retryCount).toBe(3);
      expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should not retry on 404 errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('HTTP 404'));

      const result = await networkManager.loadExpressionAudio(
        'https://example.com/test.mp3',
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.retryCount).toBe(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle HTTP error responses', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      };
      
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await networkManager.loadExpressionAudio(
        'https://example.com/test.mp3',
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('HTTP 500');
    });

    it('should detect cache hits', async () => {
      const mockArrayBuffer = new ArrayBuffer(1024);
      const headers = new Headers();
      headers.set('age', '300'); // Indicates cached response
      
      const mockResponse = {
        ok: true,
        status: 200,
        arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
        clone: vi.fn().mockReturnThis(),
        headers
      };
      
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await networkManager.loadExpressionAudio(
        'https://example.com/test.mp3',
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.cacheHit).toBe(true);
    });

    it('should skip recently failed URLs', async () => {
      // First request fails
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      const result1 = await networkManager.loadExpressionAudio(
        'https://example.com/failed.mp3',
        mockContext
      );
      expect(result1.success).toBe(false);

      // Second request to same URL should be skipped
      const result2 = await networkManager.loadExpressionAudio(
        'https://example.com/failed.mp3',
        mockContext
      );
      
      expect(result2.success).toBe(false);
      expect(result2.error?.message).toBe('URL recently failed');
      expect(result2.totalTime).toBe(0);
    });

    it('should use request cache to avoid duplicate fetches', async () => {
      const mockArrayBuffer = new ArrayBuffer(1024);
      const mockResponse = {
        ok: true,
        status: 200,
        arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
        clone: vi.fn().mockReturnThis(),
        headers: new Headers()
      };
      
      mockFetch.mockResolvedValue(mockResponse);

      // Start two concurrent requests for the same URL
      const [result1, result2] = await Promise.all([
        networkManager.loadExpressionAudio('https://example.com/test.mp3', mockContext),
        networkManager.loadExpressionAudio('https://example.com/test.mp3', mockContext)
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result2.cacheHit).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only one actual fetch
    });
  });

  describe('preloadExpressions', () => {
    it('should preload multiple expressions with concurrency control', async () => {
      const mockArrayBuffer = new ArrayBuffer(1024);
      const mockResponse = {
        ok: true,
        status: 200,
        arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
        clone: vi.fn().mockReturnThis(),
        headers: new Headers()
      };
      
      mockFetch.mockResolvedValue(mockResponse);

      const urls = [
        'https://example.com/expr1.mp3',
        'https://example.com/expr2.mp3',
        'https://example.com/expr3.mp3'
      ];

      const results = await networkManager.preloadExpressions(urls, mockContext, 2);

      expect(results.size).toBe(3);
      expect(results.get(urls[0])).toBe(mockArrayBuffer);
      expect(results.get(urls[1])).toBe(mockArrayBuffer);
      expect(results.get(urls[2])).toBe(mockArrayBuffer);
    });

    it('should handle partial failures in batch preloading', async () => {
      const mockArrayBuffer = new ArrayBuffer(1024);
      const mockResponse = {
        ok: true,
        status: 200,
        arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
        clone: vi.fn().mockReturnThis(),
        headers: new Headers()
      };

      // First URL succeeds, second fails, third succeeds
      mockFetch
        .mockResolvedValueOnce(mockResponse)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockResponse);

      const urls = [
        'https://example.com/expr1.mp3',
        'https://example.com/expr2.mp3',
        'https://example.com/expr3.mp3'
      ];

      const results = await networkManager.preloadExpressions(urls, mockContext);

      expect(results.size).toBe(2); // Only successful loads
      expect(results.has(urls[0])).toBe(true);
      expect(results.has(urls[1])).toBe(false);
      expect(results.has(urls[2])).toBe(true);
    });
  });

  describe('adaptive options', () => {
    it('should return adaptive options based on connection quality', () => {
      // Mock slow connection
      (networkManager as any).connectionQuality = {
        bandwidth: 0.5,
        latency: 500,
        connectionType: 'slow-2g',
        isMetered: true
      };

      const options = networkManager.getAdaptiveOptions();

      expect(options.timeout).toBe(20000); // Longer timeout for slow connection
      expect(options.maxRetries).toBe(1); // Fewer retries on slow connection
      expect(options.cacheStrategy).toBe('force-cache'); // Aggressive caching on metered
    });

    it('should return default options for unknown connection', () => {
      (networkManager as any).connectionQuality = null;

      const options = networkManager.getAdaptiveOptions();

      expect(Object.keys(options)).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return network statistics', async () => {
      // Cause a failure to populate failed URLs
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      await networkManager.loadExpressionAudio(
        'https://example.com/failed.mp3',
        mockContext
      );

      const stats = networkManager.getStats();

      expect(stats.failedUrlCount).toBe(1);
      expect(stats.cachedRequestCount).toBe(0);
      expect(stats.connectionQuality).toBeDefined();
      expect(stats.averageRetryDelay).toBeTypeOf('number');
    });
  });

  describe('cleanup', () => {
    it('should clear all caches and state', async () => {
      // Add some state
      mockFetch.mockRejectedValue(new Error('Network error'));
      await networkManager.loadExpressionAudio('https://example.com/test.mp3', mockContext);

      let stats = networkManager.getStats();
      expect(stats.failedUrlCount).toBe(1);

      networkManager.cleanup();

      stats = networkManager.getStats();
      expect(stats.failedUrlCount).toBe(0);
      expect(stats.cachedRequestCount).toBe(0);
    });
  });

  describe('custom options', () => {
    it('should use custom network options', async () => {
      const customManager = new ExpressionNetworkManager({
        maxRetries: 1,
        timeout: 5000,
        cacheStrategy: 'no-cache'
      });

      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await customManager.loadExpressionAudio(
        'https://example.com/test.mp3',
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.retryCount).toBe(1); // Custom max retries
      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });
});