'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import AccountMenu from '@/components/AccountMenu'
import './onboarding.css'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export default function OnboardingPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hi! I’m here to help build your personal profile. Ready to get started?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)

  const hasSpeechRecognition = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    inputRef.current?.focus()
  }, [messages])

  useEffect(() => {
    // Initialize Supabase client and get user
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) return
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    async function getUser() {
      const { data, error } = await supabase.auth.getUser()
      if (data?.user?.id) {
        setUserId(data.user.id)
      } else {
        setUserId(null)
      }
    }
    getUser()
  }, [])

  const startListening = () => {
    if (!hasSpeechRecognition) return alert('Speech recognition not supported in this browser.')
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onstart = () => setListening(true)

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.trim()
      setInput(transcript)
      sendMessage(transcript)
      recognition.stop()
    }

    recognition.onerror = () => {
      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)
    }

    recognition.start()
  }

  async function sendMessage(text?: string) {
    const messageText = text ?? input.trim()
    if (!messageText) return
    if (!userId) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Please log in to chat.' }
      ])
      return
    }
    const userMessage: ChatMessage = { role: 'user', content: messageText }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/onboarding/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: messageText, onboarding: true, userId }),
      })
      const data = await response.json()
      if (data.answer) {
        const botMessage: ChatMessage = { role: 'assistant', content: data.answer }
        setMessages(prev => [...prev, botMessage])
        // Optionally update profile if returned
        // if (data.profile) setProfile(data.profile)
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I didn’t get that. Could you please rephrase?' }])
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error connecting to server. Please try again later.' }])
    } finally {
      setLoading(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="onboarding-page">
      <header className="onboarding-header">
        <div className="onboarding-title">EchoStone Onboarding</div>
        <div className="account-menu-wrapper"><AccountMenu /></div>
      </header>

      <main className="onboarding-chat-container">
        <div className="messages-list">
          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              <div className="message-content">{msg.content}</div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="input-bar">
          <button
            onClick={startListening}
            disabled={!hasSpeechRecognition || loading || listening || !userId}
            title={hasSpeechRecognition ? "Speak instead of typing" : "Speech recognition not supported"}
            aria-pressed={listening}
            aria-label="Toggle voice input"
            type="button"
            className={listening ? 'mic-btn active' : 'mic-btn'}
          >
            {listening ? '🎤 Listening...' : '🎤'}
          </button>

          <input
            type="text"
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={loading ? "Waiting for response..." : "Type your answer here..."}
            disabled={loading || listening || !userId}
            aria-label="User input for onboarding"
            autoComplete="off"
          />

          <button
            onClick={sendMessage}
            disabled={loading || listening || !input.trim() || !userId}
            aria-label="Send message"
            className="send-btn"
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>
      </main>
      {/* Optionally display profile object */}
      {/* <pre>{profile && JSON.stringify(profile, null, 2)}</pre> */}
    </div>
  )
}