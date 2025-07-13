'use client'

import React, { useState, useRef, useEffect } from 'react'

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

interface ChatInterfaceProps {
  profileData: any // user profile JSON
  voiceId: string | null
  initialMessages?: ChatMessage[]
  onAsk?: (question: string) => void
}

export default function ChatInterface({
  profileData,
  voiceId,
  initialMessages = [],
  onAsk,
}: ChatInterfaceProps) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [hasSpeechRecognition, setHasSpeechRecognition] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)

  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioUrlRef = useRef<string | null>(null)

  useEffect(() => {
    setIsClient(true)
    setHasSpeechRecognition(
      !!(
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition
      )
    )
  }, [])

  // Play audio blob helper
  const playAudioBlob = (blob: Blob) => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
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

  // Compose profile context string for prompt
  const buildProfileContext = () => {
    if (!profileData) return ''
    return Object.entries(profileData)
      .map(([section, answers]: [string, any]) => {
        return `${section}:\n` + Object.entries(answers)
          .map(([key, value]) => `- ${key}: ${value}`)
          .join('\n')
      })
      .join('\n\n')
  }

  // Ask question logic
  const askQuestion = async (text: string) => {
    if (!text.trim()) return
    setLoading(true)
    setAnswer('')

    const newHistory: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(newHistory)
    setQuestion('')

    if (onAsk) {
      onAsk(text)
      setLoading(false)
      return
    }

    try {
      const profileContext = buildProfileContext()
      const prompt = `You are speaking with a personality based on this profile data:\n${profileContext}\n\nConversation history:\n${newHistory.map(m => `${m.role}: ${m.content}`).join('\n')}\n\nUser: ${text}\nAssistant:`

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          profileData, // <-- make sure this line is included
          voiceId,
          history: newHistory,
          question: text,
        }),
      })

      const data = await res.json()
      const aiAnswer = data.answer || '😕 No answer.'
      setAnswer(aiAnswer)

      const safeHistory: ChatMessage[] = [
        ...newHistory,
        { role: 'assistant', content: aiAnswer },
      ].filter((m): m is ChatMessage => m.role === 'user' || m.role === 'assistant')
      setMessages(safeHistory)

      if (data.answer) {
        try {
          const vr = await fetch('/api/voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: aiAnswer, voiceId }),
          })
          if (!vr.ok) {
            const errText = await vr.text()
            setVoiceError(
              vr.status === 401 && errText.includes('quota_exceeded')
                ? 'Voice service quota exceeded. Please upgrade your plan.'
                : 'Voice service error. Falling back to browser TTS.'
            )
            if ('speechSynthesis' in window) {
              const utter = new SpeechSynthesisUtterance(aiAnswer)
              window.speechSynthesis.speak(utter)
            }
            return
          }
          setVoiceError(null)
          const blob = await vr.blob()
          if (blob.size > 0) playAudioBlob(blob)
        } catch {
          setVoiceError('Voice fetch failed; using browser TTS instead.')
          if ('speechSynthesis' in window) {
            const utter = new SpeechSynthesisUtterance(aiAnswer)
            window.speechSynthesis.speak(utter)
          }
        }
      }
    } catch (err: any) {
      setAnswer('Error: ' + (err.message || err))
    } finally {
      setLoading(false)
    }
  }

  // Form submit handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    askQuestion(question)
  }

  // Speech Recognition / Recording handlers
  const startWebSpeech = () => {
    const Rec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Rec) return alert('Speech recognition not supported')
    const recog = new Rec()
    recognitionRef.current = recog
    recog.continuous = false
    recog.interimResults = false
    recog.lang = 'en-US'
    recog.onstart = () => setListening(true)
    recog.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript.trim()
      recog.stop()
      setListening(false)
      setQuestion(transcript)
      askQuestion(transcript)
    }
    recog.onend = () => setListening(false)
    recog.start()
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      setListening(true)
      const chunks: Blob[] = []
      mr.ondataavailable = (e: BlobEvent) => {
        if (e.data.size) chunks.push(e.data)
      }
      mr.onstop = async () => {
        setListening(false)
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks, { type: 'audio/webm' })
        if (!blob.size) return
        const form = new FormData()
        form.append('audio', blob)
        const r = await fetch('/api/transcribe', { method: 'POST', body: form })
        const { transcript, error } = await r.json()
        if (!error) {
          setQuestion(transcript)
          askQuestion(transcript)
        }
      }
      mr.start()
      setTimeout(() => mr.state !== 'inactive' && mr.stop(), 10000)
    } catch {
      setListening(false)
      alert('Mic error')
    }
  }

  const stopAllRecording = () => {
    setListening(false)
    recognitionRef.current?.stop()
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  const handleMicClick = () => {
    listening
      ? stopAllRecording()
      : hasSpeechRecognition
      ? startWebSpeech()
      : startRecording()
  }

  const handleReplay = async () => {
    if (!answer) return
    setPlaying(true)
    try {
      const vr = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: answer, voiceId }),
      })
      const blob = await vr.blob()
      playAudioBlob(blob)
    } catch {
      setPlaying(false)
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: 0,
        margin: 0,
        background: 'none',
        boxShadow: 'none',
        position: 'relative',
      }}
    >
      <div
        className="logo-wrap"
        style={{ textAlign: 'center', marginBottom: 24, userSelect: 'none' }}
      >
        {/* Add a pulsing CSS class as needed */}
        <img
          src="/echostone_logo.png"
          alt="EchoStone Logo"
          width={140}
          height={140}
          className="logo-pulse"
          draggable={false}
          style={{ userSelect: 'none' }}
        />
      </div>
      <h1
  className="site-title"
  style={{ textAlign: 'center', margin: '12px 0 32px' }}
>
  Speak with {profileData?.personal_snapshot?.full_legal_name
    ? profileData.personal_snapshot.full_legal_name.split(' ')[0]
    : 'EchoStone'}
</h1>

      <form
        className="ask-form"
        onSubmit={handleSubmit}
        style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 600 }}
      >
        <input
          type="text"
          placeholder="Ask me anything…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          style={{ flex: 1 }}
          spellCheck={false}
          autoComplete="off"
        />
        <button type="submit" disabled={loading}>
          {loading ? '…Thinking' : 'Ask'}
        </button>
      </form>

      <button
        className={listening ? 'mic-btn active' : 'mic-btn'}
        onClick={handleMicClick}
        type="button"
        style={{ marginTop: 24 }}
      >
        {listening ? '🎤 Listening… (tap to stop)' : '🎤 Speak'}
      </button>

      {isClient && (
        <div
          style={{
            fontSize: 13,
            opacity: 0.7,
            margin: '0.5em 0',
            textAlign: 'center',
            userSelect: 'none',
          }}
        >
          {hasSpeechRecognition
            ? 'Speech recognition supported on this device.'
            : 'On this device, your voice will be transcribed after recording.'}
        </div>
      )}

      {answer && (
        <div className="answer" style={{ userSelect: 'text' }}>
          <h2>EchoStone says:</h2>
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

      {voiceError && (
        <div style={{ color: '#ff6b6b', fontSize: 14, marginTop: 8 }}>
          {voiceError}
        </div>
      )}

      <style jsx>{`
        .sound-bars {
          display: flex;
          align-items: flex-end;
          height: 24px;
          margin-top: 12px;
        }
        .sound-bars div {
          flex: 1;
          margin: 0 2px;
          background: #6a00ff;
          height: 50%;
          animation: sound 0.8s infinite ease-in-out;
        }
        .sound-bars div:nth-child(odd) {
          animation-duration: 0.7s;
        }
        .sound-bars div:nth-child(even) {
          animation-duration: 0.9s;
        }
        @keyframes sound {
          0%,
          100% {
            transform: scaleY(0.5);
          }
          50% {
            transform: scaleY(1);
          }
        }
      `}</style>
    </main>
  )
}