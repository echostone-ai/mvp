'use client';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import AvatarCanvas from '@/components/AvatarCanvas';

const INTRO = `👋 Hi there! I'm EchoStone — ask me anything or click 🎤 to speak!`;

type Particle = { id: number; left: number; size: number; delay: number };

export default function Page() {
  const [q, setQ] = useState('');
  const [ans, setAns] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const recog = useRef<any>(null);
  const introPlayed = useRef(false);

  // play intro once
  const playIntro = async () => {
    if (introPlayed.current) return;
    introPlayed.current = true;
    setPlaying(true);
    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: INTRO }),
      });
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audio.onended = () => setPlaying(false);
      await audio.play();
    } catch {
      setPlaying(false);
    }
  };

  // chat submit
  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const { answer } = await r.json();
      setAns(answer);
    } catch {
      setAns('Oops, something went wrong.');
    }
    setLoading(false);

    // voice reply
    try {
      const vr = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ans }),
      });
      const blob = await vr.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      setPlaying(true);
      audio.onended = () => setPlaying(false);
      await audio.play();
    } catch {
      setPlaying(false);
    }
  };

  // speech recog
  const startListening = () => {
    playIntro();
    if (listening && recog.current) {
      recog.current.stop();
      return;
    }
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const r = new SR();
    recog.current = r;
    r.lang = 'en-US';
    setListening(true);
    r.start();
    r.onresult = (e: any) => {
      setQ(e.results[0][0].transcript);
      submit();
    };
    r.onend = () => {
      setListening(false);
      recog.current = null;
    };
  };

  // floating particles
  useEffect(() => {
    if (!listening) return;
    const arr = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      left: Math.random() * 80 + 10,
      size: Math.random() * 8 + 4,
      delay: Math.random() * 0.5,
    }));
    setParticles(arr);
    const t = setTimeout(() => setParticles([]), 2500);
    return () => clearTimeout(t);
  }, [listening]);

  // glow motes
  useEffect(() => {
    const m = (e: MouseEvent) => {
      const d = document.createElement('div');
      d.className = 'glow-dot';
      d.style.top = `${e.clientY}px`;
      d.style.left = `${e.clientX}px`;
      document.body.append(d);
      d.addEventListener('animationend', () => d.remove());
    };
    window.addEventListener('mousemove', m);
    return () => window.removeEventListener('mousemove', m);
  }, []);

  return (
    <main className="page-container">
      <div className="logo-wrap">
        <Image src="/echostone_logo.png" alt="EchoStone" width={80} height={80} />
      </div>
      <h1>EchoStone — Ask Jonathan</h1>
      <p className="intro">{INTRO}</p>

      <form onSubmit={submit} className="ask-form">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Ask anything…"
        />
        <button type="submit">{loading ? '…Thinking' : 'Ask'}</button>
      </form>

      <button onClick={startListening} className={`mic-btn ${listening ? 'active' : ''}`}>
        {listening ? '🎤 Listening…' : '🎤 Speak'}
      </button>

      {ans && (
        <section className="answer">
          <h2>Jonathan says:</h2>
          <p>{ans}</p>
        </section>
      )}

      <section className="avatar-section">
        <h2>Your 3D Avatar</h2>
        <AvatarCanvas />
      </section>

      {playing && (
        <div className="sound-bars">
          {[...Array(5)].map((_, i) => <div key={i} style={{ animationDelay: `${i * 0.1}s` }} />)}
        </div>
      )}

      {particles.map(p => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </main>
  );
}
