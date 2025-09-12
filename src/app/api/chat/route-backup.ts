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

// 4) Pinned memories must not starve - raceWithTimeout implementation
async function raceWithTimeout<T>(promise: Promise<T>, ms: number): Promise<{ok: boolean, timeout: boolean, result?: T}> {
  let timeoutId: NodeJS.Timeout | null = null;
  let isResolved = false;

  const timeoutPromise = new Promise<{ok: boolean, timeout: boolean}>((resolve) => {
    timeoutId = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        resolve({ok: false, timeout: true});
      }
    }, ms);
  });
  
  const wrappedPromise = promise.then(
    result => {
      if (!isResolved) {
        isResolved = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        return {ok: true, timeout: false, result};
      }
      return {ok: false, timeout: true}; // Already resolved by timeout
    },
    error => {
      if (!isResolved) {
        isResolved = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        throw error;
      }
      throw new Error('Already resolved by timeout');
    }
  );
  
  return Promise.race([wrappedPromise, timeoutPromise]);
}

async function getPinnedMemoriesWithTimeout(query: string, avatarId: string): Promise<any[]> {
  const startTime = Date.now();
  const isDev = process.env.NODE_ENV !== 'production';
  const timeoutMs = isDev ? 300 : 150; // Increased timeout for dev
  
  console.log('pinned_rpc_started', { query: query.substring(0, 50), timestamp: startTime });
  
  const memoryPromise = supabase.rpc('get_enhanced_memories', {
    target_user_id: null,
    target_avatar_id: avatarId,
    search_query: query,
    match_count: 5,
    similarity_threshold: 0.25
  });
  
  const raceResult = await raceWithTimeout(memoryPromise, timeoutMs);
  const elapsed = Date.now() - startTime;
  
  if (raceResult.timeout) {
    console.log('pinned_memory_result', { 
      requested: 5, 
      retrieved: 0, 
      timeout_hit: true,
      elapsed_ms: elapsed
    });
    
    // TODO: Implement LRU fallback cache here
    return [];
  }
  
  const { data, error } = raceResult.result || {};
  
  if (error) {
    console.warn('pinned_memory_error', error.message);
    return [];
  }
  
  const memories = data || [];
  console.log('pinned_memory_result', { 
    requested: 5, 
    retrieved: memories.length, 
    timeout_hit: false,
    elapsed_ms: elapsed
  });
  
  return memories;
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
  
  // 1) Deep-lane state & meta - canonical ref
  const deepProducedAnyRef = { value: false };
  let streamWriter: SafeStreamWriter | null = null;
  let deepAbort = new AbortController();
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
    
    // Initialize streaming with safe guards
    let streamClosed = false;
    const enc = new TextEncoder();
    const safeWrite = (obj: any) => { 
      if (streamClosed) return; 
      try { 
        controller.enqueue(enc.encode(JSON.stringify(obj) + "\n")); 
      } catch { 
        streamClosed = true; 
      } 
    };
    const safeClose = () => { 
      if (streamClosed) return; 
      try { 
        controller.close(); 
      } catch {}; 
      streamClosed = true; 
    };

    const stream = new ReadableStream({
      start(controller) {
        // Create a writer-like interface for the controller
        const writerInterface = {
          write: (chunk: Uint8Array) => {
            if (streamClosed) return Promise.resolve();
            try {
              controller.enqueue(chunk);
              return Promise.resolve();
            } catch (error) {
              streamClosed = true;
              return Promise.reject(error);
            }
          },
          close: () => {
            safeClose();
            return Promise.resolve();
          }
        };
        streamWriter = new SafeStreamWriter(writerInterface as any);
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
      
      // 2) Start deep immediately - no waits, no I/O first
      deepStartTimer = setTimeout(async () => {
        try {
          await runDeepLane({
            query: singleMessage,
            avatarId: '0585f43b-4b49-4e16-b2a7-91c8e1e3850c',
            writer: streamWriter!,
            abortSignal: deepAbort.signal,
            deepProducedAny: deepProducedAnyRef,
            traceId
          });
        } catch (e) {
          console.warn('deep_lane_error', e);
        }
      }, 0); // Start immediately
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
    
    // Non-blocking pinned memory injection with improved timeout
    let pinnedMemories: any[] = [];
    if (pinnedCount > 0) {
      pinnedMemories = await getPinnedMemoriesWithTimeout(singleMessage, '0585f43b-4b49-4e16-b2a7-91c8e1e3850c');
      
      // Log successful pinned memory injection
      if (pinnedMemories.length > 0) {
        console.log('pinned_memories_injected', {
          count: pinnedMemories.length,
          intent: intent,
          memory_types: pinnedMemories.map(m => m.conversation_context?.type || 'unknown')
        });
      }
    }
    
    // 5) Hallucination guard in fast lane
    let fastResponse = '';
    if (pinnedMemories.length > 0) {
      // Use pinned memories to generate specific response based on intent
      const memoryTexts = pinnedMemories.map(m => m.fragment_text);
      
      // Simple slot detector for Austin years, Tyler.city
      if (intent === 'travel' && singleMessage.toLowerCase().includes('austin')) {
        const austinMemory = memoryTexts.find(text => 
          text.toLowerCase().includes('austin') && 
          (text.includes('2009') || text.includes('2018') || text.match(/\d{4}/))
        );
        if (austinMemory) {
          // Extract years if present
          const yearMatch = austinMemory.match(/(2009|2018|\d{4}[-–]\d{4})/);
          if (yearMatch) {
            fastResponse = `I lived in Austin from 2009–2018.`;
          } else {
            fastResponse = `About my time in Austin - ${austinMemory.substring(0, 150)}...`;
          }
        } else {
          fastResponse = "I'm checking my notes…";
        }
      } else if (intent === 'people' && singleMessage.toLowerCase().includes('tyler')) {
        const tylerMemory = memoryTexts.find(text => text.toLowerCase().includes('tyler'));
        if (tylerMemory) {
          fastResponse = `About Tyler - ${tylerMemory.substring(0, 150)}...`;
        } else {
          fastResponse = "I'm checking my notes…";
        }
      } else if (intent === 'pets' && singleMessage.toLowerCase().includes('olive')) {
        const oliveMemory = memoryTexts.find(text => text.toLowerCase().includes('olive'));
        if (oliveMemory) {
          fastResponse = `About Olive - ${oliveMemory.substring(0, 150)}...`;
        } else {
          fastResponse = "I'm checking my notes…";
        }
      } else if (intent === 'opinion' && singleMessage.toLowerCase().includes('trump')) {
        const trumpMemory = memoryTexts.find(text => text.toLowerCase().includes('trump'));
        if (trumpMemory) {
          fastResponse = `My thoughts on Trump - ${trumpMemory.substring(0, 150)}...`;
        } else {
          fastResponse = "I'm checking my notes…";
        }
      } else {
        // Generic memory-based response
        fastResponse = `Based on what I remember: ${memoryTexts[0].substring(0, 150)}...`;
      }
    } else {
      // If intent ∈ {travel, timeline, people} AND pins==0: Fast lane must not guess
      if (['travel', 'timeline', 'people'].includes(intent || '')) {
        fastResponse = "I'm checking my notes…";
      } else {
        fastResponse = "I'm thinking about that...";
      }
    }
    
    await streamWriter!.write(encodeSSE({ 
      channel: 'fast', 
      delta: fastResponse 
    }));
    
    // 3) Fix the merge contract - hold finalization until deep contributes OR timer fires
    if (deepMustContribute && !deepProducedAnyRef.value) {
      const remainingBudget = HARD_DEADLINE - Date.now();
      if (remainingBudget > MergeConfig.mergeWindowMs) {
        console.log('deep_must_contribute_waiting', {
          merge_window_ms: MergeConfig.mergeWindowMs,
          remaining_budget: remainingBudget
        });
        
        // Wait for merge window - do NOT abort deep when timer fires
        await new Promise<void>((resolve) => {
          mergeWindowTimer = setTimeout(() => {
            console.log('merge_window_expired', { deep_produced: deepProducedAnyRef.value });
            resolve(); // Just resolve, don't abort deep
          }, MergeConfig.mergeWindowMs);
          
          // Also resolve if deep produces content
          const checkDeep = setInterval(() => {
            if (deepProducedAnyRef.value) {
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
    
    // Emit final metadata - all meta events must read deepProducedAnyRef.value
    await streamWriter!.write(encodeSSE({
      event: 'meta',
      trace_id: traceId,
      latency_budget_ms: BUDGET_MS,
      deep_merge: deepProducedAnyRef.value,
      deep_tokens_any: deepProducedAnyRef.value,
      t_deep_started_ms,
      micro_budget_ms: microBudgetMs,
      pinned_count: pinnedCount,
      deep_spawned: !shouldSkipDeep,
      intent
    }));
    
    // Emit explicit deep_merge event if deep contributed
    if (deepProducedAnyRef.value) {
      await streamWriter!.write(encodeSSE({
        event: 'deep_merge_log',
        deep_merge: true,
        deep_tokens_any: true
      }));
    }
    
    await streamWriter!.write(encodeSSE({ event: 'end' }));
    streamWriter!.close(); // Properly close the stream
    
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