// src/lib/streamingUtils.ts
import { globalAudioManager } from './globalAudioManager';
import { 
  createVoiceBatchingDelay, 
  getMaxConsistencySettings,
  normalizeTextForVoice 
} from './voiceConsistency';

export interface StreamingAudioManager {
  addSentence: (sentence: string) => Promise<void>;
  addPhrase: (phrase: string) => Promise<void>; // New: for smaller chunks
  interject: (phrase?: string) => Promise<void>; // New: for immediate interjections
  addThinkingSound: () => Promise<void>; // New: for thinking/buffering states
  stop: () => void;
  isPlaying: () => boolean;
}

export class AudioQueue {
  private queue: string[] = [];
  private isPlaying = false;
  private currentAudio: HTMLAudioElement | null = null;
  private isDestroyed = false;
  private voiceId: string;
  private voiceSettings?: any;
  private accent?: string;
  private processedSentences = new Set<string>(); // Track processed sentences
  private sentenceHashes = new Set<string>(); // Track sentence hashes for better duplicate detection
  private isFetchingNext = false; // Track if we're prefetching next audio
  private audioCache = new Map<string, ArrayBuffer>(); // Cache for prefetched audio
  private conversationId?: string; // For consistent voice generation
  private previousContext = ''; // Track previous text for context
  private interjectionPhrases = [
    "Alright...", "Let's see...", "Hmm...", "Okay...", "Well...", 
    "So...", "Right...", "Now...", "Actually..."
  ];

  constructor(voiceId: string, voiceSettings?: any, accent?: string, conversationId?: string) {
    this.voiceId = voiceId;
    this.voiceSettings = voiceSettings;
    this.accent = accent;
    this.conversationId = conversationId;
  }

  async addSentence(sentence: string) {
    return this.addText(sentence, 'sentence');
  }

  async addPhrase(phrase: string) {
    return this.addText(phrase, 'phrase');
  }

  private async addText(text: string, type: 'sentence' | 'phrase') {
    if (this.isDestroyed) return;
    
    const trimmedText = text.trim();
    if (!trimmedText) return;
    
    // Create a simple hash to detect duplicates more reliably
    const textHash = trimmedText.toLowerCase().replace(/[^\w]/g, '');
    
    // Avoid duplicate text using hash
    if (this.sentenceHashes.has(textHash)) {
      console.log(`[AudioQueue] Skipping duplicate ${type}: "${trimmedText.substring(0, 30)}..."`);
      return;
    }
    
    this.sentenceHashes.add(textHash);
    this.processedSentences.add(trimmedText);
    this.queue.push(trimmedText);
    console.log(`[AudioQueue] Added ${type}: "${trimmedText.substring(0, 30)}..." Queue: ${this.queue.length}`);
    
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  async interject(phrase?: string) {
    if (this.isDestroyed) return;
    
    const interjection = phrase || this.interjectionPhrases[Math.floor(Math.random() * this.interjectionPhrases.length)];
    
    // Add interjection to front of queue for immediate playback
    this.queue.unshift(interjection);
    console.log(`[AudioQueue] Added interjection: "${interjection}"`);
    
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  async addThinkingSound() {
    if (this.isDestroyed) return;
    
    // Add a subtle thinking sound or breath
    const thinkingSounds = ["*thinking*", "*hmm*", "*pause*"];
    const sound = thinkingSounds[Math.floor(Math.random() * thinkingSounds.length)];
    
    // For now, we'll use a short interjection instead of actual sound effects
    // In a full implementation, you could load actual audio files here
    this.queue.unshift("Hmm...");
    console.log(`[AudioQueue] Added thinking sound`);
    
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  private async playNext() {
    if (this.isDestroyed || this.queue.length === 0) {
      this.isPlaying = false;
      this.isFetchingNext = false;
      return;
    }

    this.isPlaying = true;
    const text = this.queue.shift()!;
    console.log(`[AudioQueue] Processing: "${text.substring(0, 30)}..." Remaining: ${this.queue.length}`);
    
    // Start prefetching next audio while current one plays
    this.prefetchNextAudio();
    
    try {
      let audioBuffer: ArrayBuffer;
      
      // Check if we have cached audio for this text
      const cacheKey = this.getCacheKey(text);
      if (this.audioCache.has(cacheKey)) {
        audioBuffer = this.audioCache.get(cacheKey)!;
        this.audioCache.delete(cacheKey); // Remove from cache after use
        console.log(`[AudioQueue] Using cached audio for: "${text.substring(0, 30)}..."`);
      } else {
        // Synthesize audio with context for consistency
        audioBuffer = await this.synthesizeWithContext(text);
      }

      if (audioBuffer.byteLength > 0) {
        await this.playAudioBuffer(audioBuffer);
        // Update context for next synthesis
        this.previousContext += ' ' + text;
        // Keep context manageable (last 200 characters)
        if (this.previousContext.length > 200) {
          this.previousContext = this.previousContext.substring(this.previousContext.length - 200);
        }
      }
    } catch (error) {
      console.error('Failed to process text:', text, error);
    }
    
    // Continue immediately to next text
    if (!this.isDestroyed) {
      this.playNext();
    }
  }

  private async synthesizeWithContext(text: string): Promise<ArrayBuffer> {
    // Add batching delay to reduce voice variation
    await createVoiceBatchingDelay();
    
    // Normalize text for consistency
    const normalizedText = normalizeTextForVoice(text);
    
    const response = await fetch('/api/voice-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sentence: normalizedText,
        voiceId: this.voiceId,
        settings: getMaxConsistencySettings(), // Use maximum consistency settings
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

  private async prefetchNextAudio() {
    if (this.isFetchingNext || this.queue.length === 0 || this.isDestroyed) {
      return;
    }

    this.isFetchingNext = true;
    const nextText = this.queue[0];
    const cacheKey = this.getCacheKey(nextText);
    
    // Don't prefetch if already cached
    if (this.audioCache.has(cacheKey)) {
      this.isFetchingNext = false;
      return;
    }

    try {
      console.log(`[AudioQueue] Prefetching audio for: "${nextText.substring(0, 30)}..."`);
      
      const audioBuffer = await this.synthesizeWithContext(nextText);
      if (audioBuffer.byteLength > 0) {
        this.audioCache.set(cacheKey, audioBuffer);
        console.log(`[AudioQueue] Cached audio for: "${nextText.substring(0, 30)}..."`);
      }
    } catch (error) {
      console.error('Failed to prefetch audio:', error);
    } finally {
      this.isFetchingNext = false;
    }
  }

  private getCacheKey(text: string): string {
    return `${this.voiceId}-${text.substring(0, 100)}-${JSON.stringify(this.voiceSettings)}-${this.accent}`;
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
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        reject(error);
      };
      
      audio.play().catch(reject);
    });
  }

  stop() {
    this.isDestroyed = true;
    this.queue.length = 0;
    this.processedSentences.clear();
    this.sentenceHashes.clear();
    this.audioCache.clear(); // Clear prefetched audio cache
    this.isFetchingNext = false;
    this.previousContext = ''; // Reset context
    
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
  accent?: string,
  options: {
    useWebAudio?: boolean;
    enableCrossfade?: boolean;
    conversationId?: string;
  } = {}
): StreamingAudioManager {
  const audioQueue = new AudioQueue(voiceId, voiceSettings, accent, options.conversationId);

  const manager: StreamingAudioManager = {
    async addSentence(sentence: string) {
      await audioQueue.addSentence(sentence);
    },

    async addPhrase(phrase: string) {
      await audioQueue.addPhrase(phrase);
    },

    async interject(phrase?: string) {
      await audioQueue.interject(phrase);
    },

    async addThinkingSound() {
      await audioQueue.addThinkingSound();
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

export function splitIntoPhrases(text: string): string[] {
  // Split into smaller, more natural speaking chunks
  // This creates more human-like pauses and reduces latency
  const phrases = text
    // Split on sentence endings first
    .split(/(?<=[.!?])\s+/)
    // Then split long sentences on natural pause points
    .flatMap(sentence => {
      if (sentence.length < 50) return [sentence];
      
      // Split on commas, semicolons, and conjunctions for natural pauses
      return sentence
        .split(/(?<=[,;])\s+|(?:\s+(?:and|but|or|so|yet|for|nor|because|although|though|while|since|if|when|where|after|before|until)\s+)/)
        .filter(phrase => phrase.trim().length > 0);
    })
    .map(phrase => phrase.trim())
    .filter(phrase => phrase.length > 0);
  
  return phrases;
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