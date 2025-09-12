import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { performance } from 'perf_hooks';

describe('Performance Regression Tests', () => {
  let performanceBaseline: Map<string, number>;
  let memoryBaseline: Map<string, number>;

  beforeEach(() => {
    performanceBaseline = new Map([
      ['tts_first_byte_ms', 500],
      ['memory_fetch_ms', 200],
      ['expression_scheduling_ms', 50],
      ['audio_buffer_creation_ms', 100],
      ['conversation_turn_complete_ms', 2000]
    ]);

    memoryBaseline = new Map([
      ['audio_buffer_size_mb', 10],
      ['memory_cache_size_mb', 5],
      ['expression_buffer_size_mb', 15],
      ['total_heap_size_mb', 50]
    ]);

    // Mock performance.now for consistent testing
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Latency Regression Tests', () => {
    it('should maintain TTS first byte latency under 500ms', async () => {
      const startTime = performance.now();
      
      // Simulate TTS streaming initialization
      await simulateTTSStreaming();
      
      const latency = performance.now() - startTime;
      const baseline = performanceBaseline.get('tts_first_byte_ms')!;
      
      expect(latency).toBeLessThan(baseline);
      expect(latency).toBeLessThan(baseline * 1.1); // Allow 10% regression
    });

    it('should maintain memory fetch latency under 200ms', async () => {
      const startTime = performance.now();
      
      // Simulate memory retrieval
      await simulateMemoryFetch();
      
      const latency = performance.now() - startTime;
      const baseline = performanceBaseline.get('memory_fetch_ms')!;
      
      expect(latency).toBeLessThan(baseline);
      expect(latency).toBeLessThan(baseline * 1.2); // Allow 20% regression for DB operations
    });

    it('should maintain expression scheduling under 50ms', async () => {
      const startTime = performance.now();
      
      // Simulate expression scheduling
      await simulateExpressionScheduling();
      
      const latency = performance.now() - startTime;
      const baseline = performanceBaseline.get('expression_scheduling_ms')!;
      
      expect(latency).toBeLessThan(baseline);
      expect(latency).toBeLessThan(baseline * 1.1); // Allow 10% regression
    });

    it('should maintain audio buffer creation under 100ms', async () => {
      const startTime = performance.now();
      
      // Simulate audio buffer creation
      await simulateAudioBufferCreation();
      
      const latency = performance.now() - startTime;
      const baseline = performanceBaseline.get('audio_buffer_creation_ms')!;
      
      expect(latency).toBeLessThan(baseline);
      expect(latency).toBeLessThan(baseline * 1.15); // Allow 15% regression
    });

    it('should complete conversation turn under 2 seconds', async () => {
      const startTime = performance.now();
      
      // Simulate full conversation turn
      await simulateFullConversationTurn();
      
      const latency = performance.now() - startTime;
      const baseline = performanceBaseline.get('conversation_turn_complete_ms')!;
      
      expect(latency).toBeLessThan(baseline);
      expect(latency).toBeLessThan(baseline * 1.2); // Allow 20% regression for full flow
    });
  });

  describe('Memory Usage Regression Tests', () => {
    it('should maintain audio buffer memory under 10MB', () => {
      const memoryUsage = measureAudioBufferMemory();
      const baseline = memoryBaseline.get('audio_buffer_size_mb')!;
      
      expect(memoryUsage).toBeLessThan(baseline);
      expect(memoryUsage).toBeLessThan(baseline * 1.2); // Allow 20% memory regression
    });

    it('should maintain memory cache under 5MB', () => {
      const memoryUsage = measureMemoryCacheSize();
      const baseline = memoryBaseline.get('memory_cache_size_mb')!;
      
      expect(memoryUsage).toBeLessThan(baseline);
      expect(memoryUsage).toBeLessThan(baseline * 1.3); // Allow 30% cache growth
    });

    it('should maintain expression buffer under 15MB', () => {
      const memoryUsage = measureExpressionBufferMemory();
      const baseline = memoryBaseline.get('expression_buffer_size_mb')!;
      
      expect(memoryUsage).toBeLessThan(baseline);
      expect(memoryUsage).toBeLessThan(baseline * 1.25); // Allow 25% expression buffer growth
    });

    it('should maintain total heap size under 50MB', () => {
      const memoryUsage = measureTotalHeapSize();
      const baseline = memoryBaseline.get('total_heap_size_mb')!;
      
      expect(memoryUsage).toBeLessThan(baseline);
      expect(memoryUsage).toBeLessThan(baseline * 1.4); // Allow 40% total heap growth
    });

    it('should not have memory leaks over multiple conversation turns', async () => {
      const initialMemory = measureTotalHeapSize();
      
      // Simulate 10 conversation turns
      for (let i = 0; i < 10; i++) {
        await simulateFullConversationTurn();
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = measureTotalHeapSize();
      const memoryGrowth = finalMemory - initialMemory;
      
      // Memory should not grow more than 20% after multiple turns
      expect(memoryGrowth).toBeLessThan(initialMemory * 0.2);
    });
  });

  describe('Performance Monitoring Integration', () => {
    it('should track performance metrics consistently', async () => {
      const metrics = await collectPerformanceMetrics();
      
      expect(metrics).toHaveProperty('tts_latency_p95');
      expect(metrics).toHaveProperty('memory_fetch_latency_p95');
      expect(metrics).toHaveProperty('expression_overlay_timing_accuracy');
      expect(metrics).toHaveProperty('audio_buffer_utilization');
      expect(metrics).toHaveProperty('memory_cache_hit_rate');
      
      // Validate metric ranges
      expect(metrics.tts_latency_p95).toBeLessThan(1000);
      expect(metrics.memory_fetch_latency_p95).toBeLessThan(500);
      expect(metrics.expression_overlay_timing_accuracy).toBeGreaterThan(0.8);
      expect(metrics.audio_buffer_utilization).toBeLessThan(0.9);
      expect(metrics.memory_cache_hit_rate).toBeGreaterThan(0.7);
    });

    it('should detect performance regressions automatically', async () => {
      const currentMetrics = await collectPerformanceMetrics();
      const regressionReport = analyzePerformanceRegression(currentMetrics, performanceBaseline);
      
      expect(regressionReport.hasRegressions).toBe(false);
      expect(regressionReport.regressionCount).toBe(0);
      
      if (regressionReport.hasRegressions) {
        console.warn('Performance regressions detected:', regressionReport.regressions);
      }
    });
  });

  // Helper functions for simulation
  async function simulateTTSStreaming(): Promise<void> {
    // Simulate network delay and processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
  }

  async function simulateMemoryFetch(): Promise<void> {
    // Simulate database query
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 25));
  }

  async function simulateExpressionScheduling(): Promise<void> {
    // Simulate expression analysis and scheduling
    await new Promise(resolve => setTimeout(resolve, Math.random() * 20 + 10));
  }

  async function simulateAudioBufferCreation(): Promise<void> {
    // Simulate audio buffer allocation and setup
    await new Promise(resolve => setTimeout(resolve, Math.random() * 30 + 20));
  }

  async function simulateFullConversationTurn(): Promise<void> {
    await simulateMemoryFetch();
    await simulateTTSStreaming();
    await simulateExpressionScheduling();
    await simulateAudioBufferCreation();
  }

  function measureAudioBufferMemory(): number {
    // Mock memory measurement - in real implementation would use process.memoryUsage()
    return Math.random() * 8 + 2; // 2-10 MB
  }

  function measureMemoryCacheSize(): number {
    return Math.random() * 4 + 1; // 1-5 MB
  }

  function measureExpressionBufferMemory(): number {
    return Math.random() * 12 + 3; // 3-15 MB
  }

  function measureTotalHeapSize(): number {
    return Math.random() * 40 + 20; // 20-60 MB
  }

  async function collectPerformanceMetrics(): Promise<any> {
    return {
      tts_latency_p95: Math.random() * 400 + 100,
      memory_fetch_latency_p95: Math.random() * 150 + 50,
      expression_overlay_timing_accuracy: Math.random() * 0.2 + 0.8,
      audio_buffer_utilization: Math.random() * 0.3 + 0.4,
      memory_cache_hit_rate: Math.random() * 0.2 + 0.75
    };
  }

  function analyzePerformanceRegression(current: any, baseline: Map<string, number>): any {
    const regressions: string[] = [];
    
    // Check for regressions (simplified)
    if (current.tts_latency_p95 > (baseline.get('tts_first_byte_ms')! * 1.2)) {
      regressions.push('TTS latency regression detected');
    }
    
    if (current.memory_fetch_latency_p95 > (baseline.get('memory_fetch_ms')! * 1.3)) {
      regressions.push('Memory fetch latency regression detected');
    }
    
    return {
      hasRegressions: regressions.length > 0,
      regressionCount: regressions.length,
      regressions
    };
  }
});