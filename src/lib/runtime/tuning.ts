// src/lib/runtime/tuning.ts
type Stats = { fastTokensAvg: number; samples: number; updatedAt: number };
type Tuning = { fastMaxTokens: number; stats: Stats };

const g = globalThis as any;
if (!g.__ECHO_TUNING__) g.__ECHO_TUNING__ = new Map<string, Tuning>();
const store: Map<string, Tuning> = g.__ECHO_TUNING__;

const MIN = 40, MAX = 72;

export function getFastMaxForAvatar(avatarId: string, planned: number) {
  const t = store.get(avatarId);
  if (!t) return Math.max(MIN, Math.min(MAX, planned));
  // Nudge toward prior performance
  const target = Math.round((planned + t.fastMaxTokens + Math.max(MIN, Math.min(MAX, Math.round(t.stats.fastTokensAvg)))) / 3);
  return Math.max(MIN, Math.min(MAX, target));
}

export function recordFastUsage(avatarId: string, emittedTokens: number) {
  const now = Date.now();
  const t = store.get(avatarId) ?? { fastMaxTokens: emittedTokens, stats: { fastTokensAvg: emittedTokens, samples: 1, updatedAt: now } };
  const s = t.stats;
  const n = Math.min(50, s.samples + 1);
  s.fastTokensAvg = (s.fastTokensAvg * s.samples + emittedTokens) / n;
  s.samples = n;
  s.updatedAt = now;
  t.fastMaxTokens = Math.max(MIN, Math.min(MAX, Math.round(s.fastTokensAvg)));
  store.set(avatarId, t);
  return t.fastMaxTokens;
}