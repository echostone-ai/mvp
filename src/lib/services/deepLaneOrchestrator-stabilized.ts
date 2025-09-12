/**
 * Stabilized Deep Lane Orchestrator
 * Handles deep memory retrieval and response generation
 */

import { supabase, openai } from '@/lib/runtime/singletons';

interface DeepLaneOptions {
  query: string;
  avatarId: string;
  writer: any; // SafeStreamWriter
  abortSignal: AbortSignal;
  deepProducedAny: { value: boolean };
  traceId: string;
}

function encodeSSE(data: any): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function runDeepLane(options: DeepLaneOptions): Promise<void> {
  const { query, avatarId, writer, abortSignal, deepProducedAny, traceId } = options;
  
  if (abortSignal.aborted || writer.closed) {
    return;
  }
  
  try {
    console.log('deep_lane_started', { trace_id: traceId });
    
    // Retrieve enhanced memories
    const { data: memories, error } = await supabase.rpc('get_enhanced_memories', {
      target_user_id: null,
      target_avatar_id: avatarId,
      search_query: query,
      match_count: 10,
      similarity_threshold: 0.2
    });
    
    if (error) {
      console.warn('deep_memory_error', error.message);
      return;
    }
    
    if (!memories || memories.length === 0) {
      console.log('deep_no_memories', { trace_id: traceId });
      return;
    }
    
    if (abortSignal.aborted || writer.closed) {
      return;
    }
    
    // Build context from memories
    const memoryContext = memories
      .slice(0, 5) // Top 5 most relevant
      .map(m => m.fragment_text)
      .join('\n');
    
    // Create deep response prompt
    const deepPrompt = `Based on these specific memories about Jonathan:

${memoryContext}

User question: ${query}

Provide a specific, accurate response using only the information from the memories above. If the memories don't contain enough information to answer fully, say so rather than guessing.

Response:`;
    
    // Generate deep response
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are Jonathan. Use only the provided memories to answer. Be specific and accurate. Do not hallucinate or guess.'
        },
        {
          role: 'user',
          content: deepPrompt
        }
      ],
      stream: true,
      max_tokens: 200,
      temperature: 0.7
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
          console.log('deep_first_token', { trace_id: traceId });
        }
        
        await writer.write(encodeSSE({
          channel: 'deep',
          delta
        }));
      }
    }
    
    console.log('deep_lane_completed', { 
      trace_id: traceId,
      produced_content: deepProducedAny.value
    });
    
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('deep_lane_aborted', { trace_id: traceId });
    } else {
      console.error('deep_lane_error', { trace_id: traceId, error: error.message });
    }
  }
}