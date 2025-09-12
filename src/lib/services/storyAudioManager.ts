/**
 * StoryAudioManager - Handles story playback integration with TTS system
 * 
 * This service manages the audio playback of authentic voice stories, including:
 * - Audio buffer preloading with 2-second timeout constraint
 * - Graceful fallback to TTS when story loading fails or times out
 * - MVP concurrency: ignore new triggers if story is playing (no queueing yet)
 * - Integration with existing StreamingAudioManager
 * 
 * Requirements: 3.1, 3.3, 3.5, 8.6
 */

import { UserStory, StoryPlaybackOptions, StoryPlaybackResult, StoryPlaybackError } from '../types/stories';
import { StreamingAudioManager } from '../streamingUtils';
import { globalAudioManager } from '../globalAudioManager';
import { mobileAudioContextManager, isMobileSafari } from '../mobileAudioContextManager';
import { storyErrorHandler, StoryErrorHandler, StoryErrorType } from './storyErrorHandler';
import StoryMetricsCollector from './storyMetrics';
// Task 12: Mobile optimization and resource management
import { globalMobileStoryResourceManager, MobileStoryResourceManager } from './mobileStoryResourceManager';
// Task 17: Experimental lip-sync integration
import { globalStoryLipSyncService, StoryLipSyncService, LipSyncResult } from './storyLipSyncService';

export interface StoryAudioManagerConfig {
  preloadTimeoutMs: number; // Default: 2000ms (Requirement 8.6)
  fallbackToTTS: boolean; // Default: true (Requirement 3.5)
  enableLipSync: boolean; // Default: false (experimental)
  maxConcurrentLoads: number; // Default: 1 (MVP constraint)
  audioBufferCacheSize: number; // Default: 15MB (mobile-friendly)
}

export interface StoryLoadResult {
  success: boolean;
  audioBuffer?: AudioBuffer;
  duration?: number;
  error?: string;
  loadTimeMs?: number;
}

export interface StoryConcurrencyState {
  isPlaying: boolean;
  currentStoryId?: string;
  playbackStartTime?: number;
  queuedStoryId?: string; // Task 13: Now actively used for story queue
  queuedStoryTimestamp?: number; // When the story was queued
}

export interface StoryQueueEntry {
  story: UserStory;
  options: StoryPlaybackOptions;
  streamingManager: StreamingAudioManager;
  queuedAt: number;
  fallbackCallback?: () => Promise<void>;
}

export interface ConcurrencyDecision {
  action: 'play' | 'queue' | 'replace_queue' | 'ignore';
  reason: string;
  shouldLog: boolean;
}

export class StoryAudioManager {
  private config: StoryAudioManagerConfig;
  private audioContext: AudioContext | null = null;
  private audioBufferCache = new Map<string, AudioBuffer>();
  private loadingPromises = new Map<string, Promise<StoryLoadResult>>();
  private concurrencyState: StoryConcurrencyState = { isPlaying: false };
  private cooldownTimers = new Map<string, number>(); // avatarId -> timestamp
  private readonly COOLDOWN_MS = 30000; // 30 seconds between story triggers
  private errorHandler: StoryErrorHandler;
  private metricsCollector = StoryMetricsCollector.getInstance();
  // Task 12: Mobile resource management
  private mobileResourceManager: MobileStoryResourceManager;
  // Task 13: Enhanced concurrency handling
  private storyQueue: StoryQueueEntry | null = null; // Max 1 pending story
  private readonly MAX_QUEUE_AGE_MS = 10000; // 10 seconds max queue time
  // Task 17: Experimental lip-sync integration
  private lipSyncService: StoryLipSyncService;

  constructor(config: Partial<StoryAudioManagerConfig> = {}) {
    this.config = {
      preloadTimeoutMs: 2000, // Requirement 8.6: 2-second timeout
      fallbackToTTS: true, // Requirement 3.5: graceful fallback
      enableLipSync: false, // Experimental feature
      maxConcurrentLoads: 1, // MVP constraint
      audioBufferCacheSize: 15 * 1024 * 1024, // 15MB mobile-friendly cache
      ...config
    };

    // Initialize error handler with story-specific configuration
    this.errorHandler = new StoryErrorHandler({
      maxRetries: 2,
      retryDelayMs: 500,
      fallbackTimeoutMs: 150, // Critical: no gap >150ms
      enableFallbackTTS: this.config.fallbackToTTS,
      logErrors: true,
      maxGapMs: 150
    });

    // Task 12: Initialize mobile resource manager
    this.mobileResourceManager = globalMobileStoryResourceManager;

    // Task 17: Initialize lip-sync service with matching configuration
    this.lipSyncService = globalStoryLipSyncService;
    this.lipSyncService.updateConfig({
      enabled: this.config.enableLipSync,
      debugMode: false // Can be made configurable later
    });

    this.initializeAudioContext();
  }

  /**
   * Initialize AudioContext for story playback
   * Uses mobile-optimized context management for Safari compatibility
   */
  private async initializeAudioContext(): Promise<void> {
    try {
      if (typeof window === 'undefined') {
        return; // Server-side, skip initialization
      }

      // Use mobile audio context manager for Safari compatibility
      if (isMobileSafari()) {
        const isReady = await mobileAudioContextManager.ensureReady();
        if (isReady) {
          this.audioContext = mobileAudioContextManager.getAudioContext();
          console.log('[StoryAudioManager] Using mobile-optimized AudioContext');
        }
      } else {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log('[StoryAudioManager] AudioContext initialized');
      }

      if (this.audioContext) {
        console.log(`[StoryAudioManager] AudioContext ready: ${this.audioContext.state} (${this.audioContext.sampleRate}Hz)`);
      }
    } catch (error) {
      console.warn('[StoryAudioManager] Failed to initialize AudioContext:', error);
      // Continue without AudioContext - will use HTML Audio fallback
    }
  }

  /**
   * Preload story audio with timeout constraint and error handling
   * Task 12: Enhanced with mobile optimization and resource management
   * Requirement 3.3: Preload audio to prevent buffering delays
   * Requirement 8.6: 2-second timeout constraint
   * Requirements 7.1, 7.2, 8.7: Mobile optimizations
   */
  async preloadStoryAudio(story: UserStory): Promise<StoryLoadResult> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(story);

    // Task 12: Check mobile resource manager first for preloaded buffer
    const mobileBuffer = this.mobileResourceManager.getPreloadedBuffer(story);
    if (mobileBuffer) {
      console.log(`[StoryAudioManager] 📱 Using mobile-preloaded buffer: ${story.title}`);
      this.metricsCollector.trackStoryStart(story.owner_id, startTime, true);
      
      return {
        success: true,
        audioBuffer: mobileBuffer,
        duration: mobileBuffer.duration * 1000,
        loadTimeMs: 0
      };
    }

    // Check if already cached in legacy cache
    const cachedBuffer = this.audioBufferCache.get(cacheKey);
    if (cachedBuffer) {
      // Track story start with preloaded flag
      this.metricsCollector.trackStoryStart(story.owner_id, startTime, true);
      
      return {
        success: true,
        audioBuffer: cachedBuffer,
        duration: cachedBuffer.duration * 1000, // Convert to ms
        loadTimeMs: 0 // Already cached
      };
    }

    // Task 12: Check mobile constraints before loading
    const preloadDecision = this.mobileResourceManager.canPreloadStory(story);
    if (!preloadDecision.shouldPreload) {
      console.log(`[StoryAudioManager] 📱 Mobile constraint prevents preload: ${preloadDecision.reason}`);
      
      // Request mobile preload (will be queued if needed)
      this.mobileResourceManager.requestStoryPreload(story);
      
      return {
        success: false,
        error: `Mobile constraint: ${preloadDecision.reason}`,
        loadTimeMs: Date.now() - startTime
      };
    }

    // Check if already loading
    const existingPromise = this.loadingPromises.get(cacheKey);
    if (existingPromise) {
      return await existingPromise;
    }

    // Create new loading promise with timeout and error handling
    const loadPromise = this.loadStoryWithErrorHandling(story, startTime);
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      const result = await loadPromise;
      
      // Track story start metrics
      this.metricsCollector.trackStoryStart(story.owner_id, startTime, false);
      
      // Cache successful loads
      if (result.success && result.audioBuffer) {
        // Task 12: Use mobile-aware caching
        await this.cacheAudioBufferMobileAware(cacheKey, result.audioBuffer, story);
        
        // Track successful story playback
        this.metricsCollector.trackStoryPlaySuccess(
          story.owner_id, 
          story.category, 
          result.audioBuffer.duration * 1000
        );
      } else {
        // Track failed story playback
        this.metricsCollector.trackStoryPlayFailure(
          story.owner_id, 
          result.error || 'unknown_error', 
          false
        );
      }

      return result;
    } finally {
      // Clean up loading promise
      this.loadingPromises.delete(cacheKey);
    }
  }

  /**
   * Load story audio with comprehensive error handling
   * Integrates with StoryErrorHandler for graceful degradation
   */
  private async loadStoryWithErrorHandling(story: UserStory, startTime: number): Promise<StoryLoadResult> {
    try {
      const timeoutPromise = new Promise<StoryLoadResult>((resolve) => {
        setTimeout(() => {
          resolve({
            success: false,
            error: `Story loading timeout (${this.config.preloadTimeoutMs}ms exceeded)`,
            loadTimeMs: Date.now() - startTime
          });
        }, this.config.preloadTimeoutMs);
      });

      const loadPromise = this.loadStoryAudioBuffer(story, startTime);

      // Race between loading and timeout
      const result = await Promise.race([loadPromise, timeoutPromise]);
      
      if (!result.success && result.error) {
        // Let error handler manage the failure, but don't trigger fallback here
        // The fallback will be handled at the playback level
        console.warn(`[StoryAudioManager] Story loading failed: ${result.error}`);
      }
      
      return result;
      
    } catch (error) {
      const loadTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown loading error';
      
      console.error(`[StoryAudioManager] Story loading error: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
        loadTimeMs
      };
    }
  }

  /**
   * Load story audio with timeout constraint
   * Private method that handles the actual loading logic
   */
  private async loadStoryWithTimeout(story: UserStory, startTime: number): Promise<StoryLoadResult> {
    const timeoutPromise = new Promise<StoryLoadResult>((resolve) => {
      setTimeout(() => {
        resolve({
          success: false,
          error: `Story loading timeout (${this.config.preloadTimeoutMs}ms exceeded)`,
          loadTimeMs: Date.now() - startTime
        });
      }, this.config.preloadTimeoutMs);
    });

    const loadPromise = this.loadStoryAudioBuffer(story, startTime);

    // Race between loading and timeout
    return await Promise.race([loadPromise, timeoutPromise]);
  }

  /**
   * Load story audio buffer from URL
   * Task 12: Enhanced with mobile-optimized audio decoding
   * Handles both AudioContext and HTML Audio fallback
   */
  private async loadStoryAudioBuffer(story: UserStory, startTime: number): Promise<StoryLoadResult> {
    try {
      console.log(`[StoryAudioManager] Loading story audio: ${story.title} (${story.audio_url})`);

      // Fetch audio data
      const response = await fetch(story.audio_url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const loadTimeMs = Date.now() - startTime;

      // Task 12: Use mobile-optimized audio decoding
      if (this.audioContext) {
        try {
          // Resume AudioContext if suspended
          if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
          }

          let audioBuffer: AudioBuffer;
          
          // Task 12: Use mobile-optimized decoding for iOS Safari
          if (isMobileSafari()) {
            console.log(`[StoryAudioManager] 📱 Using mobile-optimized decoding for iOS Safari`);
            audioBuffer = await mobileAudioContextManager.createOptimizedBuffer(arrayBuffer);
          } else {
            audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
          }
          
          console.log(`[StoryAudioManager] ✅ Story loaded via AudioContext: ${story.title} (${audioBuffer.duration.toFixed(2)}s, ${loadTimeMs}ms)`);
          
          return {
            success: true,
            audioBuffer,
            duration: audioBuffer.duration * 1000, // Convert to ms
            loadTimeMs
          };
        } catch (decodeError) {
          console.warn(`[StoryAudioManager] AudioContext decode failed for ${story.title}:`, decodeError);
          // Fall through to HTML Audio fallback
        }
      }

      // HTML Audio fallback
      console.log(`[StoryAudioManager] Using HTML Audio fallback for ${story.title}`);
      
      // For HTML Audio, we can't preload into AudioBuffer, but we can validate the URL
      // This is a limitation of the fallback approach
      return {
        success: true,
        duration: story.duration_ms, // Use stored duration
        loadTimeMs
      };

    } catch (error) {
      const loadTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`[StoryAudioManager] ❌ Failed to load story ${story.title}:`, errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        loadTimeMs
      };
    }
  }

  /**
   * Task 13: Decide what action to take for a new story trigger based on current state
   * Requirements 3.6, 4.6: Predictable concurrency behavior
   */
  private decideConcurrencyAction(newStory: UserStory): ConcurrencyDecision {
    // If nothing is playing and no queue, play immediately
    if (!this.concurrencyState.isPlaying && !this.storyQueue) {
      return {
        action: 'play',
        reason: 'No current playback or queue',
        shouldLog: false
      };
    }

    // If story is currently playing, queue the new story
    if (this.concurrencyState.isPlaying) {
      // If there's already a queued story, replace it with the new one
      if (this.storyQueue) {
        return {
          action: 'replace_queue',
          reason: `Replacing queued story (${this.storyQueue.story.title}) with new story (${newStory.title})`,
          shouldLog: true
        };
      } else {
        return {
          action: 'queue',
          reason: `Story playing (${this.concurrencyState.currentStoryId}), queueing new story (${newStory.title})`,
          shouldLog: true
        };
      }
    }

    // If no story is playing but there's a queue (edge case), replace queue
    if (this.storyQueue) {
      return {
        action: 'replace_queue',
        reason: `No playback but queue exists, replacing with new story (${newStory.title})`,
        shouldLog: true
      };
    }

    // Default to play (shouldn't reach here, but safe fallback)
    return {
      action: 'play',
      reason: 'Default action',
      shouldLog: false
    };
  }

  /**
   * Task 13: Queue a story for later playback
   * Requirements 3.6, 4.6: Max 1 pending story, new trigger replaces queued story
   */
  private async queueStory(
    story: UserStory,
    streamingManager: StreamingAudioManager,
    options: StoryPlaybackOptions,
    fallbackCallback: () => Promise<void>,
    decision: ConcurrencyDecision
  ): Promise<StoryPlaybackResult> {
    const queueTime = Date.now();

    // Log queue action
    if (decision.shouldLog) {
      console.log(`[StoryAudioManager] 📋 ${decision.reason}`);
    }

    // Track queued story metrics
    this.metricsCollector.trackStoryQueued(story.owner_id, story.category);

    // Create queue entry
    const queueEntry: StoryQueueEntry = {
      story,
      options,
      streamingManager,
      queuedAt: queueTime,
      fallbackCallback
    };

    // Replace existing queue or create new one
    if (this.storyQueue && decision.action === 'replace_queue') {
      console.log(`[StoryAudioManager] 🔄 Replacing queued story: ${this.storyQueue.story.title} -> ${story.title}`);
      // Track replaced story
      this.metricsCollector.trackStoryReplaced(this.storyQueue.story.owner_id, this.storyQueue.story.category);
    }

    this.storyQueue = queueEntry;

    // Update concurrency state
    this.concurrencyState.queuedStoryId = story.id;
    this.concurrencyState.queuedStoryTimestamp = queueTime;

    console.log(`[StoryAudioManager] ✅ Story queued: ${story.title} (queue size: 1)`);

    return {
      success: true,
      story_id: story.id,
      error_message: 'Story queued for playback',
      fallback_used: false
    };
  }

  /**
   * Task 13: Process the next story in queue after current playback completes
   */
  private async processQueuedStory(): Promise<void> {
    if (!this.storyQueue) {
      return;
    }

    const queueEntry = this.storyQueue;
    const queueAge = Date.now() - queueEntry.queuedAt;

    // Check if queued story is too old
    if (queueAge > this.MAX_QUEUE_AGE_MS) {
      console.log(`[StoryAudioManager] ⏰ Queued story expired: ${queueEntry.story.title} (${queueAge}ms old)`);
      this.metricsCollector.trackStoryExpired(queueEntry.story.owner_id, queueEntry.story.category);
      this.clearQueue();
      return;
    }

    console.log(`[StoryAudioManager] 🎵 Processing queued story: ${queueEntry.story.title} (queued for ${queueAge}ms)`);

    // Track queue processing metrics
    this.metricsCollector.trackQueueProcessing(queueEntry.story.owner_id, queueEntry.story.category, queueAge);

    // Clear queue before processing to prevent recursion
    this.clearQueue();

    // Process the queued story
    try {
      await this.replaceNextTTSWithStory(
        queueEntry.story,
        queueEntry.streamingManager,
        queueEntry.options
      );
    } catch (error) {
      console.error(`[StoryAudioManager] ❌ Failed to process queued story:`, error);
      
      // Use fallback if available
      if (queueEntry.fallbackCallback) {
        try {
          await queueEntry.fallbackCallback();
        } catch (fallbackError) {
          console.error(`[StoryAudioManager] ❌ Queued story fallback also failed:`, fallbackError);
        }
      }
    }
  }

  /**
   * Task 13: Clear the story queue
   */
  private clearQueue(): void {
    if (this.storyQueue) {
      console.log(`[StoryAudioManager] 🗑️ Clearing story queue: ${this.storyQueue.story.title}`);
    }
    
    this.storyQueue = null;
    this.concurrencyState.queuedStoryId = undefined;
    this.concurrencyState.queuedStoryTimestamp = undefined;
  }

  /**
   * Task 13: Get current queue status for monitoring
   */
  getQueueStatus(): { hasQueue: boolean; queuedStoryId?: string; queueAge?: number } {
    if (!this.storyQueue) {
      return { hasQueue: false };
    }

    return {
      hasQueue: true,
      queuedStoryId: this.storyQueue.story.id,
      queueAge: Date.now() - this.storyQueue.queuedAt
    };
  }

  /**
   * Replace TTS with story audio (Option A implementation) with comprehensive error handling
   * Requirement 3.1: Story playback within 2 seconds
   * Requirement 3.4: Smooth transition back to TTS
   * Requirement 3.5: Graceful fallback with seamless conversation continuation
   * Task 13: Enhanced with queue processing
   */
  async replaceNextTTSWithStory(
    story: UserStory, 
    streamingManager: StreamingAudioManager,
    options: StoryPlaybackOptions = {}
  ): Promise<StoryPlaybackResult> {
    const playbackStartTime = Date.now();

    try {
      // Track story selection
      this.metricsCollector.trackStorySelection(story.owner_id, story.category, 'keyword_match');

      // Register fallback callback with error handler
      const fallbackText = this.generateFallbackText(story);
      const fallbackCallback = async () => {
        await streamingManager.addSentence(fallbackText);
      };
      
      this.errorHandler.registerFallbackCallback(story.id, fallbackCallback);

      // Task 13: Enhanced concurrency handling with queue support
      const concurrencyDecision = this.decideConcurrencyAction(story);
      
      if (concurrencyDecision.action === 'ignore') {
        if (concurrencyDecision.shouldLog) {
          console.log(`[StoryAudioManager] 🚫 ${concurrencyDecision.reason}`);
        }
        return {
          success: false,
          story_id: story.id,
          error_message: concurrencyDecision.reason,
          fallback_used: false
        };
      }
      
      if (concurrencyDecision.action === 'queue' || concurrencyDecision.action === 'replace_queue') {
        return await this.queueStory(story, streamingManager, options, fallbackCallback, concurrencyDecision);
      }

      // Check cooldown
      if (this.isInCooldown(story.owner_id)) {
        console.log(`[StoryAudioManager] 🚫 Avatar ${story.owner_id} in cooldown, ignoring story trigger`);
        return {
          success: false,
          story_id: story.id,
          error_message: 'Avatar in cooldown period',
          fallback_used: false
        };
      }

      // Set concurrency state
      this.concurrencyState = {
        isPlaying: true,
        currentStoryId: story.id,
        playbackStartTime
      };

      // Preload story audio with error handling
      console.log(`[StoryAudioManager] 🎵 Preloading story: ${story.title}`);
      const loadResult = await this.preloadStoryAudio(story);

      if (!loadResult.success) {
        // Use error handler for graceful fallback
        await this.errorHandler.handleLoadingError(
          story.id,
          new Error(loadResult.error || 'Story loading failed'),
          fallbackText,
          fallbackCallback
        );
        
        return {
          success: false,
          story_id: story.id,
          error_message: loadResult.error || 'Load failed',
          fallback_used: true
        };
      }

      // Stop current TTS to make room for story
      streamingManager.stop();

      // Play story audio with error handling
      const playbackResult = await this.playStoryAudioWithErrorHandling(story, loadResult, options, fallbackCallback);

      // Record successful trigger and start cooldown
      if (playbackResult.success) {
        this.recordTrigger(story.owner_id);
        console.log(`[StoryAudioManager] ✅ Story playback completed: ${story.title} (${playbackResult.playback_duration_ms}ms)`);
      }
      
      return playbackResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[StoryAudioManager] ❌ Story replacement failed:`, errorMessage);
      
      // Use error handler for emergency fallback
      const fallbackText = this.generateFallbackText(story);
      const fallbackCallback = async () => {
        await streamingManager.addSentence(fallbackText);
      };
      
      await this.errorHandler.handleLoadingError(
        story.id,
        error instanceof Error ? error : new Error(errorMessage),
        fallbackText,
        fallbackCallback
      );
      
      return {
        success: false,
        story_id: story.id,
        error_message: errorMessage,
        fallback_used: true
      };
    } finally {
      // Clear concurrency state
      this.concurrencyState = { isPlaying: false };
      
      // Task 13: Process any queued story after current playback completes
      if (this.storyQueue) {
        // Use setTimeout to avoid blocking the current promise resolution
        setTimeout(() => {
          this.processQueuedStory().catch(error => {
            console.error('[StoryAudioManager] Error processing queued story:', error);
          });
        }, 100); // Small delay to ensure current playback is fully cleaned up
      }
    }
  }

  /**
   * Play story audio with comprehensive error handling
   * Integrates with StoryErrorHandler for graceful degradation
   */
  private async playStoryAudioWithErrorHandling(
    story: UserStory, 
    loadResult: StoryLoadResult, 
    options: StoryPlaybackOptions,
    fallbackCallback: () => Promise<void>
  ): Promise<StoryPlaybackResult> {
    try {
      const playbackResult = await this.playStoryAudio(story, loadResult, options);
      
      if (!playbackResult.success && playbackResult.error_message) {
        // Use error handler for playback failures
        await this.errorHandler.handlePlaybackError(
          story.id,
          new Error(playbackResult.error_message),
          this.generateFallbackText(story),
          fallbackCallback
        );
        
        return {
          ...playbackResult,
          fallback_used: true
        };
      }
      
      return playbackResult;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown playback error';
      
      // Use error handler for unexpected errors
      await this.errorHandler.handlePlaybackError(
        story.id,
        error instanceof Error ? error : new Error(errorMessage),
        this.generateFallbackText(story),
        fallbackCallback
      );
      
      return {
        success: false,
        story_id: story.id,
        error_message: errorMessage,
        fallback_used: true
      };
    }
  }

  /**
   * Play story audio buffer
   * Handles both AudioContext and HTML Audio playback
   */
  private async playStoryAudio(
    story: UserStory, 
    loadResult: StoryLoadResult, 
    options: StoryPlaybackOptions
  ): Promise<StoryPlaybackResult> {
    const playbackStartTime = Date.now();

    try {
      // AudioContext playback (preferred)
      if (loadResult.audioBuffer && this.audioContext) {
        return await this.playAudioBuffer(story, loadResult.audioBuffer, options, playbackStartTime);
      }

      // HTML Audio fallback
      return await this.playHTMLAudio(story, options, playbackStartTime);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown playback error';
      
      return {
        success: false,
        story_id: story.id,
        error_message: errorMessage,
        fallback_used: false
      };
    }
  }

  /**
   * Play audio using AudioContext (preferred method)
   */
  private async playAudioBuffer(
    story: UserStory,
    audioBuffer: AudioBuffer,
    options: StoryPlaybackOptions,
    playbackStartTime: number
  ): Promise<StoryPlaybackResult> {
    // Task 17: Attempt experimental lip-sync integration
    let lipSyncResult: LipSyncResult | null = null;
    
    if (this.config.enableLipSync) {
      try {
        console.log(`[StoryAudioManager] 🎭 Attempting experimental lip-sync for: ${story.title}`);
        lipSyncResult = await this.lipSyncService.attemptStoryLipSync(story, audioBuffer);
        
        if (lipSyncResult.success) {
          console.log(`[StoryAudioManager] ✅ Lip-sync activated (${lipSyncResult.method}): ${story.title}`);
        } else {
          console.log(`[StoryAudioManager] ⚠️ Lip-sync fallback (${lipSyncResult.method}): ${lipSyncResult.error}`);
        }
      } catch (lipSyncError) {
        console.warn(`[StoryAudioManager] 🎭 Lip-sync attempt failed:`, lipSyncError);
        // Continue with audio playback even if lip-sync fails
      }
    }

    return new Promise((resolve) => {
      try {
        if (!this.audioContext) {
          throw new Error('AudioContext not available');
        }

        // Resume AudioContext if suspended
        if (this.audioContext.state === 'suspended') {
          this.audioContext.resume();
        }

        // Create audio nodes
        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();

        source.buffer = audioBuffer;
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Apply volume and fade settings
        const volume = options.volume_level || 1.0;
        const fadeInMs = options.fade_in_ms || 0;
        
        if (fadeInMs > 0) {
          gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
          gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + fadeInMs / 1000);
        } else {
          gainNode.gain.value = volume;
        }

        // Handle playback completion
        source.onended = async () => {
          const playbackDuration = Date.now() - playbackStartTime;
          
          try {
            source.disconnect();
            gainNode.disconnect();
          } catch (disconnectError) {
            // Nodes might already be disconnected
          }

          // Task 17: Transition back to TTS lip-sync after story completes
          if (this.config.enableLipSync && lipSyncResult?.success) {
            try {
              console.log(`[StoryAudioManager] 🎭 Transitioning back to TTS lip-sync`);
              await this.lipSyncService.transitionBackToTTS();
            } catch (transitionError) {
              console.warn(`[StoryAudioManager] 🎭 TTS transition failed:`, transitionError);
              // Non-critical error, continue with completion
            }
          }

          console.log(`[StoryAudioManager] AudioContext playback completed: ${story.title} (${playbackDuration}ms)`);
          
          resolve({
            success: true,
            story_id: story.id,
            playback_duration_ms: playbackDuration,
            fallback_used: false,
            // Task 17: Include lip-sync information in result
            lip_sync_used: lipSyncResult?.success || false,
            lip_sync_method: lipSyncResult?.method || 'none'
          });
        };

        // Start playback
        source.start();
        console.log(`[StoryAudioManager] 🎵 AudioContext playback started: ${story.title}`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'AudioContext playback error';
        resolve({
          success: false,
          story_id: story.id,
          error_message: errorMessage,
          fallback_used: false,
          lip_sync_used: false,
          lip_sync_method: 'none'
        });
      }
    });
  }

  /**
   * Play audio using HTML Audio element (fallback method)
   */
  private async playHTMLAudio(
    story: UserStory,
    options: StoryPlaybackOptions,
    playbackStartTime: number
  ): Promise<StoryPlaybackResult> {
    // Task 17: Attempt experimental lip-sync integration for HTML Audio fallback
    let lipSyncResult: LipSyncResult | null = null;
    
    if (this.config.enableLipSync) {
      try {
        console.log(`[StoryAudioManager] 🎭 Attempting experimental lip-sync (HTML Audio) for: ${story.title}`);
        lipSyncResult = await this.lipSyncService.attemptStoryLipSync(story);
        
        if (lipSyncResult.success) {
          console.log(`[StoryAudioManager] ✅ Lip-sync activated (${lipSyncResult.method}): ${story.title}`);
        } else {
          console.log(`[StoryAudioManager] ⚠️ Lip-sync fallback (${lipSyncResult.method}): ${lipSyncResult.error}`);
        }
      } catch (lipSyncError) {
        console.warn(`[StoryAudioManager] 🎭 Lip-sync attempt failed:`, lipSyncError);
        // Continue with audio playback even if lip-sync fails
      }
    }

    return new Promise((resolve) => {
      try {
        // Create optimized audio element
        const audio = isMobileSafari() 
          ? globalAudioManager.createOptimizedAudio(story.audio_url)
          : new Audio(story.audio_url);

        // Configure audio element
        audio.volume = options.volume_level || 1.0;
        audio.preload = 'auto';
        
        if (isMobileSafari()) {
          (audio as any).playsInline = true;
          audio.muted = false;
        }

        // Handle playback completion
        audio.onended = async () => {
          const playbackDuration = Date.now() - playbackStartTime;
          
          // Task 17: Transition back to TTS lip-sync after story completes
          if (this.config.enableLipSync && lipSyncResult?.success) {
            try {
              console.log(`[StoryAudioManager] 🎭 Transitioning back to TTS lip-sync (HTML Audio)`);
              await this.lipSyncService.transitionBackToTTS();
            } catch (transitionError) {
              console.warn(`[StoryAudioManager] 🎭 TTS transition failed:`, transitionError);
              // Non-critical error, continue with completion
            }
          }
          
          console.log(`[StoryAudioManager] HTML Audio playback completed: ${story.title} (${playbackDuration}ms)`);
          
          resolve({
            success: true,
            story_id: story.id,
            playback_duration_ms: playbackDuration,
            fallback_used: true, // HTML Audio is considered fallback
            // Task 17: Include lip-sync information in result
            lip_sync_used: lipSyncResult?.success || false,
            lip_sync_method: lipSyncResult?.method || 'none'
          });
        };

        // Handle playback errors
        audio.onerror = (error) => {
          const errorMessage = `HTML Audio playback error: ${error}`;
          resolve({
            success: false,
            story_id: story.id,
            error_message: errorMessage,
            fallback_used: true,
            lip_sync_used: false,
            lip_sync_method: 'none'
          });
        };

        // Start playback using global audio manager for overlap prevention
        globalAudioManager.playAudio(audio).catch((error) => {
          const errorMessage = error instanceof Error ? error.message : 'Global audio manager error';
          resolve({
            success: false,
            story_id: story.id,
            error_message: errorMessage,
            fallback_used: true,
            lip_sync_used: false,
            lip_sync_method: 'none'
          });
        });

        console.log(`[StoryAudioManager] 🎵 HTML Audio playback started: ${story.title}`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'HTML Audio setup error';
        resolve({
          success: false,
          story_id: story.id,
          error_message: errorMessage,
          fallback_used: true,
          lip_sync_used: false,
          lip_sync_method: 'none'
        });
      }
    });
  }

  /**
   * Graceful fallback to TTS when story fails
   * Requirement 3.5: Graceful fallback with seamless conversation continuation
   * Requirement 8.6: No gap >150ms when falling back to TTS
   */
  private async gracefulFallbackToTTS(
    story: UserStory,
    errorMessage: string,
    streamingManager: StreamingAudioManager
  ): Promise<StoryPlaybackResult> {
    console.log(`[StoryAudioManager] 🔄 Graceful fallback to TTS for story: ${story.title}`);
    
    try {
      // Generate fallback TTS text (could be story title or generic response)
      const fallbackText = this.generateFallbackText(story);
      
      // Resume TTS with minimal delay (Requirement 8.6: <150ms gap)
      await streamingManager.addSentence(fallbackText);
      
      console.log(`[StoryAudioManager] ✅ TTS fallback initiated: "${fallbackText}"`);
      
      return {
        success: false,
        story_id: story.id,
        error_message: errorMessage,
        fallback_used: true
      };
      
    } catch (fallbackError) {
      const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : 'TTS fallback failed';
      
      console.error(`[StoryAudioManager] ❌ TTS fallback failed:`, fallbackErrorMessage);
      
      return {
        success: false,
        story_id: story.id,
        error_message: `${errorMessage}; TTS fallback also failed: ${fallbackErrorMessage}`,
        fallback_used: false
      };
    }
  }

  /**
   * Generate appropriate fallback text when story fails
   */
  private generateFallbackText(story: UserStory): string {
    // Use story title or category-appropriate response
    switch (story.category) {
      case 'memory':
        return `Let me share a memory about ${story.title.toLowerCase()}.`;
      case 'experience':
        return `I had an experience with ${story.title.toLowerCase()}.`;
      case 'advice':
        return `Here's some advice about ${story.title.toLowerCase()}.`;
      case 'anecdote':
        return `I have a story about ${story.title.toLowerCase()}.`;
      default:
        return `Let me tell you about ${story.title.toLowerCase()}.`;
    }
  }

  /**
   * Check if avatar is in cooldown period
   * Requirement: 30-second cooldown mechanism per avatar
   */
  isInCooldown(avatarId: string): boolean {
    const lastTrigger = this.cooldownTimers.get(avatarId);
    if (!lastTrigger) {
      return false;
    }
    
    const timeSinceLastTrigger = Date.now() - lastTrigger;
    return timeSinceLastTrigger < this.COOLDOWN_MS;
  }

  /**
   * Record story trigger and start cooldown
   */
  recordTrigger(avatarId: string): void {
    this.cooldownTimers.set(avatarId, Date.now());
    console.log(`[StoryAudioManager] 🕐 Cooldown started for avatar: ${avatarId} (${this.COOLDOWN_MS}ms)`);
  }

  /**
   * Get remaining cooldown time in milliseconds
   */
  getRemainingCooldown(avatarId: string): number {
    const lastTrigger = this.cooldownTimers.get(avatarId);
    if (!lastTrigger) {
      return 0;
    }
    
    const timeSinceLastTrigger = Date.now() - lastTrigger;
    return Math.max(0, this.COOLDOWN_MS - timeSinceLastTrigger);
  }

  /**
   * Check if currently playing a story
   */
  isPlaying(): boolean {
    return this.concurrencyState.isPlaying;
  }

  /**
   * Get current story playback info
   * Task 13: Enhanced with queue information
   */
  getCurrentStoryInfo(): { 
    storyId?: string; 
    playbackStartTime?: number;
    queuedStoryId?: string;
    queueAge?: number;
  } {
    const queueStatus = this.getQueueStatus();
    
    return {
      storyId: this.concurrencyState.currentStoryId,
      playbackStartTime: this.concurrencyState.playbackStartTime,
      queuedStoryId: queueStatus.queuedStoryId,
      queueAge: queueStatus.queueAge
    };
  }

  /**
   * Stop current story playback
   * Task 13: Enhanced to also clear queue
   */
  async stopCurrentStory(): Promise<void> {
    if (this.concurrencyState.isPlaying) {
      console.log(`[StoryAudioManager] 🛑 Stopping current story: ${this.concurrencyState.currentStoryId}`);
      
      // Stop all audio
      await globalAudioManager.stopAll();
      
      // Clear concurrency state
      this.concurrencyState = { isPlaying: false };
    }
    
    // Task 13: Also clear any queued story
    if (this.storyQueue) {
      console.log(`[StoryAudioManager] 🛑 Clearing queued story: ${this.storyQueue.story.title}`);
      this.clearQueue();
    }
  }

  /**
   * Cache audio buffer with memory management
   * Task 12: Legacy caching method, prefer mobile-aware caching
   */
  private cacheAudioBuffer(cacheKey: string, audioBuffer: AudioBuffer): void {
    // Calculate buffer size (approximate)
    const bufferSize = audioBuffer.length * audioBuffer.numberOfChannels * 4; // 4 bytes per float32 sample
    
    // Simple cache eviction: remove oldest entries if cache is full
    while (this.getCacheSize() + bufferSize > this.config.audioBufferCacheSize) {
      const oldestKey = this.audioBufferCache.keys().next().value;
      if (oldestKey) {
        this.audioBufferCache.delete(oldestKey);
        console.log(`[StoryAudioManager] 🗑️ Evicted cached buffer: ${oldestKey}`);
      } else {
        break; // Cache is empty
      }
    }
    
    this.audioBufferCache.set(cacheKey, audioBuffer);
    console.log(`[StoryAudioManager] 💾 Cached audio buffer: ${cacheKey} (${(bufferSize / 1024 / 1024).toFixed(2)}MB)`);
  }

  /**
   * Task 12: Mobile-aware audio buffer caching
   * Uses mobile resource manager for optimal memory management
   */
  private async cacheAudioBufferMobileAware(cacheKey: string, audioBuffer: AudioBuffer, story: UserStory): Promise<void> {
    // Try to use mobile resource manager first
    const canPreload = this.mobileResourceManager.canPreloadStory(story);
    
    if (canPreload.shouldPreload) {
      // Let mobile resource manager handle the caching
      await this.mobileResourceManager.requestStoryPreload(story);
      console.log(`[StoryAudioManager] 📱 Delegated caching to mobile resource manager: ${story.title}`);
    } else {
      // Fall back to legacy caching
      console.log(`[StoryAudioManager] 📱 Using legacy cache (mobile constraints: ${canPreload.reason}): ${story.title}`);
      this.cacheAudioBuffer(cacheKey, audioBuffer);
    }
  }

  /**
   * Get approximate cache size in bytes
   */
  private getCacheSize(): number {
    let totalSize = 0;
    for (const buffer of this.audioBufferCache.values()) {
      totalSize += buffer.length * buffer.numberOfChannels * 4; // 4 bytes per float32 sample
    }
    return totalSize;
  }

  /**
   * Generate cache key for story
   */
  private getCacheKey(story: UserStory): string {
    return `story_${story.id}_${story.updated_at}`;
  }

  /**
   * Clear audio buffer cache
   * Task 12: Enhanced to clear mobile resource manager cache too
   */
  clearCache(): void {
    this.audioBufferCache.clear();
    
    // Task 12: Clear mobile resource manager cache
    if (this.mobileResourceManager) {
      this.mobileResourceManager.clearAllCache();
    }
    
    console.log('[StoryAudioManager] 🗑️ Audio buffer cache cleared (including mobile cache)');
  }

  /**
   * Get cache statistics
   * Task 12: Enhanced with mobile resource manager stats
   */
  getCacheStats(): { 
    entries: number; 
    sizeBytes: number; 
    sizeMB: number;
    mobile?: {
      decodedStories: number;
      maxDecodedStories: number;
      cacheSizeMB: number;
      maxCacheSizeMB: number;
      memoryPressure: string;
      queueLength: number;
    };
  } {
    const sizeBytes = this.getCacheSize();
    const stats = {
      entries: this.audioBufferCache.size,
      sizeBytes,
      sizeMB: sizeBytes / 1024 / 1024
    };

    // Task 12: Add mobile resource manager stats
    if (this.mobileResourceManager) {
      stats.mobile = this.mobileResourceManager.getCacheStats();
    }

    return stats;
  }

  /**
   * Cleanup resources
   * Task 12: Enhanced to cleanup mobile resource manager
   */
  destroy(): void {
    // Clear all caches and timers
    this.clearCache();
    this.loadingPromises.clear();
    this.cooldownTimers.clear();
    
    // Reset concurrency state
    this.concurrencyState = { isPlaying: false };
    
    // Task 13: Clear story queue
    this.clearQueue();
    
    // Cleanup error handler
    this.errorHandler.cleanup();
    
    // Task 12: Cleanup mobile resource manager
    if (this.mobileResourceManager) {
      this.mobileResourceManager.destroy();
    }
    
    console.log('[StoryAudioManager] 🧹 Resources cleaned up (including mobile resources)');
  }

  /**
   * Task 17: Enable or disable experimental lip-sync feature
   */
  setLipSyncEnabled(enabled: boolean): void {
    this.config.enableLipSync = enabled;
    this.lipSyncService.setEnabled(enabled);
    
    console.log(`[StoryAudioManager] 🎭 Experimental lip-sync ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Task 17: Check if lip-sync is available and ready
   */
  async isLipSyncAvailable(): Promise<boolean> {
    if (!this.config.enableLipSync) {
      return false;
    }
    
    return await this.lipSyncService.isAvailable();
  }

  /**
   * Task 17: Get current lip-sync status
   */
  getLipSyncStatus(): {
    enabled: boolean;
    available: boolean;
    currentState: string;
    avatarConnected: boolean;
  } {
    const lipSyncState = this.lipSyncService.getCurrentState();
    
    return {
      enabled: this.config.enableLipSync,
      available: lipSyncState.enabled && lipSyncState.avatarConnected,
      currentState: lipSyncState.state,
      avatarConnected: lipSyncState.avatarConnected
    };
  }

  /**
   * Task 17: Update lip-sync configuration
   */
  updateLipSyncConfig(config: {
    fallbackToIdle?: boolean;
    transitionDurationMs?: number;
    debugMode?: boolean;
  }): void {
    this.lipSyncService.updateConfig(config);
    console.log(`[StoryAudioManager] 🎭 Lip-sync configuration updated:`, config);
  }
}

// Export singleton instance for global use
export const globalStoryAudioManager = new StoryAudioManager();

// Export factory function for custom configurations
export function createStoryAudioManager(config?: Partial<StoryAudioManagerConfig>): StoryAudioManager {
  return new StoryAudioManager(config);
}