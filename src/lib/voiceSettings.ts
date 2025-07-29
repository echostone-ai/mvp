/**
 * Get optimized voice settings for consistent voice cloning
 * These settings are tuned for maximum consistency between sentences
 */
export function getOptimizedVoiceSettings(customSettings?: any) {
  // Optimized settings for maximum consistency in streaming
  const defaultSettings = {
    stability: 0.95,           // Very high stability for consistent tone
    similarity_boost: 0.85,    // Balanced similarity (too high can cause artifacts)
    style: 0.05,              // Very low style for maximum consistency
    use_speaker_boost: true
  };

  // If custom settings are provided, merge them with defaults
  if (customSettings) {
    return {
      ...defaultSettings,
      ...customSettings
    };
  }

  return defaultSettings;
}

/**
 * Get voice settings specifically optimized for streaming consistency
 * These settings prioritize consistency over expressiveness
 */
export function getStreamingConsistencySettings() {
  return {
    stability: 0.99,           // Maximum stability for consistent voice
    similarity_boost: 0.75,    // Lower similarity to reduce artifacts that cause voice variation
    style: 0.01,              // Minimal style variation for consistency
    use_speaker_boost: true
  };
}

/**
 * Get voice settings for a specific improvement type
 */
export function getVoiceSettingsForImprovement(improvementType: string) {
  switch (improvementType) {
    case 'accent_consistency':
      return {
        stability: 0.90,           // Very high stability for consistent accent
        similarity_boost: 0.88,    // Balanced for voice matching
        style: 0.12,              // Very low style for consistency
        use_speaker_boost: true
      };

    case 'voice_similarity':
      return {
        stability: 0.85,           // High stability
        similarity_boost: 0.92,    // Very high similarity boost
        style: 0.15,              // Low style
        use_speaker_boost: true
      };

    case 'natural_expression':
      return {
        stability: 0.82,           // Slightly lower stability for expression
        similarity_boost: 0.90,    // High similarity
        style: 0.20,              // Higher style for expression
        use_speaker_boost: true
      };

    default:
      return getOptimizedVoiceSettings();
  }
}