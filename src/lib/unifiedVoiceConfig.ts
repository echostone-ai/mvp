/**
 * Unified Voice Configuration
 * 
 * This module provides consistent voice settings across the entire application
 * to prevent accent variations and ensure voice consistency between homepage and profile.
 */

export interface UnifiedVoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  model_id: string;
  optimize_streaming_latency: number;
  output_format: string;
}

/**
 * Default voice settings optimized for natural speech without accent issues
 * These settings prioritize natural speech over maximum consistency
 */
export const DEFAULT_VOICE_SETTINGS: UnifiedVoiceSettings = {
  stability: 0.70,              // Higher stability to prevent accent
  similarity_boost: 0.88,       // High similarity to preserve voice character
  style: 0.30,                 // Higher style for more robust expression
  use_speaker_boost: true,      // Enable speaker boost for better voice character
  model_id: 'eleven_turbo_v2',  // Turbo model for better voice quality
  optimize_streaming_latency: 1,
  output_format: 'mp3_44100_128'
};

/**
 * High consistency settings for when maximum voice consistency is needed
 * Optimized for homepage demo with natural speed - preserves voice character
 */
export const HIGH_CONSISTENCY_SETTINGS: UnifiedVoiceSettings = {
  stability: 0.65,              // Slightly higher stability to prevent accent
  similarity_boost: 0.90,       // Very high similarity to preserve cloned voice character
  style: 0.35,                 // Higher style for more robust expression
  use_speaker_boost: true,      // Enable speaker boost for better voice character
  model_id: 'eleven_turbo_v2',  // Turbo model for better voice quality
  optimize_streaming_latency: 1,
  output_format: 'mp3_44100_128'
};

/**
 * Natural speech settings for conversational tone
 * Best for most use cases
 */
export const NATURAL_SPEECH_SETTINGS: UnifiedVoiceSettings = {
  stability: 0.65,              // Higher stability to prevent accent
  similarity_boost: 0.90,       // Very high similarity to preserve voice character
  style: 0.40,                 // Higher style for more robust expression
  use_speaker_boost: true,      // Enable speaker boost for better voice character
  model_id: 'eleven_turbo_v2',  // Turbo model for better voice quality
  optimize_streaming_latency: 1,
  output_format: 'mp3_44100_128'
};

/**
 * Get unified voice settings based on context
 */
export function getUnifiedVoiceSettings(context: 'homepage' | 'profile' | 'streaming' = 'profile'): UnifiedVoiceSettings {
  switch (context) {
    case 'homepage':
      // Homepage should use consistent settings for demo purposes
      return HIGH_CONSISTENCY_SETTINGS;
    case 'profile':
      // Profile should use natural speech settings
      return NATURAL_SPEECH_SETTINGS;
    case 'streaming':
      // Streaming should use balanced settings
      return DEFAULT_VOICE_SETTINGS;
    default:
      return DEFAULT_VOICE_SETTINGS;
  }
}

/**
 * Merge custom settings with unified defaults
 */
export function mergeVoiceSettings(
  baseSettings: UnifiedVoiceSettings = DEFAULT_VOICE_SETTINGS,
  customSettings?: Partial<UnifiedVoiceSettings>
): UnifiedVoiceSettings {
  if (!customSettings) {
    return baseSettings;
  }

  return {
    ...baseSettings,
    ...customSettings,
    // For homepage, use exact settings without bounds checking to match ElevenLabs defaults
    stability: customSettings.stability ?? baseSettings.stability,
    similarity_boost: customSettings.similarity_boost ?? baseSettings.similarity_boost,
    style: customSettings.style ?? baseSettings.style
  };
}

/**
 * Create a consistent voice request body for ElevenLabs API
 */
export function createUnifiedVoiceRequest(
  text: string,
  voiceId: string,
  context: 'homepage' | 'profile' | 'streaming' = 'profile',
  customSettings?: Partial<UnifiedVoiceSettings>,
  conversationId?: string
) {
  const baseSettings = getUnifiedVoiceSettings(context);
  const finalSettings = mergeVoiceSettings(baseSettings, customSettings);
  
  // Generate a consistent seed for the conversation
  // For homepage, don't use a seed to match ElevenLabs defaults
  const seed = context === 'homepage' ? undefined : (conversationId ? generateConversationSeed(conversationId, voiceId) : undefined);
  
  return {
    text,
    voice_settings: {
      stability: finalSettings.stability,
      similarity_boost: finalSettings.similarity_boost,
      style: finalSettings.style,
      use_speaker_boost: finalSettings.use_speaker_boost
    },
    model_id: finalSettings.model_id,
    optimize_streaming_latency: finalSettings.optimize_streaming_latency,
    output_format: finalSettings.output_format,
    ...(seed && { seed })
  };
}

/**
 * Generate a consistent seed for voice generation
 */
function generateConversationSeed(conversationId: string, voiceId: string): number {
  let hash = 0;
  const str = `${conversationId}-${voiceId}-unified`;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash) % 10000;
}

/**
 * Validate voice settings to prevent accent issues
 */
export function validateVoiceSettings(settings: Partial<UnifiedVoiceSettings>): {
  isValid: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (settings.stability !== undefined) {
    if (settings.stability > 0.95) {
      issues.push('Stability too high (>0.95) - may cause robotic speech');
      recommendations.push('Reduce stability to 0.75-0.85 for natural speech');
    }
    if (settings.stability < 0.5) {
      issues.push('Stability too low (<0.5) - may cause accent variations');
      recommendations.push('Increase stability to 0.70-0.85 for consistency');
    }
  }

  if (settings.similarity_boost !== undefined) {
    if (settings.similarity_boost > 0.95) {
      issues.push('Similarity boost too high (>0.95) - may cause artifacts');
      recommendations.push('Reduce similarity_boost to 0.80-0.90');
    }
    if (settings.similarity_boost < 0.7) {
      issues.push('Similarity boost too low (<0.7) - may lose voice character');
      recommendations.push('Increase similarity_boost to 0.80-0.90');
    }
  }

  if (settings.style !== undefined) {
    if (settings.style > 0.5) {
      issues.push('Style too high (>0.5) - may cause accent variations');
      recommendations.push('Reduce style to 0.15-0.30 for consistency');
    }
    if (settings.style < 0.05) {
      issues.push('Style too low (<0.05) - may sound robotic');
      recommendations.push('Increase style to 0.15-0.30 for natural speech');
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    recommendations
  };
} 