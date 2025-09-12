// Mobile Safari Audio Context Manager
// Task 9: Implement Mobile Safari audio context optimization

export interface MobileAudioContextConfig {
  enableGesturePrompt: boolean;
  persistAcrossBackgrounding: boolean;
  optimizeBuffers: boolean;
  fallbackToHTMLAudio: boolean;
}

export interface AudioContextState {
  isInitialized: boolean;
  isActive: boolean;
  requiresGesture: boolean;
  lastInteraction: number;
  backgroundedAt?: number;
  resumedAt?: number;
}

export class MobileAudioContextManager {
  private static instance: MobileAudioContextManager;
  private audioContext: AudioContext | null = null;
  private state: AudioContextState = {
    isInitialized: false,
    isActive: false,
    requiresGesture: true,
    lastInteraction: 0
  };
  private config: MobileAudioContextConfig;
  private gesturePromptElement: HTMLElement | null = null;
  private visibilityChangeHandler: (() => void) | null = null;
  private pageHideHandler: (() => void) | null = null;
  private pageShowHandler: (() => void) | null = null;
  private touchStartHandler: (() => void) | null = null;
  private clickHandler: (() => void) | null = null;
  private resumePromise: Promise<void> | null = null;

  private constructor(config: MobileAudioContextConfig) {
    this.config = config;
    this.setupEventListeners();
  }

  static getInstance(config?: MobileAudioContextConfig): MobileAudioContextManager {
    if (!MobileAudioContextManager.instance) {
      const defaultConfig: MobileAudioContextConfig = {
        enableGesturePrompt: true,
        persistAcrossBackgrounding: true,
        optimizeBuffers: true,
        fallbackToHTMLAudio: true
      };
      MobileAudioContextManager.instance = new MobileAudioContextManager(
        config || defaultConfig
      );
    }
    return MobileAudioContextManager.instance;
  }

  /**
   * Check if we're running on Mobile Safari
   */
  private isMobileSafari(): boolean {
    if (typeof window === 'undefined') return false;
    
    const userAgent = window.navigator.userAgent;
    const isSafari = /Safari/.test(userAgent) && !/Chrome|CriOS/.test(userAgent);
    const isMobile = /iPhone|iPad|iPod/.test(userAgent);
    
    return isSafari && isMobile;
  }

  /**
   * Setup event listeners for audio context management
   */
  private setupEventListeners(): void {
    if (typeof window === 'undefined') return;

    // Handle visibility changes for background/foreground transitions
    this.visibilityChangeHandler = () => {
      if (document.hidden) {
        this.handleBackgrounding();
      } else {
        this.handleForegrounding();
      }
    };

    // Handle page hide/show events (iOS specific)
    this.pageHideHandler = () => {
      this.handleBackgrounding();
    };

    this.pageShowHandler = () => {
      this.handleForegrounding();
    };

    // Handle user gestures for audio context activation
    this.touchStartHandler = () => {
      this.handleUserGesture();
    };

    this.clickHandler = () => {
      this.handleUserGesture();
    };

    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
    window.addEventListener('pagehide', this.pageHideHandler);
    window.addEventListener('pageshow', this.pageShowHandler);
    document.addEventListener('touchstart', this.touchStartHandler, { passive: true });
    document.addEventListener('click', this.clickHandler, { passive: true });
  }

  /**
   * Handle backgrounding (app goes to background or screen locks)
   */
  private handleBackgrounding(): void {
    console.log('[MobileAudioContext] App backgrounded');
    this.state.backgroundedAt = Date.now();
    
    if (this.audioContext && this.audioContext.state === 'running') {
      // Don't suspend immediately - let it continue for a bit
      // iOS will suspend it automatically after ~30 seconds
      console.log('[MobileAudioContext] Audio context will be suspended by iOS');
    }
  }

  /**
   * Handle foregrounding (app returns from background)
   */
  private handleForegrounding(): void {
    console.log('[MobileAudioContext] App foregrounded');
    this.state.resumedAt = Date.now();
    
    if (this.audioContext && this.audioContext.state === 'suspended') {
      console.log('[MobileAudioContext] Attempting to resume audio context');
      this.resumeAudioContext();
    }
  }

  /**
   * Handle user gesture for audio context activation
   */
  private handleUserGesture(): void {
    this.state.lastInteraction = Date.now();
    
    if (this.state.requiresGesture && !this.state.isInitialized) {
      this.initializeAudioContext();
    } else if (this.audioContext && this.audioContext.state === 'suspended') {
      this.resumeAudioContext();
    }
  }

  /**
   * Initialize audio context with user gesture
   */
  private async initializeAudioContext(): Promise<void> {
    try {
      console.log('[MobileAudioContext] Initializing audio context with user gesture');
      
      // Create audio context with optimal settings for mobile
      const contextOptions: AudioContextOptions = {};
      
      if (this.config.optimizeBuffers) {
        // Optimize for mobile Safari
        contextOptions.latencyHint = 'interactive';
        contextOptions.sampleRate = 44100; // Match our enhanced voice config
      }

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)(contextOptions);
      
      // Ensure context starts in running state
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.state.isInitialized = true;
      this.state.isActive = this.audioContext.state === 'running';
      this.state.requiresGesture = false;

      console.log('[MobileAudioContext] Audio context initialized successfully');
      this.hideGesturePrompt();

      // Test audio context with a silent buffer
      await this.testAudioContext();

    } catch (error) {
      console.error('[MobileAudioContext] Failed to initialize audio context:', error);
      this.state.isInitialized = false;
      this.state.isActive = false;
    }
  }

  /**
   * Resume audio context after suspension
   */
  private async resumeAudioContext(): Promise<void> {
    if (this.resumePromise) {
      return this.resumePromise;
    }

    this.resumePromise = (async () => {
      try {
        if (!this.audioContext) {
          await this.initializeAudioContext();
          return;
        }

        console.log('[MobileAudioContext] Resuming audio context');
        await this.audioContext.resume();
        
        this.state.isActive = this.audioContext.state === 'running';
        console.log(`[MobileAudioContext] Audio context resumed, state: ${this.audioContext.state}`);

      } catch (error) {
        console.error('[MobileAudioContext] Failed to resume audio context:', error);
        this.state.isActive = false;
      } finally {
        this.resumePromise = null;
      }
    })();

    return this.resumePromise;
  }

  /**
   * Test audio context with a silent buffer
   */
  private async testAudioContext(): Promise<void> {
    if (!this.audioContext) return;

    try {
      // Create a very short silent buffer to test the context
      const buffer = this.audioContext.createBuffer(1, 1, this.audioContext.sampleRate);
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start();
      
      console.log('[MobileAudioContext] Audio context test successful');
    } catch (error) {
      console.warn('[MobileAudioContext] Audio context test failed:', error);
    }
  }

  /**
   * Show gesture prompt UI
   */
  private showGesturePrompt(): void {
    if (!this.config.enableGesturePrompt || this.gesturePromptElement) return;

    this.gesturePromptElement = document.createElement('div');
    this.gesturePromptElement.id = 'mobile-audio-gesture-prompt';
    this.gesturePromptElement.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="
          background: white;
          padding: 24px;
          border-radius: 12px;
          text-align: center;
          max-width: 300px;
          margin: 20px;
        ">
          <div style="font-size: 48px; margin-bottom: 16px;">🔊</div>
          <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #333;">Enable Audio</h3>
          <p style="margin: 0 0 20px 0; font-size: 14px; color: #666; line-height: 1.4;">
            Tap to enable audio for the best conversation experience
          </p>
          <button id="enable-audio-btn" style="
            background: #007AFF;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
          ">
            Tap to Enable Audio
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(this.gesturePromptElement);

    // Handle button click
    const button = this.gesturePromptElement.querySelector('#enable-audio-btn');
    if (button) {
      button.addEventListener('click', () => {
        this.handleUserGesture();
      });
    }
  }

  /**
   * Hide gesture prompt UI
   */
  private hideGesturePrompt(): void {
    if (this.gesturePromptElement) {
      this.gesturePromptElement.remove();
      this.gesturePromptElement = null;
    }
  }

  /**
   * Get current audio context
   */
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * Get current state
   */
  getState(): AudioContextState {
    return { ...this.state };
  }

  /**
   * Check if audio context is ready for use
   */
  isReady(): boolean {
    return this.state.isInitialized && this.state.isActive && 
           this.audioContext?.state === 'running';
  }

  /**
   * Ensure audio context is ready, show prompt if needed
   */
  async ensureReady(): Promise<boolean> {
    // If not on mobile Safari, always return true
    if (!this.isMobileSafari()) {
      return true;
    }

    // If already ready, return true
    if (this.isReady()) {
      return true;
    }

    // If requires gesture and not initialized, show prompt
    if (this.state.requiresGesture && !this.state.isInitialized) {
      this.showGesturePrompt();
      return false;
    }

    // If suspended, try to resume
    if (this.audioContext?.state === 'suspended') {
      await this.resumeAudioContext();
      return this.isReady();
    }

    // If not initialized, try to initialize
    if (!this.state.isInitialized) {
      await this.initializeAudioContext();
      return this.isReady();
    }

    return this.isReady();
  }

  /**
   * Create optimized audio buffer for mobile
   */
  createOptimizedBuffer(audioData: ArrayBuffer): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
      if (!this.audioContext) {
        reject(new Error('Audio context not initialized'));
        return;
      }

      // Use decodeAudioData with mobile-optimized settings
      this.audioContext.decodeAudioData(
        audioData.slice(0), // Create a copy to avoid detached buffer issues
        (buffer) => {
          // Optimize buffer for mobile playback
          if (this.config.optimizeBuffers && buffer.length > 0) {
            // Ensure buffer is not too long (mobile Safari has limits)
            const maxLength = this.audioContext!.sampleRate * 30; // 30 seconds max
            if (buffer.length > maxLength) {
              console.warn('[MobileAudioContext] Buffer too long, truncating');
              const truncatedBuffer = this.audioContext!.createBuffer(
                buffer.numberOfChannels,
                maxLength,
                buffer.sampleRate
              );
              
              for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
                const sourceData = buffer.getChannelData(channel);
                const targetData = truncatedBuffer.getChannelData(channel);
                targetData.set(sourceData.subarray(0, maxLength));
              }
              
              resolve(truncatedBuffer);
            } else {
              resolve(buffer);
            }
          } else {
            resolve(buffer);
          }
        },
        (error) => {
          console.error('[MobileAudioContext] Failed to decode audio data:', error);
          reject(error);
        }
      );
    });
  }

  /**
   * Fallback to HTML Audio for compatibility
   */
  createFallbackAudio(src: string): HTMLAudioElement {
    const audio = new Audio();
    audio.src = src;
    audio.preload = 'auto';
    
    // Mobile Safari optimizations
    if (this.isMobileSafari()) {
      audio.playsInline = true;
      audio.muted = false; // Ensure not muted
    }

    return audio;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    console.log('[MobileAudioContext] Destroying mobile audio context manager');

    // Remove event listeners
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    }
    if (this.pageHideHandler) {
      window.removeEventListener('pagehide', this.pageHideHandler);
    }
    if (this.pageShowHandler) {
      window.removeEventListener('pageshow', this.pageShowHandler);
    }
    if (this.touchStartHandler) {
      document.removeEventListener('touchstart', this.touchStartHandler);
    }
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler);
    }

    // Hide gesture prompt
    this.hideGesturePrompt();

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Reset state
    this.state = {
      isInitialized: false,
      isActive: false,
      requiresGesture: true,
      lastInteraction: 0
    };
  }
}

// Export singleton instance
export const mobileAudioContextManager = MobileAudioContextManager.getInstance();

// Export utility functions
export function isMobileSafari(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = window.navigator.userAgent;
  const isSafari = /Safari/.test(userAgent) && !/Chrome|CriOS/.test(userAgent);
  const isMobile = /iPhone|iPad|iPod/.test(userAgent);
  
  return isSafari && isMobile;
}

export function createMobileOptimizedAudio(src: string): HTMLAudioElement {
  return mobileAudioContextManager.createFallbackAudio(src);
}