export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const cache = new Map<string, { voiceId: string; ts: number }>();
const TTL_MS = 5 * 60 * 1000;

function createSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const avatar = searchParams.get('avatar') || searchParams.get('avatarSlug') || 'jonathan-demo';

    const cached = cache.get(avatar);
    if (cached && Date.now() - cached.ts < TTL_MS) {
      return NextResponse.json({ voiceId: cached.voiceId, cached: true });
    }

    // Check env overrides first
    const envKey = `VOICE_ID_${avatar.replace(/[^A-Za-z0-9]/g, '_').toUpperCase()}`;
    const envOverride = process.env[envKey] || process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const voiceId = (envOverride as string) || 'CO6pxVrMZfyL61ZIglyr';
      cache.set(avatar, { voiceId, ts: Date.now() });
      return NextResponse.json({ voiceId, cached: false, source: 'env' });
    }

    const supabase = createSb();
    if (!supabase) {
      const voiceId = (envOverride as string) || 'CO6pxVrMZfyL61ZIglyr';
      cache.set(avatar, { voiceId, ts: Date.now() });
      return NextResponse.json({ voiceId, cached: false, source: 'env' });
    }

    // Resolve avatar id
    const { data: avatarRow } = await supabase
      .from('avatar_profiles')
      .select('id')
      .eq('name', avatar)
      .single();

    if (!avatarRow?.id) {
      const voiceId = (envOverride as string) || 'CO6pxVrMZfyL61ZIglyr';
      cache.set(avatar, { voiceId, ts: Date.now() });
      return NextResponse.json({ voiceId, cached: false, source: 'env' });
    }

    // Try exact mapping table if present
    let voiceId: string | null = null;
    try {
      const { data: mapping } = await supabase
        .from('avatar_voice_mappings')
        .select('voice_id')
        .eq('avatar_id', avatarRow.id)
        .single();
      voiceId = (mapping as any)?.voice_id || null;
    } catch {}

    if (!voiceId) {
      // Fallback: check profile column if exists
      try {
        const { data: prof } = await supabase
          .from('avatar_profiles')
          .select('voice_id')
          .eq('id', avatarRow.id)
          .single();
        voiceId = (prof as any)?.voice_id || null;
      } catch {}
    }

    if (!voiceId) {
      voiceId = (envOverride as string) || 'CO6pxVrMZfyL61ZIglyr';
    }

    cache.set(avatar, { voiceId, ts: Date.now() });
    return NextResponse.json({ voiceId, cached: false, source: 'db' });
  } catch (error: any) {
    const fallback = (process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID as string) || 'CO6pxVrMZfyL61ZIglyr';
    return NextResponse.json({ voiceId: fallback, error: error?.message }, { status: 200 });
  }
}