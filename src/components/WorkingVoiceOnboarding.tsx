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
  console.log('🔄 WorkingVoiceOnboarding component mounting/re-rendering with:', { avatarId, avatarName });
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<SimpleResponse[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Debug when component mounts
  useEffect(() => {
    console.log('🎯 WorkingVoiceOnboarding MOUNTED with avatarId:', avatarId);
    return () => {
      console.log('💀 WorkingVoiceOnboarding UNMOUNTING');
    };
  }, [avatarId]);
  
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
      const currentQuestion = dynamicOnboardingQuestions[currentIndex];
      
      console.log('=== SIMPLE DEBUG ===');
      console.log('Current Index:', currentIndex);
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

      // Add to responses
      const updatedResponses = [...responses, newResponse];
      console.log('BEFORE setResponses - current responses:', responses.length);
      console.log('BEFORE setResponses - updated responses:', updatedResponses.length);
      
      setResponses(updatedResponses);
      
      console.log('AFTER setResponses called');
      console.log('Added response. Total responses:', updatedResponses.length);
      console.log('Response IDs:', updatedResponses.map(r => r.questionId));

      // Move to next question
      const nextIndex = currentIndex + 1;
      console.log('🔄 PROGRESSION DEBUG:');
      console.log('  Current index:', currentIndex);
      console.log('  Next index:', nextIndex);
      console.log('  Total questions:', dynamicOnboardingQuestions.length);
      console.log('  Should progress?', nextIndex < dynamicOnboardingQuestions.length);
      
      if (nextIndex < dynamicOnboardingQuestions.length) {
        console.log('✅ Moving to question', nextIndex, dynamicOnboardingQuestions[nextIndex].id);
        console.log('🔄 BEFORE setCurrentIndex - currentIndex is:', currentIndex);
        setCurrentIndex(nextIndex);
        console.log('🔄 AFTER setCurrentIndex called with:', nextIndex);
        
        // Force a re-render check
        setTimeout(() => {
          console.log('🔄 DELAYED CHECK - currentIndex should now be:', nextIndex);
        }, 100);
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

      // Categorize responses and build personality
      const personalityParts = [`I am ${avatarName}`];
      
      allResponses.forEach(response => {
        const question = dynamicOnboardingQuestions.find(q => q.id === response.questionId);
        if (question) {
          console.log(`Categorizing "${response.transcript.substring(0, 30)}..." as ${question.category}`);
          
          profileData.factualInfo.push(response.transcript);
          
          switch (question.category) {
            case 'memories':
              profileData.memories.push(response.transcript);
              personalityParts.push('I have cherished memories that shape who I am');
              break;
            case 'influences':
              profileData.influences.push(response.transcript);
              personalityParts.push('I\'ve been shaped by important people in my life');
              break;
            case 'passions':
              profileData.passions.push(response.transcript);
              personalityParts.push('I have things I\'m passionate about that bring me joy');
              break;
            case 'places':
              profileData.places.push(response.transcript);
              personalityParts.push('There are places that hold special meaning for me');
              break;
            case 'philosophy':
              profileData.philosophy.push(response.transcript);
              personalityParts.push('I have beliefs and principles that guide my life');
              break;
            case 'creativity':
              profileData.creativity.push(response.transcript);
              personalityParts.push('I express myself creatively in my own unique way');
              break;
          }
        }
      });

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

  const currentQuestion = dynamicOnboardingQuestions[currentIndex];
  const progress = ((currentIndex + 1) / dynamicOnboardingQuestions.length) * 100;

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      {/* Debug info */}
      <div style={{ background: '#ffe6e6', padding: '10px', marginBottom: '20px', fontSize: '12px' }}>
        <strong>DEBUG:</strong> currentIndex = {currentIndex}, responses.length = {responses.length}
        <br />
        Current Question ID: {currentQuestion?.id}
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <div style={{ background: '#f0f0f0', height: '8px', borderRadius: '4px' }}>
          <div style={{ 
            background: '#007bff', 
            height: '100%', 
            width: `${progress}%`, 
            borderRadius: '4px',
            transition: 'width 0.3s'
          }} />
        </div>
        <p style={{ textAlign: 'center', margin: '10px 0' }}>
          Question {currentIndex + 1} of {dynamicOnboardingQuestions.length}
        </p>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2>{currentQuestion.title}</h2>
        <p style={{ color: '#666', marginBottom: '10px' }}>{currentQuestion.subtitle}</p>
        <p style={{ fontSize: '18px', marginBottom: '20px' }}>{currentQuestion.question}</p>
        <p style={{ color: '#888', fontStyle: 'italic' }}>{currentQuestion.prompt}</p>
      </div>

      <div style={{ textAlign: 'center' }}>
        {!isRecording && !isProcessing && (
          <button
            onClick={startRecording}
            style={{
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '50px',
              padding: '15px 30px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            🎤 Start Recording
          </button>
        )}

        {isRecording && (
          <button
            onClick={stopRecording}
            style={{
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '50px',
              padding: '15px 30px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            ⏹️ Stop Recording
          </button>
        )}

        {isProcessing && (
          <div style={{ color: '#007bff' }}>
            Processing your response...
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

      <div style={{ marginTop: '30px', textAlign: 'center', color: '#666' }}>
        <p>Responses so far: {responses.length}</p>
        {responses.map((r, i) => (
          <div key={i} style={{ margin: '5px 0', fontSize: '12px' }}>
            {i + 1}. {r.questionId}: {r.transcript.substring(0, 50)}...
          </div>
        ))}
      </div>
    </div>
  );
}