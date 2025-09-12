import { describe, it, expect } from 'vitest';
import {
  getEnhancedVoiceConfig,
  getFallbackVoiceConfig,
  createEnhancedVoiceRequest,
  PREMIUM_VOICE_CONFIG,
  HIGH_QUALITY_FALLBACK_CONFIG,
  STANDARD_FALLBACK_CONFIG
} from '../enhancedVoiceConfig';

describe('Enhanced Voice Configuration', () => {
  describe('getEnhancedVoiceConfig', () => {
    it('should return premium voice configuration', () => {
      const config = getEnhancedVoiceConfig();
      
      expect(config).toEqual(PREMIUM_VOICE_CONFIG);
      expect(config.output_format).toBe('mp3_44100_128');
      expect(config.optimize_streaming_latency).toBe(3);
      expect(config.model_id).toBe('eleven_multilingual_v2');
    });

    it('should have voice settings optimized for quality', () => {
      const config = getEnhancedVoiceConfig();
      
      expect(config.voice_settings.stability).toBe(0.70);
      expect(config.voice_settings.similarity_boost).toBe(0.85);
      expect(config.voice_settings.style).toBe(0.00);
      expect(config.voice_settings.use_speaker_boost).toBe(false);
    });
  });

  describe('getFallbackVoiceConfig', () => {
    it('should return high-quality fallback for quality failure', () => {
      const config = getFallbackVoiceConfig('quality');
      
      expect(config).toEqual(HIGH_QUALITY_FALLBACK_CONFIG);
      expect(config.output_format).toBe('mp3_44100_64');
      expect(config.optimize_streaming_latency).toBe(2);
    });

    it('should return latency-optimized config for latency failure', () => {
      const config = getFallbackVoiceConfig('latency');
      
      expect(config.output_format).toBe('mp3_44100_128');
      expect(config.optimize_streaming_latency).toBe(2);
    });

    it('should return standard fallback for compatibility failure', () => {
      const config = getFallbackVoiceConfig('compatibility');
      
      expect(config).toEqual(STANDARD_FALLBACK_CONFIG);
      expect(config.output_format).toBe('mp3_22050_64');
      expect(config.model_id).toBe('eleven_monolingual_v1');
    });
  });

  describe('createEnhancedVoiceRequest', () => {
    it('should create proper request body with enhanced config', () => {
      const text = 'Hello, this is a test.';
      const voiceId = 'test-voice-id';
      
      const request = createEnhancedVoiceRequest(text, voiceId);
      
      expect(request.text).toBe(text);
      expect(request.voice_settings).toEqual(PREMIUM_VOICE_CONFIG.voice_settings);
      expect(request.model_id).toBe(PREMIUM_VOICE_CONFIG.model_id);
      expect(request.optimize_streaming_latency).toBe(PREMIUM_VOICE_CONFIG.optimize_streaming_latency);
      expect(request.output_format).toBe(PREMIUM_VOICE_CONFIG.output_format);
      expect(request.apply_text_normalization).toBe('auto');
    });

    it('should include conversation seed when conversationId provided', () => {
      const text = 'Hello, this is a test.';
      const voiceId = 'test-voice-id';
      const conversationId = 'test-conversation';
      
      const request = createEnhancedVoiceRequest(text, voiceId, PREMIUM_VOICE_CONFIG, conversationId);
      
      expect(request.seed).toBeDefined();
      expect(typeof request.seed).toBe('number');
      expect(request.seed).toBeGreaterThanOrEqual(0);
      expect(request.seed).toBeLessThan(10000);
    });

    it('should generate consistent seed for same conversation', () => {
      const text = 'Hello, this is a test.';
      const voiceId = 'test-voice-id';
      const conversationId = 'test-conversation';
      
      const request1 = createEnhancedVoiceRequest(text, voiceId, PREMIUM_VOICE_CONFIG, conversationId);
      const request2 = createEnhancedVoiceRequest(text, voiceId, PREMIUM_VOICE_CONFIG, conversationId);
      
      expect(request1.seed).toBe(request2.seed);
    });

    it('should use custom config when provided', () => {
      const text = 'Hello, this is a test.';
      const voiceId = 'test-voice-id';
      const customConfig = HIGH_QUALITY_FALLBACK_CONFIG;
      
      const request = createEnhancedVoiceRequest(text, voiceId, customConfig);
      
      expect(request.voice_settings).toEqual(customConfig.voice_settings);
      expect(request.output_format).toBe(customConfig.output_format);
      expect(request.optimize_streaming_latency).toBe(customConfig.optimize_streaming_latency);
    });
  });

  describe('Configuration Quality Standards', () => {
    it('should meet premium quality requirements', () => {
      const config = PREMIUM_VOICE_CONFIG;
      
      // Check sample rate is 44.1kHz
      expect(config.output_format).toContain('44100');
      
      // Check bitrate is ≥64kbps (128kbps in this case)
      expect(config.output_format).toContain('128');
      
      // Check latency mode is 3
      expect(config.optimize_streaming_latency).toBe(3);
      
      // Check model is multilingual v2
      expect(config.model_id).toBe('eleven_multilingual_v2');
    });

    it('should meet fallback quality requirements', () => {
      const config = HIGH_QUALITY_FALLBACK_CONFIG;
      
      // Check sample rate is 44.1kHz
      expect(config.output_format).toContain('44100');
      
      // Check bitrate is ≥64kbps
      expect(config.output_format).toContain('64');
      
      // Check latency mode is reasonable
      expect(config.optimize_streaming_latency).toBeGreaterThanOrEqual(1);
      expect(config.optimize_streaming_latency).toBeLessThanOrEqual(3);
    });

    it('should maintain minimum quality in standard fallback', () => {
      const config = STANDARD_FALLBACK_CONFIG;
      
      // Even standard fallback should maintain 64kbps minimum
      expect(config.output_format).toContain('64');
      
      // Should use reliable model
      expect(config.model_id).toBe('eleven_monolingual_v1');
    });
  });
});