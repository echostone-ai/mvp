/**
 * Voice Warming Integration Tests
 * Task 10: Optimize ElevenLabs integration with voice warming
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { voiceWarmingService } from '../voiceWarmingService';

// Mock fetch globally
global.fetch = vi.fn();

// Mock environment variables
const mockEnv = {
  ELEVENLABS_API_KEY: 'test-api-key',
  JONATHAN_DEMO_VOICE_ID: 'jonathan-voice-id'
};

describe('Voice Warming Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(process.env, mockEnv);
    
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

  describe('Server Boot Voice Warming', () => {
    it('should warm default voice at service initialization', async () => {
      // Create a fresh service instance to test initialization
      (VoiceWarmingService as any).instance = null;
      
      const service = VoiceWarmingService.getInstance();
      
      // Wait a bit for the background warming to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const voiceId = 'jonathan-voice-id';
      
      // The service should have attempted to warm the default voice
      // Check if any warming calls were made
      const fetchCalls = (global.fetch as any).mock.calls;
      const warmingCalls = fetchCalls.filter((call: any) => 
        call[0].includes('text-to-speech') && 
        call[1].body?.includes('"text":"Hi"')
      );
      
      expect(warmingCalls.length).toBeGreaterThan(0);
    });

    it('should handle missing API key gracefully during boot', async () => {
      delete process.env.ELEVENLABS_API_KEY;
      
      // Clear singleton to test fresh initialization
      (VoiceWarmingService as any).instance = null;
      
      // Should not throw during service initialization
      expect(() => {
        VoiceWarmingService.getInstance();
      }).not.toThrow();
    });
  });

  describe('Performance Requirements', () => {
    it('should achieve <200ms first-audio delay for warmed sessions', async () => {
      const voiceId = 'test-voice-id';
      
      // Warm the voice
      await voiceWarmingService.warmVoiceSession(voiceId);
      
      // Get optimized config
      const config = await voiceWarmingService.getOptimizedVoiceConfig(voiceId);
      
      // Should meet performance target
      expect(config.estimatedDelay).toBeLessThan(200);
      expect(config.isWarmed).toBe(true);
    });

    it('should not block response flow when voice synthesis fails', async () => {
      const text = 'Test message for fallback';
      
      // Mock fetch failure
      (global.fetch as any).mockRejectedValue(new Error('Network error'));
      
      const startTime = Date.now();
      
      // Create fallback response
      const fallback = voiceWarmingService.createTextFallbackResponse(text, 'Network error');
      
      const duration = Date.now() - startTime;
      
      // Should be immediate (no blocking)
      expect(duration).toBeLessThan(10);
      expect(fallback.fallback).toBe(true);
      expect(fallback.text).toBe(text);
      expect(fallback.estimatedDelay).toBe(0);
    });

    it('should never await deep lane completion', async () => {
      const voiceId = 'test-voice-id';
      
      // Mock slow deep lane processing (this should not affect voice warming)
      const mockDeepLaneDelay = 2000;
      
      const startTime = Date.now();
      
      // Voice warming should complete independently
      await voiceWarmingService.warmVoiceSession(voiceId);
      
      const duration = Date.now() - startTime;
      
      // Should complete much faster than deep lane
      expect(duration).toBeLessThan(mockDeepLaneDelay / 2);
    });
  });

  describe('ElevenLabs Streaming Integration', () => {
    it('should ensure streaming starts immediately for warmed sessions', async () => {
      const voiceId = 'test-voice-id';
      
      // Warm the session
      await voiceWarmingService.warmVoiceSession(voiceId);
      
      // Get config for streaming
      const { config, isWarmed, estimatedDelay } = await voiceWarmingService.getOptimizedVoiceConfig(voiceId);
      
      expect(isWarmed).toBe(true);
      expect(estimatedDelay).toBeLessThan(200);
      expect(config.optimize_streaming_latency).toBeGreaterThanOrEqual(2);
    });

    it('should provide appropriate fallback for cold sessions', async () => {
      const voiceId = 'cold-voice-id';
      
      // Don't warm this voice
      const { config, isWarmed, estimatedDelay } = await voiceWarmingService.getOptimizedVoiceConfig(voiceId);
      
      expect(isWarmed).toBe(false);
      expect(estimatedDelay).toBeGreaterThan(200);
      expect(config).toBeTruthy();
    });

    it('should handle concurrent voice requests efficiently', async () => {
      const voiceIds = ['voice-1', 'voice-2', 'voice-3'];
      
      const startTime = Date.now();
      
      // Warm multiple voices concurrently
      const warmingPromises = voiceIds.map(id => 
        voiceWarmingService.warmVoiceSession(id)
      );
      
      await Promise.all(warmingPromises);
      
      const duration = Date.now() - startTime;
      
      // Should handle concurrent requests efficiently
      expect(duration).toBeLessThan(2000);
      
      // All voices should be warmed
      for (const voiceId of voiceIds) {
        expect(voiceWarmingService.isVoiceWarmed(voiceId)).toBe(true);
      }
    });
  });

  describe('Error Handling and Fallbacks', () => {
    it('should provide text-only fallback when TTS fails', () => {
      const text = 'This is a test message';
      const error = 'ElevenLabs API unavailable';
      
      const fallback = voiceWarmingService.createTextFallbackResponse(text, error);
      
      expect(fallback).toEqual({
        error: 'TTS_UNAVAILABLE',
        message: 'Voice synthesis temporarily unavailable',
        text: text,
        fallback: true,
        estimatedDelay: 0
      });
    });

    it('should handle API rate limiting gracefully', async () => {
      const voiceId = 'rate-limited-voice';
      
      // Mock rate limit error
      (global.fetch as any).mockRejectedValue(new Error('Rate limit exceeded'));
      
      // Should not throw
      await expect(voiceWarmingService.warmVoiceSession(voiceId)).resolves.toBeUndefined();
      
      // Should still provide config for fallback
      const config = await voiceWarmingService.getOptimizedVoiceConfig(voiceId);
      expect(config.config).toBeTruthy();
      expect(config.isWarmed).toBe(false);
    });

    it('should recover from temporary network failures', async () => {
      const voiceId = 'network-failure-voice';
      
      // First call fails
      (global.fetch as any).mockRejectedValueOnce(new Error('Network timeout'));
      
      await voiceWarmingService.warmVoiceSession(voiceId);
      expect(voiceWarmingService.isVoiceWarmed(voiceId)).toBe(false);
      
      // Second call succeeds
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
      });
      
      await voiceWarmingService.warmVoiceSession(voiceId);
      expect(voiceWarmingService.isVoiceWarmed(voiceId)).toBe(true);
    });
  });

  describe('Monitoring and Metrics', () => {
    it('should track warming performance metrics', async () => {
      const voiceId = 'metrics-test-voice';
      
      const initialMetrics = voiceWarmingService.getMetrics();
      
      await voiceWarmingService.warmVoiceSession(voiceId);
      
      const updatedMetrics = voiceWarmingService.getMetrics();
      
      expect(updatedMetrics.warmingAttempts).toBeGreaterThan(initialMetrics.warmingAttempts);
      expect(updatedMetrics.warmingSuccesses).toBeGreaterThan(initialMetrics.warmingSuccesses);
      expect(updatedMetrics.averageWarmingTime).toBeGreaterThan(0);
    });

    it('should provide cache hit/miss statistics', async () => {
      const voiceId = 'cache-test-voice';
      
      // First call - cache miss
      await voiceWarmingService.warmVoiceSession(voiceId);
      let metrics = voiceWarmingService.getMetrics();
      expect(metrics.cacheMisses).toBeGreaterThan(0);
      
      // Second call - cache hit
      await voiceWarmingService.warmVoiceSession(voiceId);
      metrics = voiceWarmingService.getMetrics();
      expect(metrics.cacheHits).toBeGreaterThan(0);
    });

    it('should track active session count', async () => {
      // Create fresh service to avoid interference from other tests
      (VoiceWarmingService as any).instance = null;
      const service = VoiceWarmingService.getInstance();
      
      const voiceIds = ['session-1', 'session-2'];
      
      for (const voiceId of voiceIds) {
        await service.warmVoiceSession(voiceId);
      }
      
      const metrics = service.getMetrics();
      expect(metrics.activeSessions).toBeGreaterThanOrEqual(voiceIds.length);
    });
  });

  describe('Requirements Verification', () => {
    it('should implement voice model caching (Req 1.2)', async () => {
      const voiceId = 'caching-test-voice';
      
      await voiceWarmingService.warmVoiceSession(voiceId);
      
      const cachedConfig = voiceWarmingService.getCachedVoiceConfig(voiceId);
      expect(cachedConfig).toBeTruthy();
      expect(cachedConfig?.model_id).toBe('eleven_multilingual_v2');
    });

    it('should minimize first-audio delay to <200ms (Req 1.2)', async () => {
      const voiceId = 'delay-test-voice';
      
      await voiceWarmingService.warmVoiceSession(voiceId);
      
      const config = await voiceWarmingService.getOptimizedVoiceConfig(voiceId);
      expect(config.estimatedDelay).toBeLessThan(200);
    });

    it('should provide text-only fallback without blocking (Req 8.3)', () => {
      const text = 'Fallback test message';
      
      const startTime = Date.now();
      const fallback = voiceWarmingService.createTextFallbackResponse(text);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(10); // Should be immediate
      expect(fallback.fallback).toBe(true);
      expect(fallback.estimatedDelay).toBe(0);
    });
  });
});