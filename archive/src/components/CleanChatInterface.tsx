'use client'

import React, { useState, useRef, useEffect } from 'react'
import { CleanVoicePlayer } from '@/lib/cleanVoice'

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

interface CleanChatInterfaceProps {
  profileData: any
  voiceId: string | null
  userId?: string
  avatarId?: string
  initialMessages?: ChatMessage[]
  onAsk?: (question: string) => void
  visitorName?: string
  isSharedAvatar?: boolean
  shareToken?: string
}

export default function CleanChatInterface({
  profileData,
  voiceId,
  userId,
  avatarId,
  initialMessages = [],
  onAsk,
  visitorName,
  isSharedAvatar = false,
  shareToken,
}: CleanChatInterfaceProps) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [hasSpeechRecognition, setHasSpeechRecognition] = useState(false)

  const recognitionRef = useRef<any>(null)
  const voicePlayerRef = useRef<CleanVoicePlayer | null>(null)

  // Debug logging
  useEffect(() => {
    console.log('[CleanChatInterface] Profile data:', profileData)
    console.log('[CleanChatInterface] Voice ID:', voiceId)
    console.log('[CleanChatInterface] Avatar ID:', avatarId)
  }, [profileData, voiceId, avatarId])

  // Initialize client-side features
  useEffect(() => {
    setIsClient(true)
    
    // Initialize voice player if we have a voice ID
    if (voiceId) {
      voicePlayerRef.current = new CleanVoicePlayer(voiceId);
      console.log('[CleanChatInterface] Initialized voice player with ID:', voiceId);
    }
    
    // Check speech recognition support
    const speechRecognitionSupported = !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    )
    setHasSpeechRecognition(speechRecognitionSupported)
    
    console.log('[CleanChatInterface] Speech recognition support:', speechRecognitionSupported)

    return () => {
      if (voicePlayerRef.current) {
        voicePlayerRef.current.stop();
      }
    };
  }, [voiceId])

  // Ask question logic - CLEAN and SIMPLE
  const askQuestion = async (text: string) => {
    if (!text.trim()) return
    
    // Stop any existing audio
    if (voicePlayerRef.current) {
      voicePlayerRef.current.stop();
    }
    setPlaying(false);
    
    setLoading(true)
    setAnswer('')

    const userMessage: ChatMessage = { role: 'user', content: text }
    const newHistory: ChatMessage[] = [...messages, userMessage]
    setMessages(newHistory)
    setQuestion('')

    if (onAsk) {
      onAsk(text)
      setLoading(false)
      return
    }

    try {
      console.log('[CleanChatInterface] Sending question:', text);

      // Call chat API - NO streaming, keep it simple
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          history: newHistory.slice(-10), // Only send last 10 messages for context
          profileData,
          userId,
          avatarId,
          visitorName,
          isSharedAvatar,
          shareToken,
          stream: false // Force non-streaming for reliability
        })
      })

      if (!res.ok) {
        throw new Error(`Chat API failed: ${res.status}`);
      }

      const data = await res.json()
      const responseText = data.answer || 'I\'m not sure how to respond to that.'
      
      console.log('[CleanChatInterface] Got response:', responseText.substring(0, 100) + '...');
      setAnswer(responseText)

      const assistantMessage: ChatMessage = { role: 'assistant', content: responseText }
      setMessages([...newHistory, assistantMessage])

      // Play voice response if we have voice ID
      if (responseText && voiceId && voicePlayerRef.current) {
        setPlaying(true);
        try {
          console.log('[CleanChatInterface] Playing voice response...');
          await voicePlayerRef.current.playText(responseText);
          console.log('[CleanChatInterface] Voice playback completed');
        } catch (error) {
          console.error('[CleanChatInterface] Voice playback failed:', error);
        } finally {
          setPlaying(false);
        }
      }

    } catch (err: any) {
      console.error('[CleanChatInterface] Error:', err);
      setAnswer('Sorry, there was an error. Please try again.');
      
      const errorMessage: ChatMessage = { role: 'assistant', content: 'Sorry, there was an error. Please try again.' }
      setMessages([...newHistory, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (question.trim()) {
      askQuestion(question)
    }
  }

  const startWebSpeech = () => {
    const Rec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Rec) return alert('Speech recognition not supported')
    
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
    recognition.onerror = () => setListening(false)
    
    recognition.start()
  }

  const handleMicClick = () => {
    if (listening) {
      if (recognitionRef.current) recognitionRef.current.stop()
      setListening(false)
      return
    }
    if (hasSpeechRecognition) {
      startWebSpeech()
    } else {
      alert('Speech recognition not supported on this device')
    }
  }

  const handleReplay = async () => {
    if (!answer || !voiceId || !voicePlayerRef.current) return

    setPlaying(true);
    try {
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

  if (!isClient) {
    return <div>Loading...</div>
  }

  return (
    <div className="chat-interface">
      {/* Chat History */}
      <div className="chat-history">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <h3>Chat with {getFirstName(profileData)}</h3>
            <p>Start a conversation by typing a message or using voice input.</p>
          </div>
        )}
        
        {messages.map((message, index) => (
          <div key={index} className={`chat-message ${message.role}`}>
            <div className="message-content">
              {message.content}
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="chat-message assistant">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder={`Message ${getFirstName(profileData)}...`}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          disabled={loading}
          className="chat-input"
        />
        <button 
          type="submit" 
          disabled={loading || !question.trim()}
          className="chat-send-btn"
        >
          {loading ? '⏳' : '→'}
        </button>
        <button
          type="button"
          onClick={handleMicClick}
          disabled={loading}
          className={`chat-mic-btn ${listening ? 'active' : ''}`}
        >
          {listening ? '🎤' : '🎙️'}
        </button>
      </form>

      {/* Voice Controls */}
      {answer && voiceId && (
        <div className="voice-controls">
          {!playing ? (
            <button onClick={handleReplay} className="voice-control-btn">
              🔊 Replay
            </button>
          ) : (
            <button onClick={handleStopAudio} className="voice-control-btn">
              ⏹️ Stop
            </button>
          )}
        </div>
      )}

      {/* Status Indicators */}
      {playing && (
        <div className="status-indicator">
          🔊 Playing audio...
        </div>
      )}
    </div>
  )
}