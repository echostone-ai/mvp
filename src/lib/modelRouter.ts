// src/lib/modelRouter.ts
export function pickModel(opts?: { forceFallback?: boolean }) {
  const use5 = process.env.FEATURE_GPT5_ENABLED === 'true' && !opts?.forceFallback
  return use5 ? (process.env.MODEL_PRIMARY || 'gpt-5') : (process.env.MODEL_FALLBACK || 'gpt-4o')
}



