// src/lib/streamingUtils.ts
import { globalAudioManager } from './globalAudioManager';
import { 
  createVoiceBatchingDelay
} from './voiceConsistency';
import { scheduleOverlays, convertStoredExpressionsToClips } from './expressionScheduler';
import { ExpressionAudioMixer, createExpressionMixer } from './expressionAudioMixer';
import { StoredExpression } from './services/expressionStorageService';
import { ExpressionBufferManager, getGlobalBufferManager } from './expressionBufferManager';
import { isFeatureEnabled } from './featureFlags';
import { mobileAudioContextManager, isMobileSafari } from './mobileAudioContextManager';
import { SimpleExpressionPlayer } from './simpleExpressionPlayer';
import { UniversalExpressionService } from './services/universalExpressionService';
// Task 8: Story integration imports
import { UserStoryService } from './services/userStoryService';
import { globalStoryAudioManager } from './services/storyAudioManager';
// Task 10: Performance monitoring
import StoryMetricsCollector from './services/storyMetrics';

export interface StreamingAudioManager {
  addSentence: (sentence: string) => Promise<void>;
  addPhrase: (phrase: string) => Promise<void>; // New: for smaller chunks
  interject: (phrase?: string) => Promise<void>; // New: for immediate interjections
  addThinkingSound: () => Promise<void>; // New: for thinking/buffering states
  stop: () => void;
  isPlaying: () => boolean;
  // Expression system integration
  setExpressionPack: (clips: StoredExpression[], buffers: Map<string, AudioBuffer>) => void;
  enableExpressions: (enabled: boolean) => void;
  // Story integration (Task 8)
  checkForStoryTrigger: (text: string, avatarId: string) => Promise<boolean>;
  replaceWithStory: (text: string, avatarId: string) => Promise<boolean>;
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
  private metricsCollector = StoryMetricsCollector.getInstance();
  
  // Expression system integration
  private expressionClips: StoredExpression[] = [];
  private expressionBuffers = new Map<string, AudioBuffer>();
  private expressionMixer: ExpressionAudioMixer | null = null;
  private expressionsEnabled = false;
  private bufferManager: ExpressionBufferManager | null = null;
  
  // Simple expression system (fallback)
  private simpleExpressionPlayer: SimpleExpressionPlayer | null = null;

  private expressionPlayerPromise: Promise<void> | null = null;
  
  // Task 8: Story integration properties
  private storyService: UserStoryService | null = null;
  private avatarId?: string;

  constructor(voiceId: string, voiceSettings?: any, accent?: string, conversationId?: string, avatarId?: string) {
    this.voiceId = voiceId;
    this.voiceSettings = voiceSettings;
    this.accent = accent;
    this.conversationId = conversationId;
    this.avatarId = avatarId;
    
    // Initialize expression system if feature is enabled
    this.initializeExpressionSystem();
    
    // Initialize universal expression player for any avatar and store the promise
    this.expressionPlayerPromise = this.initializeUniversalExpressions(avatarId || 'default');
    
    // Task 8: Initialize story service if feature is enabled
    this.initializeStoryService();
  }

  /**
   * Task 8: Initialize story service if feature is enabled
   */
  private initializeStoryService(): void {
    if (!isFeatureEnabled('STORIES_ENABLED')) {
      console.log('[AudioQueue] Stories disabled by feature flag');
      return;
    }

    try {
      this.storyService = new UserStoryService();
      console.log('[AudioQueue] 📖 Story service initialized');
    } catch (error) {
      console.warn('[AudioQueue] Failed to initialize story service:', error);
      // Continue without story service - graceful degradation
    }
  }

  /**
   * Initialize universal expression player for any avatar
   */
  private async initializeUniversalExpressions(avatarId: string): Promise<void> {
    try {
      console.log(`[AudioQueue] 🎭 Initializing universal expression player for avatar ${avatarId}...`);
      this.simpleExpressionPlayer = await UniversalExpressionService.createExpressionPlayer(avatarId);
      if (this.simpleExpressionPlayer) {
        console.log(`[AudioQueue] 🎭 ✅ Universal expression player initialized for avatar ${avatarId}`);
        
        // Verify concurrent audio playback capability
        const canPlayConcurrent = this.simpleExpressionPlayer.verifyConcurrentPlayback();
        console.log(`[AudioQueue] 🎭 Concurrent playback capability: ${canPlayConcurrent ? '✅ Verified' : '❌ Failed'}`);
        
        // Verify AudioContext sharing (expressions should use same context as TTS for Mobile Safari compatibility)
        const expressionAudioContext = this.simpleExpressionPlayer.getAudioContext();
        if (expressionAudioContext) {
          console.log(`[AudioQueue] 🎭 ✅ Expression AudioContext ready: ${expressionAudioContext.state} (${expressionAudioContext.sampleRate}Hz)`);
          console.log(`[AudioQueue] 🎭 ✅ TTS and expressions will share AudioContext for Mobile Safari compatibility`);
        }
      } else {
        console.log(`[AudioQueue] 🎭 ❌ Expression player not available for avatar ${avatarId}`);
      }
    } catch (error) {
      console.warn(`[AudioQueue] 🎭 ❌ Failed to initialize universal expressions for ${avatarId}:`, error);
    }
  }

  /**
   * Ensure expression player is ready (wait for async initialization if needed)
   */
  private async ensureExpressionPlayerReady(): Promise<boolean> {
    // If already initialized, return immediately
    if (this.simpleExpressionPlayer) {
      // Only log once to avoid spam
      return true;
    }

    // Wait for the initialization promise to complete
    if (this.expressionPlayerPromise) {
      try {
        await this.expressionPlayerPromise;
        console.log(`[AudioQueue] 🎭 Expression player initialization completed: ${this.simpleExpressionPlayer ? '✅ Ready' : '❌ Failed'}`);
      } catch (error) {
        console.warn(`[AudioQueue] 🎭 Expression player initialization failed:`, error);
      }
    }

    const isReady = !!this.simpleExpressionPlayer;
    console.log(`[AudioQueue] 🎭 Expression player ready: ${isReady ? '✅ Ready' : '❌ Not ready'}`);
    return isReady;
  }

  /**
   * Initialize expression system (mixer and buffer manager)
   * Task 5: Enable expression overlays with quality constraints
   * Task 6: Add expression buffer preloading to StreamingAudioManager initialization
   */
  private async initializeExpressionSystem(): Promise<void> {
    if (!isFeatureEnabled('EXPRESSION_OVERLAYS_ENABLED')) {
      console.log('[AudioQueue] Expression overlays disabled by feature flag (Task 5)');
      return;
    }

    try {
      // Task 6: Initialize buffer manager for preloading and validation
      this.bufferManager = await getGlobalBufferManager({
        maxBuffers: 50,
        maxMemoryBytes: 50 * 1024 * 1024, // 50MB
        enableValidation: true,
        loadTimeoutMs: 10000,
        maxConcurrentLoads: 5
      });

      // Task 5: Initialize expression mixer with quality constraints
      this.expressionMixer = await createExpressionMixer({
        masterVolume: 1.0,
        duckingAmount: 0.4,              // Task 5: 0.4 ducking level (3-6dB reduction)
        fadeDurationMs: 50,
        maxExpressionDurationMs: 300,    // Enforce 300ms limit
        maxOverlaysPer10s: 2,           // Task 5: Maximum 2 overlays per 10-second window
        enableQualityValidation: true    // Task 5: Enable LUFS and peak validation
      });
      
      if (this.expressionMixer && this.bufferManager) {
        this.expressionsEnabled = true;
        console.log('[AudioQueue] Expression system initialized successfully (Task 5 & 6: quality constraints and buffer management enabled)');
      }
    } catch (error) {
      console.warn('[AudioQueue] Failed to initialize expression system:', error);
      // Graceful degradation - continue without expressions
    }
  }

  /**
   * Set expression pack for overlay playback
   * Task 6: Enhanced with buffer validation and error handling
   */
  setExpressionPack(clips: StoredExpression[], buffers: Map<string, AudioBuffer>): void {
    if (!isFeatureEnabled('EXPRESSION_OVERLAYS_ENABLED')) {
      console.log('[AudioQueue] Expression overlays disabled by feature flag, pack loaded but not active');
      // Still store the pack for future activation, but don't enable overlays
      this.expressionClips = clips;
      this.expressionBuffers = buffers;
      return;
    }
    
    this.expressionClips = clips;
    
    // Task 6: Validate buffers before storing
    const validatedBuffers = new Map<string, AudioBuffer>();
    let validBufferCount = 0;
    let invalidBufferCount = 0;
    
    for (const [id, buffer] of buffers) {
      if (this.validateBuffer(buffer)) {
        validatedBuffers.set(id, buffer);
        validBufferCount++;
      } else {
        console.warn(`[AudioQueue] Invalid buffer for expression ${id}, skipping`);
        invalidBufferCount++;
      }
    }
    
    this.expressionBuffers = validatedBuffers;
    
    console.log(`[AudioQueue] Expression pack set: ${clips.length} clips, ${validBufferCount} valid buffers${invalidBufferCount > 0 ? `, ${invalidBufferCount} invalid buffers skipped` : ''}`);
  }

  /**
   * Enable or disable expression overlays
   */
  enableExpressions(enabled: boolean): void {
    this.expressionsEnabled = enabled && isFeatureEnabled('EXPRESSION_OVERLAYS_ENABLED');
    console.log(`[AudioQueue] Expressions ${this.expressionsEnabled ? 'enabled' : 'disabled'} (feature flag: ${isFeatureEnabled('EXPRESSION_OVERLAYS_ENABLED')})`);
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
      console.warn('[AudioQueue] Story trigger check failed:', error);
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
        console.log('[AudioQueue] 📖 No matching story found for text:', text.substring(0, 50));
        return false;
      }

      console.log(`[AudioQueue] 📖 Story selected: "${selectedStory.title}" for text: "${text.substring(0, 50)}"`);

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
        console.log(`[AudioQueue] 📖 ✅ Story playback successful: ${selectedStory.title}`);
        
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
        console.log(`[AudioQueue] 📖 ❌ Story playback failed: ${result.error_message}`);
        
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
      console.error('[AudioQueue] Story replacement failed:', error);
      return false;
    }
  }

  /**
   * Task 8: Create a StreamingAudioManager interface for StoryAudioManager
   */
  private createStreamingManagerInterface(): any {
    return {
      stop: () => this.stop(),
      isPlaying: () => this.getIsPlaying(),
      addSentence: (sentence: string) => this.addSentence(sentence),
      addPhrase: (phrase: string) => this.addPhrase(phrase),
      interject: (phrase?: string) => this.interject(phrase),
      addThinkingSound: () => this.addThinkingSound(),
      setExpressionPack: (clips: any[], buffers: Map<string, AudioBuffer>) => this.setExpressionPack(clips, buffers),
      enableExpressions: (enabled: boolean) => this.enableExpressions(enabled),
      checkForStoryTrigger: (text: string, avatarId: string) => this.checkForStoryTrigger(text),
      replaceWithStory: (text: string, avatarId: string) => this.replaceWithStory(text)
    };
  }

  /**
   * Validate audio buffer format and basic properties
   * Task 6: Create expression buffer validation and format checking
   */
  private validateBuffer(buffer: AudioBuffer): boolean {
    try {
      // Basic validation checks
      if (!buffer || buffer.duration <= 0) {
        return false;
      }
      
      if (buffer.duration > 5.0) { // 5 second limit
        return false;
      }
      
      if (buffer.sampleRate < 16000) { // Minimum 16kHz
        return false;
      }
      
      if (buffer.numberOfChannels < 1 || buffer.numberOfChannels > 2) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.warn('[AudioQueue] Buffer validation error:', error);
      return false;
    }
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
    
    // Task 8: Check for story triggers before adding to TTS queue
    if (type === 'sentence' && isFeatureEnabled('STORIES_ENABLED')) {
      const hasStoryTrigger = await this.checkForStoryTrigger(trimmedText);
      
      if (hasStoryTrigger) {
        console.log(`[AudioQueue] 📖 Story trigger detected for: "${trimmedText.substring(0, 30)}..."`);
        
        // Attempt to replace with story (Option A: complete TTS replacement)
        const storyReplaced = await this.replaceWithStory(trimmedText);
        
        if (storyReplaced) {
          console.log(`[AudioQueue] 📖 ✅ TTS replaced with story for: "${trimmedText.substring(0, 30)}..."`);
          // Mark as processed to avoid duplicate handling
          this.sentenceHashes.add(textHash);
          this.processedSentences.add(trimmedText);
          return; // Story handled the text, don't add to TTS queue
        } else {
          console.log(`[AudioQueue] 📖 ⚠️ Story replacement failed, falling back to TTS: "${trimmedText.substring(0, 30)}..."`);
          // Continue with normal TTS processing as fallback
        }
      }
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
        // Schedule expressions BEFORE playing TTS to ensure no delay
        // This runs in parallel and doesn't block TTS start
        const expressionPromise = this.scheduleExpressions(text);
        
        // Play TTS audio first
        await this.playAudioBuffer(audioBuffer);
        
        // THEN play expressions sequentially for a cleaner sound
        console.log(`[AudioQueue] 🎭 ATTEMPTING TO PLAY EXPRESSIONS AFTER TTS for text: "${text}"`);
        
        // Check feature flag before attempting expression playback
        if (isFeatureEnabled('EXPRESSION_OVERLAYS_ENABLED')) {
          // Ensure expression player is ready before attempting to play
          const playerReady = await this.ensureExpressionPlayerReady();
          
          if (playerReady && this.simpleExpressionPlayer) {
            console.log(`[AudioQueue] 🎭 ✅ Expression player ready, playing expression after TTS`);
            // Add a small pause, then play expression
            await new Promise(resolve => setTimeout(resolve, 200)); // 200ms pause
            await this.simpleExpressionPlayer.playExpressionsForText(text);
          } else {
            console.log(`[AudioQueue] 🎭 ❌ Expression player not ready or not available`);
            console.log(`[AudioQueue] 🎭 Player exists: ${!!this.simpleExpressionPlayer}, Ready: ${playerReady}`);
          }
        } else {
          console.log(`[AudioQueue] 🎭 Expression overlays disabled by feature flag`);
        }
        
        // Wait for expression scheduling to complete (non-blocking)
        await expressionPromise;
        
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

  /**
   * Schedule expression overlays for the given text (non-blocking)
   * Task 5: Connect expression scheduling to TTS streaming without blocking audio start
   * Task 6: Enhanced with buffer validation and error handling
   */
  private async scheduleExpressions(text: string): Promise<void> {
    // Early return if expressions are disabled or not available
    if (!this.expressionsEnabled || 
        !this.expressionMixer || 
        !this.expressionMixer.isReady() ||
        this.expressionClips.length === 0) {
      return;
    }

    try {
      // Convert stored expressions to scheduler format
      const clips = convertStoredExpressionsToClips(this.expressionClips);

      // Task 5: Schedule overlays with quality constraints - max 2 overlays per 10s window, 0.4 ducking
      const schedules = scheduleOverlays(text, clips, {
        maxOverlays: 2,        // Task 5: Maximum 2 overlays per 10-second window
        minSpacingMs: 4000,    // Minimum 4 seconds between overlays
        duckingAmount: 0.4     // Task 5: 0.4 ducking level (3-6dB reduction)
      });

      if (schedules.length > 0) {
        // Task 6: Validate that required buffers are available before scheduling
        const validatedBuffers = new Map<string, AudioBuffer>();
        let availableSchedules = 0;
        
        for (const schedule of schedules) {
          const buffer = this.expressionBuffers.get(schedule.clip.id);
          if (buffer && this.validateBuffer(buffer)) {
            validatedBuffers.set(schedule.clip.id, buffer);
            availableSchedules++;
          } else {
            console.warn(`[AudioQueue] Buffer not ready or invalid for expression ${schedule.clip.id}, skipping`);
          }
        }
        
        if (availableSchedules > 0) {
          console.log(`[AudioQueue] Scheduling ${availableSchedules}/${schedules.length} expression overlays for: "${text.substring(0, 30)}..." (Task 5 & 6: quality constraints and buffer validation enabled)`);
          
          // Task 5: Play overlays with quality validation and normalization (-14 LUFS, true-peak < -1 dBTP)
          // Task 6: Use validated buffers only
          await this.expressionMixer.playExpressionOverlays(
            schedules.filter(s => validatedBuffers.has(s.clip.id)),
            validatedBuffers,
            0, // Start immediately relative to TTS - no blocking
            {
              sessionId: this.conversationId || 'default',
              ownerId: 'jonathan-demo',
              ownerType: 'avatar',
              skipExpressions: false,
              disabledExpressions: new Set<string>(),
              temporaryDisableUntil: undefined,

              // globalVolume: 1.0 // Removed - not part of PlaybackContext interface
            }
          );
        } else {
          console.log(`[AudioQueue] No valid buffers available for expression overlays (Task 6: graceful degradation)`);
        }
      }
    } catch (error) {
      // Task 6: Graceful degradation - log error but don't break TTS flow
      console.warn('[AudioQueue] Expression scheduling failed (Task 5 & 6):', error);
    }
  }

  private async synthesizeWithContext(text: string): Promise<ArrayBuffer> {
    const ttsStartTime = Date.now();
    
    try {
      // Add batching delay to reduce voice variation
      await createVoiceBatchingDelay();
      
      // Use enhanced voice configuration for premium quality
      const response = await fetch('/api/voice-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text, // Send text for TTS synthesis
          avatar: 'jonathan-demo', // Use jonathan-demo avatar for voice resolution
          useEnhancedQuality: true, // Enable enhanced voice configuration
          conversationId: this.conversationId || 'default',
          normalizeAudio: true // Enable audio normalization for consistent levels
          }),
      });

      if (!response.ok) {
        throw new Error(`Voice synthesis failed: ${response.status}`);
      }

      const audioBuffer = await response.arrayBuffer();
      
      // Track TTS performance metrics
      const avatarId = 'jonathan-demo'; // TODO: Make this dynamic based on actual avatar
      const storySystemEnabled = isFeatureEnabled('STORIES_ENABLED');
      this.metricsCollector.trackTtsFirstChunk(avatarId, ttsStartTime, storySystemEnabled);
      
      return audioBuffer;
      
    } catch (error) {
      // Track TTS failure
      const avatarId = 'jonathan-demo';
      const storySystemEnabled = isFeatureEnabled('STORIES_ENABLED');
      this.metricsCollector.trackTtsFirstChunk(avatarId, ttsStartTime, storySystemEnabled);
      
      throw error;
    }
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
    // Task 9: Ensure mobile Safari audio context is ready before playing
    if (isMobileSafari()) {
      const isReady = await mobileAudioContextManager.ensureReady();
      if (!isReady) {
        throw new Error('Mobile Safari audio context not ready - user gesture required');
      }
    }

    return new Promise((resolve, reject) => {
      const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      
      // Task 9: Use mobile-optimized audio creation
      const audio = isMobileSafari() 
        ? globalAudioManager.createOptimizedAudio(audioUrl)
        : new Audio(audioUrl);
      
      // Play at natural speed for better voice quality
      audio.playbackRate = 1.0;
      audio.volume = 1.0;
      
      // Task 9: Mobile Safari specific optimizations
      if (isMobileSafari()) {
        audio.playsInline = true;
        audio.muted = false;
        audio.preload = 'auto';
      }
      
      this.currentAudio = audio;
      
      const cleanup = () => {
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
      };
      
      audio.onended = () => {
        cleanup();
        resolve();
      };
      
      audio.onerror = (error) => {
        cleanup();
        console.error('[AudioQueue] Audio playback error:', error);
        
        // Task 9: Mobile Safari fallback handling
        if (isMobileSafari()) {
          console.warn('[AudioQueue] Mobile Safari audio error, attempting fallback');
          // Try again with a small delay
          setTimeout(() => {
            audio.play().catch((fallbackError) => {
              console.error('[AudioQueue] Mobile Safari fallback failed:', fallbackError);
              reject(fallbackError);
            });
          }, 100);
        } else {
          reject(error);
        }
      };
      
      // Task 9: Enhanced error handling for mobile Safari
      const playPromise = audio.play();
      if (playPromise) {
        playPromise.catch((error) => {
          cleanup();
          
          // Task 9: Specific handling for mobile Safari play failures
          if (isMobileSafari() && error.name === 'NotAllowedError') {
            console.warn('[AudioQueue] Mobile Safari play not allowed, audio context may need user gesture');
            reject(new Error('Mobile Safari requires user gesture for audio playback'));
          } else {
            reject(error);
          }
        });
      }
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
    
    // Stop all expression overlays
    if (this.expressionMixer) {
      this.expressionMixer.stopAllExpressions();
    }
    
    // Task 6: Clean up expression buffers to free memory
    this.expressionBuffers.clear();
    this.expressionClips = [];
    
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
    avatarId?: string;
    expressionPack?: {
      expressions: StoredExpression[];
      buffers: Map<string, AudioBuffer>;
    };
  } = {}
): StreamingAudioManager {
  const audioQueue = new AudioQueue(voiceId, voiceSettings, accent, options.conversationId, options.avatarId);

  // Set expression pack if provided (infrastructure ready, but overlays controlled by feature flag)
  if (options.expressionPack) {
    audioQueue.setExpressionPack(options.expressionPack.expressions, options.expressionPack.buffers);
    
    // Enable expressions only if feature flag is enabled
    const expressionsEnabled = isFeatureEnabled('EXPRESSION_OVERLAYS_ENABLED');
    audioQueue.enableExpressions(expressionsEnabled);
    
    console.log(`[StreamingAudioManager] Expression pack loaded: ${options.expressionPack.expressions.length} expressions, overlays ${expressionsEnabled ? 'enabled' : 'disabled'}`);
  }

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
    },

    setExpressionPack(clips: StoredExpression[], buffers: Map<string, AudioBuffer>) {
      audioQueue.setExpressionPack(clips, buffers);
    },

    enableExpressions(enabled: boolean) {
      audioQueue.enableExpressions(enabled);
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