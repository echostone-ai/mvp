/**
 * OpenAI Text-to-Speech Alternative
 * 
 * OpenAI's TTS is often more reliable and natural than ElevenLabs
 * for conversational AI applications.
 */

export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export interface OpenAIVoiceSettings {
  voice: OpenAIVoice;
  model: 'tts-1' | 'tts-1-hd';
  speed: number; // 0.25 to 4.0
}

/**
 * Get optimal OpenAI voice settings
 */
export function getOptimalOpenAISettings(): OpenAIVoiceSettings {
  return {
    voice: 'nova', // Natural, conversational voice
    model: 'tts-1-hd', // Higher quality
    speed: 1.0 // Natural speed
  };
}

/**
 * Generate voice using OpenAI TTS
 */
export async function generateOpenAIVoice(
  text: string,
  settings?: OpenAIVoiceSettings
): Promise<ArrayBuffer> {
  const voiceSettings = settings || getOptimalOpenAISettings();
  
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: voiceSettings.model,
      input: text.trim(),
      voice: voiceSettings.voice,
      speed: voiceSettings.speed,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI TTS failed: ${response.status}`);
  }

  return await response.arrayBuffer();
}

/**
 * Simple OpenAI voice streamer
 */
export class OpenAIVoiceStreamer {
  private settings: OpenAIVoiceSettings;
  private isPlaying = false;
  private currentAudio: HTMLAudioElement | null = null;

  constructor(settings?: OpenAIVoiceSettings) {
    this.settings = settings || getOptimalOpenAISettings();
  }

  async playText(text: string): Promise<void> {
    if (this.isPlaying) {
      this.stop();
    }

    this.isPlaying = true;

    try {
      const audioBuffer = await generateOpenAIVoice(text, this.settings);
      await this.playBuffer(audioBuffer);
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