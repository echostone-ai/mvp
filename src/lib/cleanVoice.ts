/**
 * Clean, Simple ElevenLabs Voice Implementation
 * 
 * This strips away ALL the complexity and uses ElevenLabs defaults
 * for the most natural voice reproduction possible.
 */

/**
 * Generate voice using ElevenLabs with ZERO processing
 * Uses ElevenLabs default settings for most natural results
 */
export async function generateCleanVoice(
  text: string,
  voiceId: string
): Promise<ArrayBuffer> {
  
  const apiKey = process.env.ELEVENLABS_API_KEY || process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    throw new Error('ElevenLabs API key not found');
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: text, // NO processing - send exactly as is
        model_id: 'eleven_multilingual_v2',
        // NO voice_settings - use ElevenLabs defaults for most natural voice
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('ElevenLabs error:', errorText);
    throw new Error(`ElevenLabs API failed: ${response.status}`);
  }

  return await response.arrayBuffer();
}

/**
 * Play audio buffer with proper error handling
 */
export async function playCleanAudio(audioBuffer: ArrayBuffer): Promise<void> {
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
    
    // Use browser defaults - no custom settings
    audio.play().catch(reject);
  });
}

/**
 * Simple voice player for complete responses
 * NO streaming, NO complex processing - just play the whole thing
 */
export class CleanVoicePlayer {
  private voiceId: string;
  private currentAudio: HTMLAudioElement | null = null;
  private isPlaying = false;

  constructor(voiceId: string) {
    this.voiceId = voiceId;
  }

  async playText(text: string): Promise<void> {
    // Stop any existing audio
    this.stop();
    
    this.isPlaying = true;

    try {
      console.log('Generating voice for:', text.substring(0, 50) + '...');
      
      // Generate the entire response at once - NO streaming
      const audioBuffer = await generateCleanVoice(text, this.voiceId);
      
      console.log('Playing audio buffer, size:', audioBuffer.byteLength);
      
      // Play the complete audio
      await this.playBuffer(audioBuffer);
      
    } catch (error) {
      console.error('Voice generation failed:', error);
      throw error;
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
      
      // No custom settings - use browser/ElevenLabs defaults
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

  getIsPlaying(): boolean {
    return this.isPlaying;
  }
}