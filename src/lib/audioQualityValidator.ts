/**
 * Audio Quality Validator
 * 
 * Implements LUFS validation gate and peak/RMS checks for expression overlays
 * Ensures -14 LUFS normalization and true-peak < -1 dBTP constraints
 * 
 * Requirements: 3.3, 3.5 (Task 5)
 */

import { logger } from './logger';

export interface AudioQualityMetrics {
  /** Integrated LUFS measurement */
  lufs: number;
  /** True peak level in dBTP */
  truePeak: number;
  /** RMS level in dB */
  rms: number;
  /** Peak level in dB */
  peak: number;
  /** Whether audio passes quality gate */
  passesQualityGate: boolean;
  /** Validation errors if any */
  validationErrors: string[];
}

export interface QualityConstraints {
  /** Target LUFS level */
  targetLufs: number;
  /** Maximum true peak level in dBTP */
  maxTruePeak: number;
  /** LUFS tolerance range */
  lufsTolerance: number;
  /** Minimum RMS level for content detection */
  minRms: number;
}

/**
 * Default quality constraints for expression overlays
 */
export const DEFAULT_QUALITY_CONSTRAINTS: QualityConstraints = {
  targetLufs: -14.0,     // -14 LUFS target as per requirement
  maxTruePeak: -1.0,     // True-peak < -1 dBTP as per requirement
  lufsTolerance: 1.0,    // ±1 LUFS tolerance
  minRms: -60.0          // Minimum RMS to detect silence
};

/**
 * Audio Quality Validator for expression overlays
 */
export class AudioQualityValidator {
  private constraints: QualityConstraints;
  private audioContext: AudioContext | null = null;

  constructor(constraints: Partial<QualityConstraints> = {}) {
    this.constraints = { ...DEFAULT_QUALITY_CONSTRAINTS, ...constraints };
  }

  /**
   * Initialize audio context for analysis
   */
  async initialize(): Promise<boolean> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize AudioQualityValidator', { error });
      return false;
    }
  }

  /**
   * Validate audio buffer quality against constraints
   */
  async validateAudioBuffer(audioBuffer: AudioBuffer): Promise<AudioQualityMetrics> {
    if (!this.audioContext) {
      throw new Error('AudioQualityValidator not initialized');
    }

    const startTime = performance.now();
    
    try {
      // Get audio data for analysis
      const channelData = audioBuffer.getChannelData(0); // Use first channel
      const sampleRate = audioBuffer.sampleRate;
      
      // Calculate audio metrics
      const metrics = this.calculateAudioMetrics(channelData, sampleRate);
      
      // Validate against constraints
      const validationResult = this.validateMetrics(metrics);
      
      const processingTime = performance.now() - startTime;
      
      logger.debug('Audio quality validation completed', {
        lufs: metrics.lufs,
        truePeak: metrics.truePeak,
        rms: metrics.rms,
        peak: metrics.peak,
        passesQualityGate: validationResult.passesQualityGate,
        validationErrors: validationResult.validationErrors,
        processingTime
      });
      
      return validationResult;
      
    } catch (error) {
      logger.error('Audio quality validation failed', { error });
      
      // Return failed validation result
      return {
        lufs: 0,
        truePeak: 0,
        rms: -Infinity,
        peak: -Infinity,
        passesQualityGate: false,
        validationErrors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Calculate audio metrics from sample data
   */
  private calculateAudioMetrics(samples: Float32Array, sampleRate: number): Omit<AudioQualityMetrics, 'passesQualityGate' | 'validationErrors'> {
    const numSamples = samples.length;
    
    // Calculate RMS (Root Mean Square)
    let sumSquares = 0;
    let peak = 0;
    
    for (let i = 0; i < numSamples; i++) {
      const sample = Math.abs(samples[i]);
      sumSquares += sample * sample;
      peak = Math.max(peak, sample);
    }
    
    const rms = Math.sqrt(sumSquares / numSamples);
    const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
    const peakDb = peak > 0 ? 20 * Math.log10(peak) : -Infinity;
    
    // Calculate LUFS (simplified implementation)
    // Note: This is a simplified LUFS calculation. A full implementation would require
    // proper K-weighting filter and gating as per ITU-R BS.1770-4
    const lufs = this.calculateSimplifiedLufs(samples, sampleRate);
    
    // Calculate true peak (simplified - would need oversampling for full accuracy)
    const truePeak = peakDb; // Simplified - true peak would need 4x oversampling
    
    return {
      lufs,
      truePeak,
      rms: rmsDb,
      peak: peakDb
    };
  }

  /**
   * Simplified LUFS calculation
   * Note: This is a basic implementation. Production code should use proper K-weighting
   */
  private calculateSimplifiedLufs(samples: Float32Array, sampleRate: number): number {
    // Apply basic K-weighting approximation (simplified)
    const filtered = this.applyKWeightingApproximation(samples, sampleRate);
    
    // Calculate mean square with gating
    let sumSquares = 0;
    let validSamples = 0;
    
    // Simple gating: exclude samples below -70 LUFS relative threshold
    const gatingThreshold = Math.pow(10, -70 / 20);
    
    for (let i = 0; i < filtered.length; i++) {
      const sample = Math.abs(filtered[i]);
      if (sample > gatingThreshold) {
        sumSquares += sample * sample;
        validSamples++;
      }
    }
    
    if (validSamples === 0) {
      return -Infinity;
    }
    
    const meanSquare = sumSquares / validSamples;
    const lufs = -0.691 + 10 * Math.log10(meanSquare);
    
    return lufs;
  }

  /**
   * Apply simplified K-weighting filter approximation
   */
  private applyKWeightingApproximation(samples: Float32Array, sampleRate: number): Float32Array {
    // This is a very simplified approximation of K-weighting
    // A proper implementation would use the exact filter coefficients from ITU-R BS.1770-4
    
    const filtered = new Float32Array(samples.length);
    
    // Simple high-pass filter approximation (removes DC and very low frequencies)
    let prev = 0;
    const alpha = 0.99; // High-pass filter coefficient
    
    for (let i = 0; i < samples.length; i++) {
      filtered[i] = samples[i] - prev;
      prev = alpha * prev + (1 - alpha) * samples[i];
    }
    
    return filtered;
  }

  /**
   * Validate metrics against quality constraints
   */
  private validateMetrics(metrics: Omit<AudioQualityMetrics, 'passesQualityGate' | 'validationErrors'>): AudioQualityMetrics {
    const validationErrors: string[] = [];
    
    // Check LUFS target compliance
    const lufsDeviation = Math.abs(metrics.lufs - this.constraints.targetLufs);
    if (lufsDeviation > this.constraints.lufsTolerance) {
      validationErrors.push(
        `LUFS deviation too high: ${metrics.lufs.toFixed(1)} LUFS (target: ${this.constraints.targetLufs} ±${this.constraints.lufsTolerance})`
      );
    }
    
    // Check true peak compliance
    if (metrics.truePeak > this.constraints.maxTruePeak) {
      validationErrors.push(
        `True peak too high: ${metrics.truePeak.toFixed(1)} dBTP (max: ${this.constraints.maxTruePeak} dBTP)`
      );
    }
    
    // Check for silence/very low content
    if (metrics.rms < this.constraints.minRms) {
      validationErrors.push(
        `RMS level too low: ${metrics.rms.toFixed(1)} dB (min: ${this.constraints.minRms} dB) - possible silence`
      );
    }
    
    // Check for clipping indicators
    if (metrics.peak >= -0.1) { // Very close to 0 dBFS
      validationErrors.push(
        `Potential clipping detected: peak at ${metrics.peak.toFixed(1)} dB`
      );
    }
    
    const passesQualityGate = validationErrors.length === 0;
    
    return {
      ...metrics,
      passesQualityGate,
      validationErrors
    };
  }

  /**
   * Normalize audio buffer to target LUFS level
   */
  async normalizeAudioBuffer(audioBuffer: AudioBuffer): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('AudioQualityValidator not initialized');
    }

    // First, validate current quality
    const currentMetrics = await this.validateAudioBuffer(audioBuffer);
    
    // Calculate required gain adjustment
    const gainAdjustmentDb = this.constraints.targetLufs - currentMetrics.lufs;
    const gainLinear = Math.pow(10, gainAdjustmentDb / 20);
    
    // Create new buffer with normalized audio
    const normalizedBuffer = this.audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    
    // Apply gain to each channel
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = normalizedBuffer.getChannelData(channel);
      
      for (let i = 0; i < inputData.length; i++) {
        // Apply gain with soft limiting to prevent clipping
        let sample = inputData[i] * gainLinear;
        
        // Soft limiter to prevent exceeding -1 dBTP
        const limitThreshold = Math.pow(10, this.constraints.maxTruePeak / 20);
        if (Math.abs(sample) > limitThreshold) {
          sample = Math.sign(sample) * limitThreshold * Math.tanh(Math.abs(sample) / limitThreshold);
        }
        
        outputData[i] = sample;
      }
    }
    
    logger.debug('Audio buffer normalized', {
      originalLufs: currentMetrics.lufs,
      targetLufs: this.constraints.targetLufs,
      gainAdjustmentDb,
      gainLinear
    });
    
    return normalizedBuffer;
  }

  /**
   * Quick quality check for real-time validation
   */
  quickQualityCheck(audioBuffer: AudioBuffer): { isValid: boolean; reason?: string } {
    try {
      const channelData = audioBuffer.getChannelData(0);
      
      // Quick peak check
      let peak = 0;
      let rmsSum = 0;
      
      for (let i = 0; i < channelData.length; i++) {
        const sample = Math.abs(channelData[i]);
        peak = Math.max(peak, sample);
        rmsSum += sample * sample;
      }
      
      const peakDb = peak > 0 ? 20 * Math.log10(peak) : -Infinity;
      const rmsDb = rmsSum > 0 ? 20 * Math.log10(Math.sqrt(rmsSum / channelData.length)) : -Infinity;
      
      // Quick validation checks
      if (peakDb > this.constraints.maxTruePeak) {
        return { isValid: false, reason: `Peak too high: ${peakDb.toFixed(1)} dB` };
      }
      
      if (rmsDb < this.constraints.minRms) {
        return { isValid: false, reason: `Content too quiet: ${rmsDb.toFixed(1)} dB` };
      }
      
      if (peak >= 0.99) { // Near clipping
        return { isValid: false, reason: 'Potential clipping detected' };
      }
      
      return { isValid: true };
      
    } catch (error) {
      return { isValid: false, reason: `Validation error: ${error instanceof Error ? error.message : 'Unknown'}` };
    }
  }

  /**
   * Get current quality constraints
   */
  getConstraints(): QualityConstraints {
    return { ...this.constraints };
  }

  /**
   * Update quality constraints
   */
  updateConstraints(newConstraints: Partial<QualityConstraints>): void {
    this.constraints = { ...this.constraints, ...newConstraints };
    logger.debug('Quality constraints updated', { constraints: this.constraints });
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    // Don't close AudioContext as it might be shared
    this.audioContext = null;
  }
}

/**
 * Global audio quality validator instance
 */
export const globalAudioQualityValidator = new AudioQualityValidator();

/**
 * Utility function to validate expression audio before use
 */
export async function validateExpressionAudio(
  audioBuffer: AudioBuffer,
  validator?: AudioQualityValidator
): Promise<AudioQualityMetrics> {
  const validatorInstance = validator || globalAudioQualityValidator;
  
  if (!validatorInstance) {
    throw new Error('Audio quality validator not available');
  }
  
  return await validatorInstance.validateAudioBuffer(audioBuffer);
}

/**
 * Utility function for quick audio validation
 */
export function quickValidateAudio(audioBuffer: AudioBuffer): { isValid: boolean; reason?: string } {
  return globalAudioQualityValidator.quickQualityCheck(audioBuffer);
}