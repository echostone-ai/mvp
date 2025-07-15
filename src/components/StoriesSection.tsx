'use client'

import { useState, useEffect, useRef } from 'react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface StoriesSectionProps {
  userId?: string
}

let currentElevenLabsAudio: HTMLAudioElement | null = null
let lastPlayedMessageId = 0

async function playElevenLabs(text: string) {
  try {
    // Always stop any currently playing audio first
    if (currentElevenLabsAudio) {
      currentElevenLabsAudio.pause()
      currentElevenLabsAudio.currentTime = 0
      currentElevenLabsAudio = null
    }
    
    // Also stop browser TTS if it's playing
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }

    const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY
    const voiceId = 'wAGzRVkxKEs8La0lmdrE'
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=0`

    if (!apiKey) {
      console.error('ElevenLabs API key is missing!')
      return
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        voice_settings: { stability: 0.5, similarity_boost: 0.7 }
      })
    })

    if (response.ok) {
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const answerAudio = new Audio(audioUrl)
      answerAudio.volume = 1
      answerAudio.playbackRate = 1.14
      currentElevenLabsAudio = answerAudio

      answerAudio.onended = () => {
        currentElevenLabsAudio = null
        URL.revokeObjectURL(audioUrl)
      }

      await answerAudio.play()
    }
  } catch (error) {
    console.error('Error during ElevenLabs TTS:', error)
  }
}

export default function StoriesSection({ userId }: StoriesSectionProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { 
      role: 'assistant', 
      content: 'Hi! I\'m here to help build your personal profile. Ready to share some stories?',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [hasSpeechRecognition, setHasSpeechRecognition] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef<string>('')

  useEffect(() => {
    setHasSpeechRecognition(
      typeof window !== 'undefined' && 
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    )
  }, [])

  useEffect(() => {
    // Play intro audio after 3 seconds, but only once per session
    const hasPlayedIntro = sessionStorage.getItem('echostone_intro_played')
    
    if (!hasPlayedIntro) {
      const timer = setTimeout(() => {
        const intro = new Audio('/intro.mp3')
        intro.volume = 1
        intro.play().then(() => {
          // Mark as played for this session
          sessionStorage.setItem('echostone_intro_played', 'true')
        }).catch(error => {
          console.log('Intro audio failed to play:', error)
        })
      }, 3000)

      return () => {
        clearTimeout(timer)
      }
    }
  }, [])

  // Removed auto-focus to prevent page scrolling when tab is clicked

  // Dynamic height calculation based on messages
  useEffect(() => {
    const chatContainer = document.querySelector('.stories-chat-container') as HTMLElement
    const sidebar = document.querySelector('.stories-prompts-sidebar') as HTMLElement
    
    if (chatContainer && sidebar) {
      const sidebarHeight = sidebar.offsetHeight
      const messageCount = messages.length
      
      // Start with minimum height, grow with messages until sidebar height
      const baseHeight = 500
      const heightPerMessage = 80
      const maxHeight = Math.max(sidebarHeight, 700) // Ensure minimum reasonable height
      const calculatedHeight = Math.min(baseHeight + (messageCount * heightPerMessage), maxHeight)
      
      chatContainer.style.height = `${calculatedHeight}px`
      chatContainer.style.minHeight = `${baseHeight}px`
      
      // Only enable scrolling when we reach max height
      const messagesContainer = chatContainer.querySelector('.stories-chat-messages') as HTMLElement
      if (messagesContainer) {
        if (calculatedHeight >= maxHeight) {
          messagesContainer.style.overflowY = 'auto'
          messagesContainer.style.maxHeight = `${maxHeight - 250}px` // Account for input area
          // DO NOT auto-scroll - let user scroll manually if needed
        } else {
          messagesContainer.style.overflowY = 'visible'
          messagesContainer.style.maxHeight = 'none'
        }
      }
    }
  }, [messages])

  const startListening = () => {
    if (!hasSpeechRecognition) {
      alert('Speech recognition not supported in this browser.')
      return
    }
    
    // Stop any currently playing ElevenLabs audio
    if (currentElevenLabsAudio) {
      currentElevenLabsAudio.pause()
      currentElevenLabsAudio = null
    }
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      console.log('Speech recognition started')
      setListening(true)
    }
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.trim()
      console.log('Speech recognition result:', transcript)
      transcriptRef.current = transcript
      setInput(transcript)
    }
    recognition.onerror = (event: any) => {
      console.error('Speech error:', event.error)
      setListening(false)
      transcriptRef.current = ''
    }
    recognition.onend = () => {
      console.log('Speech recognition ended')
      setListening(false)
      // Auto-submit the story when speech recognition ends
      setTimeout(() => {
        const transcript = transcriptRef.current
        console.log('Auto-submitting transcript:', transcript)
        if (transcript && transcript.trim()) {
          sendMessage(transcript.trim())
          transcriptRef.current = '' // Clear after sending
        }
      }, 300) // Reduced delay
    }
    
    recognition.start()
  }

  const stopListening = () => {
    if (!listening) return
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setListening(false)
    // Send message after stopping (if transcript is set)
    if (input.trim()) {
      sendMessage()
    }
  }

  async function sendMessage(text?: string) {
    const messageText = text ?? input.trim()
    if (!messageText) return
    
    const userMessage: ChatMessage = { 
      role: 'user', 
      content: messageText,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      // Handle meta-questions locally before calling API
      const userMsgLower = messageText.toLowerCase()
      if (userMsgLower.match(/do you want.*ask.*questions?|how does this work|should i just talk/i)) {
        const answer = "Good question! You can just start telling a story, or I can ask you some questions if you want. Which would you prefer?"
        const botMessage: ChatMessage = { 
          role: 'assistant', 
          content: answer,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, botMessage])
        const thisMessageId = ++lastPlayedMessageId
        await playElevenLabs(answer)
        setLoading(false)
        return
      }
      
      if (userMsgLower.match(/what.*story.*tell|what.*should.*talk|what.*should.*say|what would you like/i)) {
        const answer = "How about a favorite family memory, or something that always stuck with you?"
        const botMessage: ChatMessage = { 
          role: 'assistant', 
          content: answer,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, botMessage])
        const thisMessageId = ++lastPlayedMessageId
        await playElevenLabs(answer)
        setLoading(false)
        return
      }
      
      if (userMsgLower.match(/^(yes|okay|ok|sure|i'm ready)$/i)) {
        const answer = "Great, just start whenever you're ready. Take your time."
        const botMessage: ChatMessage = { 
          role: 'assistant', 
          content: answer,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, botMessage])
        const thisMessageId = ++lastPlayedMessageId
        await playElevenLabs(answer)
        setLoading(false)
        return
      }

      // Call the onboarding API
      const response = await fetch('/api/onboarding/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: messageText, 
          onboarding: true, 
          userId, 
          responseLength: 'short' 
        }),
      })
      
      const data = await response.json()
      if (data.answer) {
        const fullAnswer = data.answer.trim()
        const botMessage: ChatMessage = { 
          role: 'assistant', 
          content: fullAnswer,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, botMessage])
        const thisMessageId = ++lastPlayedMessageId
        await playElevenLabs(fullAnswer)
      } else {
        const fallbackMessage = 'Sorry, I didn\'t get that. Could you please rephrase?'
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: fallbackMessage,
          timestamp: new Date()
        }])
      }
    } catch (err) {
      // Fallback responses for demo purposes
      const fallbackResponses = [
        "That's really interesting! Tell me more about that experience.",
        "I love hearing stories like that. What made that moment special for you?",
        "Thanks for sharing that with me. How did that make you feel?",
        "That sounds meaningful. Can you tell me more about what happened next?",
        "I appreciate you opening up about that. What other memories come to mind?"
      ]
      const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)]
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: randomResponse,
        timestamp: new Date()
      }])
      try {
        const thisMessageId = ++lastPlayedMessageId
        await playElevenLabs(randomResponse)
      } catch (ttsError) {
        console.log('TTS failed, but continuing...')
      }
    } finally {
      setLoading(false)
    }
  }

  const storyPrompts = [
    { icon: "🏠", text: "Tell me about your childhood home" },
    { icon: "👨‍👩‍👧‍👦", text: "Share a family tradition" },
    { icon: "🎓", text: "Describe a pivotal moment in your education" },
    { icon: "✈️", text: "Tell me about a memorable trip" },
    { icon: "💼", text: "Share your career journey" },
    { icon: "❤️", text: "Describe an important relationship" },
    { icon: "🎉", text: "Tell me about a celebration you'll never forget" },
    { icon: "🌟", text: "Share a moment when you felt proud" }
  ]

  return (
    <div className="stories-section-container">
      <div className="stories-header">
        <h2 className="stories-title">Share Your Stories</h2>
        <p className="stories-subtitle">
          Tell me about your memories, experiences, and what makes you unique. 
          These stories help build your authentic digital profile.
        </p>
      </div>

      <div className="stories-layout">
        {/* Chat Interface */}
        <div className="stories-chat-container">
          <div className="stories-chat-messages">
            {messages.map((message, index) => (
              <div 
                key={index} 
                className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
              >
                <div className="message-content">
                  {message.content}
                </div>
                <div className="message-timestamp">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
            {loading && (
              <div className="message assistant-message">
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="stories-input-section">
            <button
              onClick={listening ? stopListening : startListening}
              disabled={!hasSpeechRecognition || loading}
              className={`stories-mic-btn ${listening ? 'active' : ''}`}
            >
              {listening ? (
                <>
                  <span className="mic-icon recording">🎤</span>
                  Stop Recording
                </>
              ) : (
                <>
                  <span className="mic-icon">🎤</span>
                  Start Speaking
                </>
              )}
            </button>
            
            <div className="stories-divider">
              <span>or</span>
            </div>
            
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder={loading ? "Waiting for response..." : "Type your story here... (shift+enter for new line)"}
              disabled={loading || listening}
              rows={4}
              className="stories-textarea"
            />
            
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading || listening}
              className="stories-send-btn"
            >
              {loading ? (
                <>
                  <span className="loading-spinner"></span>
                  Processing...
                </>
              ) : (
                <>
                  <span>✨</span>
                  Share Story
                </>
              )}
            </button>
          </div>
        </div>

        {/* Story Prompts Sidebar */}
        <div className="stories-prompts-sidebar">
          <h3 className="prompts-title">💡 Story Ideas</h3>
          <div className="story-prompts-grid">
            {storyPrompts.map((prompt, index) => (
              <div
                key={index}
                className="story-prompt-item"
              >
                <span className="prompt-icon">{prompt.icon}</span>
                <span className="prompt-text">{prompt.text}</span>
              </div>
            ))}
          </div>
          
          <div className="stories-tips">
            <h4>Tips for great stories:</h4>
            <ul>
              <li>Be specific and detailed</li>
              <li>Include emotions and feelings</li>
              <li>Mention people, places, and times</li>
              <li>Share what made it meaningful</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}