/**
 * Simple in-memory cache for API responses
 */

const cache = new Map<string, { data: any, expiry: number }>();

export function getCached<T>(key: string): T | null {
  const item = cache.get(key);
  if (!item) return null;
  if (item.expiry < Date.now()) {
    cache.delete(key);
    return null;
  }
  return item.data as T;
}

export function setCached<T>(key: string, data: T, ttlMs = 60000): void {
  cache.set(key, {
    data,
    expiry: Date.now() + ttlMs
  });
}

export function clearCache(pattern?: string): void {
  if (!pattern) {
    cache.clear();
    return;
  }
  
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}