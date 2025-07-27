/**
 * Improved Voice Configuration for Better Consistency
 * Optimized settings to reduce accent variation and improve voice similarity
 */

export interface ImprovedVoiceSettings {
  // Core voice parameters optimized for consistency
  stability: number;           // 0.85-0.95 for accent consistency
  similarity_boost: number;    // 0.85-0.90 for voice matching
  style: number;              // 0.1-0.2 for consistent delivery
  use_speaker_boost: boolean;  // Always true for clarity
  optimize_streaming_latency: number; // 0.3-0.5 for quality
  model_id: 'eleven_turbo_v2_5' | 'eleven_multilingual_v2';
}

export interface VoiceTrainingRequirements {
  minSamples: number;
  maxSamples: number;
  minDurationPerSample: number;
  maxDurationPerSample: number;
  requiredSampleRate: number;
  preferredFormats: string[];
  consistencyChecks: boolean;
}

// Optimized settings for accent consistency
export const ACCENT_CONSISTENT_SETTINGS: ImprovedVoiceSettings = {
  stability: 0.90,              // High stability for consistent accent
  similarity_boost: 0.88,       // Balanced for good voice matching
  style: 0.12,                 // Low style for consistent delivery
  use_speaker_boost: true,      // Enhanced clarity
  optimize_streaming_latency: 0.4, // Balanced quality/speed
  model_id: 'eleven_turbo_v2_5'
};

// Settings for expressive but consistent voice
export const EXPRESSIVE_CONSISTENT_SETTINGS: ImprovedVoiceSettings = {
  stability: 0.85,              // Slightly lower for more expression
  similarity_boost: 0.90,       // Higher for better voice match
  style: 0.18,                 // Moderate style for some variation
  use_speaker_boost: true,
  optimize_streaming_latency: 0.3,
  model_id: 'eleven_turbo_v2_5'
};

// Enhanced training requirements
export const IMPROVED_TRAINING_REQUIREMENTS: VoiceTrainingRequirements = {
  minSamples: 5,                // Increased from 3
  maxSamples: 10,               // More samples for better training
  minDurationPerSample: 30,     // Longer samples for better quality
  maxDurationPerSample: 120,    // Not too long to avoid fatigue
  requiredSampleRate: 44100,    // High quality audio
  preferredFormats: ['audio/wav', 'audio/flac', 'audio/m4a'],
  consistencyChecks: true       // Validate consistency across samples
};

// Improved training scripts for better accent capture
export const ACCENT_TRAINING_SCRIPTS = {
  natural_conversation: {
    title: "Natural Conversation",
    description: "Captures your natural speaking patterns and accent",
    text: `Hi there! I'm really glad we have a chance to chat today. I find that the best conversations happen when we're both relaxed and being ourselves. I'd love to hear about what's been on your mind lately, or maybe we could explore some interesting topics together. What do you think would be fun to discuss?`
  },
  
  expressive_storytelling: {
    title: "Expressive Storytelling", 
    description: "Captures emotional range while maintaining accent consistency",
    text: `Let me tell you about something that happened to me recently. I was walking down the street when I noticed something unusual. At first, I wasn't sure what to make of it, but then I realized it was actually quite fascinating. It made me think about how we often overlook the interesting details in our everyday lives.`
  },
  
  professional_explanation: {
    title: "Professional Explanation",
    description: "Captures clear, articulate speech patterns",
    text: `I'd like to explain this concept in a way that makes sense. The key thing to understand is that there are several important factors to consider. First, we need to look at the overall context. Then, we can examine the specific details that matter most. Finally, we can draw some meaningful conclusions from what we've learned.`
  },
  
  casual_reflection: {
    title: "Casual Reflection",
    description: "Captures relaxed, thoughtful speech patterns",
    text: `You know, I've been thinking about this quite a bit lately. It's interesting how our perspectives can change over time, isn't it? Sometimes what seemed really important before doesn't feel as significant now. And other times, we discover new things that become really meaningful to us.`
  },
  
  enthusiastic_sharing: {
    title: "Enthusiastic Sharing",
    description: "Captures excited, energetic speech while maintaining accent",
    text: `Oh, I'm so excited to share this with you! This is something I'm really passionate about, and I think you'll find it fascinating too. There are so many amazing aspects to explore, and each one is more interesting than the last. I can't wait to hear what you think about it!`
  }
};

// Voice quality validation functions
export class VoiceConsistencyValidator {
  
  /**
   * Validate that training samples have consistent accent patterns
   */
  static async validateAccentConsistency(audioFiles: File[]): Promise<{
    isConsistent: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check minimum requirements
    if (audioFiles.length < IMPROVED_TRAINING_REQUIREMENTS.minSamples) {
      issues.push(`Need at least ${IMPROVED_TRAINING_REQUIREMENTS.minSamples} audio samples for consistent results`);
      recommendations.push(`Record ${IMPROVED_TRAINING_REQUIREMENTS.minSamples - audioFiles.length} more samples`);
    }
    
    // Check duration consistency
    const durations = await Promise.all(audioFiles.map(file => this.getAudioDuration(file)));
    const avgDuration = durations.reduce((sum, dur) => sum + dur, 0) / durations.length;
    const durationVariance = durations.some(dur => Math.abs(dur - avgDuration) > 30);
    
    if (durationVariance) {
      issues.push('Large variation in sample durations detected');
      recommendations.push('Try to keep all samples between 30-120 seconds for consistency');
    }
    
    // Check file quality
    const lowQualityFiles = audioFiles.filter(file => file.size / 1024 < 100); // Less than 100KB
    if (lowQualityFiles.length > 0) {
      issues.push(`${lowQualityFiles.length} files appear to be low quality`);
      recommendations.push('Re-record low quality samples with better audio settings');
    }
    
    const isConsistent = issues.length === 0;
    
    if (isConsistent) {
      recommendations.push('Audio samples look good for consistent voice training!');
    }
    
    return { isConsistent, issues, recommendations };
  }
  
  /**
   * Get audio duration from file
   */
  private static async getAudioDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.addEventListener('loadedmetadata', () => {
        resolve(audio.duration);
      });
      audio.addEventListener('error', () => {
        resolve(0); // Return 0 if can't determine duration
      });
      audio.src = URL.createObjectURL(file);
    });
  }
  
  /**
   * Generate recommendations for voice improvement
   */
  static generateImprovementRecommendations(currentSettings: ImprovedVoiceSettings): string[] {
    const recommendations: string[] = [];
    
    if (currentSettings.stability < 0.85) {
      recommendations.push('Increase stability to 0.85-0.90 for more consistent accent');
    }
    
    if (currentSettings.similarity_boost < 0.85) {
      recommendations.push('Increase similarity boost to 0.85-0.90 for better voice matching');
    }
    
    if (currentSettings.style > 0.2) {
      recommendations.push('Reduce style setting to 0.1-0.2 for more consistent delivery');
    }
    
    if (!currentSettings.use_speaker_boost) {
      recommendations.push('Enable speaker boost for improved voice clarity');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Voice settings are optimized for consistency!');
    }
    
    return recommendations;
  }
}

// Export optimized configurations
export const VOICE_CONSISTENCY_CONFIG = {
  settings: ACCENT_CONSISTENT_SETTINGS,
  requirements: IMPROVED_TRAINING_REQUIREMENTS,
  scripts: ACCENT_TRAINING_SCRIPTS,
  validator: VoiceConsistencyValidator
};