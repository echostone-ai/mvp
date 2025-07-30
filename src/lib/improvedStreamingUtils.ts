// src/lib/improvedStreamingUtils.ts
import { globalAudioManager } from './globalAudioManager';
import { getNaturalVoiceSettings } from './naturalVoiceSettings';

export interface ImprovedStreamingAudioManager {
  addText: (text: string, isComplete?: boolean) => Promise<void>;
  addSentence: (sentence: string) => Promise<void>;
  addPhrase: (phrase: string) => Promise<void>;
  interject: (phrase?: string) => Promise<void>;
  stop: () => void;
  isPlaying: () => boolean;
  flush: () => Promise<void>; // New: force process remaining text
}

export class ImprovedAudioQueue {
  private textBuffer = ''; // Buffer for incomplete text
  private sentenceQueue: string[] = [];
  private isPlaying = false;
  private currentAudio: HTMLAudioElement | null = null;
  private isDestroyed = false;
  private voiceId: string;
  private voiceSettings?: any;
  private accent?: string;
  private conversationId?: string;
  private previousContext = '';
  private processingPromise: Promise<void> | null = null;
  private flushTimeout: NodeJS.Timeout | null = null;
  private lastProcessedLength = 0;

  constructor(voiceId: string, voiceSettings?: any, accent?: string, conversationId?: string) {
    this.voiceId = voiceId;
    this.voiceSettings = voiceSettings;
    this.accent = accent;
    this.conversationId = conversationId;
  }

  async addText(text: string, isComplete: boolean = false) {
    if (this.isDestroyed) return;
    
    const trimmedText = text.trim();
    if (!trimmedText) return;
    
    // Add to buffer
    this.textBuffer += (this.textBuffer ? ' ' : '') + trimmedText;
    
    // Process text immediately for better responsiveness
    await this.processTextBuffer(isComplete);
    
    // If complete, flush any remaining text
    if (isComplete) {
      await this.flush();
    }
  }

  async addSentence(sentence: string) {
    if (this.isDestroyed) return;
    
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) return;
    
    // Add sentence directly to queue for immediate processing
    this.sentenceQueue.push(trimmedSentence);
    
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  async addPhrase(phrase: string) {
    await this.addSentence(phrase);
  }

  async interject(phrase?: string) {
    if (this.isDestroyed) return;
    
    const interjection = phrase || "Alright...";
    
    // Add interjection to front of queue for immediate playback
    this.sentenceQueue.unshift(interjection);
    
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  async flush() {
    if (this.isDestroyed || !this.textBuffer.trim()) return;
    
    // Process any remaining text in buffer
    await this.processTextBuffer(true);
    
    // Clear any pending flush timeout
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
  }

  private async processTextBuffer(isComplete: boolean) {
    if (!this.textBuffer.trim()) return;
    
    // Split text into sentences more aggressively
    const sentences = this.splitIntoSentences(this.textBuffer);
    
    if (sentences.length === 0) return;
    
    // If we have multiple sentences or this is complete, process all but the last
    const sentencesToProcess = isComplete ? sentences : sentences.slice(0, -1);
    const remainingText = isComplete ? '' : sentences[sentences.length - 1];
    
    // Add sentences to queue
    for (const sentence of sentencesToProcess) {
      const trimmedSentence = sentence.trim();
      if (trimmedSentence && trimmedSentence.length > 5) { // Reduced minimum length
        this.sentenceQueue.push(trimmedSentence);
      }
    }
    
    // Update buffer with remaining text
    this.textBuffer = remainingText;
    
    // Start playing if not already playing
    if (!this.isPlaying) {
      this.playNext();
    }
    
    // If not complete, set a timeout to flush remaining text
    if (!isComplete && this.textBuffer.trim()) {
      if (this.flushTimeout) {
        clearTimeout(this.flushTimeout);
      }
      this.flushTimeout = setTimeout(() => {
        this.flush();
      }, 2000); // Flush after 2 seconds of inactivity
    }
  }

  private splitIntoSentences(text: string): string[] {
    // More aggressive sentence splitting
    const sentences = text.split(/(?<=[.!?])\s+/);
    
    // If no sentence endings found, split on natural breaks
    if (sentences.length === 1 && sentences[0] === text) {
      // Split on commas, semicolons, or natural pauses
      return text.split(/(?<=[,;:])\s+/).filter(s => s.trim().length > 0);
    }
    
    return sentences.filter(s => s.trim().length > 0);
  }

  private async playNext() {
    if (this.isDestroyed || this.sentenceQueue.length === 0) {
      this.isPlaying = false;
      console.log(`[ImprovedAudioQueue] Queue empty or destroyed, stopping playback`);
      return;
    }

    this.isPlaying = true;
    const text = this.sentenceQueue.shift()!;
    
    console.log(`[ImprovedAudioQueue] Processing: "${text.substring(0, 50)}..." Remaining: ${this.sentenceQueue.length}, Queue size: ${this.sentenceQueue.length}`);
    
    try {
      const audioBuffer = await this.synthesizeAudio(text);
      
      if (audioBuffer.byteLength > 0) {
        console.log(`[ImprovedAudioQueue] Audio buffer size: ${audioBuffer.byteLength} bytes, playing audio...`);
        await this.playAudioBuffer(audioBuffer);
        console.log(`[ImprovedAudioQueue] Audio playback completed for: "${text.substring(0, 30)}..."`);
        
        // Update context for next synthesis
        this.previousContext += ' ' + text;
        if (this.previousContext.length > 200) {
          this.previousContext = this.previousContext.substring(this.previousContext.length - 200);
        }
      } else {
        console.warn(`[ImprovedAudioQueue] Empty audio buffer for text: "${text.substring(0, 30)}..."`);
      }
    } catch (error) {
      console.error('Failed to process text:', text, error);
    }
    
    // Continue to next text immediately
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
        settings: this.voiceSettings || getNaturalVoiceSettings(),
        accent: this.accent,
        conversationId: this.conversationId || 'default',
        previousContext: this.previousContext
      }),
    });

    if (!response.ok) {
      throw new Error(`Voice synthesis failed: ${response.status}`);
    }

    return await response.arrayBuffer();
  }

  private async playAudioBuffer(audioBuffer: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      
      // Optimize for streaming
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
    this.sentenceQueue.length = 0;
    
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    
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

export function createImprovedStreamingAudioManager(
  voiceId: string,
  voiceSettings?: any,
  accent?: string,
  options: {
    conversationId?: string;
  } = {}
): ImprovedStreamingAudioManager {
  const audioQueue = new ImprovedAudioQueue(voiceId, voiceSettings, accent, options.conversationId);

  const manager: ImprovedStreamingAudioManager = {
    async addText(text: string, isComplete: boolean = false) {
      await audioQueue.addText(text, isComplete);
    },

    async addSentence(sentence: string) {
      await audioQueue.addSentence(sentence);
    },

    async addPhrase(phrase: string) {
      await audioQueue.addPhrase(phrase);
    },

    async interject(phrase?: string) {
      await audioQueue.interject(phrase);
    },

    async flush() {
      await audioQueue.flush();
    },

    stop() {
      audioQueue.stop();
      activeImprovedManagers.delete(manager);
    },

    isPlaying() {
      return audioQueue.isPlaying();
    }
  };

  // Register this manager
  activeImprovedManagers.add(manager);
  
  return manager;
}

// Keep track of active streaming audio managers
const activeImprovedManagers = new Set<ImprovedStreamingAudioManager>();

// Global function to stop all audio playback
export async function stopAllImprovedAudio() {
  activeImprovedManagers.forEach(manager => {
    manager.stop();
  });
  activeImprovedManagers.clear();
}

// Helper function to split text for streaming
export function splitTextForImprovedStreaming(text: string): string[] {
  // More aggressive splitting that captures incomplete sentences
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  // If no sentence endings, split on natural breaks
  if (sentences.length === 1 && sentences[0] === text) {
    return text.split(/(?<=[,;:])\s+/).filter(s => s.trim().length > 0);
  }
  
  return sentences.filter(s => s.trim().length > 0);
} 