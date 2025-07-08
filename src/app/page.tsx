'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

// Inline account menu component
function AccountMenu() {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
        aria-label="Account menu"
      >
        <Image src="/user-avatar.png" alt="Your avatar" width={36} height={36} style={{ borderRadius: '50%' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          right: 0,
          marginTop: 8,
          background: 'rgba(30,10,60,0.95)',
          borderRadius: 8,
          boxShadow: '0 4px 24px #0008',
          padding: '0.5em 0',
          zIndex: 50,
        }}>
          <a href="/profile" style={menuItem}>My Profile</a>
          <a href="/profile/overview" style={menuItem}>Overview</a>
          <a href="/profile/settings" style={menuItem}>Settings</a>
          <a href="/profile/billing" style={menuItem}>Billing & Plan</a>
          <button onClick={() => {}} style={menuItem}>Sign Out</button>
        </div>
      )}
    </div>
  )
}

const menuItem: React.CSSProperties = {
  display: 'block',
  padding: '0.6em 1.2em',
  color: '#e0d4f7',
  textDecoration: 'none',
  fontSize: '0.95rem',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  background: 'transparent',
  border: 'none',
  textAlign: 'left',
  width: '100%',
}

export default function HomePage() {
  // Chat state
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)

  // Recording / playback state
  const [listening, setListening] = useState(false)
  const [playing, setPlaying] = useState(false)

  // Client-only flags
  const [isClient, setIsClient] = useState(false)
  const [hasSpeechRecognition, setHasSpeechRecognition] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)

  // Refs
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioUrlRef = useRef<string | null>(null)

  useEffect(() => {
    setIsClient(true)
    setHasSpeechRecognition(
      !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    )
  }, [])

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

  const askQuestion = async (text: string) => {
    if (!text.trim()) return
    setLoading(true)
    setAnswer('')
    const newHistory: ChatMessage[] = [
      ...messages,
      { role: 'user', content: text }
    ]
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

      // Only allow user/assistant messages (fix for build error)
      const safeHistory: ChatMessage[] = [
        ...newHistory,
        { role: 'assistant', content: aiAnswer }
      ].filter(
        (m): m is ChatMessage =>
          m.role === 'user' || m.role === 'assistant'
      )
      setMessages(safeHistory)

      if (data.answer) {
        try {
          const vr = await fetch('/api/voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: aiAnswer })
          })
          if (!vr.ok) {
            const errText = await vr.text()
            setVoiceError(vr.status === 401 && errText.includes('quota_exceeded')
              ? 'Voice service quota exceeded. Please upgrade your plan.'
              : 'Voice service error. Falling back to browser TTS.')
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
            const utter = new SpeechSynthesisUtterance(answer)
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    askQuestion(question)
    setQuestion('')
  }

  const startWebSpeech = () => {
    const Rec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Rec) return alert('Not supported')
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
      mr.ondataavailable = (e: BlobEvent) => { if (e.data.size) chunks.push(e.data) }
      mr.onstop = async () => {
        setListening(false)
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunks, { type: 'audio/webm' })
        if (!blob.size) return
        const form = new FormData()
        form.append('audio', blob)
        const r = await fetch('/api/transcribe',{method:'POST',body:form})
        const { transcript, error } = await r.json()
        if (!error) askQuestion(transcript)
      }
      mr.start()
      setTimeout(()=>mr.state!=='inactive'&&mr.stop(),10000)
    } catch {
      setListening(false)
      alert('Mic error')
    }
  }

  const stopAllRecording = () => {
    setListening(false)
    recognitionRef.current?.stop()
    if (mediaRecorderRef.current?.state==='recording') {
      mediaRecorderRef.current.stop()
    }
  }

  const handleMicClick = () => {
    listening ? stopAllRecording() : (hasSpeechRecognition ? startWebSpeech() : startRecording())
  }

  const handleReplay = async () => {
    if (!answer) return
    setPlaying(true)
    try {
      const vr = await fetch('/api/voice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:answer})})
      const blob = await vr.blob()
      playAudioBlob(blob)
    } catch {
      setPlaying(false)
    }
  }

  return (
    <>
      <main className="page-container" style={{ position:'relative' }}>
        <header style={{position:'absolute',top:16,right:24,zIndex:20}}><AccountMenu/></header>
        <div className="logo-wrap"><Image src="/echostone_logo.png" alt="EchoStone Logo" width={140} height={140}/></div>
        <h1 className="site-title">Speak with Jonathan</h1>
        <div style={{ height: 50 }} /> {/* <-- 50px vertical space added */}

        <form className="ask-form" onSubmit={handleSubmit}>
          <input type="text" placeholder="Ask me anything…" value={question}
            onChange={e=>setQuestion(e.target.value)}/>
          <button type="submit" disabled={loading}>{loading?'…Thinking':'Ask'}</button>
        </form>

        <button className={listening?'mic-btn active':'mic-btn'} onClick={handleMicClick} type="button">
          {listening?'🎤 Listening… (tap to stop)':'🎤 Speak'}
        </button>

        {isClient && (
          <div style={{fontSize:13,opacity:0.7,margin:'0.5em 0'}}>
            {hasSpeechRecognition
              ? 'Speech recognition supported on this device.'
              : 'On this device, your voice will be transcribed after recording.'}
          </div>
        )}

        {answer && (
          <div className="answer">
            <h2>Jonathan says:</h2>
            <p>{answer}</p>
            {!playing && <button onClick={handleReplay} style={{marginTop:8}}>🔊 Play Again</button>}
          </div>
        )}

        {playing && (
          <div className="sound-bars">
            {Array.from({length:5}).map((_,i)=><div key={i} style={{animationDelay:`${i*0.1}s`}}/>)}
          </div>
        )}

        {voiceError && <div style={{color:'#ff6b6b',fontSize:14,marginTop:8}}>{voiceError}</div>}
      </main>
      <style jsx>{`
        .sound-bars{display:flex;align-items:flex-end;height:24px;margin-top:12px}
        .sound-bars div{flex:1;margin:0 2px;background:#6a00ff;height:50%;animation:sound 0.8s infinite ease-in-out}
        .sound-bars div:nth-child(odd){animation-duration:0.7s}
        .sound-bars div:nth-child(even){animation-duration:0.9s}
        @keyframes sound{0%,100%{transform:scaleY(0.5)}50%{transform:scaleY(1)}}
      `}</style>
    </>
  )
}