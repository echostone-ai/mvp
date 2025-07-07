'use client'

import Image from 'next/image'
import { useState, useRef } from 'react'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export default function HomePage() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [playing, setPlaying] = useState(false)
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<any>(null)
  const audioUrlRef = useRef<string | null>(null)

  const hasSpeechRecognition =
    typeof window !== 'undefined' &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

  const playAudioBlob = (blob: Blob) => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
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
    audio.play().catch(() => setPlaying(false))
  }

  const askQuestion = async (text: string) => {
    if (!text.trim()) return
    setLoading(true)
    setAnswer('')
    const newHistory = [...messages, { role: 'user', content: text } as ChatMessage]
    setMessages(newHistory)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, history: newHistory })
      })
      const data = await res.json()
      const aiAnswer = data.answer || '😕 No answer.'
      setAnswer(aiAnswer)
      setMessages([...newHistory, { role: 'assistant', content: aiAnswer } as ChatMessage])

      if (data.answer) {
        const vr = await fetch('/api/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: data.answer })
        })
        const blob = await vr.blob()
        playAudioBlob(blob)
      }
    } catch (err: any) {
      setAnswer('Error: ' + (err.message || err))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    askQuestion(question)
    setQuestion('')
  }

  const startWebSpeech = () => {
    const Rec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Rec) return alert('SpeechRecognition not supported')
    const recognition = new Rec()
    recognitionRef.current = recognition
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onstart = () => setListening(true)
    recognition.onresult = (ev: any) => {
      let transcript = ''
      for (let i = ev.resultIndex; i < ev.results.length; ++i) {
        transcript += ev.results[i][0].transcript
      }
      setQuestion(transcript)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => {
      if (listening) recognition.start()
    }
    recognition.start()
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      setListening(true)

      mediaRecorder.ondataavailable = async (e: any) => {
        if (e.data.size > 0) {
          const formData = new FormData()
          formData.append('audio', e.data, 'audio.webm')
          const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
          const { transcript, error } = await res.json()
          if (!error) {
            setQuestion(transcript)
            askQuestion(transcript)
          }
        }
      }

      mediaRecorder.onstop = () => {
        if (listening) {
          console.log("Restarting recorder with longer iOS-friendly cycle...")
          startRecording()
        }
      }

      mediaRecorder.start(5000) // bigger chunk for iOS stability
      setTimeout(() => {
        if (mediaRecorder.state !== 'inactive') mediaRecorder.stop()
      }, 12000) // longer forced stop to restart

    } catch (err: any) {
      console.error('Mic error:', err)
      setListening(false)
      alert('Mic error: ' + err.message)
    }
  }

  const stopAllRecording = () => {
    setListening(false)
    recognitionRef.current?.stop()
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach((track: any) => track.stop())
    }
  }

  const handleMicClick = () => {
    if (listening) {
      stopAllRecording()
    } else {
      hasSpeechRecognition ? startWebSpeech() : startRecording()
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