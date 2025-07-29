// src/lib/streamingUtils.ts
import { globalAudioManager } from './globalAudioManager';

export interface StreamingAudioManager {
  addSentence: (sentence: string) => Promise<void>;
  stop: () => void;
  isPlaying: () => boolean;
}

export class AudioQueue {
  private queue: ArrayBuffer[] = [];
  private isPlaying = false;
  private currentAudio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private isDestroyed = false;
  private lastPlayTime = 0;

  constructor() {
    // Initialize Web Audio API for better control
    if (typeof window !== 'undefined' && window.AudioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
    }
  }

  async addAudio(audioBuffer: ArrayBuffer) {
    if (this.isDestroyed) return;
    
    // Limit queue size to prevent memory issues and reduce overlap
    if (this.queue.length > 5) {
      console.warn('Audio queue getting too long, dropping oldest audio');
      this.queue.shift();
    }
    
    this.queue.push(audioBuffer);
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  private async playNext() {
    if (this.isDestroyed || this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    // Add small delay between sentences to prevent overlap, but don't drop them
    const now = Date.now();
    const timeSinceLastPlay = now - this.lastPlayTime;
    const minInterval = 200; // Reduced from 500ms to 200ms for better flow
    
    if (timeSinceLastPlay < minInterval) {
      // Wait for the remaining time, then try again
      setTimeout(() => {
        if (!this.isDestroyed) {
          this.playNext();
        }
      }, minInterval - timeSinceLastPlay);
      return;
    }

    this.isPlaying = true;
    this.lastPlayTime = now;
    const audioBuffer = this.queue.shift()!;
    
    try {
      // Create blob URL for the audio
      const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      
      // Create audio element
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;
      
      // Set up cleanup
      const cleanup = () => {
        URL.revokeObjectURL(audioUrl);
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
        if (!this.isDestroyed) {
          this.playNext(); // Play next in queue
        }
      };
      
      audio.onended = cleanup;
      audio.onerror = (error) => {
        console.error('Audio playback error:', error);
        cleanup();
      };
      
      // Use global audio manager to prevent overlaps - with immediate stop
      await globalAudioManager.stopAll();
      await new Promise(resolve => setTimeout(resolve, 50)); // Small delay to ensure stop completes
      
      if (!this.isDestroyed) {
        await globalAudioManager.playAudio(audio);
      }
    } catch (error) {
      console.error('Failed to play audio:', error);
      if (!this.isDestroyed) {
        this.playNext(); // Continue with next audio
      }
    }
  }

  stop() {
    this.isDestroyed = true;
    this.queue.length = 0; // Clear queue
    
    // Stop current audio immediately
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    
    globalAudioManager.stopAll(); // Use global manager to stop all audio
    this.isPlaying = false;
  }

  getIsPlaying() {
    return !this.isDestroyed && (this.isPlaying || globalAudioManager.getIsPlaying());
  }
}

export function createStreamingAudioManager(
  voiceId: string,
  voiceSettings?: any,
  accent?: string
): StreamingAudioManager {
  const audioQueue = new AudioQueue();

  return {
    async addSentence(sentence: string) {
      try {
        const response = await fetch('/api/voice-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sentence: sentence.trim(),
            voiceId,
            settings: voiceSettings,
            accent
          }),
        });

        if (response.ok) {
          const audioBuffer = await response.arrayBuffer();
          if (audioBuffer.byteLength > 0) {
            await audioQueue.addAudio(audioBuffer);
          }
        } else {
          console.warn('Voice synthesis failed for sentence:', sentence);
        }
      } catch (error) {
        console.error('Failed to synthesize sentence:', sentence, error);
      }
    },

    stop() {
      audioQueue.stop();
    },

    isPlaying() {
      return audioQueue.getIsPlaying();
    }
  };
}

// Global function to stop all audio playback
export async function stopAllAudio() {
  await globalAudioManager.stopAll();
}

export function splitIntoSentences(text: string): string[] {
  // Split on sentence endings, but be smart about abbreviations
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  return sentences;
}

export async function* streamChatResponse(
  question: string,
  history: any[],
  profileData: any,
  options: {
    userId?: string;
    avatarId?: string;
    visitorName?: string;
    isSharedAvatar?: boolean;
    shareToken?: string;
    voiceId?: string;
  }
) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        history,
        profileData,
        stream: true,
        ...options
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Yield each character as it comes in
        for (const char of chunk) {
          yield char;
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    console.error('Streaming error:', error);
    throw error;
  }
}