// Global Audio Manager to prevent overlapping audio streams
class GlobalAudioManager {
  private static instance: GlobalAudioManager;
  private currentAudio: HTMLAudioElement | null = null;
  private audioQueue: HTMLAudioElement[] = [];
  private isPlaying = false;
  private stopPromise: Promise<void> | null = null;

  private constructor() {}

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

  // Play audio with automatic overlap prevention
  async playAudio(audio: HTMLAudioElement): Promise<void> {
    // Stop any existing audio first and wait for it to complete
    await this.stopAll();

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
}

export const globalAudioManager = GlobalAudioManager.getInstance();