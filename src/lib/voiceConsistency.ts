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
    stability: 0.99,           // Maximum stability for consistent voice
    similarity_boost: 0.75,    // Lower similarity to reduce artifacts that cause voice variation
    style: 0.01,              // Minimal style variation for consistency
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
 * This removes elements that can cause voice variation
 */
export function normalizeTextForVoice(text: string): string {
  return text
    // Remove fake laughs and artificial expressions
    .replace(/\b(haha|lol|lmao|rofl)\b/gi, '')
    .replace(/\*[^*]*\*/g, '') // Remove *actions*
    .replace(/\([^)]*\)/g, '') // Remove (parenthetical comments)
    
    // Normalize punctuation for consistent prosody
    .replace(/\.{3,}/g, '...') // Standardize ellipses
    .replace(/!{2,}/g, '!') // Single exclamation
    .replace(/\?{2,}/g, '?') // Single question mark
    
    // Normalize quotation marks
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    
    // Clean up spacing
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split text into optimal segments for voice consistency
 * Longer segments = fewer API calls = more consistent voice
 */
export function splitTextForConsistentVoice(text: string): string[] {
  // First, normalize the text
  const normalized = normalizeTextForVoice(text);
  
  // Split on sentence boundaries, but keep segments reasonably long
  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  
  const segments: string[] = [];
  let currentSegment = '';
  
  for (const sentence of sentences) {
    // If adding this sentence would make the segment too long, start a new one
    if (currentSegment.length > 0 && (currentSegment + ' ' + sentence).length > 150) {
      segments.push(currentSegment.trim());
      currentSegment = sentence;
    } else {
      currentSegment = currentSegment ? currentSegment + ' ' + sentence : sentence;
    }
  }
  
  // Add the last segment if it exists
  if (currentSegment.trim()) {
    segments.push(currentSegment.trim());
  }
  
  return segments.filter(segment => segment.length > 5); // Filter out very short segments
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