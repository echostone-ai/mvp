/**
 * Hybrid Streaming Handler - Main orchestrator for Fast Lane + Deep Lane architecture
 * Implements the complete hybrid streaming flow with persistent session context
 */

import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { sessionCache, deriveSessionId, createSessionKey, SessionContext } from './sessionCache';
import { composeFastLaneSeed, createMinimalPersonaSeed } from './fastLaneSeed';
import { runDeepLane, buildSessionContext } from './deepLaneOrchestrator';
import { hybridStream, createStreamResponse, StreamingMetrics } from './streamingCoordinator';
import { logger } from '@/lib/logger';

// Configuration constants
const DEMO_AVATAR_SLUG = process.env.DEMO_AVATAR_SLUG || 'jonathan-demo';
const DEMO_COOKIE_NAME = process.env.DEMO_COOKIE_NAME || 'jd_demo_vid';
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes
const AVATAR_ID_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Avatar ID cache
const avatarIdCache = new Map<string, { avatarId: string | null; expiresAt: number }>();

// OpenAI client (reusable)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface HybridStreamingRequest {
  avatarSlug: string;
  message: string;
  visitorCookie?: string;
  authUserId?: string;
  debug?: boolean;
}

export interface HybridStreamingResponse {
  stream?: Response;
  debug?: any;
  setCookie?: string;
}

/**
 * Main hybrid streaming handler
 */
export async function handleHybridStreaming(
  req: NextRequest,
  body: HybridStreamingRequest
): Promise<HybridStreamingResponse> {
  const t0 = Date.now();
  const { avatarSlug, message, debug = false } = body;
  
  // Step 1: Request intake - Parse and resolve basic info
  const isDemo = avatarSlug === DEMO_AVATAR_SLUG;
  const avatarId = await getAvatarIdCached(avatarSlug);
  
  if (!avatarId) {
    throw new Error(`Avatar not found: ${avatarSlug}`);
  }

  // Step 2: Cookie and session handling
  const { visitorId, setCookie } = handleVisitorCookie(req, isDemo);
  const sessionId = deriveSessionId(avatarId, visitorId, body.authUserId);
  const sessionKey = createSessionKey(avatarId, sessionId);

  // Step 3: Load or build session context
  let sessionCtx = sessionCache.get(sessionKey);
  if (!sessionCtx) {
    // Cache miss - build new session context
    sessionCtx = await buildSessionContext({
      avatarId,
      avatarSlug,
      isDemo,
      sessionId,
      visitorId
    });
    sessionCache.set(sessionKey, sessionCtx, SESSION_TTL_MS);
  } else {
    // Cache hit - touch to update TTL
    sessionCache.touch(sessionKey);
  }

  // Step 4: Update session context with current turn
  updateSessionContextWithUserMessage(sessionCtx, message);

  if (debug) {
    return {
      debug: {
        avatarId,
        sessionId,
        isDemo,
        sessionCtx: {
          personaSeedLength: sessionCtx.personaSeed.length,
          lastTurnsCount: sessionCtx.lastTurns.length,
          friendEntitiesCount: Object.keys(sessionCtx.friendEntities).length,
          familyEntitiesCount: Object.keys(sessionCtx.familyEntities).length,
          hotMemoriesCount: sessionCtx.hotMemories.length
        },
        cacheStats: sessionCache.getStats?.() || 'N/A'
      },
      setCookie
    };
  }

  // Step 5: Branch execution - Fast Lane + Deep Lane
  const metrics = new StreamingMetrics();
  
  // Compose Fast Lane seed
  const fastLaneSeed = composeFastLaneSeed(sessionCtx, message);
  
  // Start Deep Lane in parallel
  const deepLaneIterator = runDeepLane({
    avatarId,
    avatarSlug,
    isDemo,
    sessionCtx,
    userText: message,
    visitorId,
    conversationId: isDemo ? 'jonathan-demo' : `chat-${visitorId}`,
    openaiClient: openai
  });

  // Step 6: Streaming orchestration
  const streamIterator = hybridStream({
    fastLaneSeed,
    deepLaneIterator,
    openaiClient: openai,
    userText: message,
    maxFastTokens: isDemo ? 120 : 150
  });

  // Wrap stream to capture response and update session
  const responseCapturingIterator = captureResponseAndUpdateSession(
    streamIterator,
    sessionCtx,
    sessionKey,
    avatarId,
    message,
    visitorId,
    isDemo
  );

  // Create streaming response
  const headers: Record<string, string> = {};
  if (setCookie) {
    headers['Set-Cookie'] = setCookie;
  }

  const stream = createStreamResponse(responseCapturingIterator, headers);

  // Log performance
  const totalLatency = Date.now() - t0;
  logger.info({
    route: 'hybrid-streaming',
    avatarSlug,
    isDemo,
    sessionHit: sessionCtx.createdAt !== sessionCtx.updatedAt,
    latencyMs: totalLatency,
    visitorId
  }, 'hybrid-streaming-request');

  return { stream, setCookie };
}

/**
 * Get cached avatar ID with TTL
 */
async function getAvatarIdCached(avatarSlug: string): Promise<string | null> {
  const cached = avatarIdCache.get(avatarSlug);
  const now = Date.now();
  
  if (cached && now < cached.expiresAt) {
    return cached.avatarId;
  }

  // Fetch fresh avatar ID
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data } = await supabase
      .from('avatar_profiles')
      .select('id')
      .eq('name', avatarSlug)
      .single();
    
    const avatarId = data?.id || null;
    
    // Cache for 1 hour
    avatarIdCache.set(avatarSlug, {
      avatarId,
      expiresAt: now + AVATAR_ID_CACHE_TTL_MS
    });
    
    return avatarId;
  } catch {
    return null;
  }
}

/**
 * Handle visitor cookie with demo/normal mode awareness
 */
function handleVisitorCookie(req: NextRequest, isDemo: boolean): {
  visitorId: string;
  setCookie?: string;
} {
  const cookiesHeader = req.headers.get('cookie') || '';
  const cookieMap = Object.fromEntries(
    cookiesHeader.split(/;\s*/)
      .filter(Boolean)
      .map(p => {
        const idx = p.indexOf('=');
        return idx === -1 ? [p, ''] : [
          decodeURIComponent(p.slice(0, idx)),
          decodeURIComponent(p.slice(idx + 1))
        ];
      })
  );

  const cookieName = isDemo ? DEMO_COOKIE_NAME : 'jd_vid';
  let visitorId = cookieMap[cookieName] || '';
  let setCookie: string | undefined;

  if (!visitorId) {
    visitorId = uuidv4();
    const maxAge = isDemo ? 3600 : 31536000; // 1 hour for demo, 1 year for normal
    setCookie = `${cookieName}=${encodeURIComponent(visitorId)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
  }

  return { visitorId, setCookie };
}

/**
 * Update session context with user message
 */
function updateSessionContextWithUserMessage(sessionCtx: SessionContext, message: string): void {
  // Add user message to last turns
  sessionCtx.lastTurns.push({
    role: 'user',
    content: message,
    ts: Date.now()
  });

  // Keep only last 5 turns
  if (sessionCtx.lastTurns.length > 5) {
    sessionCtx.lastTurns = sessionCtx.lastTurns.slice(-5);
  }

  sessionCtx.updatedAt = Date.now();
}

/**
 * Capture response and update session context
 */
async function* captureResponseAndUpdateSession(
  streamIterator: AsyncIterable<string>,
  sessionCtx: SessionContext,
  sessionKey: string,
  avatarId: string,
  userMessage: string,
  visitorId: string,
  isDemo: boolean
): AsyncIterable<string> {
  let fullResponse = '';
  
  try {
    for await (const token of streamIterator) {
      fullResponse += token;
      yield token;
    }

    // Update session context with assistant response
    sessionCtx.lastTurns.push({
      role: 'assistant',
      content: fullResponse,
      ts: Date.now()
    });

    // Keep only last 5 turns
    if (sessionCtx.lastTurns.length > 5) {
      sessionCtx.lastTurns = sessionCtx.lastTurns.slice(-5);
    }

    sessionCtx.updatedAt = Date.now();
    sessionCache.set(sessionKey, sessionCtx, SESSION_TTL_MS);

    // Fire-and-forget memory writes
    queueMemoryWrite({
      avatarId,
      userMessage,
      assistantResponse: fullResponse,
      visitorId,
      isDemo,
      conversationId: isDemo ? 'jonathan-demo' : `chat-${visitorId}`
    });

  } catch (error) {
    console.warn('Error in response capture:', error);
  }
}

/**
 * Queue memory writes (fire-and-forget)
 */
function queueMemoryWrite(options: {
  avatarId: string;
  userMessage: string;
  assistantResponse: string;
  visitorId: string;
  isDemo: boolean;
  conversationId: string;
}): void {
  const { avatarId, userMessage, assistantResponse, visitorId, isDemo, conversationId } = options;
  
  // Don't await - fire and forget
  (async () => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      );

      const writes = [];

      // User message write
      if (isDemo) {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        writes.push(
          supabase.from('memory_fragments').insert({
            user_id: process.env.DEMO_SYSTEM_USER_ID,
            avatar_id: avatarId,
            fragment_text: userMessage.trim(),
            conversation_context: {
              source: 'chat',
              type: 'user',
              conversation_id: 'jonathan-demo',
              visitor_id: visitorId,
              expires_at: expiresAt,
              ctx_type: 'user',
              tags: ['query']
            }
          })
        );

        // Assistant response write
        writes.push(
          supabase.from('memory_fragments').insert({
            user_id: process.env.DEMO_SYSTEM_USER_ID,
            avatar_id: avatarId,
            fragment_text: assistantResponse.trim(),
            conversation_context: {
              source: 'chat',
              type: 'assistant',
              conversation_id: 'jonathan-demo',
              visitor_id: visitorId,
              expires_at: expiresAt,
              ctx_type: 'user',
              gist: assistantResponse.split(/\n|(?<=\.)\s+/)[0]?.slice(0, 200) || '',
              tags: ['reply']
            }
          })
        );
      } else {
        // Normal mode writes
        writes.push(
          supabase.from('memory_fragments').insert({
            avatar_id: avatarId,
            fragment_text: userMessage.trim(),
            conversation_context: {
              source: 'chat',
              type: 'user',
              conversation_id: conversationId,
              visitor_id: visitorId,
              tags: ['query']
            }
          })
        );

        writes.push(
          supabase.from('memory_fragments').insert({
            avatar_id: avatarId,
            fragment_text: assistantResponse.trim(),
            conversation_context: {
              source: 'chat',
              type: 'assistant',
              conversation_id: conversationId,
              visitor_id: visitorId,
              gist: assistantResponse.split(/\n|(?<=\.)\s+/)[0]?.slice(0, 200) || '',
              tags: ['reply']
            }
          })
        );
      }

      await Promise.all(writes);
    } catch (error) {
      console.warn('Memory write failed:', error);
    }
  })();
}