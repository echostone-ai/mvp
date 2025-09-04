export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cache for 10 min
const voiceCache = new Map<string, { voiceId: string; settings: any; exp: number }>();

export async function GET(req: Request) {
  const avatar = new URL(req.url).searchParams.get('avatar')!;
  const now = Date.now();
  const key = avatar || 'default';
  const hit = voiceCache.get(key);
  
  if (hit && hit.exp > now) {
    return Response.json(hit);
  }
  
  const voiceId = process.env.JONATHAN_DEMO_VOICE_ID || process.env.ELEVENLABS_VOICE_ID || 'CO6pxVrMZfyL61ZIglyr';
  const settings = { 
    stability: 0.5, 
    similarity_boost: 0.85,
    style: 0.0,
    use_speaker_boost: true
  };
  
  const val = { voiceId, settings, exp: now + 10 * 60 * 1000 };
  voiceCache.set(key, val);
  
  return Response.json(val);
}