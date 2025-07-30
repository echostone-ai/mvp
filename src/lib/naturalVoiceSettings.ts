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
    stability: 0.85,           // Higher stability for consistent accent and tone
    similarity_boost: 0.92,    // Very high similarity to stay very close to original voice
    style: 0.15,              // Lower style to reduce accent variation
    use_speaker_boost: true    // Enhance clarity while preserving character
  };
}

/**
 * Settings for conversational speech that sounds natural
 * Balanced between consistency and natural expression
 */
export function getConversationalVoiceSettings(): NaturalVoiceSettings {
  return {
    stability: 0.80,           // Higher stability for more consistent speech
    similarity_boost: 0.88,    // High similarity to original voice
    style: 0.20,              // Lower style for more consistency
    use_speaker_boost: true
  };
}

/**
 * Settings for expressive speech that maintains voice character
 * Allows more variation while staying true to the original voice
 */
export function getExpressiveVoiceSettings(): NaturalVoiceSettings {
  return {
    stability: 0.65,           // Lower stability for more expression
    similarity_boost: 0.92,    // Very high similarity to maintain voice identity
    style: 0.35,              // Higher style for expressiveness
    use_speaker_boost: true
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
    // Use ElevenLabs optimizations for natural speech
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
      return getConversationalVoiceSettings(); // Friendly and natural for demos
    case 'chat':
      return getNaturalVoiceSettings(); // Close to original voice for personal chat
    case 'shared':
      return getExpressiveVoiceSettings(); // More expressive for shared experiences
    default:
      return getNaturalVoiceSettings();
  }
}