// Global Audio Manager to prevent overlapping audio streams
import { mobileAudioContextManager, isMobileSafari, createMobileOptimizedAudio } from './mobileAudioContextManager';

class GlobalAudioManager {
  private static instance: GlobalAudioManager;
  private currentAudio: HTMLAudioElement | null = null;
  private audioQueue: HTMLAudioElement[] = [];
  private isPlaying = false;
  private stopPromise: Promise<void> | null = null;

  private constructor() {
    // Initialize mobile audio context manager if on mobile Safari
    if (isMobileSafari()) {
      console.log('[GlobalAudioManager] Mobile Safari detected, initializing mobile audio context manager');
    }
  }

  static getInstance(): GlobalAudioManager {
    if (!GlobalAudioManager.instance) {
      GlobalAudioManager.instance = new GlobalAudioManager();
    }
    return GlobalAudioManager.instance;
  }

  // Stop all audio immediately and return a promise that resolves when stopping is complete
  stopAll(): Promise<void> {
    if (this.stopPromise) {
      return this.stopPromise;
    }

    this.stopPromise = new Promise<void>((resolve) => {
      // Stop current audio
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        
        // Remove event listeners to prevent callbacks
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
        this.currentAudio = null;
      }

      // Clear and stop queued audio
      this.audioQueue.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
        audio.onended = null;
        audio.onerror = null;
      });
      this.audioQueue = [];

      // Stop all audio elements on the page as fallback
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
        audio.onended = null;
        audio.onerror = null;
      });

      this.isPlaying = false;
      
      // Small delay to ensure all audio has stopped
      setTimeout(() => {
        this.stopPromise = null;
        resolve();
      }, 10);
    });

    return this.stopPromise;
  }

  // Play audio with automatic overlap prevention and mobile Safari optimization
  async playAudio(audio: HTMLAudioElement): Promise<void> {
    // Stop any existing audio first and wait for it to complete
    await this.stopAll();

    // Task 9: Ensure mobile Safari audio context is ready
    if (isMobileSafari()) {
      const isReady = await mobileAudioContextManager.ensureReady();
      if (!isReady) {
        throw new Error('Audio context not ready - user gesture required');
      }
    }

    this.currentAudio = audio;
    this.isPlaying = true;

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        if (this.currentAudio === audio) {
          this.currentAudio = null;
          this.isPlaying = false;
        }
      };

      audio.onended = () => {
        cleanup();
        resolve();
      };

      audio.onerror = (error) => {
        cleanup();
        reject(error);
      };

      // Task 9: Mobile Safari specific optimizations
      if (isMobileSafari()) {
        // Ensure audio is configured for mobile Safari
        audio.playsInline = true;
        audio.muted = false;
        
        // Add additional error handling for mobile Safari
        const mobileErrorHandler = (error: any) => {
          console.warn('[GlobalAudioManager] Mobile Safari audio error:', error);
          // Try fallback approach
          setTimeout(() => {
            audio.play().catch((fallbackError) => {
              console.error('[GlobalAudioManager] Mobile Safari fallback failed:', fallbackError);
              cleanup();
              reject(fallbackError);
            });
          }, 100);
        };

        audio.addEventListener('error', mobileErrorHandler, { once: true });
      }

      // Add a small delay before playing to ensure previous audio has fully stopped
      setTimeout(() => {
        audio.play().catch((error) => {
          cleanup();
          reject(error);
        });
      }, 20);
    });
  }

  // Check if any audio is currently playing
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  // Get current audio element
  getCurrentAudio(): HTMLAudioElement | null {
    return this.currentAudio;
  }

  // Task 9: Create mobile-optimized audio element
  createOptimizedAudio(src?: string): HTMLAudioElement {
    if (isMobileSafari() && src) {
      return createMobileOptimizedAudio(src);
    }
    
    const audio = new Audio();
    if (src) {
      audio.src = src;
      audio.preload = 'auto';
    }
    return audio;
  }
}

export const globalAudioManager = GlobalAudioManager.getInstance();