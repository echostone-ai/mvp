/**
 * Simple, Reliable Voice System
 * 
 * This replaces the over-engineered voice system with a clean, direct approach
 * that prioritizes reliability and natural voice reproduction.
 */

export interface SimpleVoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

/**
 * Get the optimal settings for natural voice reproduction
 * These are the settings that work best with ElevenLabs for natural speech
 */
export function getOptimalVoiceSettings(): SimpleVoiceSettings {
  return {
    stability: 0.5,        // ElevenLabs default - natural variation
    similarity_boost: 0.8, // High similarity to original voice
    style: 0.0,           // No style modification - use original voice character
    use_speaker_boost: true
  };
}

/**
 * Simple voice generation - no streaming, no complex processing
 * Just generate the entire response at once for reliability
 */
export async function generateVoice(
  text: string, 
  voiceId: string,
  settings?: SimpleVoiceSettings
): Promise<ArrayBuffer> {
  const voiceSettings = settings || getOptimalVoiceSettings();
  
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY || process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || '',
      },
      body: JSON.stringify({
        text: text.trim(), // Minimal processing - just trim whitespace
        model_id: 'eleven_multilingual_v2',
        voice_settings: voiceSettings,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Voice generation failed: ${response.status}`);
  }

  return await response.arrayBuffer();
}

/**
 * Play audio from buffer with proper error handling
 */
export async function playAudioBuffer(audioBuffer: ArrayBuffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      resolve();
    };
    
    audio.onerror = (error) => {
      URL.revokeObjectURL(audioUrl);
      reject(error);
    };
    
    // Set optimal playback settings
    audio.volume = 1.0;
    audio.playbackRate = 1.0;
    
    audio.play().catch(reject);
  });
}

/**
 * Simple streaming for long responses
 * Split into natural sentences and play sequentially
 */
export class SimpleVoiceStreamer {
  private voiceId: string;
  private settings: SimpleVoiceSettings;
  private isPlaying = false;
  private currentAudio: HTMLAudioElement | null = null;

  constructor(voiceId: string, settings?: SimpleVoiceSettings) {
    this.voiceId = voiceId;
    this.settings = settings || getOptimalVoiceSettings();
  }

  async playText(text: string): Promise<void> {
    if (this.isPlaying) {
      this.stop();
    }

    this.isPlaying = true;

    try {
      // Split into natural sentences
      const sentences = text
        .split(/(?<=[.!?])\s+/)
        .filter(s => s.trim().length > 0);

      // Play each sentence sequentially
      for (const sentence of sentences) {
        if (!this.isPlaying) break; // Allow interruption

        const audioBuffer = await generateVoice(sentence, this.voiceId, this.settings);
        await this.playBuffer(audioBuffer);
      }
    } finally {
      this.isPlaying = false;
    }
  }

  private async playBuffer(audioBuffer: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      
      this.currentAudio = audio;
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        resolve();
      };
      
      audio.onerror = (error) => {
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        reject(error);
      };
      
      audio.volume = 1.0;
      audio.playbackRate = 1.0;
      audio.play().catch(reject);
    });
  }

  stop(): void {
    this.isPlaying = false;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }
}