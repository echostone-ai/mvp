import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';

// Mock the enhanced voice config
vi.mock('../../../../lib/enhancedVoiceConfig', () => ({
  getEnhancedVoiceConfig: () => ({
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
  }),
  getFallbackVoiceConfig: () => ({
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.75,
      similarity_boost: 0.80,
      style: 0.00,
      use_speaker_boost: false
    },
    output_format: 'mp3_44100_64',
    optimize_streaming_latency: 2,
    apply_text_normalization: 'auto'
  }),
  createEnhancedVoiceRequest: (text: string, voiceId: string, config: any) => ({
    text,
    voice_settings: config.voice_settings,
    model_id: config.model_id,
    optimize_streaming_latency: config.optimize_streaming_latency,
    output_format: config.output_format,
    apply_text_normalization: config.apply_text_normalization
  })
}));

// Mock the audio level manager
vi.mock('../../../../lib/audioLevelManager', () => ({
  globalAudioLevelManager: {
    normalizeAudioBuffer: vi.fn().mockImplementation((buffer) => Promise.resolve(buffer)),
    getConversationStats: vi.fn().mockReturnValue({
      averageLUFS: -14,
      lufsVariance: 2.1,
      peakRange: { min: -12, max: -3 },
      consistencyScore: 0.85
    })
  }
}));

// Mock environment variables
beforeEach(() => {
  process.env.ELEVENLABS_API_KEY = 'test-api-key';
  process.env.BASE_URL = 'http://localhost:3000';
});

// Mock fetch for external API calls
global.fetch = vi.fn();

describe('Enhanced Voice Stream API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock voice resolution API
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/voice/resolve')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            voiceId: 'test-voice-id',
            settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.0,
              use_speaker_boost: false
            }
          })
        });
      }
      
      // Mock ElevenLabs TTS API
      if (url.includes('api.elevenlabs.io')) {
        const mockAudioData = new Uint8Array([1, 2, 3, 4, 5]);
        return Promise.resolve({
          ok: true,
          body: {
            getReader: () => ({
              read: vi.fn()
                .mockResolvedValueOnce({ value: mockAudioData, done: false })
                .mockResolvedValueOnce({ value: undefined, done: true })
            })
          }
        });
      }
      
      return Promise.reject(new Error('Unexpected fetch call'));
    });
  });

  it('should use enhanced voice configuration by default', async () => {
    const request = new Request('http://localhost:3000/api/voice-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Hello, this is a test of enhanced voice quality.',
        avatar: 'default'
      })
    });

    const response = await POST(request);
    
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(response.headers.get('X-Voice-Quality')).toBe('enhanced');
    expect(response.headers.get('X-Voice-Format')).toBe('mp3_44100_128');
    
    // Verify ElevenLabs API was called with enhanced settings
    const elevenLabsCalls = (global.fetch as any).mock.calls.filter((call: any) => 
      call[0].includes('api.elevenlabs.io')
    );
    
    expect(elevenLabsCalls.length).toBeGreaterThan(0);
    
    const requestBody = JSON.parse(elevenLabsCalls[0][1].body);
    expect(requestBody.output_format).toBe('mp3_44100_128');
    expect(requestBody.optimize_streaming_latency).toBe(3);
    expect(requestBody.model_id).toBe('eleven_multilingual_v2');
  });

  it('should support disabling enhanced quality', async () => {
    const request = new Request('http://localhost:3000/api/voice-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Hello, this is a test.',
        avatar: 'default',
        useEnhancedQuality: false
      })
    });

    const response = await POST(request);
    
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Voice-Quality')).toBe('standard');
  });

  it('should include conversation ID in metrics when provided', async () => {
    const request = new Request('http://localhost:3000/api/voice-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Hello, this is a test.',
        avatar: 'default',
        conversationId: 'test-conversation-123'
      })
    });

    const response = await POST(request);
    
    expect(response.status).toBe(200);
    
    // Verify conversation ID was used in the request
    const elevenLabsCalls = (global.fetch as any).mock.calls.filter((call: any) => 
      call[0].includes('api.elevenlabs.io')
    );
    
    const requestBody = JSON.parse(elevenLabsCalls[0][1].body);
    expect(requestBody.seed).toBeDefined();
    expect(typeof requestBody.seed).toBe('number');
  });

  it('should handle audio normalization when enabled', async () => {
    const request = new Request('http://localhost:3000/api/voice-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Hello, this is a test.',
        avatar: 'default',
        normalizeAudio: true
      })
    });

    const response = await POST(request);
    
    expect(response.status).toBe(200);
    
    // Verify audio normalization was attempted
    const { globalAudioLevelManager } = await import('../../../../lib/audioLevelManager');
    expect(globalAudioLevelManager.normalizeAudioBuffer).toHaveBeenCalled();
  });

  it('should handle TTS API failures with fallback', async () => {
    // Mock first call to fail, second to succeed
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/voice/resolve')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            voiceId: 'test-voice-id',
            settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: false }
          })
        });
      }
      
      if (url.includes('api.elevenlabs.io')) {
        // First call fails
        if ((global.fetch as any).mock.calls.filter((call: any) => call[0].includes('api.elevenlabs.io')).length === 0) {
          return Promise.resolve({
            ok: false,
            status: 500,
            text: () => Promise.resolve('Internal server error')
          });
        }
        
        // Second call succeeds with fallback
        const mockAudioData = new Uint8Array([1, 2, 3, 4, 5]);
        return Promise.resolve({
          ok: true,
          body: {
            getReader: () => ({
              read: vi.fn()
                .mockResolvedValueOnce({ value: mockAudioData, done: false })
                .mockResolvedValueOnce({ value: undefined, done: true })
            })
          }
        });
      }
      
      return Promise.reject(new Error('Unexpected fetch call'));
    });

    const request = new Request('http://localhost:3000/api/voice-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Hello, this is a test.',
        avatar: 'default'
      })
    });

    const response = await POST(request);
    
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Fallback-Attempts')).toBe('1');
    
    // Should have made multiple calls to ElevenLabs (original + fallback)
    const elevenLabsCalls = (global.fetch as any).mock.calls.filter((call: any) => 
      call[0].includes('api.elevenlabs.io')
    );
    expect(elevenLabsCalls.length).toBe(2);
  });

  it('should return error for missing text', async () => {
    const request = new Request('http://localhost:3000/api/voice-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        avatar: 'default'
      })
    });

    const response = await POST(request);
    
    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).toBe('Missing text');
  });
});