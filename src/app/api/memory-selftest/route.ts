import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: Request) {
  const cookiesHeader = req.headers.get('cookie') || '';
  const cookieMap = Object.fromEntries(cookiesHeader.split(/;\s*/).filter(Boolean).map(p => {
    const idx = p.indexOf('=');
    return idx === -1 ? [p, ''] : [decodeURIComponent(p.slice(0, idx)), decodeURIComponent(p.slice(idx + 1))];
  }));

  let visitorId = cookieMap['jd_vid'] || '';
  let setVisitorCookie: string | null = null;
  if (!visitorId) {
    visitorId = uuidv4();
    setVisitorCookie = `jd_vid=${encodeURIComponent(visitorId)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }

  const canUseDb = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!canUseDb) {
    return NextResponse.json({ ok: false, step: 'env', error: 'Missing Supabase env vars' }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Resolve avatar id once
  const { data: prof, error: profErr } = await supabase
    .from('avatar_profiles')
    .select('id')
    .eq('name', 'jonathan_braden')
    .single();

  if (profErr || !prof?.id) {
    return NextResponse.json({ ok: false, step: 'avatar', error: profErr?.message || 'avatar not found' }, { status: 500 });
  }

  const avatarId = prof.id;

  // 1) write a test row
  const payload = {
    avatar_id: avatarId,
    fragment_text: `SELFTEST ping @ ${new Date().toISOString()}`,
    conversation_context: {
      source: 'selftest',
      type: 'user',
      conversation_id: 'jonathan-demo',
      visitor_id: visitorId,
      tags: ['selftest']
    }
  };

  const { error: insErr } = await supabase.from('memory_fragments').insert(payload);
  if (insErr) {
    return NextResponse.json({ ok: false, step: 'insert', error: insErr.message }, { status: 500 });
  }

  // 2) read it back (superset query: match visitor or legacy null)
  const { data: rows, error: readErr } = await supabase
    .from('memory_fragments')
    .select('id, fragment_text, conversation_context, created_at')
    .eq('avatar_id', avatarId)
    .or(`conversation_context->>visitor_id.eq.${visitorId},conversation_context->>visitor_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(10);

  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (setVisitorCookie) headers.append('Set-Cookie', setVisitorCookie);

  if (readErr) {
    return new Response(JSON.stringify({ ok: false, step: 'read', error: readErr.message }), { status: 500, headers });
  }

  const found = rows?.some(r => r.conversation_context?.visitor_id === visitorId && String(r.fragment_text).startsWith('SELFTEST'));
  return new Response(JSON.stringify({
    ok: !!found,
    step: 'done',
    visitorId,
    wrote: payload.fragment_text,
    matchedRows: rows?.length || 0
  }, null, 2), { status: 200, headers });
}