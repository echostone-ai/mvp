'use client'

import jonathanProfile from '@/data/jonathan_profile.json'
import ProfileProvider from '@/components/ProfileContext'
import PageShell from '@/components/PageShell'
import { useState, useRef, useEffect, useMemo } from 'react'
import { globalAudioManager } from '@/lib/globalAudioManager'
import { stopAllAudio, createStreamingAudioManager, StreamingAudioManager, splitIntoSentences } from '@/lib/streamingUtils'
import { getEnhancedVoiceConfig } from '@/lib/enhancedVoiceConfig'
import { ExpressionPackService, ExpressionPack } from '@/lib/services/expressionPackService'
// Helper functions for memory API calls
const memoryAPI = {
  warmCache: async (avatarSlug: string) => {
    try {
      await fetch('/api/jonathan-demo/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'warmCache', avatarSlug })
      });
    } catch (error) {
      console.warn('Cache warming failed:', error);
    }
  },
  
  getMemoryContext: async (text: string, avatarSlug: string) => {
    try {
      const response = await fetch('/api/jonathan-demo/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getMemoryContext', text, avatarSlug })
      });
      return await response.json();
    } catch (error) {
      console.warn('Memory context retrieval failed:', error);
      return { memoryContext: '', relevantMemories: [], memoryStats: null };
    }
  },
  
  storeConversationTurn: async (userMessage: string, assistantResponse: string, avatarSlug: string, conversationId: string) => {
    try {
      fetch('/api/jonathan-demo/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'storeConversationTurn', 
          userMessage, 
          assistantResponse, 
          avatarSlug, 
          conversationId 
        })
      }).catch(error => console.warn('Async memory storage failed:', error));
    } catch (error) {
      console.warn('Memory storage failed:', error);
    }
  }
};
import { jonathanConversationState, JonathanConversationState } from '@/lib/services/jonathanDemoConversationState'
import { mobileAudioContextManager, isMobileSafari } from '@/lib/mobileAudioContextManager'
import { enhancedErrorHandler } from '@/lib/services/enhancedErrorHandler'
import { ToastNotifications } from '@/components/ToastNotifications'
import SimpleExpressionManager from '@/components/SimpleExpressionManager'
import ConversationAnalyticsDashboard from '@/components/ConversationAnalyticsDashboard'
import CrossDeviceSync from '@/components/CrossDeviceSync'
import { crossDeviceSyncService } from '@/lib/services/crossDeviceSyncService'

const AVATAR_SLUG = 'jonathan-demo'

export default function JonathanDemoPage() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [isFirstConversation, setIsFirstConversation] = useState(true)
  const [showExpressionManager, setShowExpressionManager] = useState(false)
  const [showAnalyticsDashboard, setShowAnalyticsDashboard] = useState(false)
  const [crossDeviceSyncEnabled, setCrossDeviceSyncEnabled] = useState(true)
  const [userId] = useState(() => `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<any>(null)
  const audioChunksRef = useRef<any[]>([])
  const timeoutRef = useRef<any>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const resolvedVoiceRef = useRef<string | null>(null)
  const streamingManagerRef = useRef<StreamingAudioManager | null>(null)
  const expressionPackRef = useRef<ExpressionPack | null>(null)
  const conversationStateRef = useRef<JonathanConversationState | null>(null)
  const sessionIdRef = useRef<string | null>(null)

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

    const loadExpressionPack = async () => {
      try {
        console.log('🎭 Loading REAL expression pack for jonathan-demo...')
        
        // First, try to load your actual uploaded expressions
        const response = await fetch(`/api/expressions?avatarId=${AVATAR_SLUG}&ownerType=avatar`)
        const data = await response.json()
        
        let pack: ExpressionPack
        
        if (data.success && data.expressions.length > 0) {
          console.log(`🎭 ✅ Found ${data.expressions.length} REAL uploaded expressions!`)
          
          // Create pack from your actual uploaded expressions
          pack = {
            id: `real-${AVATAR_SLUG}`,
            avatarId: AVATAR_SLUG,
            expressions: data.expressions,
            buffers: new Map(),
            loadedAt: new Date()
          }
          
          console.log('🎭 Your uploaded expressions:')
          data.expressions.forEach((expr: any) => {
            console.log(`  - ${expr.type}: ${expr.filename} (${expr.cdnUrl})`)
          })
          
        } else {
          console.log('🎭 No real expressions found, using mock pack as fallback')
          pack = ExpressionPackService.createMockExpressionPack(AVATAR_SLUG)
        }
        
        // Load audio buffers on client side only
        if (typeof window !== 'undefined') {
          console.log('🎭 Loading audio buffers for expressions...')
          
          try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
            
            // Load buffers in parallel for better performance
            const loadPromises = pack.expressions.map(async (expression) => {
              try {
                console.log(`🎭 Loading ${expression.type} from: ${expression.cdnUrl}`)
                const response = await fetch(expression.cdnUrl)
                if (response.ok) {
                  const arrayBuffer = await response.arrayBuffer()
                  console.log(`🎭 Downloaded ${expression.id}: ${arrayBuffer.byteLength} bytes`)
                  
                  try {
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
                    pack.buffers.set(expression.id, audioBuffer)
                    console.log(`🎭 ✅ Successfully loaded ${expression.type}: ${expression.id} (${audioBuffer.duration.toFixed(2)}s)`)
                    return true
                  } catch (decodeError) {
                    console.error(`🎭 ❌ AudioContext decode failed for ${expression.id}:`, decodeError)
                    
                    // Fallback: Use HTML Audio for M4A and other formats AudioContext can't handle
                    try {
                      console.log(`🎭 Trying HTML Audio fallback for ${expression.id}...`)
                      const audio = new Audio(expression.cdnUrl)
                      audio.preload = 'auto'
                      
                      await new Promise((resolve, reject) => {
                        audio.addEventListener('canplaythrough', resolve)
                        audio.addEventListener('error', reject)
                        audio.load()
                      })
                      
                      // Store the HTML Audio element instead of AudioBuffer
                      pack.buffers.set(expression.id, audio as any)
                      console.log(`🎭 ✅ HTML Audio fallback loaded ${expression.type}: ${expression.id}`)
                      return true
                    } catch (htmlAudioError) {
                      console.error(`🎭 ❌ HTML Audio fallback also failed for ${expression.id}:`, htmlAudioError)
                      return false
                    }
                  }
                } else {
                  console.warn(`🎭 HTTP error loading ${expression.id}: ${response.status}`)
                  return false
                }
              } catch (error) {
                console.warn(`🎭 Failed to load ${expression.id}:`, error)
                return false
              }
            })
            
            const results = await Promise.all(loadPromises)
            const successCount = results.filter(Boolean).length
            console.log(`🎭 Loaded ${successCount}/${pack.expressions.length} expression audio files`)
            
            if (successCount === 0 && data.success && data.expressions.length > 0) {
              console.log('🎭 ⚠️ Your M4A files could not be decoded by the browser')
              console.log('🎭 The browser AudioContext cannot decode M4A files - they need to be MP3 or WAV')
            }
            
          } catch (audioError) {
            console.warn('🎭 Failed to initialize audio context for expressions:', audioError)
          }
        }
        
        expressionPackRef.current = pack
        console.log(`🎭 Expression pack ready: ${pack.expressions.length} expressions, ${pack.buffers.size} audio buffers`)
        
      } catch (error) {
        console.warn('🎭 Failed to load expression pack:', error)
        // Create fallback mock pack without audio
        expressionPackRef.current = ExpressionPackService.createMockExpressionPack(AVATAR_SLUG)
      }
    }

    const initializeConversationState = async () => {
      try {
        console.log('💬 Initializing conversation state...')
        
        // Generate or retrieve session ID
        sessionIdRef.current = jonathanConversationState.generateSessionId()
        console.log('🔑 Session ID generated:', sessionIdRef.current)
        
        // Get or create conversation for this session
        const conversation = await jonathanConversationState.getOrCreateConversation(
          AVATAR_SLUG,
          sessionIdRef.current
        )
        
        conversationStateRef.current = conversation
        console.log(`💬 Conversation initialized: ${conversation.id} (session: ${conversation.sessionId})`)
        
        // Load conversation history if available
        const history = jonathanConversationState.getConversationHistory(conversation.sessionId, 10)
        if (history.length > 0) {
          console.log(`💬 Loaded ${history.length} previous conversation turns`)
        }
        
      } catch (error) {
        console.warn('💬 Failed to initialize conversation state:', error)
      }
    }

    // Task 9: Initialize mobile Safari audio context manager
    const initializeMobileAudio = async () => {
      if (isMobileSafari()) {
        console.log('📱 Mobile Safari detected, initializing audio context manager...')
        
        try {
          // Initialize mobile audio context manager with optimized settings
          const isReady = await mobileAudioContextManager.ensureReady()
          if (isReady) {
            console.log('📱 Mobile Safari audio context ready')
          } else {
            console.log('📱 Mobile Safari audio context requires user gesture')
          }
        } catch (error) {
          console.warn('📱 Failed to initialize mobile Safari audio context:', error)
        }
      }
    }

    playInitialAudio()
    loadExpressionPack()
    initializeConversationState()
    initializeMobileAudio() // Task 9: Initialize mobile Safari audio context
    
    return () => {
      stopAllAudio()
      if (streamingManagerRef.current) {
        streamingManagerRef.current.stop()
        streamingManagerRef.current = null
      }
      
      // End conversation when component unmounts
      if (conversationStateRef.current) {
        jonathanConversationState.endConversation(conversationStateRef.current.id).catch(error => {
          console.warn('Failed to end conversation:', error)
        })
      }
      
      // Task 9: Clean up mobile audio context manager
      if (isMobileSafari()) {
        console.log('📱 Cleaning up mobile Safari audio context manager')
        // Note: We don't destroy the singleton instance as it may be used by other components
        // The manager handles its own lifecycle and cleanup
      }
    }
  }, [])

  // Monitor streaming manager playing state
  useEffect(() => {
    const checkPlayingState = () => {
      if (streamingManagerRef.current) {
        const isCurrentlyPlaying = streamingManagerRef.current.isPlaying()
        if (playing !== isCurrentlyPlaying) {
          setPlaying(isCurrentlyPlaying)
        }
      }
    }

    const interval = setInterval(checkPlayingState, 500)
    return () => clearInterval(interval)
  }, [playing])





  const askQuestion = async (text: string) => {
    if (!text.trim()) return
    
    // Task 9: Ensure mobile Safari audio context is ready before starting
    if (isMobileSafari()) {
      try {
        const isReady = await mobileAudioContextManager.ensureReady()
        if (!isReady) {
          console.warn('📱 Mobile Safari audio context not ready, user gesture required')
          // The mobile audio context manager will show the gesture prompt
          return
        }
      } catch (error) {
        console.error('📱 Failed to ensure mobile Safari audio context:', error)
        return
      }
    }
    
    // Stop any existing audio and streaming
    await stopAllAudio()
    if (streamingManagerRef.current) {
      streamingManagerRef.current.stop()
      streamingManagerRef.current = null
    }
    
    setPlaying(false)
    setLoading(true)
    setAnswer('')

    try {
      // Warm memory cache on first conversation turn (Task 7 requirement)
      if (isFirstConversation) {
        console.log('🧠 First conversation - warming memory cache...')
        memoryAPI.warmCache(AVATAR_SLUG);
        setIsFirstConversation(false)
      }
      
      // Retrieve relevant memories with enhanced error handling (Requirement 4.1, 4.2)
      const memoryStartTime = Date.now()
      const memoryResult = await enhancedErrorHandler.handleMemoryService(
        () => memoryAPI.getMemoryContext(text, AVATAR_SLUG),
        { // Fallback data for session-only memory
          memoryContext: '',
          continuityContext: '',
          memoryCount: 0,
          totalTokens: 0,
          retrievalTimeMs: 0,
          cacheHit: false,
          fallbackUsed: true
        }
      )
      
      const memoryContext = memoryResult.data!
      
      console.log(`🧠 Memory retrieval completed in ${memoryContext.retrievalTimeMs}ms with ${memoryContext.memoryCount} memories (${memoryContext.totalTokens} tokens, cache: ${memoryContext.cacheHit}, fallback: ${memoryContext.fallbackUsed}, degraded: ${memoryResult.degraded})`)
      
      // Ensure memory retrieval meets <200ms requirement
      if (memoryContext.retrievalTimeMs > 200) {
        console.warn(`⚠️ Memory retrieval exceeded 200ms target: ${memoryContext.retrievalTimeMs}ms`)
      }
      // Ensure we have a conversation state
      if (!conversationStateRef.current) {
        conversationStateRef.current = await jonathanConversationState.getOrCreateConversation(
          AVATAR_SLUG,
          sessionIdRef.current || undefined
        )
      }

      // Add user turn to conversation state
      await jonathanConversationState.addConversationTurn(
        conversationStateRef.current.id,
        'user',
        text
      )

      // Initialize streaming audio manager with enhanced error handling
      const streamingResult = await enhancedErrorHandler.handleStreamingAudio(async () => {
        const voiceId = await resolveVoiceId()
        const enhancedConfig = getEnhancedVoiceConfig()
        
        // Update conversation voice settings
        jonathanConversationState.updateVoiceSettings(
          conversationStateRef.current!.id,
          enhancedConfig.voice_settings
        )
        
        return createStreamingAudioManager(
          voiceId,
          enhancedConfig.voice_settings,
          undefined, // accent
          {
            conversationId: conversationStateRef.current!.id,
            avatarId: AVATAR_SLUG,
            useWebAudio: true,
            enableCrossfade: true,
            expressionPack: expressionPackRef.current ? {
              expressions: expressionPackRef.current.expressions,
              buffers: expressionPackRef.current.buffers
            } : undefined
          }
        )
      })
      
      if (streamingResult.success) {
        streamingManagerRef.current = streamingResult.data!
      } else {
        console.error('Failed to initialize streaming audio manager:', streamingResult.error)
        // Continue without streaming - will use fallback audio
      }

      console.log('🎵 Starting streaming response with enhanced voice config...')
      setPlaying(true)

      console.log('🔑 Making API call with session ID:', sessionIdRef.current || 'default-session');
      
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-session-id': sessionIdRef.current || 'default-session'
        },
        body: JSON.stringify({
          avatarSlug: AVATAR_SLUG,
          message: text,
          stream: true,
          storeMemory: true,
          memoryContext: memoryContext.memoryContext,
          continuityContext: memoryContext.continuityContext
        })
      })

      if (res.ok && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let fullResponse = ''
        let currentSentence = ''

        // Process streaming response with batched sentences for smoother audio
        let sentenceBatch = ''
        let batchTimeout: NodeJS.Timeout | null = null
        
        const processBatch = async () => {
          if (sentenceBatch.trim().length > 0 && streamingManagerRef.current) {
            console.log('🎵 Processing sentence batch:', sentenceBatch.substring(0, 50) + '...')
            
            // Use enhanced error handling for voice synthesis
            await enhancedErrorHandler.handleVoiceSynthesis(
              () => streamingManagerRef.current!.addSentence(sentenceBatch.trim()),
              async () => {
                console.log('🔄 Voice synthesis failed, continuing with text only')
                return Promise.resolve()
              }
            )
            sentenceBatch = ''
          }
        }
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                
                // Handle story events
                if (data.event === 'story' && data.data) {
                  console.log('🎵 Story event received:', data.data)
                  
                  try {
                    const storyData = typeof data.data === 'string' ? JSON.parse(data.data) : data.data
                    
                    if (storyData.triggered && storyData.audioUrl) {
                      console.log('🎵 Playing authentic voice story:', storyData.title)
                      
                      // Stop any existing TTS
                      if (streamingManagerRef.current) {
                        streamingManagerRef.current.stop()
                      }
                      
                      // Create and play story audio
                      const storyAudio = new Audio(storyData.audioUrl)
                      storyAudio.preload = 'auto'
                      
                      // Show story transcript as the "answer"
                      const storyResponse = storyData.transcript || `[Playing authentic voice story: "${storyData.title}"]`
                      setAnswer(storyResponse)
                      fullResponse = storyResponse
                      
                      // Play the story audio
                      try {
                        await globalAudioManager.playAudio(storyAudio)
                        console.log('🎵 ✅ Story audio played successfully')
                      } catch (audioError) {
                        console.error('🎵 ❌ Story audio playback failed:', audioError)
                        setAnswer('Story playback failed. ' + storyResponse)
                      }
                      
                      // Mark as not loading since story is playing
                      setLoading(false)
                      setPlaying(false)
                      
                      return // Exit the streaming loop since we played a story
                    }
                  } catch (parseError) {
                    console.error('🎵 Failed to parse story data:', parseError)
                  }
                }
                
                // Handle regular text deltas
                if (data.delta) {
                  fullResponse += data.delta
                  currentSentence += data.delta
                  setAnswer(fullResponse)
                  
                  // Check if we have a complete sentence
                  if (/[.!?]\s*$/.test(currentSentence.trim())) {
                    const sentence = currentSentence.trim()
                    if (sentence.length > 0) {
                      sentenceBatch += (sentenceBatch ? ' ' : '') + sentence
                      currentSentence = ''
                      
                      // Clear existing timeout
                      if (batchTimeout) {
                        clearTimeout(batchTimeout)
                      }
                      
                      // Process batch after a short delay to allow for more sentences
                      // or immediately if batch is getting long
                      if (sentenceBatch.length > 200) {
                        await processBatch()
                      } else {
                        batchTimeout = setTimeout(processBatch, 500)
                      }
                    }
                  }
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
        
        // Clear any pending timeout
        if (batchTimeout) {
          clearTimeout(batchTimeout)
        }

        // Handle any remaining text in the batch or current sentence
        if (sentenceBatch.trim().length > 0) {
          await processBatch()
        }
        
        if (currentSentence.trim().length > 0 && streamingManagerRef.current) {
          console.log('🎵 Processing final fragment:', currentSentence.trim())
          
          await enhancedErrorHandler.handleVoiceSynthesis(
            () => streamingManagerRef.current!.addSentence(currentSentence.trim()),
            async () => {
              console.log('🔄 Final sentence synthesis failed, continuing with text only')
              return Promise.resolve()
            }
          )
        }

        console.log('🎵 Streaming response complete')
        
        // Add assistant turn to conversation state with metadata
        if (conversationStateRef.current) {
          await jonathanConversationState.addConversationTurn(
            conversationStateRef.current.id,
            'assistant',
            fullResponse,
            {
              expressionsUsed: expressionPackRef.current?.expressions.map(e => e.id) || [],
              memoryFragmentsReferenced: [], // Will be populated by memory service
              processingTimeMs: Date.now() - memoryStartTime
            }
          )
        }
        
        // Store conversation turn asynchronously (Requirement 4.3)
        memoryAPI.storeConversationTurn(
          text,
          fullResponse,
          AVATAR_SLUG,
          conversationStateRef.current?.id || `jonathan-demo-${Date.now()}`
        );
        
      } else {
        // Fallback for non-streaming
        const data = await res.json().catch(() => ({}))
        const reply = data.answer || '😕 No answer.'
        setAnswer(reply)
        
        if (reply && streamingManagerRef.current) {
          // Split reply into sentences for streaming playback
          const sentences = splitIntoSentences(reply)
          for (const sentence of sentences) {
            await streamingManagerRef.current.addSentence(sentence)
          }
        }
        
        // Add assistant turn to conversation state for fallback case
        if (conversationStateRef.current) {
          await jonathanConversationState.addConversationTurn(
            conversationStateRef.current.id,
            'assistant',
            reply
          )
        }
        
        // Store conversation turn asynchronously for fallback case (Requirement 4.3)
        memoryAPI.storeConversationTurn(
          text,
          reply,
          AVATAR_SLUG,
          conversationStateRef.current?.id || `jonathan-demo-fallback-${Date.now()}`
        );
      }
    } catch (err) {
      console.error('Chat error:', err)
      
      // Handle different types of errors gracefully
      let errorMessage = 'Sorry, there was an error processing your request.'
      
      if (err && typeof err === 'object' && 'status' in err) {
        const status = (err as any).status
        if (status >= 500) {
          errorMessage = 'Service temporarily unavailable. Please try again in a moment.'
        } else if (status === 429) {
          errorMessage = 'Too many requests. Please wait a moment and try again.'
        } else if (status >= 400) {
          errorMessage = 'There was an issue with your request. Please try again.'
        }
      }
      
      setAnswer(errorMessage)
      setPlaying(false)
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

  // Test function to manually trigger expressions
  const testExpressions = async () => {
    console.log('🎭 Testing expressions manually...')
    
    if (streamingManagerRef.current) {
      // Test with text that should definitely trigger expressions
      const testTexts = [
        "That's absolutely hilarious!",
        "Hmm, let me think about that.",
        "Wow, that's amazing!",
        "I understand what you mean.",
        "That's so funny, haha!"
      ]
      
      for (const testText of testTexts) {
        console.log(`🎭 Testing: "${testText}"`)
        await streamingManagerRef.current.addSentence(testText)
        await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds between tests
      }
    } else {
      console.log('🎭 No streaming manager available for testing')
    }
  }

  // Debug function to check expression system state
  const debugExpressionSystem = () => {
    console.log('🎭 === EXPRESSION SYSTEM DEBUG ===')
    console.log('🎭 Expression pack ref:', expressionPackRef.current)
    console.log('🎭 Streaming manager ref:', streamingManagerRef.current)
    
    if (expressionPackRef.current) {
      console.log(`🎭 Expression pack has ${expressionPackRef.current.expressions.length} expressions`)
      console.log(`🎭 Expression pack has ${expressionPackRef.current.buffers.size} audio buffers`)
      expressionPackRef.current.expressions.forEach(expr => {
        console.log(`🎭   - ${expr.type}: ${expr.filename} (${expr.cdnUrl})`)
      })
    }
    
    // Test direct expression player
    if (typeof window !== 'undefined') {
      import('@/lib/services/universalExpressionService').then(({ UniversalExpressionService }) => {
        UniversalExpressionService.createExpressionPlayer(AVATAR_SLUG).then(player => {
          if (player) {
            console.log('🎭 Direct expression player test...')
            player.playExpressionsForText("That's absolutely hilarious!").then(() => {
              console.log('🎭 Direct expression test completed')
            }).catch(error => {
              console.error('🎭 Direct expression test failed:', error)
            })
          } else {
            console.log('🎭 Could not create direct expression player')
          }
        })
      })
    }
  }

  // Test function to directly test audio files
  const testAudioFiles = async () => {
    console.log('🎭 Testing audio files directly...')
    
    // Test your actual uploaded expressions
    const testFiles = [
      'https://xiftnqnwyjixwqgxqfez.supabase.co/storage/v1/object/public/expressions/avatars/jonathan-demo/jonathan_Laugh_copy_1755508777740.mp3',
      'https://xiftnqnwyjixwqgxqfez.supabase.co/storage/v1/object/public/expressions/avatars/jonathan-demo/jonathan_Sigh_1755522153865.mp3',
      'https://xiftnqnwyjixwqgxqfez.supabase.co/storage/v1/object/public/expressions/avatars/jonathan-demo/jonathan_Jeez_1755508365217.mp3'
    ]
    
    for (const file of testFiles) {
      const fileName = file.split('/').pop()
      console.log(`🎭 Testing YOUR uploaded expression: ${fileName}`)
      try {
        const audio = new Audio(file)
        audio.volume = 0.7
        await audio.play()
        console.log(`🎭 ✅ YOUR expression test passed: ${fileName}`)
        await new Promise(resolve => setTimeout(resolve, 2000)) // Wait longer to hear full expression
      } catch (error) {
        console.error(`🎭 ❌ YOUR expression test failed: ${fileName}`, error)
      }
    }
  }

  const handleReplay = async () => {
    if (!answer) return
    
    // Stop any existing audio and streaming
    await stopAllAudio()
    if (streamingManagerRef.current) {
      streamingManagerRef.current.stop()
      streamingManagerRef.current = null
    }
    
    setPlaying(true)
    
    try {
      // Initialize streaming audio manager for replay with expression pack
      const voiceId = await resolveVoiceId()
      const enhancedConfig = getEnhancedVoiceConfig()
      
      streamingManagerRef.current = createStreamingAudioManager(
        voiceId,
        enhancedConfig.voice_settings,
        undefined, // accent
        {
          conversationId: conversationStateRef.current?.id || `jonathan-demo-replay-${Date.now()}`,
          useWebAudio: true,
          enableCrossfade: true,
          expressionPack: expressionPackRef.current ? {
            expressions: expressionPackRef.current.expressions,
            buffers: expressionPackRef.current.buffers
          } : undefined
        }
      )

      console.log('🎵 Replaying with streaming audio...')
      
      // Split answer into sentences for streaming playback
      const sentences = splitIntoSentences(answer)
      for (const sentence of sentences) {
        if (streamingManagerRef.current) {
          await streamingManagerRef.current.addSentence(sentence)
        }
      }
      
    } catch (error) {
      console.error('Replay failed:', error)
      setPlaying(false)
    }
  }

  // Cross-device sync handlers
  const handleHandoffReceived = async (handoffData: any) => {
    try {
      console.log('📱 Received device handoff:', handoffData)
      
      // Stop current audio/streaming
      await stopAllAudio()
      if (streamingManagerRef.current) {
        streamingManagerRef.current.stop()
        streamingManagerRef.current = null
      }
      
      // Apply handoff data
      if (handoffData.conversationState) {
        // Update conversation state
        const newState = handoffData.conversationState
        if (conversationStateRef.current) {
          conversationStateRef.current.currentTurn = newState.currentTurn
          conversationStateRef.current.lastMessage = newState.lastMessage
        }
      }
      
      // Restore audio state if provided
      if (handoffData.audioState && handoffData.audioState.isPlaying) {
        // Resume audio from the position where it was handed off
        if (handoffData.audioState.queuedAudio && handoffData.audioState.queuedAudio.length > 0) {
          // Recreate streaming manager with optimal settings for this device
          const voiceId = await resolveVoiceId()
          const voiceConfig = getEnhancedVoiceConfig(voiceId)
          
          streamingManagerRef.current = createStreamingAudioManager(
            voiceConfig,
            expressionPackRef.current || undefined
          )
          
          // Resume from where we left off
          // Note: This is a simplified implementation - in practice you'd need
          // to handle partial audio playback and queue restoration
          console.log('📱 Resuming audio from handoff position:', handoffData.audioState.currentPosition)
        }
      }
      
      // Update memory context
      if (handoffData.memoryContext) {
        console.log('📱 Restored memory context from handoff')
      }
      
      // Show success notification
      enhancedErrorHandler.showToast('Conversation continued from other device', 'success')
      
    } catch (error) {
      console.error('Failed to handle device handoff:', error)
      enhancedErrorHandler.showToast('Failed to continue conversation from other device', 'error')
    }
  }

  const handleSyncUpdate = async (update: any) => {
    try {
      console.log('🔄 Received sync update:', update.type, update)
      
      switch (update.type) {
        case 'message':
          // Another device sent a message - update our conversation state
          if (update.data && conversationStateRef.current) {
            conversationStateRef.current.currentTurn = update.data.turn || conversationStateRef.current.currentTurn + 1
            conversationStateRef.current.lastMessage = update.data
            
            // Update UI if needed
            if (update.data.sender === 'user') {
              setQuestion(update.data.content)
            } else if (update.data.sender === 'assistant') {
              setAnswer(update.data.content)
            }
          }
          break
          
        case 'turn_complete':
          // Another device completed a conversation turn
          console.log('🔄 Conversation turn completed on another device')
          break
          
        case 'device_join':
          console.log('📱 New device joined conversation:', update.data?.deviceType)
          break
          
        case 'device_leave':
          console.log('📱 Device left conversation:', update.deviceId)
          break
          
        case 'handoff':
          // Handoff was initiated - if we're the source device, we should pause
          if (update.data?.sourceDevice === crossDeviceSyncService['deviceId']) {
            console.log('📱 Handoff initiated from this device, pausing...')
            await stopAllAudio()
            if (streamingManagerRef.current) {
              streamingManagerRef.current.stop()
            }
            setPlaying(false)
          }
          break
      }
      
    } catch (error) {
      console.error('Failed to handle sync update:', error)
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
                {!playing && !loading && (
                  <button onClick={handleReplay} className="play-btn">
                    🔊 Play Again
                  </button>
                )}
                <button onClick={testExpressions} className="play-btn" style={{marginLeft: '10px'}}>
                🎭 Test Expressions
              </button>
              <button onClick={testAudioFiles} className="play-btn" style={{marginLeft: '10px'}}>
                🎵 Test YOUR Expressions
              </button>
              <button onClick={debugExpressionSystem} className="play-btn" style={{marginLeft: '10px'}}>
                🔍 Debug Expressions
              </button>
              <button onClick={() => {
                console.log('🎭 Testing direct expression trigger...')
                if (streamingManagerRef.current) {
                  // Test with exact keywords from your expressions
                  streamingManagerRef.current.addSentence("That's absolutely hilarious and funny!")
                } else {
                  console.log('🎭 No streaming manager available')
                }
              }} className="play-btn" style={{marginLeft: '10px'}}>
                🎭 Test Direct
              </button>
              {(playing || (streamingManagerRef.current?.isPlaying())) && (
                  <div className="status-info">🔊 Playing audio...</div>
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

          {/* Expression Manager Section */}
          <div className="expression-manager-section">
            <button 
              className="expression-manager-toggle"
              onClick={() => setShowExpressionManager(!showExpressionManager)}
              type="button"
            >
              <span className="toggle-icon">{showExpressionManager ? '▼' : '▶'}</span>
              <span className="toggle-text">Manage Voice Expressions</span>
              <span className="toggle-subtitle">Upload and customize Jonathan's vocal expressions</span>
            </button>
            
            {showExpressionManager && (
              <div className="expression-manager-content">
                <SimpleExpressionManager 
                  userId={`jonathan-demo-user-${Date.now()}`}
                  avatarId={AVATAR_SLUG}
                  onExpressionUpdate={() => {
                    // Reload expression pack when expressions are updated
                    if (expressionPackRef.current) {
                      ExpressionPackService.loadExpressionPack(AVATAR_SLUG, 'avatar')
                        .then(pack => {
                          expressionPackRef.current = pack
                          console.log('🎵 Expression pack reloaded after update')
                        })
                        .catch(err => console.warn('Failed to reload expression pack:', err))
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Analytics Dashboard Section */}
          <div className="analytics-dashboard-section">
            <button 
              className="analytics-dashboard-toggle"
              onClick={() => setShowAnalyticsDashboard(!showAnalyticsDashboard)}
              type="button"
            >
              <span className="toggle-icon">{showAnalyticsDashboard ? '▼' : '▶'}</span>
              <span className="toggle-text">Conversation Analytics</span>
              <span className="toggle-subtitle">View conversation insights, A/B tests, and optimization suggestions</span>
            </button>
            
            {showAnalyticsDashboard && (
              <div className="analytics-dashboard-content">
                <ConversationAnalyticsDashboard 
                  conversationId={conversationStateRef.current?.id}
                  userId={`jonathan-demo-user-${Date.now()}`}
                  sessionId={sessionIdRef.current || undefined}
                />
              </div>
            )}
          </div>
        </main>
        
        {/* Cross-Device Synchronization */}
        {crossDeviceSyncEnabled && conversationStateRef.current && (
          <CrossDeviceSync
            conversationId={conversationStateRef.current.id}
            userId={userId}
            onHandoffReceived={handleHandoffReceived}
            onSyncUpdate={handleSyncUpdate}
          />
        )}
        
        {/* Toast notifications for error handling and degradation */}
        <ToastNotifications />
      </PageShell>
    </ProfileProvider>
  )
}