/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

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

      // play voice
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
      textAlign: 'center'
    }}>
      <h1 style={{ marginBottom: '1rem' }}>EchoStone — Ask Jonathan</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', width: '100%', maxWidth: '600px' }}>
        <input
          style={{ flex: 1, padding: '0.75rem', borderRadius: '4px', border: 'none' }}
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Ask anything…"
        />
        <button
          type="submit"
          style={{ padding: '0.75rem 1.25rem', border: 'none', borderRadius: '4px', background: '#9333ea', color: 'white', cursor: 'pointer' }}
        >
          {loading ? '…Thinking' : 'Ask'}
        </button>
      </form>
      <button
        onClick={startListening}
        style={{
          padding: '0.75rem 1.5rem',
          marginBottom: '1.5rem',
          background: listening ? '#dc2626' : '#444',
          border: 'none',
          borderRadius: '4px',
          color: 'white',
          cursor: 'pointer',
          transform: listening ? 'scale(1.05)' : 'none',
          boxShadow: listening ? '0 0 0 4px rgba(220,38,38,0.5)' : 'none',
          transition: 'all 0.2s ease'
        }}
      >
        {listening ? '🎤 Listening…' : '🎤 Speak'}
      </button>
      {answer && (
        <div style={{ maxWidth: '600px' }}>
          <h2>Jonathan says:</h2>
          <p style={{ color: '#ddd' }}>{answer}</p>
        </div>
      )}
      {playing && (
        <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '30px', marginTop: '1rem' }}>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              style={{
                width: '6px',
                background: '#a855f7',
                animation: 'bar 0.8s infinite ease-in-out',
                animationDelay: `${i * 0.1}s`
              }}
            />
          ))}
        </div>
      )}
      <style jsx>{`
        @keyframes bar { 0%,100% { height: 6px; } 50% { height: 24px; } }
      `}</style>
    </main>
  );
}
