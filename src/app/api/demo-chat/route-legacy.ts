// src/app/api/demo-chat/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { EnhancedPromptBuilder } from '@/lib/services/enhancedPromptBuilder';
import { injectFactsFromMessage } from '@/lib/services';
import { convoLatency, firstTokenLatency } from '@/lib/metrics';
import { logger } from '@/lib/logger';
import { featureFlagManager } from '@/lib/config/featureFlags';
import { factbookService } from '@/lib/services/factbookService';
import { lightweightAnalyzer } from '@/lib/services/lightweightAnalyzer';
import { FactbookHookSelector } from '@/lib/services/factbookHookSelector';
import { DeepLaneCoordinator } from '@/lib/services/deepLaneCoordinator';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  try {
    const body = await req.json();
    const debug = body.debug === true;
    const inputMessages = body.messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }> | undefined;
    const avatarSlug = (body.avatar || body.avatarSlug || 'jonathan_braden') as string;
    const singleMessage = (body.message as string | undefined) || (body.question as string | undefined) || '';
    const providedSystemPrompt = body.systemPrompt as string | undefined;

    // --- Demo fencing / config ---
    const systemUserId =
      process.env.DEMO_SYSTEM_USER_ID ||
      process.env.SYSTEM_USER_ID || ''; // required for demo writes
    if (!systemUserId) {
      return NextResponse.json(
        { error: 'Missing DEMO_SYSTEM_USER_ID (or SYSTEM_USER_ID) in environment.' },
        { status: 500 }
      );
    }
    // Optional TTL (minutes) for demo memories. Set DEMO_MEMORY_TTL_MINUTES=0 to disable TTL.
    const ttlMinutesEnv = String(process.env.DEMO_MEMORY_TTL_MINUTES || '10');
    const ttlMinutes = Math.max(0, parseInt(ttlMinutesEnv, 10) || 0);
    const ttlCutoffIso = ttlMinutes > 0
      ? new Date(Date.now() - ttlMinutes * 60 * 1000).toISOString()
      : null;

    const canUseDb = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (!canUseDb) {
      return NextResponse.json({ error: 'Supabase env vars not set' }, { status: 500 });
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // --- Resolve avatar_id ---
    let avatarId: string | null = null;
    {
      const { data: prof, error } = await supabase
        .from('avatar_profiles')
        .select('id')
        .eq('name', avatarSlug)
        .single();
      if (error || !prof?.id) {
        return NextResponse.json({ error: `Avatar not found: ${avatarSlug}` }, { status: 404 });
      }
      avatarId = prof.id;
    }

    // --- Fetch recent demo conversation history (shared user_id) ---
    type TurnRow = {
      id: string;
      fragment_text: string;
      conversation_context: any;
      created_at: string;
    };

    let historyQuery = supabase
      .from('memory_fragments')
      .select('id, fragment_text, conversation_context, created_at')
      .eq('avatar_id', avatarId)
      .eq('user_id', systemUserId)
      .order('created_at', { ascending: false })
      .limit(32);

    if (ttlCutoffIso) {
      historyQuery = historyQuery.gte('created_at', ttlCutoffIso);
    }

    const { data: historyRows, error: historyErr } = await historyQuery;
    if (historyErr) {
      // Don’t fail the whole request—just continue without history.
      // eslint-disable-next-line no-console
      console.warn('Demo history fetch failed:', historyErr);
    }

    const conversationHistory =
      (historyRows || [])
        .reverse() // oldest→newest for the prompt
        .map((row: TurnRow) => ({
          role: (row.conversation_context?.type === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
          content: String(row.fragment_text || ''),
          timestamp: row.created_at,
        }))
        .slice(-8); // keep it light

    // --- Build enhanced system prompt (kept same as prod) ---
    const userText =
      typeof singleMessage === 'string' && singleMessage.trim()
        ? singleMessage.trim()
        : (Array.isArray(inputMessages) && inputMessages.length > 0
            ? String(inputMessages[inputMessages.length - 1]?.content || '')
            : '');

    let identityPrompt = '';
    let debugInfo: any = undefined;
    let metadata: any = undefined;

    try {
      const enhancedBuilder = new EnhancedPromptBuilder();
      // Detect profile/preference queries for enhanced retrieval
      const isProfileQuery = /\b(favorite|prefer|like|love|music|band|artist|dog|pet|family|parents|work|job|hobby|interest)\b/i.test(userText);
      const isCountQuery = /\b(how many|count|number of|total)\b/i.test(userText);
      const isPoliticalQuery = /\b(trump|political|politics|america|emigration|left america|political climate|think of|opinion)\b/i.test(userText);
      const isOpinionQuery = /\b(think|opinion|feel|believe|view|like|dislike|hate|love)\b/i.test(userText);
      
      const needsEnhancedRetrieval = isProfileQuery || isCountQuery || isPoliticalQuery || isOpinionQuery;
      const needsLowThreshold = isPoliticalQuery || isOpinionQuery;
      
      const result = await enhancedBuilder.buildEnhancedSystemPromptWithStyle(
        avatarSlug,
        userText,
        conversationHistory,
        {
          priorityFilter: needsEnhancedRetrieval ? 8 : 6, // Higher priority for special queries
          memoryLimit: needsEnhancedRetrieval ? 64 : 16, // Enhanced limit for special queries
          trackExpressions: true,
          fastMode: false, // ALWAYS disable fast mode to prevent late_start cancellation
          debug: debug,
          similarityThreshold: needsLowThreshold ? 0.25 : 0.4, // Lower threshold for political/opinion queries
          demoMode: {
            isDemo: true,
            conversationId: 'jonathan-demo',
            visitorId: systemUserId
          }
        }
      );
      identityPrompt = result.prompt;
      debugInfo = result.debug;
      metadata = result.metadata;
    } catch (e: any) {
      console.error('Enhanced prompt builder (demo) failed:', e);
      identityPrompt = `You are Jonathan Braden. Stay warm, natural, and conversational.

Use core identity and any recent chat turns you have.
Preserve continuity across turns. If a needed detail isn’t available, ask briefly or say you don’t have it yet.
Never mention system details or data sources; speak in first person as yourself.`;
    }

    const systemPrompt =
      providedSystemPrompt ||
      identityPrompt ||
      `You are a specific person (the avatar). Be warm, friendly, and conversational.`;

    // --- Build messages for the model ---
    const finalMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];
    if (Array.isArray(inputMessages) && inputMessages.length > 0) {
      finalMessages.push(...inputMessages);
    } else if (userText) {
      finalMessages.push({ role: 'user', content: userText });
    } else {
      return NextResponse.json({ error: 'Missing messages or message' }, { status: 400 });
    }

    // --- Store the incoming user message (shared user_id) ---
    if (userText) {
      try {
        // Store raw user message for conversation continuity
        await supabase.from('memory_fragments').insert({
          user_id: systemUserId,
          avatar_id: avatarId,
          fragment_text: userText,
          conversation_context: {
            source: 'demo-chat',
            type: 'user',
            conversation_id: 'jonathan-demo',
            tags: ['query', 'raw_turn'],
          },
        });

        // Background: Intelligent memory and fact extraction
        (async () => {
          try {
            console.log('[Demo Chat API] Starting intelligent extraction from user message...');
            
            // Import services dynamically to avoid circular dependencies
            const { MemoryService } = await import('@/lib/memoryService');
            const { IntelligentQueryAnalyzer } = await import('@/lib/services/intelligentQueryAnalyzer');
            const { IntelligentFactExtractor } = await import('@/lib/services/intelligentFactExtractor');
            
            // Analyze user query for intelligent processing
            const queryAnalysis = IntelligentQueryAnalyzer.analyzeQuery(userText, conversationHistory);
            console.log(`[Demo Chat API] Query analysis: ${queryAnalysis.intent.primary} intent, ${queryAnalysis.complexity.level} complexity`);
            
            // Extract facts using intelligent analysis
            const existingFacts = []; // Could fetch existing facts for validation
            const extractedFacts = IntelligentFactExtractor.extractFacts({
              query: userText,
              analysis: queryAnalysis,
              existingFacts,
              conversationHistory,
              avatarId: avatarId!
            });
            
            if (extractedFacts.length > 0) {
              console.log(`[Demo Chat API] Extracted ${extractedFacts.length} intelligent facts`);
              
              // Store extracted facts as quick_facts
              const factInserts = extractedFacts.map(fact => ({
                avatar_id: avatarId,
                key: fact.key,
                value: fact.value,
                confidence: fact.confidence,
                priority: fact.category === 'identity' ? 1 : 
                         fact.category === 'relationships' ? 2 : 
                         fact.category === 'places_lived' ? 3 : 5,
                source: 'intelligent_extraction',
                source_reference: `demo-chat: "${userText.substring(0, 50)}..."`,
                expires_at: ttlMinutes > 0 ? new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString() : null
              }));
              
              // Insert facts with conflict resolution
              for (const factInsert of factInserts) {
                try {
                  await supabase.from('quick_facts').upsert(factInsert, {
                    onConflict: 'avatar_id,key',
                    ignoreDuplicates: false
                  });
                } catch (factError) {
                  console.warn(`[Demo Chat API] Failed to store fact ${factInsert.key}:`, factError);
                }
              }
            }
            
            // Extract meaningful memories from the user's message
            const extractedMemories = await MemoryService.Extraction.extractMemoryFragments(
              userText,
              systemUserId,
              {
                source: 'demo-chat',
                conversation_id: 'jonathan-demo',
                visitorName: 'User',
                queryAnalysis // Pass analysis for enhanced extraction
              }
            );

            if (extractedMemories.length > 0) {
              console.log(`[Demo Chat API] Extracted ${extractedMemories.length} meaningful memories`);
              
              // Store extracted memories with avatar_id and TTL
              const expiresAt = ttlMinutes > 0 
                ? new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString()
                : null;

              const memoryInserts = extractedMemories.map(memory => ({
                user_id: systemUserId,
                avatar_id: avatarId,
                fragment_text: memory.fragmentText,
                conversation_context: {
                  ...memory.conversationContext,
                  source: 'demo-chat_extraction',
                  conversation_id: 'jonathan-demo',
                  expires_at: expiresAt,
                  tags: ['extracted_memory', 'personal_info', 'intelligent_extraction'],
                  query_analysis: {
                    intent: queryAnalysis.intent.primary,
                    complexity: queryAnalysis.complexity.level,
                    entities: queryAnalysis.entities.map(e => e.text)
                  }
                }
              }));

              await supabase.from('memory_fragments').insert(memoryInserts);
              console.log(`[Demo Chat API] Successfully stored ${memoryInserts.length} extracted memories`);
            } else {
              console.log('[Demo Chat API] No meaningful memories extracted from user message');
            }

            // Also do traditional fact injection as fallback
            await injectFactsFromMessage?.({ avatarId, text: userText });
            
            console.log('[Demo Chat API] Intelligent extraction completed successfully');
          } catch (e) {
            console.error('[Demo Chat API] Intelligent extraction error:', {
              error: e instanceof Error ? e.message : String(e),
              userText: userText.substring(0, 100)
            });
          }
        })();
      } catch (e: any) {
        console.error('[Demo Chat API] Failed to store user message:', {
          error: e?.message || String(e),
          userText: userText.substring(0, 100)
        });
      }
    }

    // --- Call model (streaming for UI parity) ---
    const modelToUse = (debugInfo?.metadata?.model_recommendation) || 'gpt-4o-mini';
    if (!debug) {
      const response = await openai.chat.completions.create({
        model: modelToUse,
        stream: true,
        messages: finalMessages as any,
        temperature: 0.3,
        top_p: 1,
        frequency_penalty: 0.2,
        presence_penalty: 0,
      });

      const encoder = new TextEncoder();
      let fullResponse = '';

      const readable = new ReadableStream({
        async start(controller) {
          try {
            let first = false;
            for await (const chunk of response) {
              const token = chunk.choices?.[0]?.delta?.content || '';
              if (token) {
                fullResponse += token;
                controller.enqueue(encoder.encode(token));
                if (!first) {
                  first = true;
                  try {
                    const tFirst = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0;
                    firstTokenLatency.observe({ route: 'demo-chat', model: modelToUse, mode: 'fast' }, tFirst);
                  } catch {}
                }
              }
            }
            controller.close();

            // Store assistant reply
            if (fullResponse.trim()) {
              try {
                // optional TTL housekeeping: delete older than TTL (soft clean)
                if (ttlCutoffIso) {
                  await supabase
                    .from('memory_fragments')
                    .delete()
                    .eq('avatar_id', avatarId)
                    .eq('user_id', systemUserId)
                    .lt('created_at', ttlCutoffIso);
                }

                // Store raw assistant response for conversation continuity
                await supabase.from('memory_fragments').insert({
                  user_id: systemUserId,
                  avatar_id: avatarId,
                  fragment_text: fullResponse.trim(),
                  conversation_context: {
                    source: 'demo-chat',
                    type: 'assistant',
                    conversation_id: 'jonathan-demo',
                    gist: (fullResponse.split(/\n|(?<=\.)\s+/)[0] || '').slice(0, 200),
                    tags: ['reply', 'raw_turn'],
                  },
                });

                console.log('[Demo Chat API] Stored assistant response for conversation continuity');
              } catch (e: any) {
                console.error('[Demo Chat API] Failed to store assistant reply:', {
                  error: e?.message || String(e),
                  responseLength: fullResponse.length
                });
              }
            }
          } catch (e) {
            controller.error(e);
          }
        },
      });

      const total = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0;
      try { convoLatency.observe({ route: 'demo-chat', model: modelToUse, mode: 'fast' }, total); } catch {}
      logger.info({ route: 'demo-chat', model: modelToUse, latencyMs: total, avatarId, systemUserId }, 'demo-chat-turn');

      return new Response(readable, { headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' }) });
    }

    // --- Non-stream debug mode ---
    const completion = await openai.chat.completions.create({
      model: modelToUse,
      stream: false,
      messages: finalMessages as any,
      temperature: 0.3,
      top_p: 1,
      frequency_penalty: 0.2,
      presence_penalty: 0,
    });
    const text = completion.choices?.[0]?.message?.content || '';
    const promptPreview = (finalMessages.find(m => m.role === 'system')?.content || '').slice(0, 400);
    const historyCount = Array.isArray(inputMessages) ? inputMessages.length : (singleMessage ? 1 : 0);

    const res = NextResponse.json({
      text,
      metadata,
      debug: debugInfo ? { ...debugInfo, promptPreview, historyCount, model_used: modelToUse }
                       : { promptPreview, historyCount, model_used: modelToUse }
    });

    const total = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0;
    try { convoLatency.observe({ route: 'demo-chat', model: modelToUse, mode: 'full' }, total); } catch {}
    logger.info({ route: 'demo-chat', model: modelToUse, latencyMs: total, avatarId, systemUserId }, 'demo-chat-turn');

    return res;

  } catch (error: any) {
    console.error('Demo Chat API error:', error);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}