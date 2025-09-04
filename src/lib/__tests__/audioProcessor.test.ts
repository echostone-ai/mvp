/**
 * Unit tests for AudioProcessor
 * Tests audio processing functionality including validation, duration estimation, and file processing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioProcessor } from '../audioProcessor';

// Mock File constructor for testing
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
    // Create a mock ArrayBuffer based on the size
    return new ArrayBuffer(this.size);
  }
}

describe('AudioProcessor', () => {
  describe('processAudioFile', () => {
    it('should process valid audio file successfully', async () => {
      const mockFile = new MockFile(
        ['mock audio data'],
        'test.mp3',
        { type: 'audio/mpeg', size: 64 * 1024 } // 64KB for shorter duration
      ) as any;

      const result = await AudioProcessor.processAudioFile(mockFile);

      expect(result).toMatchObject({
        buffer: expect.any(ArrayBuffer),
        durationMs: expect.any(Number),
        sampleRate: 22050,
        channels: 1
      });
      expect(result.durationMs).toBeGreaterThan(0);
    });

    it('should reject files exceeding size limit', async () => {
      const mockFile = new MockFile(
        ['large audio data'],
        'large.mp3',
        { type: 'audio/mpeg', size: 6 * 1024 * 1024 } // 6MB (exceeds 5MB limit)
      ) as any;

      await expect(AudioProcessor.processAudioFile(mockFile))
        .rejects
        .toThrow('File size 6.0MB exceeds maximum 5MB');
    });

    it('should reject unsupported file formats', async () => {
      const mockFile = new MockFile(
        ['video data'],
        'test.mp4',
        { type: 'video/mp4', size: 1024 }
      ) as any;

      await expect(AudioProcessor.processAudioFile(mockFile))
        .rejects
        .toThrow('Unsupported audio format: video/mp4');
    });

    it('should reject files exceeding duration limit', async () => {
      const mockFile = new MockFile(
        ['long audio data'],
        'long.wav',
        { type: 'audio/wav', size: 1 * 1024 * 1024 } // 1MB WAV file that will have long estimated duration
      ) as any;

      await expect(AudioProcessor.processAudioFile(mockFile, { maxDurationMs: 3000 }))
        .rejects
        .toThrow(/Audio duration .* exceeds maximum 3000ms/);
    });

    it('should apply custom processing options', async () => {
      const mockFile = new MockFile(
        ['audio data'],
        'test.mp3',
        { type: 'audio/mpeg', size: 1024 }
      ) as any;

      const customOptions = {
        targetSampleRate: 44100,
        maxDurationMs: 10000
      };

      const result = await AudioProcessor.processAudioFile(mockFile, customOptions);

      expect(result.sampleRate).toBe(44100);
    });

    it('should handle different audio formats with appropriate bitrate estimates', async () => {
      const formats = [
        { type: 'audio/wav', expectedHighDuration: true },
        { type: 'audio/mpeg', expectedHighDuration: false },
        { type: 'audio/m4a', expectedHighDuration: false }
      ];

      for (const format of formats) {
        const mockFile = new MockFile(
          ['audio data'],
          `test.${format.type.split('/')[1]}`,
          { type: format.type, size: 32 * 1024 } // 32KB for shorter duration
        ) as any;

        const result = await AudioProcessor.processAudioFile(mockFile);
        expect(result.durationMs).toBeGreaterThan(0);
      }
    });
  });

  describe('generateSafeFilename', () => {
    it('should generate safe filename with user prefix and timestamp', () => {
      const originalName = 'My Expression File!@#$.mp3';
      const userId = 'user123456789';

      const result = AudioProcessor.generateSafeFilename(originalName, userId);

      expect(result).toMatch(/^user1234_My_Expression_File_+\d+\.mp3$/);
    });

    it('should handle long filenames by truncating', () => {
      const longName = 'a'.repeat(100) + '.wav';
      const userId = 'user123';

      const result = AudioProcessor.generateSafeFilename(longName, userId);

      expect(result.length).toBeLessThan(80); // Should be truncated
      expect(result).toMatch(/^user123_a+_\d+\.mp3$/);
    });

    it('should remove special characters', () => {
      const specialName = 'test@#$%^&*()file.mp3';
      const userId = 'user123';

      const result = AudioProcessor.generateSafeFilename(specialName, userId);

      expect(result).toMatch(/^user123_test_+file_\d+\.mp3$/);
    });

    it('should handle empty or minimal filenames', () => {
      const emptyName = '.mp3';
      const userId = 'user123';

      const result = AudioProcessor.generateSafeFilename(emptyName, userId);

      expect(result).toMatch(/^user123__\d+\.mp3$/);
    });
  });

  describe('file validation', () => {
    const validFormats = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/mp4',
      'audio/m4a',
      'audio/aac',
      'audio/ogg',
      'audio/webm'
    ];

    it.each(validFormats)('should accept valid format: %s', async (mimeType) => {
      const mockFile = new MockFile(
        ['audio data'],
        'test.audio',
        { type: mimeType, size: 1024 }
      ) as any;

      await expect(AudioProcessor.processAudioFile(mockFile)).resolves.toBeDefined();
    });

    it('should enforce minimum duration', async () => {
      // Create a very small file that would estimate to less than 100ms
      const mockFile = new MockFile(
        ['tiny'],
        'tiny.mp3',
        { type: 'audio/mpeg', size: 10 } // Very small file
      ) as any;

      const result = await AudioProcessor.processAudioFile(mockFile);

      // Should enforce minimum 100ms duration
      expect(result.durationMs).toBeGreaterThanOrEqual(100);
    });
  });

  describe('duration estimation', () => {
    it('should estimate WAV files with higher bitrate', async () => {
      const wavFile = new MockFile(
        ['wav data'],
        'test.wav',
        { type: 'audio/wav', size: 32 * 1024 } // 32KB
      ) as any;

      const mp3File = new MockFile(
        ['mp3 data'],
        'test.mp3',
        { type: 'audio/mpeg', size: 32 * 1024 } // 32KB
      ) as any;

      const wavResult = await AudioProcessor.processAudioFile(wavFile);
      const mp3Result = await AudioProcessor.processAudioFile(mp3File);

      // WAV should have shorter estimated duration due to higher bitrate
      expect(wavResult.durationMs).toBeLessThan(mp3Result.durationMs);
    });

    it('should handle edge cases in duration calculation', async () => {
      const zeroSizeFile = new MockFile(
        [],
        'empty.mp3',
        { type: 'audio/mpeg', size: 0 }
      ) as any;

      const result = await AudioProcessor.processAudioFile(zeroSizeFile);

      // Should still return minimum duration
      expect(result.durationMs).toBe(100);
    });
  });
});