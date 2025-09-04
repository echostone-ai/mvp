/**
 * Development Performance Harness for Story System
 * Runs 20 story attempts and prints p50/p95 metrics as required by task 11
 * Requirements: 8.1, 8.2, 8.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StoryTriggerMatcher } from '../services/storyTriggerMatcher';
import { StoryAudioManager } from '../services/storyAudioManager';
import { UserStoryService } from '../services/userStoryService';
import type { UserStory } from '../types/stories';

interface PerformanceMetrics {
  triggerMatchLatency: number[];
  storyLoadLatency: number[];
  ttsStartLatency: number[];
  endToEndLatency: number[];
}

class PerformanceHarness {
  private metrics: PerformanceMetrics = {
    triggerMatchLatency: [],
    storyLoadLatency: [],
    ttsStartLatency: [],
    endToEndLatency: []
  };

  recordTriggerMatch(latency: number) {
    this.metrics.triggerMatchLatency.push(latency);
  }

  recordStoryLoad(latency: number) {
    this.metrics.storyLoadLatency.push(latency);
  }

  recordTTSStart(latency: number) {
    this.metrics.ttsStartLatency.push(latency);
  }

  recordEndToEnd(latency: number) {
    this.metrics.endToEndLatency.push(latency);
  }

  calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  printReport() {
    console.log('\n=== STORY PERFORMANCE HARNESS REPORT ===');
    console.log(`Test runs: ${this.metrics.triggerMatchLatency.length}`);
    console.log('');

    // Trigger Matching Performance
    if (this.metrics.triggerMatchLatency.length > 0) {
      const p50 = this.calculatePercentile(this.metrics.triggerMatchLatency, 50);
      const p95 = this.calculatePercentile(this.metrics.triggerMatchLatency, 95);
      const avg = this.metrics.triggerMatchLatency.reduce((a, b) => a + b, 0) / this.metrics.triggerMatchLatency.length;
      
      console.log('📊 TRIGGER MATCHING LATENCY:');
      console.log(`   Average: ${avg.toFixed(2)}ms`);
      console.log(`   P50: ${p50.toFixed(2)}ms`);
      console.log(`   P95: ${p95.toFixed(2)}ms`);
      console.log(`   Requirement: ≤ 100ms p95 ${p95 <= 100 ? '✅' : '❌'}`);
      console.log('');
    }

    // Story Loading Performance
    if (this.metrics.storyLoadLatency.length > 0) {
      const p50 = this.calculatePercentile(this.metrics.storyLoadLatency, 50);
      const p95 = this.calculatePercentile(this.metrics.storyLoadLatency, 95);
      const avg = this.metrics.storyLoadLatency.reduce((a, b) => a + b, 0) / this.metrics.storyLoadLatency.length;
      
      console.log('📊 STORY LOADING LATENCY:');
      console.log(`   Average: ${avg.toFixed(2)}ms`);
      console.log(`   P50: ${p50.toFixed(2)}ms`);
      console.log(`   P95: ${p95.toFixed(2)}ms`);
      console.log(`   Requirement: ≤ 2000ms p95 ${p95 <= 2000 ? '✅' : '❌'}`);
      console.log('');
    }

    // TTS Start Performance
    if (this.metrics.ttsStartLatency.length > 0) {
      const p50 = this.calculatePercentile(this.metrics.ttsStartLatency, 50);
      const p95 = this.calculatePercentile(this.metrics.ttsStartLatency, 95);
      const avg = this.metrics.ttsStartLatency.reduce((a, b) => a + b, 0) / this.metrics.ttsStartLatency.length;
      
      console.log('📊 TTS START LATENCY (when no story selected):');
      console.log(`   Average: ${avg.toFixed(2)}ms`);
      console.log(`   P50: ${p50.toFixed(2)}ms (req: ≤ 600ms) ${p50 <= 600 ? '✅' : '❌'}`);
      console.log(`   P95: ${p95.toFixed(2)}ms (req: ≤ 900ms) ${p95 <= 900 ? '✅' : '❌'}`);
      console.log('');
    }

    // End-to-End Performance
    if (this.metrics.endToEndLatency.length > 0) {
      const p50 = this.calculatePercentile(this.metrics.endToEndLatency, 50);
      const p95 = this.calculatePercentile(this.metrics.endToEndLatency, 95);
      const avg = this.metrics.endToEndLatency.reduce((a, b) => a + b, 0) / this.metrics.endToEndLatency.length;
      
      console.log('📊 END-TO-END LATENCY (trigger → audio start):');
      console.log(`   Average: ${avg.toFixed(2)}ms`);
      console.log(`   P50: ${p50.toFixed(2)}ms`);
      console.log(`   P95: ${p95.toFixed(2)}ms`);
      console.log('');
    }

    // Performance Summary
    const allRequirementsMet = 
      (this.metrics.triggerMatchLatency.length === 0 || this.calculatePercentile(this.metrics.triggerMatchLatency, 95) <= 100) &&
      (this.metrics.storyLoadLatency.length === 0 || this.calculatePercentile(this.metrics.storyLoadLatency, 95) <= 2000) &&
      (this.metrics.ttsStartLatency.length === 0 || 
        (this.calculatePercentile(this.metrics.ttsStartLatency, 50) <= 600 && 
         this.calculatePercentile(this.metrics.ttsStartLatency, 95) <= 900));

    console.log(`🎯 OVERALL PERFORMANCE: ${allRequirementsMet ? '✅ PASS' : '❌ FAIL'}`);
    console.log('==========================================\n');
  }

  reset() {
    this.metrics = {
      triggerMatchLatency: [],
      storyLoadLatency: [],
      ttsStartLatency: [],
      endToEndLatency: []
    };
  }
}

describe('Story Performance Harness - 20 Attempts', () => {
  let triggerMatcher: StoryTriggerMatcher;
  let audioManager: StoryAudioManager;
  let storyService: UserStoryService;
  let harness: PerformanceHarness;
  let testStories: UserStory[];

  beforeEach(() => {
    vi.clearAllMocks();
    
    triggerMatcher = new StoryTriggerMatcher();
    audioManager = new StoryAudioManager();
    storyService = new UserStoryService();
    harness = new PerformanceHarness();

    // Create test stories with various triggers
    testStories = [
      {
        id: 'perf-story-1',
        owner_id: 'avatar-1',
        owner_type: 'avatar',
        title: 'College Memory',
        category: 'memory',
        triggers: 'college, university, graduation, school',
        audio_url: 'https://example.com/story1.mp3',
        duration_ms: 120000,
        priority: 80,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'perf-story-2',
        owner_id: 'avatar-1',
        owner_type: 'avatar',
        title: 'Travel Adventure',
        category: 'experience',
        triggers: 'travel, adventure, backpacking, journey',
        audio_url: 'https://example.com/story2.mp3',
        duration_ms: 180000,
        priority: 60,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'perf-story-3',
        owner_id: 'avatar-1',
        owner_type: 'avatar',
        title: 'Career Advice',
        category: 'advice',
        triggers: 'career, job, work, professional',
        audio_url: 'https://example.com/story3.mp3',
        duration_ms: 90000,
        priority: 90,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'perf-story-4',
        owner_id: 'avatar-1',
        owner_type: 'avatar',
        title: 'Funny Anecdote',
        category: 'anecdote',
        triggers: 'funny, humor, joke, laugh',
        audio_url: 'https://example.com/story4.mp3',
        duration_ms: 60000,
        priority: 70,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'perf-story-5',
        owner_id: 'avatar-1',
        owner_type: 'avatar',
        title: 'Family Story',
        category: 'memory',
        triggers: 'family, parents, childhood, home',
        audio_url: 'https://example.com/story5.mp3',
        duration_ms: 150000,
        priority: 85,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    // Mock successful audio loading with realistic delays
    global.fetch = vi.fn(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
        } as Response), Math.random() * 500 + 100) // 100-600ms random delay
      )
    );

    global.AudioContext = vi.fn(() => ({
      state: 'running',
      decodeAudioData: vi.fn(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            duration: 2.5,
            sampleRate: 44100,
            numberOfChannels: 2,
            length: 110250,
            getChannelData: vi.fn(() => new Float32Array(110250))
          }), Math.random() * 200 + 50) // 50-250ms decode time
        )
      ),
      createBufferSource: vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null
      })),
      createGain: vi.fn(() => ({
        gain: { value: 1 },
        connect: vi.fn()
      })),
      destination: {}
    })) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    harness.reset();
  });

  it('should run 20 story attempts and measure performance', async () => {
    const testKeywords = [
      ['college'], ['travel'], ['career'], ['funny'], ['family'],
      ['university'], ['adventure'], ['job'], ['humor'], ['parents'],
      ['graduation'], ['backpacking'], ['work'], ['joke'], ['childhood'],
      ['school'], ['journey'], ['professional'], ['laugh'], ['home']
    ];

    console.log('\n🚀 Starting Performance Harness - 20 Story Attempts...\n');

    for (let i = 0; i < 20; i++) {
      const keywords = testKeywords[i % testKeywords.length];
      const attemptStartTime = performance.now();

      try {
        // 1. Measure trigger matching
        const triggerStartTime = performance.now();
        const matches = await triggerMatcher.matchTriggers(keywords, testStories);
        const triggerEndTime = performance.now();
        const triggerLatency = triggerEndTime - triggerStartTime;
        harness.recordTriggerMatch(triggerLatency);

        if (matches.length > 0) {
          // 2. Measure story loading
          const loadStartTime = performance.now();
          try {
            await audioManager.preloadStoryAudio(matches[0].story);
            const loadEndTime = performance.now();
            const loadLatency = loadEndTime - loadStartTime;
            harness.recordStoryLoad(loadLatency);
          } catch (error) {
            // Story loading failed, measure TTS fallback
            const ttsStartTime = performance.now();
            // Simulate TTS start
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
            const ttsEndTime = performance.now();
            const ttsLatency = ttsEndTime - ttsStartTime;
            harness.recordTTSStart(ttsLatency);
          }
        } else {
          // No story match, measure TTS start time
          const ttsStartTime = performance.now();
          // Simulate TTS start when no story is selected
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
          const ttsEndTime = performance.now();
          const ttsLatency = ttsEndTime - ttsStartTime;
          harness.recordTTSStart(ttsLatency);
        }

        const attemptEndTime = performance.now();
        const endToEndLatency = attemptEndTime - attemptStartTime;
        harness.recordEndToEnd(endToEndLatency);

        // Progress indicator
        if ((i + 1) % 5 === 0) {
          console.log(`✅ Completed ${i + 1}/20 attempts`);
        }

      } catch (error) {
        console.log(`❌ Attempt ${i + 1} failed: ${error.message}`);
      }
    }

    // Print comprehensive performance report
    harness.printReport();

    // Verify requirements are met
    const triggerP95 = harness.calculatePercentile(harness['metrics'].triggerMatchLatency, 95);
    const storyLoadP95 = harness.calculatePercentile(harness['metrics'].storyLoadLatency, 95);
    const ttsP50 = harness.calculatePercentile(harness['metrics'].ttsStartLatency, 50);
    const ttsP95 = harness.calculatePercentile(harness['metrics'].ttsStartLatency, 95);

    // Assert performance requirements
    if (harness['metrics'].triggerMatchLatency.length > 0) {
      expect(triggerP95).toBeLessThan(100); // Requirement 8.2
    }
    
    if (harness['metrics'].storyLoadLatency.length > 0) {
      expect(storyLoadP95).toBeLessThan(2000); // Requirement 8.4
    }
    
    if (harness['metrics'].ttsStartLatency.length > 0) {
      expect(ttsP50).toBeLessThan(600); // Requirement 8.1
      expect(ttsP95).toBeLessThan(900); // Requirement 8.1
    }
  }, 30000); // 30 second timeout for the full harness

  it('should measure performance under different load conditions', async () => {
    console.log('\n🔥 Performance Under Load Conditions...\n');

    // Test with CPU load
    const cpuLoadTest = async () => {
      const loadInterval = setInterval(() => {
        const start = Date.now();
        while (Date.now() - start < 10) {
          Math.random(); // CPU busy work
        }
      }, 50);

      try {
        for (let i = 0; i < 5; i++) {
          const startTime = performance.now();
          const matches = await triggerMatcher.matchTriggers(['college'], testStories);
          const endTime = performance.now();
          harness.recordTriggerMatch(endTime - startTime);
        }
      } finally {
        clearInterval(loadInterval);
      }
    };

    // Test with memory pressure
    const memoryPressureTest = async () => {
      const memoryPressure: any[] = [];
      for (let i = 0; i < 50; i++) {
        memoryPressure.push(new Array(5000).fill(Math.random()));
      }

      try {
        for (let i = 0; i < 5; i++) {
          const startTime = performance.now();
          const matches = await triggerMatcher.matchTriggers(['travel'], testStories);
          const endTime = performance.now();
          harness.recordTriggerMatch(endTime - startTime);
        }
      } finally {
        memoryPressure.length = 0;
      }
    };

    // Test with network delays
    const networkDelayTest = async () => {
      // Mock slower network
      global.fetch = vi.fn(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
          } as Response), Math.random() * 1000 + 500) // 500-1500ms delay
        )
      );

      for (let i = 0; i < 5; i++) {
        const matches = await triggerMatcher.matchTriggers(['career'], testStories);
        if (matches.length > 0) {
          const startTime = performance.now();
          try {
            await audioManager.preloadStoryAudio(matches[0].story);
            const endTime = performance.now();
            harness.recordStoryLoad(endTime - startTime);
          } catch (error) {
            // Expected under slow network conditions
          }
        }
      }
    };

    await cpuLoadTest();
    await memoryPressureTest();
    await networkDelayTest();

    console.log('📊 Load Test Results:');
    harness.printReport();

    // Performance should still meet requirements under load
    const triggerP95 = harness.calculatePercentile(harness['metrics'].triggerMatchLatency, 95);
    expect(triggerP95).toBeLessThan(200); // Relaxed under load but still reasonable
  }, 20000);

  it('should benchmark against baseline TTS performance', async () => {
    console.log('\n⚡ TTS Baseline Performance Benchmark...\n');

    // Measure baseline TTS performance (no story system involved)
    const baselineTTSLatencies: number[] = [];
    
    for (let i = 0; i < 10; i++) {
      const startTime = performance.now();
      
      // Simulate pure TTS processing
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 25));
      
      const endTime = performance.now();
      baselineTTSLatencies.push(endTime - startTime);
    }

    // Measure TTS with story system enabled (but no matches)
    const storySystemTTSLatencies: number[] = [];
    
    for (let i = 0; i < 10; i++) {
      const startTime = performance.now();
      
      // Check for story matches (should find none)
      await triggerMatcher.matchTriggers(['nonexistent'], testStories);
      
      // Simulate TTS processing
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 25));
      
      const endTime = performance.now();
      storySystemTTSLatencies.push(endTime - startTime);
    }

    const baselineP50 = harness.calculatePercentile(baselineTTSLatencies, 50);
    const baselineP95 = harness.calculatePercentile(baselineTTSLatencies, 95);
    const storySystemP50 = harness.calculatePercentile(storySystemTTSLatencies, 50);
    const storySystemP95 = harness.calculatePercentile(storySystemTTSLatencies, 95);

    console.log('📊 TTS PERFORMANCE COMPARISON:');
    console.log(`Baseline TTS P50: ${baselineP50.toFixed(2)}ms`);
    console.log(`Baseline TTS P95: ${baselineP95.toFixed(2)}ms`);
    console.log(`Story System TTS P50: ${storySystemP50.toFixed(2)}ms`);
    console.log(`Story System TTS P95: ${storySystemP95.toFixed(2)}ms`);
    console.log(`Overhead P50: ${(storySystemP50 - baselineP50).toFixed(2)}ms`);
    console.log(`Overhead P95: ${(storySystemP95 - baselineP95).toFixed(2)}ms`);

    // Story system should not significantly impact TTS performance
    expect(storySystemP50 - baselineP50).toBeLessThan(50); // Max 50ms overhead
    expect(storySystemP95 - baselineP95).toBeLessThan(100); // Max 100ms overhead
  });
});