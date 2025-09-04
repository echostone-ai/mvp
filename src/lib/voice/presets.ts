// src/lib/voice/presets.ts
export type VoiceProfile = {
    provider?: 'elevenlabs' | 'openai' | 'other';
    voiceId?: string;
    settings: {
      stability?: number;
      similarity_boost?: number;
      style?: number;
      use_speaker_boost?: boolean;
    };
    optimization: {
      sentence_chunk_ms?: number;
      min_buffer_ahead_ms?: number;
      crossfade_ms?: number;
      streaming_latency?: number;
      output_format?: string;
    };
  };
  
  export function getButterProfile(base: Partial<VoiceProfile> = {}): VoiceProfile {
    return {
      provider: base.provider ?? 'elevenlabs',
      voiceId: base.voiceId ?? undefined,
      settings: {
        stability: Math.min(0.82, base.settings?.stability ?? 0.75),
        similarity_boost: Math.max(0.9, base.settings?.similarity_boost ?? 0.9),
        style: 0,
        use_speaker_boost: false,
      },
      optimization: {
        sentence_chunk_ms: 900,
        min_buffer_ahead_ms: 240,
        crossfade_ms: 28,
        streaming_latency: Math.min(2, base.optimization?.streaming_latency ?? 3),
        output_format: base.optimization?.output_format ?? 'mp3_44100_128',
      },
    };
  }
  
  export function preprocessForButter(text: string): string {
    return text
      .trim()
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\.\.\./g, '… ')
      .replace(/([,!?:;])(?=\S)/g, '$1 ')
      .replace(/\bAI\b/g, 'A.I.')
      .replace(/\bAPI\b/g, 'A.P.I.')
      .replace(/\bUI\b/g, 'U.I.')
      .replace(/[^\w\s.,!?;:'"()–-…]/g, '');
  }
  