export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
  if (process.env.NODE_ENV !== 'development') return NextResponse.json({ error: 'dev only' }, { status: 403 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Supabase admin client not initialized' }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const idParam = searchParams.get('id') || '';
  const avatarParam = searchParams.get('avatar') || '';
  let avatarId = idParam;

  if (!avatarId && avatarParam) {
    const { data: prof, error: profErr } = await supabaseAdmin
      .from('avatar_profiles')
      .select('id')
      .eq('name', avatarParam)
      .single();
    if (profErr || !prof) return NextResponse.json({ error: 'avatar not found' }, { status: 404 });
    avatarId = prof.id;
  }

  if (!avatarId) return NextResponse.json({ error: 'id (uuid) or avatar (name) is required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('quick_facts')
    .select('id,key,value,priority,confidence,expires_at,updated_at,source_reference')
    .eq('avatar_id', avatarId)
    .or('expires_at.is.null,expires_at.gt.now()')
    .order('priority', { ascending: true })
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}