// src/lib/streamingUtils.ts

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

  constructor() {
    // Initialize Web Audio API for better control
    if (typeof window !== 'undefined' && window.AudioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
    }
  }

  async addAudio(audioBuffer: ArrayBuffer) {
    this.queue.push(audioBuffer);
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  private async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const audioBuffer = this.queue.shift()!;
    
    try {
      // Create blob URL for the audio
      const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      
      // Create and play audio element
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        this.playNext(); // Play next in queue
      };
      
      audio.onerror = (error) => {
        console.error('Audio playback error:', error);
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        this.playNext(); // Continue with next audio
      };
      
      await audio.play();
    } catch (error) {
      console.error('Failed to play audio:', error);
      this.playNext(); // Continue with next audio
    }
  }

  stop() {
    this.queue.length = 0; // Clear queue
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.isPlaying = false;
  }

  getIsPlaying() {
    return this.isPlaying;
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