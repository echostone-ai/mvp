// src/lib/seamlessStreamingUtils.ts
import { getNaturalVoiceSettings } from './naturalVoiceSettings';
// Task 8: Story integration imports
import { isFeatureEnabled } from './featureFlags';
import { UserStoryService } from './services/userStoryService';
import { globalStoryAudioManager } from './services/storyAudioManager';

export interface SeamlessStreamingManager {
  addText: (text: string) => Promise<void>;
  complete: () => Promise<void>;
  stop: () => void;
  isPlaying: () => boolean;
  // Task 8: Story integration methods
  checkForStoryTrigger?: (text: string, avatarId: string) => Promise<boolean>;
  replaceWithStory?: (text: string, avatarId: string) => Promise<boolean>;
}

export class SeamlessAudioQueue {
  private textBuffer = '';
  private audioQueue: ArrayBuffer[] = [];
  private isCurrentlyPlaying = false;
  private isDestroyed = false;
  private voiceId: string;
  private voiceSettings: any;
  private conversationId: string;
  private currentAudio: HTMLAudioElement | null = null;
  private processingPromise: Promise<void> | null = null;
  
  // Task 8: Story integration properties
  private storyService: UserStoryService | null = null;
  private avatarId?: string;

  constructor(voiceId: string, voiceSettings?: any, conversationId?: string, avatarId?: string) {
    this.voiceId = voiceId;
    this.voiceSettings = voiceSettings || getNaturalVoiceSettings();
    this.conversationId = conversationId || 'default';
    this.avatarId = avatarId;
    
    // Task 8: Initialize story service if feature is enabled
    this.initializeStoryService();
  }

  /**
   * Task 8: Initialize story service if feature is enabled
   */
  private initializeStoryService(): void {
    if (!isFeatureEnabled('STORIES_ENABLED')) {
      console.log('[SeamlessAudioQueue] Stories disabled by feature flag');
      return;
    }

    try {
      this.storyService = new UserStoryService();
      console.log('[SeamlessAudioQueue] 📖 Story service initialized');
    } catch (error) {
      console.warn('[SeamlessAudioQueue] Failed to initialize story service:', error);
      // Continue without story service - graceful degradation
    }
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

  /**
   * Task 8: Check if text triggers any stories for the avatar
   */
  async checkForStoryTrigger(text: string): Promise<boolean> {
    if (!this.storyService || !this.avatarId || !isFeatureEnabled('STORIES_ENABLED')) {
      return false;
    }

    try {
      const matches = await this.storyService.findMatchingStoriesWithDetails(
        text,
        this.avatarId,
        'avatar'
      );
      
      return matches.length > 0;
    } catch (error) {
      console.warn('[SeamlessAudioQueue] Story trigger check failed:', error);
      return false;
    }
  }

  /**
   * Task 8: Replace TTS with story audio (Option A implementation)
   */
  async replaceWithStory(text: string): Promise<boolean> {
    if (!this.storyService || !this.avatarId || !isFeatureEnabled('STORIES_ENABLED')) {
      return false;
    }

    try {
      // Find the best matching story
      const selectedStory = await this.storyService.selectBestMatchingStory(
        text,
        this.avatarId,
        'avatar'
      );

      if (!selectedStory) {
        console.log('[SeamlessAudioQueue] 📖 No matching story found for text:', text.substring(0, 50));
        return false;
      }

      console.log(`[SeamlessAudioQueue] 📖 Story selected: "${selectedStory.title}" for text: "${text.substring(0, 50)}"`);

      // Use StoryAudioManager to replace TTS with story
      const streamingManager = this.createStreamingManagerInterface();
      const result = await globalStoryAudioManager.replaceNextTTSWithStory(
        selectedStory,
        streamingManager,
        {
          volume_level: 1.0,
          fade_in_ms: 100,
          fade_out_ms: 100
        }
      );

      if (result.success) {
        console.log(`[SeamlessAudioQueue] 📖 ✅ Story playback successful: ${selectedStory.title}`);
        
        // Record usage analytics
        await this.storyService.recordUsage({
          story_id: selectedStory.id,
          session_id: this.conversationId || 'default',
          trigger_text: text,
          matched_keywords: [], // Would be populated by trigger matcher
          confidence_score: 1.0, // Simplified for MVP
          played_successfully: true,
          playback_duration_ms: result.playback_duration_ms
        });

        return true;
      } else {
        console.log(`[SeamlessAudioQueue] 📖 ❌ Story playback failed: ${result.error_message}`);
        
        // Record failed usage
        await this.storyService.recordUsage({
          story_id: selectedStory.id,
          session_id: this.conversationId || 'default',
          trigger_text: text,
          played_successfully: false,
          error_message: result.error_message
        });

        return false;
      }
    } catch (error) {
      console.error('[SeamlessAudioQueue] Story replacement failed:', error);
      return false;
    }
  }

  /**
   * Task 8: Create a StreamingAudioManager interface for StoryAudioManager
   */
  private createStreamingManagerInterface(): any {
    return {
      stop: () => this.stop(),
      isPlaying: () => this.isPlaying(),
      addSentence: (sentence: string) => this.addText(sentence),
      addPhrase: (phrase: string) => this.addText(phrase),
      interject: (phrase?: string) => this.addText(phrase || ''),
      addThinkingSound: () => this.addText('...'),
      setExpressionPack: () => {}, // Not implemented in seamless streaming
      enableExpressions: () => {}, // Not implemented in seamless streaming
      checkForStoryTrigger: (text: string, avatarId: string) => this.checkForStoryTrigger(text),
      replaceWithStory: (text: string, avatarId: string) => this.replaceWithStory(text)
    };
  }

  async complete() {
    if (this.isDestroyed) return;
    
    // Process any remaining text
    if (this.textBuffer.trim()) {
      await this.processBuffer(true);
    }
    
    // Wait for all audio to finish
    while (this.audioQueue.length > 0 || this.isCurrentlyPlaying) {
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
          // Task 8: Check for story triggers before generating TTS
          if (isFeatureEnabled('STORIES_ENABLED')) {
            const hasStoryTrigger = await this.checkForStoryTrigger(trimmedSentence);
            
            if (hasStoryTrigger) {
              console.log(`[SeamlessStreaming] 📖 Story trigger detected for: "${trimmedSentence.substring(0, 50)}..."`);
              
              // Attempt to replace with story (Option A: complete TTS replacement)
              const storyReplaced = await this.replaceWithStory(trimmedSentence);
              
              if (storyReplaced) {
                console.log(`[SeamlessStreaming] 📖 ✅ TTS replaced with story for: "${trimmedSentence.substring(0, 50)}..."`);
                continue; // Story handled the sentence, skip TTS generation
              } else {
                console.log(`[SeamlessStreaming] 📖 ⚠️ Story replacement failed, falling back to TTS: "${trimmedSentence.substring(0, 50)}..."`);
                // Continue with normal TTS processing as fallback
              }
            }
          }
          
          console.log(`[SeamlessStreaming] Generating audio for: "${trimmedSentence.substring(0, 50)}..."`);
          const audioBuffer = await this.generateAudio(trimmedSentence);
          this.audioQueue.push(audioBuffer);
          
          // Start playing if not already playing
          if (!this.isCurrentlyPlaying) {
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
    // Prefer full sentences, but also allow early short phrases to reduce TTFB
    const raw = text.split(/(?<=[.!?])\s+/);
    const results: string[] = [];
    for (const s of raw) {
      const trimmed = s.trim();
      if (!trimmed) continue;
      const isFullSentence = /[.!?]$/.test(trimmed) && !trimmed.includes('...') && trimmed.split(' ').length > 2 && trimmed.length > 8;
      const isEarlyPhrase = !isFullSentence && trimmed.split(' ').length >= 4 && trimmed.length >= 18;
      if (isFullSentence || isEarlyPhrase) results.push(trimmed + (isFullSentence ? '' : '.'));
    }
    return results;
  }

  private async generateAudio(text: string): Promise<ArrayBuffer> {
    const response = await fetch('/api/voice-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        avatar: 'jonathan-demo'
      }),
    });

    if (!response.ok) {
      throw new Error(`Voice generation failed: ${response.status}`);
    }

    return await response.arrayBuffer();
  }

  private async playNext() {
    if (this.isDestroyed || this.audioQueue.length === 0) {
      this.isCurrentlyPlaying = false;
      return;
    }

    this.isCurrentlyPlaying = true;
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
    
    this.isCurrentlyPlaying = false;
  }

  isPlaying() {
    return !this.isDestroyed && this.isCurrentlyPlaying;
  }
}

export function createSeamlessStreamingManager(
  voiceId: string,
  voiceSettings?: any,
  options: {
    conversationId?: string;
    avatarId?: string; // Task 8: Add avatarId for story integration
  } = {}
): SeamlessStreamingManager {
  const audioQueue = new SeamlessAudioQueue(voiceId, voiceSettings, options.conversationId, options.avatarId);

  const manager: SeamlessStreamingManager = {
    async addText(text: string) {
      await audioQueue.addText(text);
    },

    async complete() {
      await audioQueue.complete();
    },

    stop() {
      audioQueue.stop();
      activeManagers.delete(manager);
    },

    isPlaying() {
      return audioQueue.isPlaying();
    },

    // Task 8: Story integration methods
    async checkForStoryTrigger(text: string, avatarId: string) {
      return await audioQueue.checkForStoryTrigger(text);
    },

    async replaceWithStory(text: string, avatarId: string) {
      return await audioQueue.replaceWithStory(text);
    }
  };

  // Register this manager
  activeManagers.add(manager);

  return manager;
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