/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import AvatarCanvas from '@/components/AvatarCanvas';

const INTRO = `👋 Hi there! I'm EchoStone — ask me anything or click 🎤 to speak!`;

type Particle = { id: number; left: number; size: number; delay: number };

export default function Page() {
  const [question, setQuestion] = useState<string>('');
  const [answer, setAnswer] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [listening, setListening] = useState<boolean>(false);
  const [playing, setPlaying] = useState<boolean>(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const recognitionRef = useRef<any>(null);
  const introPlayed = useRef<boolean>(false);

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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      setAnswer(data.answer);
    } catch {
      setAnswer('Sorry, something went wrong.');
    }
    setLoading(false);

    // play voice
    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: answer }),
      });
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      setPlaying(true);
      audio.onended = () => setPlaying(false);
      await audio.play();
    } catch {
      setPlaying(false);
    }
  };

  const startListening = () => {
    playIntro();
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const Recognition =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition;
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    setListening(true);
    recognition.start();
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuestion(transcript);
      handleSubmit();
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
  };

  useEffect(() => {
    if (!listening) return;
    const newParticles: Particle[] = Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      left: Math.random() * 80 + 10,
      size: Math.random() * 8 + 4,
      delay: Math.random() * 0.5,
    }));
    setParticles(newParticles);
    const timer = setTimeout(() => setParticles([]), 2500);
    return () => clearTimeout(timer);
  }, [listening]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const dot = document.createElement('div');
      dot.className = 'glow-dot';
      dot.style.top = `${e.clientY}px`;
      dot.style.left = `${e.clientX}px`;
      document.body.append(dot);
      dot.addEventListener('animationend', () => dot.remove());
    };
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, []);

  return (
    <main className="page-container">
      <div className="logo-wrap">
        <Image
          src="/echostone_logo.png"
          alt="EchoStone"
          width={80}
          height={80}
        />
      </div>
      <h1>EchoStone — Ask Jonathan</h1>
      <p className="intro">{INTRO}</p>

      <form onSubmit={handleSubmit} className="ask-form">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything…"
        />
        <button type="submit">
          {loading ? '…Thinking' : 'Ask'}
        </button>
      </form>

      <button
        onClick={startListening}
        className={`mic-btn ${listening ? 'active' : ''}`}
      >
        {listening ? '🎤 Listening…' : '🎤 Speak'}
      </button>

      {answer && (
        <section className="answer">
          <h2>Jonathan says:</h2>
          <p>{answer}</p>
        </section>
      )}

      <section className="avatar-section">
        <h2>Your 3D Avatar</h2>
        <AvatarCanvas />
      </section>

      {playing && (
        <div className="sound-bars">
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      )}

      {particles.map((p) => (
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
