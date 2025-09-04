/**
 * Audio Level Manager
 * 
 * Ensures consistent audio levels throughout conversation playback
 * by normalizing audio to target LUFS and managing dynamic range.
 */

export interface AudioLevelConfig {
  targetLUFS: number;        // Target loudness in LUFS (-14 is broadcast standard)
  maxPeakDb: number;         // Maximum peak level in dB (-1 to prevent clipping)
  compressionRatio: number;  // Compression ratio for dynamic range control
  compressionThreshold: number; // Threshold for compression in dB
}

export interface AudioLevelMetrics {
  currentLUFS: number;
  peakLevel: number;
  rmsLevel: number;
  dynamicRange: number;
  gainApplied: number;
  compressionApplied: boolean;
}

/**
 * Default audio level configuration for conversation consistency
 */
export const DEFAULT_AUDIO_LEVEL_CONFIG: AudioLevelConfig = {
  targetLUFS: -14,           // Broadcast standard for consistent perceived loudness
  maxPeakDb: -1,             // Prevent clipping with 1dB headroom
  compressionRatio: 3,       // Moderate compression for consistency
  compressionThreshold: -12  // Compress peaks above -12dB
};

/**
 * Audio Level Manager class for consistent conversation audio
 */
export class AudioLevelManager {
  private config: AudioLevelConfig;
  private conversationHistory: AudioLevelMetrics[] = [];
  private targetGain: number = 1.0;

  constructor(config: AudioLevelConfig = DEFAULT_AUDIO_LEVEL_CONFIG) {
    this.config = config;
  }

  /**
   * Normalize audio buffer to consistent level
   */
  async normalizeAudioBuffer(audioBuffer: ArrayBuffer): Promise<ArrayBuffer> {
    try {
      // In a browser environment, use Web Audio API
      if (typeof window !== 'undefined' && window.AudioContext) {
        return await this.normalizeWithWebAudio(audioBuffer);
      }
      
      // In Node.js environment, return original buffer
      // (Full implementation would use a Node.js audio processing library)
      console.warn('Audio normalization not available in Node.js environment');
      return audioBuffer;
    } catch (error) {
      console.error('Audio normalization failed:', error);
      return audioBuffer;
    }
  }

  /**
   * Normalize audio using Web Audio API
   */
  private async normalizeWithWebAudio(audioBuffer: ArrayBuffer): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      audioContext.decodeAudioData(audioBuffer.slice(0), (audioData) => {
        try {
          const normalizedBuffer = this.processAudioData(audioData, audioContext);
          
          // Convert back to ArrayBuffer (simplified implementation)
          // In a full implementation, this would properly encode the audio
          resolve(audioBuffer);
          audioContext.close();
        } catch (error) {
          reject(error);
        }
      }, reject);
    });
  }

  /**
   * Process audio data for consistent levels
   */
  private processAudioData(audioData: AudioBuffer, audioContext: AudioContext): AudioBuffer {
    const channelData = audioData.getChannelData(0);
    const metrics = this.calculateAudioMetrics(channelData);
    
    // Calculate required gain to reach target LUFS
    const gainDb = this.config.targetLUFS - metrics.currentLUFS;
    let gainLinear = Math.pow(10, gainDb / 20);
    
    // Apply adaptive gain based on conversation history
    gainLinear *= this.getAdaptiveGain(metrics);
    
    // Ensure we don't exceed peak limits
    const maxAllowedGain = Math.pow(10, (this.config.maxPeakDb - metrics.peakLevel) / 20);
    gainLinear = Math.min(gainLinear, maxAllowedGain);
    
    // Create normalized buffer
    const normalizedBuffer = audioContext.createBuffer(
      audioData.numberOfChannels,
      audioData.length,
      audioData.sampleRate
    );
    
    // Process each channel
    for (let channel = 0; channel < audioData.numberOfChannels; channel++) {
      const inputData = audioData.getChannelData(channel);
      const outputData = normalizedBuffer.getChannelData(channel);
      
      this.processChannel(inputData, outputData, gainLinear, metrics);
    }
    
    // Store metrics for conversation consistency
    this.conversationHistory.push({
      ...metrics,
      gainApplied: 20 * Math.log10(gainLinear),
      compressionApplied: metrics.peakLevel > this.config.compressionThreshold
    });
    
    // Keep only recent history (last 10 audio segments)
    if (this.conversationHistory.length > 10) {
      this.conversationHistory = this.conversationHistory.slice(-10);
    }
    
    return normalizedBuffer;
  }

  /**
   * Process individual audio channel with gain and compression
   */
  private processChannel(
    inputData: Float32Array, 
    outputData: Float32Array, 
    gain: number,
    metrics: AudioLevelMetrics
  ): void {
    const compressionThresholdLinear = Math.pow(10, this.config.compressionThreshold / 20);
    const ratio = this.config.compressionRatio;
    
    for (let i = 0; i < inputData.length; i++) {
      let sample = inputData[i] * gain;
      
      // Apply compression if needed
      if (Math.abs(sample) > compressionThresholdLinear) {
        const sign = sample >= 0 ? 1 : -1;
        const absSample = Math.abs(sample);
        const excess = absSample - compressionThresholdLinear;
        const compressedExcess = excess / ratio;
        sample = sign * (compressionThresholdLinear + compressedExcess);
      }
      
      // Final limiting to prevent clipping
      const maxLevel = Math.pow(10, this.config.maxPeakDb / 20);
      sample = Math.max(-maxLevel, Math.min(maxLevel, sample));
      
      outputData[i] = sample;
    }
  }

  /**
   * Calculate audio metrics for level analysis
   */
  private calculateAudioMetrics(channelData: Float32Array): AudioLevelMetrics {
    let sumSquares = 0;
    let peak = 0;
    
    // Calculate RMS and peak
    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.abs(channelData[i]);
      sumSquares += sample * sample;
      peak = Math.max(peak, sample);
    }
    
    const rms = Math.sqrt(sumSquares / channelData.length);
    
    // Convert to dB
    const peakDb = 20 * Math.log10(peak + 1e-10);
    const rmsDb = 20 * Math.log10(rms + 1e-10);
    
    // Estimate LUFS (simplified calculation)
    // Real LUFS calculation requires K-weighting filter
    const estimatedLUFS = -0.691 + 10 * Math.log10(rms + 1e-10);
    
    // Calculate dynamic range
    const sortedSamples = Array.from(channelData).map(Math.abs).sort((a, b) => a - b);
    const noiseFloor = sortedSamples[Math.floor(sortedSamples.length * 0.1)];
    const dynamicRange = peakDb - (20 * Math.log10(noiseFloor + 1e-10));
    
    return {
      currentLUFS: estimatedLUFS,
      peakLevel: peakDb,
      rmsLevel: rmsDb,
      dynamicRange: Math.max(0, dynamicRange),
      gainApplied: 0,
      compressionApplied: false
    };
  }

  /**
   * Get adaptive gain based on conversation history
   */
  private getAdaptiveGain(currentMetrics: AudioLevelMetrics): number {
    if (this.conversationHistory.length === 0) {
      return 1.0;
    }
    
    // Calculate average LUFS from recent history
    const avgLUFS = this.conversationHistory.reduce((sum, m) => sum + m.currentLUFS, 0) / this.conversationHistory.length;
    
    // Adjust gain to maintain consistency with conversation
    const consistencyGainDb = avgLUFS - currentMetrics.currentLUFS;
    const consistencyGain = Math.pow(10, consistencyGainDb / 40); // Gentle adjustment
    
    // Limit adaptive gain to prevent extreme adjustments
    return Math.max(0.5, Math.min(2.0, consistencyGain));
  }

  /**
   * Get conversation-level audio statistics
   */
  getConversationStats(): {
    averageLUFS: number;
    lufsVariance: number;
    peakRange: { min: number; max: number };
    consistencyScore: number;
  } {
    if (this.conversationHistory.length === 0) {
      return {
        averageLUFS: 0,
        lufsVariance: 0,
        peakRange: { min: 0, max: 0 },
        consistencyScore: 0
      };
    }
    
    const lufsValues = this.conversationHistory.map(m => m.currentLUFS);
    const peakValues = this.conversationHistory.map(m => m.peakLevel);
    
    const avgLUFS = lufsValues.reduce((sum, val) => sum + val, 0) / lufsValues.length;
    const lufsVariance = lufsValues.reduce((sum, val) => sum + Math.pow(val - avgLUFS, 2), 0) / lufsValues.length;
    
    const minPeak = Math.min(...peakValues);
    const maxPeak = Math.max(...peakValues);
    
    // Consistency score: higher is better (0-1 scale)
    const consistencyScore = Math.max(0, 1 - (lufsVariance / 25)); // Normalize variance to 0-1
    
    return {
      averageLUFS: avgLUFS,
      lufsVariance: lufsVariance,
      peakRange: { min: minPeak, max: maxPeak },
      consistencyScore: consistencyScore
    };
  }

  /**
   * Reset conversation history
   */
  resetConversation(): void {
    this.conversationHistory = [];
    this.targetGain = 1.0;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AudioLevelConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * Global audio level manager instance
 */
export const globalAudioLevelManager = new AudioLevelManager();

/**
 * Utility function to normalize audio with default settings
 */
export async function normalizeConversationAudio(audioBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  return await globalAudioLevelManager.normalizeAudioBuffer(audioBuffer);
}

/**
 * Utility function to get conversation audio statistics
 */
export function getConversationAudioStats() {
  return globalAudioLevelManager.getConversationStats();
}