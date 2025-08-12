'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import HeyGenAvatar from '@/components/HeyGenAvatar';
import { stopAllSeamlessAudio, SeamlessStreamingManager } from '@/lib/seamlessStreamingUtils';
import { AdvancedAudioManager } from '@/lib/advancedAudioManager';
import styles from './AvatarDemo.module.css';

// State machine for conversation flow
type ConversationState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';
type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

interface VoiceState {
  isEnabled: boolean;
  isListening: boolean;
  currentTranscript: string;
  interimTranscript: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export default function AvatarDemo() {
  // Core state
  const [conversationState, setConversationState] = useState<ConversationState>('idle');
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [retryCount, setRetryCount] = useState(0);
  const [heygenConnected, setHeygenConnected] = useState(false);

  // Debug connection state changes
  const setConnectionStateWithLogging = useCallback((newState: ConnectionState) => {
    console.log('🔗 Connection state changing:', connectionState, '->', newState);
    setConnectionState(newState);
  }, [connectionState]);

  // Voice state
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isEnabled: false,
    isListening: false,
    currentTranscript: '',
    interimTranscript: ''
  });

  // Conversation data
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState('');

  // Refs for cleanup and control
  const audioManagerRef = useRef<AdvancedAudioManager | null>(null);
  const streamingAudioRef = useRef<SeamlessStreamingManager | null>(null);
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processingAbortRef = useRef<AbortController | null>(null);
  const isComponentMountedRef = useRef(true);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  // Speech recognition support
  const hasSpeechRecognition = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition;
  }, []);

  // Computed states - use our reliable state tracking
  const isAvatarReady = connectionState === 'connected' || heygenConnected;
  const canUseVoice = isAvatarReady && hasSpeechRecognition;

  // Quick questions with emojis for better UX
  const quickQuestions = useMemo(() => [
    { text: "Tell me about your partner Krissy", emoji: "💕" },
    { text: "What's your dog Romeo like?", emoji: "🐕" },
    { text: "How do you like living in Sofia?", emoji: "🏙️" },
    { text: "What was Austin like?", emoji: "🤠" },
    { text: "Tell me about Echostone", emoji: "🚀" },
    { text: "What do you think about AI?", emoji: "🤖" }
  ], []);

  // Status text based on state
  const statusText = useMemo(() => {
    switch (connectionState) {
      case 'connecting':
        return 'Connecting to Jonathan...';
      case 'error':
        return 'Connection failed';
      case 'disconnected':
        return 'Disconnected';
      case 'connected':
        switch (conversationState) {
          case 'listening': return 'I\'m listening...';
          case 'processing': return 'Jonathan is thinking...';
          case 'speaking': return 'Jonathan is responding (mic muted)...';
          case 'error': return 'Something went wrong';
          default: 
            if (voiceState.isListening) return 'I\'m listening...';
            return voiceState.isEnabled ? 'Voice activated - just speak!' : 'Ready to chat';
        }
    }
  }, [connectionState, conversationState, voiceState.isEnabled, voiceState.isListening]);

  // Current display text
  const displayText = useMemo(() => {
    if (voiceState.interimTranscript) return voiceState.interimTranscript;
    if (voiceState.currentTranscript) return voiceState.currentTranscript;
    return '';
  }, [voiceState.interimTranscript, voiceState.currentTranscript]);
  // Initialize advanced audio manager
  useEffect(() => {
    const initAudio = async () => {
      if (!audioManagerRef.current && isComponentMountedRef.current) {
        console.log('🎤 Creating new AdvancedAudioManager...');
        audioManagerRef.current = new AdvancedAudioManager();
        
        // Set up callbacks
        audioManagerRef.current.onTranscript((transcript, isFinal) => {
          if (!isComponentMountedRef.current) return;
          
          if (isFinal && transcript.length > 2) {
            console.log('🎤 Final transcript:', transcript);
            setVoiceState(prev => ({
              ...prev,
              currentTranscript: transcript,
              interimTranscript: '',
              isListening: false // Stop listening when we get final transcript
            }));
            setConversationState('processing'); // Move to processing state
            processUserInput(transcript);
          } else {
            setVoiceState(prev => ({
              ...prev,
              interimTranscript: transcript
            }));
          }
        });

        audioManagerRef.current.onVoiceActivity((isActive) => {
          if (!isComponentMountedRef.current) return;
          console.log('🎤 Voice activity:', isActive);
        });

        // Initialize the audio system
        const initialized = await audioManagerRef.current.initialize();
        if (!initialized) {
          console.error('❌ Failed to initialize advanced audio');
        } else {
          console.log('✅ Advanced audio system ready for seamless conversation');
        }
      }
    };

    initAudio();

    return () => {
      isComponentMountedRef.current = false;
      cleanupAllResources();
    };
  }, []);

  // Audio level monitoring
  useEffect(() => {
    if (!audioManagerRef.current) return;

    const updateAudioLevel = () => {
      if (audioManagerRef.current && isComponentMountedRef.current) {
        const level = audioManagerRef.current.getAudioLevel();
        setAudioLevel(level);
        requestAnimationFrame(updateAudioLevel);
      }
    };

    updateAudioLevel();
  }, []);

  // Connection timeout management
  useEffect(() => {
    if (connectionState === 'connecting') {
      connectionTimeoutRef.current = setTimeout(() => {
        if (isComponentMountedRef.current && connectionState === 'connecting') {
          setConnectionState('error');
        }
      }, 15000); // 15 second timeout
    } else {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    }

    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
    };
  }, [connectionState]);

  // Voice recognition management - moved after function definitions

  // Cleanup function
  const cleanupAllResources = useCallback(() => {
    // Clear all timeouts
    if (cleanupTimeoutRef.current) clearTimeout(cleanupTimeoutRef.current);
    if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);

    // Destroy advanced audio manager
    if (audioManagerRef.current) {
      audioManagerRef.current.destroy();
      audioManagerRef.current = null;
    }

    // Stop streaming
    if (streamingAudioRef.current) {
      streamingAudioRef.current.stop();
      streamingAudioRef.current = null;
    }

    // Abort any pending requests
    if (processingAbortRef.current) {
      processingAbortRef.current.abort();
      processingAbortRef.current = null;
    }

    stopAllSeamlessAudio();
  }, []);

  // Auto-retry connection
  const retryConnection = useCallback(async () => {
    if (retryCount >= 3) return; // Max 3 retries

    setRetryCount(prev => prev + 1);
    setConnectionStateWithLogging('connecting');

    // Clear any stuck sessions first
    try {
      await fetch('/api/heygen/close-all-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.warn('Failed to clear sessions:', error);
    }

    // Small delay before retry
    setTimeout(() => {
      // The HeyGenAvatar component will handle the actual reconnection
    }, 2000);
  }, [retryCount]);



  // Advanced voice management with seamless control
  useEffect(() => {
    if (!isComponentMountedRef.current || !audioManagerRef.current) return;

    console.log('🎤 Advanced voice effect triggered:', {
      voiceEnabled: voiceState.isEnabled,
      avatarReady: isAvatarReady,
      conversationState,
      isListening: voiceState.isListening
    });

    // Start listening when voice is enabled, avatar is ready, and we're in idle state
    if (voiceState.isEnabled && isAvatarReady && conversationState === 'idle' && !voiceState.isListening) {
      console.log('🎤 Starting advanced listening...');
      // Small delay to prevent rapid toggling
      const startDelay = setTimeout(async () => {
        if (!audioManagerRef.current || !isComponentMountedRef.current) return;
        if (conversationState !== 'idle') return; // Double-check state hasn't changed
        
        const started = await audioManagerRef.current.startListening();
        if (started && isComponentMountedRef.current) {
          setVoiceState(prev => ({ ...prev, isListening: true }));
          // Don't change conversationState here - let it stay 'idle' so we can continue listening
        }
      }, 100);
      
      return () => clearTimeout(startDelay);
    } 
    
    // Stop listening when voice is disabled, avatar not ready, or we're processing/speaking
    else if (!voiceState.isEnabled || !isAvatarReady || conversationState === 'processing' || conversationState === 'speaking') {
      if (voiceState.isListening) {
        console.log('🔇 Stopping advanced listening...');
        if (audioManagerRef.current) {
          audioManagerRef.current.stopListening();
          setVoiceState(prev => ({
            ...prev,
            isListening: false,
            interimTranscript: ''
          }));
        }
      }
    }
  }, [voiceState.isEnabled, isAvatarReady, conversationState, voiceState.isListening]);

  // Avatar speaking control with advanced audio management
  const speakWithAvatar = useCallback(async (text: string) => {
    // Check avatar readiness the same way as in the API handler
    const avatarActuallyReady = connectionState === 'connected' || 
                               heygenConnected || 
                               (typeof window !== 'undefined' && (window as any).heygenAvatar?.isConnected);
    
    console.log('🗣️ speakWithAvatar called with:', { 
      text: text.substring(0, 50) + '...', 
      textLength: text.length,
      isAvatarReady, 
      avatarActuallyReady,
      connectionState,
      heygenConnected,
      textTrimmed: !!text.trim(), 
      isComponentMounted: isComponentMountedRef.current 
    });
    
    if (!avatarActuallyReady) {
      console.log('🗣️ Early return: Avatar not actually ready');
      return;
    }
    
    if (!text.trim()) {
      console.log('🗣️ Early return: No text provided');
      return;
    }
    
    if (!isComponentMountedRef.current) {
      console.log('🗣️ Early return: Component not mounted');
      return;
    }

    console.log('🗣️ Starting avatar speech:', text);
    
    // Notify advanced audio manager that avatar is speaking
    if (audioManagerRef.current) {
      audioManagerRef.current.setAvatarSpeaking(true);
    }
    
    setConversationState('speaking');
    setVoiceState(prev => ({ 
      ...prev, 
      isListening: false,
      currentTranscript: '',
      interimTranscript: ''
    }));

    try {
      let speechStarted = false;

      // Debug: Check what's available on the HeyGen avatar
      console.log('🗣️ HeyGen avatar object:', (window as any).heygenAvatar);
      console.log('🗣️ Available methods:', Object.keys((window as any).heygenAvatar || {}));

      // Method 1: Try the global window object with proper parameters
      if ((window as any).heygenAvatar && (window as any).heygenAvatar.speak) {
        console.log('🗣️ Using global window speak method');
        try {
          // The voice ID is not actually used by the API, but required by the function signature
          const voiceId = 'default'; 
          const result = await (window as any).heygenAvatar.speak(text, voiceId);
          speechStarted = result !== false; // The function returns false on failure
          console.log('✅ Global speak method result:', result);
        } catch (speakError) {
          console.error('🗣️ Global speak method error:', speakError);
        }
      }

      // If the main method didn't work, log what's available for debugging
      if (!speechStarted) {
        console.log('🗣️ Main speak method failed, debugging available methods...');
        console.log('🗣️ HeyGen avatar object:', (window as any).heygenAvatar);
        console.log('🗣️ Available methods:', Object.keys((window as any).heygenAvatar || {}));
      }

      if (!speechStarted) {
        console.warn('⚠️ No avatar speak method available, using fallback timing');
      }

      // Optimized timing: 90ms per word for natural feel
      const wordCount = text.split(' ').length;
      const duration = Math.max(1500, wordCount * 90);

      speakingTimeoutRef.current = setTimeout(() => {
        if (isComponentMountedRef.current) {
          console.log('🔇 Avatar finished speaking');
          
          // Notify advanced audio manager that avatar stopped speaking
          if (audioManagerRef.current) {
            audioManagerRef.current.setAvatarSpeaking(false);
          }
          
          setConversationState('idle');
        }
      }, duration);

    } catch (error) {
      console.error('❌ Avatar speak error:', error);
      if (isComponentMountedRef.current) {
        // Make sure to reset speaking state on error
        if (audioManagerRef.current) {
          audioManagerRef.current.setAvatarSpeaking(false);
        }
        setConversationState('idle');
      }
    }
  }, [connectionState, heygenConnected]);

  // Handle user interruption of avatar
  const handleUserInterruption = useCallback(() => {
    if (conversationState === 'speaking') {
      console.log('🛑 User interrupted avatar - stopping speech');
      
      // Stop avatar speech immediately
      if (speakingTimeoutRef.current) {
        clearTimeout(speakingTimeoutRef.current);
        speakingTimeoutRef.current = null;
      }
      
      // Try to stop HeyGen avatar
      try {
        if ((window as any).heygenAvatar?.interrupt) {
          (window as any).heygenAvatar.interrupt();
        }
      } catch (error) {
        console.warn('Could not interrupt avatar:', error);
      }
      
      // Reset audio manager
      if (audioManagerRef.current) {
        audioManagerRef.current.setAvatarSpeaking(false);
      }
      
      setConversationState('idle');
    }
  }, [conversationState]);

  // Process user input
  const processUserInput = useCallback(async (text: string) => {
    if (!text.trim() || !isComponentMountedRef.current) return;

    // Handle interruption if avatar is speaking
    handleUserInterruption();

    setConversationState('processing');
    setCurrentAnswer('');

    // Clear any existing request
    if (processingAbortRef.current) {
      processingAbortRef.current.abort();
    }

    // Add user message immediately for instant feedback
    const userMessage: Message = {
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMessage]);

    // Cleanup audio immediately
    stopAllSeamlessAudio();

    // Create new abort controller
    const controller = new AbortController();
    processingAbortRef.current = controller;

    try {
      // Ultra-fast API call with optimized parameters
      const response = await fetch('/api/chat-fast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          userId: '550e8400-e29b-41d4-a716-446655440000',
          maxTokens: 50 // Increased for complete thoughts
        }),
        signal: controller.signal
      });

      if (!isComponentMountedRef.current) return;

      if (response.ok) {
        const data = await response.json();
        const aiResponse = data.answer || 'Sorry, I encountered an error.';

        // Add assistant message
        const assistantMessage: Message = {
          role: 'assistant',
          content: aiResponse,
          timestamp: Date.now()
        };

        setMessages(prev => [...prev, assistantMessage]);
        setCurrentAnswer(aiResponse);

        // Start speaking immediately
        console.log('🎤 API Response received:', aiResponse);
        console.log('🎤 Avatar ready status:', isAvatarReady);
        console.log('🎤 Connection state:', connectionState);
        console.log('🎤 HeyGen connected state:', heygenConnected);
        console.log('🎤 HeyGen avatar object exists:', !!(window as any).heygenAvatar);
        console.log('🎤 HeyGen avatar connected:', (window as any).heygenAvatar?.isConnected);
        
        // Check avatar readiness more directly
        const avatarActuallyReady = connectionState === 'connected' || 
                                   heygenConnected || 
                                   (typeof window !== 'undefined' && (window as any).heygenAvatar?.isConnected);
        
        console.log('🎤 Avatar actually ready:', avatarActuallyReady);
        
        if (avatarActuallyReady) {
          console.log('🎤 Calling speakWithAvatar...');
          speakWithAvatar(aiResponse);
        } else {
          console.log('🎤 Avatar not ready, setting to idle');
          setConversationState('idle');
        }

      } else {
        throw new Error(`API error: ${response.status}`);
      }
    } catch (error) {
      if (!isComponentMountedRef.current) return;

      console.error('Processing error:', error);

      if (error instanceof Error && error.name === 'AbortError') {
        return; // Ignore aborted requests
      }

      const errorMsg = 'Sorry, something went wrong. Please try again.';
      const errorMessage: Message = {
        role: 'assistant',
        content: errorMsg,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, errorMessage]);
      setCurrentAnswer(errorMsg);

      // Check avatar readiness more directly for error case too
      const avatarActuallyReady = connectionState === 'connected' || 
                                 heygenConnected || 
                                 (typeof window !== 'undefined' && (window as any).heygenAvatar?.isConnected);
      
      if (avatarActuallyReady) {
        speakWithAvatar(errorMsg);
      } else {
        setConversationState('idle');
      }
    } finally {
      processingAbortRef.current = null;
    }
  }, [isAvatarReady, speakWithAvatar]);

  // Toggle voice mode
  const toggleVoiceMode = useCallback(() => {
    setVoiceState(prev => ({
      ...prev,
      isEnabled: !prev.isEnabled,
      currentTranscript: '',
      interimTranscript: ''
    }));
  }, []);

  // Handle manual text input
  const handleTextSubmit = useCallback((text: string) => {
    if (!text.trim() || conversationState !== 'idle') return;
    processUserInput(text);
    setTextInput('');
  }, [processUserInput, conversationState]);

  // Handle form submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim() && conversationState === 'idle') {
      handleTextSubmit(textInput);
    }
  }, [textInput, handleTextSubmit, conversationState]);

  // Handle quick question clicks
  const handleQuickQuestion = useCallback((question: string) => {
    if (conversationState === 'idle') {
      processUserInput(question);
    }
  }, [processUserInput, conversationState]);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Header */}
        <header className={styles.header}>
          <h1 className={styles.title}>
            Talk with Jonathan
          </h1>
          <p className={styles.subtitle}>
            Real-time AI avatar with natural conversation
          </p>
        </header>

        {/* Main Content */}
        <div className={styles.mainGrid}>
          {/* Avatar Section */}
          <div className={styles.avatarSection}>
            {/* Avatar Container */}
            <div className={styles.avatarContainer}>
              <HeyGenAvatar
                className={styles.avatarVideo}
                onConnected={() => {
                  console.log('🔗 Avatar connected successfully');
                  setConnectionStateWithLogging('connected');
                  setHeygenConnected(true);
                  setRetryCount(0);

                  // Give avatar time to fully initialize
                  setTimeout(() => {
                    if ((window as any).heygenAvatar) {
                      console.log('✅ Global heygenAvatar is available');
                    }
                  }, 2000);
                }}
                onDisconnected={() => {
                  console.log('🔌 Avatar disconnected');
                  setConnectionStateWithLogging('disconnected');
                  setHeygenConnected(false);
                  setVoiceState(prev => ({ ...prev, isEnabled: false }));
                }}
                onSpeaking={(speaking: boolean) => {
                  console.log('🗣️ Avatar speaking state:', speaking);
                }}
              />

              {/* Connection Status Overlay */}
              <div className={styles.statusOverlay}>
                <div className={styles.connectionStatus}>
                  <div className={`${styles.statusDot} ${connectionState === 'connected' ? styles.connected :
                    connectionState === 'connecting' ? styles.connecting : styles.error
                    }`} />
                  {connectionState === 'connected' ? 'Connected' :
                    connectionState === 'connecting' ? 'Connecting...' :
                      connectionState === 'error' ? 'Connection Error' : 'Disconnected'}
                </div>

                {conversationState === 'speaking' && (
                  <div className={styles.speakingIndicator}>
                    <div className={styles.soundbars}>
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className={styles.soundbar} />
                      ))}
                    </div>
                    Speaking...
                  </div>
                )}
              </div>

              {/* Processing Overlay */}
              {conversationState === 'processing' && (
                <div className={`${styles.overlay} ${styles.processing}`}>
                  <div className={styles.spinner} />
                  Jonathan is thinking...
                </div>
              )}

              {/* Listening Overlay */}
              {conversationState === 'listening' && (
                <div className={`${styles.overlay} ${styles.listening}`}>
                  <div className={styles.soundbars}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className={styles.soundbar} />
                    ))}
                  </div>
                  I'm listening...
                </div>
              )}

              {/* Connection Error Overlay */}
              {connectionState === 'error' && (
                <div className={`${styles.overlay} ${styles.error}`}>
                  <div>⚠️ Connection failed</div>
                  {retryCount < 3 && (
                    <button onClick={retryConnection}>
                      Retry Connection
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Current Response */}
            {currentAnswer && (
              <div className={styles.currentResponse}>
                <h3 className={styles.responseTitle}>
                  <span>💬</span>
                  Jonathan says:
                </h3>
                <p className={styles.responseText}>
                  {currentAnswer}
                </p>
              </div>
            )}
          </div>

          {/* Controls Section */}
          <div className={styles.controlsSection}>
            {/* Status */}
            <div className={styles.statusSection}>
              <h2 className={styles.statusTitle}>
                {statusText}
              </h2>
              <p className={styles.statusDescription}>
                {connectionState === 'connecting' ? '⏳ Setting up your conversation...' :
                  connectionState === 'error' ? '❌ Unable to connect to avatar' :
                    connectionState === 'disconnected' ? '🔌 Avatar is offline' :
                      !hasSpeechRecognition ? '🚫 Voice recognition not available' :
                        !canUseVoice ? '🔌 Waiting for avatar connection...' :
                          voiceState.isEnabled ? '🎤 Advanced audio active - speak naturally!' :
                            '👆 Enable voice mode for seamless conversation'}
              </p>
            </div>

            {/* Voice Mode Toggle */}
            <button
              onClick={toggleVoiceMode}
              disabled={!canUseVoice}
              className={`${styles.voiceButton} ${
                !canUseVoice ? styles.disabled :
                conversationState === 'speaking' ? styles.muted :
                voiceState.isEnabled ? styles.enabled : styles.ready
              }`}
            >
              <span>
                {connectionState === 'connecting' ? '⏳' : 
                 conversationState === 'speaking' ? '🔇' :
                 voiceState.isEnabled ? '🎤' : '🔴'}
              </span>
              {connectionState === 'connecting' ? 'Connecting...' :
                connectionState !== 'connected' ? 'Avatar Offline' :
                  conversationState === 'speaking' ? 'Voice Muted (Avatar Speaking)' :
                  voiceState.isEnabled ? 'Voice Mode (ON)' : 'Enable Voice Mode'}
              {voiceState.isListening && conversationState !== 'speaking' && (
                <div className={styles.soundbars}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div 
                      key={i} 
                      className={styles.soundbar}
                      style={{
                        height: `${Math.max(20, audioLevel * 100 * (i + 1) / 4)}%`,
                        opacity: audioLevel > 0.02 ? 1 : 0.3
                      }}
                    />
                  ))}
                </div>
              )}
            </button>

            {/* Current transcript display */}
            {displayText && (
              <div className={`${styles.transcriptDisplay} ${voiceState.interimTranscript ? styles.interim : styles.final
                }`}>
                <strong className={styles.transcriptLabel}>
                  {voiceState.interimTranscript ? '👂 Listening...' : '✅ You said:'}
                </strong>
                <span className={styles.transcriptText}>
                  "{displayText}"
                </span>
              </div>
            )}

            {/* Quick Questions */}
            {isAvatarReady && (
              <div className={styles.quickQuestionsSection}>
                <h3>⚡ Quick Questions</h3>
                <div className={styles.quickQuestionsGrid}>
                  {quickQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuickQuestion(q.text)}
                      disabled={conversationState !== 'idle'}
                      className={styles.quickQuestionButton}
                    >
                      <span>{q.emoji}</span>
                      <span>{q.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Text Input */}
            {isAvatarReady && (
              <div className={styles.textInputSection}>
                <details>
                  <summary className={styles.textInputSummary}>
                    ⌨️ Prefer to type? Click here
                  </summary>
                  <form onSubmit={handleSubmit} className={styles.textInputForm}>
                    <textarea
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="Type your question here..."
                      rows={3}
                      disabled={conversationState !== 'idle'}
                      className={styles.textInputTextarea}
                    />
                    <button
                      type="submit"
                      disabled={conversationState !== 'idle' || !textInput.trim()}
                      className={styles.textInputButton}
                    >
                      {conversationState === 'processing' ? 'Sending...' : 'Send Message'}
                    </button>
                  </form>
                </details>
              </div>
            )}
          </div>
        </div>

        {/* Conversation History */}
        {messages.length > 0 && (
          <div className={styles.conversationHistory}>
            <h3 className={styles.conversationTitle}>
              💬 Conversation History
            </h3>
            <div className={styles.messagesContainer}>
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`${styles.messageWrapper} ${styles[message.role]}`}
                >
                  <div className={`${styles.message} ${styles[message.role]}`}>
                    <div className={styles.messageRole}>
                      {message.role === 'user' ? '👤 You' : '🤖 Jonathan'}
                    </div>
                    {message.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}