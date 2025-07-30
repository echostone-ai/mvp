'use client'

import jonathanProfile from '@/data/jonathan_profile.json'
import ProfileProvider from '@/components/ProfileContext'
import SimpleNavigation from '@/components/SimpleNavigation'
import Image from 'next/image'
import { useState, useRef, useEffect } from 'react'
import { SimpleVoiceStreamer } from '@/lib/simpleVoice'

export default function SimpleHomepage() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [playing, setPlaying] = useState(false)
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<any>(null)
  const audioChunksRef = useRef<any[]>([])
  const timeoutRef = useRef<any>(null)
  const voiceStreamerRef = useRef<SimpleVoiceStreamer | null>(null)

  // Check if Web Speech API is available
  const hasSpeechRecognition = typeof window !== 'undefined' &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

  useEffect(() => {
    // Initialize voice streamer
    const voiceId = 'CO6pxVrMZfyL61ZIglyr';
    voiceStreamerRef.current = new SimpleVoiceStreamer(voiceId);

    // Play initial greeting
    const playInitialAudio = async () => {
      try {
        const response = await fetch('/api/simple-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'Hey there! Ask me anything.',
            voiceId: voiceId
          })
        });
        
        if (response.ok) {
          const audioBuffer = await response.arrayBuffer();
          const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
          const audio = new Audio(URL.createObjectURL(blob));
          audio.play().catch(console.log);
        }
      } catch (error) {
        console.log('Initial audio failed:', error);
      }
    };

    playInitialAudio();

    return () => {
      if (voiceStreamerRef.current) {
        voiceStreamerRef.current.stop();
      }
    };
  }, [])

  const askQuestion = async (text: string) => {
    if (!text.trim()) return

    // Stop any existing audio
    if (voiceStreamerRef.current) {
      voiceStreamerRef.current.stop();
    }
    setPlaying(false);

    setLoading(true)
    setAnswer('')

    try {
      // Get response from chat API
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          profileData: jonathanProfile,
          userId: 'jonathan_demo',
          partnerProfile: null,
          stream: false // Use simple non-streaming approach
        })
      })

      const data = await res.json()
      const responseText = data.answer || 'Sorry, I didn\'t get that.'
      setAnswer(responseText)

      // Play the response with simple voice
      if (responseText && voiceStreamerRef.current) {
        setPlaying(true);
        try {
          await voiceStreamerRef.current.playText(responseText);
        } catch (error) {
          console.error('Voice playback failed:', error);
        } finally {
          setPlaying(false);
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
    if (!answer || !voiceStreamerRef.current) return

    setPlaying(true);
    try {
      await voiceStreamerRef.current.playText(answer);
    } catch (error) {
      console.error('Replay failed:', error);
    } finally {
      setPlaying(false);
    }
  }

  return (
    <ProfileProvider>
      <SimpleNavigation />
      <main className="main-container">
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
          Chat with {jonathanProfile?.full_name?.split(' ')[0] || 'Jonathan'}
        </h1>
        <p className="main-subtitle-enhanced">
          Ask me anything about my experiences, thoughts, or get advice
        </p>

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
          {hasSpeechRecognition
            ? 'Speech recognition supported on this device.'
            : 'On this device, your voice will be transcribed after recording.'}
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
              {playing && (
                <div className="status-info">
                  🔊 Playing audio...
                </div>
              )}
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
    </ProfileProvider>
  )
}