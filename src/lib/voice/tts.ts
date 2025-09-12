// src/lib/voice/tts.ts
// Normalizes whatever the TTS provider returns into a playable audio Blob.
// Supports: Blob | ArrayBuffer | Uint8Array | Response | string (URL or data: or base64)

export type AnyAudioSource = Blob | ArrayBuffer | Uint8Array | Response | string;

function isDataUrl(s: string) {
  return /^data:audio\/[a-z0-9.+-]+;base64,/i.test(s);
}
function isProbablyBase64(s: string) {
  return /^[A-Za-z0-9+/=\s]+$/.test(s) && s.length > 64;
}
function base64ToBlob(b64: string, mime = 'audio/mpeg'): Blob {
  const cleaned = b64.replace(/\s+/g, '');
  const bin = typeof atob !== 'undefined' ? atob(cleaned) : Buffer.from(cleaned, 'base64').toString('binary');
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function normalizeToBlob(src: AnyAudioSource, fallbackMime = 'audio/mpeg'): Promise<Blob> {
  if (!src) return new Blob([]);
  if (src instanceof Blob) return src;
  if (src instanceof ArrayBuffer) return new Blob([src], { type: fallbackMime });
  if (src instanceof Uint8Array) return new Blob([src], { type: fallbackMime });
  if (typeof src === 'string') {
    if (isDataUrl(src)) {
      try {
        const res = await fetch(src);
        const blob = await res.blob();
        return blob.type ? blob : new Blob([await res.arrayBuffer()], { type: fallbackMime });
      } catch {
        const b64 = src.split(',')[1] ?? '';
        return base64ToBlob(b64, fallbackMime);
      }
    }
    if (isProbablyBase64(src)) return base64ToBlob(src, fallbackMime);
    const res = await fetch(src);
    return await res.blob();
  }
  if (typeof Response !== 'undefined' && src instanceof Response) {
    const blob = await src.blob();
    return blob.type ? blob : new Blob([await src.arrayBuffer()], { type: fallbackMime });
  }
  return new Blob([], { type: fallbackMime });
}

export async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 5000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } finally {
    clearTimeout(id);
  }
}
