'use client'

import jonathanProfile from '@/data/jonathan_profile.json'
import ProfileProvider from '@/components/ProfileContext'
import SimpleNavigation from '@/components/SimpleNavigation'
import Image from 'next/image'
import { useState, useRef, useEffect } from 'react'
import { CleanVoicePlayer } from '@/lib/cleanVoice'

export default function CleanHomepage() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [playing, setPlaying] = useState(false)
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<any>(null)
  const audioChunksRef = useRef<any[]>([])
  const timeoutRef = useRef<any>(null)
  const voicePlayerRef = useRef<CleanVoicePlayer | null>(null)

  // Check if Web Speech API is available
  const hasSpeechRecognition = typeof window !== 'undefined' &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

  useEffect(() => {
    // Initialize clean voice player with your cloned voice
    const voiceId = 'CO6pxVrMZfyL61ZIglyr';
    voicePlayerRef.current = new CleanVoicePlayer(voiceId);

    // Play simple initial greeting
    const playInitialGreeting = async () => {
      try {
        const response = await fetch('/api/clean-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'Hey there! What would you like to talk about?',
            voiceId: voiceId
          })
        });
        
        if (response.ok) {
          const audioBuffer = await response.arrayBuffer();
          const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
          const audio = new Audio(URL.createObjectURL(blob));
          audio.play().catch(() => {}); // Ignore errors for initial greeting
        }
      } catch (error) {
        // Ignore initial greeting errors
        console.log('Initial greeting skipped');
      }
    };

    // Small delay to let page load
    setTimeout(playInitialGreeting, 1000);

    return () => {
      if (voicePlayerRef.current) {
        voicePlayerRef.current.stop();
      }
    };
  }, [])

  const askQuestion = async (text: string) => {
    if (!text.trim()) return

    // Stop any existing audio
    if (voicePlayerRef.current) {
      voicePlayerRef.current.stop();
    }
    setPlaying(false);

    setLoading(true)
    setAnswer('')

    try {
      console.log('Asking question:', text);

      // Get response from chat API - NO streaming
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          profileData: jonathanProfile,
          userId: 'jonathan_demo',
          partnerProfile: null,
          stream: false // Force non-streaming
        })
      })

      if (!res.ok) {
        throw new Error(`Chat API failed: ${res.status}`);
      }

      const data = await res.json()
      const responseText = data.answer || 'Sorry, I didn\'t understand that.'
      
      console.log('Got response:', responseText.substring(0, 100) + '...');
      setAnswer(responseText)

      // Play the complete response with clean voice
      if (responseText && voicePlayerRef.current) {
        setPlaying(true);
        try {
          await voicePlayerRef.current.playText(responseText);
          console.log('Voice playback completed successfully');
        } catch (error) {
          console.error('Voice playback failed:', error);
        } finally {
          setPlaying(false);
        }
      }

    } catch (error) {
      console.error('Chat error:', error)
      setAnswer('Sorry, there was an error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (question.trim()) {
      askQuestion(question)
      setQuestion('') // Clear input after submitting
    }
  }

  const startWebSpeech = () => {
    const Rec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Rec) return alert('Speech recognition not supported on this browser')
    
    const recognition = new Rec()
    recognitionRef.current = recognition
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'
    
    recognition.onstart = () => {
      console.log('Speech recognition started')
      setListening(true)
    }
    
    recognition.onresult = (ev: any) => {
      const transcript = ev.results[0][0].transcript.trim()
      console.log('Speech recognized:', transcript)
      setQuestion(transcript)
      recognition.stop()
      setListening(false)
      askQuestion(transcript)
    }
    
    recognition.onend = () => {
      console.log('Speech recognition ended')
      setListening(false)
    }
    
    recognition.onerror = (ev: any) => {
      console.error('Speech recognition error:', ev.error)
      setListening(false)
    }
    
    recognition.start()
  }

  const handleMicClick = () => {
    if (listening) {
      // Stop listening
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      setListening(false)
      return
    }

    // Start listening
    if (hasSpeechRecognition) {
      startWebSpeech()
    } else {
      alert('Speech recognition not supported on this device. Please type your question.')
    }
  }

  const handleReplay = async () => {
    if (!answer || !voicePlayerRef.current) return

    setPlaying(true);
    try {
      console.log('Replaying audio...');
      await voicePlayerRef.current.playText(answer);
    } catch (error) {
      console.error('Replay failed:', error);
    } finally {
      setPlaying(false);
    }
  }

  const handleStopAudio = () => {
    if (voicePlayerRef.current) {
      voicePlayerRef.current.stop();
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
            disabled={loading}
          />
          <button type="submit" disabled={loading || !question.trim()}>
            {loading ? '⏳' : '→'}
          </button>
        </form>

        <button
          className={listening ? 'mic-btn active' : 'mic-btn'}
          onClick={handleMicClick}
          type="button"
          disabled={loading}
        >
          {listening ? '🎤 Listening… (tap to stop)' : '🎤 Speak'}
        </button>
        
        <div className="main-subtitle">
          {hasSpeechRecognition
            ? 'Speech recognition supported.'
            : 'Speech recognition not available - please type your questions.'}
        </div>

        {answer && (
          <div className="answer">
            <h2>{jonathanProfile?.full_name?.split(' ')[0] || 'Jonathan'} says:</h2>
            <p>{answer}</p>
            <div className="answer-actions">
              {!playing ? (
                <button onClick={handleReplay} className="play-btn">
                  🔊 Play Again
                </button>
              ) : (
                <button onClick={handleStopAudio} className="play-btn">
                  ⏹️ Stop Audio
                </button>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="status-info">
            ⏳ Thinking...
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