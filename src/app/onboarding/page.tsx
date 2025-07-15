'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import AccountMenu from '@/components/AccountMenu'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

let currentElevenLabsAudio: HTMLAudioElement | null = null;

let lastPlayedMessageId = 0;

async function playElevenLabs(text: string) {
  try {
    if (currentElevenLabsAudio) {
      currentElevenLabsAudio.pause();
      currentElevenLabsAudio = null;
    }

    const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    const voiceId = 'wAGzRVkxKEs8La0lmdrE';
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=0`;

    if (!apiKey) {
      console.warn('No ElevenLabs API key found, falling back to browser TTS.');
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new window.SpeechSynthesisUtterance(text);
        utter.rate = 1.08;
        utter.pitch = 1.04;
        utter.lang = 'en-US';
        window.speechSynthesis.speak(utter);
        return;
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey!,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        voice_settings: { stability: 0.5, similarity_boost: 0.7 }
      })
    });

    if (response.ok) {
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const answerAudio = new Audio(audioUrl);
      answerAudio.volume = 1;
      answerAudio.playbackRate = 1.14;
      currentElevenLabsAudio = answerAudio;

      await answerAudio.play();

      currentElevenLabsAudio = null;
    } else {
      console.error('ElevenLabs TTS request failed, falling back to browser TTS');
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new window.SpeechSynthesisUtterance(text);
        utter.rate = 1.08;
        utter.pitch = 1.04;
        utter.lang = 'en-US';
        window.speechSynthesis.speak(utter);
      }
    }
  } catch (error) {
    console.error('Error during ElevenLabs TTS:', error);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new window.SpeechSynthesisUtterance(text);
      utter.rate = 1.08;
      utter.pitch = 1.04;
      utter.lang = 'en-US';
      window.speechSynthesis.speak(utter);
    }
  }
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
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)

  const hasSpeechRecognition = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  useEffect(() => {
    const intro = new Audio('/snippets/intro.mp3');
    intro.volume = 1;
    intro.play();
    return () => {
      intro.pause();
    };
  }, []);

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
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognition.start()
  }

  const stopListening = () => {
    if (!listening) return;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setListening(false);
    // Send message after stopping (if transcript is set)
    if (input.trim()) {
      sendMessage();
    }
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
      // Handle meta-questions locally before calling API
      const userMsgLower = messageText.toLowerCase()
      if (userMsgLower.match(/do you want.*ask.*questions?|how does this work|should i just talk/i)) {
        const answer = "Good question! You can just start telling a story, or I can ask you some questions if you want. Which would you prefer?"
        setMessages(prev => [...prev, { role: 'assistant', content: answer }])
        const thisMessageId = ++lastPlayedMessageId;
        await playElevenLabs(answer);
        if (thisMessageId !== lastPlayedMessageId) return;
        setLoading(false)
        return
      }
      if (userMsgLower.match(/what.*story.*tell|what.*should.*talk|what.*should.*say|what would you like/i)) {
        const answer = "How about a favorite family memory, or something that always stuck with you?"
        setMessages(prev => [...prev, { role: 'assistant', content: answer }])
        const thisMessageId = ++lastPlayedMessageId;
        await playElevenLabs(answer);
        if (thisMessageId !== lastPlayedMessageId) return;
        setLoading(false)
        return
      }
      if (userMsgLower.match(/^(yes|okay|ok|sure|i'm ready)$/i)) {
        const answer = "Great, just start whenever you're ready. Take your time."
        setMessages(prev => [...prev, { role: 'assistant', content: answer }])
        const thisMessageId = ++lastPlayedMessageId;
        await playElevenLabs(answer);
        if (thisMessageId !== lastPlayedMessageId) return;
        setLoading(false)
        return
      }

      // Default: call API
      const response = await fetch('/api/onboarding/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: messageText, onboarding: true, userId, responseLength: 'short' }),
      })
      const data = await response.json()
      if (data.answer) {
        const fullAnswer = data.answer.trim();
        const botMessage: ChatMessage = { role: 'assistant', content: fullAnswer };
        setMessages(prev => [...prev, botMessage]);
        const thisMessageId = ++lastPlayedMessageId;
        await playElevenLabs(fullAnswer);
        if (thisMessageId !== lastPlayedMessageId) return;
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

  return (
    <div className="min-h-screen w-screen relative">
      <div className="fixed top-9 right-9 z-50">
        <AccountMenu />
      </div>

      <main className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="onboarding-container">
          <div className="onboarding-header">
            <img
              src="/echostone_logo.png"
              alt="EchoStone Logo"
              className="logo-pulse onboarding-logo"
            />
            <h1 className="onboarding-title">Tell Your Story</h1>
            <p className="onboarding-subtitle">
              Share your memories, experiences, and what makes you unique. 
              I'm here to listen and help build your digital profile.
            </p>
          </div>

          <div className="onboarding-form-container">
            <div className="onboarding-input-section">
              <button
                onClick={listening ? stopListening : startListening}
                disabled={!hasSpeechRecognition || loading || !userId}
                title={hasSpeechRecognition ? (listening ? "Click to stop recording" : "Click to start recording") : "Speech recognition not supported"}
                aria-pressed={listening}
                aria-label={listening ? "Stop recording" : "Start recording"}
                type="button"
                className={`onboarding-mic-btn ${listening ? 'active' : ''}`}
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
              
              <div className="onboarding-divider">
                <span>or</span>
              </div>
              
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={loading ? "Waiting for response..." : "Type your story here... (shift+enter for new line)"}
                disabled={loading || listening || !userId}
                aria-label="User input for onboarding"
                autoComplete="off"
                rows={4}
                className="onboarding-textarea"
              />
              
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading || listening}
                className="onboarding-send-btn"
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
            
            <div className="onboarding-tips">
              <h3>💡 Story Ideas</h3>
              <ul>
                <li>A favorite childhood memory</li>
                <li>Something that always makes you laugh</li>
                <li>A place that's special to you</li>
                <li>What you're passionate about</li>
                <li>A funny or meaningful experience</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}