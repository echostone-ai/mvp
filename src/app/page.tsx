'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

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
    // Detect Safari: if so, force hasSpeechRecognition to false
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
    if (typeof window === 'undefined') return;
    const intros = ['/hey.mp3', '/howdy.mp3', '/hello.mp3'];
    const pick = intros[Math.floor(Math.random() * intros.length)];
    const audio = new Audio(pick);
    audio.play().catch(() => {});
  }, []);

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
    // Do not clear question, keep it in the input
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
      setQuestion(transcript)
      askQuestion(transcript)
    }
    recog.onend = () => {
      setListening(false)
    }
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
        if (!error && transcript) {
          setQuestion(transcript)
          askQuestion(transcript)
        }
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
      <div className="logo-wrap" style={{ textAlign: 'center', marginBottom: 24 }}>
        <Image src="/echostone_logo.png" alt="EchoStone Logo" width={210} height={210} className="logo-pulse" />
      </div>
      <h1 className="site-title" style={{ textAlign: 'center', margin: '12px 0 32px', fontWeight: 700, fontSize: '2.5em', letterSpacing: '0.01em' }}>Speak with Jonathan</h1>

      <form className="ask-form" onSubmit={handleSubmit}>
        <input type="text" placeholder="Ask me anything…" value={question}
          onChange={e=>setQuestion(e.target.value)}/>
        <button type="submit" disabled={loading}>{loading?'…Thinking':'Ask'}</button>
      </form>

      <button className={listening?'mic-btn active':'mic-btn'} onClick={handleMicClick} type="button">
        {listening?'🎤 Listening… (tap to stop)':'🎤 Speak'}
      </button>

      {isClient && (
        <div style={{fontSize:15,opacity:0.7,margin:'1em 0 0.4em 0', textAlign: 'center'}}>
          {hasSpeechRecognition
            ? 'Speech recognition supported on this device.'
            : 'On this device, your voice will be transcribed after recording.'}
        </div>
      )}

      {answer && (
        <div className="answer">
          <h2>Jonathan says:</h2>
          <p>{answer}</p>
          {!playing && <button onClick={handleReplay} style={{
            marginTop: 16,
            background: '#221942',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '0.7em 1.4em',
            fontWeight: 700,
            fontSize: '1em',
            boxShadow: '0 2px 10px #6a00ff12',
            cursor: 'pointer'
          }}>🔊 Play Again</button>}
        </div>
      )}

        {playing && (
        <div className="sound-bars">
          {Array.from({length: 5}).map((_, i) => (
            <div key={i} style={{animationDelay: `${i * 0.1}s`}} />
          ))}
        </div>
      )}

      {voiceError && <div style={{color:'#ff6b6b',fontSize:14,marginTop:8}}>{voiceError}</div>}

      <style jsx>{`
        .logo-pulse {
          animation: logo-beat 1.8s cubic-bezier(0.55, 0, 0.55, 0.2) infinite;
          transform-origin: center;
        }
        @keyframes logo-beat {
          0%   { transform: scale(1);   filter: drop-shadow(0 0 10px #6a00ff77);}
          20%  { transform: scale(1.1); filter: drop-shadow(0 0 26px #6a00ff);}
          50%  { transform: scale(1.05);filter: drop-shadow(0 0 18px #6a00ff);}
          80%  { transform: scale(1.1); filter: drop-shadow(0 0 26px #6a00ff);}
          100% { transform: scale(1);   filter: drop-shadow(0 0 10px #6a00ff77);}
        }
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
        .sound-bars div:nth-child(odd) { animation-duration: 0.7s }
        .sound-bars div:nth-child(even) { animation-duration: 0.9s }
        @keyframes sound {
          0%,100%{ transform:scaleY(0.5);}
          50%{ transform:scaleY(1);}
        }
      `}</style>
    </main>
  )
}