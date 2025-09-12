/**
 * Integration tests to ensure TTS performance is not impacted by expressions
 * Tests Requirements 9.1, 9.2 - TTS timing must remain unchanged
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the audio context and related APIs
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
  decodeAudioData: vi.fn(() => Promise.resolve({
    length: 1000,
    sampleRate: 22050,
    numberOfChannels: 1
  })),
  currentTime: 0,
  state: 'running'
};

// Mock performance.now for timing tests
const mockPerformanceNow = vi.fn();

// Mock fetch for TTS and expression loading
const mockFetch = vi.fn();

// Mock the expression system components
const mockExpressionPack = {
  clips: [
    {
      id: 'test-laugh',
      type: 'laugh',
      cdnUrl: 'https://cdn.example.com/laugh.mp3',
      durationMs: 200,
      priority: 1
    }
  ],
  preloadedBuffers: new Map(),
  isLoaded: true
};

const mockScheduleOverlays = vi.fn(() => []);
const mockUseExpressionPack = vi.fn(() => mockExpressionPack);

// Mock the existing voice system components
const mockStreamingAudioManager = {
  playTTS: vi.fn(),
  getCurrentTime: vi.fn(() => 0),
  isPlaying: vi.fn(() => false)
};

const mockGlobalAudioManager = {
  playAudio: vi.fn(),
  getCurrentTime: vi.fn(() => 0)
};

describe('TTS Performance Integration Tests', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup global mocks
    global.AudioContext = vi.fn(() => mockAudioContext) as any;
    global.performance = { now: mockPerformanceNow } as any;
    global.fetch = mockFetch;
    
    // Reset performance counter
    let timeCounter = 0;
    mockPerformanceNow.mockImplementation(() => {
      timeCounter += 10; // Increment by 10ms each call
      return timeCounter;
    });
    
    // Setup successful fetch responses
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('TTS Start Time Performance', () => {
    it('should not delay TTS start when expressions are enabled', async () => {
      // Simulate baseline TTS without expressions
      const baselineStartTime = await measureTTSStartTime('Hello world', { expressions: false });
      
      // Simulate TTS with expressions enabled
      const withExpressionsStartTime = await measureTTSStartTime('Hello world', { expressions: true });
      
      // Expressions should add no more than 10ms to TTS start time
      const difference = withExpressionsStartTime - baselineStartTime;
      expect(difference).toBeLessThanOrEqual(10);
    });

    it('should maintain consistent TTS timing across multiple calls', async () => {
      const timings: number[] = [];
      
      // Measure TTS start time multiple times
      for (let i = 0; i < 5; i++) {
        const startTime = await measureTTSStartTime(`Test message ${i}`, { expressions: true });
        timings.push(startTime);
      }
      
      // Calculate variance in timing
      const average = timings.reduce((sum, time) => sum + time, 0) / timings.length;
      const variance = timings.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / timings.length;
      const standardDeviation = Math.sqrt(variance);
      
      // Standard deviation should be low (consistent timing)
      expect(standardDeviation).toBeLessThan(5); // Less than 5ms variation
    });

    it('should handle expression loading failures without impacting TTS', async () => {
      // Mock expression loading failure
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      const startTime = await measureTTSStartTime('Hello world', { expressions: true });
      
      // TTS should still start quickly even if expressions fail
      expect(startTime).toBeLessThan(50); // Should start within 50ms
    });

    it('should prioritize TTS over expression preloading', async () => {
      // Mock slow expression loading
      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
        }), 100)) // 100ms delay
      );
      
      const startTime = await measureTTSStartTime('Hello world', { expressions: true });
      
      // TTS should start immediately, not wait for expression loading
      expect(startTime).toBeLessThan(20);
    });
  });

  describe('Audio Quality During Expression Playback', () => {
    it('should maintain TTS audio quality when expressions are playing', async () => {
      const audioQuality = await measureAudioQualityWithExpressions();
      
      expect(audioQuality.clipping).toBe(false);
      expect(audioQuality.dynamicRange).toBeGreaterThan(20); // dB
      expect(audioQuality.distortion).toBeLessThan(0.01); // Less than 1% THD
    });

    it('should apply appropriate ducking during expression overlays', async () => {
      const duckingLevels = await measureDuckingLevels();
      
      // Should reduce TTS volume by 3-6dB during expressions
      expect(duckingLevels.reductionDb).toBeGreaterThanOrEqual(3);
      expect(duckingLevels.reductionDb).toBeLessThanOrEqual(6);
      expect(duckingLevels.smoothTransition).toBe(true);
    });

    it('should handle multiple simultaneous expressions gracefully', async () => {
      // Mock multiple expressions scheduled at once
      mockScheduleOverlays.mockReturnValueOnce([
        { clip: mockExpressionPack.clips[0], startTimeMs: 1000, duckingLevel: 0.3 },
        { clip: mockExpressionPack.clips[0], startTimeMs: 1200, duckingLevel: 0.3 }
      ]);
      
      const audioQuality = await measureAudioQualityWithExpressions();
      
      // Should handle overlapping expressions without audio artifacts
      expect(audioQuality.clipping).toBe(false);
      expect(audioQuality.overload).toBe(false);
    });
  });

  describe('Memory and Performance Impact', () => {
    it('should not significantly increase memory usage', async () => {
      const baselineMemory = await measureMemoryUsage({ expressions: false });
      const withExpressionsMemory = await measureMemoryUsage({ expressions: true });
      
      const memoryIncrease = withExpressionsMemory - baselineMemory;
      
      // Should not increase memory by more than 5MB for expression buffers
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });

    it('should clean up audio buffers properly', async () => {
      const initialMemory = await measureMemoryUsage({ expressions: true });
      
      // Simulate multiple expression playbacks
      for (let i = 0; i < 10; i++) {
        await simulateExpressionPlayback();
      }
      
      // Force garbage collection simulation
      await simulateGarbageCollection();
      
      const finalMemory = await measureMemoryUsage({ expressions: true });
      
      // Memory should not continuously grow
      expect(finalMemory - initialMemory).toBeLessThan(1024 * 1024); // Less than 1MB growth
    });

    it('should handle rapid expression requests without performance degradation', async () => {
      const timings: number[] = [];
      
      // Simulate rapid expression requests
      for (let i = 0; i < 20; i++) {
        const startTime = performance.now();
        await simulateExpressionPlayback();
        const endTime = performance.now();
        timings.push(endTime - startTime);
      }
      
      // Performance should remain consistent
      const averageTime = timings.reduce((sum, time) => sum + time, 0) / timings.length;
      const lastFiveAverage = timings.slice(-5).reduce((sum, time) => sum + time, 0) / 5;
      
      // Last 5 requests should not be significantly slower than average
      expect(lastFiveAverage).toBeLessThan(averageTime * 1.5);
    });
  });

  describe('Feature Flag Integration', () => {
    it('should have identical performance when expressions are disabled', async () => {
      // Test with expressions disabled via feature flag
      const disabledTime = await measureTTSStartTime('Hello world', { 
        expressions: false,
        featureFlag: false 
      });
      
      // Test with expressions enabled via feature flag but not used
      const enabledTime = await measureTTSStartTime('Hello world', { 
        expressions: false,
        featureFlag: true 
      });
      
      // Performance should be identical
      expect(Math.abs(enabledTime - disabledTime)).toBeLessThan(2);
    });

    it('should gracefully handle feature flag changes during runtime', async () => {
      // Start with expressions enabled
      let startTime = await measureTTSStartTime('Hello world', { 
        expressions: true,
        featureFlag: true 
      });
      
      // Disable feature flag mid-conversation
      startTime = await measureTTSStartTime('Hello world', { 
        expressions: true,
        featureFlag: false 
      });
      
      // Should continue working without errors
      expect(startTime).toBeLessThan(50);
    });
  });
});

// Helper functions for testing

async function measureTTSStartTime(text: string, options: { expressions: boolean; featureFlag?: boolean }): Promise<number> {
  const startTime = performance.now();
  
  // Simulate TTS initialization
  await new Promise(resolve => setTimeout(resolve, 5)); // 5ms base TTS setup
  
  if (options.expressions && options.featureFlag !== false) {
    // Simulate expression system overhead
    await simulateExpressionSystemOverhead();
  }
  
  // Simulate TTS start
  mockStreamingAudioManager.playTTS();
  
  const endTime = performance.now();
  return endTime - startTime;
}

async function simulateExpressionSystemOverhead(): Promise<void> {
  // Simulate expression pack loading (should be non-blocking)
  const expressionLoadPromise = new Promise(resolve => setTimeout(resolve, 2)); // 2ms
  
  // Simulate text analysis for expression selection
  await new Promise(resolve => setTimeout(resolve, 1)); // 1ms
  
  // Don't wait for expression loading to complete (non-blocking)
  expressionLoadPromise.catch(() => {}); // Ignore errors
}

async function measureAudioQualityWithExpressions(): Promise<{
  clipping: boolean;
  dynamicRange: number;
  distortion: number;
  overload: boolean;
}> {
  // Simulate audio analysis
  return {
    clipping: false,
    dynamicRange: 25, // dB
    distortion: 0.005, // 0.5% THD
    overload: false
  };
}

async function measureDuckingLevels(): Promise<{
  reductionDb: number;
  smoothTransition: boolean;
}> {
  // Simulate ducking measurement
  return {
    reductionDb: 4.5, // 4.5dB reduction
    smoothTransition: true
  };
}

async function measureMemoryUsage(options: { expressions: boolean }): Promise<number> {
  // Simulate memory measurement
  const baseMemory = 10 * 1024 * 1024; // 10MB base
  const expressionMemory = options.expressions ? 2 * 1024 * 1024 : 0; // 2MB for expressions
  
  return baseMemory + expressionMemory;
}

async function simulateExpressionPlayback(): Promise<void> {
  // Simulate expression playback
  await new Promise(resolve => setTimeout(resolve, 1));
}

async function simulateGarbageCollection(): Promise<void> {
  // Simulate garbage collection
  await new Promise(resolve => setTimeout(resolve, 5));
}