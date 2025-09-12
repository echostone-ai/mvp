// src/app/api/demo-chat/route-factbook.ts
// Factbook-integrated version of demo-chat route
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { convoLatency, firstTokenLatency } from '@/lib/metrics';
import { logger } from '@/lib/logger';
import { featureFlagManager } from '@/lib/config/featureFlags';
import { factbookService } from '@/lib/services/factbookService';
import { lightweightAnalyzer } from '@/lib/services/lightweightAnalyzer';
import { FactbookHookSelector } from '@/lib/services/factbookHookSelector';

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
    const systemUserId = process.env.DEMO_SYSTEM_USER_ID || process.env.SYSTEM_USER_ID || '';
    if (!systemUserId) {
      return NextResponse.json(
        { error: 'Missing DEMO_SYSTEM_USER_ID (or SYSTEM_USER_ID) in environment.' },
        { status: 500 }
      );
    }

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

    // --- Get user text ---
    const userText =
      typeof singleMessage === 'string' && singleMessage.trim()
        ? singleMessage.trim()
        : (Array.isArray(inputMessages) && inputMessages.length > 0
            ? String(inputMessages[inputMessages.length - 1]?.content || '')
            : '');

    if (!userText) {
      return NextResponse.json({ error: 'Missing messages or message' }, { status: 400 });
    }

    // --- Factbook Integration ---
    let identityPrompt = '';
    let metadata: any = {};
    let chatMetrics: any = {};

    const useFactbook = featureFlagManager.shouldUseFactbook();
    
    if (useFactbook) {
      try {
        // Initialize factbook if not already loaded
        if (!factbookService.isLoaded()) {
          const fs = await import('fs');
          const path = await import('path');
          const factbookPath = path.join(process.cwd(), 'src/data/jonathan_profile_factbook.json');
          const factbookContent = fs.readFileSync(factbookPath, 'utf-8');
          const factbookData = JSON.parse(factbookContent);
          await factbookService.loadFactbook(factbookData);
        }

        // Fast lane: Analyze query and get snippets
        const fastLaneStart = Date.now();
        const analysis = lightweightAnalyzer.analyzeQuery(userText);
        const snippets = factbookService.querySnippets(analysis.keywords, 3);
        
        // Generate hook
        const hookSelector = new FactbookHookSelector();
        const hookSelection = hookSelector.selectHook(snippets, userText, analysis.intent);
        
        const fastLaneMs = Date.now() - fastLaneStart;
        
        // Build factbook-based system prompt
        identityPrompt = `You are Jonathan Braden. Never break character.

FACTBOOK CONTEXT:
${snippets.map(s => `- ${s.text}`).join('\n')}

Answer ONLY with facts from the Factbook unless asked for opinions or style. Apply your personality as a style layer after selecting facts, never during fact selection.`;

        metadata = {
          factbook_enabled: true,
          fast_lane_ms: fastLaneMs,
          hook: hookSelection.hook,
          snippets_used: snippets.map(s => s.id),
          topics: analysis.topics,
          keywords: analysis.keywords
        };

        chatMetrics = {
          trace_id: `demo-${Date.now()}`,
          hook_ms: fastLaneMs,
          snippets: snippets.map(s => s.id).join(','),
          topics: analysis.topics.join(',')
        };

        console.log('factbook_fast_lane', {
          query: userText,
          hook_ms: fastLaneMs,
          hook: hookSelection.hook,
          snippets: snippets.map(s => s.id),
          topics: analysis.topics
        });

        // Performance gate check
        if (fastLaneMs > 300) {
          console.warn('factbook_performance_gate_violation', {
            hook_ms: fastLaneMs,
            target_ms: 300,
            query: userText.substring(0, 50)
          });
        }

      } catch (e: any) {
        console.error('Factbook system failed, falling back to basic prompt:', e);
        identityPrompt = `You are Jonathan Braden. Never break character. Stay warm, natural, and conversational.`;
        metadata = { factbook_enabled: false, factbook_error: e.message };
      }
    } else {
      identityPrompt = `You are Jonathan Braden. Never break character. Stay warm, natural, and conversational.`;
      metadata = { factbook_enabled: false };
    }

    const systemPrompt = providedSystemPrompt || identityPrompt;

    // --- Build messages for the model ---
    const finalMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];
    
    if (Array.isArray(inputMessages) && inputMessages.length > 0) {
      finalMessages.push(...inputMessages);
    } else {
      finalMessages.push({ role: 'user', content: userText });
    }

    // --- Store the incoming user message ---
    if (userText) {
      try {
        await supabase.from('memory_fragments').insert({
          user_id: systemUserId,
          avatar_id: avatarId,
          fragment_text: userText,
          conversation_context: {
            source: 'demo-chat-factbook',
            type: 'user',
            conversation_id: 'jonathan-demo',
            tags: ['query', 'raw_turn'],
            factbook_enabled: useFactbook
          },
        });
      } catch (e: any) {
        console.error('Failed to store user message:', e);
      }
    }

    // --- Call model ---
    const modelToUse = 'gpt-4o-mini';
    
    if (!debug) {
      const deepLaneStart = Date.now();
      
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
      let firstTokenTime = 0;

      const readable = new ReadableStream({
        async start(controller) {
          try {
            let isFirstToken = true;
            for await (const chunk of response) {
              const token = chunk.choices?.[0]?.delta?.content || '';
              if (token) {
                fullResponse += token;
                controller.enqueue(encoder.encode(token));
                
                if (isFirstToken) {
                  firstTokenTime = Date.now() - deepLaneStart;
                  isFirstToken = false;
                  
                  try {
                    const tFirst = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0;
                    firstTokenLatency.observe({ route: 'demo-chat-factbook', model: modelToUse, mode: 'fast' }, tFirst);
                  } catch {}
                }
              }
            }
            controller.close();

            const deepLaneMs = Date.now() - deepLaneStart;
            
            // Log chat metrics
            const finalChatMetrics = {
              ...chatMetrics,
              deep_first_ms: firstTokenTime,
              deep_done_ms: deepLaneMs,
              overlap: 0 // No overlap check in this simple implementation
            };
            
            console.log('chat_metrics', finalChatMetrics);

            // Performance gate checks
            if (deepLaneMs > 1000) {
              console.warn('deep_lane_performance_gate_violation', {
                deep_done_ms: deepLaneMs,
                target_ms: 1000,
                query: userText.substring(0, 50)
              });
            }

            // Store assistant reply
            if (fullResponse.trim()) {
              try {
                await supabase.from('memory_fragments').insert({
                  user_id: systemUserId,
                  avatar_id: avatarId,
                  fragment_text: fullResponse.trim(),
                  conversation_context: {
                    source: 'demo-chat-factbook',
                    type: 'assistant',
                    conversation_id: 'jonathan-demo',
                    gist: (fullResponse.split(/\n|(?<=\.)\s+/)[0] || '').slice(0, 200),
                    tags: ['reply', 'raw_turn'],
                    factbook_enabled: useFactbook,
                    metrics: finalChatMetrics
                  },
                });
              } catch (e: any) {
                console.error('Failed to store assistant reply:', e);
              }
            }
          } catch (e) {
            controller.error(e);
          }
        },
      });

      const total = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0;
      try { 
        convoLatency.observe({ route: 'demo-chat-factbook', model: modelToUse, mode: 'fast' }, total); 
      } catch {}
      
      logger.info({ 
        route: 'demo-chat-factbook', 
        model: modelToUse, 
        latencyMs: total, 
        avatarId, 
        systemUserId,
        factbook_enabled: useFactbook 
      }, 'demo-chat-factbook-turn');

      return new Response(readable, { 
        headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' }) 
      });
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

    const res = NextResponse.json({
      text,
      metadata,
      debug: { 
        promptPreview, 
        model_used: modelToUse,
        factbook_enabled: useFactbook,
        chat_metrics: chatMetrics
      }
    });

    const total = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0;
    try { 
      convoLatency.observe({ route: 'demo-chat-factbook', model: modelToUse, mode: 'full' }, total); 
    } catch {}
    
    logger.info({ 
      route: 'demo-chat-factbook', 
      model: modelToUse, 
      latencyMs: total, 
      avatarId, 
      systemUserId,
      factbook_enabled: useFactbook 
    }, 'demo-chat-factbook-turn');

    return res;

  } catch (error: any) {
    console.error('Demo Chat Factbook API error:', error);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}