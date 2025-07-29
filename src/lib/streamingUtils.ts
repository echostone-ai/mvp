// src/lib/streamingUtils.ts
import { globalAudioManager } from './globalAudioManager';

export interface StreamingAudioManager {
  addSentence: (sentence: string) => Promise<void>;
  stop: () => void;
  isPlaying: () => boolean;
}

export class AudioQueue {
  private queue: string[] = []; // Store sentences instead of audio buffers
  private isPlaying = false;
  private currentAudio: HTMLAudioElement | null = null;
  private isDestroyed = false;
  private voiceId: string;
  private voiceSettings?: any;
  private accent?: string;

  constructor(voiceId: string, voiceSettings?: any, accent?: string) {
    this.voiceId = voiceId;
    this.voiceSettings = voiceSettings;
    this.accent = accent;
  }

  async addSentence(sentence: string) {
    if (this.isDestroyed) return;
    
    this.queue.push(sentence);
    console.log(`[AudioQueue] Added sentence to queue: "${sentence.substring(0, 30)}..." Queue length: ${this.queue.length}`);
    
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  private async playNext() {
    if (this.isDestroyed || this.queue.length === 0) {
      console.log(`[AudioQueue] playNext stopping - destroyed: ${this.isDestroyed}, queue length: ${this.queue.length}`);
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const sentence = this.queue.shift()!;
    console.log(`[AudioQueue] Processing sentence: "${sentence.substring(0, 30)}..." Remaining: ${this.queue.length}`);
    
    try {
      // Synthesize audio for this sentence
      const response = await fetch('/api/voice-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentence: sentence.trim(),
          voiceId: this.voiceId,
          settings: this.voiceSettings,
          accent: this.accent
        }),
      });

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        if (audioBuffer.byteLength > 0) {
          // Play the audio immediately
          await this.playAudioBuffer(audioBuffer);
        }
      } else {
        console.warn('Voice synthesis failed for sentence:', sentence);
      }
    } catch (error) {
      console.error('Failed to synthesize sentence:', sentence, error);
    }
    
    // Small delay between sentences, then continue
    setTimeout(() => {
      if (!this.isDestroyed) {
        this.playNext();
      }
    }, 300);
  }

  private async playAudioBuffer(audioBuffer: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      
      this.currentAudio = audio;
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        resolve();
      };
      
      audio.onerror = (error) => {
        console.error('[AudioQueue] Audio playback error:', error);
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        reject(error);
      };
      
      audio.play().catch(reject);
    });
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
    
    this.isPlaying = false;
  }

  getIsPlaying() {
    return !this.isDestroyed && this.isPlaying;
  }
}

export function createStreamingAudioManager(
  voiceId: string,
  voiceSettings?: any,
  accent?: string
): StreamingAudioManager {
  const audioQueue = new AudioQueue(voiceId, voiceSettings, accent);

  const manager: StreamingAudioManager = {
    async addSentence(sentence: string) {
      await audioQueue.addSentence(sentence);
    },

    stop() {
      audioQueue.stop();
      activeStreamingManagers.delete(manager);
    },

    isPlaying() {
      return audioQueue.getIsPlaying();
    }
  };

  // Register this manager
  activeStreamingManagers.add(manager);
  
  return manager;
}

// Keep track of active streaming audio managers
const activeStreamingManagers = new Set<StreamingAudioManager>();

// Global function to stop all audio playback
export async function stopAllAudio() {
  // Stop all streaming audio managers
  activeStreamingManagers.forEach(manager => {
    manager.stop();
  });
  
  // Stop all other audio
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