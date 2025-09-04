/**
 * Audio processing utilities for expression clips
 * Handles audio normalization, trimming, and encoding for the expressions pipeline
 */

export interface ProcessedAudio {
  buffer: ArrayBuffer;
  durationMs: number;
  sampleRate: number;
  channels: number;
}

export interface AudioProcessingOptions {
  maxDurationMs?: number;
  targetSampleRate?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  silenceThreshold?: number;
}

/**
 * Basic audio processor for expression clips
 * Note: This is a simplified implementation for MVP
 * In production, consider using Web Audio API or server-side audio processing
 */
export class AudioProcessor {
  private static readonly DEFAULT_OPTIONS: Required<AudioProcessingOptions> = {
    maxDurationMs: 5000, // 5 seconds max
    targetSampleRate: 22050,
    fadeInMs: 15,
    fadeOutMs: 20,
    silenceThreshold: 0.01
  };

  /**
   * Process uploaded audio file for expression use
   */
  static async processAudioFile(
    file: File, 
    options: AudioProcessingOptions = {}
  ): Promise<ProcessedAudio> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    // Validate file
    this.validateAudioFile(file);
    
    // For MVP, we'll do basic processing
    // In production, this would use proper audio processing libraries
    const arrayBuffer = await file.arrayBuffer();
    
    // Calculate approximate duration (this is a simplified approach)
    const durationMs = await this.estimateAudioDuration(file);
    
    if (durationMs > opts.maxDurationMs) {
      throw new Error(`Audio duration ${durationMs}ms exceeds maximum ${opts.maxDurationMs}ms`);
    }
    
    // For MVP, return the original buffer with metadata
    // TODO: Implement actual audio processing (trim, fade, resample)
    return {
      buffer: arrayBuffer,
      durationMs: Math.round(durationMs),
      sampleRate: opts.targetSampleRate,
      channels: 1 // Mono
    };
  }

  /**
   * Validate audio file format and size
   */
  private static validateAudioFile(file: File): void {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = [
      'audio/mpeg',
      'audio/mp3', 
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/mp4',
      'audio/m4a',
      'audio/x-m4a',
      'audio/mp4a-latm',
      'audio/aac',
      'audio/aacp',
      'audio/ogg',
      'audio/webm'
    ];

    if (file.size > maxSize) {
      throw new Error(`File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds maximum 5MB`);
    }

    if (!allowedTypes.includes(file.type)) {
      throw new Error(`Unsupported audio format: ${file.type}. Supported formats: MP3, WAV, M4A, AAC, OGG, WebM`);
    }
  }

  /**
   * Estimate audio duration from file metadata
   * Enhanced support for M4A and other formats
   */
  private static async estimateAudioDuration(file: File): Promise<number> {
    // Try to get actual duration using Web Audio API (browser only)
    if (typeof window !== 'undefined' && window.AudioContext) {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const durationMs = (audioBuffer.length / audioBuffer.sampleRate) * 1000;
        audioContext.close();
        return Math.round(durationMs);
      } catch (error) {
        console.warn('Could not decode audio for duration, falling back to estimation:', error);
      }
    }
    
    // Fallback: estimate based on file size and type
    const sizeInBytes = file.size;
    let estimatedBitrate = 128; // kbps default
    
    // Enhanced bitrate estimates by file type
    if (file.type.includes('wav') || file.type.includes('wave')) {
      estimatedBitrate = 1411; // Uncompressed CD quality
    } else if (file.type.includes('m4a') || file.type.includes('mp4')) {
      estimatedBitrate = 128; // AAC in M4A container, typically 128kbps
    } else if (file.type.includes('aac')) {
      estimatedBitrate = 128; // AAC codec
    } else if (file.type.includes('mp3') || file.type.includes('mpeg')) {
      estimatedBitrate = 128; // MP3 standard
    } else if (file.type.includes('ogg') || file.type.includes('webm')) {
      estimatedBitrate = 128; // Vorbis/Opus
    }
    
    // Duration = (file size in bits) / (bitrate in bits per second)
    const durationSeconds = (sizeInBytes * 8) / (estimatedBitrate * 1000);
    return Math.max(100, durationSeconds * 1000); // Minimum 100ms
  }

  /**
   * Generate a safe filename for storage
   */
  static generateSafeFilename(originalName: string, userId: string): string {
    // Remove extension and clean the name
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
    const cleanName = nameWithoutExt
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .substring(0, 50);
    
    // Add timestamp and user prefix for uniqueness
    const timestamp = Date.now();
    const userPrefix = userId.substring(0, 8);
    
    return `${userPrefix}_${cleanName}_${timestamp}.mp3`;
  }
}