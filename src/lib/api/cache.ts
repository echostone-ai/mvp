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

export function invalidateCache(keyPrefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(keyPrefix)) {
      cache.delete(key);
    }
  }
}