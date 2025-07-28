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
                <div style={{ fontSize: '18px', padding: '20px' }}>
                  Processing your response...
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {conversation.length > 6 && (
              <div style={{ textAlign: 'center', marginTop: '30px' }}>
                <button
                  onClick={() => {
                    // TODO: Process conversation and create avatar
                    alert('Avatar creation from conversation - coming soon!');
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #f39c12, #e67e22)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50px',
                    padding: '15px 30px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    marginRight: '15px'
                  }}
                >
                  ✨ Create Avatar from Conversation
                </button>
                
                <button
                  onClick={() => router.push('/get-started')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '50px',
                    padding: '15px 30px',
                    fontSize: '16px',
                    cursor: 'pointer'
                  }}
                >
                  ← Back to Standard Onboarding
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hidden audio element for AI speech */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}