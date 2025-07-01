/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import Image from 'next/image';
import { useState } from 'react';

export default function Page() {
  const [question, setQuestion] = useState<string>('');
  const [answer, setAnswer] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

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
  };

  return (
    <main style={{
      minHeight: '100vh',
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: 'radial-gradient(circle at center, #8b5cf6 0%, #4c1d95 40%, #000 100%)',
      color: 'white',
      textAlign: 'center',
    }}>
      <Image src="/echostone_logo.png" alt="EchoStone" width={100} height={100} />
      <h1>EchoStone — Ask Jonathan</h1>
      <form onSubmit={handleSubmit} style={{ marginTop: '2rem', display: 'flex', gap: '0.5rem' }}>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Ask anything…"
          style={{
            flex: 1,
            padding: '0.75rem',
            borderRadius: '4px',
            border: 'none',
            background: '#2a203c',
            color: 'white',
          }}
        />
        <button
          type="submit"
          style={{
            padding: '0.75rem 1.25rem',
            background: '#9333ea',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          {loading ? '…Thinking' : 'Ask'}
        </button>
      </form>
      {answer && (
        <div style={{ marginTop: '2rem', maxWidth: '600px' }}>
          <h2>Jonathan says:</h2>
          <p style={{ color: '#ddd' }}>{answer}</p>
        </div>
      )}
    </main>
  );
}
