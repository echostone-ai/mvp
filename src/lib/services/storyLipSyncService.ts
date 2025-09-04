/**
 * StoryLipSyncService - Experimental integration with HeyGen avatar lip-sync for story audio
 * 
 * This service provides experimental lip-sync capabilities for authentic voice stories:
 * - Attempts integration with HeyGen avatar lip-sync for story audio
 * - Implements fallback to idle animation when lip-sync unavailable
 * - Provides configuration option to enable/disable lip-sync attempts
 * - Creates smooth transitions between story audio and TTS lip-sync
 * - Labeled as experimental feature with graceful degradation
 * 
 * Requirements: 3.2, 7.4
 * Task 17: Integrate with avatar lip-sync system (experimental, off by default)
 */

import { UserStory } from '../types/stories';

export interface StoryLipSyncConfig {
  enabled: boolean; // Default: false (experimental feature)
  fallbackToIdle: boolean; // Default: true
  transitionDurationMs: number; // Default: 300ms for smooth transitions
  maxRetries: number; // Default: 2
  timeoutMs: number; // Default: 5000ms
  debugMode: boolean; // Default: false
}

export interface LipSyncResult {
  success: boolean;
  method: 'heygen' | 'idle' | 'none';
  error?: string;
  duration?: number;
  taskId?: string;
}

export interface LipSyncTransition {
  from: 'tts' | 'story' | 'idle';
  to: 'tts' | 'story' | 'idle';
  durationMs: number;
}

export interface HeyGenAvatarInterface {
  speak: (text: string, voiceId: string) => Promise<boolean>;
  isConnected: boolean;
  sessionId: string | null;
  isSpeaking: boolean;
}

export class StoryLipSyncService {
  private config: StoryLipSyncConfig;
  private currentLipSyncState: 'idle' | 'story' | 'tts' = 'idle';
  private heygenAvatar: HeyGenAvatarInterface | null = null;
  private transitionInProgress = false;

  constructor(config: Partial<StoryLipSyncConfig> = {}) {
    this.config = {
      enabled: false, // Experimental feature, off by default
      fallbackToIdle: true,
      transitionDurationMs: 300,
      maxRetries: 2,
      timeoutMs: 5000,
      debugMode: false,
      ...config
    };

    this.log('StoryLipSyncService initialized', { config: this.config });
  }

  /**
   * Initialize connection to HeyGen avatar
   * Attempts to find and connect to the global HeyGen avatar instance
   */
  async initialize(): Promise<boolean> {
    if (!this.config.enabled) {
      this.log('Lip-sync disabled, skipping initialization');
      return false;
    }

    try {
      // Try to get HeyGen avatar from global window object
      const globalHeyGen = (window as any).heygenAvatar;
      
      if (globalHeyGen && typeof globalHeyGen.speak === 'function') {
        this.heygenAvatar = globalHeyGen;
        this.log('Connected to HeyGen avatar', { 
          isConnected: globalHeyGen.isConnected,
          hasSessionId: !!globalHeyGen.sessionId 
        });
        return true;
      }

      this.log('HeyGen avatar not found or not ready');
      return false;

    } catch (error) {
      this.log('Failed to initialize HeyGen connection', { error });
      return false;
    }
  }

  /**
   * Attempt to sync story audio with HeyGen avatar lip-sync
   * This is the main integration point for story playback
   */
  async attemptStoryLipSync(story: UserStory, audioBuffer?: AudioBuffer): Promise<LipSyncResult> {
    if (!this.config.enabled) {
      return {
        success: false,
        method: 'none',
        error: 'Lip-sync disabled'
      };
    }

    const startTime = Date.now();

    try {
      // Ensure HeyGen avatar is available
      if (!this.heygenAvatar) {
        const initialized = await this.initialize();
        if (!initialized) {
          return await this.fallbackToIdle(story, 'HeyGen avatar not available');
        }
      }

      // Check if HeyGen avatar is connected and ready
      if (!this.heygenAvatar!.isConnected || !this.heygenAvatar!.sessionId) {
        return await this.fallbackToIdle(story, 'HeyGen avatar not connected');
      }

      // Transition from current state to story lip-sync
      await this.transitionToStoryLipSync();

      // Attempt to use story transcript for lip-sync if available
      if (story.transcript && story.transcript.trim()) {
        const result = await this.syncWithTranscript(story);
        if (result.success) {
          return result;
        }
      }

      // Fallback: Use story title and category for basic lip-sync
      const fallbackText = this.generateLipSyncFallbackText(story);
      const result = await this.syncWithFallbackText(story, fallbackText);
      
      if (result.success) {
        return result;
      }

      // Final fallback to idle animation
      return await this.fallbackToIdle(story, 'All lip-sync attempts failed');

    } catch (error) {
      const duration = Date.now() - startTime;
      this.log('Story lip-sync error', { error, duration });
      
      return await this.fallbackToIdle(story, `Lip-sync error: ${error}`);
    }
  }

  /**
   * Sync story with transcript text for accurate lip-sync
   */
  private async syncWithTranscript(story: UserStory): Promise<LipSyncResult> {
    if (!story.transcript || !this.heygenAvatar) {
      return { success: false, method: 'none', error: 'No transcript or avatar' };
    }

    try {
      this.log('Attempting transcript-based lip-sync', { 
        storyTitle: story.title,
        transcriptLength: story.transcript.length 
      });

      // Use a dummy voice ID since we're not actually generating TTS
      const dummyVoiceId = 'story-lipsync';
      
      const success = await this.heygenAvatar.speak(story.transcript, dummyVoiceId);
      
      if (success) {
        this.currentLipSyncState = 'story';
        
        return {
          success: true,
          method: 'heygen',
          duration: story.duration_ms
        };
      }

      return { success: false, method: 'none', error: 'HeyGen speak failed' };

    } catch (error) {
      this.log('Transcript lip-sync failed', { error });
      return { success: false, method: 'none', error: `Transcript sync error: ${error}` };
    }
  }

  /**
   * Sync story with fallback text when transcript is unavailable
   */
  private async syncWithFallbackText(story: UserStory, fallbackText: string): Promise<LipSyncResult> {
    if (!this.heygenAvatar) {
      return { success: false, method: 'none', error: 'No avatar available' };
    }

    try {
      this.log('Attempting fallback text lip-sync', { 
        storyTitle: story.title,
        fallbackText: fallbackText.substring(0, 50) + '...'
      });

      const dummyVoiceId = 'story-lipsync-fallback';
      const success = await this.heygenAvatar.speak(fallbackText, dummyVoiceId);
      
      if (success) {
        this.currentLipSyncState = 'story';
        
        return {
          success: true,
          method: 'heygen',
          duration: story.duration_ms
        };
      }

      return { success: false, method: 'none', error: 'HeyGen fallback speak failed' };

    } catch (error) {
      this.log('Fallback lip-sync failed', { error });
      return { success: false, method: 'none', error: `Fallback sync error: ${error}` };
    }
  }

  /**
   * Fallback to idle animation when lip-sync is unavailable
   */
  private async fallbackToIdle(story: UserStory, reason: string): Promise<LipSyncResult> {
    if (!this.config.fallbackToIdle) {
      return {
        success: false,
        method: 'none',
        error: `Fallback disabled: ${reason}`
      };
    }

    try {
      this.log('Falling back to idle animation', { reason, storyTitle: story.title });

      // Transition to idle state
      await this.transitionToIdle();

      return {
        success: true,
        method: 'idle',
        duration: story.duration_ms,
        error: reason
      };

    } catch (error) {
      this.log('Idle fallback failed', { error });
      return {
        success: false,
        method: 'none',
        error: `Idle fallback error: ${error}`
      };
    }
  }

  /**
   * Create smooth transition from current state to story lip-sync
   */
  private async transitionToStoryLipSync(): Promise<void> {
    if (this.transitionInProgress) {
      return;
    }

    this.transitionInProgress = true;

    try {
      const transition: LipSyncTransition = {
        from: this.currentLipSyncState,
        to: 'story',
        durationMs: this.config.transitionDurationMs
      };

      this.log('Transitioning to story lip-sync', transition);

      // Implement smooth transition based on current state
      switch (this.currentLipSyncState) {
        case 'tts':
          // Wait for current TTS to finish or fade out
          await this.waitForTTSCompletion();
          break;
        case 'idle':
          // No special transition needed from idle
          break;
        case 'story':
          // Already in story mode, no transition needed
          break;
      }

      // Small delay for smooth transition
      if (transition.durationMs > 0) {
        await new Promise(resolve => setTimeout(resolve, transition.durationMs));
      }

      this.currentLipSyncState = 'story';

    } finally {
      this.transitionInProgress = false;
    }
  }

  /**
   * Transition back to idle animation
   */
  private async transitionToIdle(): Promise<void> {
    if (this.transitionInProgress) {
      return;
    }

    this.transitionInProgress = true;

    try {
      const transition: LipSyncTransition = {
        from: this.currentLipSyncState,
        to: 'idle',
        durationMs: this.config.transitionDurationMs
      };

      this.log('Transitioning to idle animation', transition);

      // Smooth transition to idle
      if (transition.durationMs > 0) {
        await new Promise(resolve => setTimeout(resolve, transition.durationMs));
      }

      this.currentLipSyncState = 'idle';

    } finally {
      this.transitionInProgress = false;
    }
  }

  /**
   * Transition back to TTS lip-sync after story completes
   */
  async transitionBackToTTS(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    if (this.transitionInProgress) {
      return;
    }

    this.transitionInProgress = true;

    try {
      const transition: LipSyncTransition = {
        from: this.currentLipSyncState,
        to: 'tts',
        durationMs: this.config.transitionDurationMs
      };

      this.log('Transitioning back to TTS lip-sync', transition);

      // Smooth transition back to TTS mode
      if (transition.durationMs > 0) {
        await new Promise(resolve => setTimeout(resolve, transition.durationMs));
      }

      this.currentLipSyncState = 'tts';

    } finally {
      this.transitionInProgress = false;
    }
  }

  /**
   * Wait for current TTS to complete before transitioning
   */
  private async waitForTTSCompletion(): Promise<void> {
    if (!this.heygenAvatar) {
      return;
    }

    // Wait for current speaking to finish
    let attempts = 0;
    const maxAttempts = 20; // 2 seconds max wait
    
    while (this.heygenAvatar.isSpeaking && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (attempts >= maxAttempts) {
      this.log('TTS completion timeout, proceeding with transition');
    }
  }

  /**
   * Generate fallback text for lip-sync when transcript is unavailable
   */
  private generateLipSyncFallbackText(story: UserStory): string {
    // Create a brief text that matches the story's theme for basic lip movement
    const categoryTexts = {
      memory: `Sharing a cherished memory about ${story.title}`,
      experience: `Recounting an experience from ${story.title}`,
      advice: `Offering some thoughts on ${story.title}`,
      anecdote: `Telling a story about ${story.title}`
    };

    return categoryTexts[story.category] || `Sharing ${story.title}`;
  }

  /**
   * Get current lip-sync configuration
   */
  getConfig(): StoryLipSyncConfig {
    return { ...this.config };
  }

  /**
   * Update lip-sync configuration
   */
  updateConfig(updates: Partial<StoryLipSyncConfig>): void {
    this.config = { ...this.config, ...updates };
    this.log('Configuration updated', { config: this.config });
  }

  /**
   * Get current lip-sync state
   */
  getCurrentState(): {
    state: 'idle' | 'story' | 'tts';
    transitionInProgress: boolean;
    avatarConnected: boolean;
    enabled: boolean;
  } {
    return {
      state: this.currentLipSyncState,
      transitionInProgress: this.transitionInProgress,
      avatarConnected: !!this.heygenAvatar?.isConnected,
      enabled: this.config.enabled
    };
  }

  /**
   * Enable or disable lip-sync feature
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.log(`Lip-sync ${enabled ? 'enabled' : 'disabled'}`);
    
    if (!enabled) {
      // Reset to idle when disabled
      this.currentLipSyncState = 'idle';
      this.heygenAvatar = null;
    }
  }

  /**
   * Check if lip-sync is available and ready
   */
  async isAvailable(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    if (!this.heygenAvatar) {
      const initialized = await this.initialize();
      if (!initialized) {
        return false;
      }
    }

    return !!(this.heygenAvatar?.isConnected && this.heygenAvatar?.sessionId);
  }

  /**
   * Logging utility with debug mode support
   */
  private log(message: string, data?: any): void {
    if (this.config.debugMode) {
      console.log(`[StoryLipSyncService] ${message}`, data || '');
    }
  }
}

// Global instance for easy access
export const globalStoryLipSyncService = new StoryLipSyncService();