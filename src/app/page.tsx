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
  const mediaRecorderRef = useRef<any>(null)
  const audioChunksRef = useRef<any[]>([])
  const timeoutRef = useRef<any>(null)
  const audioUrlRef = useRef<string | null>(null)

  // Check if Web Speech API is available
  const hasSpeechRecognition = typeof window !== 'undefined' &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

  const playAudioBlob = (blob: Blob) => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    const url = URL.createObjectURL(blob)
    audioUrlRef.current = url
    const audio = new Audio(url)
    setPlaying(true)
    audio.onended = () => {
      setPlaying(false)
      URL.revokeObjectURL(url)
      audioUrlRef.current = null
    }
    // iOS Safari: play() must be called soon after user gesture
    setTimeout(() => {
      audio.play().catch(() => setPlaying(false))
    }, 0)
  }

  const askQuestion = async (text: string) => {
    if (!text.trim()) return
    setLoading(true)
    setAnswer('')
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
      try {
        const vr = await fetch('/api/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: data.answer })
        })
        const blob = await vr.blob()
        playAudioBlob(blob)
      } catch {
        setPlaying(false)
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    askQuestion(question)
  }

  // Web Speech API (desktop/Android/Chrome)
  const startWebSpeech = () => {
    const Rec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Rec) return alert('SpeechRecognition not supported')
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

  // Audio recording for iOS/unsupported browsers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      const mediaRecorder = new (window as any).MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      setListening(true)
      mediaRecorder.ondataavailable = (e: any) => {
        audioChunksRef.current.push(e.data)
      }
      mediaRecorder.onstop = async () => {
        setListening(false)
        stream.getTracks().forEach((track: any) => track.stop())
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        if (audioBlob.size === 0) return alert('No audio captured.')
        const formData = new FormData()
        formData.append('audio', audioBlob)
        const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
        const { transcript, error } = await res.json()
        if (error) {
          alert('Transcription failed: ' + error)
        } else {
          setQuestion(transcript)
          askQuestion(transcript)
        }
      }
      mediaRecorder.start()
      // Allow up to 10 seconds, user can tap mic to end sooner
      timeoutRef.current = setTimeout(() => {
        if (mediaRecorder.state !== 'inactive') mediaRecorder.stop()
      }, 10000)
    } catch (err: any) {
      setListening(false)
      alert('Mic error: ' + err.message)
    }
  }

  const handleMicClick = () => {
    if (listening) {
      // Stop both recognition or recording if active
      if (recognitionRef.current) recognitionRef.current.stop()
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === 'recording'
      ) {
        mediaRecorderRef.current.stop()
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
      }
      setListening(false)
      return
    }
    if (hasSpeechRecognition) {
      startWebSpeech()
    } else {
      startRecording()
    }
  }

  const handleReplay = async () => {
    if (!answer) return
    setPlaying(true)
    try {
      const vr = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: answer })
      })
      const blob = await vr.blob()
      playAudioBlob(blob)
    } catch {
      setPlaying(false)
    }
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

      <h1 className="site-title">Speak with Jonathan</h1>
      <br />

      <form className="ask-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Ask me anything…"
          value={question}
          onChange={e => setQuestion(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? '…Thinking' : 'Ask'}
        </button>
      </form>

      <button
        className={listening ? 'mic-btn active' : 'mic-btn'}
        onClick={handleMicClick}
        type="button"
      >
        {listening ? '🎤 Listening… (tap to stop)' : '🎤 Speak'}
      </button>
      <div style={{ fontSize: 13, opacity: 0.7, margin: '0.5em 0' }}>
        {hasSpeechRecognition
          ? 'Speech recognition supported on this device.'
          : 'On this device, your voice will be transcribed after recording.'}
      </div>

      {answer && (
        <div className="answer">
          <h2>Jonathan says:</h2>
          <p>{answer}</p>
          {!playing && (
            <button onClick={handleReplay} style={{ marginTop: 8 }}>
              🔊 Play Again
            </button>
          )}
        </div>
      )}

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
