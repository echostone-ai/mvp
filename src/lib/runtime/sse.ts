// src/lib/runtime/sse.ts
export type DeepProvider = 'openai-chat' | 'openai-responses' | 'anthropic' | 'azure-openai';

export function* iterDataLines(chunk: string) {
  for (const line of chunk.split('\n')) {
    const t = line.trim();
    if (t.startsWith('data:')) yield t.slice(5).trim();
  }
}

export function extractDeltas(payload: any, provider: DeepProvider): string[] {
  const out: string[] = [];
  try {
    switch (provider) {
      case 'openai-chat': {
        const d = payload?.choices?.[0]?.delta;
        if (typeof d?.content === 'string') out.push(d.content);
        break;
      }
      case 'openai-responses': {
        const t = payload?.delta ?? payload?.text ?? payload?.output_text ?? null;
        if (typeof t === 'string') out.push(t);
        if (payload?.type?.includes('delta') && typeof payload?.delta === 'string') out.push(payload.delta);
        break;
      }
      case 'anthropic': {
        const t = payload?.delta?.text ?? payload?.content_block?.text ?? null;
        if (typeof t === 'string') out.push(t);
        break;
      }
      case 'azure-openai': {
        const d = payload?.choices?.[0]?.delta;
        if (typeof d?.content === 'string') out.push(d.content);
        break;
      }
    }
  } catch {}
  return out;
}