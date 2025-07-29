'use client'

import jonathanProfile from '@/data/jonathan_profile.json'
import ProfileProvider from '@/components/ProfileContext'
import AccountMenu from '@/components/AccountMenu'
import Image from 'next/image'
import { useState, useRef, useEffect } from 'react'
import { globalAudioManager } from '@/lib/globalAudioManager'
import { stopAllAudio } from '@/lib/streamingUtils'

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
  const audioRef = useRef<HTMLAudioElement>(null)

  // Check if Web Speech API is available
  const hasSpeechRecognition = typeof window !== 'undefined' &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

  useEffect(() => {
    const playInitialAudio = async () => {
      if (audioRef.current) {
        const audioFiles = ['/howdy.mp3', '/hey.mp3', '/hello.mp3']
        const randomIndex = Math.floor(Math.random() * audioFiles.length)
        audioRef.current.src = audioFiles[randomIndex]
        
        try {
          // Use global audio manager for initial audio too
          await globalAudioManager.playAudio(audioRef.current);
        } catch (error) {
          // Handle play error silently
          console.log('Initial audio play failed:', error);
        }
      }
    };
    
    playInitialAudio();
    
    // Cleanup function to stop all audio when component unmounts
    return () => {
      stopAllAudio();
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, [])

  const playAudioBlob = async (blob: Blob) => {
    // Stop any existing audio first to prevent overlaps
    await stopAllAudio();
    
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    const url = URL.createObjectURL(blob)
    audioUrlRef.current = url
    const audio = new Audio(url)
    
    // Enhanced mobile volume control
    audio.volume = 1.0 // Set to maximum volume
    audio.preload = 'auto'
    
    // Mobile-specific audio optimizations
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      // Force audio context for mobile
      audio.setAttribute('playsinline', 'true')
      audio.setAttribute('webkit-playsinline', 'true')
      
      // Try to unlock audio context on mobile
      const unlockAudio = () => {
        audio.play().then(() => {
          audio.pause()
          audio.currentTime = 0
          document.removeEventListener('touchstart', unlockAudio)
          document.removeEventListener('click', unlockAudio)
        }).catch(() => {})
      }
      
      document.addEventListener('touchstart', unlockAudio, { once: true })
      document.addEventListener('click', unlockAudio, { once: true })
    }
    
    setPlaying(true)
    
    try {
      // Use global audio manager to prevent overlaps
      await globalAudioManager.playAudio(audio);
      setPlaying(false);
    } catch (error) {
      console.log('Audio play failed:', error);
      setPlaying(false);
    } finally {
      URL.revokeObjectURL(url);
      audioUrlRef.current = null;
    }
  }

  const askQuestion = async (text: string) => {
    if (!text.trim()) return
    
    // Stop all existing audio first to prevent overlaps
    await stopAllAudio();
    setPlaying(false);
    
    setLoading(true)
    setAnswer('')

    try {
      // Try streaming first
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: text, 
          profileData: jonathanProfile,
          userId: 'jonathan_demo', // Demo user ID for homepage
          partnerProfile: null, // No specific partner context for homepage demo
          stream: true
        })
      })

      if (res.ok && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let fullResponse = ''
        let currentSentence = ''
        let pendingSentences: string[] = []

        const processPendingSentences = async () => {
          while (pendingSentences.length > 0) {
            const sentence = pendingSentences.shift()!;
            try {
              const vr = await fetch('/api/voice-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  sentence: sentence.trim(),
                  voiceId: process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || 'CO6pxVrMZfyL61ZIglyr'
                })
              })
              if (vr.ok) {
                const blob = await vr.blob()
                if (blob.size > 0) {
                  await playAudioBlob(blob)
                }
              }
            } catch (voiceError) {
              console.warn('Voice synthesis failed for sentence:', sentence)
            }
            // Small delay between sentences
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        };

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            fullResponse += chunk
            currentSentence += chunk
            setAnswer(fullResponse)

            // Check for sentence completion and synthesize voice
            if (chunk.match(/[.!?]/)) {
              const sentences = currentSentence.split(/[.!?]/)
              if (sentences.length > 1) {
                const completeSentence = sentences[0] + chunk.match(/[.!?]/)?.[0]
                if (completeSentence.trim().length > 10) {
                  // Queue sentence for processing instead of dropping it
                  pendingSentences.push(completeSentence.trim());
                  
                  // Start processing if not already running
                  if (pendingSentences.length === 1) {
                    processPendingSentences();
                  }
                }
                currentSentence = sentences.slice(1).join('')
              }
            }
          }

          // Handle any remaining sentence
          if (currentSentence.trim()) {
            pendingSentences.push(currentSentence.trim());
            // Process any remaining sentences
            if (pendingSentences.length > 0) {
              processPendingSentences();
            }
          }

        } finally {
          reader.releaseLock()
        }
      } else {
        // Fallback to non-streaming
        const data = await res.json()
        const answer = data.answer || '😕 No answer.'
        setAnswer(answer)

        // voice playback for fallback
        if (answer) {
          try {
            const vr = await fetch('/api/voice', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                text: answer,
                voiceId: process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || 'CO6pxVrMZfyL61ZIglyr'
              })
            })
            const blob = await vr.blob()
            playAudioBlob(blob)
          } catch {
            setPlaying(false)
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      setAnswer('Sorry, there was an error processing your request.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    askQuestion(question)
  }

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
    
    // Stop any existing audio first
    await stopAllAudio();
    
    setPlaying(true)
    try {
      const vr = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: answer,
          voiceId: process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || 'CO6pxVrMZfyL61ZIglyr'
        })
      })
      const blob = await vr.blob()
      await playAudioBlob(blob)
    } catch {
      setPlaying(false)
    }
  }

  return (
    <ProfileProvider>
      <div className="fixed top-4 right-4 z-50">
        <AccountMenu />
      </div>
      <main className="main-container">
        <audio ref={audioRef} />
        <div className="mb-lg select-none">
          <Image
            src="/echostone_logo.png"
            alt="EchoStone Logo"
            width={140}
            height={140}
            className="logo-pulse"
            draggable={false}
          />
        </div>
        <h1 className="main-title">
          {jonathanProfile?.full_name?.split(' ')[0] || 'Jonathan'} says:
        </h1>

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
        >
          {listening ? '🎤 Listening… (tap to stop)' : '🎤 Speak'}
        </button>
        <div className="main-subtitle">
          {hasSpeechRecognition
            ? 'Speech recognition supported on this device.'
            : 'On this device, your voice will be transcribed after recording.'}
        </div>

        {answer && (
          <div className="answer">
            <h2>{jonathanProfile?.full_name?.split(' ')[0] || 'Jonathan'} says:</h2>
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
      </main>
    </ProfileProvider>
  )
}