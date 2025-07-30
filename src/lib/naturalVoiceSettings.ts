/**
 * Natural Voice Settings for ElevenLabs
 * Optimized to preserve the original voice character and natural expressiveness
 */

export interface NaturalVoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

/**
 * Settings that closely match the original ElevenLabs voice
 * These preserve the natural character and expressiveness of the trained voice
 */
export function getNaturalVoiceSettings(): NaturalVoiceSettings {
  return {
    stability: 0.70,           // Higher stability for more consistent voice (prevents accent variations)
    similarity_boost: 0.85,    // Higher similarity to preserve original voice character
    style: 0.00,              // No style for maximum consistency with original voice
    use_speaker_boost: false   // Disable speaker boost to avoid accent modifications
  };
}

/**
 * Settings for conversational speech that sounds natural
 * Balanced between consistency and natural expression
 */
export function getConversationalVoiceSettings(): NaturalVoiceSettings {
  return {
    stability: 0.70,           // Higher stability for more consistent voice
    similarity_boost: 0.85,    // Higher similarity to preserve voice character
    style: 0.00,              // No style for maximum consistency
    use_speaker_boost: false
  };
}

/**
 * Settings for expressive speech that maintains voice character
 * Allows more variation while staying true to the original voice
 */
export function getExpressiveVoiceSettings(): NaturalVoiceSettings {
  return {
    stability: 0.65,           // Slightly lower stability for more expression
    similarity_boost: 0.80,    // High similarity to maintain voice identity
    style: 0.10,              // Very low style for minimal accent variation
    use_speaker_boost: false
  };
}

/**
 * Create voice request optimized for natural speech
 */
export function createNaturalVoiceRequest(
  text: string,
  voiceId: string,
  conversationId?: string,
  settings?: NaturalVoiceSettings
) {
  const voiceSettings = settings || getNaturalVoiceSettings();
  
  return {
    text: text.trim(), // Minimal processing to preserve natural text
    voiceId,
    settings: voiceSettings,
    conversationId: conversationId || 'natural-voice',
    // Use ElevenLabs multilingual v2 model for high similarity
    model_id: 'eleven_multilingual_v2',
    optimize_streaming_latency: 0, // Prioritize quality over speed
    output_format: 'mp3_44100_128'
  };
}

/**
 * Get voice settings based on context
 */
export function getContextualVoiceSettings(context: 'homepage' | 'chat' | 'shared'): NaturalVoiceSettings {
  switch (context) {
    case 'homepage':
      return {
        stability: 0.70,           // Higher stability for more consistent voice
        similarity_boost: 0.85,    // Higher similarity to preserve voice character
        style: 0.00,              // No style for maximum consistency
        use_speaker_boost: false   // Disable speaker boost to avoid accent modifications
      };
    case 'chat':
      return getNaturalVoiceSettings(); // Close to original voice for personal chat
    case 'shared':
      return getExpressiveVoiceSettings(); // More expressive for shared experiences
    default:
      return getNaturalVoiceSettings();
  }
}

/**
 * Get ultra-consistent settings for homepage demo
 * These settings prioritize voice consistency over natural variation
 */
export function getHomepageDemoSettings(): NaturalVoiceSettings {
  return {
    stability: 0.75,           // Very high stability for maximum consistency
    similarity_boost: 0.90,    // Very high similarity to match original voice exactly
    style: 0.00,              // No style for maximum consistency
    use_speaker_boost: false   // Disable speaker boost to avoid accent modifications
  };
}