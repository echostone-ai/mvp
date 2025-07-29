// src/lib/streamingUtils.ts
import { globalAudioManager } from './globalAudioManager';

export interface StreamingAudioManager {
  addSentence: (sentence: string) => Promise<void>;
  stop: () => void;
  isPlaying: () => boolean;
}

export class AudioQueue {
  private audioQueue: ArrayBuffer[] = []; // Store pre-synthesized audio buffers
  private synthesisQueue: Array<{sentence: string, promise: Promise<ArrayBuffer | null>}> = [];
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
    
    console.log(`[AudioQueue] Starting synthesis for: "${sentence.substring(0, 30)}..."`);
    
    // Start synthesis immediately (parallel processing)
    const synthesisPromise = this.synthesizeSentence(sentence);
    this.synthesisQueue.push({ sentence, promise: synthesisPromise });
    
    // Process the synthesis queue
    this.processSynthesisQueue();
  }

  private async synthesizeSentence(sentence: string): Promise<ArrayBuffer | null> {
    try {
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
          console.log(`[AudioQueue] Synthesis complete for: "${sentence.substring(0, 30)}..."`);
          return audioBuffer;
        }
      } else {
        console.warn('Voice synthesis failed for sentence:', sentence);
      }
    } catch (error) {
      console.error('Failed to synthesize sentence:', sentence, error);
    }
    return null;
  }

  private async processSynthesisQueue() {
    // Process synthesis results in order
    while (this.synthesisQueue.length > 0 && !this.isDestroyed) {
      const { sentence, promise } = this.synthesisQueue[0];
      
      try {
        const audioBuffer = await promise;
        if (audioBuffer) {
          this.audioQueue.push(audioBuffer);
          console.log(`[AudioQueue] Added audio to playback queue. Queue length: ${this.audioQueue.length}`);
        }
      } catch (error) {
        console.error('Synthesis failed for sentence:', sentence, error);
      }
      
      this.synthesisQueue.shift(); // Remove processed item
      
      // Start playback if not already playing
      if (!this.isPlaying) {
        this.playNext();
      }
    }
  }

  private async playNext() {
    if (this.isDestroyed || this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const audioBuffer = this.audioQueue.shift()!;
    console.log(`[AudioQueue] Playing audio. Remaining in queue: ${this.audioQueue.length}`);
    
    try {
      await this.playAudioBuffer(audioBuffer);
    } catch (error) {
      console.error('Audio playback failed:', error);
    }
    
    // Minimal delay for natural flow, then continue immediately
    setTimeout(() => {
      if (!this.isDestroyed) {
        this.playNext();
      }
    }, 100); // Reduced from 300ms to 100ms for faster flow
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
    this.audioQueue.length = 0;
    this.synthesisQueue.length = 0;
    
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