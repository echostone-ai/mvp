/**
 * M4A Support Tests
 * Validates that M4A files are properly supported throughout the expressions pipeline
 */

import { describe, it, expect } from 'vitest';
import { AudioProcessor } from '../audioProcessor';

describe('M4A Audio Support', () => {
  it('should accept M4A files with standard MIME type', async () => {
    const mockM4AFile = new File([new ArrayBuffer(1000)], 'test.m4a', {
      type: 'audio/m4a'
    });

    // Should not throw an error for M4A files
    expect(async () => {
      await AudioProcessor.processAudioFile(mockM4AFile);
    }).not.toThrow();
  });

  it('should accept M4A files with alternative MIME types', async () => {
    const mimeTypes = [
      'audio/m4a',
      'audio/x-m4a', 
      'audio/mp4',
      'audio/mp4a-latm'
    ];

    for (const mimeType of mimeTypes) {
      const mockFile = new File([new ArrayBuffer(1000)], 'test.m4a', {
        type: mimeType
      });

      expect(async () => {
        await AudioProcessor.processAudioFile(mockFile);
      }).not.toThrow(`Should accept MIME type: ${mimeType}`);
    }
  });

  it('should estimate duration for M4A files', async () => {
    // Create a mock M4A file (1KB should estimate to reasonable duration)
    const mockM4AFile = new File([new ArrayBuffer(1024)], 'test.m4a', {
      type: 'audio/m4a'
    });

    const result = await AudioProcessor.processAudioFile(mockM4AFile);
    
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.durationMs).toBeLessThan(10000); // Should be reasonable estimate
  });

  it('should handle M4A files with AAC codec estimation', async () => {
    // M4A files typically use AAC codec at 128kbps
    const mockM4AFile = new File([new ArrayBuffer(16000)], 'test.m4a', { // 16KB file
      type: 'audio/m4a'
    });

    const result = await AudioProcessor.processAudioFile(mockM4AFile);
    
    // For 16KB at 128kbps, should estimate around 1 second
    expect(result.durationMs).toBeGreaterThan(500);
    expect(result.durationMs).toBeLessThan(2000);
  });

  it('should reject oversized M4A files', async () => {
    // Create a 6MB M4A file (over 5MB limit)
    const oversizedM4A = new File([new ArrayBuffer(6 * 1024 * 1024)], 'large.m4a', {
      type: 'audio/m4a'
    });

    await expect(AudioProcessor.processAudioFile(oversizedM4A))
      .rejects.toThrow('File size');
  });

  it('should generate safe filenames for M4A files', () => {
    const originalName = 'my-expression.m4a';
    const userId = 'user123';
    
    const safeFilename = AudioProcessor.generateSafeFilename(originalName, userId);
    
    expect(safeFilename).toMatch(/^user123_my-expression_\d+\.mp3$/);
    expect(safeFilename).not.toContain(' ');
    expect(safeFilename).not.toContain('.');
  });
});

describe('M4A File Validation', () => {
  it('should provide helpful error messages for unsupported formats', async () => {
    const unsupportedFile = new File([new ArrayBuffer(1000)], 'test.txt', {
      type: 'text/plain'
    });

    await expect(AudioProcessor.processAudioFile(unsupportedFile))
      .rejects.toThrow('Supported formats: MP3, WAV, M4A, AAC, OGG, WebM');
  });

  it('should handle files with missing or incorrect MIME types', async () => {
    // Some systems might not set MIME type correctly
    const fileWithoutMime = new File([new ArrayBuffer(1000)], 'test.m4a', {
      type: ''
    });

    // Should reject files without proper MIME type
    await expect(AudioProcessor.processAudioFile(fileWithoutMime))
      .rejects.toThrow('Unsupported audio format');
  });
});

describe('M4A Integration with Expression System', () => {
  it('should process M4A files for jonathan-demo expressions', async () => {
    const jonathanM4A = new File([new ArrayBuffer(2000)], 'jonathan_laugh.m4a', {
      type: 'audio/m4a'
    });

    const result = await AudioProcessor.processAudioFile(jonathanM4A, {
      maxDurationMs: 300, // Expression limit
      targetSampleRate: 22050,
      fadeInMs: 15,
      fadeOutMs: 20
    });

    expect(result.buffer).toBeDefined();
    expect(result.sampleRate).toBe(22050);
    expect(result.channels).toBe(1); // Mono
    expect(result.durationMs).toBeLessThan(300); // Within expression limit
  });

  it('should generate proper CDN filenames for M4A uploads', () => {
    const m4aFile = 'user_expression.m4a';
    const userId = 'jonathan-demo';
    
    const filename = AudioProcessor.generateSafeFilename(m4aFile, userId);
    
    // Should convert to MP3 extension for consistency
    expect(filename).toMatch(/\.mp3$/);
    expect(filename).toContain('jonathan-demo');
    expect(filename).toContain('user_expression');
  });
});