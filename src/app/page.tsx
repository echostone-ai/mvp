'use client'

import Image from 'next/image'
import { useState, useRef } from 'react'

export default function HomePage() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [playing, setPlaying] = useState(false)
  const recognitionRef = useRef<any>(null)

  // iOS check for Web Speech API support
  const isIOS = () => {
    if (typeof navigator === 'undefined') return false
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.userAgent.includes('Macintosh') && 'ontouchend' in document)
    )
  }

  const askQuestion = async (text: string) => {
    if (!text.trim()) return
    setLoading(true)
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: text })
    })
    const data = await res.json()
    setAnswer(data.answer || '😕 No answer.')
    setLoading(false)

    // voice playback
    if (data.answer) {
      const vr = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: data.answer })
      })
      const blob = await vr.blob()
      const audio = new Audio(URL.createObjectURL(blob))
      setPlaying(true)
      audio.onended = () => setPlaying(false)
      audio.play()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    askQuestion(question)
  }

  const startListening = () => {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop()
      return
    }
    const Rec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Rec) return alert('Speech-to-text not supported on this browser.')
    const recognition = new Rec()
    recognitionRef.current = recognition
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.onstart = () => setListening(true)
    recognition.onresult = (ev: any) => {
      const transcript = ev.results[0][0].transcript.trim()
      setQuestion(transcript)
      recognition.stop()
      setListening(false)
      askQuestion(transcript)
    }
    recognition.onend = () => setListening(false)
    recognition.start()
  }

  return (
    <main className="page-container">
      {/* Logo */}
      <div className="logo-wrap">
        <Image
          src="/echostone_logo.png"
          alt="EchoStone Logo"
          width={140}
          height={140}
        />
      </div>

      {/* Title & intro */}
      <h1 className="site-title">Speak with Jonathan</h1>
      <br />

      {/* Ask form */}
      <form className="ask-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Ask me anything…"
          value={question}
          onChange={e => setQuestion(e.target.value)}
        />
        <button type="submit">
          {loading ? '…Thinking' : 'Ask'}
        </button>
      </form>

      {/* Mic Button: Disabled on iOS */}
      {isIOS() ? (
        <button className="mic-btn" disabled style={{ opacity: 0.6 }}>
          🎤 Speak (not supported on iOS)
        </button>
      ) : (
        <button
          className={listening ? 'mic-btn active' : 'mic-btn'}
          onClick={startListening}
        >
          {listening ? '🎤 Listening…' : '🎤 Speak'}
        </button>
      )}

      {/* Answer */}
      {answer && (
        <div className="answer">
          <h2>Jonathan says:</h2>
          <p>{answer}</p>
        </div>
      )}

      {/* Sound bars */}
      {playing && (
        <div className="sound-bars">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      )}
    </main>
  )
}
