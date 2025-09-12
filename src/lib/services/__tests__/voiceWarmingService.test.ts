/**
 * Voice Warming Service Tests
 * Task 10: Optimize ElevenLabs integration with voice warming
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { voiceWarmingService, VoiceWarmingService } from '../voiceWarmingService';

// Mock fetch globally
global.fetch = vi.fn();

// Mock environment variables
const mockEnv = {
  ELEVENLABS_API_KEY: 'test-api-key',
  JONATHAN_DEMO_VOICE_ID: 'test-voice-id'
};

describe('VoiceWarmingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    Object.assign(process.env, mockEnv);
    
    // Clear the singleton instance to ensure clean state
    (VoiceWarmingService as any).instance = null;
    
    // Mock successful fetch response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Voice Session Warming', () => {
    it('should warm voice session with 1-word synthesis', async () => {
      const service = VoiceWarmingService.getInstance();
      const voiceId = 'test-voice-id';
      
      await service.warmVoiceSession(voiceId);
      
      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'xi-api-key': 'test-api-key',
            'Content-Type': 'application/json'
          },
          body: expect.stringContaining('"text":"Hi"')
        })
      );
    });

    it('should cache warmed sessions and avoid duplicate warming', async () => {
      const service = VoiceWarmingService.getInstance();
      const voiceId = 'cache-test-voice-id';
      
      // First warming
      await service.warmVoiceSession(voiceId);
      const firstCallCount = (global.fetch as any).mock.calls.length;
      
      // Second warming should use cache
      await service.warmVoiceSession(voiceId);
      const secondCallCount = (global.fetch as any).mock.calls.length;
      
      expect(secondCallCount).toBe(firstCallCount); // No additional calls
      expect(service.isVoiceWarmed(voiceId)).toBe(true);
    });

    it('should handle warming failures gracefully', async () => {
      const service = VoiceWarmingService.getInstance();
      const voiceId = 'failure-test-voice-id';
      
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));
      
      // Should not throw
      await expect(service.warmVoiceSession(voiceId)).resolves.toBeUndefined();
      
      expect(service.isVoiceWarmed(voiceId)).toBe(false);
    });

    it('should handle warming timeout', async () => {
      const service = VoiceWarmingService.getInstance();
      const voiceId = 'timeout-test-voice-id';
      
      // Mock timeout error
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'AbortError';
      (global.fetch as any).mockRejectedValueOnce(timeoutError);
      
      await service.warmVoiceSession(voiceId);
      
      expect(service.isVoiceWarmed(voiceId)).toBe(false);
    });
  });

  describe('Voice Model Caching', () => {
    it('should return cached voice config for warmed sessions', async () => {
      const service = VoiceWarmingService.getInstance();
      const voiceId = 'cached-config-test-voice-id';
      
      await service.warmVoiceSession(voiceId);
      
      const cachedConfig = service.getCachedVoiceConfig(voiceId);
      expect(cachedConfig).toBeTruthy();
      expect(cachedConfig?.model_id).toBe('eleven_multilingual_v2');
    });

    it('should return null for non-warmed sessions', () => {
      const service = VoiceWarmingService.getInstance();
      const voiceId = 'non-warmed-voice';
      
      const cachedConfig = service.getCachedVoiceConfig(voiceId);
      expect(cachedConfig).toBeNull();
    });

    it('should provide optimized config with delay estimates', async () => {
      const service = VoiceWarmingService.getInstance();
      const voiceId = 'delay-estimate-test-voice-id';
      
      // Test cold session
      const coldConfig = await service.getOptimizedVoiceConfig(voiceId);
      expect(coldConfig.isWarmed).toBe(false);
      expect(coldConfig.estimatedDelay).toBeGreaterThan(200);
      
      // Warm the session
      await service.warmVoiceSession(voiceId);
      
      // Test warmed session
      const warmedConfig = await service.getOptimizedVoiceConfig(voiceId);
      expect(warmedConfig.isWarmed).toBe(true);
      expect(warmedConfig.estimatedDelay).toBeLessThan(200);
    });
  });

  describe('Text Fallback', () => {
    it('should create text-only fallback response', () => {
      const service = VoiceWarmingService.getInstance();
      const text = 'Test message';
      const error = 'TTS service unavailable';
      
      const fallback = service.createTextFallbackResponse(text, error);
      
      expect(fallback).toEqual({
        error: 'TTS_UNAVAILABLE',
        message: 'Voice synthesis temporarily unavailable',
        text: text,
        fallback: true,
        estimatedDelay: 0
      });
    });

    it('should handle fallback without error message', () => {
      const service = VoiceWarmingService.getInstance();
      const text = 'Test message';
      
      const fallback = service.createTextFallbackResponse(text);
      
      expect(fallback.fallback).toBe(true);
      expect(fallback.text).toBe(text);
      expect(fallback.estimatedDelay).toBe(0);
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track warming metrics', async () => {
      const service = VoiceWarmingService.getInstance();
      const voiceId = 'metrics-test-voice-id';
      
      const initialMetrics = service.getMetrics();
      const initialAttempts = initialMetrics.warmingAttempts;
      
      await service.warmVoiceSession(voiceId);
      
      const updatedMetrics = service.getMetrics();
      expect(updatedMetrics.warmingAttempts).toBe(initialAttempts + 1);
      expect(updatedMetrics.warmingSuccesses).toBeGreaterThan(initialMetrics.warmingSuccesses);
      expect(updatedMetrics.activeSessions).toBeGreaterThan(0);
    });

    it('should track cache hits and misses', async () => {
      const service = VoiceWarmingService.getInstance();
      const voiceId = 'cache-metrics-test-voice-id';
      
      const initialMetrics = service.getMetrics();
      
      // First call should be cache miss
      await service.warmVoiceSession(voiceId);
      let metrics = service.getMetrics();
      expect(metrics.cacheMisses).toBeGreaterThan(initialMetrics.cacheMisses);
      
      // Second call should be cache hit
      await service.warmVoiceSession(voiceId);
      metrics = service.getMetrics();
      expect(metrics.cacheHits).toBeGreaterThan(initialMetrics.cacheHits);
    });

    it('should track warming failures', async () => {
      const service = VoiceWarmingService.getInstance();
      const voiceId = 'failure-metrics-test-voice-id';
      
      const initialMetrics = service.getMetrics();
      
      (global.fetch as any).mockRejectedValueOnce(new Error('API error'));
      
      await service.warmVoiceSession(voiceId);
      
      const metrics = service.getMetrics();
      expect(metrics.warmingFailures).toBeGreaterThan(initialMetrics.warmingFailures);
    });
  });

  describe('Session Management', () => {
    it('should clean up expired sessions', async () => {
      const service = VoiceWarmingService.getInstance();
      const voiceId = 'expiry-test-voice-id';
      
      await service.warmVoiceSession(voiceId);
      expect(service.isVoiceWarmed(voiceId)).toBe(true);
      
      // Mock expired session by manipulating time
      const serviceInternal = service as any;
      const session = serviceInternal.sessions.get(voiceId);
      if (session) {
        session.warmedAt = Date.now() - (31 * 60 * 1000); // 31 minutes ago
      }
      
      expect(service.isVoiceWarmed(voiceId)).toBe(false);
    });

    it('should handle missing API key gracefully', async () => {
      delete process.env.ELEVENLABS_API_KEY;
      
      const service = VoiceWarmingService.getInstance();
      const voiceId = 'no-api-key-test-voice-id';
      
      const initialCallCount = (global.fetch as any).mock.calls.length;
      
      // Should not throw and should not make additional API calls
      await service.warmVoiceSession(voiceId);
      
      const finalCallCount = (global.fetch as any).mock.calls.length;
      expect(finalCallCount).toBe(initialCallCount); // No new calls
      expect(service.isVoiceWarmed(voiceId)).toBe(false);
    });
  });

  describe('Performance Requirements', () => {
    it('should target <200ms first-audio delay for warmed sessions', async () => {
      const service = VoiceWarmingService.getInstance();
      const voiceId = 'performance-test-voice-id';
      
      await service.warmVoiceSession(voiceId);
      
      const config = await service.getOptimizedVoiceConfig(voiceId);
      expect(config.estimatedDelay).toBeLessThan(200);
    });

    it('should not block on warming failures', async () => {
      const service = VoiceWarmingService.getInstance();
      const voiceId = 'slow-response-test-voice-id';
      
      // Mock slow response
      (global.fetch as any).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
        }), 1000))
      );
      
      const startTime = Date.now();
      await service.warmVoiceSession(voiceId);
      const duration = Date.now() - startTime;
      
      // Should complete within reasonable time even with slow response
      expect(duration).toBeLessThan(6000); // Max warming time + buffer
    });
  });

  describe('Integration Requirements', () => {
    it('should ensure streaming starts immediately for warmed sessions', async () => {
      const service = VoiceWarmingService.getInstance();
      const voiceId = 'streaming-test-voice-id';
      
      await service.warmVoiceSession(voiceId);
      
      const config = await service.getOptimizedVoiceConfig(voiceId);
      
      // Warmed session should have immediate availability
      expect(config.isWarmed).toBe(true);
      expect(config.config.optimize_streaming_latency).toBeGreaterThanOrEqual(2);
    });

    it('should never await deep lane completion', async () => {
      // This is more of an architectural test - the service should not have
      // any dependencies on deep lane processing
      const service = VoiceWarmingService.getInstance();
      const voiceId = 'deep-lane-independence-test-voice-id';
      
      const startTime = Date.now();
      await service.warmVoiceSession(voiceId);
      const duration = Date.now() - startTime;
      
      // Warming should complete quickly, not wait for any external processing
      expect(duration).toBeLessThan(1000);
    });
  });
});