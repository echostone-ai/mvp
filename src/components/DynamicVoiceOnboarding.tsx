'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { dynamicOnboardingQuestions } from '@/lib/onboardingQuestions';

interface DynamicVoiceOnboardingProps {
  onComplete: (data: any) => void;
  avatarId: string;
  avatarName: string;
  resumeSessionId?: string | null;
}

interface QuestionResponse {
  questionId: string;
  question: string;
  audioBlob: Blob | null;
  transcript: string;
  analysis: any;
  timestamp: string;
}

export default function DynamicVoiceOnboarding({ 
  onComplete, 
  avatarId, 
  avatarName,
  resumeSessionId 
}: DynamicVoiceOnboardingProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<QuestionResponse[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(resumeSessionId);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [showQuestionTransition, setShowQuestionTransition] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Initialize session
  useEffect(() => {
    async function initializeSession() {
      try {
        const { data: session } = await supabase.auth.getSession();
        const user = session.session?.user;
        
        if (!user) {
          setIsLoadingSession(false);
          return;
        }

        if (resumeSessionId) {
          // Resume existing session
          const response = await fetch(`/api/onboarding/get-session?sessionId=${resumeSessionId}`);
          const sessionData = await response.json();

          if (sessionData.success && sessionData.session) {
            setSessionId(sessionData.session.id);
            setCurrentQuestionIndex(sessionData.currentQuestion);
            
            const convertedResponses: QuestionResponse[] = sessionData.responses.map((r: any) => ({
              questionId: dynamicOnboardingQuestions[r.question_index]?.id || `question_${r.question_index}`,
              question: r.question,
              audioBlob: null,
              transcript: r.transcript,
              analysis: r.analysis,
              timestamp: r.created_at
            }));
            
            setResponses(convertedResponses);
          }
        } else {
          // Create new session
          const createResponse = await fetch('/api/onboarding/create-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              avatarId,
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
  }, [avatarId, resumeSessionId]);

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
      const currentQuestion = dynamicOnboardingQuestions[currentQuestionIndex];
      
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
      
      const newResponse: QuestionResponse = {
        questionId: currentQuestion.id,
        question: currentQuestion.question,
        audioBlob,
        transcript: transcriptionData.text,
        analysis: transcriptionData.analysis,
        timestamp: new Date().toISOString()
      };

      // Save response to database
      if (sessionId) {
        const saveResponse = await fetch('/api/onboarding/save-response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            avatarId,
            questionIndex: currentQuestionIndex,
            question: currentQuestion.question,
            transcript: transcriptionData.text,
            analysis: transcriptionData.analysis,
            audioUrl: null
          })
        });

        const saveData = await saveResponse.json();
        if (!saveData.success) {
          throw new Error('Failed to save response');
        }

        if (saveData.isComplete) {
          await completeOnboarding([...responses, newResponse]);
          return;
        }
      }

      const updatedResponses = [...responses, newResponse];
      setResponses(updatedResponses);

      // Show transition animation and move to next question
      if (currentQuestionIndex < dynamicOnboardingQuestions.length - 1) {
        setShowQuestionTransition(true);
        setTimeout(() => {
          setCurrentQuestionIndex(currentQuestionIndex + 1);
          setShowQuestionTransition(false);
        }, 1500);
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

  const completeOnboarding = async (allResponses: QuestionResponse[]) => {
    try {
      const profileData = {
        responses: allResponses,
        avatarId,
        avatarName,
        completed_at: new Date().toISOString(),
      };

      onComplete(profileData);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      alert('Error completing setup. Please try again.');
    }
  };

  if (isLoadingSession) {
    return (
      <div className="dynamic-onboarding-container">
        <div className="loading-state">
          <div className="loading-pulse"></div>
          <p>Preparing your voice journey...</p>
        </div>
      </div>
    );
  }

  const currentQuestion = dynamicOnboardingQuestions[currentQuestionIndex];
  const progress = (responses.length / dynamicOnboardingQuestions.length) * 100;
  const isLastQuestion = currentQuestionIndex === dynamicOnboardingQuestions.length - 1;

  if (showQuestionTransition) {
    return (
      <div className="dynamic-onboarding-container">
        <div className="question-transition">
          <div className="transition-animation">
            <div className="ripple-effect"></div>
            <div className="transition-icon">✨</div>
          </div>
          <p className="transition-text">Beautiful! Moving to the next question...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dynamic-onboarding-container">
      {/* Progress Header */}
      <div className="onboarding-header">
        <div className="progress-info">
          <h1 className="avatar-name">Building {avatarName}'s Voice</h1>
          <p className="progress-text">
            Question {currentQuestionIndex + 1} of {dynamicOnboardingQuestions.length}
          </p>
        </div>
        <div className="progress-circle">
          <svg className="progress-ring" width="60" height="60">
            <circle
              className="progress-ring-background"
              cx="30"
              cy="30"
              r="25"
              fill="transparent"
              stroke="rgba(147, 71, 255, 0.2)"
              strokeWidth="4"
            />
            <circle
              className="progress-ring-progress"
              cx="30"
              cy="30"
              r="25"
              fill="transparent"
              stroke="url(#progressGradient)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 25}`}
              strokeDashoffset={`${2 * Math.PI * 25 * (1 - progress / 100)}`}
            />
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#9147ff" />
                <stop offset="100%" stopColor="#6a00ff" />
              </linearGradient>
            </defs>
          </svg>
          <span className="progress-percentage">{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Question Panel */}
      <div className={`question-panel ${currentQuestion.color}`}>
        <div className="question-content">
          <div className="question-icon">{currentQuestion.icon}</div>
          <div className="question-text">
            <h2 className="question-title">{currentQuestion.title}</h2>
            <p className="question-subtitle">{currentQuestion.subtitle}</p>
            <div className="question-main">{currentQuestion.question}</div>
            <p className="question-prompt">{currentQuestion.prompt}</p>
          </div>
        </div>

        {/* Recording Interface */}
        <div className="recording-interface">
          {!isRecording && !isProcessing && (
            <div className="recording-ready">
              <button onClick={startRecording} className="record-button">
                <div className="record-button-inner">
                  <div className="record-dot"></div>
                  <span>Start Recording</span>
                </div>
                <div className="record-button-glow"></div>
              </button>
              <p className="recording-hint">
                Take 30-90 seconds to share your thoughts. Speak from the heart.
              </p>
            </div>
          )}

          {isRecording && (
            <div className="recording-active">
              <div className="recording-visualization">
                <div className="sound-wave">
                  <div className="wave-bar"></div>
                  <div className="wave-bar"></div>
                  <div className="wave-bar"></div>
                  <div className="wave-bar"></div>
                  <div className="wave-bar"></div>
                </div>
              </div>
              <p className="recording-status">Recording your voice...</p>
              <button onClick={stopRecording} className="stop-button">
                <div className="stop-icon"></div>
                Stop Recording
              </button>
            </div>
          )}

          {isProcessing && (
            <div className="processing-state">
              <div className="processing-animation">
                <div className="processing-dots">
                  <div className="dot"></div>
                  <div className="dot"></div>
                  <div className="dot"></div>
                </div>
              </div>
              <p className="processing-text">
                Analyzing your response and capturing the essence of your voice...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Response History */}
      {responses.length > 0 && (
        <div className="response-history">
          <h3 className="history-title">Your Voice Journey</h3>
          <div className="response-timeline">
            {responses.map((response, index) => {
              const questionData = dynamicOnboardingQuestions.find(q => q.id === response.questionId);
              return (
                <div key={response.questionId} className="timeline-item">
                  <div className="timeline-marker">
                    <div className="marker-icon">{questionData?.icon || '💭'}</div>
                  </div>
                  <div className="timeline-content">
                    <h4 className="timeline-title">{questionData?.title || 'Response'}</h4>
                    <p className="timeline-transcript">{response.transcript}</p>
                    <div className="timeline-meta">
                      <span className="saved-badge">✓ Saved</span>
                      <span className="timestamp">
                        {new Date(response.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {responses.length === dynamicOnboardingQuestions.length && (
            <div className="completion-prompt">
              <button
                onClick={() => completeOnboarding(responses)}
                className="complete-button"
              >
                <span className="complete-text">Complete {avatarName}'s Voice Profile</span>
                <span className="complete-icon">🎉</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}