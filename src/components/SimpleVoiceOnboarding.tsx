'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { dynamicOnboardingQuestions } from '@/lib/onboardingQuestions';

interface SimpleVoiceOnboardingProps {
  onComplete: (data: any) => void;
  avatarId: string;
  avatarName: string;
}

interface QuestionResponse {
  questionId: string;
  question: string;
  audioBlob: Blob | null;
  transcript: string;
  analysis: any;
  timestamp: string;
}

export default function SimpleVoiceOnboarding({ 
  onComplete, 
  avatarId, 
  avatarName
}: SimpleVoiceOnboardingProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<QuestionResponse[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize component and check for saved progress
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(`onboarding_${avatarId}`);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        console.log('Found saved progress:', parsed);
        
        if (parsed.responses && parsed.responses.length > 0) {
          setResponses(parsed.responses);
          const resumeIndex = parsed.currentQuestion !== undefined ? parsed.currentQuestion : parsed.responses.length;
          setCurrentQuestionIndex(resumeIndex);
          console.log('🔄 Resumed from localStorage:', {
            savedCurrentQuestion: parsed.currentQuestion,
            responseCount: parsed.responses.length,
            resumingAtIndex: resumeIndex,
            responseIds: parsed.responses.map((r: any) => r.questionId)
          });
        }
      }
    } catch (error) {
      console.warn('Error loading saved progress:', error);
    }
    setIsInitialized(true);
  }, [avatarId]);

  // Validate required props
  if (!avatarId || !avatarName) {
    return (
      <div className="dynamic-onboarding-container">
        <div className="loading-state">
          <p>Error: Missing avatar information. Please go back and try again.</p>
          <button 
            onClick={() => window.history.back()}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              padding: '0.75rem 1.5rem',
              borderRadius: '50px',
              cursor: 'pointer',
              marginTop: '1rem'
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const startRecording = useCallback(async () => {
    try {
      // Clean up any existing stream first
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
        
        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => {
            track.stop();
            console.log('🎤 Microphone track stopped after recording');
          });
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      console.log('🎤 Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      console.log('🎤 Recording stopped');
    }
  }, [isRecording]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('🎤 Cleanup: Microphone track stopped on unmount');
        });
      }
    };
  }, []);

  const handleRecordingComplete = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    try {
      const currentQuestion = dynamicOnboardingQuestions[currentQuestionIndex];
      
      console.log('🎯 Processing question:', currentQuestionIndex, currentQuestion.title);
      console.log('🏷️ Question details:', {
        id: currentQuestion.id,
        category: currentQuestion.category,
        question: currentQuestion.question
      });
      
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
      console.log('Transcription result:', transcriptionData);
      
      const newResponse: QuestionResponse = {
        questionId: currentQuestion.id,
        question: currentQuestion.question,
        audioBlob,
        transcript: transcriptionData.text,
        analysis: transcriptionData.analysis,
        timestamp: new Date().toISOString()
      };

      console.log('💾 Saving response for question:', currentQuestion.id, 'category:', currentQuestion.category);
      console.log('📋 Current question details:', {
        index: currentQuestionIndex,
        id: currentQuestion.id,
        title: currentQuestion.title,
        category: currentQuestion.category
      });

      const updatedResponses = [...responses, newResponse];
      setResponses(updatedResponses);
      
      console.log('📊 Updated responses:', updatedResponses.length, 'of', dynamicOnboardingQuestions.length);
      console.log('📝 All response IDs so far:', updatedResponses.map(r => r.questionId));

      // Save to localStorage as backup
      localStorage.setItem(`onboarding_${avatarId}`, JSON.stringify({
        responses: updatedResponses,
        currentQuestion: currentQuestionIndex + 1,
        avatarId,
        avatarName,
        lastSaved: new Date().toISOString()
      }));

      // Note: Removed auto-save to prevent race conditions
      // Profile data will be saved when user clicks "Save and Continue Later" or completes onboarding

      // Check if we're done
      if (updatedResponses.length >= dynamicOnboardingQuestions.length) {
        console.log('All questions completed, finishing onboarding...');
        // Complete onboarding
        await completeOnboarding(updatedResponses);
      } else {
        // Find next unanswered question
        let nextQuestionIndex = currentQuestionIndex + 1;
        console.log('🔍 Looking for next question after index:', currentQuestionIndex);
        
        while (nextQuestionIndex < dynamicOnboardingQuestions.length) {
          const nextQuestion = dynamicOnboardingQuestions[nextQuestionIndex];
          const alreadyAnswered = updatedResponses.some(r => r.questionId === nextQuestion.id);
          console.log(`📋 Question ${nextQuestionIndex} (${nextQuestion.id}): ${alreadyAnswered ? 'ANSWERED' : 'NOT ANSWERED'}`);
          
          if (!alreadyAnswered) {
            break;
          }
          nextQuestionIndex++;
        }
        
        if (nextQuestionIndex < dynamicOnboardingQuestions.length) {
          console.log('✅ Moving to next unanswered question:', nextQuestionIndex, dynamicOnboardingQuestions[nextQuestionIndex].id);
          
          // Update localStorage with new question index
          const progressData = {
            responses: updatedResponses,
            currentQuestion: nextQuestionIndex,
            avatarId,
            avatarName,
            lastSaved: new Date().toISOString()
          };
          localStorage.setItem(`onboarding_${avatarId}`, JSON.stringify(progressData));
          
          // Move to next question with transition
          setShowTransition(true);
          setTimeout(() => {
            setCurrentQuestionIndex(nextQuestionIndex);
            setShowTransition(false);
          }, 1500);
        } else {
          // All questions answered
          console.log('🎯 All questions answered, completing...');
          await completeOnboarding(updatedResponses);
        }
      }
    } catch (error) {
      console.error('Error processing recording:', error);
      alert('Error processing your response. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const saveProgress = async () => {
    try {
      // Save current progress to localStorage
      const progressData = {
        responses,
        currentQuestion: currentQuestionIndex,
        avatarId,
        avatarName,
        lastSaved: new Date().toISOString()
      };
      
      localStorage.setItem(`onboarding_${avatarId}`, JSON.stringify(progressData));
      
      // Also try to save to database if available
      const { data: session } = await supabase.auth.getSession();
      const user = session.session?.user;
      
      if (user && responses.length > 0) {
        console.log('💾 Saving progress with', responses.length, 'responses');
        console.log('📋 Response IDs being saved:', responses.map(r => r.questionId));
        
        // Build partial profile data from current responses
        const partialProfileData = buildProfileFromResponses(responses, avatarName);
        
        // Train voice model with current responses
        let voiceModelId = null;
        try {
          console.log('🎤 Training voice model with', responses.length, 'responses...');
          const voiceResponse = await fetch('/api/onboarding/train-voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              profileData: {
                responses: responses,
                avatarId,
                avatarName
              }
            }),
          });

          if (voiceResponse.ok) {
            const voiceData = await voiceResponse.json();
            voiceModelId = voiceData.voice_model_id;
            console.log('✅ Voice model trained:', voiceModelId);
          }
        } catch (voiceError) {
          console.error('Voice training failed:', voiceError);
        }
        
        try {
          await supabase
            .from('avatar_profiles')
            .update({
              profile_data: partialProfileData,
              voice_id: voiceModelId || undefined,
              updated_at: new Date().toISOString()
            })
            .eq('id', avatarId)
            .eq('user_id', user.id);
          
          console.log('Progress saved to database');
        } catch (updateError) {
          console.warn('Failed to save to database:', updateError);
        }
      }
      
      alert('Progress saved! You can continue later from your profile page.');
      
      // Redirect to profile
      window.location.href = '/profile';
    } catch (error) {
      console.error('Error saving progress:', error);
      alert('Error saving progress. Please try again.');
    }
  };

  const completeOnboarding = async (allResponses: QuestionResponse[]) => {
    try {
      console.log('🎯 Completing onboarding with', allResponses.length, 'responses');
      console.log('📋 All responses:', allResponses.map(r => ({ id: r.questionId, transcript: r.transcript?.substring(0, 30) + '...' })));
      
      // Build comprehensive profile data from responses
      const profileData = buildProfileFromResponses(allResponses, avatarName);
      console.log('✅ Built profile data:', profileData);
      
      // Update the avatar with the new profile data
      const { data: session } = await supabase.auth.getSession();
      const user = session.session?.user;
      
      if (user) {
        try {
          const { error: updateError } = await supabase
            .from('avatar_profiles')
            .update({
              profile_data: profileData,
              updated_at: new Date().toISOString()
            })
            .eq('id', avatarId)
            .eq('user_id', user.id);
            
          if (updateError) {
            console.error('Database update error:', updateError);
          } else {
            console.log('Successfully updated avatar profile in database');
          }
        } catch (updateError) {
          console.warn('Failed to update avatar profile:', updateError);
        }
      }

      // Try to train voice model
      let voiceModelId = null;
      try {
        console.log('Training voice model...');
        const voiceResponse = await fetch('/api/onboarding/train-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            profileData: {
              responses: allResponses,
              avatarId,
              avatarName
            }
          }),
        });

        if (voiceResponse.ok) {
          const voiceData = await voiceResponse.json();
          voiceModelId = voiceData.voice_model_id;
          console.log('Voice model trained:', voiceModelId);
          
          // Update avatar with voice ID
          if (voiceModelId && user) {
            try {
              await supabase
                .from('avatar_profiles')
                .update({ voice_id: voiceModelId })
                .eq('id', avatarId)
                .eq('user_id', user.id);
              console.log('Voice ID saved to avatar');
            } catch (voiceUpdateError) {
              console.warn('Failed to save voice ID:', voiceUpdateError);
            }
          }
        }
      } catch (voiceError) {
        console.error('Voice training failed:', voiceError);
        // Continue without voice - don't fail the entire onboarding
      }

      // Clear localStorage since we're done
      localStorage.removeItem(`onboarding_${avatarId}`);

      const completionData = {
        responses: allResponses,
        avatarId,
        avatarName,
        profileData,
        voiceModelId,
        completed_at: new Date().toISOString(),
      };

      console.log('Onboarding completed successfully');
      onComplete(completionData);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      alert('Error completing setup. Please try again.');
    }
  };

  // Helper function to build comprehensive profile data from responses
  const buildProfileFromResponses = (responses: QuestionResponse[], name: string) => {
    console.log('🔍 Building profile from', responses.length, 'responses:', responses.map(r => r.questionId));
    console.log('📚 Available questions:', dynamicOnboardingQuestions.map(q => ({ id: q.id, category: q.category })));
    
    const profileData: any = {
      name,
      personality: `I am ${name}, `,
      personalityTraits: [],
      factualInfo: [`My name is ${name}`],
      languageStyle: { description: 'Natural and conversational, authentic to my own unique voice' },
      humorStyle: { description: 'Friendly with occasional wit, adapting to the conversation naturally' },
      catchphrases: [],
      memories: [],
      influences: [],
      passions: [],
      places: [],
      philosophy: [],
      creativity: []
    };

    let personalityParts = [`I am ${name}`];

    responses.forEach((response, index) => {
      console.log(`📝 Processing response ${index + 1}:`, response.questionId, response.transcript?.substring(0, 50) + '...');
      const questionData = dynamicOnboardingQuestions.find(q => q.id === response.questionId);
      if (!questionData) {
        console.warn('⚠️ Question data not found for:', response.questionId);
        return;
      }

      console.log('🏷️ Categorizing response as:', questionData.category);
      
      // Add the raw response as factual info
      profileData.factualInfo.push(response.transcript);

      // Categorize based on question type
      console.log(`🎯 Categorizing "${response.transcript?.substring(0, 30)}..." as "${questionData.category}"`);
      
      switch (questionData.category) {
        case 'memories':
          profileData.memories.push(response.transcript);
          personalityParts.push('I have cherished memories that shape who I am');
          console.log('✅ Added to memories, total:', profileData.memories.length);
          break;
        case 'influences':
          profileData.influences.push(response.transcript);
          personalityParts.push('I\'ve been shaped by important people in my life');
          console.log('✅ Added to influences, total:', profileData.influences.length);
          break;
        case 'passions':
          profileData.passions.push(response.transcript);
          personalityParts.push('I have things I\'m passionate about that bring me joy');
          console.log('✅ Added to passions, total:', profileData.passions.length);
          break;
        case 'places':
          profileData.places.push(response.transcript);
          personalityParts.push('There are places that hold special meaning for me');
          console.log('✅ Added to places, total:', profileData.places.length);
          break;
        case 'philosophy':
          profileData.philosophy.push(response.transcript);
          personalityParts.push('I have beliefs and principles that guide my life');
          console.log('✅ Added to philosophy, total:', profileData.philosophy.length);
          break;
        case 'creativity':
          profileData.creativity.push(response.transcript);
          personalityParts.push('I express myself creatively in my own unique way');
          console.log('✅ Added to creativity, total:', profileData.creativity.length);
          break;
        default:
          console.warn('⚠️ Unknown category:', questionData.category);
          profileData.memories.push(response.transcript); // Fallback to memories
          break;
      }

      // Extract insights from analysis if available
      if (response.analysis) {
        if (response.analysis.keywords) {
          // Create more natural personality traits from keywords
          response.analysis.keywords.forEach((keyword: string) => {
            if (keyword.length > 2) { // Skip very short keywords
              profileData.personalityTraits.push(`I have experience with ${keyword}`);
            }
          });
        }
        if (response.analysis.insights) {
          profileData.personalityTraits.push(...response.analysis.insights);
        }
      }
    });

    // Build comprehensive personality description
    profileData.personality = personalityParts.join('. ') + '. I speak authentically from my experiences and share my genuine thoughts and feelings.';

    return profileData;
  };

  const currentQuestion = dynamicOnboardingQuestions[currentQuestionIndex];
  const progress = (responses.length / dynamicOnboardingQuestions.length) * 100;
  
  // Check if current question is already answered
  const currentQuestionAnswered = responses.some(r => r.questionId === currentQuestion?.id);
  
  // Debug: Log current state
  console.log('🔍 Current state:', {
    questionIndex: currentQuestionIndex,
    questionId: currentQuestion?.id,
    totalResponses: responses.length,
    alreadyAnswered: currentQuestionAnswered,
    responseIds: responses.map(r => r.questionId)
  });

  // Show loading while initializing
  if (!isInitialized) {
    return (
      <div className="dynamic-onboarding-container">
        <div className="loading-state">
          <div className="loading-pulse"></div>
          <p>Loading your voice journey...</p>
        </div>
      </div>
    );
  }

  // Safety check
  if (!currentQuestion) {
    return (
      <div className="dynamic-onboarding-container">
        <div className="loading-state">
          <p style={{ color: '#ef4444', textAlign: 'center' }}>
            Error: Invalid question. Please refresh and try again.
          </p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              padding: '0.75rem 1.5rem',
              borderRadius: '50px',
              cursor: 'pointer',
              marginTop: '1rem'
            }}
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  if (showTransition) {
    return (
      <div className="dynamic-onboarding-container">
        <div className="question-transition">
          <div className="transition-animation">
            <div className="ripple-effect"></div>
            <div className="transition-icon">✨</div>
          </div>
          <p className="transition-text">Great response! Moving to the next question...</p>
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
            <h2 className="question-title">
              {currentQuestion.title}
              {currentQuestionAnswered && (
                <span style={{ 
                  marginLeft: '1rem', 
                  fontSize: '1rem', 
                  color: '#22c55e',
                  background: 'rgba(34, 197, 94, 0.2)',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '12px'
                }}>
                  ✓ Answered
                </span>
              )}
            </h2>
            <p className="question-subtitle">{currentQuestion.subtitle}</p>
            <div className="question-main">{currentQuestion.question}</div>
            <p className="question-prompt">
              {currentQuestionAnswered 
                ? "You've already answered this question. You can record a new response to replace it, or skip to the next question."
                : currentQuestion.prompt
              }
            </p>
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
              
              {responses.length > 0 && (
                <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      // Reset onboarding for testing
                      setResponses([]);
                      setCurrentQuestionIndex(0);
                      localStorage.removeItem(`onboarding_${avatarId}`);
                      console.log('🔄 Reset onboarding');
                    }}
                    style={{
                      background: 'rgba(255, 193, 7, 0.2)',
                      color: 'white',
                      border: '1px solid rgba(255, 193, 7, 0.4)',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '50px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '500'
                    }}
                  >
                    🔄 Reset (Debug)
                  </button>
                  
                  <button
                    onClick={saveProgress}
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '50px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '500'
                    }}
                  >
                    💾 Save & Continue Later
                  </button>
                  
                  {responses.length < dynamicOnboardingQuestions.length && (
                    <button
                      onClick={() => {
                        // Find next unanswered question
                        let nextQuestionIndex = currentQuestionIndex + 1;
                        while (nextQuestionIndex < dynamicOnboardingQuestions.length) {
                          const nextQuestion = dynamicOnboardingQuestions[nextQuestionIndex];
                          const alreadyAnswered = responses.some(r => r.questionId === nextQuestion.id);
                          if (!alreadyAnswered) {
                            break;
                          }
                          nextQuestionIndex++;
                        }
                        
                        if (nextQuestionIndex < dynamicOnboardingQuestions.length) {
                          setShowTransition(true);
                          setTimeout(() => {
                            setCurrentQuestionIndex(nextQuestionIndex);
                            setShowTransition(false);
                          }, 500);
                        } else {
                          // All questions answered or skipped
                          if (responses.length > 0) {
                            completeOnboarding(responses);
                          }
                        }
                      }}
                      style={{
                        background: 'rgba(147, 71, 255, 0.2)',
                        color: 'white',
                        border: '1px solid rgba(147, 71, 255, 0.4)',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '50px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: '500'
                      }}
                    >
                      ⏭️ Skip to Next Question
                    </button>
                  )}
                </div>
              )}
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
                      <span className="saved-badge">✓ Captured</span>
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
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <button
                onClick={() => completeOnboarding(responses)}
                style={{
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  color: 'white',
                  border: 'none',
                  padding: '1rem 2rem',
                  borderRadius: '50px',
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  margin: '0 auto'
                }}
              >
                🎉 Complete {avatarName}'s Voice Profile
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}