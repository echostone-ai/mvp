import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveVoiceIdForAvatar } from '@/lib/services/voice'

export const runtime = 'nodejs'

// Consolidated TTS POST: resolve per-avatar ElevenLabs voice, with Jonathan fallback, else default
export async function POST(req: Request) {
  try {
    const { avatarId, text, name, voiceId: bodyVoiceId } = await req.json()
    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const voiceId = bodyVoiceId || await resolveVoiceIdForAvatar(supabaseAdmin, avatarId || '', name)
    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      // Fallback: return a short tone so the UI can still play audio
      const wav = makeToneWav()
      return new NextResponse(wav, { headers: { 'Content-Type': 'audio/wav' } })
    }

    const body = {
      text,
      model_id: process.env.ELEVENLABS_MODEL_ID || 'eleven_monolingual_v1',
      voice_settings: { stability: 0.5, similarity_boost: 0.7 }
    }

    const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey, 'Accept': 'audio/mpeg' },
      body: JSON.stringify(body),
    })
    if (!resp.ok) {
      // Return tone fallback on provider error
      const wav = makeToneWav(500, 660)
      return new NextResponse(wav, { headers: { 'Content-Type': 'audio/wav' } })
    }
    const audio = await resp.arrayBuffer()
    return new NextResponse(audio, { headers: { 'Content-Type': 'audio/mpeg' } })
  } catch (e: any) {
    // On unexpected errors, still return a tone to keep UX flowing
    const wav = makeToneWav(400, 520)
    return new NextResponse(wav, { headers: { 'Content-Type': 'audio/wav' } })
  }
}

// Minimal WAV tone generator fallback
function makeToneWav(ms = 700, freq = 440, sampleRate = 16000, volume = 0.85): Uint8Array {
  const n = Math.floor(sampleRate * (ms / 1000))
  const buf = new ArrayBuffer(44 + n * 2)
  const dv = new DataView(buf)
  const W = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)) }
  W(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); W(8, 'WAVE'); W(12, 'fmt ')
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true)
  dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * 2, true)
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); W(36, 'data'); dv.setUint32(40, n * 2, true)
  let off = 44
  for (let i = 0; i < n; i++) {
    const s = Math.sin(2 * Math.PI * freq * (i / sampleRate)) * volume
    dv.setInt16(off, Math.max(-1, Math.min(1, s)) * 0x7fff, true)
    off += 2
  }
  return new Uint8Array(buf)
}
