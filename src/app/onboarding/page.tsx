'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import AccountMenu from '@/components/AccountMenu'
import PageShell from '@/components/PageShell'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

let currentElevenLabsAudio: HTMLAudioElement | null = null;

let lastPlayedMessageId = 0;

async function playElevenLabs(text: string) {
  try {
    // Always stop any currently playing audio first
    if (currentElevenLabsAudio) {
      currentElevenLabsAudio.pause();
      currentElevenLabsAudio.currentTime = 0;
      currentElevenLabsAudio = null;
    }
    
    // Also stop browser TTS if it's playing
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    const voiceId = 'wAGzRVkxKEs8La0lmdrE';
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=0`;

    console.log('ElevenLabs API Key present:', !!apiKey);
    console.log('Attempting ElevenLabs TTS for:', text.substring(0, 50) + '...');

    if (!apiKey) {
      console.error('ElevenLabs API key is missing! Add NEXT_PUBLIC_ELEVENLABS_API_KEY to your .env.local file');
      return; // Don't fall back to system voice
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
    });

    console.log('ElevenLabs response status:', response.status);

    if (response.ok) {
      const audioBlob = await response.blob();
      console.log('Audio blob size:', audioBlob.size);
      
      const audioUrl = URL.createObjectURL(audioBlob);
      const answerAudio = new Audio(audioUrl);
      answerAudio.volume = 1;
      answerAudio.playbackRate = 1.14;
      currentElevenLabsAudio = answerAudio;

      answerAudio.onended = () => {
        currentElevenLabsAudio = null;
        URL.revokeObjectURL(audioUrl);
      };

      await answerAudio.play();
      console.log('ElevenLabs audio playing successfully');
    } else {
      const errorText = await response.text();
      console.error('ElevenLabs TTS request failed:', response.status, errorText);
      // Don't fall back to system voice - just log the error
    }
  } catch (error) {
    console.error('Error during ElevenLabs TTS:', error);
    // Don't fall back to system voice - just log the error
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

  const [hasSpeechRecognition, setHasSpeechRecognition] = useState(false)

  useEffect(() => {
    setHasSpeechRecognition(typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window))
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      const intro = new Audio('/intro.mp3');
      intro.volume = 1;
      intro.play().catch(error => {
        console.log('Intro audio failed to play:', error);
      });
    }, 3000); // 3 second delay

    return () => {
      clearTimeout(timer);
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

    recognition.onstart = () => setListening(true)
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.trim()
      setInput(transcript)
    }
    recognition.onerror = (event: any) => {
      console.error('Speech error:', event.error)
      setListening(false)
    }
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
    
    // Allow onboarding to work without login for demo purposes
    if (!userId) {
      console.log('No user ID, but allowing onboarding to continue for demo purposes')
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
        // Update profile if returned
        if (data.profile) {
          setProfile(data.profile)
          console.log('Profile updated:', data.profile)
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I didn’t get that. Could you please rephrase?' }])
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
      setMessages(prev => [...prev, { role: 'assistant', content: randomResponse }])
      try {
        const thisMessageId = ++lastPlayedMessageId;
        await playElevenLabs(randomResponse);
      } catch (ttsError) {
        console.log('TTS failed, but continuing...')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageShell>
      <main className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="onboarding-container">
          <div className="onboarding-header">
            <a href="/" className="inline-block">
              <img
                src="/echostone_logo.png"
                alt="EchoStone Logo"
                className="logo-pulse onboarding-logo cursor-pointer hover:scale-110 transition-transform duration-300"
              />
            </a>
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
                disabled={!hasSpeechRecognition || loading}
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
                disabled={loading || listening}
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
    </PageShell>
  )
}