'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { onboardingQuestions, OnboardingResponse } from '@/lib/onboardingQuestions';

interface Avatar {
  id: string;
  name: string;
  description: string;
  voice_id: string | null;
  profile_data: any;
  created_at: string;
}

interface VoiceOnboardingProps {
  onComplete: (data: any) => void;
  selectedAvatar?: Avatar | null;
  isNewAvatar?: boolean;
  resumeSessionId?: string | null;
}

interface OnboardingSession {
  id: string;
  avatar_id: string | null;
  user_id: string;
  current_question: number;
  total_questions: number;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
}

interface SavedResponse {
  session_id: string;
  avatar_id: string | null;
  question_index: number;
  question: string;
  transcript: string;
  analysis: any;
  audio_url: string | null;
}

export default function VoiceOnboarding({ onComplete, selectedAvatar, isNewAvatar, resumeSessionId }: VoiceOnboardingProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [responses, setResponses] = useState<OnboardingResponse[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Load existing session or create new one
  useEffect(() => {
    async function initializeSession() {
      try {
        const { data: session } = await supabase.auth.getSession();
        const user = session.session?.user;
        
        if (!user) {
          setIsLoadingSession(false);
          return;
        }

        // Check for existing session or resume specific session
        let sessionUrl = resumeSessionId 
          ? `/api/onboarding/get-session?sessionId=${resumeSessionId}`
          : `/api/onboarding/get-session?avatarId=${selectedAvatar?.id || 'new'}`;
          
        const response = await fetch(sessionUrl);
        const sessionData = await response.json();

        if (sessionData.success && sessionData.session && !sessionData.isComplete) {
          // Resume existing session
          setSessionId(sessionData.session.id);
          setCurrentQuestionIndex(sessionData.currentQuestion);
          
          // Convert saved responses to OnboardingResponse format
          const convertedResponses: OnboardingResponse[] = sessionData.responses.map((r: SavedResponse) => ({
            questionIndex: r.question_index,
            question: r.question,
            audioBlob: null, // We don't store the blob, just the transcript
            transcript: r.transcript,
            analysis: r.analysis
          }));
          
          setResponses(convertedResponses);
        } else {
          // Create new session
          const createResponse = await fetch('/api/onboarding/create-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              avatarId: selectedAvatar?.id || null,
              userId: user.id
            })
          });

          const createData = await createResponse.json();
          if (createData.success) {
            setSessionId(createData.sessionId);
          }
        }
      } catch (error) {
        console.error('Error initializing session:', error);
      } finally {
        setIsLoadingSession(false);
      }
    }

    initializeSession();
  }, [selectedAvatar]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const handleRecordingComplete = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    try {
      // Transcribe the audio
      const formData = new FormData();
      formData.append('audioBlob', audioBlob);
      
      const response = await fetch('/api/onboarding/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const transcriptionData = await response.json();
      
      const newResponse: OnboardingResponse = {
        questionIndex: currentQuestionIndex,
        question: onboardingQuestions[currentQuestionIndex],
        audioBlob,
        transcript: transcriptionData.text,
        analysis: transcriptionData.analysis,
      };

      // Save response to database immediately
      if (sessionId) {
        const saveResponse = await fetch('/api/onboarding/save-response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            avatarId: selectedAvatar?.id || null,
            questionIndex: currentQuestionIndex,
            question: onboardingQuestions[currentQuestionIndex],
            transcript: transcriptionData.text,
            analysis: transcriptionData.analysis,
            audioUrl: null // TODO: Upload audio to storage if needed
          })
        });

        const saveData = await saveResponse.json();
        if (!saveData.success) {
          throw new Error('Failed to save response');
        }

        // Check if onboarding is complete
        if (saveData.isComplete) {
          await completeOnboarding([...responses, newResponse]);
          return;
        }
      }

      const updatedResponses = [...responses, newResponse];
      setResponses(updatedResponses);

      // Move to next question
      if (currentQuestionIndex < onboardingQuestions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      }
    } catch (error) {
      console.error('Error processing recording:', error);
      alert('Error processing your response. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const completeOnboarding = async (allResponses: OnboardingResponse[]) => {
    try {
      // Stitch audio files together
      const audioBlobs = allResponses.map(r => r.audioBlob);
      const stitchResponse = await fetch('/api/onboarding/stitch', {
        method: 'POST',
        body: JSON.stringify({ audioBlobs: audioBlobs.map((_, i) => i) }), // Send indices for now
        headers: { 'Content-Type': 'application/json' },
      });

      let avatarId = selectedAvatar?.id;

      // If creating a new avatar, create it now
      if (isNewAvatar) {
        const { data: session } = await supabase.auth.getSession();
        const user = session.session?.user;
        
        if (user) {
          // Generate avatar name from responses
          const avatarName = `My Avatar ${new Date().toLocaleDateString()}`;
          
          // Create new avatar
          const { data: newAvatar, error } = await supabase
            .from('avatar_profiles')
            .insert([{
              user_id: user.id,
              name: avatarName,
              description: 'Created through voice onboarding',
              profile_data: {
                onboarding_responses: allResponses,
                created_via: 'voice_onboarding'
              }
            }])
            .select()
            .single();

          if (error) throw error;
          avatarId = newAvatar.id;
        }
      }

      // Create profile data
      const profileData = {
        responses: allResponses,
        avatarId,
        selectedAvatar,
        isNewAvatar,
        completed_at: new Date().toISOString(),
      };

      onComplete(profileData);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      alert('Error completing setup. Please try again.');
    }
  };

  const currentQuestion = onboardingQuestions[currentQuestionIndex];
  const progress = ((responses.length) / onboardingQuestions.length) * 100;

  if (isLoadingSession) {
    return (
      <div className="get-started-card">
        <div className="processing-status">
          <div className="processing-spinner"></div>
          <span>Loading your progress...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="get-started-card">
      {/* Progress Bar */}
      <div className="progress-section">
        <div className="progress-info">
          <span>Question {currentQuestionIndex + 1} of {onboardingQuestions.length}</span>
          <span>{Math.round(progress)}% Complete</span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Current Question */}
      <div className="question-section">
        <h2 className="question-title">
          {currentQuestion}
        </h2>
        <p className="question-description">
          Take 30-60 seconds to share your thoughts. Speak naturally and from the heart.
        </p>
      </div>

      {/* Recording Controls */}
      <div className="recording-controls">
        {!isRecording && !isProcessing && (
          <>
            <button
              onClick={startRecording}
              className="record-button"
            >
              <div className="record-dot"></div>
              {responses.length > currentQuestionIndex ? 'Re-record Answer' : 'Start Recording'}
            </button>
            
            {responses.length > 0 && (
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button
                  onClick={() => window.location.href = '/profile'}
                  className="next-step-button secondary"
                  style={{ fontSize: '0.9rem', padding: '0.75rem 1.5rem' }}
                >
                  Save & Resume Later
                </button>
                
                {currentQuestionIndex < onboardingQuestions.length - 1 && responses.length > currentQuestionIndex && (
                  <button
                    onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
                    className="next-step-button secondary"
                    style={{ fontSize: '0.9rem', padding: '0.75rem 1.5rem' }}
                  >
                    Skip to Next Question →
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {isRecording && (
          <>
            <div className="recording-status">
              <div className="recording-indicator"></div>
              <span>Recording...</span>
            </div>
            <button
              onClick={stopRecording}
              className="stop-button"
            >
              Stop Recording
            </button>
          </>
        )}

        {isProcessing && (
          <div className="processing-status">
            <div className="processing-spinner"></div>
            <span>Processing and saving your response...</span>
          </div>
        )}
      </div>

      {/* Previous Responses */}
      {responses.length > 0 && (
        <div className="responses-section">
          <h3 className="responses-title">Your Saved Responses</h3>
          <div className="responses-list">
            {responses.map((response, index) => (
              <div key={index} className="response-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <p className="response-question">
                    Q{index + 1}: {response.question}
                  </p>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--success-color)', 
                    background: 'rgba(34, 197, 94, 0.2)',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '12px',
                    whiteSpace: 'nowrap'
                  }}>
                    ✓ Saved
                  </span>
                </div>
                <p className="response-transcript">
                  {response.transcript || 'Processing...'}
                </p>
              </div>
            ))}
          </div>
          
          {responses.length === onboardingQuestions.length && (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <button
                onClick={() => completeOnboarding(responses)}
                className="train-voice-button"
                style={{ fontSize: '1.1rem' }}
              >
                Complete Onboarding & Continue →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}