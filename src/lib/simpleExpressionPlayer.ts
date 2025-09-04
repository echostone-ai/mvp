/**
 * Simple Expression Player
 * A lightweight system to play expression sounds during TTS
 */

export interface SimpleExpression {
  id: string;
  type: string;
  keywords: string[];
  audioUrl: string;
  volume?: number;
}

export class SimpleExpressionPlayer {
  private expressions: SimpleExpression[] = [];
  private audioContext: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer | HTMLAudioElement>();
  private isEnabled = true;
  private lastOverlayTime = 0;
  private readonly OVERLAY_THROTTLE_MS = 8000; // 8 seconds throttle

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  /**
   * Load expressions with audio buffers - preload laugh clip once on initialization
   */
  async loadExpressions(expressions: SimpleExpression[]): Promise<void> {
    this.expressions = expressions;
    
    if (!this.audioContext) {
      console.warn(`🎭 ❌ AudioContext not available for expression loading`);
      return;
    }

    console.log(`🎭 Preloading ${expressions.length} expression clips...`);

    // Load audio buffers with enhanced error handling and preloading verification
    for (const expression of expressions) {
      try {
        console.log(`🎭 Preloading ${expression.type} from ${expression.audioUrl}...`);
        const response = await fetch(expression.audioUrl);
        
        if (!response.ok) {
          console.error(`🎭 ❌ HTTP ${response.status} error loading ${expression.id} from ${expression.audioUrl}`);
          continue;
        }
        
        const arrayBuffer = await response.arrayBuffer();
        console.log(`🎭 Downloaded ${expression.id}: ${arrayBuffer.byteLength} bytes`);
        
        // Try to decode the audio data with better error handling
        try {
          const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
          this.buffers.set(expression.id, audioBuffer);
          console.log(`🎭 ✅ Successfully preloaded ${expression.type}: ${expression.id} (${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.numberOfChannels}ch, ${audioBuffer.sampleRate}Hz)`);
        } catch (decodeError) {
          console.error(`🎭 ❌ Audio decode failed for ${expression.id}:`, decodeError);
          console.error(`🎭 File info: ${arrayBuffer.byteLength} bytes, URL: ${expression.audioUrl}`);
          
          // Try alternative: use HTML Audio element as fallback
          try {
            await this.loadAsHTMLAudio(expression);
            console.log(`🎭 ✅ Fallback HTML Audio preloaded for ${expression.id}`);
          } catch (fallbackError) {
            console.error(`🎭 ❌ HTML Audio fallback also failed for ${expression.id}:`, fallbackError);
          }
        }
      } catch (error) {
        console.error(`🎭 ❌ Complete failure preloading expression ${expression.id}:`, error);
      }
    }
    
    console.log(`🎭 Expression preloading complete: ${this.buffers.size}/${expressions.length} AudioContext buffers loaded`);
    console.log(`🎭 HTML Audio fallbacks: ${this.htmlAudioFallbacks.size} loaded`);
    
    // Verify laugh clip specifically (most important for testing)
    const laughExpression = this.expressions.find(expr => expr.type === 'laugh');
    if (laughExpression && this.buffers.get(laughExpression.id)) {
      const laughBuffer = this.buffers.get(laughExpression.id);
      console.log(`🎭 ✅ Laugh clip verified: ${laughExpression.id} ready for concurrent playback`);
    } else {
      console.warn(`🎭 ⚠️ No laugh expression found, but ${this.buffers.size} other expressions loaded`);
    }
  }

  // Add HTML Audio fallback system
  private htmlAudioFallbacks = new Map<string, HTMLAudioElement>();

  /**
   * Load expression as HTML Audio element (fallback for decode issues)
   */
  private async loadAsHTMLAudio(expression: SimpleExpression): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(expression.audioUrl);
      audio.preload = 'auto';
      
      audio.addEventListener('canplaythrough', () => {
        this.htmlAudioFallbacks.set(expression.id, audio);
        resolve();
      });
      
      audio.addEventListener('error', (e) => {
        reject(new Error(`HTML Audio load failed: ${e}`));
      });
      
      // Trigger loading
      audio.load();
    });
  }

  /**
   * Check text for keywords and play matching expressions
   */
  async playExpressionsForText(text: string): Promise<void> {
    console.log(`🎭 playExpressionsForText called with: "${text}"`);
    console.log(`🎭 isEnabled: ${this.isEnabled}, audioContext: ${!!this.audioContext}`);
    
    if (!this.isEnabled || !this.audioContext) {
      console.log(`🎭 ❌ Early return - isEnabled: ${this.isEnabled}, audioContext: ${!!this.audioContext}`);
      return;
    }

    // Normalize input: lowercase and strip punctuation
    const normalizedText = text.toLowerCase().replace(/[^\w\s]/g, '');
    
    // Check throttle: allow at most 1 overlay per 8 seconds
    const now = Date.now();
    if (now - this.lastOverlayTime < this.OVERLAY_THROTTLE_MS) {
      return;
    }

    // Enhanced natural conversation triggers
    let triggered = false;
    let expressionType = '';

    // Only use expressions that actually exist in your uploaded pack
    
    // Laugh triggers - you have 2 laugh expressions
    if (this.matchesLaughTriggers(normalizedText)) {
      expressionType = 'laugh';
      triggered = true;
    }
    // Sigh triggers - you have a sigh (mislabeled as laugh)
    else if (this.matchesSighTriggers(normalizedText)) {
      // Your sigh is actually labeled as "laugh" but has sigh keywords
      expressionType = 'laugh'; // Will find the sigh expression by keywords
      triggered = true;
    }
    // Amazement triggers - you have jeez (type: catchphrase)
    else if (this.matchesAmazementTriggers(normalizedText)) {
      expressionType = 'catchphrase';
      triggered = true;
    }
    // Remove hmm and absolutely triggers since you don't have those expressions

    console.log(`🎭 Trigger check - normalizedText: "${normalizedText}"`);
    console.log(`🎭 Laugh match: ${this.matchesLaughTriggers(normalizedText)}`);
    console.log(`🎭 Sigh match: ${this.matchesSighTriggers(normalizedText)}`);
    console.log(`🎭 Amazement match: ${this.matchesAmazementTriggers(normalizedText)}`);

    if (triggered) {
      this.lastOverlayTime = now;
      const timestamp = new Date().toISOString();
      console.log(`[overlay: ${expressionType} triggered] ${timestamp}`);
      await this.playExpression(expressionType);
    } else {
      console.log('[overlay: no match]');
    }
  }

  /**
   * Natural laugh trigger patterns
   */
  private matchesLaughTriggers(text: string): boolean {
    const laughPatterns = [
      'funny', 'hilarious', 'laugh', 'haha', 'lol', 'cracking up', 'thats a good one',
      'thats hilarious', 'so funny', 'makes me laugh', 'cant stop laughing',
      'thats comedy gold', 'youre killing me', 'im dying', 'thats rich',
      'good one', 'classic', 'thats perfect', 'love it'
    ];
    return laughPatterns.some(pattern => text.includes(pattern));
  }

  /**
   * Natural sigh trigger patterns
   */
  private matchesSighTriggers(text: string): boolean {
    const sighPatterns = [
      'sigh', 'overwhelm', 'frustrated', 'exhausted', 'tired', 'stressed',
      'makes me sigh', 'overwhelming', 'too much', 'cant handle',
      'giving up', 'had enough', 'so tired', 'worn out', 'drained',
      'sad', 'nostalgic', 'melancholy', 'bittersweet'
    ];
    return sighPatterns.some(pattern => text.includes(pattern));
  }

  /**
   * Natural amazement trigger patterns
   */
  private matchesAmazementTriggers(text: string): boolean {
    const amazementPatterns = [
      'jeez', 'wow', 'amazing', 'incredible', 'unbelievable', 'fantastic',
      'thats wild', 'no way', 'are you serious', 'thats insane', 'mind blown',
      'cant believe', 'extraordinary', 'remarkable', 'stunning', 'breathtaking',
      'astonished', 'wowed'
    ];
    return amazementPatterns.some(pattern => text.includes(pattern));
  }

  /**
   * Check if specifically "jeez" should be used vs "wow"
   */
  private matchesJeezSpecifically(text: string): boolean {
    return text.includes('jeez') || text.includes('geez');
  }

  /**
   * Natural thoughtful trigger patterns
   */
  private matchesThoughtfulTriggers(text: string): boolean {
    const thoughtfulPatterns = [
      'hmm', 'let me think', 'thinking', 'consider', 'wondering', 'ponder',
      'interesting', 'thats a good question', 'makes me wonder', 'curious',
      'let me see', 'well', 'actually', 'you know what'
    ];
    return thoughtfulPatterns.some(pattern => text.includes(pattern));
  }

  /**
   * Natural affirmative trigger patterns
   */
  private matchesAffirmativeTriggers(text: string): boolean {
    const affirmativePatterns = [
      'absolutely', 'exactly', 'definitely', 'totally', 'completely',
      'youre right', 'thats right', 'spot on', 'couldnt agree more',
      'one hundred percent', 'without a doubt', 'for sure'
    ];
    return affirmativePatterns.some(pattern => text.includes(pattern));
  }

  /**
   * Play a specific expression by type or ID
   */
  private async playExpression(expressionType: string): Promise<void> {
    console.log(`🎭 playExpression called with type: "${expressionType}"`);
    const startTime = Date.now();
    
    // Find expression by type first, then try direct ID lookup
    let targetExpressionId: string | null = null;
    let buffer: AudioBuffer | HTMLAudioElement | null = null;
    
    console.log(`🎭 Available expressions: ${this.expressions.length}`);
    this.expressions.forEach(expr => {
      console.log(`🎭   - ${expr.id}: type="${expr.type}", keywords=[${expr.keywords?.join(', ')}]`);
    });
    console.log(`🎭 Available buffers: ${this.buffers.size}`);
    for (const [id] of this.buffers) {
      console.log(`🎭   - Buffer: ${id}`);
    }
    
    // Smart expression matching based on context
    console.log(`🎭 Looking for expression type: "${expressionType}"`);
    for (const expression of this.expressions) {
      console.log(`🎭 Checking expression ${expression.id} (type: ${expression.type})`);
      
      let isMatch = false;
      
      // For laugh triggers, find any laugh expression
      if (expressionType === 'laugh') {
        isMatch = expression.type === 'laugh' || 
                 expression.keywords?.some(k => ['laugh', 'funny', 'hilarious'].includes(k.toLowerCase()));
      }
      // For catchphrase triggers (jeez/wow), find catchphrase type
      else if (expressionType === 'catchphrase') {
        isMatch = expression.type === 'catchphrase' || 
                 expression.keywords?.some(k => ['jeez', 'wow', 'amazing'].includes(k.toLowerCase()));
      }
      // Fallback: original matching logic
      else {
        isMatch = expression.type === expressionType || 
                 expression.placementHints?.some(hint => hint.toLowerCase().includes(expressionType.toLowerCase())) ||
                 expression.tone?.toLowerCase().includes(expressionType.toLowerCase());
      }
      
      if (isMatch) {
        targetExpressionId = expression.id;
        buffer = this.buffers.get(expression.id);
        console.log(`🎭 Found matching expression: ${expression.id}, buffer exists: ${!!buffer}`);
        if (buffer) break; // Found a working buffer
      }
    }
    
    // Fallback: try direct ID lookup
    if (!buffer) {
      console.log(`🎭 No buffer found by type, trying direct ID lookup for: "${expressionType}"`);
      buffer = this.buffers.get(expressionType);
      targetExpressionId = expressionType;
      console.log(`🎭 Direct lookup result: buffer exists: ${!!buffer}`);
    }
    
    if (buffer && targetExpressionId) {
      // Check if it's an AudioBuffer (for MP3/WAV) or HTMLAudioElement (for M4A)
      if (buffer instanceof AudioBuffer && this.audioContext) {
        try {
          // Resume audio context if suspended (required for some browsers)
          if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
          }

          // Create separate AudioBufferSourceNode instance for concurrent playback
          const source = this.audioContext.createBufferSource();
          const gainNode = this.audioContext.createGain();
          
          source.buffer = buffer;
          source.connect(gainNode);
          gainNode.connect(this.audioContext.destination);
          
          // Set volume (full volume since no competing audio)
          gainNode.gain.value = 1.0;
          
          // Add completion logging and proper node cleanup
          source.onended = () => {
            const duration = (Date.now() - startTime) / 1000;
            console.log(`[overlay: ${targetExpressionId} completed @${duration.toFixed(1)}s]`);
            
            // Disconnect nodes to avoid memory leaks
            try {
              source.disconnect();
              gainNode.disconnect();
            } catch (disconnectError) {
              // Nodes might already be disconnected
              console.debug(`🎭 Node cleanup for ${targetExpressionId}:`, disconnectError);
            }
          };
          
          // Play immediately (timing handled by streaming manager)
          source.start();
          return;
          
        } catch (error) {
          console.warn(`🎭 AudioContext playback failed for ${targetExpressionId}, trying HTML Audio fallback:`, error);
        }
      } else if (buffer instanceof HTMLAudioElement) {
        // Use the stored HTML Audio element (for M4A files)
        try {
          const audio = buffer.cloneNode() as HTMLAudioElement;
          audio.volume = 1.0; // Full volume since no competing audio
          audio.currentTime = 0;
          
          // Add completion logging for HTML Audio
          const onEnded = () => {
            const duration = (Date.now() - startTime) / 1000;
            console.log(`[overlay: ${targetExpressionId} completed @${duration.toFixed(1)}s]`);
            audio.removeEventListener('ended', onEnded);
          };
          audio.addEventListener('ended', onEnded);
          
          // Play immediately (timing handled by streaming manager)
          await audio.play();
          return;
        } catch (error) {
          console.warn(`🎭 HTML Audio playback failed for ${targetExpressionId}:`, error);
        }
      }
    }

    // Try HTML Audio fallback - look for HTML audio by expression ID
    let htmlAudio = this.htmlAudioFallbacks.get(targetExpressionId || expressionType);
    
    // If not found by target ID, try to find by type
    if (!htmlAudio && targetExpressionId) {
      for (const expression of this.expressions) {
        if (expression.id === targetExpressionId) {
          htmlAudio = this.htmlAudioFallbacks.get(expression.id);
          break;
        }
      }
    }
    
    if (htmlAudio) {
      try {
        htmlAudio.volume = 1.0; // Full volume since no competing audio
        htmlAudio.currentTime = 0; // Reset to beginning
        
        // Add completion logging for HTML Audio
        const onEnded = () => {
          const duration = (Date.now() - startTime) / 1000;
          console.log(`[overlay: ${targetExpressionId || expressionType} completed @${duration.toFixed(1)}s]`);
          htmlAudio!.removeEventListener('ended', onEnded);
        };
        htmlAudio.addEventListener('ended', onEnded);
        
        // Play immediately (timing handled by streaming manager)
        await htmlAudio.play();
        return;
      } catch (error) {
        console.warn(`🎭 HTML Audio playback failed for ${targetExpressionId || expressionType}:`, error);
      }
    }

    // If we get here, both methods failed
    console.error(`🎭 ❌ All playback methods failed for expression ${expressionType} (target ID: ${targetExpressionId})`);
  }

  /**
   * Set a pre-loaded buffer (used by UniversalExpressionService)
   */
  setBuffer(id: string, buffer: AudioBuffer | HTMLAudioElement): void {
    this.buffers.set(id, buffer);
    console.log(`🎭 Set pre-loaded buffer for ${id}`);
  }

  /**
   * Enable or disable expressions
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`🎭 Simple expressions ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Verify concurrent audio playback capability
   */
  verifyConcurrentPlayback(): boolean {
    if (!this.audioContext) {
      console.warn(`🎭 ❌ AudioContext not available for concurrent playback verification`);
      return false;
    }

    console.log(`🎭 Verifying concurrent audio playback capability...`);
    console.log(`🎭 AudioContext state: ${this.audioContext.state}`);
    console.log(`🎭 AudioContext sample rate: ${this.audioContext.sampleRate}Hz`);
    console.log(`🎭 Preloaded buffers: ${this.buffers.size}`);
    console.log(`🎭 HTML Audio fallbacks: ${this.htmlAudioFallbacks.size}`);
    
    // Verify that expressions use separate AudioBufferSourceNode instances
    const laughBuffer = this.buffers.get('laugh');
    if (laughBuffer) {
      console.log(`🎭 ✅ Laugh buffer ready for separate AudioBufferSourceNode instances`);
      console.log(`🎭 ✅ Each playback will create new source node for concurrent audio`);
      return true;
    } else {
      console.warn(`🎭 ❌ Laugh buffer not available for concurrent playback`);
      return false;
    }
  }

  /**
   * Get AudioContext for sharing verification
   */
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * Create default expressions for any avatar
   */
  static createDefaultExpressions(): SimpleExpression[] {
    return [
      {
        id: 'laugh',
        type: 'laugh',
        keywords: ['funny', 'hilarious', 'laugh', 'joke', 'humor', 'haha', 'lol'],
        audioUrl: '/snippets/laugh_short.mp3',
        volume: 0.3
      },
      {
        id: 'thinking',
        type: 'thinking',
        keywords: ['hmm', 'thinking', 'let me think', 'consider', 'wondering'],
        audioUrl: '/snippets/hmm.mp3',
        volume: 0.4
      },
      {
        id: 'affirmation',
        type: 'affirmation',
        keywords: ['absolutely', 'exactly', 'definitely', 'totally', 'yes'],
        audioUrl: '/snippets/absolutely.mp3',
        volume: 0.3
      },
      {
        id: 'wow',
        type: 'amazement',
        keywords: ['wow', 'amazing', 'incredible', 'unbelievable', 'fantastic'],
        audioUrl: '/snippets/wow.mp3',
        volume: 0.3
      }
    ];
  }
}