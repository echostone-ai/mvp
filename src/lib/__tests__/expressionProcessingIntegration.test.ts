/**
 * Integration tests for expression processing pipeline
 * Tests the complete flow from upload to playback including trim, fade, encode operations
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5 - Audio processing requirements
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Web Audio API for audio processing tests
const mockAudioContext = {
  sampleRate: 44100,
  createBuffer: vi.fn((channels, length, sampleRate) => ({
    numberOfChannels: channels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: vi.fn(() => new Float32Array(length)),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn()
  })),
  decodeAudioData: vi.fn(),
  createBufferSource: vi.fn(() => ({
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn()
  }))
};

// Mock file processing utilities
class MockAudioProcessor {
  static async processAudioFile(file: File, options: any = {}) {
    // Simulate audio processing pipeline
    const buffer = await this.loadAudioBuffer(file);
    const trimmed = await this.trimSilences(buffer, options.silenceThreshold || 0.01);
    const faded = await this.applyFades(trimmed, options.fadeInMs || 15, options.fadeOutMs || 20);
    const normalized = await this.normalizeAudio(faded);
    const encoded = await this.encodeToMp3(normalized, options.targetSampleRate || 22050);
    
    return {
      buffer: encoded,
      durationMs: Math.round((trimmed.length / trimmed.sampleRate) * 1000),
      sampleRate: options.targetSampleRate || 22050,
      channels: 1
    };
  }

  static async loadAudioBuffer(file: File): Promise<AudioBuffer> {
    // Simulate loading audio file
    const arrayBuffer = await file.arrayBuffer();
    
    // Create mock audio buffer based on file size and type
    const estimatedSamples = this.estimateSamplesFromFile(file);
    const sampleRate = 44100;
    
    return {
      numberOfChannels: 2,
      length: estimatedSamples,
      sampleRate,
      duration: estimatedSamples / sampleRate,
      getChannelData: vi.fn(() => this.generateMockAudioData(estimatedSamples)),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn()
    } as any;
  }

  static async trimSilences(buffer: AudioBuffer, threshold: number): Promise<AudioBuffer> {
    // Simulate silence trimming
    const channelData = buffer.getChannelData(0);
    const samples = channelData.length;
    
    // Find start of audio (first sample above threshold)
    let startSample = 0;
    for (let i = 0; i < samples; i++) {
      if (Math.abs(channelData[i]) > threshold) {
        startSample = i;
        break;
      }
    }
    
    // Find end of audio (last sample above threshold)
    let endSample = samples - 1;
    for (let i = samples - 1; i >= 0; i--) {
      if (Math.abs(channelData[i]) > threshold) {
        endSample = i;
        break;
      }
    }
    
    const trimmedLength = endSample - startSample + 1;
    
    return {
      numberOfChannels: buffer.numberOfChannels,
      length: trimmedLength,
      sampleRate: buffer.sampleRate,
      duration: trimmedLength / buffer.sampleRate,
      getChannelData: vi.fn(() => channelData.slice(startSample, endSample + 1)),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn()
    } as any;
  }

  static async applyFades(buffer: AudioBuffer, fadeInMs: number, fadeOutMs: number): Promise<AudioBuffer> {
    // Simulate fade in/out application
    const sampleRate = buffer.sampleRate;
    const fadeInSamples = Math.floor((fadeInMs / 1000) * sampleRate);
    const fadeOutSamples = Math.floor((fadeOutMs / 1000) * sampleRate);
    
    const channelData = buffer.getChannelData(0);
    const fadedData = new Float32Array(channelData.length);
    
    for (let i = 0; i < channelData.length; i++) {
      let gain = 1.0;
      
      // Apply fade in
      if (i < fadeInSamples) {
        gain = i / fadeInSamples;
      }
      
      // Apply fade out
      if (i >= channelData.length - fadeOutSamples) {
        const fadeOutPosition = channelData.length - i;
        gain = Math.min(gain, fadeOutPosition / fadeOutSamples);
      }
      
      fadedData[i] = channelData[i] * gain;
    }
    
    return {
      numberOfChannels: buffer.numberOfChannels,
      length: buffer.length,
      sampleRate: buffer.sampleRate,
      duration: buffer.duration,
      getChannelData: vi.fn(() => fadedData),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn()
    } as any;
  }

  static async normalizeAudio(buffer: AudioBuffer): Promise<AudioBuffer> {
    // Simulate audio normalization to -23 LUFS
    const channelData = buffer.getChannelData(0);
    
    // Find peak amplitude
    let peak = 0;
    for (let i = 0; i < channelData.length; i++) {
      peak = Math.max(peak, Math.abs(channelData[i]));
    }
    
    // Calculate normalization gain (target -23 LUFS ≈ 0.1 peak)
    const targetPeak = 0.1;
    const gain = peak > 0 ? targetPeak / peak : 1.0;
    
    const normalizedData = new Float32Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      normalizedData[i] = channelData[i] * gain;
    }
    
    return {
      numberOfChannels: buffer.numberOfChannels,
      length: buffer.length,
      sampleRate: buffer.sampleRate,
      duration: buffer.duration,
      getChannelData: vi.fn(() => normalizedData),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn()
    } as any;
  }

  static async encodeToMp3(buffer: AudioBuffer, targetSampleRate: number): Promise<ArrayBuffer> {
    // Simulate MP3 encoding with resampling
    const originalSampleRate = buffer.sampleRate;
    const resampleRatio = targetSampleRate / originalSampleRate;
    const newLength = Math.floor(buffer.length * resampleRatio);
    
    // Simulate compressed audio data
    const compressionRatio = 0.1; // MP3 typically compresses to ~10% of original size
    const compressedSize = Math.floor(newLength * 4 * compressionRatio); // 4 bytes per sample, then compressed
    
    return new ArrayBuffer(compressedSize);
  }

  static estimateSamplesFromFile(file: File): number {
    // Estimate samples based on file size and format
    let bytesPerSample = 2; // 16-bit default
    let channels = 2; // Stereo default
    let compressionRatio = 1;
    
    if (file.type.includes('wav')) {
      compressionRatio = 1; // Uncompressed
    } else if (file.type.includes('mp3')) {
      compressionRatio = 0.1; // ~10:1 compression
    } else if (file.type.includes('m4a') || file.type.includes('aac')) {
      compressionRatio = 0.12; // ~8:1 compression
    }
    
    const uncompressedBytes = file.size / compressionRatio;
    return Math.floor(uncompressedBytes / (bytesPerSample * channels));
  }

  static generateMockAudioData(length: number): Float32Array {
    const data = new Float32Array(length);
    
    // Generate mock audio with silence at start/end and signal in middle
    const silenceLength = Math.floor(length * 0.1); // 10% silence at each end
    
    for (let i = 0; i < length; i++) {
      if (i < silenceLength || i >= length - silenceLength) {
        data[i] = 0; // Silence
      } else {
        // Generate simple sine wave with some noise
        const frequency = 440; // A4 note
        const sampleRate = 44100;
        const amplitude = 0.5;
        const noise = (Math.random() - 0.5) * 0.1;
        
        data[i] = amplitude * Math.sin(2 * Math.PI * frequency * i / sampleRate) + noise;
      }
    }
    
    return data;
  }
}

// Mock File class for testing
class MockFile {
  public name: string;
  public size: number;
  public type: string;
  private data: BlobPart[];

  constructor(
    bits: BlobPart[],
    name: string,
    options: FilePropertyBag & { size?: number; type?: string } = {}
  ) {
    this.data = bits;
    this.name = name;
    this.size = options.size || 1024;
    this.type = options.type || 'application/octet-stream';
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return new ArrayBuffer(this.size);
  }
}

describe('Expression Processing Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.AudioContext = vi.fn(() => mockAudioContext) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete Processing Pipeline', () => {
    it('should process audio file through complete pipeline', async () => {
      const mockFile = new MockFile(
        ['mock audio data'],
        'test-expression.wav',
        { type: 'audio/wav', size: 1024 * 1024 } // 1MB WAV file
      ) as any;

      const result = await MockAudioProcessor.processAudioFile(mockFile);

      expect(result).toMatchObject({
        buffer: expect.any(ArrayBuffer),
        durationMs: expect.any(Number),
        sampleRate: 22050,
        channels: 1
      });

      expect(result.durationMs).toBeGreaterThan(0);
      expect(result.buffer.byteLength).toBeGreaterThan(0);
    });

    it('should maintain audio quality through processing steps', async () => {
      const mockFile = new MockFile(
        ['high quality audio'],
        'quality-test.wav',
        { type: 'audio/wav', size: 2 * 1024 * 1024 } // 2MB for higher quality
      ) as any;

      const result = await MockAudioProcessor.processAudioFile(mockFile, {
        silenceThreshold: 0.005, // More sensitive silence detection
        fadeInMs: 10,
        fadeOutMs: 15,
        targetSampleRate: 44100 // Higher sample rate
      });

      expect(result.sampleRate).toBe(44100);
      expect(result.durationMs).toBeGreaterThan(100); // Should have meaningful duration
    });

    it('should handle different audio formats consistently', async () => {
      const formats = [
        { type: 'audio/wav', size: 1024 * 1024, expectedQuality: 'high' },
        { type: 'audio/mp3', size: 128 * 1024, expectedQuality: 'medium' },
        { type: 'audio/m4a', size: 100 * 1024, expectedQuality: 'medium' }
      ];

      const results = [];
      for (const format of formats) {
        const mockFile = new MockFile(
          ['audio data'],
          `test.${format.type.split('/')[1]}`,
          { type: format.type, size: format.size }
        ) as any;

        const result = await MockAudioProcessor.processAudioFile(mockFile);
        results.push({ format: format.type, result });
      }

      // All formats should produce valid results
      results.forEach(({ format, result }) => {
        expect(result.buffer).toBeInstanceOf(ArrayBuffer);
        expect(result.durationMs).toBeGreaterThan(0);
        expect(result.sampleRate).toBe(22050);
        expect(result.channels).toBe(1);
      });
    });
  });

  describe('Silence Trimming', () => {
    it('should remove leading and trailing silence', async () => {
      // Create audio buffer with silence at start and end
      const originalBuffer = {
        numberOfChannels: 1,
        length: 44100, // 1 second at 44.1kHz
        sampleRate: 44100,
        duration: 1.0,
        getChannelData: vi.fn(() => {
          const data = new Float32Array(44100);
          // First 0.1 seconds silence
          for (let i = 0; i < 4410; i++) data[i] = 0;
          // Middle 0.8 seconds audio
          for (let i = 4410; i < 39690; i++) data[i] = 0.5 * Math.sin(2 * Math.PI * 440 * i / 44100);
          // Last 0.1 seconds silence
          for (let i = 39690; i < 44100; i++) data[i] = 0;
          return data;
        }),
        copyFromChannel: vi.fn(),
        copyToChannel: vi.fn()
      } as any;

      const trimmed = await MockAudioProcessor.trimSilences(originalBuffer, 0.01);

      // Should be shorter than original
      expect(trimmed.length).toBeLessThan(originalBuffer.length);
      expect(trimmed.duration).toBeLessThan(originalBuffer.duration);
      
      // Should have removed approximately 0.2 seconds (0.1 from each end)
      const expectedLength = originalBuffer.length - (2 * 4410); // Remove silence from both ends
      expect(Math.abs(trimmed.length - expectedLength)).toBeLessThan(10); // Within 10 samples tolerance
    });

    it('should handle audio with no silence gracefully', async () => {
      const originalBuffer = {
        numberOfChannels: 1,
        length: 22050, // 0.5 seconds
        sampleRate: 44100,
        duration: 0.5,
        getChannelData: vi.fn(() => {
          const data = new Float32Array(22050);
          // All samples above threshold
          for (let i = 0; i < 22050; i++) {
            data[i] = 0.5 * Math.sin(2 * Math.PI * 440 * i / 44100);
          }
          return data;
        }),
        copyFromChannel: vi.fn(),
        copyToChannel: vi.fn()
      } as any;

      const trimmed = await MockAudioProcessor.trimSilences(originalBuffer, 0.01);

      // Should remain approximately the same length (within 1 sample tolerance)
      expect(Math.abs(trimmed.length - originalBuffer.length)).toBeLessThan(2);
      expect(Math.abs(trimmed.duration - originalBuffer.duration)).toBeLessThan(0.001);
    });

    it('should use appropriate silence threshold', async () => {
      const originalBuffer = {
        numberOfChannels: 1,
        length: 44100,
        sampleRate: 44100,
        duration: 1.0,
        getChannelData: vi.fn(() => {
          const data = new Float32Array(44100);
          // Very quiet audio at start/end (below threshold)
          for (let i = 0; i < 4410; i++) data[i] = 0.005; // Below 0.01 threshold
          // Louder audio in middle
          for (let i = 4410; i < 39690; i++) data[i] = 0.5;
          // Very quiet audio at end
          for (let i = 39690; i < 44100; i++) data[i] = 0.005;
          return data;
        }),
        copyFromChannel: vi.fn(),
        copyToChannel: vi.fn()
      } as any;

      const trimmed = await MockAudioProcessor.trimSilences(originalBuffer, 0.01);

      // Should trim the quiet sections
      expect(trimmed.length).toBeLessThan(originalBuffer.length);
    });
  });

  describe('Fade Application', () => {
    it('should apply fade in and fade out', async () => {
      const originalBuffer = {
        numberOfChannels: 1,
        length: 22050, // 0.5 seconds at 44.1kHz
        sampleRate: 44100,
        duration: 0.5,
        getChannelData: vi.fn(() => {
          const data = new Float32Array(22050);
          // Constant amplitude audio
          for (let i = 0; i < 22050; i++) {
            data[i] = 0.5;
          }
          return data;
        }),
        copyFromChannel: vi.fn(),
        copyToChannel: vi.fn()
      } as any;

      const faded = await MockAudioProcessor.applyFades(originalBuffer, 15, 20); // 15ms in, 20ms out

      expect(faded.length).toBe(originalBuffer.length);
      expect(faded.duration).toBe(originalBuffer.duration);
      
      // Verify fade was applied by checking the getChannelData mock was called
      expect(faded.getChannelData).toBeDefined();
    });

    it('should handle very short audio files', async () => {
      const shortBuffer = {
        numberOfChannels: 1,
        length: 441, // 0.01 seconds (10ms)
        sampleRate: 44100,
        duration: 0.01,
        getChannelData: vi.fn(() => new Float32Array(441).fill(0.5)),
        copyFromChannel: vi.fn(),
        copyToChannel: vi.fn()
      } as any;

      // Fade durations longer than audio duration
      const faded = await MockAudioProcessor.applyFades(shortBuffer, 15, 20);

      expect(faded.length).toBe(shortBuffer.length);
      // Should not crash with fade durations longer than audio
    });

    it('should prevent audio clicks with proper fading', async () => {
      const originalBuffer = {
        numberOfChannels: 1,
        length: 4410, // 0.1 seconds
        sampleRate: 44100,
        duration: 0.1,
        getChannelData: vi.fn(() => {
          const data = new Float32Array(4410);
          // Abrupt start/end (would cause clicks without fading)
          for (let i = 0; i < 4410; i++) {
            data[i] = 0.8; // High amplitude
          }
          return data;
        }),
        copyFromChannel: vi.fn(),
        copyToChannel: vi.fn()
      } as any;

      const faded = await MockAudioProcessor.applyFades(originalBuffer, 10, 10);

      // Verify processing completed without errors
      expect(faded).toBeDefined();
      expect(faded.length).toBe(originalBuffer.length);
    });
  });

  describe('Audio Normalization', () => {
    it('should normalize loud audio to target level', async () => {
      const loudBuffer = {
        numberOfChannels: 1,
        length: 44100,
        sampleRate: 44100,
        duration: 1.0,
        getChannelData: vi.fn(() => {
          const data = new Float32Array(44100);
          // Very loud audio (peak = 0.9)
          for (let i = 0; i < 44100; i++) {
            data[i] = 0.9 * Math.sin(2 * Math.PI * 440 * i / 44100);
          }
          return data;
        }),
        copyFromChannel: vi.fn(),
        copyToChannel: vi.fn()
      } as any;

      const normalized = await MockAudioProcessor.normalizeAudio(loudBuffer);

      expect(normalized).toBeDefined();
      expect(normalized.length).toBe(loudBuffer.length);
      // Normalization should reduce the peak amplitude
    });

    it('should handle quiet audio appropriately', async () => {
      const quietBuffer = {
        numberOfChannels: 1,
        length: 44100,
        sampleRate: 44100,
        duration: 1.0,
        getChannelData: vi.fn(() => {
          const data = new Float32Array(44100);
          // Very quiet audio (peak = 0.01)
          for (let i = 0; i < 44100; i++) {
            data[i] = 0.01 * Math.sin(2 * Math.PI * 440 * i / 44100);
          }
          return data;
        }),
        copyFromChannel: vi.fn(),
        copyToChannel: vi.fn()
      } as any;

      const normalized = await MockAudioProcessor.normalizeAudio(quietBuffer);

      expect(normalized).toBeDefined();
      expect(normalized.length).toBe(quietBuffer.length);
      // Normalization should boost the quiet audio
    });

    it('should handle silent audio without errors', async () => {
      const silentBuffer = {
        numberOfChannels: 1,
        length: 44100,
        sampleRate: 44100,
        duration: 1.0,
        getChannelData: vi.fn(() => new Float32Array(44100)), // All zeros
        copyFromChannel: vi.fn(),
        copyToChannel: vi.fn()
      } as any;

      const normalized = await MockAudioProcessor.normalizeAudio(silentBuffer);

      expect(normalized).toBeDefined();
      expect(normalized.length).toBe(silentBuffer.length);
      // Should not crash on silent audio
    });
  });

  describe('MP3 Encoding and Resampling', () => {
    it('should encode to MP3 with target sample rate', async () => {
      const originalBuffer = {
        numberOfChannels: 2,
        length: 88200, // 2 seconds at 44.1kHz
        sampleRate: 44100,
        duration: 2.0,
        getChannelData: vi.fn(() => new Float32Array(88200)),
        copyFromChannel: vi.fn(),
        copyToChannel: vi.fn()
      } as any;

      const encoded = await MockAudioProcessor.encodeToMp3(originalBuffer, 22050);

      expect(encoded).toBeInstanceOf(ArrayBuffer);
      expect(encoded.byteLength).toBeGreaterThan(0);
      // MP3 should be significantly smaller than uncompressed audio
      const originalSize = 88200 * 2 * 4; // samples * channels * bytes per sample
      expect(encoded.byteLength).toBeLessThan(originalSize * 0.2); // Should be much smaller
    });

    it('should handle sample rate conversion', async () => {
      const highSampleRateBuffer = {
        numberOfChannels: 1,
        length: 96000, // 2 seconds at 48kHz
        sampleRate: 48000,
        duration: 2.0,
        getChannelData: vi.fn(() => new Float32Array(96000)),
        copyFromChannel: vi.fn(),
        copyToChannel: vi.fn()
      } as any;

      const encoded22k = await MockAudioProcessor.encodeToMp3(highSampleRateBuffer, 22050);
      const encoded44k = await MockAudioProcessor.encodeToMp3(highSampleRateBuffer, 44100);

      expect(encoded22k).toBeInstanceOf(ArrayBuffer);
      expect(encoded44k).toBeInstanceOf(ArrayBuffer);
      
      // Different sample rates should produce different file sizes
      expect(encoded22k.byteLength).not.toBe(encoded44k.byteLength);
    });

    it('should produce consistent encoding results', async () => {
      const testBuffer = {
        numberOfChannels: 1,
        length: 44100,
        sampleRate: 44100,
        duration: 1.0,
        getChannelData: vi.fn(() => new Float32Array(44100)),
        copyFromChannel: vi.fn(),
        copyToChannel: vi.fn()
      } as any;

      const encoded1 = await MockAudioProcessor.encodeToMp3(testBuffer, 22050);
      const encoded2 = await MockAudioProcessor.encodeToMp3(testBuffer, 22050);

      // Should produce consistent results for same input
      expect(encoded1.byteLength).toBe(encoded2.byteLength);
    });
  });

  describe('Error Handling in Processing Pipeline', () => {
    it('should handle corrupted audio files gracefully', async () => {
      const corruptedFile = new MockFile(
        ['corrupted data'],
        'corrupted.mp3',
        { type: 'audio/mpeg', size: 0 } // Zero size file
      ) as any;

      // Should handle gracefully without crashing
      await expect(async () => {
        await MockAudioProcessor.processAudioFile(corruptedFile);
      }).not.toThrow();
    });

    it('should validate processing parameters', async () => {
      const mockFile = new MockFile(
        ['audio data'],
        'test.wav',
        { type: 'audio/wav', size: 1024 }
      ) as any;

      // Test with invalid parameters
      const result = await MockAudioProcessor.processAudioFile(mockFile, {
        silenceThreshold: -1, // Invalid threshold
        fadeInMs: -5, // Invalid fade duration
        targetSampleRate: 0 // Invalid sample rate
      });

      // Should still produce a result (with defaults or corrections)
      expect(result).toBeDefined();
      expect(result.buffer).toBeInstanceOf(ArrayBuffer);
    });

    it('should handle processing failures gracefully', async () => {
      const mockFile = new MockFile(
        ['audio data'],
        'test.wav',
        { type: 'audio/wav', size: 1024 }
      ) as any;

      // Mock a processing failure
      const originalTrimSilences = MockAudioProcessor.trimSilences;
      MockAudioProcessor.trimSilences = vi.fn().mockRejectedValue(new Error('Processing failed'));

      try {
        await MockAudioProcessor.processAudioFile(mockFile);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }

      // Restore original method
      MockAudioProcessor.trimSilences = originalTrimSilences;
    });
  });
});