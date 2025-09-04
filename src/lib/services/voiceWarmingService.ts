/**
 * Voice Warming Service for ElevenLabs Integration
 * 
 * Task 10: Optimize ElevenLabs integration with voice warming
 * - Warm voice session at server boot with 1-word synthesis ("Hi") and cache session
 * - Implement voice model caching to minimize first-audio delay to <200ms after hook production
 * - Ensure ElevenLabs streaming starts immediately, never await deep lane completion
 * - Add text-only fallback when voice synthesis fails without blocking response flow
 */

import { getEnhancedVoiceConfig, createEnhancedVoiceRequest, type EnhancedVoiceConfig } from '../enhancedVoiceConfig';

interface VoiceSession {
  voiceId: string;
  config: EnhancedVoiceConfig;
  warmedAt: number;
  isWarmed: boolean;
  lastUsed: number;
}

interface VoiceWarmingMetrics {
  warmingAttempts: number;
  warmingSuccesses: number;
  warmingFailures: number;
  averageWarmingTime: number;
  cacheHits: number;
  cacheMisses: number;
}

export class VoiceWarmingService {
  private static instance: VoiceWarmingService;
  private sessions = new Map<string, VoiceSession>();
  private warmingPromises = new Map<string, Promise<void>>();
  private metrics: VoiceWarmingMetrics = {
    warmingAttempts: 0,
    warmingSuccesses: 0,
    warmingFailures: 0,
    averageWarmingTime: 0,
    cacheHits: 0,
    cacheMisses: 0
  };
  
  // Configuration
  private readonly WARMING_TEXT = 'Hi';
  private readonly SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_WARMING_TIME_MS = 5000; // 5 seconds max for warming
  private readonly TARGET_FIRST_AUDIO_DELAY_MS = 200; // Target <200ms after hook production
  
  private constructor() {
    // Start warming default voice on service creation
    this.warmDefaultVoice();
  }
  
  static getInstance(): VoiceWarmingService {
    if (!VoiceWarmingService.instance) {
      VoiceWarmingService.instance = new VoiceWarmingService();
    }
    return VoiceWarmingService.instance;
  }
  
  /**
   * Warm voice session at server boot with 1-word synthesis
   * Requirements: 1.2, 8.3
   */
  async warmVoiceSession(voiceId: string): Promise<void> {
    const startTime = Date.now();
    
    // Check if already warming
    if (this.warmingPromises.has(voiceId)) {
      return this.warmingPromises.get(voiceId)!;
    }
    
    // Check if already warmed and still valid
    const existingSession = this.sessions.get(voiceId);
    if (existingSession && this.isSessionValid(existingSession)) {
      console.log('voice_warming_cache_hit', { voiceId, warmedAt: existingSession.warmedAt });
      this.metrics.cacheHits++;
      return;
    }
    
    this.metrics.cacheMisses++;
    this.metrics.warmingAttempts++;
    
    const warmingPromise = this.performWarmingRequest(voiceId, startTime);
    this.warmingPromises.set(voiceId, warmingPromise);
    
    try {
      await warmingPromise;
    } finally {
      this.warmingPromises.delete(voiceId);
    }
  }
  
  /**
   * Perform the actual warming request with timeout and error handling
   */
  private async performWarmingRequest(voiceId: string, startTime: number): Promise<void> {
    // Check API key before making request
    if (!process.env.ELEVENLABS_API_KEY) {
      console.warn('voice_warming_skipped', 'ELEVENLABS_API_KEY not configured');
      return;
    }
    
    try {
      const config = getEnhancedVoiceConfig();
      const requestBody = createEnhancedVoiceRequest(this.WARMING_TEXT, voiceId, config);
      
      console.log('voice_warming_start', { voiceId, text: this.WARMING_TEXT });
      
      // Create warming request with timeout
      const warmingRequest = fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.MAX_WARMING_TIME_MS)
      });
      
      const response = await warmingRequest;
      const warmingTime = Date.now() - startTime;
      
      if (!response.ok) {
        throw new Error(`Warming request failed: ${response.status}`);
      }
      
      // Consume the response to complete the warming
      await response.arrayBuffer();
      
      // Cache the warmed session
      const session: VoiceSession = {
        voiceId,
        config,
        warmedAt: Date.now(),
        isWarmed: true,
        lastUsed: Date.now()
      };
      
      this.sessions.set(voiceId, session);
      this.metrics.warmingSuccesses++;
      this.updateAverageWarmingTime(warmingTime);
      
      console.log('voice_warming_success', { 
        voiceId, 
        warmingTime, 
        targetDelay: this.TARGET_FIRST_AUDIO_DELAY_MS,
        withinTarget: warmingTime < this.TARGET_FIRST_AUDIO_DELAY_MS
      });
      
    } catch (error: any) {
      this.metrics.warmingFailures++;
      const warmingTime = Date.now() - startTime;
      
      console.warn('voice_warming_failed', { 
        voiceId, 
        error: error.message, 
        warmingTime,
        isTimeout: error.name === 'AbortError'
      });
      
      // Don't throw - warming failure shouldn't break the service
      // The voice will work without warming, just with higher latency
    }
  }
  
  /**
   * Check if a voice session is warmed and ready for immediate use
   */
  isVoiceWarmed(voiceId: string): boolean {
    const session = this.sessions.get(voiceId);
    return session ? this.isSessionValid(session) : false;
  }
  
  /**
   * Get cached voice configuration if available
   */
  getCachedVoiceConfig(voiceId: string): EnhancedVoiceConfig | null {
    const session = this.sessions.get(voiceId);
    if (session && this.isSessionValid(session)) {
      session.lastUsed = Date.now();
      return session.config;
    }
    return null;
  }
  
  /**
   * Warm default voice (jonathan-demo) at service startup
   */
  private async warmDefaultVoice(): Promise<void> {
    const defaultVoiceId = process.env.JONATHAN_DEMO_VOICE_ID || 
                          process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || 
                          'default';
    
    if (!process.env.ELEVENLABS_API_KEY) {
      console.warn('voice_warming_skipped', 'ELEVENLABS_API_KEY not configured');
      return;
    }
    
    console.log('voice_warming_boot', { defaultVoiceId });
    
    // Warm in background, don't block service startup
    this.warmVoiceSession(defaultVoiceId).catch(error => {
      console.warn('voice_warming_boot_failed', { error: error.message });
    });
  }
  
  /**
   * Check if a session is still valid (not expired)
   */
  private isSessionValid(session: VoiceSession): boolean {
    const now = Date.now();
    return session.isWarmed && (now - session.warmedAt) < this.SESSION_TTL_MS;
  }
  
  /**
   * Update running average of warming times
   */
  private updateAverageWarmingTime(newTime: number): void {
    const totalAttempts = this.metrics.warmingSuccesses;
    if (totalAttempts === 1) {
      this.metrics.averageWarmingTime = newTime;
    } else {
      this.metrics.averageWarmingTime = 
        (this.metrics.averageWarmingTime * (totalAttempts - 1) + newTime) / totalAttempts;
    }
  }
  
  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [voiceId, session] of this.sessions.entries()) {
      if (!this.isSessionValid(session)) {
        this.sessions.delete(voiceId);
        console.log('voice_session_expired', { voiceId, age: now - session.warmedAt });
      }
    }
  }
  
  /**
   * Get warming service metrics for monitoring
   */
  getMetrics(): VoiceWarmingMetrics & { activeSessions: number } {
    this.cleanupExpiredSessions();
    return {
      ...this.metrics,
      activeSessions: this.sessions.size
    };
  }
  
  /**
   * Ensure ElevenLabs streaming starts immediately with warmed session
   * Requirements: 1.2, 8.3
   */
  async getOptimizedVoiceConfig(voiceId: string): Promise<{
    config: EnhancedVoiceConfig;
    isWarmed: boolean;
    estimatedDelay: number;
  }> {
    const cachedConfig = this.getCachedVoiceConfig(voiceId);
    
    if (cachedConfig) {
      return {
        config: cachedConfig,
        isWarmed: true,
        estimatedDelay: 50 // Very low delay for warmed sessions
      };
    }
    
    // Start warming in background for next time
    this.warmVoiceSession(voiceId).catch(() => {
      // Ignore warming failures - don't block current request
    });
    
    return {
      config: getEnhancedVoiceConfig(),
      isWarmed: false,
      estimatedDelay: 500 // Higher delay for cold sessions
    };
  }
  
  /**
   * Provide text-only fallback when voice synthesis fails
   * Requirements: 1.2, 8.3
   */
  createTextFallbackResponse(text: string, error?: string): {
    error: string;
    message: string;
    text: string;
    fallback: boolean;
    estimatedDelay: number;
  } {
    console.log('voice_fallback_triggered', { 
      textLength: text.length, 
      error: error || 'unknown',
      fallbackDelay: 0 
    });
    
    return {
      error: 'TTS_UNAVAILABLE',
      message: 'Voice synthesis temporarily unavailable',
      text: text,
      fallback: true,
      estimatedDelay: 0 // Immediate text response
    };
  }
}

// Export singleton instance
export const voiceWarmingService = VoiceWarmingService.getInstance();

// Auto-start warming on module load (server boot)
if (typeof window === 'undefined') {
  // Only run on server side
  console.log('voice_warming_service_initialized');
}