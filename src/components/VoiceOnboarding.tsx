'use client';

import { useState, useRef, useCallback } from 'react';
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
}

export default function VoiceOnboarding({ onComplete, selectedAvatar, isNewAvatar }: VoiceOnboardingProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [responses, setResponses] = useState<OnboardingResponse[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

      const updatedResponses = [...responses, newResponse];
      setResponses(updatedResponses);

      // Move to next question or complete
      if (currentQuestionIndex < onboardingQuestions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
        await completeOnboarding(updatedResponses);
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
  const progress = ((currentQuestionIndex + (responses.length > currentQuestionIndex ? 1 : 0)) / onboardingQuestions.length) * 100;

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
          <button
            onClick={startRecording}
            className="record-button"
          >
            <div className="record-dot"></div>
            Start Recording
          </button>
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
            <span>Processing your response...</span>
          </div>
        )}
      </div>

      {/* Previous Responses */}
      {responses.length > 0 && (
        <div className="responses-section">
          <h3 className="responses-title">Your Responses</h3>
          <div className="responses-list">
            {responses.map((response, index) => (
              <div key={index} className="response-item">
                <p className="response-question">
                  Q{index + 1}: {response.question}
                </p>
                <p className="response-transcript">
                  {response.transcript || 'Processing...'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}