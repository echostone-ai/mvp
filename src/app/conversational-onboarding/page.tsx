'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ConversationTurn {
  id: string;
  type: 'ai' | 'user';
  text: string;
  audioUrl?: string;
  timestamp: Date;
}

export default function ConversationalOnboardingPage() {
  const router = useRouter();
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAITalking, setIsAITalking] = useState(false);
  const [avatarName, setAvatarName] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [audioSamples, setAudioSamples] = useState<string[]>([]);
  const [isCreatingAvatar, setIsCreatingAvatar] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Start the conversation
  const startConversation = async () => {
    if (!avatarName.trim()) {
      alert('Please enter your avatar name first');
      return;
    }

    setHasStarted(true);
    
    // Add initial AI greeting
    const greeting = `Hi ${avatarName}! I'm excited to get to know you better. Let's have a natural conversation about who you are. To start, tell me about a memory that always makes you smile when you think about it.`;
    
    const aiTurn: ConversationTurn = {
      id: Date.now().toString(),
      type: 'ai',
      text: greeting,
      timestamp: new Date()
    };
    
    setConversation([aiTurn]);
    
    // Generate AI speech
    await generateAISpeech(greeting);
  };

  // Generate AI speech using ElevenLabs
  const generateAISpeech = async (text: string) => {
    try {
      setIsAITalking(true);
      
      const response = await fetch('/api/generate-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voiceId: 'wAGzRVkxKEs8La0lmdrE' // Your specified voice ID
        })
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Play the audio
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.play();
        }
      }
    } catch (error) {
      console.error('Speech generation failed:', error);
    } finally {
      setIsAITalking(false);
    }
  };

  // Generate dynamic follow-up question
  const generateFollowUpQuestion = async (userResponse: string, conversationHistory: ConversationTurn[]) => {
    try {
      const response = await fetch('/api/generate-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userResponse,
          conversationHistory: conversationHistory.slice(-6), // Last 6 turns for context
          avatarName
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.followUpQuestion;
      }
    } catch (error) {
      console.error('Follow-up generation failed:', error);
    }
    
    return "That's interesting! Tell me more about that.";
  };

  // Start recording user response
  const startRecording = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await handleRecordingComplete(audioBlob);
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Recording error:', error);
      alert('Could not access microphone');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  // Handle completed recording
  const handleRecordingComplete = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    try {
      // Transcribe user response
      const formData = new FormData();
      formData.append('audioBlob', audioBlob);
      
      const transcribeResponse = await fetch('/api/onboarding/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!transcribeResponse.ok) {
        throw new Error('Transcription failed');
      }

      const transcriptionData = await transcribeResponse.json();
      const userText = transcriptionData.text;
      
      // Convert audio to base64 for storage
      const audioBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(audioBlob);
      });
      
      // Store audio sample
      setAudioSamples(prev => [...prev, audioBase64]);
      
      // Add user turn to conversation
      const userTurn: ConversationTurn = {
        id: Date.now().toString(),
        type: 'user',
        text: userText,
        timestamp: new Date()
      };
      
      const updatedConversation = [...conversation, userTurn];
      setConversation(updatedConversation);
      
      // Generate AI follow-up question
      const followUpQuestion = await generateFollowUpQuestion(userText, updatedConversation);
      
      // Add AI response
      const aiTurn: ConversationTurn = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        text: followUpQuestion,
        timestamp: new Date()
      };
      
      setConversation([...updatedConversation, aiTurn]);
      
      // Generate and play AI speech
      await generateAISpeech(followUpQuestion);
      
    } catch (error) {
      console.error('Error processing response:', error);
      alert('Error processing your response');
    } finally {
      setIsProcessing(false);
    }
  };

  // Create avatar from conversation
  const createAvatarFromConversation = async () => {
    if (conversation.length < 2) {
      alert('Please have at least one exchange (AI question + your response) before creating your avatar');
      return;
    }

    setIsCreatingAvatar(true);
    
    try {
      console.log('🎭 Creating avatar from conversation...');
      console.log('💬 Conversation length:', conversation.length);
      console.log('🎤 Audio samples:', audioSamples.length);
      
      const response = await fetch('/api/create-avatar-from-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatarName,
          conversation,
          audioSamples
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create avatar');
      }

      const data = await response.json();
      console.log('✅ Avatar created:', data.avatar);
      
      // Show success message
      alert(`🎉 Avatar "${avatarName}" created successfully! ${data.avatar.voice_id ? 'Voice training completed.' : 'Voice training in progress.'}`);
      
      // Redirect to profile or avatar page
      router.push('/profile');
      
    } catch (error) {
      console.error('Avatar creation failed:', error);
      alert(`Failed to create avatar: ${error.message}`);
    } finally {
      setIsCreatingAvatar(false);
    }
  };

  // Save conversation progress
  const saveProgress = () => {
    const progressData = {
      avatarName,
      conversation,
      audioSamples,
      timestamp: new Date().toISOString()
    };
    
    localStorage.setItem('conversational_onboarding_progress', JSON.stringify(progressData));
    alert('💾 Progress saved! You can continue this conversation later.');
  };

  // Load saved progress
  useEffect(() => {
    try {
      const saved = localStorage.getItem('conversational_onboarding_progress');
      if (saved) {
        const progressData = JSON.parse(saved);
        if (progressData.avatarName && progressData.conversation) {
          const shouldResume = confirm('Found a saved conversation. Would you like to continue where you left off?');
          if (shouldResume) {
            setAvatarName(progressData.avatarName);
            setConversation(progressData.conversation || []);
            setAudioSamples(progressData.audioSamples || []);
            setHasStarted(true);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load saved progress:', error);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)',
      color: 'white',
      padding: '20px'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ 
          textAlign: 'center', 
          marginBottom: '30px',
          fontSize: '32px',
          fontWeight: '700',
          textShadow: '0 2px 4px rgba(0,0,0,0.3)'
        }}>
          🎭 Conversational Avatar Creation
        </h1>

        {!hasStarted ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '40px',
            textAlign: 'center',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <h2 style={{ marginBottom: '20px' }}>Let's Create Your Avatar Together</h2>
            <p style={{ marginBottom: '30px', fontSize: '18px', lineHeight: '1.6' }}>
              I'll have a natural conversation with you to learn about who you are. 
              Just speak naturally, and I'll ask follow-up questions based on what you share.
            </p>
            
            <input
              type="text"
              placeholder="What should I call your avatar?"
              value={avatarName}
              onChange={(e) => setAvatarName(e.target.value)}
              style={{
                padding: '15px 20px',
                fontSize: '16px',
                borderRadius: '10px',
                border: 'none',
                marginBottom: '20px',
                width: '300px',
                textAlign: 'center'
              }}
            />
            
            <br />
            
            <button
              onClick={startConversation}
              style={{
                background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
                color: 'white',
                border: 'none',
                borderRadius: '50px',
                padding: '15px 30px',
                fontSize: '18px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 8px 25px rgba(231, 76, 60, 0.4)',
                transition: 'all 0.3s ease'
              }}
            >
              🎤 Start Conversation
            </button>
          </div>
        ) : (
          <div>
            {/* Conversation History */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              padding: '30px',
              marginBottom: '30px',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              maxHeight: '500px',
              overflowY: 'auto'
            }}>
              {conversation.map((turn) => (
                <div
                  key={turn.id}
                  style={{
                    display: 'flex',
                    justifyContent: turn.type === 'ai' ? 'flex-start' : 'flex-end',
                    marginBottom: '20px'
                  }}
                >
                  <div
                    style={{
                      background: turn.type === 'ai' 
                        ? 'linear-gradient(135deg, #9b59b6, #8e44ad)'
                        : 'linear-gradient(135deg, #3498db, #2980b9)',
                      borderRadius: '20px',
                      padding: '15px 20px',
                      maxWidth: '70%',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                    }}
                  >
                    <div style={{ 
                      fontSize: '14px', 
                      opacity: 0.8, 
                      marginBottom: '5px' 
                    }}>
                      {turn.type === 'ai' ? '🎭 AI' : '👤 You'}
                    </div>
                    <div style={{ fontSize: '16px', lineHeight: '1.4' }}>
                      {turn.text}
                    </div>
                  </div>
                </div>
              ))}
              
              {isAITalking && (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '10px' }}>🎤</div>
                  <div>AI is speaking...</div>
                </div>
              )}
            </div>



            {/* Recording Controls */}
            <div style={{ textAlign: 'center' }}>
              {!isRecording && !isProcessing && !isAITalking && (
                <button
                  onClick={startRecording}
                  style={{
                    background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '60px',
                    padding: '20px 40px',
                    fontSize: '18px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 8px 25px rgba(231, 76, 60, 0.4)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  🎤 Respond
                </button>
              )}

              {isRecording && (
                <button
                  onClick={stopRecording}
                  style={{
                    background: 'linear-gradient(135deg, #27ae60, #229954)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '60px',
                    padding: '20px 40px',
                    fontSize: '18px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 8px 25px rgba(39, 174, 96, 0.4)'
                  }}
                >
                  ⏹️ Stop Recording
                </button>
              )}

              {isProcessing && (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: '15px',
                  padding: '20px'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    border: '4px solid rgba(255, 255, 255, 0.3)',
                    borderTop: '4px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  <div style={{ fontSize: '16px' }}>Processing your response...</div>
                </div>
              )}

              {/* Quick actions */}
              {conversation.length > 0 && !isRecording && !isProcessing && !isAITalking && (
                <div style={{ 
                  display: 'flex', 
                  gap: '10px', 
                  justifyContent: 'center',
                  marginTop: '20px'
                }}>
                  <button
                    onClick={() => {
                      if (confirm('Clear the entire conversation? This cannot be undone.')) {
                        setConversation([]);
                        setAudioSamples([]);
                        localStorage.removeItem('conversational_onboarding_progress');
                      }
                    }}
                    style={{
                      background: 'rgba(231, 76, 60, 0.2)',
                      color: 'white',
                      border: '1px solid rgba(231, 76, 60, 0.4)',
                      borderRadius: '25px',
                      padding: '8px 16px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    🗑️ Clear Chat
                  </button>
                </div>
              )}

              {/* Always visible save/create buttons for testing */}
              {conversation.length > 0 && (
                <div style={{ 
                  textAlign: 'center', 
                  marginTop: '20px',
                  padding: '15px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <div style={{ fontSize: '12px', marginBottom: '10px', opacity: 0.8 }}>
                    Quick Actions
                  </div>
                  <button
                    onClick={saveProgress}
                    style={{
                      background: 'linear-gradient(135deg, #27ae60, #229954)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '25px',
                      padding: '8px 16px',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      marginRight: '10px'
                    }}
                  >
                    💾 Save
                  </button>
                  
                  {conversation.length >= 2 && (
                    <button
                      onClick={createAvatarFromConversation}
                      disabled={isCreatingAvatar}
                      style={{
                        background: isCreatingAvatar 
                          ? 'rgba(243, 156, 18, 0.5)' 
                          : 'linear-gradient(135deg, #f39c12, #e67e22)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '25px',
                        padding: '8px 16px',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: isCreatingAvatar ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isCreatingAvatar ? '⏳ Creating...' : '✨ Create Avatar'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Single Action Section */}
            {conversation.length > 0 && (
              <div style={{ textAlign: 'center', marginTop: '30px' }}>
                {/* Progress indicator */}
                <div style={{ 
                  marginBottom: '25px',
                  padding: '20px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '15px',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}>
                  <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '10px' }}>
                    💬 {conversation.length} messages • 🎤 {audioSamples.length} voice samples
                  </div>
                  {conversation.length >= 2 && (
                    <div style={{ fontSize: '14px', color: '#4ade80' }}>
                      ✅ Ready to create your avatar!
                    </div>
                  )}
                </div>

                {/* Main action buttons */}
                <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
                  {conversation.length >= 2 && (
                    <button
                      onClick={createAvatarFromConversation}
                      disabled={isCreatingAvatar}
                      style={{
                        background: isCreatingAvatar 
                          ? 'rgba(99, 102, 241, 0.5)' 
                          : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '16px 32px',
                        fontSize: '16px',
                        fontWeight: '600',
                        cursor: isCreatingAvatar ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
                        transition: 'all 0.3s ease',
                        minWidth: '180px',
                        transform: 'translateY(0)',
                      }}
                      onMouseEnter={(e) => {
                        if (!isCreatingAvatar) {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 6px 25px rgba(99, 102, 241, 0.5)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isCreatingAvatar) {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 4px 20px rgba(99, 102, 241, 0.4)';
                        }
                      }}
                    >
                      {isCreatingAvatar ? '⏳ Creating Avatar...' : '✨ Create Avatar'}
                    </button>
                  )}
                  
                  <button
                    onClick={saveProgress}
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      color: 'white',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '12px',
                      padding: '16px 32px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      backdropFilter: 'blur(10px)',
                      transition: 'all 0.3s ease',
                      minWidth: '160px',
                      transform: 'translateY(0)',
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(255, 255, 255, 0.25)';
                      e.target.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'rgba(255, 255, 255, 0.15)';
                      e.target.style.transform = 'translateY(0)';
                    }}
                  >
                    💾 Save Progress
                  </button>
                </div>

                {/* Secondary action */}
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to exit? Your progress will be saved.')) {
                      saveProgress();
                      router.push('/get-started');
                    }
                  }}
                  style={{
                    background: 'transparent',
                    color: 'rgba(255, 255, 255, 0.7)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                    e.target.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'transparent';
                    e.target.style.color = 'rgba(255, 255, 255, 0.7)';
                  }}
                >
                  ← Exit & Save
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hidden audio element for AI speech */}
      <audio ref={audioRef} style={{ display: 'none' }} />
      
      {/* CSS Animations */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}