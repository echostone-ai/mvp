/**
 * Stabilized Deep Lane Orchestrator
 * Handles deep memory retrieval and response generation
 */

import { supabase, openai } from '@/lib/runtime/singletons';
import { factbookService } from '@/lib/services/factbookService';
import { lightweightAnalyzer } from '@/lib/services/lightweightAnalyzer';

interface DeepLaneOptions {
  query: string;
  avatarId: string;
  writer: any; // SafeStreamWriter
  abortSignal: AbortSignal;
  deepProducedAny: { value: boolean };
  traceId: string;
  onFirstToken?: (ms: number) => void;
  onComplete?: (ms: number) => void;
  onSnippetsSelected?: (snippets: string[]) => void;
  conversationContext?: {
    memoryContext: string;
    continuityContext: string;
    personalizationContext?: any;
  };
}

function encodeSSE(data: any): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function runDeepLane(options: DeepLaneOptions): Promise<void> {
  const { query, avatarId, writer, abortSignal, deepProducedAny, traceId, onFirstToken, onComplete, onSnippetsSelected, conversationContext } = options;
  const startTime = Date.now();

  if (abortSignal.aborted || writer.closed) {
    return;
  }

  try {
    console.log('deep_lane_started', { trace_id: traceId });

    // Extract keywords from query using lightweight analyzer
    const keywords = lightweightAnalyzer.extractKeywords(query);
    console.log('deep_keywords_extracted', { trace_id: traceId, keywords });

    // Query factbook for relevant snippets
    let snippets = factbookService.querySnippets(keywords, 6);
    
    if (snippets.length < 3) {
      const merged = new Map<string, ReturnType<typeof factbookService.querySnippets>[number]>();
      for (const s of snippets) merged.set(s.id, s);
      // Topic augmentation: infer topics from keywords via lightweight analyzer classifyTopics
      const topics = lightweightAnalyzer.classifyTopics(query, keywords, []);
      if (topics.includes('places')) {
        for (const topic of ['places', 'timeline', 'identity']) {
          try {
            const topicSnips = factbookService.getSnippetsByTopic(topic) || [];
            for (const snip of topicSnips) if (!merged.has(snip.id)) merged.set(snip.id, snip);
          } catch {}
        }
      }
      const mergedList = Array.from(merged.values()).sort((a, b) => {
        if (a.text.length !== b.text.length) return a.text.length - b.text.length;
        return a.id.localeCompare(b.id);
      });
      snippets = mergedList.slice(0, 6);
    }

    let memoryContext = '';

    if (snippets.length > 0) {
      // Use factbook snippets as primary source
      memoryContext = snippets.map(s => s.text).join('\n');
      const snippetIds = snippets.map(s => s.id);
      console.log('deep_using_factbook', { trace_id: traceId, snippet_count: snippets.length, snippet_ids: snippetIds });

      // Report selected snippets for metrics
      onSnippetsSelected?.(snippetIds);
    } else {
      console.log('deep_no_factbook_snippets', { trace_id: traceId, keywords });

      if (process.env.ECHOSTONE_FACTBOOK_ONLY === '1') {
        // Stay concise; rely on helpful flow without memories
        console.log('deep_no_memories_generating_helpful_response', { trace_id: traceId });

        // Generate a helpful response even without specific memories
        const helpfulPrompt = `User asked: "${query}"

You are Jonathan, but you don't have specific memories about this topic. Provide a helpful, conversational response that:
1. Acknowledges you don't have specific memories about this
2. Shows interest in the topic
3. Asks a follow-up question to engage the user

Be warm, friendly, and conversational.`;

        // Use advanced optimization even for fallback responses
        const { advancedChatOptimization } = await import('@/lib/services/advancedChatOptimization');
        const personalizationContext = conversationContext?.personalizationContext || { intimacyLevel: 'stranger' };
        const optimizedConfig = advancedChatOptimization.getOptimalParameters(personalizationContext, query);
        const systemPrompt = advancedChatOptimization.buildAdvancedSystemPrompt(personalizationContext);

        // Generate helpful response without memories
        const response = await openai.chat.completions.create({
          ...optimizedConfig,
          max_tokens: 250,
          messages: [
            {
              role: 'system',
              content: `${systemPrompt}\n\nIMPORTANT: You don't have specific memories about this topic, but respond as Jonathan with your personality while being helpful and engaging.`
            },
            {
              role: 'user',
              content: helpfulPrompt
            }
          ]
        }, {
          signal: abortSignal
        });

        // Stream the helpful response
        for await (const chunk of response) {
          if (abortSignal.aborted || writer.closed) {
            break;
          }

          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            // Mark that deep lane produced content
            if (!deepProducedAny.value) {
              deepProducedAny.value = true;
              const firstTokenTime = Date.now() - startTime;
              console.log('deep_first_token_no_memories', { trace_id: traceId, t_deep_first_ms: firstTokenTime });
              onFirstToken?.(firstTokenTime);
            }

            await writer.write(encodeSSE({
              channel: 'deep',
              delta
            }));
          }
        }

        const completionTime = Date.now() - startTime;
        console.log('deep_lane_completed_no_memories', {
          trace_id: traceId,
          produced_content: deepProducedAny.value,
          t_deep_done_ms: completionTime
        });
        onComplete?.(completionTime);
        return;
      } else {
        // Fallback to Supabase memories if no factbook snippets
        const { data: memories, error } = await supabase.rpc('get_enhanced_memories', {
          target_user_id: null,
          target_avatar_id: avatarId,
          search_query: query,
          match_count: 5,
          similarity_threshold: 0.2
        });

        if (error || !memories || (Array.isArray(memories) && memories.length === 0)) {
          console.log('deep_no_memories_generating_helpful_response', { trace_id: traceId });

          // Generate a helpful response even without specific memories
          const helpfulPrompt = `User asked: "${query}"

You are Jonathan, but you don't have specific memories about this topic. Provide a helpful, conversational response that:
1. Acknowledges you don't have specific memories about this
2. Shows interest in the topic
3. Asks a follow-up question to engage the user

Be warm, friendly, and conversational.`;

          // Use advanced optimization for Supabase fallback too
          const { advancedChatOptimization } = await import('@/lib/services/advancedChatOptimization');
          const personalizationContext = conversationContext?.personalizationContext || { intimacyLevel: 'stranger' };
          const optimizedConfig = advancedChatOptimization.getOptimalParameters(personalizationContext, query);
          const systemPrompt = advancedChatOptimization.buildAdvancedSystemPrompt(personalizationContext);

          // Generate helpful response without memories
          const response = await openai.chat.completions.create({
            ...optimizedConfig,
            max_tokens: 250,
            messages: [
              {
                role: 'system',
                content: `${systemPrompt}\n\nIMPORTANT: You don't have specific memories about this topic, but respond as Jonathan with your personality while being helpful and engaging.`
              },
              {
                role: 'user',
                content: helpfulPrompt
              }
            ]
          }, {
            signal: abortSignal
          });

          // Stream the helpful response
          for await (const chunk of response) {
            if (abortSignal.aborted || writer.closed) {
              break;
            }

            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
              // Mark that deep lane produced content
              if (!deepProducedAny.value) {
                deepProducedAny.value = true;
                const firstTokenTime = Date.now() - startTime;
                console.log('deep_first_token_no_memories', { trace_id: traceId, t_deep_first_ms: firstTokenTime });
                onFirstToken?.(firstTokenTime);
              }

              await writer.write(encodeSSE({
                channel: 'deep',
                delta
              }));
            }
          }

          const completionTime = Date.now() - startTime;
          console.log('deep_lane_completed_no_memories', {
            trace_id: traceId,
            produced_content: deepProducedAny.value,
            t_deep_done_ms: completionTime
          });
          onComplete?.(completionTime);
          return;
        }

        // Use Supabase memories as fallback
        memoryContext = memories
          .slice(0, 3)
          .map((m: any) => m.fragment_text)
          .join('\n');

        console.log('deep_using_supabase_fallback', { trace_id: traceId, memory_count: memories.length });
      }
    }

    if (abortSignal.aborted || writer.closed) {
      return;
    }

    // Create deep response prompt with conversation context
    let deepPrompt = `Based on these facts about Jonathan:

${memoryContext}`;

    // Add conversation context if available
    if (conversationContext?.continuityContext) {
      deepPrompt += `

Recent conversation context:
${conversationContext.continuityContext}`;
    }

    deepPrompt += `

User: ${query}

Respond as Jonathan using the facts and conversation context above. Be conversational and natural:`;

    // Use advanced ChatGPT optimization for personalized interactions
    const { advancedChatOptimization } = await import('@/lib/services/advancedChatOptimization');
    
    const personalizationContext = conversationContext?.personalizationContext || { intimacyLevel: 'stranger' };
    
    // Get optimized parameters based on relationship and query
    const optimizedConfig = advancedChatOptimization.getOptimalParameters(personalizationContext, query);
    
    // Build advanced system prompt with full personality context
    const systemPrompt = advancedChatOptimization.buildAdvancedSystemPrompt(personalizationContext);
    
    // Build conversation history with proper context
    const messages = advancedChatOptimization.buildConversationHistory(
      personalizationContext,
      [], // No recent messages in current implementation
      memoryContext
    );

    // Generate deep response with optimized parameters
    const response = await openai.chat.completions.create({
      ...optimizedConfig,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: deepPrompt
        }
      ]
    }, {
      signal: abortSignal
    });

    // Stream deep response
    for await (const chunk of response) {
      if (abortSignal.aborted || writer.closed) {
        break;
      }

      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        // Mark that deep lane produced content
        if (!deepProducedAny.value) {
          deepProducedAny.value = true;
          const firstTokenTime = Date.now() - startTime;
          console.log('deep_first_token', { trace_id: traceId, t_deep_first_ms: firstTokenTime });
          onFirstToken?.(firstTokenTime);
        }

        await writer.write(encodeSSE({
          channel: 'deep',
          delta
        }));
      }
    }

    const completionTime = Date.now() - startTime;
    console.log('deep_lane_completed', {
      trace_id: traceId,
      produced_content: deepProducedAny.value,
      t_deep_done_ms: completionTime
    });
    onComplete?.(completionTime);

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('deep_lane_aborted', { trace_id: traceId });
    } else {
      console.error('deep_lane_error', { trace_id: traceId, error: error.message });
    }
  }
}