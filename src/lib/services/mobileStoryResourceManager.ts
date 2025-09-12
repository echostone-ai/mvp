/**
 * Mobile Story Resource Manager - Task 12 Implementation
 * 
 * Handles mobile-specific optimizations and resource management for story system:
 * - Conservative preloading (max 1 decoded story on iOS)
 * - Memory management for audio buffers with 15MB cache limit
 * - Only preload on user gesture unlocked AudioContext
 * - When TTS is buffering, do not preload story
 * - iOS Safari and Android Chrome browser compatibility
 * 
 * Requirements: 7.1, 7.2, 8.7
 */

import { UserStory } from '../types/stories';
import { mobileAudioContextManager, isMobileSafari } from '../mobileAudioContextManager';
import { globalAudioManager } from '../globalAudioManager';

export interface MobileResourceConfig {
  maxDecodedStoriesIOS: number; // Default: 1 (Requirement 7.1)
  maxCacheSizeBytes: number; // Default: 15MB (Requirement 8.7)
  preloadOnlyWithGesture: boolean; // Default: true (Requirement 7.1)
  respectTTSBuffering: boolean; // Default: true (Requirement 8.7)
  enableMemoryMonitoring: boolean; // Default: true
  memoryWarningThresholdMB: number; // Default: 12MB (80% of 15MB)
}

export interface MobileResourceState {
  decodedStoryCount: number;
  totalCacheSizeBytes: number;
  isUserGestureUnlocked: boolean;
  isTTSBuffering: boolean;
  lastMemoryCheck: number;
  memoryPressureLevel: 'low' | 'medium' | 'high';
}

export interface PreloadDecision {
  shouldPreload: boolean;
  reason: string;
  alternativeAction?: 'defer' | 'clear_cache' | 'wait_for_gesture';
}

export class MobileStoryResourceManager {
  private static instance: MobileStoryResourceManager;
  private config: MobileResourceConfig;
  private state: MobileResourceState;
  private decodedBuffers = new Map<string, AudioBuffer>();
  private preloadQueue: UserStory[] = [];
  private memoryMonitorInterval: NodeJS.Timeout | null = null;
  private ttsBufferingCallbacks = new Set<() => void>();

  private constructor(config: Partial<MobileResourceConfig> = {}) {
    this.config = {
      maxDecodedStoriesIOS: 1, // Conservative limit for iOS Safari
      maxCacheSizeBytes: 15 * 1024 * 1024, // 15MB limit
      preloadOnlyWithGesture: true, // Only preload after user gesture
      respectTTSBuffering: true, // Don't preload during TTS buffering
      enableMemoryMonitoring: true,
      memoryWarningThresholdMB: 12, // 80% of 15MB
      ...config
    };

    this.state = {
      decodedStoryCount: 0,
      totalCacheSizeBytes: 0,
      isUserGestureUnlocked: false,
      isTTSBuffering: false,
      lastMemoryCheck: Date.now(),
      memoryPressureLevel: 'low'
    };

    this.initializeMobileOptimizations();
  }

  static getInstance(config?: Partial<MobileResourceConfig>): MobileStoryResourceManager {
    if (!MobileStoryResourceManager.instance) {
      MobileStoryResourceManager.instance = new MobileStoryResourceManager(config);
    }
    return MobileStoryResourceManager.instance;
  }

  /**
   * Initialize mobile-specific optimizations
   */
  private initializeMobileOptimizations(): void {
    console.log('[MobileStoryResourceManager] Initializing mobile optimizations');

    // Monitor user gesture state for AudioContext
    this.monitorUserGestureState();

    // Start memory monitoring if enabled
    if (this.config.enableMemoryMonitoring) {
      this.startMemoryMonitoring();
    }

    // Listen for TTS buffering state changes
    this.setupTTSBufferingDetection();

    console.log(`[MobileStoryResourceManager] Mobile optimizations initialized:
      - Max decoded stories (iOS): ${this.config.maxDecodedStoriesIOS}
      - Max cache size: ${(this.config.maxCacheSizeBytes / 1024 / 1024).toFixed(1)}MB
      - Preload only with gesture: ${this.config.preloadOnlyWithGesture}
      - Respect TTS buffering: ${this.config.respectTTSBuffering}`);
  }

  /**
   * Monitor user gesture state for AudioContext readiness
   * Requirement 7.1: Only preload on user gesture unlocked AudioContext
   */
  private monitorUserGestureState(): void {
    if (typeof window === 'undefined') return;

    const checkGestureState = async () => {
      if (isMobileSafari()) {
        const isReady = await mobileAudioContextManager.ensureReady();
        const wasUnlocked = this.state.isUserGestureUnlocked;
        this.state.isUserGestureUnlocked = isReady;

        if (!wasUnlocked && isReady) {
          console.log('[MobileStoryResourceManager] 🎯 User gesture unlocked AudioContext, processing preload queue');
          this.processPreloadQueue();
        }
      } else {
        // Non-mobile Safari - assume gesture is available
        this.state.isUserGestureUnlocked = true;
      }
    };

    // Check immediately
    checkGestureState();

    // Monitor for gesture events
    const gestureEvents = ['touchstart', 'click', 'keydown'];
    gestureEvents.forEach(event => {
      document.addEventListener(event, checkGestureState, { once: true, passive: true });
    });
  }

  /**
   * Setup TTS buffering detection
   * Requirement 8.7: When TTS is buffering, do not preload story
   */
  private setupTTSBufferingDetection(): void {
    // Monitor global audio manager for TTS activity
    const checkTTSState = () => {
      const wasTTSBuffering = this.state.isTTSBuffering;
      this.state.isTTSBuffering = globalAudioManager.getIsPlaying();

      if (wasTTSBuffering && !this.state.isTTSBuffering) {
        console.log('[MobileStoryResourceManager] 🎵 TTS finished buffering, resuming story preloading');
        this.processPreloadQueue();
      } else if (!wasTTSBuffering && this.state.isTTSBuffering) {
        console.log('[MobileStoryResourceManager] 🎵 TTS started buffering, pausing story preloading');
      }
    };

    // Check TTS state periodically
    setInterval(checkTTSState, 500);
  }

  /**
   * Start memory monitoring for cache management
   * Requirement 8.7: 15MB cache limit with memory pressure detection
   */
  private startMemoryMonitoring(): void {
    this.memoryMonitorInterval = setInterval(() => {
      this.checkMemoryPressure();
    }, 5000); // Check every 5 seconds

    console.log('[MobileStoryResourceManager] 📊 Memory monitoring started');
  }

  /**
   * Check memory pressure and adjust cache accordingly
   */
  private checkMemoryPressure(): void {
    this.state.lastMemoryCheck = Date.now();
    this.updateCacheSize();

    const cacheSizeMB = this.state.totalCacheSizeBytes / 1024 / 1024;
    const warningThresholdMB = this.config.memoryWarningThresholdMB;
    const maxSizeMB = this.config.maxCacheSizeBytes / 1024 / 1024;

    // Determine memory pressure level
    if (cacheSizeMB >= maxSizeMB) {
      this.state.memoryPressureLevel = 'high';
    } else if (cacheSizeMB >= warningThresholdMB) {
      this.state.memoryPressureLevel = 'medium';
    } else {
      this.state.memoryPressureLevel = 'low';
    }

    // Take action based on memory pressure
    if (this.state.memoryPressureLevel === 'high') {
      console.warn(`[MobileStoryResourceManager] 🚨 High memory pressure: ${cacheSizeMB.toFixed(1)}MB/${maxSizeMB}MB, clearing cache`);
      this.clearOldestCacheEntries(0.5); // Clear 50% of cache
    } else if (this.state.memoryPressureLevel === 'medium') {
      console.warn(`[MobileStoryResourceManager] ⚠️ Medium memory pressure: ${cacheSizeMB.toFixed(1)}MB/${maxSizeMB}MB, clearing old entries`);
      this.clearOldestCacheEntries(0.25); // Clear 25% of cache
    }

    // Additional iOS-specific memory management
    if (isMobileSafari() && this.state.decodedStoryCount > this.config.maxDecodedStoriesIOS) {
      console.warn(`[MobileStoryResourceManager] 📱 iOS: Too many decoded stories (${this.state.decodedStoryCount}/${this.config.maxDecodedStoriesIOS}), clearing excess`);
      this.clearExcessDecodedStories();
    }
  }

  /**
   * Decide whether to preload a story based on mobile constraints
   * Requirements: 7.1, 7.2, 8.7
   */
  canPreloadStory(story: UserStory): PreloadDecision {
    // Check user gesture requirement
    if (this.config.preloadOnlyWithGesture && !this.state.isUserGestureUnlocked) {
      return {
        shouldPreload: false,
        reason: 'User gesture required for AudioContext',
        alternativeAction: 'wait_for_gesture'
      };
    }

    // Check TTS buffering state
    if (this.config.respectTTSBuffering && this.state.isTTSBuffering) {
      return {
        shouldPreload: false,
        reason: 'TTS is currently buffering',
        alternativeAction: 'defer'
      };
    }

    // Check iOS decoded story limit
    if (isMobileSafari() && this.state.decodedStoryCount >= this.config.maxDecodedStoriesIOS) {
      return {
        shouldPreload: false,
        reason: `iOS decoded story limit reached (${this.state.decodedStoryCount}/${this.config.maxDecodedStoriesIOS})`,
        alternativeAction: 'clear_cache'
      };
    }

    // Check memory pressure
    if (this.state.memoryPressureLevel === 'high') {
      return {
        shouldPreload: false,
        reason: 'High memory pressure detected',
        alternativeAction: 'clear_cache'
      };
    }

    // Estimate story size and check if it would exceed cache limit
    const estimatedSize = this.estimateStorySize(story);
    if (this.state.totalCacheSizeBytes + estimatedSize > this.config.maxCacheSizeBytes) {
      return {
        shouldPreload: false,
        reason: `Would exceed cache limit (${((this.state.totalCacheSizeBytes + estimatedSize) / 1024 / 1024).toFixed(1)}MB > ${(this.config.maxCacheSizeBytes / 1024 / 1024).toFixed(1)}MB)`,
        alternativeAction: 'clear_cache'
      };
    }

    return {
      shouldPreload: true,
      reason: 'All mobile constraints satisfied'
    };
  }

  /**
   * Add story to preload queue or preload immediately if conditions allow
   */
  async requestStoryPreload(story: UserStory): Promise<boolean> {
    const decision = this.canPreloadStory(story);

    if (decision.shouldPreload) {
      console.log(`[MobileStoryResourceManager] ✅ Preloading story: ${story.title} (${decision.reason})`);
      return await this.preloadStoryNow(story);
    } else {
      console.log(`[MobileStoryResourceManager] ⏸️ Deferring story preload: ${story.title} (${decision.reason})`);
      
      // Handle alternative actions
      switch (decision.alternativeAction) {
        case 'wait_for_gesture':
          this.addToPreloadQueue(story);
          break;
        case 'defer':
          this.addToPreloadQueue(story);
          break;
        case 'clear_cache':
          this.clearOldestCacheEntries(0.3); // Clear 30% of cache
          this.addToPreloadQueue(story);
          break;
      }

      return false;
    }
  }

  /**
   * Preload story immediately (assumes constraints are satisfied)
   */
  private async preloadStoryNow(story: UserStory): Promise<boolean> {
    try {
      const startTime = Date.now();
      
      // Fetch audio data
      const response = await fetch(story.audio_url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      
      // Decode audio buffer using mobile-optimized context
      let audioBuffer: AudioBuffer;
      
      if (isMobileSafari()) {
        // Use mobile audio context manager for iOS Safari
        audioBuffer = await mobileAudioContextManager.createOptimizedBuffer(arrayBuffer);
      } else {
        // Use standard AudioContext for other browsers
        const audioContext = new AudioContext();
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      }

      // Store in cache
      const cacheKey = this.getCacheKey(story);
      this.decodedBuffers.set(cacheKey, audioBuffer);
      this.state.decodedStoryCount++;
      this.updateCacheSize();

      const loadTime = Date.now() - startTime;
      const bufferSizeMB = (audioBuffer.length * audioBuffer.numberOfChannels * 4) / 1024 / 1024;
      
      console.log(`[MobileStoryResourceManager] ✅ Story preloaded: ${story.title} (${bufferSizeMB.toFixed(2)}MB, ${loadTime}ms)`);
      
      return true;

    } catch (error) {
      console.error(`[MobileStoryResourceManager] ❌ Failed to preload story: ${story.title}`, error);
      return false;
    }
  }

  /**
   * Add story to preload queue for later processing
   */
  private addToPreloadQueue(story: UserStory): void {
    // Avoid duplicates
    const exists = this.preloadQueue.some(s => s.id === story.id);
    if (!exists) {
      this.preloadQueue.push(story);
      console.log(`[MobileStoryResourceManager] 📋 Added to preload queue: ${story.title} (queue: ${this.preloadQueue.length})`);
    }
  }

  /**
   * Process queued stories when conditions improve
   */
  private async processPreloadQueue(): Promise<void> {
    if (this.preloadQueue.length === 0) return;

    console.log(`[MobileStoryResourceManager] 🔄 Processing preload queue (${this.preloadQueue.length} stories)`);

    // Process stories one by one to respect mobile constraints
    while (this.preloadQueue.length > 0) {
      const story = this.preloadQueue[0];
      const decision = this.canPreloadStory(story);

      if (decision.shouldPreload) {
        this.preloadQueue.shift(); // Remove from queue
        await this.preloadStoryNow(story);
        
        // Add small delay between preloads to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        // Can't preload more stories right now
        console.log(`[MobileStoryResourceManager] ⏸️ Stopping queue processing: ${decision.reason}`);
        break;
      }
    }
  }

  /**
   * Get preloaded audio buffer for story
   */
  getPreloadedBuffer(story: UserStory): AudioBuffer | null {
    const cacheKey = this.getCacheKey(story);
    return this.decodedBuffers.get(cacheKey) || null;
  }

  /**
   * Clear oldest cache entries to free memory
   */
  private clearOldestCacheEntries(percentage: number): void {
    const entriesToClear = Math.ceil(this.decodedBuffers.size * percentage);
    const entries = Array.from(this.decodedBuffers.keys());
    
    for (let i = 0; i < entriesToClear && entries.length > 0; i++) {
      const key = entries[i];
      this.decodedBuffers.delete(key);
      this.state.decodedStoryCount--;
    }

    this.updateCacheSize();
    console.log(`[MobileStoryResourceManager] 🗑️ Cleared ${entriesToClear} cache entries (${percentage * 100}%)`);
  }

  /**
   * Clear excess decoded stories for iOS
   */
  private clearExcessDecodedStories(): void {
    const excess = this.state.decodedStoryCount - this.config.maxDecodedStoriesIOS;
    if (excess > 0) {
      this.clearOldestCacheEntries(excess / this.state.decodedStoryCount);
    }
  }

  /**
   * Update cache size calculation
   */
  private updateCacheSize(): void {
    let totalSize = 0;
    for (const buffer of this.decodedBuffers.values()) {
      totalSize += buffer.length * buffer.numberOfChannels * 4; // 4 bytes per float32 sample
    }
    this.state.totalCacheSizeBytes = totalSize;
  }

  /**
   * Estimate story size before loading
   */
  private estimateStorySize(story: UserStory): number {
    // Rough estimate: 44.1kHz * 2 channels * 4 bytes * duration in seconds
    const durationSeconds = story.duration_ms / 1000;
    return Math.ceil(44100 * 2 * 4 * durationSeconds);
  }

  /**
   * Generate cache key for story
   */
  private getCacheKey(story: UserStory): string {
    return `story_${story.id}_${story.updated_at}`;
  }

  /**
   * Get current resource state
   */
  getResourceState(): MobileResourceState {
    return { ...this.state };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    decodedStories: number;
    maxDecodedStories: number;
    cacheSizeMB: number;
    maxCacheSizeMB: number;
    memoryPressure: string;
    queueLength: number;
  } {
    return {
      decodedStories: this.state.decodedStoryCount,
      maxDecodedStories: this.config.maxDecodedStoriesIOS,
      cacheSizeMB: this.state.totalCacheSizeBytes / 1024 / 1024,
      maxCacheSizeMB: this.config.maxCacheSizeBytes / 1024 / 1024,
      memoryPressure: this.state.memoryPressureLevel,
      queueLength: this.preloadQueue.length
    };
  }

  /**
   * Force clear all cached stories
   */
  clearAllCache(): void {
    this.decodedBuffers.clear();
    this.state.decodedStoryCount = 0;
    this.state.totalCacheSizeBytes = 0;
    this.preloadQueue.length = 0;
    console.log('[MobileStoryResourceManager] 🗑️ All cache cleared');
  }

  /**
   * Register callback for TTS buffering state changes
   */
  onTTSBufferingChange(callback: () => void): void {
    this.ttsBufferingCallbacks.add(callback);
  }

  /**
   * Unregister TTS buffering callback
   */
  offTTSBufferingChange(callback: () => void): void {
    this.ttsBufferingCallbacks.delete(callback);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    console.log('[MobileStoryResourceManager] 🧹 Cleaning up mobile resource manager');

    // Clear memory monitoring
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = null;
    }

    // Clear all caches
    this.clearAllCache();

    // Clear callbacks
    this.ttsBufferingCallbacks.clear();

    console.log('[MobileStoryResourceManager] ✅ Mobile resource manager destroyed');
  }
}

// Export singleton instance
export const globalMobileStoryResourceManager = MobileStoryResourceManager.getInstance();

// Export factory function for custom configurations
export function createMobileStoryResourceManager(config?: Partial<MobileResourceConfig>): MobileStoryResourceManager {
  return new MobileStoryResourceManager(config);
}