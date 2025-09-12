import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

type Caches = {
  avatarId: Map<string, string>;
  demoSeeds: Map<string, { prompt: string; expires: number }>;
  sessionCtx: Map<string, any>;
};

const g = globalThis as any;

if (!g.__ECHO_SINGLETONS__) {
  g.__ECHO_SINGLETONS__ = {
    supabase: createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    ),
    openai: new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    }),
    caches: {
      avatarId: new Map(),
      demoSeeds: new Map(),
      sessionCtx: new Map()
    } as Caches
  };
}

export const supabase = g.__ECHO_SINGLETONS__.supabase as ReturnType<typeof createClient>;
export const openai = g.__ECHO_SINGLETONS__.openai as OpenAI;
export const caches = g.__ECHO_SINGLETONS__.caches as Caches;

// Style cache for enhanced profiles
type StyleEntry = { value: any; expires: number };
if (!g.__ECHO_SINGLETONS__.styleCache) g.__ECHO_SINGLETONS__.styleCache = new Map<string, StyleEntry>();
export const styleCache = g.__ECHO_SINGLETONS__.styleCache as Map<string, StyleEntry>;

// Style cache sweeper every 60s
if (!g.__ECHO_SINGLETONS__.styleSweeper) {
  g.__ECHO_SINGLETONS__.styleSweeper = setInterval(() => {
    const now = Date.now();
    for (const [k,v] of styleCache) if (v.expires < now) styleCache.delete(k);
  }, 60_000).unref?.();
}

// Lightweight cache sweeper - evict expired entries
if (!g.__ECHO_SWEEPER_STARTED__) {
  g.__ECHO_SWEEPER_STARTED__ = true;
  
  setInterval(() => {
    const now = Date.now();
    
    // Sweep demo seeds
    for (const [key, value] of caches.demoSeeds.entries()) {
      if (value.expires < now) {
        caches.demoSeeds.delete(key);
      }
    }
    
    // Sweep session context
    for (const [key, value] of caches.sessionCtx.entries()) {
      if (value.expires && value.expires < now) {
        caches.sessionCtx.delete(key);
      }
    }
  }, 60000); // Every minute
}