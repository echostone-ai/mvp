// src/lib/voice/runtime.ts
// Unified streaming runtime: minimal clause splitter → TTS → gapless player.

import { gaplessPlayer } from './player';
import { AnyAudioSource } from './tts';
import { VoiceProfile, preprocessForButter, getButterProfile } from './presets';

// Very small clause splitter (fallback if you don't want to import your old SentenceProcessor)
function splitIntoClauses(text: string): string[] {
  const parts: string[] = [];
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return parts;
  // Split on ., !, ?, or long pause commas/semicolons
  const regex = /[^.!?;]+[.!?;]?/g;
  const matches = normalized.match(regex);
  if (!matches) return [normalized];
  for (const m of matches) {
    const s = m.trim();
    if (s.length) parts.push(s);
  }
  return parts;
}

type GenerateFn = (text: string, profile: VoiceProfile) => Promise<AnyAudioSource>;

export function createVoiceRuntime(opts?: {
  profile?: Partial<VoiceProfile>;
  generate: GenerateFn; // you plug your provider here
}) {
  const profile: VoiceProfile = getButterProfile(opts?.profile);

  let destroyed = false;
  let inFlight = 0;
  const maxInFlight = 3;
  const queue: string[] = [];

  async function produce() {
    if (destroyed) return;
    while (!destroyed && queue.length && inFlight < maxInFlight) {
      const sentence = queue.shift()!;
      inFlight++;
      try {
        const audio = await opts!.generate(sentence, profile);
        await gaplessPlayer.enqueue(audio);
      } catch (e) {
        // keep going
        console.warn('[voice-runtime] TTS error; skipping sentence:', e);
      } finally {
        inFlight--;
      }
    }
  }

  return {
    async unlock() {
      await gaplessPlayer.unlock();
    },
    async start() {
      // no-op hook for parity with other UIs
    },
    async say(text: string) {
      if (destroyed || !text) return;
      const clean = preprocessForButter(text);
      const clauses = splitIntoClauses(clean);
      for (const c of clauses) queue.push(c);
      await produce();
    },
    async complete() {
      // try to drain
      await produce();
    },
    stop() {
      destroyed = true;
      gaplessPlayer.stopAll();
    },
    isPlaying() {
      return gaplessPlayer.getIsPlaying();
    },
  };
}
