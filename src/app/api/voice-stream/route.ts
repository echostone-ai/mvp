import { 
  getEnhancedVoiceConfig, 
  getFallbackVoiceConfig, 
  createEnhancedVoiceRequest,
  validateVoiceQuality,
  normalizeAudioLevel,
  type EnhancedVoiceConfig 
} from '../../../lib/enhancedVoiceConfig';
import { globalAudioLevelManager } from '../../../lib/audioLevelManager';
import { voiceWarmingService } from '../../../lib/services/voiceWarmingService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sliceForEarlyStart(text: string) {
  // For shorter text (under 300 chars), don't split at all to avoid choppy audio
  if (text.length < 300) {
    return [text, ''];
  }
  
  // For longer text, aim for natural boundary within 200–400 chars
  const n = Math.min(Math.max(200, Math.floor(text.length * 0.4)), 400);
  const idx = Math.max(text.indexOf('. ', n), text.indexOf('! ', n), text.indexOf('? ', n));
  return idx > 0 ? [text.slice(0, idx + 1), text.slice(idx + 1)] : [text, ''];
}

function preprocessTextForSpeech(text: string): string {
  return text
    // Remove written laughter entirely - let natural speech flow carry the emotion
    .replace(/\bhaha\b/gi, '')                // Remove, let tone carry the humor
    .replace(/\bhahaha\b/gi, '')              // Remove longer laughter
    .replace(/\blol\b/gi, '')                 // Remove text-speak laughter
    .replace(/\blmao\b/gi, '')                // Remove text-speak laughter
    // Replace other text-speak with natural speech
    .replace(/\bomg\b/gi, 'oh my god')
    .replace(/\bwtf\b/gi, 'what the heck')
    // Clean up any remaining artifacts and double spaces from removals
    .replace(/[,!]\s*[,!]/g, '!')             // Fix double punctuation
    .replace(/\s+/g, ' ')                     // Fix multiple spaces
    .replace(/\s+([,.!?])/g, '$1')            // Fix spaces before punctuation
    .trim();
}

export async function POST(req: Request) {
  const t0 = Date.now();
  
  try {
    const { text, avatar, useEnhancedQuality = true, conversationId, normalizeAudio = true } = await req.json();
    
    if (!text) {
      return new Response('Missing text', { status: 400 });
    }
    
    // 8) Voice route shouldn't poison chat - check TTS env/config
    if (!process.env.ELEVENLABS_API_KEY) {
      console.warn('voice_env_missing', 'ELEVENLABS_API_KEY not configured');
      const fallback = voiceWarmingService.createTextFallbackResponse(text, 'API key not configured');
      return new Response(JSON.stringify(fallback), {
        status: 204,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Preprocess text for more natural speech
    const processedText = preprocessTextForSpeech(text);
    const [head, tail] = sliceForEarlyStart(processedText);

    // 2. VOICE STREAMING ECONNREFUSED FIX - Verify environment and add logging
    console.log('voice_env_check', {
      elevenlabs_api_key: process.env.ELEVENLABS_API_KEY ? 'present' : 'missing',
      elevenlabs_url: process.env.ELEVENLABS_URL || 'not_set',
      base_url: process.env.BASE_URL || 'defaulting_to_localhost'
    });
    
    // resolve voice (cached) - use proper base URL with error handling
    const baseUrl = process.env.BASE_URL || `http://localhost:3000`;
    let voiceId = 'default';
    let settings = {};
    
    try {
      const voiceRes = await fetch(`${baseUrl}/api/voice/resolve?avatar=${encodeURIComponent(avatar||'default')}`);
      if (!voiceRes.ok) {
        throw new Error(`Voice resolve failed: ${voiceRes.status}`);
      }
      const voiceData = await voiceRes.json();
      voiceId = voiceData.voiceId || 'default';
      settings = voiceData.settings || {};
    } catch (error) {
      console.warn('voice_resolve_failed', error);
      // Continue with defaults - don't crash
    }

    // Get optimized voice configuration with warming
    const { config: voiceConfig, isWarmed, estimatedDelay } = await voiceWarmingService.getOptimizedVoiceConfig(voiceId);
    let fallbackAttempt = 0;
    const maxFallbackAttempts = 3;

    // Log warming status for monitoring
    console.log('voice_warming_status', {
      voiceId,
      isWarmed,
      estimatedDelay,
      useEnhancedQuality,
      targetDelay: 200
    });

    // Override config if not using enhanced quality
    let finalConfig = voiceConfig;
    if (!useEnhancedQuality) {
      finalConfig = {
        model_id: 'eleven_multilingual_v2',
        voice_settings: settings,
        output_format: 'mp3_22050_32',
        optimize_streaming_latency: 2,
        apply_text_normalization: 'auto'
      };
    }

    // Function to attempt TTS with retry/backoff and warming optimization
    const attemptTTS = async (text: string, config: EnhancedVoiceConfig, retryCount: number = 0): Promise<Response> => {
      const requestBody = createEnhancedVoiceRequest(text, voiceId, config, conversationId);
      const startTime = Date.now();
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;
      
      console.log('voice_fetch_attempt', { 
        url, 
        elapsed_ms: 0, 
        retry: retryCount,
        isWarmed,
        estimatedDelay 
      });
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 
            'xi-api-key': process.env.ELEVENLABS_API_KEY!, 
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify(requestBody)
        });

        const elapsed = Date.now() - startTime;

        if (!response.ok) {
          const errorText = await response.text();
          console.log('voice_fetch_failed', { 
            code: response.status, 
            message: errorText, 
            elapsed_ms: elapsed,
            retry: retryCount,
            isWarmed
          });
          throw new Error(`TTS failed: ${response.status} - ${errorText}`);
        }

        console.log('voice_fetch_success', { 
          elapsed_ms: elapsed, 
          size: response.headers.get('content-length') || 'unknown',
          retry: retryCount,
          isWarmed,
          withinTarget: elapsed < 200
        });
        
        return response;
        
      } catch (error: any) {
        const elapsed = Date.now() - startTime;
        console.log('voice_fetch_failed', { 
          code: error.code || 'UNKNOWN', 
          message: error.message, 
          elapsed_ms: elapsed,
          retry: retryCount,
          isWarmed
        });
        
        // Retry up to 2 times with 200ms backoff
        if (retryCount < 2 && (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT')) {
          console.log('voice_fetch_retry', { retry: retryCount + 1, backoff_ms: 200 });
          await new Promise(resolve => setTimeout(resolve, 200));
          return attemptTTS(text, config, retryCount + 1);
        }
        
        throw error;
      }
    };

    // Kick off first clip immediately (head) with automatic fallback and graceful degradation
    let r1: Response;
    try {
      r1 = await attemptTTS(head, finalConfig);
    } catch (error) {
      console.warn('Enhanced quality failed for head, trying fallback:', error);
      fallbackAttempt++;
      
      if (fallbackAttempt < maxFallbackAttempts) {
        finalConfig = getFallbackVoiceConfig('quality');
        try {
          r1 = await attemptTTS(head, finalConfig);
        } catch (fallbackError) {
          console.warn('High-quality fallback failed, using standard:', fallbackError);
          fallbackAttempt++;
          finalConfig = getFallbackVoiceConfig('compatibility');
          try {
            r1 = await attemptTTS(head, finalConfig);
          } catch (finalError) {
            // Final failure - use voice warming service for graceful degradation
            const fallback = voiceWarmingService.createTextFallbackResponse(
              processedText, 
              `TTS failed: ${error.message}`
            );
            
            return new Response(JSON.stringify(fallback), {
              status: 200, // Don't crash - return success with fallback
              headers: {
                'Content-Type': 'application/json',
                'X-Voice-Fallback': 'text-only',
                'X-Voice-Warmed': isWarmed.toString()
              }
            });
          }
        }
      } else {
        // Final failure - use voice warming service for graceful degradation
        const fallback = voiceWarmingService.createTextFallbackResponse(
          processedText, 
          error.message
        );
        
        return new Response(JSON.stringify(fallback), {
          status: 200, // Don't crash - return success with fallback
          headers: {
            'Content-Type': 'application/json',
            'X-Voice-Fallback': 'text-only',
            'X-Voice-Warmed': isWarmed.toString()
          }
        });
      }
    }

    if (!r1.body) {
      return new Response('TTS error: No audio data received', { status: 502 });
    }

    // If there is tail, start it shortly after to overlap
    let r2: Response | null = null;
    if (tail?.trim()) {
      try {
        r2 = await attemptTTS(tail, finalConfig);
      } catch (error) {
        console.warn('TTS error for tail, continuing with head only:', error);
        // Continue with just the head audio rather than failing completely
      }
    }

    // Merge streams (head first, then tail) with optional audio normalization
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    const pump = async (resp: Response) => {
      const reader = resp.body!.getReader();
      const chunks: Uint8Array[] = [];
      
      // Collect all chunks first if normalization is enabled
      if (normalizeAudio) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        
        // Combine chunks and normalize if requested
        if (chunks.length > 0) {
          const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
          const combinedArray = new Uint8Array(totalLength);
          let offset = 0;
          
          for (const chunk of chunks) {
            combinedArray.set(chunk, offset);
            offset += chunk.length;
          }
          
          try {
            // Attempt audio normalization (will fallback gracefully if not available)
            const normalizedBuffer = await globalAudioLevelManager.normalizeAudioBuffer(combinedArray.buffer);
            const normalizedArray = new Uint8Array(normalizedBuffer);
            await writer.write(normalizedArray);
          } catch (error) {
            console.warn('Audio normalization failed, using original:', error);
            await writer.write(combinedArray);
          }
        }
      } else {
        // Stream directly without normalization
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          await writer.write(value);
        }
      }
    };

    // Start pumping in background
    (async () => {
      try {
        const tFirstByte = Date.now();
        await pump(r1);
        const firstByteLatency = tFirstByte - t0;
        
        if (r2) await pump(r2);
        
        const totalLatency = Date.now() - t0;
        
        // Log enhanced metrics with voice warming data
        const warmingMetrics = voiceWarmingService.getMetrics();
        console.log('voice_stream_metrics', {
          tts_first_byte_ms: firstByteLatency,
          tts_total_ms: totalLatency,
          voice_cache_hit: true, // voice resolver has caching
          voice_warmed: isWarmed,
          estimated_delay: estimatedDelay,
          actual_vs_estimated: firstByteLatency - estimatedDelay,
          text_length: processedText.length,
          head_length: head.length,
          tail_length: tail?.length || 0,
          original_length: text.length,
          enhanced_quality: useEnhancedQuality,
          fallback_attempts: fallbackAttempt,
          voice_config: {
            model: finalConfig.model_id,
            format: finalConfig.output_format,
            latency_mode: finalConfig.optimize_streaming_latency
          },
          conversation_id: conversationId,
          audio_normalized: normalizeAudio,
          conversation_stats: normalizeAudio ? globalAudioLevelManager.getConversationStats() : null,
          warming_metrics: {
            active_sessions: warmingMetrics.activeSessions,
            cache_hit_rate: warmingMetrics.cacheHits / (warmingMetrics.cacheHits + warmingMetrics.cacheMisses) || 0,
            average_warming_time: warmingMetrics.averageWarmingTime
          }
        });
        
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        'X-Voice-Quality': useEnhancedQuality ? 'enhanced' : 'standard',
        'X-Voice-Format': finalConfig.output_format,
        'X-Voice-Warmed': isWarmed.toString(),
        'X-Voice-Estimated-Delay': estimatedDelay.toString(),
        'X-Fallback-Attempts': fallbackAttempt.toString()
      }
    });
    
  } catch (error) {
    console.error('Voice stream error:', error);
    // 8) Voice route shouldn't poison chat - return graceful fallback using warming service
    const fallback = voiceWarmingService.createTextFallbackResponse(
      text, 
      error instanceof Error ? error.message : 'Unknown error'
    );
    
    return new Response(JSON.stringify(fallback), {
      status: 200, // Don't crash - return success with fallback
      headers: { 
        'Content-Type': 'application/json',
        'X-Voice-Fallback': 'error-recovery'
      }
    });
  }
}