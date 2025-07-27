'use client';

import { useState, useRef, useCallback } from 'react';
import { onboardingQuestions, OnboardingResponse } from '@/lib/onboardingQuestions';

interface VoiceOnboardingProps {
  onComplete: (data: any) => void;
}

export default function VoiceOnboarding({ onComplete }: VoiceOnboardingProps) {
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

      // Create profile data
      const profileData = {
        responses: allResponses,
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
    <div className="bg-white rounded-lg shadow-lg p-8">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Question {currentQuestionIndex + 1} of {onboardingQuestions.length}</span>
          <span>{Math.round(progress)}% Complete</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Current Question */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          {currentQuestion}
        </h2>
        <p className="text-gray-600">
          Take 30-60 seconds to share your thoughts. Speak naturally and from the heart.
        </p>
      </div>

      {/* Recording Controls */}
      <div className="text-center">
        {!isRecording && !isProcessing && (
          <button
            onClick={startRecording}
            className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-full text-lg font-medium transition-colors flex items-center gap-3 mx-auto"
          >
            <div className="w-4 h-4 bg-white rounded-full"></div>
            Start Recording
          </button>
        )}

        {isRecording && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-500 font-medium">Recording...</span>
            </div>
            <button
              onClick={stopRecording}
              className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-4 rounded-full text-lg font-medium transition-colors"
            >
              Stop Recording
            </button>
          </div>
        )}

        {isProcessing && (
          <div className="flex items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-blue-600 font-medium">Processing your response...</span>
          </div>
        )}
      </div>

      {/* Previous Responses */}
      {responses.length > 0 && (
        <div className="mt-8 pt-8 border-t border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Your Responses</h3>
          <div className="space-y-3">
            {responses.map((response, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">
                  Q{index + 1}: {response.question}
                </p>
                <p className="text-gray-900">
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