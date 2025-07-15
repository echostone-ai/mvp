'use client'


import React, { useState, useRef, useEffect } from 'react'

function getFirstName(profileData: any): string {
  if (profileData?.personal_snapshot?.full_legal_name)
    return profileData.personal_snapshot.full_legal_name.split(' ')[0];
  if (profileData?.full_legal_name)
    return profileData.full_legal_name.split(' ')[0];
  if (profileData?.name)
    return profileData.name.split(' ')[0];
  return 'Friend';
}

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
    <main className="min-h-screen flex flex-col items-center justify-start w-screen bg-transparent pt-8 box-border">
      <div className="text-center mb-6 select-none">
        <img
          src="/echostone_logo.png"
          alt="EchoStone Logo"
          width={140}
          height={140}
          className="logo-pulse select-none"
          draggable={false}
        />
      </div>
      <h1 className="text-center my-3 mb-8 text-4xl font-bold">
        Speak with {getFirstName(profileData)}
      </h1>

      <form className="ask-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Ask me anything…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        <button type="submit" disabled={loading}>
          {loading ? '…Thinking' : 'Ask'}
        </button>
      </form>

      <button
        className={`mic-btn${listening ? ' active' : ''}`}
        onClick={handleMicClick}
        type="button"
      >
        {listening ? '🎤 Listening… (tap to stop)' : '🎤 Speak'}
      </button>

      {isClient && (
        <div className="text-xs opacity-70 my-2 text-center select-none">
          {hasSpeechRecognition
            ? 'Speech recognition supported on this device.'
            : 'On this device, your voice will be transcribed after recording.'}
        </div>
      )}

      {answer && (
        <div className="answer">
          <h2>{getFirstName(profileData)} says:</h2>
          <p>{answer}</p>
          {!playing && (
            <button onClick={handleReplay} className="play-btn">
              🔊 Play Again
            </button>
          )}
        </div>
      )}

      {playing && (
        <div className="soundbars">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="soundbar" />
          ))}
        </div>
      )}

      {voiceError && (
        <div className="text-red-400 text-sm mt-2">
          {voiceError}
        </div>
      )}
    </main>
  )
}