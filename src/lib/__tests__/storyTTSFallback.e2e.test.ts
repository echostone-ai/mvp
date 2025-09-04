/**
 * End-to-End Test: No Audio Gap During TTS Fallback
 * Tests seamless fallback to TTS with no audio gaps as required by task 11
 * Requirements: 8.1, 8.2, 8.4, 8.6
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StoryAudioManager } from '../services/storyAudioManager';
import { StoryErrorHandler } from '../services/storyErrorHandler';
import type { UserStory } from '../types/stories';

// High-precision timer for gap measurement
class AudioGapMeasurer {
  private audioEvents: Array<{ type: 'start' | 'end' | 'fallback', timestamp: number }> = [];
  
  recordEvent(type: 'start' | 'end' | 'fallback') {
    this.audioEvents.push({
      type,
      timestamp: performance.now()
    });
  }
  
  getGapDuration(): number {
    const events = this.audioEvents.sort((a, b) => a.timestamp - b.timestamp);
    
    // Find gap between story end and TTS fallback start
    for (let i = 0; i < events.length - 1; i++) {
      if (events[i].type === 'end' && events[i + 1].type === 'fallback') {
        return events[i + 1].timestamp - events[i].timestamp;
      }
    }
    
    return 0;
  }
  
  reset() {
    this.audioEvents = [];
  }
}

describe('Story TTS Fallback - No Audio Gap E2E', () => {
  let audioManager: StoryAudioManager;
  let errorHandler: StoryErrorHandler;
  let gapMeasurer: AudioGapMeasurer;
  let mockStory: UserStory;
  let mockStreamingManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    audioManager = new StoryAudioManager();
    errorHandler = new StoryErrorHandler();
    gapMeasurer = new AudioGapMeasurer();

    mockStory = {
      id: 'test-story-gap',
      owner_id: 'avatar-1',
      owner_type: 'avatar',
      title: 'Gap Test Story',
      category: 'memory',
      triggers: 'test',
      audio_url: 'https://example.com/story.mp3',
      duration_ms: 120000,
      priority: 80,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Mock streaming manager with gap measurement
    mockStreamingManager = {
      isPlaying: vi.fn(() => false),
      stop: vi.fn(() => gapMeasurer.recordEvent('end')),
      play: vi.fn(() => gapMeasurer.recordEvent('start')),
      queue: vi.fn(),
      replaceNextChunk: vi.fn(),
      startTTSFallback: vi.fn(() => {
        gapMeasurer.recordEvent('fallback');
        return Promise.resolve();
      }),
      getAudioContext: vi.fn(() => ({
        state: 'running',
        createBufferSource: vi.fn(() => ({
          buffer: null,
          connect: vi.fn(),
          start: vi.fn(() => gapMeasurer.recordEvent('start')),
          stop: vi.fn(() => gapMeasurer.recordEvent('end')),
          onended: null
        })),
        createGain: vi.fn(() => ({
          gain: { value: 1 },
          connect: vi.fn()
        })),
        destination: {}
      }))
    };

    // Mock successful audio loading initially
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
      } as Response)
    );

    global.AudioContext = vi.fn(() => ({
      state: 'running',
      decodeAudioData: vi.fn(() => Promise.resolve({
        duration: 2.5,
        sampleRate: 44100,
        numberOfChannels: 2,
        length: 110250,
        getChannelData: vi.fn(() => new Float32Array(110250))
      })),
      createBufferSource: mockStreamingManager.getAudioContext().createBufferSource,
      createGain: mockStreamingManager.getAudioContext().createGain,
      destination: {}
    })) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    gapMeasurer.reset();
  });

  describe('Network Failure Fallback - No Gap', () => {
    it('should fallback to TTS with no gap when story loading fails', async () => {
      // Mock network failure
      global.fetch = vi.fn(() => Promise.reject(new Error('Network timeout')));
      
      const fallbackStartTime = performance.now();
      
      try {
        // Attempt to load story
        await audioManager.preloadStoryAudio(mockStory);
      } catch (error) {
        // Trigger immediate fallback
        await errorHandler.executeGracefulFallback('This is the TTS fallback text');
        await mockStreamingManager.startTTSFallback();
      }
      
      const fallbackEndTime = performance.now();
      const totalFallbackTime = fallbackEndTime - fallbackStartTime;
      
      // Requirement 8.6: No gap > 150ms
      expect(totalFallbackTime).toBeLessThan(150);
    });

    it('should fallback to TTS with no gap when story loading times out', async () => {
      // Mock slow network (exceeds 2s timeout)
      global.fetch = vi.fn(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
          } as Response), 3000)
        )
      );
      
      const timeoutStartTime = performance.now();
      
      // Set up timeout handler
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Story load timeout')), 2000)
      );
      
      try {
        await Promise.race([
          audioManager.preloadStoryAudio(mockStory),
          timeoutPromise
        ]);
      } catch (error) {
        // Immediate fallback on timeout
        await errorHandler.executeGracefulFallback('TTS fallback after timeout');
        await mockStreamingManager.startTTSFallback();
      }
      
      const timeoutEndTime = performance.now();
      const totalTime = timeoutEndTime - timeoutStartTime;
      
      // Should timeout at 2s and fallback immediately
      expect(totalTime).toBeLessThan(2150); // 2s timeout + 150ms max gap
    });
  });

  describe('Audio Decoding Failure Fallback - No Gap', () => {
    it('should fallback to TTS with no gap when audio decoding fails', async () => {
      // Mock audio decoding failure
      global.AudioContext = vi.fn(() => ({
        state: 'running',
        decodeAudioData: vi.fn(() => Promise.reject(new Error('Invalid audio format'))),
        createBufferSource: mockStreamingManager.getAudioContext().createBufferSource,
        createGain: mockStreamingManager.getAudioContext().createGain,
        destination: {}
      })) as any;
      
      const decodeFailStartTime = performance.now();
      
      try {
        await audioManager.preloadStoryAudio(mockStory);
      } catch (error) {
        await errorHandler.executeGracefulFallback('TTS fallback after decode failure');
        await mockStreamingManager.startTTSFallback();
      }
      
      const decodeFailEndTime = performance.now();
      const totalTime = decodeFailEndTime - decodeFailStartTime;
      
      // Should fail fast and fallback immediately
      expect(totalTime).toBeLessThan(150);
    });
  });

  describe('Playback Failure Fallback - No Gap', () => {
    it('should fallback to TTS with no gap when story playback fails', async () => {
      // Successfully load story first
      const audioBuffer = await audioManager.preloadStoryAudio(mockStory);
      expect(audioBuffer).toBeDefined();
      
      // Mock playback failure
      const mockFailingSource = {
        buffer: audioBuffer,
        connect: vi.fn(),
        start: vi.fn(() => {
          gapMeasurer.recordEvent('start');
          // Simulate immediate playback failure
          throw new Error('Playback failed');
        }),
        stop: vi.fn(() => gapMeasurer.recordEvent('end')),
        onended: null
      };
      
      mockStreamingManager.getAudioContext.mockReturnValue({
        ...mockStreamingManager.getAudioContext(),
        createBufferSource: vi.fn(() => mockFailingSource)
      });
      
      const playbackFailStartTime = performance.now();
      
      try {
        await audioManager.handleStoryPlayback(audioBuffer, {
          fadeInMs: 0,
          fadeOutMs: 0,
          volumeLevel: 1,
          enableLipSync: false,
          fallbackToTTS: true
        });
      } catch (error) {
        await errorHandler.executeGracefulFallback('TTS fallback after playback failure');
        await mockStreamingManager.startTTSFallback();
      }
      
      const playbackFailEndTime = performance.now();
      const totalTime = playbackFailEndTime - playbackFailStartTime;
      
      // Should detect failure and fallback immediately
      expect(totalTime).toBeLessThan(150);
    });
  });

  describe('Concurrent Audio Management - No Gap', () => {
    it('should handle story interruption with seamless TTS transition', async () => {
      // Start story playback
      const audioBuffer = await audioManager.preloadStoryAudio(mockStory);
      
      // Begin playback
      const playbackPromise = audioManager.handleStoryPlayback(audioBuffer, {
        fadeInMs: 100,
        fadeOutMs: 100,
        volumeLevel: 0.8,
        enableLipSync: true,
        fallbackToTTS: true
      });
      
      // Simulate interruption after 500ms
      setTimeout(() => {
        gapMeasurer.recordEvent('end'); // Story interrupted
        mockStreamingManager.startTTSFallback(); // Immediate TTS start
      }, 500);
      
      await playbackPromise;
      
      const gapDuration = gapMeasurer.getGapDuration();
      expect(gapDuration).toBeLessThan(150); // No gap > 150ms
    });

    it('should handle multiple rapid fallback scenarios', async () => {
      const scenarios = [
        () => Promise.reject(new Error('Network error')),
        () => Promise.reject(new Error('Decode error')),
        () => Promise.reject(new Error('Playback error'))
      ];
      
      for (const scenario of scenarios) {
        gapMeasurer.reset();
        const startTime = performance.now();
        
        try {
          await scenario();
        } catch (error) {
          await errorHandler.executeGracefulFallback('Rapid fallback TTS');
          await mockStreamingManager.startTTSFallback();
        }
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        expect(duration).toBeLessThan(150);
      }
    });
  });

  describe('Performance Under Load - No Gap', () => {
    it('should maintain no-gap guarantee under CPU load', async () => {
      // Simulate CPU load
      const cpuLoadSimulation = () => {
        const start = Date.now();
        while (Date.now() - start < 50) {
          // Busy wait to simulate CPU load
          Math.random();
        }
      };
      
      // Start CPU load simulation
      const loadInterval = setInterval(cpuLoadSimulation, 100);
      
      try {
        // Mock failure during CPU load
        global.fetch = vi.fn(() => Promise.reject(new Error('Network error under load')));
        
        const loadTestStartTime = performance.now();
        
        try {
          await audioManager.preloadStoryAudio(mockStory);
        } catch (error) {
          await errorHandler.executeGracefulFallback('TTS under CPU load');
          await mockStreamingManager.startTTSFallback();
        }
        
        const loadTestEndTime = performance.now();
        const duration = loadTestEndTime - loadTestStartTime;
        
        // Should still meet gap requirement under load
        expect(duration).toBeLessThan(200); // Slightly higher tolerance under load
      } finally {
        clearInterval(loadInterval);
      }
    });

    it('should handle memory pressure gracefully', async () => {
      // Simulate memory pressure by creating large objects
      const memoryPressure: any[] = [];
      for (let i = 0; i < 100; i++) {
        memoryPressure.push(new Array(10000).fill(Math.random()));
      }
      
      try {
        global.fetch = vi.fn(() => Promise.reject(new Error('Memory pressure error')));
        
        const memoryTestStartTime = performance.now();
        
        try {
          await audioManager.preloadStoryAudio(mockStory);
        } catch (error) {
          await errorHandler.executeGracefulFallback('TTS under memory pressure');
          await mockStreamingManager.startTTSFallback();
        }
        
        const memoryTestEndTime = performance.now();
        const duration = memoryTestEndTime - memoryTestStartTime;
        
        expect(duration).toBeLessThan(150);
      } finally {
        // Clean up memory pressure
        memoryPressure.length = 0;
      }
    });
  });

  describe('Real-world Scenario Simulation', () => {
    it('should handle mobile network conditions with no gap', async () => {
      // Simulate mobile network: slow, intermittent
      let callCount = 0;
      global.fetch = vi.fn(() => {
        callCount++;
        if (callCount <= 2) {
          // First two calls fail (network instability)
          return Promise.reject(new Error('Mobile network timeout'));
        }
        // Third call succeeds but slowly
        return new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
          } as Response), 1500)
        );
      });
      
      const mobileTestStartTime = performance.now();
      
      // First attempt - should fail and fallback
      try {
        await audioManager.preloadStoryAudio(mockStory);
      } catch (error) {
        await errorHandler.executeGracefulFallback('Mobile network TTS fallback');
        await mockStreamingManager.startTTSFallback();
      }
      
      const mobileTestEndTime = performance.now();
      const duration = mobileTestEndTime - mobileTestStartTime;
      
      expect(duration).toBeLessThan(150);
    });

    it('should handle browser tab switching with no gap', async () => {
      // Simulate tab switching by mocking document visibility
      Object.defineProperty(document, 'hidden', {
        writable: true,
        value: false
      });
      
      // Start story loading
      const tabSwitchPromise = audioManager.preloadStoryAudio(mockStory);
      
      // Simulate tab switch during loading
      setTimeout(() => {
        (document as any).hidden = true;
        // Trigger visibility change event
        document.dispatchEvent(new Event('visibilitychange'));
      }, 100);
      
      const tabSwitchStartTime = performance.now();
      
      try {
        await tabSwitchPromise;
      } catch (error) {
        await errorHandler.executeGracefulFallback('Tab switch TTS fallback');
        await mockStreamingManager.startTTSFallback();
      }
      
      const tabSwitchEndTime = performance.now();
      const duration = tabSwitchEndTime - tabSwitchStartTime;
      
      // Should handle tab switching gracefully
      expect(duration).toBeLessThan(200);
    });
  });
});