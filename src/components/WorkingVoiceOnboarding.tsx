'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { dynamicOnboardingQuestions } from '@/lib/onboardingQuestions';

interface SimpleResponse {
  questionId: string;
  transcript: string;
  audioBase64: string;
}

interface Props {
  onComplete: (data: any) => void;
  avatarId: string;
  avatarName: string;
}

export default function WorkingVoiceOnboarding({ onComplete, avatarId, avatarName }: Props) {
  console.log('🔄 WorkingVoiceOnboarding rendering with:', { avatarId, avatarName });
  
  // Use refs to persist data across re-renders
  const currentIndexRef = useRef(0);
  const responsesRef = useRef<SimpleResponse[]>([]);
  
  // State for UI updates
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<SimpleResponse[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Sync refs with state
  const updateCurrentIndex = (newIndex: number) => {
    console.log('📍 Updating index from', currentIndexRef.current, 'to', newIndex);
    currentIndexRef.current = newIndex;
    setCurrentIndex(newIndex);
  };
  
  const updateResponses = (newResponses: SimpleResponse[]) => {
    console.log('📝 Updating responses from', responsesRef.current.length, 'to', newResponses.length);
    responsesRef.current = newResponses;
    setResponses(newResponses);
  };
  
  // Debug when component mounts
  useEffect(() => {
    console.log('🎯 WorkingVoiceOnboarding MOUNTED');
    return () => {
      console.log('💀 WorkingVoiceOnboarding UNMOUNTING');
    };
  }, []);
  
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

  const handleRecordingComplete = async (audioBlob: Blob) => {
    console.log('🎤 handleRecordingComplete called');
    setIsProcessing(true);
    
    try {
      const actualCurrentIndex = currentIndexRef.current;
      const currentQuestion = dynamicOnboardingQuestions[actualCurrentIndex];
      
      console.log('=== SIMPLE DEBUG ===');
      console.log('State Index:', currentIndex, 'Ref Index:', actualCurrentIndex);
      console.log('Question ID:', currentQuestion.id);
      console.log('Question Category:', currentQuestion.category);
      
      // Convert to base64
      const audioBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(audioBlob);
      });

      // Transcribe
      const formData = new FormData();
      formData.append('audioBlob', audioBlob);
      
      console.log('Sending audio for transcription...');
      const transcribeResponse = await fetch('/api/onboarding/transcribe', {
        method: 'POST',
        body: formData,
      });

      console.log('Transcription response status:', transcribeResponse.status);
      
      if (!transcribeResponse.ok) {
        const errorText = await transcribeResponse.text();
        console.error('Transcription failed:', errorText);
        throw new Error(`Transcription failed: ${errorText}`);
      }

      const transcriptionData = await transcribeResponse.json();
      console.log('Transcription result:', transcriptionData.text);
      
      // Create response
      const newResponse: SimpleResponse = {
        questionId: currentQuestion.id,
        transcript: transcriptionData.text,
        audioBase64
      };

      // Add to responses using ref
      const updatedResponses = [...responsesRef.current, newResponse];
      console.log('BEFORE update - ref responses:', responsesRef.current.length);
      console.log('BEFORE update - state responses:', responses.length);
      console.log('AFTER update - updated responses:', updatedResponses.length);
      
      updateResponses(updatedResponses);
      
      console.log('Added response. Total responses:', updatedResponses.length);
      console.log('Response IDs:', updatedResponses.map(r => r.questionId));

      // Move to next question using ref
      const nextIndex = actualCurrentIndex + 1;
      console.log('🔄 PROGRESSION DEBUG:');
      console.log('  Ref index:', actualCurrentIndex);
      console.log('  State index:', currentIndex);
      console.log('  Next index:', nextIndex);
      console.log('  Total questions:', dynamicOnboardingQuestions.length);
      
      if (nextIndex < dynamicOnboardingQuestions.length) {
        console.log('✅ Moving to question', nextIndex, dynamicOnboardingQuestions[nextIndex].id);
        updateCurrentIndex(nextIndex);
      } else {
        console.log('🎯 All questions done, completing...');
        await completeOnboarding(updatedResponses);
      }
      
    } catch (error) {
      console.error('❌ CRITICAL ERROR in handleRecordingComplete:', error);
      console.error('Error stack:', error.stack);
      alert(`Error processing response: ${error.message}`);
    } finally {
      console.log('🔄 Setting isProcessing to false');
      setIsProcessing(false);
    }
  };

  const completeOnboarding = async (allResponses: SimpleResponse[]) => {
    try {
      console.log('Completing with', allResponses.length, 'responses');
      
      // Build profile data
      const profileData = {
        name: avatarName,
        personality: `I am ${avatarName}, `,
        personalityTraits: [],
        factualInfo: [`My name is ${avatarName}`],
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

      // Enhanced profile data extraction
      const personalityParts = [`I am ${avatarName}`];
      const extractedTraits = [];
      const keyFacts = [];
      
      allResponses.forEach(response => {
        const question = dynamicOnboardingQuestions.find(q => q.id === response.questionId);
        if (question) {
          console.log(`Categorizing "${response.transcript.substring(0, 30)}..." as ${question.category}`);
          
          // Add to appropriate category
          switch (question.category) {
            case 'memories':
              profileData.memories.push(response.transcript);
              personalityParts.push('I have cherished memories that shape who I am');
              // Extract key elements from memories
              if (response.transcript.includes('grew up') || response.transcript.includes('childhood')) {
                keyFacts.push('Has meaningful childhood experiences');
              }
              break;
            case 'influences':
              profileData.influences.push(response.transcript);
              personalityParts.push('I\'ve been shaped by important people in my life');
              // Extract relationship insights
              if (response.transcript.toLowerCase().includes('brother') || response.transcript.toLowerCase().includes('sister')) {
                extractedTraits.push('Values family relationships');
              }
              if (response.transcript.toLowerCase().includes('music')) {
                extractedTraits.push('Influenced by music');
              }
              break;
            case 'passions':
              profileData.passions.push(response.transcript);
              personalityParts.push('I have things I\'m passionate about that bring me joy');
              // Extract specific interests
              const interests = ['art', 'painting', 'music', 'writing', 'history', 'travel', 'nature', 'cooking'];
              interests.forEach(interest => {
                if (response.transcript.toLowerCase().includes(interest)) {
                  extractedTraits.push(`Passionate about ${interest}`);
                }
              });
              break;
            case 'places':
              profileData.places.push(response.transcript);
              personalityParts.push('There are places that hold special meaning for me');
              // Extract travel/location insights
              if (response.transcript.toLowerCase().includes('travel') || response.transcript.toLowerCase().includes('country')) {
                extractedTraits.push('Enjoys traveling and exploring');
              }
              break;
            case 'philosophy':
              profileData.philosophy.push(response.transcript);
              personalityParts.push('I have beliefs and principles that guide my life');
              // Extract values
              const values = ['kind', 'generous', 'hard work', 'good to others', 'help'];
              values.forEach(value => {
                if (response.transcript.toLowerCase().includes(value)) {
                  extractedTraits.push(`Values ${value}`);
                }
              });
              break;
            case 'creativity':
              profileData.creativity.push(response.transcript);
              personalityParts.push('I express myself creatively in my own unique way');
              // Extract creative pursuits
              const creative = ['paint', 'write', 'cook', 'music', 'art', 'poetry'];
              creative.forEach(pursuit => {
                if (response.transcript.toLowerCase().includes(pursuit)) {
                  extractedTraits.push(`Creative in ${pursuit}`);
                }
              });
              break;
          }
          
          // Add to factual info (keep this for compatibility)
          profileData.factualInfo.push(response.transcript);
        }
      });

      // Build enhanced personality traits
      profileData.personalityTraits = [...new Set(extractedTraits)]; // Remove duplicates
      
      // Build comprehensive personality description
      profileData.personality = personalityParts.join('. ') + '. I speak authentically from my experiences and share my genuine thoughts and feelings.';

      console.log('Final profile data:', profileData);

      // Save profile data to database
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: session } = await supabase.auth.getSession();
        const user = session.session?.user;

        if (user) {
          // Check if avatar exists first
          const { data: existingAvatar } = await supabase
            .from('avatar_profiles')
            .select('id')
            .eq('id', avatarId)
            .eq('user_id', user.id)
            .single();

          if (existingAvatar) {
            const { error } = await supabase
              .from('avatar_profiles')
              .update({
                profile_data: profileData,
                updated_at: new Date().toISOString()
              })
              .eq('id', avatarId)
              .eq('user_id', user.id);

            if (error) {
              console.error('Database update error:', error);
            } else {
              console.log('✅ Profile data saved to database');
            }
          } else {
            console.warn('⚠️ Avatar not found in database, skipping save');
          }
        }
      } catch (dbError) {
        console.error('Database save failed:', dbError);
      }

      // Train voice
      let voiceId = null;
      try {
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
          voiceId = voiceData.voice_model_id;
          console.log('Voice trained:', voiceId);
        }
      } catch (error) {
        console.error('Voice training failed:', error);
      }

      onComplete({
        responses: allResponses,
        profileData,
        voiceModelId: voiceId,
        avatarId,
        avatarName
      });
      
    } catch (error) {
      console.error('Completion error:', error);
    }
  };

  const actualIndex = currentIndexRef.current;
  const currentQuestion = dynamicOnboardingQuestions[actualIndex];
  const progress = ((actualIndex + 1) / dynamicOnboardingQuestions.length) * 100;

  return (
    <div style={{ 
      padding: '40px 20px', 
      maxWidth: '800px', 
      margin: '0 auto',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      color: 'white'
    }}>
      {/* Progress indicator */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.2)', 
          height: '6px', 
          borderRadius: '3px',
          overflow: 'hidden'
        }}>
          <div style={{ 
            background: 'linear-gradient(90deg, #4facfe 0%, #00f2fe 100%)', 
            height: '100%', 
            width: `${progress}%`, 
            borderRadius: '3px',
            transition: 'width 0.5s ease'
          }} />
        </div>
        <p style={{ 
          textAlign: 'center', 
          margin: '15px 0 0 0',
          fontSize: '14px',
          opacity: 0.9
        }}>
          Question {actualIndex + 1} of {dynamicOnboardingQuestions.length}
        </p>
      </div>

      <div style={{ 
        textAlign: 'center', 
        marginBottom: '50px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '20px',
        padding: '40px 30px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <div style={{ 
          fontSize: '48px', 
          marginBottom: '20px',
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
        }}>
          {currentQuestion.icon}
        </div>
        <h2 style={{ 
          fontSize: '28px', 
          marginBottom: '15px',
          fontWeight: '600',
          textShadow: '0 2px 4px rgba(0,0,0,0.3)'
        }}>
          {currentQuestion.title}
        </h2>
        <p style={{ 
          color: 'rgba(255, 255, 255, 0.8)', 
          marginBottom: '20px',
          fontSize: '16px'
        }}>
          {currentQuestion.subtitle}
        </p>
        <p style={{ 
          fontSize: '20px', 
          marginBottom: '25px',
          lineHeight: '1.5',
          fontWeight: '400'
        }}>
          {currentQuestion.question}
        </p>
        <p style={{ 
          color: 'rgba(255, 255, 255, 0.7)', 
          fontStyle: 'italic',
          fontSize: '16px',
          lineHeight: '1.4'
        }}>
          {currentQuestion.prompt}
        </p>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        {!isRecording && !isProcessing && (
          <button
            onClick={startRecording}
            style={{
              background: 'linear-gradient(135deg, #ff6b6b, #ee5a24)',
              color: 'white',
              border: 'none',
              borderRadius: '60px',
              padding: '20px 40px',
              fontSize: '18px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 8px 25px rgba(238, 90, 36, 0.4)',
              transition: 'all 0.3s ease',
              transform: 'translateY(0)',
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 12px 35px rgba(238, 90, 36, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 8px 25px rgba(238, 90, 36, 0.4)';
            }}
          >
            🎤 Start Recording
          </button>
        )}

        {isRecording && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ff6b6b, #ee5a24)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'pulse 1.5s infinite',
              boxShadow: '0 0 30px rgba(238, 90, 36, 0.6)'
            }}>
              <div style={{ fontSize: '32px' }}>🎤</div>
            </div>
            <button
              onClick={stopRecording}
              style={{
                background: 'linear-gradient(135deg, #00b894, #00a085)',
                color: 'white',
                border: 'none',
                borderRadius: '60px',
                padding: '15px 35px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 8px 25px rgba(0, 184, 148, 0.4)',
                transition: 'all 0.3s ease'
              }}
            >
              ⏹️ Stop Recording
            </button>
          </div>
        )}

        {isProcessing && (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: '15px' 
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid rgba(255, 255, 255, 0.3)',
              borderTop: '4px solid white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <div style={{ 
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '16px',
              fontWeight: '500'
            }}>
              Processing your response...
            </div>
          </div>
        )}

        {responses.length > 0 && !isProcessing && (
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={() => completeOnboarding(responses)}
              style={{
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '25px',
                padding: '10px 20px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              💾 Save Progress ({responses.length} responses)
            </button>
            
            <button
              onClick={() => {
                const nextIndex = currentIndex + 1;
                if (nextIndex < dynamicOnboardingQuestions.length) {
                  console.log('Manual skip to question', nextIndex);
                  setCurrentIndex(nextIndex);
                }
              }}
              style={{
                background: '#ffc107',
                color: 'black',
                border: 'none',
                borderRadius: '25px',
                padding: '10px 20px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              ⏭️ Skip Question (Debug)
            </button>
          </div>
        )}
      </div>

      {responsesRef.current.length > 0 && (
        <div style={{ 
          marginTop: '40px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '15px',
          padding: '25px',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <h3 style={{ 
            textAlign: 'center', 
            marginBottom: '20px',
            fontSize: '18px',
            fontWeight: '600',
            color: 'rgba(255, 255, 255, 0.9)'
          }}>
            Your Journey So Far ({responsesRef.current.length} responses)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {responsesRef.current.map((r, i) => {
              const question = dynamicOnboardingQuestions.find(q => q.id === r.questionId);
              return (
                <div key={i} style={{ 
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  padding: '15px',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}>
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: '600',
                    marginBottom: '8px',
                    color: 'rgba(255, 255, 255, 0.8)'
                  }}>
                    {question?.icon} {question?.title}
                  </div>
                  <div style={{ 
                    fontSize: '13px',
                    lineHeight: '1.4',
                    color: 'rgba(255, 255, 255, 0.9)'
                  }}>
                    {r.transcript.length > 100 ? r.transcript.substring(0, 100) + '...' : r.transcript}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}