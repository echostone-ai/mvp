/**
 * Voice Consistency Utilities
 * 
 * This module provides utilities to ensure consistent voice generation
 * across streaming segments and different parts of the application.
 */

export interface VoiceConsistencySettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

/**
 * Get maximum consistency voice settings
 * These settings prioritize voice consistency over expressiveness
 */
export function getMaxConsistencySettings(): VoiceConsistencySettings {
  return {
    stability: 0.85,           // High stability but not maximum to preserve natural speech
    similarity_boost: 0.80,    // Balanced similarity to maintain voice character without artifacts
    style: 0.15,              // Moderate style variation for more natural speech
    use_speaker_boost: true
  };
}

/**
 * Generate a conversation-specific seed for consistent voice generation
 * This ensures all segments within a conversation use the same voice characteristics
 */
export function generateConversationSeed(conversationId: string, voiceId: string): number {
  // Create a deterministic hash from conversation and voice ID
  let hash = 0;
  const str = `${conversationId}-${voiceId}-consistency`;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Ensure positive number within a smaller range for more consistency
  return Math.abs(hash) % 5000; // Smaller range for better consistency
}

/**
 * Clean and normalize text for consistent voice generation
 * This removes elements that can cause voice variation while preserving natural speech
 */
export function normalizeTextForVoice(text: string): string {
  return text
    // Remove only the most problematic fake expressions
    .replace(/\b(lol|lmao|rofl)\b/gi, '')
    .replace(/\*[^*]*\*/g, '') // Remove *actions*
    .replace(/\([^)]*\)/g, '') // Remove (parenthetical comments)
    
    // Only standardize the most problematic contractions (keep others for personality)
    .replace(/\b(gonna|gotta|wanna)\b/gi, (match) => {
      switch (match.toLowerCase()) {
        case 'gonna': return 'going to';
        case 'gotta': return 'got to';
        case 'wanna': return 'want to';
        default: return match;
      }
    })
    
    // Very conservative punctuation normalization
    .replace(/\.{5,}/g, '....') // Only standardize very excessive ellipses (5+ dots)
    .replace(/!{4,}/g, '!!!') // Allow up to 3 exclamations
    .replace(/\?{4,}/g, '???') // Allow up to 3 question marks
    
    // Normalize quotation marks
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    
    // Clean up excessive spacing but preserve natural pauses
    .replace(/\s{4,}/g, '   ') // Replace 4+ spaces with 3 spaces
    .trim();
}

/**
 * Split text into optimal segments for voice consistency
 * Longer segments = fewer API calls = more consistent voice
 */
export function splitTextForConsistentVoice(text: string): string[] {
  // First, normalize the text
  const normalized = normalizeTextForVoice(text);
  
  // Split on sentence boundaries, but be more careful about incomplete sentences
  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  
  const segments: string[] = [];
  let currentSegment = '';
  
  for (const sentence of sentences) {
    // Don't split if the sentence is incomplete (doesn't end with proper punctuation)
    const isCompleteSentence = /[.!?]$/.test(sentence.trim());
    
    // If adding this sentence would make the segment too long, start a new one
    // But only if the current sentence is complete
    if (currentSegment.length > 0 && 
        (currentSegment + ' ' + sentence).length > 200 && // Increased from 150 to 200
        isCompleteSentence) {
      segments.push(currentSegment.trim());
      currentSegment = sentence;
    } else {
      currentSegment = currentSegment ? currentSegment + ' ' + sentence : sentence;
    }
  }
  
  // Add the last segment if it exists and is substantial
  if (currentSegment.trim() && currentSegment.trim().length > 10) {
    segments.push(currentSegment.trim());
  }
  
  return segments.filter(segment => segment.length > 8); // Increased minimum length from 5 to 8
}

/**
 * Create a voice synthesis request with maximum consistency settings
 */
export function createConsistentVoiceRequest(
  text: string,
  voiceId: string,
  conversationId: string,
  previousContext?: string
) {
  const cleanedText = normalizeTextForVoice(text);
  const seed = generateConversationSeed(conversationId, voiceId);
  const settings = getMaxConsistencySettings();
  
  return {
    text: cleanedText,
    voiceId,
    settings,
    conversationId,
    seed,
    previousContext: previousContext?.substring(-100), // Last 100 chars for context
    // Additional consistency parameters
    model_id: 'eleven_multilingual_v2', // Use most accurate model for voice cloning
    optimize_streaming_latency: 1,
    output_format: 'mp3_44100_128'
  };
}

/**
 * Delay function to batch similar requests and reduce voice variation
 */
export function createVoiceBatchingDelay(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 75)); // 75ms delay for batching
}