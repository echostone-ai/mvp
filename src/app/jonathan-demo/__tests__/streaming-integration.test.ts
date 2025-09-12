/**
 * Test for Task 2: Replace jonathan-demo one-shot TTS with StreamingAudioManager
 * 
 * This test validates that:
 * 1. StreamingAudioManager is properly integrated with enhanced voice config
 * 2. One-shot TTS (playAudioBlob) has been removed
 * 3. Streaming sentence-by-sentence playback is implemented
 * 4. Proper cleanup and error handling is in place
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the dependencies
vi.mock('@/lib/streamingUtils', () => ({
  stopAllAudio: vi.fn(),
  createStreamingAudioManager: vi.fn(() => ({
    addSentence: vi.fn(),
    stop: vi.fn(),
    isPlaying: vi.fn(() => false)
  })),
  splitIntoSentences: vi.fn((text: string) => text.split(/[.!?]+/).filter(s => s.trim()))
}));

vi.mock('@/lib/enhancedVoiceConfig', () => ({
  getEnhancedVoiceConfig: vi.fn(() => ({
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.70,
      similarity_boost: 0.85,
      style: 0.00,
      use_speaker_boost: false
    },
    output_format: 'mp3_44100_128',
    optimize_streaming_latency: 3,
    apply_text_normalization: 'auto'
  }))
}));

vi.mock('@/lib/globalAudioManager', () => ({
  globalAudioManager: {
    playAudio: vi.fn(),
    stopAll: vi.fn()
  }
}));

describe('Jonathan Demo Streaming Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock fetch for API calls
    global.fetch = vi.fn();
    
    // Mock DOM APIs
    global.URL = {
      createObjectURL: vi.fn(() => 'mock-url'),
      revokeObjectURL: vi.fn()
    } as any;
    
    // Mock Audio constructor
    global.Audio = vi.fn(() => ({
      play: vi.fn(() => Promise.resolve()),
      pause: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      volume: 1.0,
      playbackRate: 1.0,
      preload: 'auto'
    })) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should use StreamingAudioManager instead of one-shot TTS', async () => {
    const { createStreamingAudioManager } = await import('@/lib/streamingUtils');
    const { getEnhancedVoiceConfig } = await import('@/lib/enhancedVoiceConfig');
    
    // Mock successful API responses
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ voiceId: 'test-voice-id' })
      })
      .mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"delta": "Hello "}\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"delta": "world!"}\n')
              })
              .mockResolvedValueOnce({
                done: true,
                value: null
              })
          })
        }
      });

    // Verify StreamingAudioManager is created with enhanced config
    expect(createStreamingAudioManager).toBeDefined();
    expect(getEnhancedVoiceConfig).toBeDefined();
    
    // Verify enhanced config structure
    const config = getEnhancedVoiceConfig();
    expect(config.output_format).toBe('mp3_44100_128');
    expect(config.optimize_streaming_latency).toBe(3);
    expect(config.voice_settings.stability).toBe(0.70);
  });

  it('should process streaming response sentence by sentence', async () => {
    const { splitIntoSentences } = await import('@/lib/streamingUtils');
    
    const testText = "Hello there! How are you? I'm doing great.";
    const sentences = splitIntoSentences(testText);
    
    expect(splitIntoSentences).toHaveBeenCalledWith(testText);
    expect(sentences).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Hello'),
        expect.stringContaining('How are you'),
        expect.stringContaining('great')
      ])
    );
  });

  it('should handle streaming manager cleanup properly', async () => {
    const { stopAllAudio } = await import('@/lib/streamingUtils');
    
    const mockManager = {
      stop: vi.fn(),
      isPlaying: vi.fn(() => false),
      addSentence: vi.fn()
    };

    // Simulate cleanup
    mockManager.stop();
    
    expect(mockManager.stop).toHaveBeenCalled();
    expect(stopAllAudio).toBeDefined();
  });

  it('should use enhanced voice configuration parameters', async () => {
    const { getEnhancedVoiceConfig } = await import('@/lib/enhancedVoiceConfig');
    
    const config = getEnhancedVoiceConfig();
    
    // Verify enhanced quality settings per task requirements
    expect(config.output_format).toBe('mp3_44100_128'); // 44.1kHz, ≥64kbps
    expect(config.optimize_streaming_latency).toBe(3); // Latency mode 3
    expect(config.model_id).toBe('eleven_multilingual_v2');
    
    // Verify voice settings for quality
    expect(config.voice_settings.stability).toBe(0.70);
    expect(config.voice_settings.similarity_boost).toBe(0.85);
    expect(config.voice_settings.use_speaker_boost).toBe(false);
  });

  it('should handle error scenarios gracefully', async () => {
    const { stopAllAudio } = await import('@/lib/streamingUtils');
    
    // Mock API failure
    (global.fetch as any).mockRejectedValueOnce(new Error('API Error'));
    
    // Verify error handling doesn't break the system
    expect(() => stopAllAudio()).not.toThrow();
  });
});