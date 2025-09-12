export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { featureFlagManager } from '@/lib/config/featureFlags';
import { factbookService } from '@/lib/services/factbookService';
import { lightweightAnalyzer } from '@/lib/services/lightweightAnalyzer';
import fs from 'fs';
import path from 'path';

let FACTBOOK_LOADED = false;

function ensureFactbookLoaded() {
  if (FACTBOOK_LOADED) return;
  const factbookPath = path.join(process.cwd(), 'data/jonathan_profile_factbook.json');
  const content = fs.readFileSync(factbookPath, 'utf-8');
  const data = JSON.parse(content);
  factbookService.loadFactbook(data);
  FACTBOOK_LOADED = true;
}

function createSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function resolveAvatarId(supabase: ReturnType<typeof createClient>, avatarSlug: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('avatar_profiles')
      .select('id')
      .eq('name', avatarSlug)
      .single();
    if (error || !data?.id) return null;
    return data.id as string;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const t0 = Date.now();
  try {
    const body = await req.json();
    const action = String(body.action || '').trim();
    const avatarSlug = String(body.avatarSlug || body.avatar || 'jonathan-demo');
    const text = typeof body.text === 'string' ? body.text : '';
    const conversationId = String(body.conversationId || 'jonathan-demo');

    ensureFactbookLoaded();

    // Warm cache: best-effort, quick return
    if (action === 'warmCache') {
      return NextResponse.json({ success: true, warmed: true });
    }

    const supabase = createSb();
    if (!supabase) {
      // Still serve factbook-only context quickly
      if (action === 'getMemoryContext') {
        const a0 = Date.now();
        const analysis = lightweightAnalyzer.analyzeQuery(text || '');
        const snippets = factbookService.querySnippets(analysis.keywords, 5);
        const memoryContext = snippets.map(s => `- ${s.text}`).join('\n');
        const retrievalTimeMs = Date.now() - a0;
        return NextResponse.json({
          memoryContext,
          continuityContext: '',
          memoryCount: snippets.length,
          totalTokens: Math.max(16, memoryContext.split(/\s+/).length),
          retrievalTimeMs,
          cacheHit: true,
          fallbackUsed: true,
        });
      }
      return NextResponse.json({ success: false, error: 'Supabase env not configured' }, { status: 500 });
    }

    const avatarId = await resolveAvatarId(supabase, avatarSlug);
    if (!avatarId) {
      // fallback to factbook-only
      if (action === 'getMemoryContext') {
        const a0 = Date.now();
        const analysis = lightweightAnalyzer.analyzeQuery(text || '');
        const snippets = factbookService.querySnippets(analysis.keywords, 5);
        const memoryContext = snippets.map(s => `- ${s.text}`).join('\n');
        const retrievalTimeMs = Date.now() - a0;
        return NextResponse.json({
          memoryContext,
          continuityContext: '',
          memoryCount: snippets.length,
          totalTokens: Math.max(16, memoryContext.split(/\s+/).length),
          retrievalTimeMs,
          cacheHit: true,
          fallbackUsed: true,
        });
      }
      return NextResponse.json({ success: false, error: `Avatar not found: ${avatarSlug}` }, { status: 404 });
    }

    const systemUserId = process.env.DEMO_SYSTEM_USER_ID || process.env.SYSTEM_USER_ID || '';
    const ttlMinutesEnv = String(process.env.DEMO_MEMORY_TTL_MINUTES || '10');
    const ttlMinutes = Math.max(0, parseInt(ttlMinutesEnv, 10) || 0);
    const expiresAt = ttlMinutes > 0 ? new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString() : null;

    if (action === 'getMemoryContext') {
      const a0 = Date.now();

      // Fast: analyze and aggregate factbook snippets (keywords + topic fallback)
      const analysis = lightweightAnalyzer.analyzeQuery(text || '');
      let snippets = factbookService.querySnippets(analysis.keywords, 12);
      
      // Topic-based augmentation when keyword hits are sparse
      if (snippets.length < 4) {
        const merged = new Map<string, ReturnType<typeof factbookService.querySnippets>[number]>();
        for (const s of snippets) merged.set(s.id, s);
        
        const topicsToAugment = new Set<string>(analysis.topics || []);
        // Add related topics for broader coverage
        if (topicsToAugment.has('places')) {
          topicsToAugment.add('timeline');
          topicsToAugment.add('identity');
        }
        if (topicsToAugment.has('people')) {
          topicsToAugment.add('relationships');
        }
        
        for (const topic of topicsToAugment) {
          try {
            const topicSnips = factbookService.getSnippetsByTopic(topic) || [];
            for (const snip of topicSnips) {
              if (!merged.has(snip.id)) merged.set(snip.id, snip);
            }
          } catch {}
        }
        
        // Re-rank deterministically by original text length and id, keep concise
        const mergedList = Array.from(merged.values()).sort((a, b) => {
          if (a.text.length !== b.text.length) return a.text.length - b.text.length;
          return a.id.localeCompare(b.id);
        });
        snippets = mergedList.slice(0, 12);
      }

      // Recent demo turns for continuity
      const { data: rows } = await supabase
        .from('memory_fragments')
        .select('fragment_text, conversation_context, created_at')
        .eq('avatar_id', avatarId)
        .eq('user_id', systemUserId)
        .eq('conversation_context->>conversation_id', 'jonathan-demo')
        .order('created_at', { ascending: false })
        .limit(12);

      // Most recent first with role labels for clarity
      const continuityTurns = (rows || [])
        .map(r => ({
          text: String(r.fragment_text || '').trim(),
          role: (r as any).conversation_context?.type === 'assistant' ? 'Assistant' : 'User',
          ts: r.created_at
        }))
        .filter(t => t.text.length > 0);
      const continuityContext = continuityTurns
        .slice(0, 8)
        .map(t => `${t.role}: ${t.text}`)
        .join('\n');

      const memoryContext = snippets.map(s => `- ${s.text}`).join('\n');
      const retrievalTimeMs = Date.now() - a0;

      return NextResponse.json({
        memoryContext,
        continuityContext,
        memoryCount: (snippets?.length || 0) + (continuityTurns?.length || 0),
        totalTokens: Math.max(16, (memoryContext + '\n' + continuityContext).split(/\s+/).length),
        retrievalTimeMs,
        cacheHit: true,
        fallbackUsed: false,
      });
    }

    if (action === 'storeConversationTurn') {
      const userMessage = typeof body.userMessage === 'string' ? body.userMessage : '';
      const assistantResponse = typeof body.assistantResponse === 'string' ? body.assistantResponse : '';
      const toInsert: any[] = [];
      if (userMessage.trim()) {
        toInsert.push({
          user_id: systemUserId,
          avatar_id: avatarId,
          fragment_text: userMessage.trim(),
          conversation_context: {
            source: 'jonathan-demo-ui',
            type: 'user',
            conversation_id: 'jonathan-demo',
            visitor_id: systemUserId,
            expires_at: expiresAt,
            tags: ['query', 'raw_turn']
          },
        });
      }
      if (assistantResponse.trim()) {
        toInsert.push({
          user_id: systemUserId,
          avatar_id: avatarId,
          fragment_text: assistantResponse.trim(),
          conversation_context: {
            source: 'jonathan-demo-ui',
            type: 'assistant',
            conversation_id: 'jonathan-demo',
            gist: (assistantResponse.split(/\n|(?<=\.)\s+/)[0] || '').slice(0, 200),
            visitor_id: systemUserId,
            expires_at: expiresAt,
            tags: ['reply', 'raw_turn']
          },
        });
      }
      if (toInsert.length > 0) {
        try { await supabase.from('memory_fragments').insert(toInsert); } catch {}
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  } finally {
    try {
      const dt = Date.now() - t0;
      if (dt > 350) {
        // lightweight log
        // eslint-disable-next-line no-console
        console.warn('jonathan-demo/memory_slow', { ms: dt });
      }
    } catch {}
  }
}