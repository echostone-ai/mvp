/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React from 'react'
import { useState, useRef, useEffect } from 'react'

export default function Page() {
  const [question, setQuestion] = useState<string>('')
  const [answer, setAnswer] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [listening, setListening] = useState<boolean>(false)
  const [playing, setPlaying] = useState<boolean>(false)
  const recognitionRef = useRef<any>(null)

  // handle question submission
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!question.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ question }),
      })
      const data = await res.json()
      setAnswer(data.answer)
      // text-to-speech
      const vr = await fetch('/api/voice', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ text: data.answer }),
      })
      const blob = await vr.blob()
      const audio = new Audio(URL.createObjectURL(blob))
      setPlaying(true)
      audio.onended = () => setPlaying(false)
      await audio.play()
    } catch {
      setAnswer('Sorry, something went wrong.')
      setPlaying(false)
    }
    setLoading(false)
  }

  // toggle speech recognition
  const startListening = () => {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop()
      return
    }
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRec()
    recognitionRef.current = recognition
    recognition.lang = 'en-US'
    recognition.onstart = () => setListening(true)
    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }
    recognition.onresult = (evt: any) => {
      setQuestion(evt.results[0][0].transcript)
      handleSubmit()
    }
    recognition.start()
  }

  // particles while listening
  useEffect(() => {
    if (!listening) return
    const dots: HTMLDivElement[] = []
    const interval = setInterval(() => {
      const dot = document.createElement('div')
      dot.style.cssText = `
        position:absolute;
        bottom:10%; left:50%;
        width:8px; height:8px;
        background:rgba(255,255,255,0.6);
        border-radius:50%;
        animation: floatUp 2s ease-out forwards;
      `
      document.body.appendChild(dot)
      dots.push(dot)
      if (dots.length > 20) {
        const old = dots.shift()
        if (old) document.body.removeChild(old)
      }
    }, 150)
    return () => {
      clearInterval(interval)
      dots.forEach(d => document.body.removeChild(d))
    }
  }, [listening])

  return (
    <main style={{
      position: 'relative',
      overflow: 'hidden',
      minHeight: '100vh',
      background: 'radial-gradient(circle at center, #8b5cf6 0%, #4c1d95 40%, #000 100%)',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      textAlign: 'center',
      fontFamily: 'Poppins, sans-serif',
    }}>
      {/* overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(120deg, rgba(123,31,162,0.3), rgba(55,0,179,0.3), rgba(30,27,41,0.3))',
        backgroundSize: '300% 300%',
        animation: 'shift 20s ease infinite',
        pointerEvents: 'none',
      }}/>
      {/* grain */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'url(/grain.svg)',
        opacity: 0.05,
        pointerEvents: 'none',
      }}/>
      {/* logo */}
      <div style={{ marginBottom: '1rem', zIndex: 1 }}>
        <img src="/echostone_logo.png" alt="EchoStone Logo" style={{ width: '120px', height: 'auto', display: 'block' }}/>
      </div>
      {/* title */}
      <h1 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '2.5rem', margin: 0, zIndex: 1 }}>
        EchoStone — Ask Jonathan
      </h1>
      {/* form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', width: '100%', maxWidth: '600px', zIndex: 1 }}>
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Ask anything…"
          style={{ flex: 1, padding: '0.75rem', borderRadius: '6px', border: 'none', fontSize: '1rem', outline: 'none' }}
        />
        <button type="submit" style={{ padding: '0.75rem 1.25rem', background: '#9333ea', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '1rem', zIndex: 1 }}>
          {loading ? '…Thinking' : 'Ask'}
        </button>
      </form>
      {/* mic */}
      <button onClick={startListening} style={{ marginTop: '1.5rem', padding: '0.75rem 1.5rem', background: listening ? '#dc2626' : '#444', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '1rem', transform: listening ? 'scale(1.05)' : 'none', boxShadow: listening ? '0 0 0 6px rgba(220,38,38,0.5)' : 'none', transition: 'all 0.2s ease', zIndex: 1 }}>
        {listening ? '🎤 Listening…' : '🎤 Speak'}
      </button>
      {/* answer */}
      {answer && (
        <div style={{ marginTop: '2rem', maxWidth: '600px', zIndex: 1 }}>
          <h2 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1.75rem', marginBottom: '0.5rem' }}>Jonathan says:</h2>
          <p style={{ fontSize: '1.125rem', lineHeight: 1.6, color: '#e0d7f5' }}>{answer}</p>
        </div>
      )}
      {/* sound bars */}
      {playing && (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: '32px', marginTop: '1rem', zIndex: 1 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ width: '8px', background: '#c084fc', animation: 'bar 0.8s infinite ease-in-out', animationDelay: `${i * 0.1}s` }}/>
          ))}
        </div>
      )}
      {/* keyframes */}
      <style jsx>{`
        @keyframes shift {0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        @keyframes bar {0%,100%{height:8px}50%{height:28px}}
        @keyframes floatUp {to{transform:translateY(-80px) scale(0.5);opacity:0}}
      `}</style>
    </main>
  )
}
