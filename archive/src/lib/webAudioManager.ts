// Enhanced Web Audio API implementation for better voice streaming control
// This provides lower latency, crossfades, and better audio management

export class WebAudioManager {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Create audio context with optimal settings for voice
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 44100,
        latencyHint: 'interactive' // Optimize for low latency
      });

      // Create gain node for volume control and crossfading
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      this.gainNode.gain.value = 1.0;

      this.isInitialized = true;
      console.log('[WebAudioManager] Initialized with sample rate:', this.audioContext.sampleRate);
    } catch (error) {
      console.error('[WebAudioManager] Failed to initialize:', error);
      throw error;
    }
  }

  async playAudioBuffer(audioBuffer: ArrayBuffer, options: {
    crossfade?: boolean;
    fadeInDuration?: number;
    fadeOutDuration?: number;
  } = {}): Promise<void> {
    if (!this.audioContext || !this.gainNode) {
      throw new Error('WebAudioManager not initialized');
    }

    // Resume context if suspended (required for user interaction)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    try {
      // Decode audio data
      const decodedBuffer = await this.audioContext.decodeAudioData(audioBuffer.slice(0));
      
      // Stop current audio with optional crossfade
      if (this.currentSource && options.crossfade) {
        await this.crossfadeOut(options.fadeOutDuration || 0.1);
      } else if (this.currentSource) {
        this.currentSource.stop();
        this.currentSource = null;
      }

      // Create and configure new audio source
      const source = this.audioContext.createBufferSource();
      source.buffer = decodedBuffer;
      source.connect(this.gainNode);
      
      this.currentSource = source;

      // Apply fade in if requested
      if (options.fadeInDuration && options.fadeInDuration > 0) {
        this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(1, this.audioContext.currentTime + options.fadeInDuration);
      }

      // Play audio
      return new Promise((resolve, reject) => {
        source.onended = () => {
          if (this.currentSource === source) {
            this.currentSource = null;
          }
          resolve();
        };

        source.onerror = (error) => {
          if (this.currentSource === source) {
            this.currentSource = null;
          }
          reject(error);
        };

        source.start(0);
      });

    } catch (error) {
      console.error('[WebAudioManager] Failed to play audio:', error);
      throw error;
    }
  }

  private async crossfadeOut(duration: number): Promise<void> {
    if (!this.audioContext || !this.gainNode || !this.currentSource) return;

    return new Promise((resolve) => {
      const currentTime = this.audioContext!.currentTime;
      
      // Fade out current audio
      this.gainNode!.gain.setValueAtTime(1, currentTime);
      this.gainNode!.gain.linearRampToValueAtTime(0, currentTime + duration);
      
      // Stop source after fade
      setTimeout(() => {
        if (this.currentSource) {
          this.currentSource.stop();
          this.currentSource = null;
        }
        // Reset gain for next audio
        this.gainNode!.gain.setValueAtTime(1, this.audioContext!.currentTime);
        resolve();
      }, duration * 1000);
    });
  }

  async stop(): Promise<void> {
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }
    
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(1, this.audioContext?.currentTime || 0);
    }
  }

  setVolume(volume: number) {
    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    }
  }

  isPlaying(): boolean {
    return this.currentSource !== null;
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  async close() {
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }
    
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
      this.gainNode = null;
    }
    
    this.isInitialized = false;
  }
}

// Singleton instance for global use
let webAudioManagerInstance: WebAudioManager | null = null;

export function getWebAudioManager(): WebAudioManager {
  if (!webAudioManagerInstance) {
    webAudioManagerInstance = new WebAudioManager();
  }
  return webAudioManagerInstance;
}

// Enhanced audio queue that uses Web Audio API
export class WebAudioQueue {
  private queue: string[] = [];
  private isPlaying = false;
  private isDestroyed = false;
  private webAudioManager: WebAudioManager;
  private voiceId: string;
  private voiceSettings?: any;
  private accent?: string;
  private audioCache = new Map<string, ArrayBuffer>();
  private isFetchingNext = false;

  constructor(voiceId: string, voiceSettings?: any, accent?: string) {
    this.voiceId = voiceId;
    this.voiceSettings = voiceSettings;
    this.accent = accent;
    this.webAudioManager = getWebAudioManager();
  }

  async initialize() {
    await this.webAudioManager.initialize();
  }

  async addText(text: string, priority: 'high' | 'normal' = 'normal') {
    if (this.isDestroyed) return;
    
    const trimmedText = text.trim();
    if (!trimmedText) return;

    if (priority === 'high') {
      this.queue.unshift(trimmedText); // Add to front for immediate playback
    } else {
      this.queue.push(trimmedText);
    }

    console.log(`[WebAudioQueue] Added text (${priority}): "${trimmedText.substring(0, 30)}..." Queue: ${this.queue.length}`);
    
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  private async playNext() {
    if (this.isDestroyed || this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const text = this.queue.shift()!;
    
    // Start prefetching next audio
    this.prefetchNextAudio();

    try {
      let audioBuffer: ArrayBuffer;
      const cacheKey = this.getCacheKey(text);
      
      if (this.audioCache.has(cacheKey)) {
        audioBuffer = this.audioCache.get(cacheKey)!;
        this.audioCache.delete(cacheKey);
        console.log(`[WebAudioQueue] Using cached audio for: "${text.substring(0, 30)}..."`);
      } else {
        audioBuffer = await this.synthesizeAudio(text);
      }

      if (audioBuffer.byteLength > 0) {
        await this.webAudioManager.playAudioBuffer(audioBuffer, {
          crossfade: true,
          fadeInDuration: 0.05,
          fadeOutDuration: 0.05
        });
      }
    } catch (error) {
      console.error('[WebAudioQueue] Failed to process text:', text, error);
    }

    // Continue to next text
    if (!this.isDestroyed) {
      this.playNext();
    }
  }

  private async synthesizeAudio(text: string): Promise<ArrayBuffer> {
    const response = await fetch('/api/voice-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sentence: text,
        voiceId: this.voiceId,
        settings: this.voiceSettings,
        accent: this.accent
      }),
    });

    if (!response.ok) {
      throw new Error(`Voice synthesis failed: ${response.status}`);
    }

    return await response.arrayBuffer();
  }

  private async prefetchNextAudio() {
    if (this.isFetchingNext || this.queue.length === 0 || this.isDestroyed) {
      return;
    }

    this.isFetchingNext = true;
    const nextText = this.queue[0];
    const cacheKey = this.getCacheKey(nextText);
    
    if (this.audioCache.has(cacheKey)) {
      this.isFetchingNext = false;
      return;
    }

    try {
      const audioBuffer = await this.synthesizeAudio(nextText);
      this.audioCache.set(cacheKey, audioBuffer);
      console.log(`[WebAudioQueue] Prefetched audio for: "${nextText.substring(0, 30)}..."`);
    } catch (error) {
      console.error('[WebAudioQueue] Failed to prefetch audio:', error);
    } finally {
      this.isFetchingNext = false;
    }
  }

  private getCacheKey(text: string): string {
    return `${this.voiceId}-${text.substring(0, 100)}-${JSON.stringify(this.voiceSettings)}-${this.accent}`;
  }

  async stop() {
    this.isDestroyed = true;
    this.queue.length = 0;
    this.audioCache.clear();
    this.isFetchingNext = false;
    await this.webAudioManager.stop();
    this.isPlaying = false;
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlaying && this.webAudioManager.isPlaying();
  }
}