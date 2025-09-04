/**
 * Expression Audio Mixer
 * 
 * Web Audio API-based mixer that overlays expression audio on TTS without blocking.
 * Provides smooth ducking, blending, and graceful degradation.
 * 
 * Requirements: 5.3, 5.5, 6.3, 9.3, 9.4
 */

import { OverlaySchedule } from './expressionScheduler';
import { 
  expressionErrorHandler, 
  ExpressionErrorType, 
  ExpressionErrorStage,
  PlaybackContext 
} from './expressionErrorHandler';
import { expressionMetrics, expressionMetricsRecorder } from './expressionMetrics';
import { expressionPerformanceMonitor } from './expressionPerformanceMonitor';
import { logger } from './logger';
import { 
  AudioQualityValidator, 
  globalAudioQualityValidator,
  validateExpressionAudio,
  quickValidateAudio 
} from './audioQualityValidator';

export interface MixerOptions {
  /** Master volume for all audio (0-1) */
  masterVolume?: number;
  /** Ducking amount for TTS during expressions (0-1) */
  duckingAmount?: number;
  /** Fade in/out duration for smooth transitions (ms) */
  fadeDurationMs?: number;
  /** Maximum expression duration to prevent long overlays (ms) */
  maxExpressionDurationMs?: number;
  /** Maximum overlays per 10-second window (Task 5 requirement) */
  maxOverlaysPer10s?: number;
  /** Enable audio quality validation */
  enableQualityValidation?: boolean;
}

export interface MixerState {
  /** Whether the mixer is currently active */
  isActive: boolean;
  /** Number of expressions currently playing */
  activeExpressions: number;
  /** Whether TTS is currently ducked */
  isDucked: boolean;
  /** Current master volume level */
  currentVolume: number;
  /** Recent overlay timestamps for 10-second window tracking */
  recentOverlays: number[];
  /** Quality validation statistics */
  qualityStats: {
    totalValidated: number;
    passed: number;
    failed: number;
  };
}

/**
 * Web Audio mixer for expression overlays
 */
export class ExpressionAudioMixer {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ttsGain: GainNode | null = null;
  private expressionGain: GainNode | null = null;
  private destination: AudioNode | null = null;
  
  private options: Required<MixerOptions>;
  private state: MixerState;
  private activeSchedules = new Map<string, { source: AudioBufferSourceNode; gainNode: GainNode; timeoutId: number }>();
  private isInitialized = false;
  private qualityValidator: AudioQualityValidator | null = null;

  constructor(options: MixerOptions = {}) {
    this.options = {
      masterVolume: options.masterVolume ?? 1.0,
      duckingAmount: options.duckingAmount ?? 0.4, // 3-6dB reduction as per Task 5
      fadeDurationMs: options.fadeDurationMs ?? 50,
      maxExpressionDurationMs: options.maxExpressionDurationMs ?? 300,
      maxOverlaysPer10s: options.maxOverlaysPer10s ?? 2, // Task 5 requirement: max 2 overlays per 10s
      enableQualityValidation: options.enableQualityValidation ?? true
    };

    this.state = {
      isActive: false,
      activeExpressions: 0,
      isDucked: false,
      currentVolume: this.options.masterVolume,
      recentOverlays: [],
      qualityStats: {
        totalValidated: 0,
        passed: 0,
        failed: 0
      }
    };
  }

  /**
   * Initialize the Web Audio mixer
   */
  async initialize(audioContext?: AudioContext): Promise<boolean> {
    try {
      // Use provided context or create new one
      this.audioContext = audioContext || new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume context if suspended (required for user interaction)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create audio graph: source -> ttsGain -> masterGain -> destination
      this.masterGain = this.audioContext.createGain();
      this.ttsGain = this.audioContext.createGain();
      this.expressionGain = this.audioContext.createGain();
      
      // Set initial volumes
      this.masterGain.gain.value = this.options.masterVolume;
      this.ttsGain.gain.value = 1.0;
      this.expressionGain.gain.value = 1.0;
      
      // Connect audio graph
      this.ttsGain.connect(this.masterGain);
      this.expressionGain.connect(this.masterGain);
      this.masterGain.connect(this.audioContext.destination);
      
      // Store destination for external connections
      this.destination = this.masterGain;
      
      // Initialize quality validator if enabled
      if (this.options.enableQualityValidation) {
        this.qualityValidator = globalAudioQualityValidator;
        await this.qualityValidator.initialize();
      }
      
      this.isInitialized = true;
      this.state.isActive = true;
      
      logger.debug('ExpressionAudioMixer initialized successfully', {
        sampleRate: this.audioContext.sampleRate,
        state: this.audioContext.state,
        qualityValidationEnabled: this.options.enableQualityValidation,
        maxOverlaysPer10s: this.options.maxOverlaysPer10s,
        duckingAmount: this.options.duckingAmount
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize ExpressionAudioMixer', { error });
      
      // Record error metrics
      expressionMetrics.errorCount.inc({
        error_type: ExpressionErrorType.AUDIO_CONTEXT_ERROR,
        error_stage: ExpressionErrorStage.INITIALIZATION,
        owner_type: 'unknown'
      });
      
      return false;
    }
  }

  /**
   * Get the TTS input node for connecting TTS audio
   */
  getTTSInput(): AudioNode | null {
    return this.ttsGain;
  }

  /**
   * Get the master output node for connecting to speakers
   */
  getOutput(): AudioNode | null {
    return this.destination;
  }

  /**
   * Play expression overlays according to schedule with quality validation and 10s window constraint
   */
  async playExpressionOverlays(
    schedules: OverlaySchedule[],
    preloadedBuffers: Map<string, AudioBuffer>,
    startTimeOffset: number = 0,
    context?: PlaybackContext
  ): Promise<void> {
    if (!this.isInitialized || !this.audioContext || schedules.length === 0) {
      return;
    }

    expressionMetricsRecorder.startMixing();
    
    try {
      const currentTime = this.audioContext.currentTime;
      let successfulOverlays = 0;

      // Clean up old overlay timestamps (older than 10 seconds)
      const tenSecondsAgo = Date.now() - 10000;
      this.state.recentOverlays = this.state.recentOverlays.filter(timestamp => timestamp > tenSecondsAgo);

      for (const schedule of schedules) {
        // Task 5: Enforce maximum 2 overlays per 10-second window
        if (this.state.recentOverlays.length >= this.options.maxOverlaysPer10s) {
          logger.debug(`Skipping expression ${schedule.clip.id} - 10-second window limit reached (${this.state.recentOverlays.length}/${this.options.maxOverlaysPer10s})`);
          continue;
        }

        const buffer = preloadedBuffers.get(schedule.clip.id);
        
        // Graceful degradation: skip if buffer not ready
        if (!buffer) {
          logger.warn(`Expression buffer not ready for ${schedule.clip.id}, skipping`);
          
          if (context) {
            const error = expressionErrorHandler.createError(
              ExpressionErrorType.BUFFER_NOT_READY,
              ExpressionErrorStage.PLAYBACK,
              `Buffer not ready for expression ${schedule.clip.id}`,
              { expressionId: schedule.clip.id, ownerId: context.ownerId }
            );
            await expressionErrorHandler.handleExpressionFailure(error, context);
          }
          continue;
        }

        // Task 5: Audio quality validation with LUFS and peak checks
        if (this.qualityValidator && this.options.enableQualityValidation) {
          try {
            const qualityMetrics = await validateExpressionAudio(buffer, this.qualityValidator);
            this.state.qualityStats.totalValidated++;
            
            if (!qualityMetrics.passesQualityGate) {
              this.state.qualityStats.failed++;
              logger.warn(`Expression ${schedule.clip.id} failed quality validation`, {
                lufs: qualityMetrics.lufs,
                truePeak: qualityMetrics.truePeak,
                errors: qualityMetrics.validationErrors
              });
              
              // Skip this expression due to quality issues
              continue;
            } else {
              this.state.qualityStats.passed++;
              logger.debug(`Expression ${schedule.clip.id} passed quality validation`, {
                lufs: qualityMetrics.lufs.toFixed(1),
                truePeak: qualityMetrics.truePeak.toFixed(1),
                rms: qualityMetrics.rms.toFixed(1)
              });
            }
          } catch (validationError) {
            logger.warn(`Quality validation failed for ${schedule.clip.id}`, { error: validationError });
            // Continue with playback despite validation failure (graceful degradation)
          }
        }

        // Check and enforce maximum duration limit
        const actualDuration = Math.min(
          schedule.clip.durationMs,
          this.options.maxExpressionDurationMs
        );

        // Monitor expression duration
        if (context) {
          const durationValid = expressionPerformanceMonitor.measureExpressionDuration(
            schedule.clip.id,
            schedule.clip.durationMs,
            schedule.clip.type,
            context.ownerType,
            { priority: schedule.clip.priority }
          );

          if (!durationValid) {
            logger.warn(`Expression ${schedule.clip.id} exceeds duration limit, skipping`);
            continue;
          }
        }

        // Calculate start time
        const startTime = currentTime + startTimeOffset + (schedule.startTimeMs / 1000);
        
        // Schedule the expression playback
        try {
          this.scheduleExpressionPlayback(
            schedule.clip.id,
            buffer,
            startTime,
            actualDuration / 1000,
            schedule.duckingLevel
          );
          successfulOverlays++;

          // Track this overlay in the 10-second window
          this.state.recentOverlays.push(Date.now());

          // Record expression usage
          expressionMetricsRecorder.recordExpressionUsage(
            schedule.clip.type,
            context?.ownerType || 'unknown',
            schedule.clip.priority >= 50 ? 'admin' : 'priority'
          );

        } catch (playbackError) {
          if (context) {
            await expressionErrorHandler.handlePlaybackError(
              schedule.clip.id,
              playbackError instanceof Error ? playbackError : new Error('Playback failed'),
              context
            );
          }
        }
      }

      // Record overlay count metrics
      if (context) {
        expressionMetrics.overlaysCount.observe(
          {
            owner_type: context.ownerType,
            avatar_id: context.ownerId,
            turn_type: 'regular'
          },
          successfulOverlays
        );
      }

      expressionMetricsRecorder.recordMixingComplete(
        'play',
        successfulOverlays
      );

      logger.debug('Expression overlay playback completed', {
        scheduledCount: schedules.length,
        successfulCount: successfulOverlays,
        recentOverlaysCount: this.state.recentOverlays.length,
        qualityStats: this.state.qualityStats
      });

    } catch (error) {
      logger.error('Error in playExpressionOverlays', { error });
      
      if (context) {
        const expressionError = expressionErrorHandler.createError(
          ExpressionErrorType.PLAYBACK_ERROR,
          ExpressionErrorStage.MIXING,
          error instanceof Error ? error.message : 'Unknown mixing error',
          { ownerId: context.ownerId }
        );
        await expressionErrorHandler.handleExpressionFailure(expressionError, context);
      }
    }
  }

  /**
   * Schedule a single expression playback with ducking
   */
  private scheduleExpressionPlayback(
    expressionId: string,
    buffer: AudioBuffer,
    startTime: number,
    durationSeconds: number,
    duckingLevel: number
  ): void {
    if (!this.audioContext || !this.expressionGain || !this.ttsGain) {
      throw new Error('Audio context not initialized');
    }

    const mixingStartTime = performance.now();

    try {
      // Create buffer source and gain node for this expression
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();
      
      source.buffer = buffer;
      
      // Connect: source -> gainNode -> expressionGain
      source.connect(gainNode);
      gainNode.connect(this.expressionGain);
      
      // Set initial volume with fade-in
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(
        1.0,
        startTime + (this.options.fadeDurationMs / 1000)
      );
      
      // Schedule fade-out before ending
      const fadeOutStart = startTime + durationSeconds - (this.options.fadeDurationMs / 1000);
      gainNode.gain.setValueAtTime(1.0, fadeOutStart);
      gainNode.gain.linearRampToValueAtTime(0, startTime + durationSeconds);
      
      // Schedule TTS ducking
      this.scheduleTTSDucking(startTime, durationSeconds, duckingLevel);
      
      // Start playback
      source.start(startTime);
      source.stop(startTime + durationSeconds);
      
      // Track active expression
      const timeoutId = window.setTimeout(() => {
        this.cleanupExpression(expressionId);
      }, (startTime - this.audioContext!.currentTime + durationSeconds) * 1000);
      
      this.activeSchedules.set(expressionId, { source, gainNode, timeoutId });
      this.state.activeExpressions++;
      
      // Handle source end
      source.onended = () => {
        this.cleanupExpression(expressionId);
      };

      // Record mixing latency
      const mixingDuration = performance.now() - mixingStartTime;
      expressionMetricsRecorder.recordMixingComplete(
        'schedule',
        this.state.activeExpressions
      );

      logger.debug('Expression scheduled successfully', {
        expressionId,
        startTime,
        durationSeconds,
        duckingLevel,
        mixingLatency: mixingDuration
      });
      
    } catch (error) {
      const mixingDuration = performance.now() - mixingStartTime;
      
      logger.error(`Failed to schedule expression ${expressionId}`, { error });
      
      // Record error metrics
      expressionMetrics.errorCount.inc({
        error_type: ExpressionErrorType.PLAYBACK_ERROR,
        error_stage: ExpressionErrorStage.MIXING,
        owner_type: 'unknown'
      });

      throw error;
    }
  }

  /**
   * Schedule TTS ducking during expression playback
   */
  private scheduleTTSDucking(
    startTime: number,
    durationSeconds: number,
    duckingLevel: number
  ): void {
    if (!this.audioContext || !this.ttsGain) {
      return;
    }

    const currentTime = this.audioContext.currentTime;
    const fadeDuration = this.options.fadeDurationMs / 1000;
    
    // Calculate ducked volume (reduce by duckingLevel amount)
    const duckedVolume = 1.0 - duckingLevel;
    
    // Only duck if we're not already ducked or if this is more aggressive ducking
    const currentGain = this.ttsGain.gain.value;
    const targetDuckedVolume = Math.min(currentGain, duckedVolume);
    
    // Schedule duck down
    if (startTime > currentTime) {
      // Future start - schedule smooth duck down
      this.ttsGain.gain.setValueAtTime(currentGain, startTime);
      this.ttsGain.gain.linearRampToValueAtTime(targetDuckedVolume, startTime + fadeDuration);
    } else {
      // Immediate start - duck down now
      this.ttsGain.gain.linearRampToValueAtTime(targetDuckedVolume, currentTime + fadeDuration);
    }
    
    // Schedule duck up (restore volume)
    const restoreTime = startTime + durationSeconds - fadeDuration;
    this.ttsGain.gain.setValueAtTime(targetDuckedVolume, restoreTime);
    this.ttsGain.gain.linearRampToValueAtTime(1.0, startTime + durationSeconds);
    
    this.state.isDucked = true;
    
    // Schedule unduck state update
    setTimeout(() => {
      if (this.state.activeExpressions === 0) {
        this.state.isDucked = false;
      }
    }, (startTime - currentTime + durationSeconds) * 1000);
  }

  /**
   * Clean up finished expression
   */
  private cleanupExpression(expressionId: string): void {
    const schedule = this.activeSchedules.get(expressionId);
    if (schedule) {
      // Clear timeout
      clearTimeout(schedule.timeoutId);
      
      // Disconnect nodes
      try {
        schedule.source.disconnect();
        schedule.gainNode.disconnect();
      } catch (error) {
        // Nodes might already be disconnected
      }
      
      // Remove from tracking
      this.activeSchedules.delete(expressionId);
      this.state.activeExpressions = Math.max(0, this.state.activeExpressions - 1);
      
      // Update ducking state
      if (this.state.activeExpressions === 0) {
        this.state.isDucked = false;
      }
    }
  }

  /**
   * Stop all expression playback immediately
   */
  stopAllExpressions(): void {
    for (const [expressionId, schedule] of this.activeSchedules) {
      try {
        schedule.source.stop();
      } catch (error) {
        // Source might already be stopped
      }
      this.cleanupExpression(expressionId);
    }
    
    // Restore TTS volume immediately
    if (this.ttsGain && this.audioContext) {
      this.ttsGain.gain.cancelScheduledValues(this.audioContext.currentTime);
      this.ttsGain.gain.setValueAtTime(1.0, this.audioContext.currentTime);
    }
    
    this.state.isDucked = false;
    this.state.activeExpressions = 0;
    // Clear recent overlay tracking
    this.state.recentOverlays = [];
  }

  /**
   * Set master volume
   */
  setMasterVolume(volume: number): void {
    if (this.masterGain && volume >= 0 && volume <= 1) {
      this.masterGain.gain.value = volume;
      this.state.currentVolume = volume;
      this.options.masterVolume = volume;
    }
  }

  /**
   * Get current mixer state
   */
  getState(): MixerState {
    return { ...this.state };
  }

  /**
   * Check if mixer is ready for use
   */
  isReady(): boolean {
    return this.isInitialized && this.audioContext !== null && this.audioContext.state === 'running';
  }

  /**
   * Cleanup and dispose of resources
   */
  dispose(): void {
    // Stop all expressions
    this.stopAllExpressions();
    
    // Disconnect audio nodes
    try {
      if (this.masterGain) this.masterGain.disconnect();
      if (this.ttsGain) this.ttsGain.disconnect();
      if (this.expressionGain) this.expressionGain.disconnect();
    } catch (error) {
      // Nodes might already be disconnected
    }
    
    // Clear references
    this.masterGain = null;
    this.ttsGain = null;
    this.expressionGain = null;
    this.destination = null;
    
    // Don't close AudioContext as it might be shared
    this.audioContext = null;
    
    this.isInitialized = false;
    this.state.isActive = false;
  }
}

/**
 * Utility function to create and initialize a mixer
 */
export async function createExpressionMixer(
  options: MixerOptions = {},
  audioContext?: AudioContext
): Promise<ExpressionAudioMixer | null> {
  const mixer = new ExpressionAudioMixer(options);
  const initialized = await mixer.initialize(audioContext);
  
  if (!initialized) {
    mixer.dispose();
    return null;
  }
  
  return mixer;
}

/**
 * Check if Web Audio API is supported
 */
export function isWebAudioSupported(): boolean {
  return typeof window !== 'undefined' && 
         (window.AudioContext !== undefined || (window as any).webkitAudioContext !== undefined);
}