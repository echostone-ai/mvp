// src/app/page.tsx
'use client'

import Image from 'next/image'
import { useState, useRef } from 'react'

export default function Page() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [playing, setPlaying] = useState(false)
  const recognitionRef = useRef<any>(null)

  // central “ask” logic, takes text (typed or spoken)
  const askQuestion = async (text: string) => {
    if (!text.trim()) return
    setLoading(true)
    try {
      // 1) Chat
      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      })
      const { answer } = await chatRes.json()
      setAnswer(answer)

      // 2) Voice
      const voiceRes = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: answer }),
      })
      const blob = await voiceRes.blob()
      const audio = new Audio(URL.createObjectURL(blob))
      setPlaying(true)
      audio.onended = () => setPlaying(false)
      audio.play()
    } catch (err) {
      setAnswer('Sorry, something went wrong.')
    }
    setLoading(false)
  }

  // typed submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    askQuestion(question)
  }

  // voice submit
  const startListening = () => {
    // stop if already listening
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop()
      return
    }

    const SpeechRec =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    if (!SpeechRec) {
      alert('Sorry, your browser doesn’t support Speech Recognition.')
      return
    }

    const recognition = new SpeechRec()
    recognitionRef.current = recognition

    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onstart = () => setListening(true)

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.trim()
      setQuestion(transcript)       // show it in the input
      recognition.stop()            // end listening
      setListening(false)
      askQuestion(transcript)       // fire immediately
    }

    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }

    recognition.start()
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at center, #8b5cf6 0%, #4c1d95 40%, #000 100%)',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
        fontFamily: 'Poppins, sans-serif',
      }}
    >
      {/* Logo */}
      <div style={{ marginBottom: '1rem' }}>
        <Image
          src="/echostone_logo.png"
          alt="EchoStone Logo"
          width={auto}
          height={120}
        />
      </div>

      {/* Title */}
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>
        EchoStone — Ask Jonathan
      </h1>

      {/* Intro (optional) */}
      <p style={{ maxWidth: '500px', color: '#d1d5db', marginBottom: '2rem' }}>
        👋 Hi there! I’m EchoStone — ask me anything or click 🎤 to speak!
      </p>

      {/* Ask form */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          gap: '0.5rem',
          width: '100%',
          maxWidth: '600px',
        }}
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask me anything…"
          style={{
            flex: 1,
            padding: '0.75rem',
            borderRadius: '8px',
            border: '2px solid #ccc',
            outline: 'none',
            fontSize: '1rem',
          }}
        />
        <button
          type="submit"
          style={{
            padding: '0.75rem 1.5rem',
            background: '#9333ea',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontSize: '1rem',
            cursor: 'pointer',
          }}
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
          boxShadow: listening
            ? '0 0 0 6px rgba(220,38,38,0.5)'
            : 'none',
          transition: 'all 0.2s ease',
        }}
      >
        {listening ? '🎤 Listening…' : '🎤 Speak'}
      </button>

      {/* Answer */}
      {answer && (
        <div style={{ marginTop: '2rem', maxWidth: '600px' }}>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>
            Jonathan says:
          </h2>
          <p
            style={{
              fontSize: '1.125rem',
              lineHeight: '1.6',
              color: '#e0d7f5',
            }}
          >
            {answer}
          </p>
        </div>
      )}

      {/* Sound bars */}
      {playing && (
        <div
          style={{
            display: 'flex',
            gap: '6px',
            alignItems: 'flex-end',
            height: '32px',
            marginTop: '1rem',
          }}
        >
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              style={{
                width: '8px',
                background: '#c084fc',
                animation: 'bar 0.8s infinite ease-in-out',
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      )}

      <style jsx>{`
        @import url(
          'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap'
        );

        @keyframes bar {
          0%,
          100% {
            height: 8px;
          }
          50% {
            height: 28px;
          }
        }
      `}</style>
    </main>
  )
}
