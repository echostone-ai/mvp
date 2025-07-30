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
    stability: 0.50,           // Lower stability for more natural voice (prevents robotic speech)
    similarity_boost: 0.75,    // Good similarity to preserve voice character (prevents accent variations)
    style: 0.00,              // No style for maximum consistency
    use_speaker_boost: false   // Disable speaker boost for cleaner audio
  };
}

/**
 * Settings for conversational speech that sounds natural
 * Balanced between consistency and natural expression
 */
export function getConversationalVoiceSettings(): NaturalVoiceSettings {
  return {
    stability: 0.50,           // Lower stability for more natural voice
    similarity_boost: 0.75,    // Good similarity to preserve voice character
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
    stability: 0.45,           // Lower stability for more expression
    similarity_boost: 0.70,    // Good similarity to maintain voice identity
    style: 0.15,              // Low style for natural expressiveness
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
        stability: 0.50,           // Lower stability for more natural voice
        similarity_boost: 0.75,    // Good similarity to preserve voice character
        style: 0.00,              // No style for maximum consistency
        use_speaker_boost: false   // Disable speaker boost for cleaner audio
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
    stability: 0.60,           // Slightly higher stability for consistency
    similarity_boost: 0.80,    // Higher similarity to match ElevenLabs voice
    style: 0.00,              // No style for maximum consistency
    use_speaker_boost: false   // Disable speaker boost for cleaner audio
  };
}