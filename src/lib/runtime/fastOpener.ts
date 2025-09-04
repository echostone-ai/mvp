/**
 * Fast opener - deterministic greeting + conversational hook
 * Apple-level clarity: short, warm, engaging
 */

export function fastOpener({ displayName }: { displayName: string }): string {
  // Deterministic, friendly opener; keep ≤120 chars
  return `Hey there—it's ${displayName}. What's on your mind?`;
}

export function personaSeedFromCacheOrDefault(avatarId: string): string {
  const { caches } = require('./singletons');
  
  // Try demo seed cache first
  const seedKey = `demo-seed:${avatarId}`;
  const cached = caches.demoSeeds.get(seedKey);
  
  if (cached && cached.expires > Date.now()) {
    return cached.prompt;
  }
  
  // Fallback to minimal default
  if (avatarId.includes('jonathan') || avatarId.includes('demo')) {
    return `You are Jonathan Braden. You're warm, conversational, and engaging. You currently live in Spain (Valencia area) after having lived in various places including Maine. You have a dog named Romeo.`;
  }
  
  return `You are a helpful assistant. Be warm, natural, and conversational.`;
}