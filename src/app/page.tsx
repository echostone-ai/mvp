'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { supabase } from '@/components/supabaseClient'
import jonathanProfile from '@/data/jonathan_profile.json'

// Expressive helpers (inline for homepage)
function pickExpressiveStyle(userMessage: string) {
  const triggers = jonathanProfile.expressionTriggers
  if (triggers.nervous.some((t: string) => userMessage.toLowerCase().includes(t))) return 'nervous'
  if (triggers.sad.some((t: string) => userMessage.toLowerCase().includes(t))) return 'sad'
  if (triggers.nostalgic.some((t: string) => userMessage.toLowerCase().includes(t))) return 'nostalgic'
  const moods = ['default', 'excited', 'reflective']
  return moods[Math.floor(Math.random() * moods.length)]
}

function buildSystemPrompt(style: string) {
  const expressiveStyle = jonathanProfile.expressiveStyles[style]
  return `
You are Jonathan. Respond in your own voice using the following style:
${expressiveStyle.description}
${expressiveStyle.sample ? 'For example: ' + expressiveStyle.sample : ''}
Here are some of your catchphrases: ${jonathanProfile.catchphrases.join(', ')}.
Here are some of your quirks: ${jonathanProfile.quirks.join('; ')}.
Do NOT say which style you’re using—just let it show in your words.
  `.trim()
}

function maybeAddCatchphrase(text: string) {
  if (Math.random() < 0.3) {
    const cp = jonathanProfile.catchphrases[
      Math.floor(Math.random() * jonathanProfile.catchphrases.length)
    ]
    return text.endsWith('.') ? text + ' ' + cp : text + '. ' + cp
  }
  return text
}

type ChatMessage = { role: 'user' | 'assistant'; content: string }

const DEFAULT_VOICE_ID = 'CO6pxVrMZfyL61ZIglyr' // replace with your actual default voice ID

export default function HomePage() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)

  const [listening, setListening] = useState(false)
  const [playing, setPlaying] = useState(false)

  const [isClient, setIsClient] = useState(false)
  const [hasSpeechRecognition, setHasSpeechRecognition] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)

  const [profileData, setProfileData] = useState<any>(null)
  const [voiceId, setVoiceId] = useState<string | null>(DEFAULT_VOICE_ID)

  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioUrlRef = useRef<string | null>(null)

  // For typing effect
  const typingIntervalRef = useRef<any>(null)
  const fullAnswerRef = useRef('')

  useEffect(() => {
    setIsClient(true)
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    if (isSafari) {
      setHasSpeechRecognition(false)
    } else {
      setHasSpeechRecognition(
        !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
      )
    }
  }, [])

  useEffect(() => {
    async function loadProfile() {
      try {
        // Load default profile first
        const defaultProfile = await fetch('/jonathan_profile.json').then(res => res.json())
        setProfileData(defaultProfile)
        setVoiceId(DEFAULT_VOICE_ID)
      } catch (e) {
        console.error('Failed to load default profile:', e)
        setProfileData(null)
        setVoiceId(DEFAULT_VOICE_ID)
      }

      // Then check if user is logged in, but do NOT override voice/profile here to keep homepage default Jonathan
      // So we skip user data here to preserve default personality and voice on homepage
    }
    loadProfile()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const intros = ['/hey.mp3', '/howdy.mp3', '/hello.mp3']
    const pick = intros[Math.floor(Math.random() * intros.length)]
    const audio = new Audio(pick)
    audio.play().catch(() => {})
  }, [])

  function buildProfileContext() {
    if (!profileData) return ''
    return Object.entries(profileData)
      .map(([section, answers]: [string, any]) => {
        return `${section}:\n` + Object.entries(answers)
          .map(([key, value]) => `- ${key}: ${value}`)
          .join('\n')
      })
      .join('\n\n')
  }

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

  const startTypingEffect = (text: string) => {
    clearInterval(typingIntervalRef.current)
    fullAnswerRef.current = text
    let idx = 0
    setAnswer('')
    typingIntervalRef.current = setInterval(() => {
      if (idx >= fullAnswerRef.current.length) {
        clearInterval(typingIntervalRef.current)
        return
      }
      console.log('typing idx:', idx, 'char:', fullAnswerRef.current.charAt(idx))
      setAnswer((a) => a + fullAnswerRef.current.charAt(idx))
      idx++
    }, 30)
  }

  const askQuestion = async (text: string) => {
    if (!text.trim()) return
    setLoading(true)
    const newHistory: ChatMessage[] = [...messages, { role: 'user', content: text }]
    const style = pickExpressiveStyle(text)
    const systemPrompt = buildSystemPrompt(style)
    setMessages(newHistory)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          systemPrompt, // pass down expressive context
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to fetch from chat API')
      }

      const data = await res.json()
      const aiAnswer = maybeAddCatchphrase((data.answer || '😕 No answer.').replace(/^[\s\u200B]+/, ''))
      console.log('aiAnswer (JSON):', JSON.stringify(aiAnswer))

      startTypingEffect(aiAnswer)

      const updatedMessages: ChatMessage[] = [...newHistory, { role: 'assistant', content: aiAnswer }]
      setMessages(updatedMessages)

      if (voiceId) {
        const voiceRes = await fetch('/api/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: aiAnswer, voiceId }),
        })
        if (voiceRes.ok) {
          const blob = await voiceRes.blob()
          if (blob.size > 0) playAudioBlob(blob)
          setVoiceError(null)
        } else {
          const errText = await voiceRes.text()
          setVoiceError(
            voiceRes.status === 401 && errText.includes('quota_exceeded')
              ? 'Voice service quota exceeded. Please upgrade your plan.'
              : 'Voice service error. Falling back to browser TTS.'
          )
          if ('speechSynthesis' in window) {
            const utter = new SpeechSynthesisUtterance(aiAnswer)
            window.speechSynthesis.speak(utter)
          }
        }
      } else {
        if ('speechSynthesis' in window) {
          const utter = new SpeechSynthesisUtterance(aiAnswer)
          window.speechSynthesis.speak(utter)
        }
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
  }

  // Mic and speech recognition handlers (re-enable your previous logic here)

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
        background: 'linear-gradient(120deg, #232946 0%, #413076 50%, #af7ea8 100%)',
        backgroundAttachment: 'fixed',
        backgroundSize: 'cover',
        fontFamily: 'Poppins, sans-serif',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 24, userSelect: 'none' }}>
        <img
          src="/echostone_logo.png"
          alt="EchoStone Logo"
          width={200}
          height={200}
          className="logo-pulse"
          draggable={false}
          style={{ userSelect: 'none' }}
        />
      </div>

      <h1 style={{ textAlign: 'center', margin: '12px 0 32px' }}>
        Speak with EchoStone
      </h1>

      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 600 }}
      >
        <input
          type="text"
          placeholder="Ask me anything…"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          style={{ flex: 1, padding: '1em', borderRadius: 14, border: 'none', fontSize: '1.1em' }}
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0 1.8em',
            borderRadius: 14,
            border: 'none',
            background: 'linear-gradient(90deg, #6a00ff 65%, #9147ff 100%)',
            color: '#fff',
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            fontSize: '1.1em',
          }}
        >
          {loading ? '…Thinking' : 'Ask'}
        </button>
      </form>

      {/* Microphone button */}
      {isClient && (
        <button
          className={listening ? 'mic-btn active' : 'mic-btn'}
          onClick={handleMicClick}
          type="button"
          style={{ marginTop: 24 }}
        >
          {listening ? '🎤 Listening… (tap to stop)' : '🎤 Speak'}
        </button>
      )}

      {answer && (
        <div className="answer" style={{ userSelect: 'text', maxWidth: 600, marginTop: 36 }}>
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
    </main>
  )
}