import { styleCache } from '@/lib/runtime/singletons';
import { EnhancedPromptBuilder } from '@/lib/services/enhancedPromptBuilder';

const TTL = 10 * 60 * 1000;
const g = globalThis as any;

// Location cache
const locCache = g.__ECHO_SINGLETONS__.locCache ??= new Map<string, LocationLayer>();

export type LocationLayer = { 
  value: string; 
  source: 'env'|'userPref'|'session'|'ipGeo'|'seed'; 
  ts: number; 
  ttlMs: number 
};

export async function getEnhancedStyleProfileCached(avatarId: string) {
  const key = `style:${avatarId}`;
  const hit = styleCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  
  try {
    const enhancedBuilder = new EnhancedPromptBuilder();
    const val = await enhancedBuilder.fetchEnhancedStyleProfile(avatarId);
    styleCache.set(key, { value: val, expires: Date.now() + TTL });
    return val;
  } catch (error) {
    console.warn('style_profile_cache_error', error);
    return {};
  }
}

export function resolveCurrentLocation(avatarId: string, opts: {
  env?: string; 
  userPref?: string; 
  session?: string; 
  ipGeo?: string; 
  seed?: string;
}): string {
  // precedence: userPref > env > session > ipGeo > seed
  const ordered = [opts.userPref, opts.env, opts.session, opts.ipGeo, opts.seed].filter(Boolean) as string[];
  const val = ordered[0] || 'unknown';
  
  // Determine source
  let source: LocationLayer['source'] = 'seed';
  if (opts.userPref) source = 'userPref';
  else if (opts.env) source = 'env';
  else if (opts.session) source = 'session';
  else if (opts.ipGeo) source = 'ipGeo';
  
  locCache.set(avatarId, { 
    value: val, 
    source, 
    ts: Date.now(), 
    ttlMs: 10*60*1000 
  });
  return val;
}