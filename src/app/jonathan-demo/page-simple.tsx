'use client'

import jonathanProfile from '@/data/jonathan_profile.json'
import ProfileProvider from '@/components/ProfileContext'
import PageShell from '@/components/PageShell'
import { useState, useRef, useEffect, useMemo } from 'react'
import { globalAudioManager } from '@/lib/globalAudioManager'
import { stopAllAudio } from '@/lib/streamingUtils'
import { getHomepageDemoSettings } from '@/lib/naturalVoiceSettings'

const AVATAR_SLUG = 'jonathan-demo'

export default function JonathanDemoPage() {
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
  const audioRef = useRef<HTMLAudioElement>(null)
  const resolvedVoiceRef = useRef<string | null>(null)

  // Client/hydration guards and speech recognition support
  const [isClient, setIsClient] = useState(false)
  const [hasSpeechRecognition, setHasSpeechRecognition] = useState(false)

  // Resolve Jonathan's actual voice_id from server
  const resolveVoiceId = async (): Promise<string> => {
    if (resolvedVoiceRef.current) return resolvedVoiceRef.current
    try {
      const res = await fetch(`/api/voice/resolve?avatar=${encodeURIComponent(AVATAR_SLUG)}`)
      if (res.ok) {
        const { voiceId } = await res.json()
        if (voiceId) {
          resolvedVoiceRef.current = voiceId
          return voiceId
        }
      }
    } catch (_) {}
    const fallback = (process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID as string) || 'CO6pxVrMZfyL61ZIglyr'
    resolvedVoiceRef.current = fallback
    return fallback
  }

  // Quick Questions
  const allQuick = useMemo(() => ([
    { text: "Tell me something funny about Romeo", emoji: "😂" },
    { text: "What's the funniest thing Romeo has done?", emoji: "🐕" },
    { text: "Tell me about your partner Krissy", emoji: "💕" },
    { text: "What's your dog Romeo like?", emoji: "🐕" },
    { text: "How do you like living in Sofia?", emoji: "🏙️" },
    { text: "What was Austin like?", emoji: "🤠" },
    { text: "Tell me about your writing", emoji: "✍️" },
    { text: "What do you think about AI?", emoji: "🤖" },
    { text: "Tell me about your travels", emoji: "✈️" },
    { text: "What's your favorite memory?", emoji: "🌟" },
    { text: "How did you meet Krissy?", emoji: "💫" },
    { text: "What's life like in Bulgaria?", emoji: "🇧🇬" },
    { text: "Tell me about your family", emoji: "👨‍👩‍👧‍👦" },
    { text: "What advice would you give?", emoji: "💡" }
  ]), [])
  const [quickQuestions, setQuickQuestions] = useState(() => allQuick.slice(0, 6))

  useEffect(() => {
    setIsClient(true)
    const supported = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    setHasSpeechRecognition(supported)

    setQuickQuestions(prev => {
      const arr = [...allQuick]
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
      return arr.slice(0, 6)
    })

    const playInitialAudio = async () => {
      if (!audioRef.current) return
      const audioFiles = ['/howdy.mp3', '/hey.mp3', '/hello.mp3']
      const randomIndex = Math.floor(Math.random() * audioFiles.length)
      audioRef.current.src = audioFiles[randomIndex]
      try {
        await globalAudioManager.playAudio(audioRef.current)
      } catch (e) {
        console.log('Initial audio play failed:', e)
      }
    }
    playInitialAudio()
    
    return () => {
      stopAllAudio()
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    }
  }, [])

  const playAudioBlob = async (blob: Blob) => {
    await stopAllAudio()
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    const url = URL.createObjectURL(blob)
    audioUrlRef.current = url
    const audio = new Audio(url)
    audio.volume = 1.0
    audio.playbackRate = 1.0
    audio.preload = 'auto'
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      audio.setAttribute('playsinline', 'true')
      audio.setAttribute('webkit-playsinline', 'true')
      const unlock = () => {
        audio.play().then(() => {
          audio.pause()
          audio.currentTime = 0
          document.removeEventListener('touchstart', unlock)
          document.removeEventListener('click', unlock)
        }).catch(() => {})
      }
      document.addEventListener('touchstart', unlock, { once: true })
      document.addEventListener('click', unlock, { once: true })
    }
    setPlaying(true)
    try {
      await globalAudioManager.playAudio(audio)
    } catch (e) {
      console.log('Audio play failed:', e)
    } finally {
      setPlaying(false)
      URL.revokeObjectURL(url)
      audioUrlRef.current = null
    }
  }

  // Simple expression detection
  const shouldUseExpressions = (question: string, response: string): boolean => {
    const questionLower = question.toLowerCase()
    const responseLower = response.toLowerCase()
    
    const emotionalTriggers = [
      'funny', 'hilarious', 'laugh', 'joke', 'humor', 'amusing',
      'sad', 'unfortunately', 'disappointing', 'tough', 'sigh',
      'wow', 'unbelievable', 'jeez', 'amazing'
    ]
    
    return emotionalTriggers.some(trigger => 
      questionLower.includes(trigger) || responseLower.includes(trigger)
    )
  }

  // Simple expression player
  const playExpressionAudio = async (text: string, response: string) => {
    const responseLower = response.toLowerCase()
    const questionLower = text.toLowerCase()
    
    let expressionType = null
    
    if (responseLower.includes('funny') || responseLower.includes('hilarious') || 
        responseLower.includes('laugh') || questionLower.includes('funny')) {
      expressionType = 'laugh'
    } else if (responseLower.includes('unfortunately') || responseLower.includes('sad') || 
               responseLower.includes('sigh') || responseLower.includes('disappointing')) {
      expressionType = 'sigh'
    } else if (responseLower.includes('wow') || responseLower.includes('unbelievable') ||
               responseLower.includes('jeez') || responseLower.includes('amazing')) {
      expressionType = 'jeez'
    }
    
    if (expressionType) {
      try {
        console.log('🎭 Playing expression:', expressionType)
        const response = await fetch('/api/expressions/play', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            avatarId: AVATAR_SLUG,
            type: expressionType
          })
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.expression && data.expression.cdnUrl) {
            const audio = new Audio(data.expression.cdnUrl)
            audio.volume = 1.0
            await globalAudioManager.playAudio(audio)
            console.log('🎭 Expression played successfully')
          }
        }
      } catch (error) {
        console.warn('Expression playback failed:', error)
      }
    }
  }

  const askQuestion = async (text: string) => {
    if (!text.trim()) return
    await stopAllAudio()
    setPlaying(false)
    setLoading(true)
    setAnswer('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatarSlug: AVATAR_SLUG,
          message: text,
          stream: true,
          storeMemory: true
        })
      })

      if (res.ok && res.body) {
        // Simple approach: collect complete response, then play naturally
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let full = ''

        // Collect complete response
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.delta) {
                  full += data.delta
                  setAnswer(full)
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }

        console.log('🎵 Complete response received, playing naturally...')
        
        // Play expression first if detected
        if (shouldUseExpressions(text, full)) {
          await playExpressionAudio(text, full)
          await new Promise(resolve => setTimeout(resolve, 100)) // Very short pause
        }
        
        // Generate single TTS for complete response
        const ttsResponse = await fetch('/api/voice-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: full,
            avatar: AVATAR_SLUG
          })
        })

        if (ttsResponse.ok) {
          const audioBuffer = await ttsResponse.arrayBuffer()
          const blob = new Blob([audioBuffer], { type: 'audio/mpeg' })
          await playAudioBlob(blob)
        }
        
      } else {
        // Fallback for non-streaming
        const data = await res.json().catch(() => ({}))
        const reply = data.answer || '😕 No answer.'
        setAnswer(reply)
        
        if (reply) {
          const tts = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatar: AVATAR_SLUG, text: reply })
          })
          if (tts.ok) {
            const blob = await tts.blob()
            await playAudioBlob(blob)
          }
        }
      }
    } catch (err) {
      console.error('Chat error:', err)
      setAnswer('Sorry, there was an error processing your request.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    askQuestion(question)
  }

  // Speech recognition helpers (simplified)
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

  const handleMicClick = () => {
    if (listening) {
      if (recognitionRef.current) recognitionRef.current.stop()
      setListening(false)
      return
    }
    if (hasSpeechRecognition) startWebSpeech()
  }

  const handleReplay = async () => {
    if (!answer) return
    await stopAllAudio()
    setPlaying(true)
    
    try {
      // Play expression first if applicable
      if (shouldUseExpressions('', answer)) {
        await playExpressionAudio('', answer)
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      const tts = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: AVATAR_SLUG, text: answer })
      })
      if (tts.ok) {
        const blob = await tts.blob()
        await playAudioBlob(blob)
      } else {
        setPlaying(false)
      }
    } catch (error) {
      console.error('Replay failed:', error)
      setPlaying(false)
    }
  }

  return (
    <ProfileProvider>
      <PageShell>
        <main className="main-container">
          <audio ref={audioRef} />
          <div className="hero-section">
            <h1 className="main-title">
              Chat with {jonathanProfile?.full_name?.split(' ')[0] || 'Jonathan'}
            </h1>
            <p className="main-subtitle-enhanced">
              Ask me anything about my experiences, thoughts, or get advice
            </p>
          </div>

          <form className="ask-form" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Ask me anything…"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
            <button type="submit" disabled={loading}>
              {loading ? '…' : '→'}
            </button>
          </form>

          <button
            className={listening ? 'mic-btn active' : 'mic-btn'}
            onClick={handleMicClick}
            type="button"
            disabled={loading}
          >
            {listening ? '🎤 Listening… (tap to stop)' : loading ? '⏳ Processing...' : '🎤 Speak'}
          </button>
          <div className="main-subtitle">
            {isClient
              ? (hasSpeechRecognition
                  ? 'Speech recognition supported on this device.'
                  : 'On this device, your voice will be transcribed after recording.')
              : ' '}
          </div>

          {/* Quick Questions */}
          <div className="quick-questions-section">
            <h3>⚡ Quick Questions</h3>
            <div className="quick-questions-grid">
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  className="quick-question-btn"
                  onClick={() => { setQuestion(q.text); askQuestion(q.text) }}
                  disabled={loading}
                >
                  <span className="question-emoji">{q.emoji}</span>
                  <span className="question-text">{q.text}</span>
                </button>
              ))}
            </div>
          </div>

          {answer && (
            <div className="answer">
              <h2>{jonathanProfile?.full_name?.split(' ')[0] || 'Jonathan'} says:</h2>
              <p>{answer}</p>
              <div className="answer-actions">
                {!playing && (
                  <button onClick={handleReplay} className="play-btn">
                    🔊 Play Again
                  </button>
                )}
                {playing && <div className="status-info">🔊 Playing audio...</div>}
              </div>
            </div>
          )}

          {playing && (
            <div className="soundbars">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="soundbar" />
              ))}
            </div>
          )}
        </main>
      </PageShell>
    </ProfileProvider>
  )
}