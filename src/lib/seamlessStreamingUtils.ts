// src/lib/seamlessStreamingUtils.ts
import { getNaturalVoiceSettings } from './naturalVoiceSettings';

export interface SeamlessStreamingManager {
  addText: (text: string) => Promise<void>;
  complete: () => Promise<void>;
  stop: () => void;
  isPlaying: () => boolean;
}

export class SeamlessAudioQueue {
  private textBuffer = '';
  private audioQueue: ArrayBuffer[] = [];
  private isPlaying = false;
  private isDestroyed = false;
  private voiceId: string;
  private voiceSettings: any;
  private conversationId: string;
  private currentAudio: HTMLAudioElement | null = null;
  private processingPromise: Promise<void> | null = null;

  constructor(voiceId: string, voiceSettings?: any, conversationId?: string) {
    this.voiceId = voiceId;
    this.voiceSettings = voiceSettings || getNaturalVoiceSettings();
    this.conversationId = conversationId || 'default';
  }

  async addText(text: string) {
    if (this.isDestroyed) return;
    
    const trimmedText = text.trim();
    if (!trimmedText) return;
    
    // Add to buffer
    this.textBuffer += (this.textBuffer ? ' ' : '') + trimmedText;
    
    // Process buffer immediately
    await this.processBuffer();
  }

  async complete() {
    if (this.isDestroyed) return;
    
    // Process any remaining text
    if (this.textBuffer.trim()) {
      await this.processBuffer(true);
    }
    
    // Wait for all audio to finish
    while (this.audioQueue.length > 0 || this.isPlaying) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private async processBuffer(isComplete: boolean = false) {
    if (!this.textBuffer.trim()) return;
    
    // Split into sentences
    const sentences = this.splitIntoSentences(this.textBuffer);
    
    if (sentences.length === 0) return;
    
    // If complete, process all sentences. If not complete, process all but the last incomplete sentence
    const sentencesToProcess = isComplete ? sentences : sentences.slice(0, -1);
    const remainingText = isComplete ? '' : sentences[sentences.length - 1];
    
    // Generate audio for each sentence
    for (const sentence of sentencesToProcess) {
      const trimmedSentence = sentence.trim();
      if (trimmedSentence && trimmedSentence.length > 8 && /[.!?]$/.test(trimmedSentence)) {
        try {
          console.log(`[SeamlessStreaming] Generating audio for: "${trimmedSentence.substring(0, 50)}..."`);
          const audioBuffer = await this.generateAudio(trimmedSentence);
          this.audioQueue.push(audioBuffer);
          
          // Start playing if not already playing
          if (!this.isPlaying) {
            this.playNext();
          }
        } catch (error) {
          console.error('Failed to generate audio:', error);
        }
      }
    }
    
    // Update buffer with remaining text
    this.textBuffer = remainingText;
  }

  private splitIntoSentences(text: string): string[] {
    // More robust sentence splitting that handles edge cases
    const sentences = text.split(/(?<=[.!?])\s+/);
    
    // Filter out very short fragments and ensure proper sentence endings
    return sentences.filter(s => {
      const trimmed = s.trim();
      return trimmed.length > 0 && 
             trimmed.length > 8 && // Increased minimum length for better quality
             /[.!?]$/.test(trimmed) && // Must end with proper punctuation
             !trimmed.includes('...') && // Avoid ellipsis fragments
             trimmed.split(' ').length > 2; // Must have at least 3 words
    });
  }

  private async generateAudio(text: string): Promise<ArrayBuffer> {
    const response = await fetch('/api/voice-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sentence: text,
        voiceId: this.voiceId,
        settings: this.voiceSettings,
        conversationId: this.conversationId
      }),
    });

    if (!response.ok) {
      throw new Error(`Voice generation failed: ${response.status}`);
    }

    return await response.arrayBuffer();
  }

  private async playNext() {
    if (this.isDestroyed || this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const audioBuffer = this.audioQueue.shift()!;
    
    try {
      await this.playAudioBuffer(audioBuffer);
    } catch (error) {
      console.error('Failed to play audio:', error);
    }
    
    // Continue to next audio
    if (!this.isDestroyed) {
      this.playNext();
    }
  }

  private async playAudioBuffer(audioBuffer: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      
      audio.playbackRate = 1.0;
      audio.volume = 1.0;
      
      this.currentAudio = audio;
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        resolve();
      };
      
      audio.onerror = (error) => {
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        reject(error);
      };
      
      audio.play().catch(reject);
    });
  }

  stop() {
    this.isDestroyed = true;
    this.textBuffer = '';
    this.audioQueue.length = 0;
    
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    
    this.isPlaying = false;
  }

  isPlaying() {
    return !this.isDestroyed && this.isPlaying;
  }
}

export function createSeamlessStreamingManager(
  voiceId: string,
  voiceSettings?: any,
  options: {
    conversationId?: string;
  } = {}
): SeamlessStreamingManager {
  const audioQueue = new SeamlessAudioQueue(voiceId, voiceSettings, options.conversationId);

  return {
    async addText(text: string) {
      await audioQueue.addText(text);
    },

    async complete() {
      await audioQueue.complete();
    },

    stop() {
      audioQueue.stop();
    },

    isPlaying() {
      return audioQueue.isPlaying();
    }
  };
}

// Keep track of active managers
const activeManagers = new Set<SeamlessStreamingManager>();

export function stopAllSeamlessAudio() {
  activeManagers.forEach(manager => {
    manager.stop();
  });
  activeManagers.clear();
}

// Helper function to split text for streaming
export function splitTextForSeamlessStreaming(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  // Filter out very short fragments and ensure proper sentence endings
  return sentences.filter(s => {
    const trimmed = s.trim();
    return trimmed.length > 0 && 
           trimmed.length > 8 && // Increased minimum length for better quality
           /[.!?]$/.test(trimmed) && // Must end with proper punctuation
           !trimmed.includes('...') && // Avoid ellipsis fragments
           trimmed.split(' ').length > 2; // Must have at least 3 words
  });
} 