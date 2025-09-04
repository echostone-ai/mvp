// src/lib/voice/player.ts
// Gapless dual-audio player with tiny crossfade + autoplay unlock

import { AnyAudioSource, normalizeToBlob } from './tts';

class GaplessPlayer {
  private static instance: GaplessPlayer;
  private a = typeof Audio !== 'undefined' ? new Audio() : ({} as HTMLAudioElement);
  private b = typeof Audio !== 'undefined' ? new Audio() : ({} as HTMLAudioElement);
  private current: HTMLAudioElement;
  private next: HTMLAudioElement;
  private playing = false;
  private queue: Array<Blob> = [];
  private crossfadeMs = 28;
  private minBufferAheadMs = 240;
  private fadeTimer: number | null = null;
  private unlocked = false;

  private constructor() {
    this.current = this.a;
    this.next = this.b;
    if (this.current && this.next) {
      this.current.preload = 'auto';
      this.next.preload = 'auto';
      this.current.onended = () => this.tryDequeue();
    }
  }

  static getInstance(): GaplessPlayer {
    if (!GaplessPlayer.instance) GaplessPlayer.instance = new GaplessPlayer();
    return GaplessPlayer.instance;
  }

  async unlock() {
    if (this.unlocked || typeof Audio === 'undefined') return;
    try {
      const silent = new Audio('data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAA');
      silent.muted = true;
      await silent.play().catch(() => {});
      silent.pause();
      this.unlocked = true;
    } catch {}
  }

  stopAll() {
    [this.a, this.b].forEach(el => { try { el.pause(); el.src = ''; } catch {} });
    this.queue = [];
    this.playing = false;
    if (this.fadeTimer) cancelAnimationFrame(this.fadeTimer);
    this.fadeTimer = null;
  }

  getIsPlaying() { return this.playing; }

  async enqueue(src: AnyAudioSource) {
    const blob = await normalizeToBlob(src);
    if (!blob || blob.size === 0) return;

    this.queue.push(blob);
    if (!this.playing) {
      await this.seedAndStart();
    } else if (this.next && !this.next.src && this.queue.length > 0) {
      await this.prepareNext(this.queue.shift()!);
    }
  }

  private async seedAndStart() {
    if (!this.current) return;
    let totalMs = 0;
    const temp: Blob[] = [];
    while (this.queue.length && totalMs < this.minBufferAheadMs) {
      temp.push(this.queue.shift()!);
      totalMs += 120;
    }
    if (temp.length === 0) return;

    await this.loadInto(this.current, temp.shift()!);
    if (this.next && temp.length) await this.loadInto(this.next, temp.shift()!);

    this.playing = true;
    try { await this.current.play(); } catch {}
    this.queue = temp.concat(this.queue);
    this.current.ontimeupdate = () => this.maybeCrossfade();
  }

  private maybeCrossfade() {
    const el = this.current;
    if (!el || !el.duration || !isFinite(el.duration)) return;
    const remaining = (el.duration - el.currentTime) * 1000;
    if (remaining <= this.crossfadeMs + 10 && this.next && this.next.src) this.crossfade();
  }

  private crossfade() {
    const from = this.current;
    const to = this.next;
    if (!from || !to) return;
    [this.current, this.next] = [this.next, this.current];

    to.volume = 0;
    try { to.currentTime = 0; } catch {}
    to.play().catch(() => {});

    const start = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const dur = this.crossfadeMs;

    const step = (nowRaw: number) => {
      const now = nowRaw ?? Date.now();
      const t = Math.min(1, (now - start) / dur);
      to.volume = Math.sqrt(t);
      from.volume = Math.sqrt(1 - t);
      if (t < 1) {
        this.fadeTimer = requestAnimationFrame(step);
      } else {
        try { from.pause(); } catch {}
        try { from.src = ''; } catch {}
        from.volume = 1;
        this.fadeTimer = null;
        this.tryDequeue();
      }
    };
    this.fadeTimer = requestAnimationFrame(step);
  }

  private async tryDequeue() {
    if (!this.next || this.next.src || !this.queue.length) return;
    await this.prepareNext(this.queue.shift()!);
  }

  private async prepareNext(blob: Blob) {
    await this.loadInto(this.next, blob);
  }

  private async loadInto(el: HTMLAudioElement, blob: Blob) {
    const url = URL.createObjectURL(blob);
    el.src = url;
    try { await (el as any).load?.(); } catch {}
  }
}

export const gaplessPlayer = GaplessPlayer.getInstance();
