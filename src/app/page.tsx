/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import Image from 'next/image';
import { useState, useRef } from 'react';

export default function Page() {
  const [question, setQuestion] = useState<string>('');
  const [answer, setAnswer] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [listening, setListening] = useState<boolean>(false);
  const [playing, setPlaying] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      setAnswer(data.answer);

      // play voice via ElevenLabs
      const vr = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: data.answer }),
      });
      const blob = await vr.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      setPlaying(true);
      audio.onended = () => setPlaying(false);
      audio.play();
    } catch {
      setAnswer('Sorry, something went wrong.');
    }
    setLoading(false);
  };

  const startListening = () => {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const Rec = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new Rec();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.onstart = () => setListening(true);
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuestion(transcript);
      handleSubmit();
    };
    recognition.start();
  };

  return (
    <main style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at center, #8b5cf6 0%, #4c1d95 40%, #000 100%)',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      textAlign: 'center',
      fontFamily: 'Merriweather, serif'
    }}>
      {/* Logo */}
      <div style={{ marginBottom: '1rem' }}>
        <Image src="/echostone_logo.png" alt="EchoStone Logo" width={96} height={96} />
      </div>
      {/* Title */}
      <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>EchoStone — Ask Jonathan</h1>

      {/* Ask form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', width: '100%', maxWidth: '600px' }}>
        <input
          style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '2px solid #ccc', outline: 'none', fontSize: '1rem' }}
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Ask anything…"
        />
        <button
          type="submit"
          style={{ padding: '0.75rem 1.25rem', background: '#9333ea', border: 'none', borderRadius: '8px', color: 'white', fontSize: '1rem', cursor: 'pointer' }}
        >
          {loading ? '…Thinking' : 'Ask'}
        </button>
      </form>

      {/* Mic button */}
      <button
        onClick={startListening}
        style={{
          padding: '0.75rem 1.5rem',
          marginTop: '1.5rem',
          background: listening ? '#dc2626' : '#444',
          border: 'none',
          borderRadius: '8px',
          color: 'white',
          fontSize: '1rem',
          cursor: 'pointer',
          transform: listening ? 'scale(1.05)' : 'none',
          boxShadow: listening ? '0 0 0 6px rgba(220,38,38,0.5)' : 'none',
          transition: 'all 0.2s ease'
        }}
      >
        {listening ? '🎤 Listening…' : '🎤 Speak'}
      </button>

      {/* Answer */}
      {answer && (
        <div style={{ marginTop: '2rem', maxWidth: '600px' }}>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Jonathan says:</h2>
          <p style={{ fontSize: '1.125rem', lineHeight: '1.6', color: '#e0d7f5' }}>{answer}</p>
        </div>
      )}

      {/* Sound bars */}
      {playing && (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: '32px', marginTop: '1rem' }}>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              style={{
                width: '8px',
                background: '#c084fc',
                animation: 'bar 0.8s infinite ease-in-out',
                animationDelay: `${i * 0.1}s`
              }}
            />
          ))}
        </div>
      )}

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&display=swap');
        @keyframes bar { 0%,100% { height: 8px; } 50% { height: 28px; } }
      `}</style>
    </main>
  );
}
