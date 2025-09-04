export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabase, openai, caches } from '@/lib/runtime/singletons';
import { EnhancedPromptBuilder } from '@/lib/services/enhancedPromptBuilder';
import { fastOpener, personaSeedFromCacheOrDefault } from '@/lib/runtime/fastOpener';
import { getLimits } from '@/lib/runtime/limits';
import { iterDataLines, extractDeltas } from '@/lib/runtime/sse';
import { classifyIntent } from '@/lib/runtime/intent';
import { getFastMaxForAvatar, recordFastUsage } from '@/lib/runtime/tuning';
import { getEnhancedStyleProfileCached, resolveCurrentLocation } from '@/lib/runtime/profile';
import { injectFactsFromMessage } from '@/lib/services';
import { storyIntegrationService } from '@/lib/services/storyIntegrationService';
import { MergeConfig, detectIntent, requiresImmediateDeep, getPinnedCount } from '@/config/personalization';
import { unifiedAvatarContextService } from '@/lib/services/unifiedAvatarContext';
import { runDeepLane } from '@/lib/services/deepLaneOrchestrator';

// Demo mode configuration
const DEMO_AVATAR_SLUG = process.env.DEMO_AVATAR_SLUG || 'jonathan-demo';
const DEMO_COOKIE_NAME = process.env.DEMO_COOKIE_NAME || 'jd_demo_vid';
const DEMO_TTL_MINUTES = parseInt(process.env.DEMO_MEMORY_TTL_MINUTES || '10');
const DEMO_SYSTEM_USER_ID = process.env.DEMO_SYSTEM_USER_ID || process.env.SYSTEM_USER_ID;

// Response limits
const FAST_MAX_TOKENS_DEMO = 200;
const FAST_MAX_TOKENS_NORMAL = 150;
const FAST_MAX_MS_DEMO = 3000;
const FAST_MAX_MS_NORMAL = 2000;
const FAST_MAX_SENTS = 12;

// Helper functions
function fastHelloFromCacheOrTemplate({ name }: { name: string }) {
  return `Hey there—it's ${name}. What's on your mind?`;
}

function encodeSSE(data: any): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

// Stabilized pinned memory injection with hard timeout
async function getPinnedMemoriesWithTimeout(query: string, avatarId: string, timeoutMs: number = 100): Promise<any[]> {
  const timeoutPromise = new Promise<any[]>((resolve) => {
    setTimeout(() => resolve([]), timeoutMs);
  });
  
  const memoryPromise = (async () => {
    try {
      const { data, error } = await supabase.rpc('get_enhanced_memories', {
        target_user_id: null,
        target_avatar_id: avatarId,
        search_query: query,
        match_count: 5,
        similarity_threshold: 0.25
      });
      
      if (error) {
        console.warn('pinned_memory_error', error.message);
        return [];
      }
      
      return data || [];
    } catch (e) {
      console.warn('pinned_memory_exception', e);
      return [];
    }
  })();
  
  return Promise.race([memoryPromise, timeoutPromise]);
}

// Stabilized stream writer with guards
class SafeStreamWriter {
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private isOpen = true;
  
  constructor(writer: WritableStreamDefaultWriter<Uint8Array>) {
    this.writer = writer;
  }
  
  async write(data: Uint8Array): Promise<void> {
    if (!this.isOpen || !this.writer) {
      return; // Silently ignore writes to closed stream
    }
    
    try {
      await this.writer.write(data);
    } catch (e) {
      console.warn('stream_write_error', e);
      this.close();
    }
  }
  
  close(): void {
    if (this.isOpen && this.writer) {
      try {
        this.writer.close();
      } catch (e) {
        console.warn('stream_close_error', e);
      }
      this.isOpen = false;
      this.writer = null;
    }
  }
  
  get closed(): boolean {
    return !this.isOpen;
  }
}

export async function POST(request: Request) {
  const t0 = Date.now();
  const traceId = uuidv4().slice(0, 8);
  
  // Stabilized state - all flags and timers in one scope
  let streamWriter: SafeStreamWriter | null = null;
  let deepAbort = new AbortController();
  let deepProducedAny = { value: false };
  let deepStartTimer: NodeJS.Timeout | null = null;
  let deadlineTimer: NodeJS.Timeout | null = null;
  let mergeWindowTimer: NodeJS.Timeout | null = null;
  let t_deep_started_ms = 0;
  let deepMustContribute = false;
  
  // Cleanup function - always clear all timers
  const cleanup = () => {
    if (deepStartTimer) {
      clearTimeout(deepStartTimer);
      deepStartTimer = null;
    }
    if (deadlineTimer) {
      clearTimeout(deadlineTimer);
      deadlineTimer = null;
    }
    if (mergeWindowTimer) {
      clearTimeout(mergeWindowTimer);
      mergeWindowTimer = null;
    }
    if (!deepAbort.signal.aborted) {
      deepAbort.abort('cleanup');
    }
    if (streamWriter && !streamWriter.closed) {
      streamWriter.close();
    }
  };
  
  try {
    const body = await request.json();
    const { avatarSlug, message: singleMessage, debug } = body;
    
    if (debug) {
      return NextResponse.json({
        avatarId: '0585f43b-4b49-4e16-b2a7-91c8e1e3850c',
        isDemo: true,
        visitorId: uuidv4(),
        conversationId: avatarSlug,
        cacheStats: { test: true }
      });
    }
    
    // Initialize streaming
    const stream = new ReadableStream({
      start(controller) {
        streamWriter = new SafeStreamWriter(controller.getWriter());
      }
    });
    
    // Early intent detection and budget calculation
    const intent = detectIntent(singleMessage);
    const shouldStartDeepImmediately = requiresImmediateDeep(intent);
    deepMustContribute = shouldStartDeepImmediately;
    const pinnedCount = getPinnedCount(intent);
    
    const BUDGET_MS = 8000;
    const HARD_DEADLINE = t0 + BUDGET_MS;
    const microBudgetMs = BUDGET_MS - MergeConfig.mergeWindowMs - MergeConfig.safetyMs;
    
    // Log one-liner per turn
    console.log('turn_start', {
      trace_id: traceId,
      intent,
      should_start_deep: shouldStartDeepImmediately,
      pinned_count: pinnedCount,
      micro_budget_ms: microBudgetMs,
      merge_window_ms: MergeConfig.mergeWindowMs
    });
    
    // Start deep lane IMMEDIATELY after intent detection - before any I/O
    const shouldSkipDeep = !shouldStartDeepImmediately && microBudgetMs < 200;
    
    if (!shouldSkipDeep) {
      t_deep_started_ms = Date.now() - t0;
      console.log('deep_lane_starting', {
        t_deep_started_ms,
        micro_budget_at_spawn: microBudgetMs,
        merge_window_ms: MergeConfig.mergeWindowMs
      });
      
      // Start deep lane immediately
      const deepStartDelay = shouldStartDeepImmediately ? 0 : 300;
      deepStartTimer = setTimeout(async () => {
        try {
          await runDeepLane({
            query: singleMessage,
            avatarId: '0585f43b-4b49-4e16-b2a7-91c8e1e3850c',
            writer: streamWriter!,
            abortSignal: deepAbort.signal,
            deepProducedAny,
            traceId
          });
        } catch (e) {
          console.warn('deep_lane_error', e);
        }
      }, deepStartDelay);
    }
    
    // Set hard deadline timer
    deadlineTimer = setTimeout(() => {
      if (!deepAbort.signal.aborted) {
        deepAbort.abort('budget_deadline');
      }
    }, Math.max(0, HARD_DEADLINE - Date.now()));
    
    // Fast path with non-blocking pinned memory injection
    const fastHello = fastHelloFromCacheOrTemplate({ name: 'Jonathan' });
    await streamWriter!.write(encodeSSE({ 
      channel: 'fast', 
      delta: fastHello 
    }));
    
    // Non-blocking pinned memory injection (hard cap 100ms)
    let pinnedMemories: any[] = [];
    if (pinnedCount > 0) {
      pinnedMemories = await getPinnedMemoriesWithTimeout(singleMessage, '0585f43b-4b49-4e16-b2a7-91c8e1e3850c', 100);
      console.log('pinned_memory_result', {
        requested: pinnedCount,
        retrieved: pinnedMemories.length,
        timeout_hit: pinnedMemories.length === 0
      });
    }
    
    // Generate fast response with pinned memories if available
    let fastResponse = '';
    if (pinnedMemories.length > 0) {
      // Use pinned memories to generate specific response
      const memoryContext = pinnedMemories.map(m => m.fragment_text).join(' ');
      fastResponse = `Based on my memories: ${memoryContext.substring(0, 200)}...`;
    } else {
      // Fallback to generic response that doesn't hallucinate
      fastResponse = "I'm thinking about that...";
    }
    
    await streamWriter!.write(encodeSSE({ 
      channel: 'fast', 
      delta: fastResponse 
    }));
    
    // Merge window logic - wait for deep contribution if required
    if (deepMustContribute && !deepProducedAny.value) {
      const remainingBudget = HARD_DEADLINE - Date.now();
      if (remainingBudget > MergeConfig.mergeWindowMs) {
        console.log('deep_must_contribute_waiting', {
          merge_window_ms: MergeConfig.mergeWindowMs,
          remaining_budget: remainingBudget
        });
        
        // Wait for merge window
        await new Promise<void>((resolve) => {
          mergeWindowTimer = setTimeout(() => {
            if (!deepProducedAny.value) {
              console.log('deep_timeout', 'merge_window_expired');
              streamWriter!.write(encodeSSE({ 
                event: 'deep_timeout',
                reason: 'merge_window_expired'
              }));
            }
            resolve();
          }, MergeConfig.mergeWindowMs);
          
          // Also resolve if deep produces content
          const checkDeep = setInterval(() => {
            if (deepProducedAny.value) {
              clearInterval(checkDeep);
              if (mergeWindowTimer) {
                clearTimeout(mergeWindowTimer);
                mergeWindowTimer = null;
              }
              resolve();
            }
          }, 50);
        });
      }
    }
    
    // Emit final metadata
    await streamWriter!.write(encodeSSE({
      event: 'meta',
      trace_id: traceId,
      latency_budget_ms: BUDGET_MS,
      deep_merge: deepProducedAny.value,
      deep_tokens_any: deepProducedAny.value,
      t_deep_started_ms,
      micro_budget_ms: microBudgetMs,
      pinned_count: pinnedCount,
      deep_spawned: !shouldSkipDeep,
      intent
    }));
    
    // Emit explicit deep_merge event if deep contributed
    if (deepProducedAny.value) {
      await streamWriter!.write(encodeSSE({
        event: 'deep_merge_log',
        deep_merge: true,
        deep_tokens_any: true
      }));
    }
    
    await streamWriter!.write(encodeSSE({ event: 'end' }));
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
    
  } catch (error) {
    console.error('chat_route_error', error);
    
    if (streamWriter && !streamWriter.closed) {
      await streamWriter.write(encodeSSE({
        event: 'error',
        error: 'Internal server error'
      }));
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    // Always cleanup on any exit path
    cleanup();
  }
}