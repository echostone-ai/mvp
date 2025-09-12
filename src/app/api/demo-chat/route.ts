// src/app/api/demo-chat/route-factbook.ts
// Factbook-integrated version of demo-chat route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { convoLatency, firstTokenLatency } from '@/lib/metrics';
import { logger } from '@/lib/logger';
import { featureFlagManager } from '@/lib/config/featureFlags';
import { factbookService } from '@/lib/services/factbookService';
import { lightweightAnalyzer } from '@/lib/services/lightweightAnalyzer';
import { FactbookHookSelector } from '@/lib/services/factbookHookSelector';
import fs from 'fs';
import path from 'path';
import { buildIndex } from '@/lib/factbook/buildIndex';
import { retrieveFacts } from '@/lib/factbook/retriever';

// ---- Factbook bootstrap (lazy singleton) ----
let FACTBOOK_LOADED = false;
let FACTBOOK_MTIME = 0;
let FB_INDEX: ReturnType<typeof buildIndex> | null = null;

function ensureFactbookLoaded() {
  const factbookPath = path.join(process.cwd(), 'data/jonathan_profile_factbook.json');
  try {
    const stat = fs.statSync(factbookPath);
    const mtime = stat.mtimeMs || Date.now();
    const shouldReload = !FACTBOOK_LOADED || (process.env.NODE_ENV !== 'production' && mtime > FACTBOOK_MTIME);
    if (!shouldReload) return;
    const content = fs.readFileSync(factbookPath, 'utf-8');
    const data = JSON.parse(content);
    factbookService.loadFactbook(data);
    // Always build index; routing decides whether to use it
    const facts = factbookService.getAllSnippets();
    FB_INDEX = buildIndex(facts as any);
    FACTBOOK_LOADED = true;
    FACTBOOK_MTIME = mtime;
    console.log(process.env.NODE_ENV !== 'production' ? 'factbook_loaded_hot' : 'factbook_loaded_once', {
      snippets: factbookService.getSnippetCount(),
      path: factbookPath,
    });
  } catch (e) {
    console.error('factbook_load_error', e);
  }
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  // ---- in the request handler, very early ----
  ensureFactbookLoaded();

  try {
    const body = await req.json();
    const USE_PERSONA = (typeof body.usePersona === 'boolean')
      ? !!body.usePersona
      : (process.env.USE_PERSONA_PROFILE === '1');
    const USE_FB_INDEX_FLAG = (typeof body.useFBIndex === 'boolean') ? !!body.useFBIndex : (process.env.USE_FB_INDEX === '1');
    const debug = body.debug === true;
    const inputMessages = body.messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }> | undefined;
    const avatarSlug = (body.avatar || body.avatarSlug || 'jonathan_braden') as string;
    const singleMessage = (body.message as string | undefined) || (body.question as string | undefined) || '';
    const providedSystemPrompt = body.systemPrompt as string | undefined;
    const profileData = body.profileData as any | undefined;

    if (USE_PERSONA && (!profileData || (profileData.id && profileData.id !== 'jonathan_demo'))) {
      if (process.env.NODE_ENV !== 'production') {
        return new Response(JSON.stringify({ error: 'missing_or_wrong_profileData' }), { status: 400 });
      }
    }

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

    // --- Resolve avatar_id (non-fatal) ---
    let avatarId: string | null = null;
    try {
      const { data: prof } = await supabase
        .from('avatar_profiles')
        .select('id')
        .eq('name', avatarSlug)
        .single();
      avatarId = prof?.id || null;
    } catch {
      avatarId = null;
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

    // --- Relationship Personalization Detection ---
    const { relationshipPersonalizationService } = await import('@/lib/services/relationshipPersonalizationService');
    const detectedPerson = relationshipPersonalizationService.detectKnownPerson(userText, body.visitorId);
    const personalizationContext = relationshipPersonalizationService.generatePersonalizationContext(
      userText, 
      detectedPerson
    );
    
    console.log('demo_chat_relationship_detection', {
      detected_person: detectedPerson?.name,
      relationship: detectedPerson?.relationship,
      intimacy_level: personalizationContext.intimacyLevel,
      personalized_greeting: personalizationContext.personalizedGreeting
    });

    // --- Factbook Integration ---
    let identityPrompt = '';
    let metadata: any = {};
    let chatMetrics: any = {};

    const useFactbook = featureFlagManager.shouldUseFactbook();
    
    if (useFactbook) {
      try {
        // Factbook is already loaded by singleton

        // Fast lane: Either indexed retrieval (generic) or legacy snippet query
        const fastLaneStart = Date.now();
        const analysis = lightweightAnalyzer.analyzeQuery(userText);
        
        // --- Semantic Query Expansion ---
        let expandedQuery: any = {
          expandedTerms: [],
          relationshipContext: [],
          emotionalContext: []
        };
        
        try {
          const { semanticQueryExpansionService } = await import('@/lib/services/semanticQueryExpansion');
          const expansion = semanticQueryExpansionService.expandQuery(userText);
          expandedQuery = {
            expandedTerms: expansion.expandedTerms,
            relationshipContext: [], // Add relationship context based on personalization
            emotionalContext: emotionalCues
          };
          
          console.log('demo_chat_semantic_expansion', {
            original_query: userText,
            expanded_terms: expandedQuery.expandedTerms,
            semantic_clusters: expansion.semanticClusters,
            confidence: expansion.confidence
          });
        } catch (error) {
          console.warn('Semantic expansion failed, using basic terms:', error);
        }
        
        let snippets: ReturnType<typeof factbookService.querySnippets> = [];
        let fbScores: Array<{ id: string; score: number }> = [];
        let retrievalUsed = false;

        let expandedCount = 0;
        if (USE_FB_INDEX_FLAG && FB_INDEX) {
          const { facts, scores, tokens, expanded } = retrieveFacts(userText, FB_INDEX, 8);
          fbScores = scores;
          expandedCount = expanded.length;
          retrievalUsed = true;
          // Map to snippets
          const idToSnippet = new Map<string, ReturnType<typeof factbookService.querySnippets>[number]>();
          for (const s of factbookService.getAllSnippets()) idToSnippet.set(s.id, s);
          snippets = facts.map(f => idToSnippet.get(f.id)!).filter(Boolean) as any;
        } else {
          // Legacy path with analyzer keywords and augmentation
          // Augment with protected tokens found in recent messages (for co-ref like "there")
          let contextTokens: string[] = [];
          try {
            const protectedSet = factbookService.getProtectedTokens();
            const recentMsgs = Array.isArray(inputMessages) ? inputMessages.slice(-6) : [];
            for (const m of recentMsgs) {
              const c = String((m as any)?.content || '').toLowerCase().replace(/[^\w\s]/g, ' ');
              const toks = c.split(/\s+/).map(t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]/g, ''));
              for (const t of toks) { if (t && protectedSet.has(t)) contextTokens.push(t); }
            }
            contextTokens = [...new Set(contextTokens)].slice(0, 6);
          } catch {}
          
          // Use expanded query terms for better retrieval with intelligent weighting
          const primaryTerms = analysis.keywords;
          const semanticTerms = expandedQuery.expandedTerms;
          const contextTerms = [...contextTokens, ...expandedQuery.relationshipContext, ...expandedQuery.emotionalContext];
          
          // Query with primary terms first, then expand with semantic terms
          let primarySnippets = factbookService.querySnippets(primaryTerms, 4);
          
          // If we don't have enough results, expand with semantic terms
          if (primarySnippets.length < 3) {
            const allQueryTerms = [...primaryTerms, ...semanticTerms, ...contextTerms];
            snippets = factbookService.querySnippets(allQueryTerms, 8);
            
            console.log('demo_chat_semantic_boost', {
              primary_terms: primaryTerms,
              semantic_terms: semanticTerms,
              primary_results: primarySnippets.length,
              expanded_results: snippets.length
            });
          } else {
            snippets = primarySnippets;
          }
        }
        
        if (snippets.length < 4) {
          const merged = new Map<string, ReturnType<typeof factbookService.querySnippets>[number]>();
          for (const s of snippets) merged.set(s.id, s);
          const topicsToAugment = new Set<string>(analysis.topics || []);
          const relatedByTopic: Record<string, string[]> = {
            places: ['places', 'timeline', 'identity', 'austin', 'texas', 'maine', 'sofia', 'bulgaria', 'usa', 'united states', 'america'],
            people: ['people', 'relationships', 'family', 'brother', 'sister', 'mother', 'father'],
            timeline: ['timeline', 'places', 'identity']
          };
          const expandTopics = new Set<string>();
          for (const t of topicsToAugment) {
            (relatedByTopic[t] || [t]).forEach(v => expandTopics.add(v));
          }
          for (const topic of expandTopics) {
            try {
              const topicSnips = [
                ...factbookService.getSnippetsByTopic(topic),
                ...factbookService.getSnippetsByLabel(topic)
              ];
              for (const snip of topicSnips) {
                if (!merged.has(snip.id)) merged.set(snip.id, snip);
              }
            } catch {}
          }
          const mergedList = Array.from(merged.values()).sort((a, b) => {
            if (a.text.length !== b.text.length) return a.text.length - b.text.length;
            return a.id.localeCompare(b.id);
          });
          snippets = mergedList.slice(0, 8);
        }
        
        // Threshold routing (generic)
        const THRESHOLD = 1.2;
        const topScore = fbScores[0]?.score || 0;
        const confident = USE_FB_INDEX_FLAG ? (topScore >= THRESHOLD) : (snippets.length > 0);
        if (USE_FB_INDEX_FLAG && !confident) {
          // Skip attaching facts to save tokens and let the model ask a single clarifying Q
          snippets = [];
        }

        // Generate hook
        const hookSelector = new FactbookHookSelector();
        let hookSelection;
        if (USE_FB_INDEX_FLAG && FB_INDEX) {
          const idToSnippet = new Map<string, ReturnType<typeof factbookService.querySnippets>[number]>();
          for (const s of factbookService.getAllSnippets()) idToSnippet.set(s.id, s);
          if (confident) {
            hookSelection = hookSelector.selectFromRetrieval((fbScores || []).map(s => s.id), idToSnippet, userText, (analysis.keywords || []));
          } else {
            hookSelection = { hook: '', snippetIds: [], coordinationHints: { expandOn: [], avoidRepeating: [], suggestedTone: 'conversational', topicFocus: 'general' } } as any;
          }
        } else {
          hookSelection = hookSelector.selectHook(snippets, userText, analysis.intent);
        }
        
        const fastLaneMs = Date.now() - fastLaneStart;
        
        // Build factbook-based system prompt (facts first)
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
          keywords: analysis.keywords,
          fb_top_ids: fbScores.map(s => s.id),
          fb_top_scores: fbScores.map(s => s.score),
          fb_index: USE_FB_INDEX_FLAG,
          fb_confident: confident,
          expanded_tokens_count: expandedCount
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
          fb_top_ids: fbScores.map(s => s.id),
          fb_top_scores: fbScores.map(s => s.score),
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

        // --- Simple Orchestration Decision ---
        const hasGoodSnippets = snippets.length >= 3;
        const isComplexQuery = userText.length > 20 || userText.includes('?');
        const hasHighIntimacy = personalizationContext.intimacyLevel === 'family' || personalizationContext.intimacyLevel === 'partner';
        
        const orchestrationDecision = {
          useDeepLane: hasGoodSnippets || isComplexQuery || hasHighIntimacy,
          reasoning: hasGoodSnippets ? 'good_snippets' : isComplexQuery ? 'complex_query' : hasHighIntimacy ? 'high_intimacy' : 'default',
          confidenceScore: hasGoodSnippets ? 0.8 : 0.6,
          processingStrategy: 'optimized',
          forceDeepLane: hasHighIntimacy
        };
        
        console.log('demo_chat_orchestration', {
          use_deep_lane: orchestrationDecision.useDeepLane,
          reasoning: orchestrationDecision.reasoning,
          confidence_score: orchestrationDecision.confidenceScore,
          has_good_snippets: hasGoodSnippets,
          is_complex_query: isComplexQuery,
          has_high_intimacy: hasHighIntimacy
        });

        // Router decision: threshold + deep gate + orchestration
        let deepEnabled = orchestrationDecision.useDeepLane;
        const tokenCount = (userText.match(/\S+/g) || []).length;
        if (USE_FB_INDEX_FLAG && !orchestrationDecision.forceDeepLane) {
          if ((fbScores[0]?.score || 0) >= THRESHOLD && tokenCount <= 7) {
            deepEnabled = false;
          }
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

    // --- Persona and continuity enforcement ---
    const providedMemoryContext = (body.memoryContext as string) || '';
    const providedContinuityContext = (body.continuityContext as string) || '';

    // Dynamic task directives for specificity
    const isPlacesQuery = /\b(live|lived|where\s*(have|did|do)?\s*(you|u)?\s*(live|from|based)|places\s*have\s*lived|move|moved|reside|residence)\b/i.test(userText);
    const taskDirectives = isPlacesQuery
      ? 'When asked where I have lived, present a brief, warm first-person sentence or two (not bullets) that naturally mentions the places from the context. Include year ranges only when they are explicitly present. Do not include filler like "dates not specified"; simply omit unknown dates. Do not invent any city, state, country, or years. If nothing is present in context, say: "I don\'t have the specific places on hand yet."'
      : '';

    // Build relationship-aware persona rules
    let personaRules = `You are Jonathan Braden. Never break character.
Always speak in first-person as Jonathan using words like "I" and "my".
Never refer to yourself as "Jonathan" or in the third person. Do not say "he" when referring to yourself.
If any provided context (memories, factbook, conversation) is written in third-person, seamlessly rewrite it into first-person narration without mentioning that you are rewriting it.
Keep responses warm and conversational, concise when appropriate.
If a detail isn't available, say so briefly and offer to elaborate.`;

    // Add relationship personalization to persona rules
    if (personalizationContext.personalizedGreeting) {
      personaRules += `\n\nRELATIONSHIP CONTEXT: ${personalizationContext.personalizedGreeting}`;
    }
    if (personalizationContext.intimacyLevel !== 'neutral') {
      const intimacyGuidance = personalizationContext.intimacyLevel === 'high' 
        ? 'Respond with warmth and familiarity, as you would to a close friend or family member.'
        : personalizationContext.intimacyLevel === 'medium'
        ? 'Respond with friendly warmth, as you would to a good friend.'
        : 'Respond in a friendly but more reserved manner.';
      personaRules += `\n${intimacyGuidance}`;
    }

    const memorySection = providedMemoryContext ? `\n\nMEMORY CONTEXT (concise):\n${providedMemoryContext}` : '';
    const continuitySection = providedContinuityContext ? `\n\nRECENT CONVERSATION (most recent first):\n${providedContinuityContext}` : '';

    const globalStrictness = `\n\nGLOBAL FACTUALITY RULES:\n- Base all factual statements ONLY on information explicitly present in the provided context (Factbook, Memory Context, Continuity).\n- Do NOT invent names, dates, places, counts, or relationships.\n- If a requested fact is not present, say you don\'t have it on hand yet (or ask a single concise follow-up).\n- Keep opinions/feelings consistent with persona and clearly marked as such when appropriate.`;

    const strictness = isPlacesQuery
      ? '\n\nSTRICT ANSWER RULES:\n- Use ONLY locations and years that appear verbatim in the context above.\n- If a location or year is missing, omit it; do not guess.\n- Do NOT use bullet points; write as natural first-person sentences.\n- Do NOT say "dates not specified"; just omit unknown dates.\n- If nothing is present, respond with: "I don\'t have the specific places on hand yet."'
      : '';

    // Optional persona block
    let personaBlock = '';
    if (USE_PERSONA && profileData) {
      try {
        const { styleProfile } = await import('@/lib/services/styleProfile');
        const sp = styleProfile;
        const traits = Array.isArray(profileData.personalityTraits) ? profileData.personalityTraits.slice(0, 8).join(', ') : '';
        const facts = Array.isArray(profileData.factualInfo) ? profileData.factualInfo.slice(0, 10).map((s: string) => `• ${s}`).join('\n') : '';
        personaBlock = [
          'You are Jonathan Braden speaking in first person. You are not an assistant.',
          `Tone: ${(profileData.languageStyle?.description) || 'conversational'}; humor: ${(profileData.humorStyle?.description) || 'dry, self-aware'}.`,
          traits ? `Traits: ${traits}.` : '',
          sp ? (sp as any).oneLiner || '' : '',
          'Priorities: 1) be accurate, 2) be warm and concise, 3) add a tiny source chip if you cite a hard fact.',
          '',
          'PERSONALITY:',
          profileData.personality || '',
          '',
          'QUICK FACTS:',
          facts
        ].join('\n');
      } catch {}
    }

    // --- Enhanced System Prompt Building ---
    let systemPrompt = providedSystemPrompt;
    
    if (!systemPrompt) {
      try {
        const { advancedChatOptimization } = await import('@/lib/services/advancedChatOptimization');
        const advancedSystemPrompt = advancedChatOptimization.buildAdvancedSystemPrompt(personalizationContext);
        systemPrompt = `${advancedSystemPrompt}\n\n${identityPrompt}${memorySection}${continuitySection}${globalStrictness}${taskDirectives ? `\n\nTASK: ${taskDirectives}` : ''}${strictness}`;
      } catch (error) {
        console.warn('Advanced prompt building failed, using default:', error);
        systemPrompt = `${personaRules}\n\n${personaBlock ? personaBlock + '\n\n' : ''}${identityPrompt}${memorySection}${continuitySection}${globalStrictness}${taskDirectives ? `\n\nTASK: ${taskDirectives}` : ''}${strictness}`;
      }
    }

    // --- Build messages for the model ---
    const finalMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];
    // Pinned facts line as cheap stabilizer
    if (USE_PERSONA && profileData?.factualInfo?.length) {
      const pinnedLine = `Pinned facts: ${profileData.factualInfo.slice(0, 5).join(' | ')}`;
      finalMessages.push({ role: 'assistant', content: pinnedLine });
    }
    
    if (Array.isArray(inputMessages) && inputMessages.length > 0) {
      // Keep only last 8 and only user/assistant roles to anchor pronouns like "there"
      const trimmed = inputMessages
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-8);
      if (trimmed.length > 0) finalMessages.push(...trimmed);
    }
    // Always append the current turn
    finalMessages.push({ role: 'user', content: userText });

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

    // --- Advanced ChatGPT Optimization ---
    let optimizedConfig: any = {
      model: 'gpt-4o-mini',
      stream: true,
      max_tokens: 400,
      temperature: 0.6,
      top_p: 0.9,
      frequency_penalty: 0.3,
      presence_penalty: 0.3
    };
    
    let emotionalCues: string[] = [];
    
    try {
      const { advancedChatOptimization } = await import('@/lib/services/advancedChatOptimization');
      optimizedConfig = advancedChatOptimization.getOptimalParameters(personalizationContext, userText);
      emotionalCues = advancedChatOptimization.detectEmotionalCues(userText);
      
      // Remove logit_bias to avoid OpenAI API errors with invalid token IDs
      delete optimizedConfig.logit_bias;
      
      console.log('demo_chat_optimization', {
        intimacy_level: personalizationContext.intimacyLevel,
        emotional_cues: emotionalCues,
        optimized_temperature: optimizedConfig.temperature,
        optimized_max_tokens: optimizedConfig.max_tokens,
        relationship_based_params: true
      });
    } catch (error) {
      console.warn('Advanced optimization failed, using defaults:', error);
    }

    // --- Call model with optimized parameters ---
    const modelToUse = optimizedConfig.model;
    
    if (!debug) {
      const deepLaneStart = Date.now();
      
      const response = await openai.chat.completions.create({
        model: modelToUse,
        stream: optimizedConfig.stream,
        messages: finalMessages as any,
        temperature: optimizedConfig.temperature,
        top_p: optimizedConfig.top_p,
        frequency_penalty: optimizedConfig.frequency_penalty,
        presence_penalty: optimizedConfig.presence_penalty,
        max_tokens: optimizedConfig.max_tokens,
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
                const line = `data: ${JSON.stringify({ delta: token })}\n\n`;
                controller.enqueue(encoder.encode(line));
                
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
            // Send final meta event
            const finalMeta = `data: ${JSON.stringify({ event: 'meta_final', deep_merge: true })}\n\n`;
            controller.enqueue(encoder.encode(finalMeta));
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
        headers: new Headers({ 
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive'
        }) 
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
      answer: text,
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