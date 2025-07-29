'use client'


import React, { useState, useRef, useEffect } from 'react'
import { ConversationService, ChatMessage as ConversationMessage } from '@/lib/conversationService'
import { MemorySavedAnimation } from './MemorySavedAnimation';
import { 
  createStreamingAudioManager, 
  splitIntoSentences,
  splitIntoPhrases, 
  streamChatResponse,
  StreamingAudioManager,
  stopAllAudio
} from '@/lib/streamingUtils';
import { splitTextForConsistentVoice } from '@/lib/voiceConsistency';
import { globalAudioManager } from '@/lib/globalAudioManager';
import { getUnifiedVoiceSettings } from '@/lib/unifiedVoiceConfig';

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

interface ChatInterfaceProps {
  profileData: any // user profile JSON
  voiceId: string | null
  accent?: string | null
  userId?: string // user ID for memory operations
  avatarId?: string // avatar ID for memory isolation
  initialMessages?: ChatMessage[]
  onAsk?: (question: string) => void
  visitorName?: string // Name of the visitor for shared avatars
  isSharedAvatar?: boolean // Whether this is a shared avatar session
  shareToken?: string // Share token for shared avatar sessions
  voiceSettings?: any // Optimized voice settings for this avatar
}

export default function ChatInterface({
  profileData,
  voiceId,
  accent = null,
  userId,
  avatarId,
  initialMessages = [],
  onAsk,
  visitorName,
  isSharedAvatar = false,
  shareToken,
  voiceSettings,
}: ChatInterfaceProps) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [conversationLoading, setConversationLoading] = useState(true)
  const [listening, setListening] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [hasSpeechRecognition, setHasSpeechRecognition] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [isSafari, setIsSafari] = useState(false)
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown')
  const [lastMemory, setLastMemory] = useState<string | null>(null);
  const [showMemoryAnim, setShowMemoryAnim] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [audioInterrupted, setAudioInterrupted] = useState(false);
  const userMsgRef = useRef<HTMLDivElement>(null);
  const streamingAudioRef = useRef<StreamingAudioManager | null>(null);

  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioUrlRef = useRef<string | null>(null)

  // Debug logging
  useEffect(() => {
    console.log('[ChatInterface] Profile data:', profileData)
    console.log('[ChatInterface] Voice ID:', voiceId)
    console.log('[ChatInterface] Avatar ID:', avatarId)
  }, [profileData, voiceId, avatarId])

  // Cleanup streaming audio on unmount
  useEffect(() => {
    return () => {
      globalAudioManager.stopAll();
      if (streamingAudioRef.current) {
        streamingAudioRef.current.stop();
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  // Load conversation when component mounts
  useEffect(() => {
    if (userId) {
      loadConversation()
    }
  }, [userId, avatarId]) // Add avatarId as dependency to reload when avatar changes
  
  // Check if this is a shared avatar conversation by ID format (legacy check)
  const isSharedAvatarByUserId = userId?.toString().includes('shared_') || false;

  const loadConversation = async () => {
    if (!userId) return
    
    setConversationLoading(true)
    try {
      if (isSharedAvatar || isSharedAvatarByUserId) {
        // For shared avatars, use the private-conversations API
        const response = await fetch(`/api/private-conversations?userId=${userId}&avatarId=${avatarId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.conversations && data.conversations.length > 0) {
            // Get the most recent conversation for this avatar
            const mostRecentConversation = data.conversations[0];
            setConversationId(mostRecentConversation.id || null);
            setMessages(mostRecentConversation.messages?.map((msg: any) => ({
              role: msg.role,
              content: msg.content
            })) || []);
          }
        }
      } else {
        // For regular avatars, use the ConversationService
        const conversation = await ConversationService.getCurrentConversation(userId, avatarId)
        if (conversation) {
          setConversationId(conversation.id || null)
          setMessages(conversation.messages || [])
        }
      }
    } catch (error) {
      console.error('Failed to load conversation:', error)
    } finally {
      setConversationLoading(false)
    }
  }

  const saveMessage = async (newMessage: ChatMessage) => {
    if (!userId) return

    try {
      if (isSharedAvatar || isSharedAvatarByUserId) {
        // For shared avatars, use the private-conversations API
        const response = await fetch('/api/private-conversations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'add-message',
            conversationId: conversationId || undefined,
            userId,
            avatarId,
            shareToken,
            message: {
              role: newMessage.role,
              content: newMessage.content
            }
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.conversationId) {
            setConversationId(data.conversationId);
          }
        }
      } else {
        // For regular avatars, use the ConversationService
        const result = await ConversationService.addMessage(
          userId, 
          newMessage, 
          conversationId || undefined,
          avatarId // Pass avatarId to ensure conversation is associated with this avatar
        )
        if (result.success && result.conversationId) {
          setConversationId(result.conversationId)
        }
      }
    } catch (error) {
      console.error('Failed to save message:', error)
    }
  }

  useEffect(() => {
    setIsClient(true)
    
    // Detect Safari more accurately
    const userAgent = navigator.userAgent.toLowerCase()
    const isSafariBrowser = userAgent.includes('safari') && !userAgent.includes('chrome') && !userAgent.includes('chromium')
    setIsSafari(isSafariBrowser)
    
    console.log('Browser detection:', { 
      userAgent, 
      isSafariBrowser, 
      hasMediaDevices: !!navigator.mediaDevices,
      hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      hasMediaRecorder: !!window.MediaRecorder
    })
    
    // Check speech recognition support
    const speechRecognitionSupported = !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    )
    setHasSpeechRecognition(speechRecognitionSupported)
    
    console.log('Speech recognition support:', speechRecognitionSupported)

    // Check microphone permissions
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' as PermissionName })
        .then(result => {
          console.log('Microphone permission:', result.state)
          setMicPermission(result.state)
          result.onchange = () => {
            console.log('Microphone permission changed:', result.state)
            setMicPermission(result.state)
          }
        })
        .catch((err) => {
          console.log('Permission query failed:', err)
          setMicPermission('unknown')
        })
    } else {
      console.log('Permissions API not supported')
    }
  }, [])

  // Play audio blob helper
  const playAudioBlob = async (blob: Blob) => {
    // Stop streaming audio if it's playing
    if (streamingAudioRef.current) {
      streamingAudioRef.current.stop();
    }
    
    // Wait for all audio to stop before playing new audio
    await globalAudioManager.stopAll();
    
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    const url = URL.createObjectURL(blob)
    audioUrlRef.current = url
    const audio = new Audio(url)
    
    // Speed up the audio for better flow
    audio.playbackRate = 1.15;
    audio.volume = 1.0;
    
    setPlaying(true)
    
    try {
      // Use global audio manager to prevent overlaps
      await globalAudioManager.playAudio(audio);
      setPlaying(false);
    } catch (error) {
      console.error('Audio playback failed:', error);
      setPlaying(false);
    } finally {
      URL.revokeObjectURL(url);
      audioUrlRef.current = null;
    }
  }

  // Compose profile context string for prompt
  const buildProfileContext = () => {
    if (!profileData) return ''
    return Object.entries(profileData)
      .map(([section, answers]: [string, any]) => {
        return `${section}:\n` + Object.entries(answers)
          .map(([key, value]) => `- ${key}: ${value}`)
          .join('\n')
      })
      .join('\n\n')
  }

  // Ask question logic with streaming support
  const askQuestion = async (text: string) => {
    if (!text.trim()) return
    
    // Stop all existing audio first to prevent overlaps - with proper coordination
    const wasPlaying = globalAudioManager.getIsPlaying() || (streamingAudioRef.current?.isPlaying());
    
    // Stop streaming audio first
    if (streamingAudioRef.current) {
      streamingAudioRef.current.stop();
    }
    
    // Then stop all other audio and wait for it to complete
    await globalAudioManager.stopAll();
    
    if (wasPlaying) {
      setAudioInterrupted(true);
      setTimeout(() => setAudioInterrupted(false), 2000);
    }
    
    setPlaying(false);
    
    setLoading(true)
    setAnswer('')
    setStreamingText('')
    setIsStreaming(true)

    const userMessage: ChatMessage = { role: 'user', content: text }
    const newHistory: ChatMessage[] = [...messages, userMessage]
    setMessages(newHistory)
    setQuestion('')

    // Save user message
    await saveMessage(userMessage)

    if (onAsk) {
      onAsk(text)
      setLoading(false)
      setIsStreaming(false)
      return
    }

    try {
              // Initialize streaming audio manager with unified voice settings for profile
        if (voiceId) {
          const profileSettings = voiceSettings || getUnifiedVoiceSettings('profile');
          streamingAudioRef.current = createStreamingAudioManager(
            voiceId || '',
            profileSettings,
            accent || undefined,
            {
              conversationId: conversationId || `${userId}-${avatarId}` // Use conversation ID for consistent voice
            }
          );
        
        // Add immediate interjection to fill dead air (300-600ms delay)
        setTimeout(() => {
          if (streamingAudioRef.current && !streamingAudioRef.current.isPlaying()) {
            streamingAudioRef.current.interject();
          }
        }, 400);

        // Add thinking sound if response takes too long (800ms+)
        setTimeout(() => {
          if (streamingAudioRef.current && !hasStartedSpeaking) {
            streamingAudioRef.current.addThinkingSound();
          }
        }, 800);
      }

      let fullResponse = '';
      let lastPhraseCount = 0;
      let hasStartedSpeaking = false;

      // Stream the response
      for await (const char of streamChatResponse(text, newHistory, profileData, {
        userId,
        avatarId,
        visitorName,
        isSharedAvatar,
        shareToken,
        voiceId: voiceId || undefined
      })) {
        fullResponse += char;
        setStreamingText(fullResponse);

        // Check for new segments every 50 characters for better voice consistency
        if (fullResponse.length % 50 === 0 && fullResponse.length > 30) {
          const segments = splitTextForConsistentVoice(fullResponse);
          
          // Process any new complete segments since last check
          if (segments.length > lastPhraseCount && streamingAudioRef.current) {
            // Process all complete segments (excluding the last potentially incomplete one)
            const endIndex = segments.length > 1 ? segments.length - 1 : segments.length;
            for (let i = lastPhraseCount; i < endIndex; i++) {
              const segment = segments[i].trim();
              if (segment && !segment.match(/\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr)\.$/) && segment.length > 10) {
                console.log('[ChatInterface] New segment detected:', segment.substring(0, 50) + '...');
                
                // Use addSentence for consistent voice generation
                streamingAudioRef.current.addSentence(segment);
                hasStartedSpeaking = true;
              }
            }
            lastPhraseCount = endIndex;
          }
        }
      }

      // Process any remaining segments from the complete response
      if (fullResponse.trim() && streamingAudioRef.current) {
        const segments = splitTextForConsistentVoice(fullResponse);
        console.log(`[ChatInterface] Processing ${segments.length} segments from complete response`);
        
        // Process any segments we might have missed
        for (let i = lastPhraseCount; i < segments.length; i++) {
          const segment = segments[i].trim();
          if (segment && segment.length > 8) {
            console.log('[ChatInterface] Final segment:', segment.substring(0, 50) + '...');
            streamingAudioRef.current.addSentence(segment);
          }
        }
      }

      setAnswer(fullResponse);
      setIsStreaming(false);

      const assistantMessage: ChatMessage = { role: 'assistant', content: fullResponse }
      const safeHistory: ChatMessage[] = [
        ...newHistory,
        assistantMessage,
      ].filter((m): m is ChatMessage => m.role === 'user' || m.role === 'assistant')
      setMessages(safeHistory)

      // Save assistant message
      await saveMessage(assistantMessage)

      // Memory processing happens in the streaming API, but we can still check for UI updates
      try {
        const memoryResponse = await fetch(`/api/memories?userId=${userId}&avatarId=${avatarId}`);
        if (memoryResponse.ok) {
          const memoryData = await memoryResponse.json();
          if (memoryData.memories && memoryData.memories.length > 0) {
            const newest = memoryData.memories[0].fragmentText || memoryData.memories[0].fragment_text || memoryData.memories[0].content || '';
            if (newest && newest !== lastMemory) {
              console.log('💭 Triggering memory animation for:', newest.substring(0, 50) + '...');
              setLastMemory(newest);
              setShowMemoryAnim(true);
              setTimeout(() => setShowMemoryAnim(false), 1400);
            }
          }
        }
      } catch (memoryError) {
        console.warn('Failed to fetch updated memories:', memoryError);
      }

    } catch (err: any) {
      console.error('Streaming chat error:', err);
      setAnswer('Error: ' + (err.message || err));
      setIsStreaming(false);
      
      // Fallback to non-streaming mode
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: text,
            history: newHistory,
            profileData,
            voiceId,
            userId,
            avatarId,
            visitorName,
            isSharedAvatar,
            shareToken,
            stream: false // Explicitly disable streaming for fallback
          }),
        });

        const data = await res.json();
        const aiAnswer = data.answer || '😕 No answer.';
        setAnswer(aiAnswer);

        const assistantMessage: ChatMessage = { role: 'assistant', content: aiAnswer };
        const safeHistory: ChatMessage[] = [
          ...newHistory,
          assistantMessage,
        ].filter((m): m is ChatMessage => m.role === 'user' || m.role === 'assistant');
        setMessages(safeHistory);

        await saveMessage(assistantMessage);

        // Play voice for fallback response
        if (aiAnswer && voiceId) {
          try {
            const vr = await fetch('/api/voice', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                text: aiAnswer, 
                voiceId,
                accent,
                settings: voiceSettings || getUnifiedVoiceSettings('profile')
              }),
            });
            if (vr.ok) {
              const blob = await vr.blob();
              if (blob.size > 0) {
                playAudioBlob(blob);
              }
            }
          } catch (voiceError) {
            console.warn('Voice synthesis failed:', voiceError);
          }
        }
      } catch (fallbackError) {
        console.error('Fallback request also failed:', fallbackError);
      }
    } finally {
      setLoading(false);
      setIsStreaming(false);
    }
  }

  // Form submit handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    askQuestion(question)
  }

  // Speech Recognition / Recording handlers
  const startWebSpeech = () => {
    const Rec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Rec) return alert('Speech recognition not supported')
    
    const recog = new Rec()
    recognitionRef.current = recog
    recog.continuous = false
    recog.interimResults = false
    recog.lang = 'en-US'
    
    // Safari-specific settings
    if (isSafari) {
      recog.maxAlternatives = 1
    }
    
    recog.onstart = () => setListening(true)
    
    recog.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript.trim()
      if (transcript) {
        recog.stop()
        setListening(false)
        setQuestion(transcript)
        askQuestion(transcript)
      }
    }
    
    recog.onerror = (e: any) => {
      console.error('Speech recognition error:', e.error)
      setListening(false)
      
      if (e.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone access in your browser settings.')
      } else if (e.error === 'no-speech') {
        // Don't alert for no-speech, just stop listening
        console.log('No speech detected')
      } else {
        console.warn('Speech recognition error:', e.error)
      }
    }
    
    recog.onend = () => setListening(false)
    
    try {
      recog.start()
    } catch (err) {
      console.error('Failed to start speech recognition:', err)
      setListening(false)
    }
  }

  const startRecording = async () => {
    try {
      // Safari-specific audio constraints for better compatibility
      const constraints = {
        audio: isSafari ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } : true
      }
      
      console.log('Requesting microphone access...', { isSafari, constraints })
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      console.log('Microphone access granted', stream)
      mediaStreamRef.current = stream
      
      // Check if MediaRecorder is supported
      if (!window.MediaRecorder) {
        throw new Error('MediaRecorder not supported')
      }
      
      // Safari prefers different MIME types - be more aggressive about finding supported format
      let mimeType = 'audio/webm'
      if (isSafari) {
        const safariTypes = ['audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg']
        mimeType = safariTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'audio/wav'
        console.log('Safari using MIME type:', mimeType)
      }
      
      const options = MediaRecorder.isTypeSupported(mimeType) ? { mimeType } : {}
      console.log('Creating MediaRecorder with options:', options)
      
      const mr = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mr
      setListening(true)
      
      const chunks: Blob[] = []
      
      mr.ondataavailable = (e: BlobEvent) => {
        console.log('Data available:', e.data.size)
        if (e.data.size) chunks.push(e.data)
      }
      
      mr.onstop = async () => {
        console.log('Recording stopped, chunks:', chunks.length)
        setListening(false)
        
        // Clean up the media stream
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => {
            console.log('Stopping track:', track.kind, track.readyState)
            track.stop()
          })
          mediaStreamRef.current = null
        }
        
        if (chunks.length === 0) {
          console.warn('No audio chunks recorded')
          return
        }
        
        const blob = new Blob(chunks, { type: mimeType })
        console.log('Created blob:', blob.size, blob.type)
        
        if (!blob.size) {
          console.warn('Empty audio blob')
          return
        }
        
        const form = new FormData()
        form.append('audio', blob, `recording.${mimeType.split('/')[1]}`)
        
        try {
          console.log('Sending transcription request...')
          const r = await fetch('/api/transcribe', { method: 'POST', body: form })
          const { transcript, error } = await r.json()
          console.log('Transcription response:', { transcript, error })
          
          if (!error && transcript?.trim()) {
            setQuestion(transcript)
            askQuestion(transcript)
          } else {
            console.warn('Transcription failed:', error)
            alert('Could not transcribe audio. Please try speaking more clearly or check your microphone.')
          }
        } catch (err) {
          console.error('Transcription request failed:', err)
          alert('Failed to process audio. Please try again.')
        }
      }
      
      mr.onerror = (e) => {
        console.error('MediaRecorder error:', e)
        setListening(false)
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop())
          mediaStreamRef.current = null
        }
        alert('Recording error occurred. Please try again.')
      }
      
      mr.onstart = () => {
        console.log('Recording started')
      }
      
      // Start recording with Safari-friendly settings
      console.log('Starting MediaRecorder...')
      if (isSafari) {
        mr.start(1000) // Safari works better with timeslice
      } else {
        mr.start()
      }
      
      // Shorter timeout for Safari
      const timeout = isSafari ? 8000 : 10000
      setTimeout(() => {
        if (mr.state === 'recording') {
          console.log('Auto-stopping recording after timeout')
          mr.stop()
        }
      }, timeout)
      
    } catch (err: any) {
      setListening(false)
      console.error('Recording error:', err)
      
      // More specific error messages for Safari
      if (err.name === 'NotAllowedError') {
        if (isSafari) {
          alert('Microphone access denied. Please:\n1. Click the microphone icon in Safari\'s address bar\n2. Or go to Safari → Settings → Websites → Microphone\n3. Allow access for this site')
        } else {
          alert('Microphone access denied. Please allow microphone access and try again.')
        }
      } else if (err.name === 'NotFoundError') {
        alert('No microphone found. Please check your device settings.')
      } else if (err.name === 'NotSupportedError' || err.message.includes('MediaRecorder')) {
        alert('Audio recording not supported on this browser. Please try using Chrome or Firefox.')
      } else {
        alert('Microphone error: ' + (err.message || 'Unknown error'))
      }
    }
  }

  const stopAllRecording = () => {
    setListening(false)
    recognitionRef.current?.stop()
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    // Clean up the media stream immediately when stopping
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
  }

  const handleMicClick = async () => {
    if (listening) {
      stopAllRecording()
      return
    }

    // Safari-specific permission check
    if (isSafari && micPermission === 'denied') {
      alert('Microphone access is denied. Please go to Safari Settings → Privacy & Security → Microphone and enable access for this website.')
      return
    }

    // For Safari, always try MediaRecorder first as Speech Recognition is unreliable
    if (isSafari) {
      try {
        await startRecording()
      } catch (error) {
        console.error('Safari recording failed, trying speech recognition:', error)
        if (hasSpeechRecognition) {
          startWebSpeech()
        }
      }
    } else {
      // For other browsers, prefer Speech Recognition
      if (hasSpeechRecognition) {
        startWebSpeech()
      } else {
        startRecording()
      }
    }
  }

  const handleReplay = async () => {
    if (!answer) return
    
    // Stop any streaming audio first
    if (streamingAudioRef.current) {
      streamingAudioRef.current.stop();
    }
    
    // Wait for all audio to stop
    await globalAudioManager.stopAll();
    
    setPlaying(true)
    try {
      const vr = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: answer, 
          voiceId,
          settings: voiceSettings || getUnifiedVoiceSettings('profile')
        }),
      })
      const blob = await vr.blob()
      await playAudioBlob(blob)
    } catch {
      setPlaying(false)
    }
  }

  const handleClearConversation = async () => {
    if (!confirm('Are you sure you want to clear this conversation and all associated memories? This action cannot be undone.')) {
      return
    }

    try {
      setLoading(true)

      // Clear conversation history
      if (conversationId && userId) {
        try {
          await ConversationService.clearConversation(userId, conversationId)
        } catch (error) {
          console.error('Failed to clear conversation:', error)
        }
      }

      // Clear associated memories
      if (userId) {
        try {
          const response = await fetch('/api/memories', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId })
          })

          if (!response.ok) {
            console.error('Failed to clear memories:', response.statusText)
          }
        } catch (error) {
          console.error('Failed to clear memories:', error)
        }
      }

      // Clear local state
      setMessages([])
      setConversationId(null)
      setAnswer('')
      
      console.log('✅ Conversation and memories cleared successfully')

    } catch (error) {
      console.error('Error clearing conversation:', error)
      alert('Failed to clear conversation. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-start w-screen bg-transparent pt-8 box-border">
      <div className="text-center mb-6 select-none">
        <img
          src="/echostone_logo.png"
          alt="EchoStone Logo"
          width={140}
          height={140}
          className="logo-pulse select-none"
          draggable={false}
        />
      </div>
      <h1 className="text-center my-3 mb-8 text-4xl font-bold">
        Speak with {getFirstName(profileData)}
      </h1>

      <div className="chat-input-container" style={{ position: 'relative' }}>
        <form className="ask-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Ask me anything…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          <button type="submit" disabled={loading}>
            {loading ? '…' : '→'}
          </button>
        </form>
        
        {/* Memory Animation - positioned to leap from the input bar */}
        {showMemoryAnim && lastMemory && (
          <>
            {console.log('🎬 Rendering memory animation:', lastMemory.substring(0, 50) + '...')}
            <MemorySavedAnimation text={lastMemory} />
          </>
        )}
      </div>

      <button
        className={`mic-btn${listening ? ' active' : ''}`}
        onClick={handleMicClick}
        type="button"
      >
        {listening ? '🎤 Listening… (tap to stop)' : '🎤 Speak'}
      </button>

      {/* Safari Debug Info */}
      {isClient && isSafari && (
        <div className="text-xs opacity-70 my-2 text-center select-none bg-yellow-900/20 p-2 rounded">
          <div>Safari Debug Info:</div>
          <div>MediaRecorder: {window.MediaRecorder ? '✅' : '❌'}</div>
          <div>getUserMedia: {(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') ? '✅' : '❌'}</div>
          <div>Permission: {micPermission}</div>
          <div>Speech Recognition: {hasSpeechRecognition ? '✅' : '❌'}</div>
        </div>
      )}

      {isClient && (
        <div className="text-xs opacity-70 my-2 text-center select-none">
          {isSafari && micPermission === 'denied' && (
            <div className="text-red-400 mb-2">
              Microphone access denied. Please enable in Safari Settings → Privacy & Security → Microphone
            </div>
          )}
          {hasSpeechRecognition
            ? `Speech recognition supported${isSafari ? ' (Safari optimized)' : ''}.`
            : `Voice will be transcribed after recording${isSafari ? ' (Safari compatible mode)' : ''}.`}
          {isSafari && (
            <div className="text-xs mt-1 opacity-60">
              For best results on Safari: speak clearly and wait for the microphone to stop before speaking again.
            </div>
          )}
        </div>
      )}

      {messages.length > 0 && (
        <div className="chat-history" style={{ maxWidth: '700px', width: '100%', marginTop: '40px' }}>
          {/* Clear conversation button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ color: '#9b7cff', margin: 0 }}>Recent Conversation</h3>
            <button
              onClick={handleClearConversation}
              style={{
                background: 'rgba(255, 71, 71, 0.2)',
                border: '1px solid rgba(255, 71, 71, 0.5)',
                borderRadius: '8px',
                padding: '8px 16px',
                color: '#ff9999',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(255, 71, 71, 0.3)'
                e.currentTarget.style.borderColor = 'rgba(255, 71, 71, 0.8)'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(255, 71, 71, 0.2)'
                e.currentTarget.style.borderColor = 'rgba(255, 71, 71, 0.5)'
              }}
            >
              🗑️ Clear Chat & Memories
            </button>
          </div>
          
          {/* Show streaming response if active */}
          {isStreaming && streamingText && (
            <div className="message-pair" style={{ marginBottom: '32px', position: 'relative' }}>
              <div className="assistant-answer" style={{
                background: 'rgba(30, 23, 57, 0.8)',
                borderRadius: '16px',
                padding: '20px',
                borderLeft: '4px solid #6a41f1',
                opacity: 0.9
              }}>
                <h3 style={{ margin: '0 0 12px 0', color: '#9b7cff', fontSize: '18px', fontWeight: '600' }}>
                  {getFirstName(profileData)} says:
                  <span style={{ 
                    marginLeft: '8px', 
                    fontSize: '14px', 
                    opacity: 0.7,
                    fontWeight: 'normal'
                  }}>
                    (streaming...)
                  </span>
                </h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#e2e2f6', lineHeight: '1.6' }}>
                  {streamingText}
                  <span className="streaming-cursor" style={{
                    display: 'inline-block',
                    width: '2px',
                    height: '20px',
                    backgroundColor: '#9b7cff',
                    marginLeft: '2px',
                    animation: 'blink 1s infinite'
                  }}>|</span>
                </p>
                <div style={{ 
                  fontSize: '12px', 
                  color: '#9b7cff', 
                  opacity: 0.7,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div className="streaming-indicator">
                    <div className="streaming-dot"></div>
                    <div className="streaming-dot"></div>
                    <div className="streaming-dot"></div>
                  </div>
                  Speaking as text arrives...
                </div>
              </div>
            </div>
          )}

          {/* Display messages in reverse order (newest first) */}
          {messages.slice(-6).reverse().map((msg, idx) => {
            const originalIdx = messages.length - 1 - idx // Calculate original index for play button
            return (
              <div key={`${messages.length - idx}`} className="message-pair" style={{ marginBottom: '32px', position: 'relative' }}>
                {msg.role === 'user' && (
                  <div
                    className="user-question"
                    ref={idx === 0 ? userMsgRef : undefined}
                    style={{
                      background: 'rgba(147, 71, 255, 0.2)',
                      borderRadius: '16px',
                      padding: '16px 20px',
                      marginBottom: '12px',
                      borderLeft: '4px solid #9147ff',
                      position: 'relative',
                      overflow: 'visible',
                    }}
                  >
                    <h3 style={{ margin: '0 0 8px 0', color: '#9147ff', fontSize: '16px', fontWeight: '600' }}>
                      You asked:
                    </h3>
                    <p style={{ margin: '0', fontSize: '16px', color: '#e2e2f6' }}>
                      {msg.content}
                    </p>

                  </div>
                )}
                {msg.role === 'assistant' && (
                  <div className="assistant-answer" style={{
                    background: 'rgba(30, 23, 57, 0.8)',
                    borderRadius: '16px',
                    padding: '20px',
                    borderLeft: '4px solid #6a41f1'
                  }}>
                    <h3 style={{ margin: '0 0 12px 0', color: '#9b7cff', fontSize: '18px', fontWeight: '600' }}>
                      {getFirstName(profileData)} says:
                    </h3>
                    <p style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#e2e2f6', lineHeight: '1.6' }}>
                      {msg.content}
                    </p>
                    {idx === 0 && !playing && !isStreaming && ( // Show play button only for the most recent message when not streaming
                      <button onClick={handleReplay} className="play-btn">
                        🔊 Play Again
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {(playing || (streamingAudioRef.current?.isPlaying())) && (
        <div className="soundbars">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="soundbar" />
          ))}
        </div>
      )}

      {voiceError && (
        <div className="text-red-400 text-sm mt-2">
          {voiceError}
        </div>
      )}

      {audioInterrupted && (
        <div className="text-yellow-400 text-sm mt-2 opacity-75">
          🔇 Previous audio stopped to prevent overlap
        </div>
      )}
    </main>
  )
}