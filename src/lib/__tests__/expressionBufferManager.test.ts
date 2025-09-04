/**
 * Tests for ExpressionBufferManager
 * Task 6: Expression preloading and buffer management
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { ExpressionBufferManager, getGlobalBufferManager, disposeGlobalBufferManager } from '../expressionBufferManager';
import { StoredExpression } from '../services/expressionStorageService';

// Mock dependencies
vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('../expressionMetrics', () => ({
  expressionMetrics: {
    errorCount: { inc: vi.fn() },
    bufferMemoryUsage: { set: vi.fn() }
  },
  expressionMetricsRecorder: {
    startPreload: vi.fn(),
    recordPreloadComplete: vi.fn()
  }
}));

vi.mock('../audioQualityValidator', () => ({
  globalAudioQualityValidator: {
    initialize: vi.fn().mockResolvedValue(true)
  },
  quickValidateAudio: vi.fn().mockResolvedValue({
    isValid: true,
    errors: []
  })
}));

// Mock Web Audio API
const mockAudioContext = {
  state: 'running',
  resume: vi.fn().mockResolvedValue(undefined),
  decodeAudioData: vi.fn()
};

const mockAudioBuffer = {
  duration: 1.0,
  sampleRate: 44100,
  numberOfChannels: 1,
  length: 44100
};

// Mock fetch
global.fetch = vi.fn();

// Mock AudioContext
(global as any).AudioContext = vi.fn(() => mockAudioContext);
(global as any).webkitAudioContext = vi.fn(() => mockAudioContext);

describe('ExpressionBufferManager', () => {
  let bufferManager: ExpressionBufferManager;
  let mockExpressions: StoredExpression[];

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset global buffer manager
    disposeGlobalBufferManager();
    
    bufferManager = new ExpressionBufferManager({
      maxBuffers: 10,
      maxMemoryBytes: 1024 * 1024, // 1MB
      enableValidation: true,
      loadTimeoutMs: 5000,
      maxConcurrentLoads: 3
    });
    
    // Initialize the buffer manager for most tests
    await bufferManager.initialize();

    mockExpressions = [
      {
        id: 'expr-1',
        ownerId: 'avatar-1',
        ownerType: 'avatar',
        filename: 'laugh.mp3',
        type: 'laugh',
        tone: 'cheerful',
        placementHints: ['funny'],
        durationMs: 800,
        priority: 75,
        status: 'active',
        cdnUrl: 'https://cdn.example.com/laugh.mp3',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'expr-2',
        ownerId: 'avatar-1',
        ownerType: 'avatar',
        filename: 'hmm.mp3',
        type: 'filler',
        tone: 'thoughtful',
        placementHints: ['thinking'],
        durationMs: 500,
        priority: 60,
        status: 'active',
        cdnUrl: 'https://cdn.example.com/hmm.mp3',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Setup successful fetch mock
    (fetch as Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    });

    // Setup successful audio decoding
    mockAudioContext.decodeAudioData.mockResolvedValue(mockAudioBuffer);
  });

  afterEach(() => {
    bufferManager?.dispose();
    disposeGlobalBufferManager();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const result = await bufferManager.initialize();
      expect(result).toBe(true);
    });

    it('should handle initialization failure gracefully', async () => {
      // Create a new buffer manager for this test to avoid affecting others
      const failingManager = new ExpressionBufferManager();
      
      // Mock AudioContext constructor to throw
      const originalAudioContext = (global as any).AudioContext;
      const originalWebkitAudioContext = (global as any).webkitAudioContext;
      
      (global as any).AudioContext = vi.fn(() => {
        throw new Error('AudioContext not supported');
      });
      (global as any).webkitAudioContext = undefined;

      const result = await failingManager.initialize();
      expect(result).toBe(false);
      
      // Restore original constructors
      (global as any).AudioContext = originalAudioContext;
      (global as any).webkitAudioContext = originalWebkitAudioContext;
      
      failingManager.dispose();
    });
  });

  describe('preloadExpressions', () => {

    it('should preload expression buffers successfully', async () => {
      const buffers = await bufferManager.preloadExpressions(mockExpressions);
      
      expect(buffers.size).toBe(2);
      expect(buffers.has('expr-1')).toBe(true);
      expect(buffers.has('expr-2')).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle fetch failures gracefully', async () => {
      // Mock fetch to fail for first expression
      (fetch as Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found'
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
        });

      const buffers = await bufferManager.preloadExpressions(mockExpressions);
      
      expect(buffers.size).toBe(1);
      expect(buffers.has('expr-1')).toBe(false);
      expect(buffers.has('expr-2')).toBe(true);
    });

    it('should handle audio decoding failures gracefully', async () => {
      // Mock decodeAudioData to fail for first expression
      mockAudioContext.decodeAudioData
        .mockRejectedValueOnce(new Error('Invalid audio format'))
        .mockResolvedValueOnce(mockAudioBuffer);

      const buffers = await bufferManager.preloadExpressions(mockExpressions);
      
      expect(buffers.size).toBe(1);
      expect(buffers.has('expr-1')).toBe(false);
      expect(buffers.has('expr-2')).toBe(true);
    });

    it('should respect concurrent load limits', async () => {
      const manyExpressions = Array.from({ length: 10 }, (_, i) => ({
        ...mockExpressions[0],
        id: `expr-${i}`,
        cdnUrl: `https://cdn.example.com/expr-${i}.mp3`
      }));

      // Add delay to fetch to test concurrency
      (fetch as Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
        }), 100))
      );

      const startTime = Date.now();
      await bufferManager.preloadExpressions(manyExpressions);
      const endTime = Date.now();

      // With maxConcurrentLoads: 3, should take at least 4 batches
      // Each batch takes ~100ms, so minimum ~400ms
      expect(endTime - startTime).toBeGreaterThan(300);
    });

    it('should validate buffer format', async () => {
      // Mock invalid audio buffer
      const invalidBuffer = {
        duration: 0, // Invalid duration
        sampleRate: 44100,
        numberOfChannels: 1,
        length: 0
      };

      mockAudioContext.decodeAudioData.mockResolvedValue(invalidBuffer);

      const buffers = await bufferManager.preloadExpressions([mockExpressions[0]]);
      
      expect(buffers.size).toBe(0);
    });

    it('should handle timeout for slow loads', async () => {
      // Create buffer manager with short timeout
      const fastTimeoutManager = new ExpressionBufferManager({
        loadTimeoutMs: 100
      });
      await fastTimeoutManager.initialize();

      // Mock slow fetch
      (fetch as Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      const buffers = await fastTimeoutManager.preloadExpressions([mockExpressions[0]]);
      
      expect(buffers.size).toBe(0);
      
      fastTimeoutManager.dispose();
    });
  });

  describe('buffer management', () => {

    it('should get preloaded buffers', async () => {
      await bufferManager.preloadExpressions(mockExpressions);
      
      const buffer = bufferManager.getBuffer('expr-1');
      expect(buffer).toBeTruthy();
      expect(buffer?.duration).toBe(1.0);
    });

    it('should check if buffer is ready', async () => {
      expect(bufferManager.isBufferReady('expr-1')).toBe(false);
      
      await bufferManager.preloadExpressions([mockExpressions[0]]);
      
      expect(bufferManager.isBufferReady('expr-1')).toBe(true);
    });

    it('should clear specific buffers', async () => {
      await bufferManager.preloadExpressions(mockExpressions);
      
      expect(bufferManager.isBufferReady('expr-1')).toBe(true);
      expect(bufferManager.isBufferReady('expr-2')).toBe(true);
      
      bufferManager.clearBuffers(['expr-1']);
      
      expect(bufferManager.isBufferReady('expr-1')).toBe(false);
      expect(bufferManager.isBufferReady('expr-2')).toBe(true);
    });

    it('should clear all buffers', async () => {
      await bufferManager.preloadExpressions(mockExpressions);
      
      expect(bufferManager.isBufferReady('expr-1')).toBe(true);
      expect(bufferManager.isBufferReady('expr-2')).toBe(true);
      
      bufferManager.clearBuffers();
      
      expect(bufferManager.isBufferReady('expr-1')).toBe(false);
      expect(bufferManager.isBufferReady('expr-2')).toBe(false);
    });

    it('should enforce buffer count limits', async () => {
      // Test that memory limits are enforced by loading more than the limit
      const manyExpressions = Array.from({ length: 15 }, (_, i) => ({
        ...mockExpressions[0],
        id: `expr-${i}`,
        cdnUrl: `https://cdn.example.com/expr-${i}.mp3`
      }));

      // Load all expressions at once - the buffer manager should enforce limits
      const buffers = await bufferManager.preloadExpressions(manyExpressions);
      
      // The returned buffers should respect the limit, even if more were attempted
      expect(buffers.size).toBeLessThanOrEqual(10); // maxBuffers limit
      
      const stats = bufferManager.getStats();
      expect(stats.totalBuffers).toBeLessThanOrEqual(10); // maxBuffers limit
    });
  });

  describe('statistics', () => {

    it('should provide accurate statistics', async () => {
      const initialStats = bufferManager.getStats();
      expect(initialStats.totalBuffers).toBe(0);
      expect(initialStats.loadedBuffers).toBe(0);
      
      await bufferManager.preloadExpressions(mockExpressions);
      
      const finalStats = bufferManager.getStats();
      expect(finalStats.totalBuffers).toBe(2);
      expect(finalStats.loadedBuffers).toBe(2);
      expect(finalStats.memoryUsageBytes).toBeGreaterThan(0);
    });

    it('should track validation statistics', async () => {
      await bufferManager.preloadExpressions(mockExpressions);
      
      const stats = bufferManager.getStats();
      expect(stats.validationStats.validated).toBeGreaterThan(0);
      expect(stats.validationStats.passed).toBeGreaterThan(0);
    });
  });

  describe('global buffer manager', () => {
    it('should create and reuse global instance', async () => {
      const manager1 = await getGlobalBufferManager();
      const manager2 = await getGlobalBufferManager();
      
      expect(manager1).toBe(manager2);
    });

    it('should dispose global instance', async () => {
      await getGlobalBufferManager();
      disposeGlobalBufferManager();
      
      // Should create new instance after disposal
      const newManager = await getGlobalBufferManager();
      expect(newManager).toBeTruthy();
    });
  });

  describe('error handling', () => {

    it('should handle empty audio files', async () => {
      (fetch as Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) // Empty buffer
      });

      const buffers = await bufferManager.preloadExpressions([mockExpressions[0]]);
      expect(buffers.size).toBe(0);
    });

    it('should handle oversized audio files', async () => {
      (fetch as Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10 * 1024 * 1024)) // 10MB
      });

      const buffers = await bufferManager.preloadExpressions([mockExpressions[0]]);
      expect(buffers.size).toBe(0);
    });

    it('should handle network errors gracefully', async () => {
      (fetch as Mock).mockRejectedValue(new Error('Network error'));

      const buffers = await bufferManager.preloadExpressions(mockExpressions);
      expect(buffers.size).toBe(0);
    });
  });
});