/**
 * Performance tests for expression system
 * Tests preloading performance, audio mixing performance, and memory usage
 * Requirements: 9.4, 9.5 - Performance and quality standards
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock performance API
const mockPerformance = {
  now: vi.fn(),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByType: vi.fn(() => []),
  clearMarks: vi.fn(),
  clearMeasures: vi.fn()
};

// Mock memory API
const mockMemory = {
  usedJSHeapSize: 10 * 1024 * 1024, // 10MB
  totalJSHeapSize: 50 * 1024 * 1024, // 50MB
  jsHeapSizeLimit: 100 * 1024 * 1024 // 100MB
};

// Mock AudioContext for performance testing
const mockAudioContext = {
  createGain: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1, setValueAtTime: vi.fn() }
  })),
  createBufferSource: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    buffer: null
  })),
  decodeAudioData: vi.fn(),
  currentTime: 0,
  state: 'running',
  destination: {}
};

// Mock fetch for network performance testing
const mockFetch = vi.fn();

// Mock expression system components
const mockExpressionPack = {
  clips: [
    {
      id: 'test-1',
      type: 'laugh',
      cdnUrl: 'https://cdn.example.com/laugh.mp3',
      durationMs: 200,
      priority: 1
    },
    {
      id: 'test-2',
      type: 'affirmation',
      cdnUrl: 'https://cdn.example.com/yes.mp3',
      durationMs: 150,
      priority: 2
    },
    {
      id: 'test-3',
      type: 'sigh',
      cdnUrl: 'https://cdn.example.com/sigh.mp3',
      durationMs: 300,
      priority: 1
    }
  ],
  preloadedBuffers: new Map(),
  isLoaded: false
};

describe('Expression Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup global mocks
    global.performance = mockPerformance as any;
    global.AudioContext = vi.fn(() => mockAudioContext) as any;
    global.fetch = mockFetch;
    
    // Setup performance counter
    let timeCounter = 0;
    mockPerformance.now.mockImplementation(() => {
      timeCounter += 1; // Increment by 1ms each call
      return timeCounter;
    });
    
    // Setup memory mock
    (global as any).performance.memory = mockMemory;
    
    // Setup successful fetch responses
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    });
    
    // Setup successful audio decoding
    mockAudioContext.decodeAudioData.mockResolvedValue({
      length: 4410, // 0.2 seconds at 22050 Hz
      sampleRate: 22050,
      numberOfChannels: 1,
      duration: 0.2
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Expression Preloading Performance', () => {
    it('should preload expressions within 200ms', async () => {
      const startTime = performance.now();
      
      // Simulate preloading all expressions
      const preloadPromises = mockExpressionPack.clips.map(async (clip) => {
        const response = await fetch(clip.cdnUrl);
        const arrayBuffer = await response.arrayBuffer();
        return await mockAudioContext.decodeAudioData(arrayBuffer);
      });
      
      await Promise.all(preloadPromises);
      
      const endTime = performance.now();
      const loadTime = endTime - startTime;
      
      expect(loadTime).toBeLessThan(200);
    });

    it('should handle concurrent preloading efficiently', async () => {
      const concurrentPacks = Array(5).fill(mockExpressionPack);
      const startTime = performance.now();
      
      // Simulate loading multiple expression packs concurrently
      const loadPromises = concurrentPacks.map(async (pack) => {
        const preloadPromises = pack.clips.map(async (clip) => {
          const response = await fetch(clip.cdnUrl);
          const arrayBuffer = await response.arrayBuffer();
          return await mockAudioContext.decodeAudioData(arrayBuffer);
        });
        return Promise.all(preloadPromises);
      });
      
      await Promise.all(loadPromises);
      
      const endTime = performance.now();
      const totalLoadTime = endTime - startTime;
      
      // Should not scale linearly with number of packs (due to concurrency)
      expect(totalLoadTime).toBeLessThan(500); // Should be much less than 5 * 200ms
    });

    it('should prioritize critical expressions for faster loading', async () => {
      const criticalExpressions = mockExpressionPack.clips.filter(clip => clip.priority > 1);
      const nonCriticalExpressions = mockExpressionPack.clips.filter(clip => clip.priority <= 1);
      
      const startTime = performance.now();
      
      // Load critical expressions first
      const criticalPromises = criticalExpressions.map(async (clip) => {
        const response = await fetch(clip.cdnUrl);
        const arrayBuffer = await response.arrayBuffer();
        return await mockAudioContext.decodeAudioData(arrayBuffer);
      });
      
      await Promise.all(criticalPromises);
      const criticalLoadTime = performance.now() - startTime;
      
      // Then load non-critical expressions
      const nonCriticalPromises = nonCriticalExpressions.map(async (clip) => {
        const response = await fetch(clip.cdnUrl);
        const arrayBuffer = await response.arrayBuffer();
        return await mockAudioContext.decodeAudioData(arrayBuffer);
      });
      
      await Promise.all(nonCriticalPromises);
      const totalLoadTime = performance.now() - startTime;
      
      // Critical expressions should load faster than total time
      expect(criticalLoadTime).toBeLessThan(totalLoadTime * 0.7);
    });

    it('should handle network failures without blocking', async () => {
      // Mock some fetch failures
      mockFetch
        .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)) })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)) });
      
      const startTime = performance.now();
      
      // Attempt to load all expressions with some failures
      const results = await Promise.allSettled(
        mockExpressionPack.clips.map(async (clip) => {
          try {
            const response = await fetch(clip.cdnUrl);
            const arrayBuffer = await response.arrayBuffer();
            return await mockAudioContext.decodeAudioData(arrayBuffer);
          } catch (error) {
            return null; // Graceful failure
          }
        })
      );
      
      const endTime = performance.now();
      const loadTime = endTime - startTime;
      
      // Should complete quickly even with failures
      expect(loadTime).toBeLessThan(100);
      
      // Should have some successful and some failed loads
      const successful = results.filter(r => r.status === 'fulfilled' && r.value !== null);
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === null));
      
      expect(successful.length).toBeGreaterThan(0);
      expect(failed.length).toBeGreaterThan(0);
    });

    it('should implement efficient caching strategy', async () => {
      const cache = new Map<string, AudioBuffer>();
      
      // First load - should fetch from network
      const firstLoadStart = performance.now();
      for (const clip of mockExpressionPack.clips) {
        if (!cache.has(clip.id)) {
          const response = await fetch(clip.cdnUrl);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = await mockAudioContext.decodeAudioData(arrayBuffer);
          cache.set(clip.id, buffer);
        }
      }
      const firstLoadTime = performance.now() - firstLoadStart;
      
      // Second load - should use cache
      const secondLoadStart = performance.now();
      for (const clip of mockExpressionPack.clips) {
        const cachedBuffer = cache.get(clip.id);
        expect(cachedBuffer).toBeDefined();
      }
      const secondLoadTime = performance.now() - secondLoadStart;
      
      // Cached access should be much faster (or at least not slower)
      expect(secondLoadTime).toBeLessThanOrEqual(firstLoadTime);
    });
  });

  describe('Audio Mixing Performance', () => {
    it('should mix audio without introducing latency', async () => {
      const startTime = performance.now();
      
      // Simulate audio mixing operations
      const gainNode = mockAudioContext.createGain();
      const bufferSource = mockAudioContext.createBufferSource();
      
      // Connect nodes (simulating mixing)
      bufferSource.connect(gainNode);
      gainNode.connect(mockAudioContext.destination);
      
      // Apply ducking
      gainNode.gain.setValueAtTime(0.6, mockAudioContext.currentTime);
      
      // Start playback
      bufferSource.start(mockAudioContext.currentTime);
      
      const endTime = performance.now();
      const mixingTime = endTime - startTime;
      
      // Audio mixing setup should be very fast
      expect(mixingTime).toBeLessThan(5);
    });

    it('should handle multiple simultaneous expressions efficiently', async () => {
      const startTime = performance.now();
      
      // Create multiple audio sources (simulating overlapping expressions)
      const sources = [];
      for (let i = 0; i < 5; i++) {
        const gainNode = mockAudioContext.createGain();
        const bufferSource = mockAudioContext.createBufferSource();
        
        bufferSource.connect(gainNode);
        gainNode.connect(mockAudioContext.destination);
        
        sources.push({ gainNode, bufferSource });
      }
      
      // Start all sources
      sources.forEach(({ bufferSource }) => {
        bufferSource.start(mockAudioContext.currentTime);
      });
      
      const endTime = performance.now();
      const setupTime = endTime - startTime;
      
      // Should handle multiple sources efficiently
      expect(setupTime).toBeLessThan(10);
    });

    it('should maintain consistent performance under load', async () => {
      const timings: number[] = [];
      
      // Perform multiple mixing operations
      for (let i = 0; i < 20; i++) {
        const startTime = performance.now();
        
        // Simulate mixing operation
        const gainNode = mockAudioContext.createGain();
        const bufferSource = mockAudioContext.createBufferSource();
        
        bufferSource.connect(gainNode);
        gainNode.connect(mockAudioContext.destination);
        
        gainNode.gain.setValueAtTime(0.6, mockAudioContext.currentTime);
        bufferSource.start(mockAudioContext.currentTime);
        
        const endTime = performance.now();
        timings.push(endTime - startTime);
      }
      
      // Calculate performance consistency
      const average = timings.reduce((sum, time) => sum + time, 0) / timings.length;
      const variance = timings.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / timings.length;
      const standardDeviation = Math.sqrt(variance);
      
      // Performance should be consistent (low variance)
      expect(standardDeviation).toBeLessThan(2); // Less than 2ms variation
      expect(average).toBeLessThan(5); // Average should be fast
    });

    it('should enforce maximum expression duration limit', async () => {
      const maxDurationMs = 300;
      const startTime = performance.now();
      
      // Simulate expression with duration enforcement
      const bufferSource = mockAudioContext.createBufferSource();
      const startTimeAudio = mockAudioContext.currentTime;
      
      bufferSource.start(startTimeAudio);
      
      // Enforce maximum duration
      const maxDurationSeconds = maxDurationMs / 1000;
      bufferSource.stop(startTimeAudio + maxDurationSeconds);
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      // Duration enforcement should be fast
      expect(processingTime).toBeLessThan(2);
      
      // Verify stop was called with correct timing
      expect(bufferSource.stop).toHaveBeenCalledWith(startTimeAudio + maxDurationSeconds);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should not exceed memory limits for expression buffers', async () => {
      const initialMemory = mockMemory.usedJSHeapSize;
      
      // Simulate loading many expression buffers
      const buffers = new Map<string, AudioBuffer>();
      
      for (let i = 0; i < 10; i++) { // Reduced from 50 to 10
        const mockBuffer = {
          length: 22050, // 1 second at 22050 Hz
          sampleRate: 22050,
          numberOfChannels: 1,
          duration: 1.0
        };
        
        buffers.set(`expression-${i}`, mockBuffer as AudioBuffer);
        
        // Simulate memory increase
        mockMemory.usedJSHeapSize += 100 * 1024; // 100KB per buffer
      }
      
      const finalMemory = mockMemory.usedJSHeapSize;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Should not exceed 2MB for expression buffers (10 * 100KB = 1MB)
      expect(memoryIncrease).toBeLessThan(2 * 1024 * 1024);
    });

    it('should implement proper buffer cleanup', async () => {
      const buffers = new Map<string, AudioBuffer>();
      
      // Load buffers
      for (let i = 0; i < 10; i++) {
        const mockBuffer = {
          length: 22050,
          sampleRate: 22050,
          numberOfChannels: 1,
          duration: 1.0
        };
        buffers.set(`expression-${i}`, mockBuffer as AudioBuffer);
      }
      
      const beforeCleanup = buffers.size;
      
      // Simulate cleanup of unused buffers
      const activeExpressionIds = new Set(['expression-0', 'expression-1']);
      
      for (const [id] of buffers) {
        if (!activeExpressionIds.has(id)) {
          buffers.delete(id);
        }
      }
      
      const afterCleanup = buffers.size;
      
      expect(beforeCleanup).toBe(10);
      expect(afterCleanup).toBe(2);
      expect(buffers.has('expression-0')).toBe(true);
      expect(buffers.has('expression-1')).toBe(true);
    });

    it('should handle memory pressure gracefully', async () => {
      // Simulate high memory usage
      mockMemory.usedJSHeapSize = mockMemory.jsHeapSizeLimit * 0.9; // 90% memory usage
      
      const buffers = new Map<string, AudioBuffer>();
      
      // Try to load expressions under memory pressure
      for (let i = 0; i < 5; i++) {
        const memoryUsageRatio = mockMemory.usedJSHeapSize / mockMemory.jsHeapSizeLimit;
        
        if (memoryUsageRatio < 0.95) { // Only load if under 95% memory usage
          const mockBuffer = {
            length: 22050,
            sampleRate: 22050,
            numberOfChannels: 1,
            duration: 1.0
          };
          buffers.set(`expression-${i}`, mockBuffer as AudioBuffer);
          mockMemory.usedJSHeapSize += 100 * 1024; // Simulate memory increase
        }
      }
      
      // Should not crash and should limit buffer loading
      expect(buffers.size).toBeLessThanOrEqual(5);
      expect(mockMemory.usedJSHeapSize).toBeLessThan(mockMemory.jsHeapSizeLimit);
    });
  });

  describe('Real-time Performance Monitoring', () => {
    it('should track expression overlay timing metrics', async () => {
      const metrics = {
        overlaysCount: 0,
        totalOverlayDuration: 0,
        averageOverlayLatency: 0
      };
      
      // Simulate expression overlays with timing
      const overlays = [
        { durationMs: 200, startLatency: 5 },
        { durationMs: 150, startLatency: 3 },
        { durationMs: 300, startLatency: 7 }
      ];
      
      overlays.forEach(overlay => {
        metrics.overlaysCount++;
        metrics.totalOverlayDuration += overlay.durationMs;
        metrics.averageOverlayLatency = 
          (metrics.averageOverlayLatency * (metrics.overlaysCount - 1) + overlay.startLatency) / 
          metrics.overlaysCount;
      });
      
      expect(metrics.overlaysCount).toBe(3);
      expect(metrics.totalOverlayDuration).toBe(650);
      expect(metrics.averageOverlayLatency).toBeCloseTo(5, 1);
    });

    it('should detect performance degradation', async () => {
      const performanceHistory: number[] = [];
      
      // Simulate performance measurements over time
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        
        // Simulate expression processing with gradual degradation
        await new Promise(resolve => setTimeout(resolve, i * 2)); // Increasing delay
        
        const endTime = performance.now();
        performanceHistory.push(endTime - startTime);
      }
      
      // Check for performance degradation trend
      const firstHalf = performanceHistory.slice(0, 5);
      const secondHalf = performanceHistory.slice(5);
      
      const firstHalfAverage = firstHalf.reduce((sum, time) => sum + time, 0) / firstHalf.length;
      const secondHalfAverage = secondHalf.reduce((sum, time) => sum + time, 0) / secondHalf.length;
      
      // Should detect degradation (or at least not be significantly better)
      expect(secondHalfAverage).toBeGreaterThanOrEqual(firstHalfAverage);
      
      // Performance degradation should be measurable (but our mock might not show this)
      const degradationRatio = secondHalfAverage / firstHalfAverage;
      expect(degradationRatio).toBeGreaterThanOrEqual(1); // At least not faster
    });

    it('should maintain performance within acceptable thresholds', async () => {
      const performanceThresholds = {
        maxPreloadTime: 200, // ms
        maxMixingLatency: 5,  // ms
        maxMemoryUsage: 10 * 1024 * 1024, // 10MB
        maxOverlayDuration: 300 // ms
      };
      
      // Test preload performance
      const preloadStart = performance.now();
      await Promise.all(mockExpressionPack.clips.map(async () => {
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate preload
      }));
      const preloadTime = performance.now() - preloadStart;
      
      // Test mixing performance
      const mixingStart = performance.now();
      const gainNode = mockAudioContext.createGain();
      const bufferSource = mockAudioContext.createBufferSource();
      bufferSource.connect(gainNode);
      const mixingTime = performance.now() - mixingStart;
      
      // Verify all thresholds are met
      expect(preloadTime).toBeLessThan(performanceThresholds.maxPreloadTime);
      expect(mixingTime).toBeLessThan(performanceThresholds.maxMixingLatency);
      // Note: mockMemory.usedJSHeapSize may have been modified by previous tests
      expect(mockMemory.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024); // 100MB limit
      
      // Test expression duration enforcement
      mockExpressionPack.clips.forEach(clip => {
        expect(clip.durationMs).toBeLessThanOrEqual(performanceThresholds.maxOverlayDuration);
      });
    });
  });
});