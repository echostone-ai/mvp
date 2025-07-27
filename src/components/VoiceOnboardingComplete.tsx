'use client';

import { useState } from 'react';
import Link from 'next/link';

interface VoiceOnboardingCompleteProps {
  profileData: any;
}

export default function VoiceOnboardingComplete({ profileData }: VoiceOnboardingCompleteProps) {
  const [isTrainingVoice, setIsTrainingVoice] = useState(false);
  const [voiceModelId, setVoiceModelId] = useState<string | null>(null);

  const handleTrainVoice = async () => {
    setIsTrainingVoice(true);
    try {
      const response = await fetch('/api/onboarding/train-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileData }),
      });

      if (response.ok) {
        const data = await response.json();
        setVoiceModelId(data.voice_model_id);
      } else {
        throw new Error('Voice training failed');
      }
    } catch (error) {
      console.error('Error training voice:', error);
      alert('Error training your voice. You can try again later from your profile.');
    } finally {
      setIsTrainingVoice(false);
    }
  };

  const extractInsights = () => {
    if (!profileData?.responses) return {};
    
    const insights = {
      memories: [],
      influences: [],
      hobbies: [],
      places: [],
      tone: 'warm'
    };

    profileData.responses.forEach((response: any) => {
      if (response.analysis) {
        const { keywords, tone } = response.analysis;
        
        // Categorize based on question index
        switch (response.questionIndex) {
          case 0: // childhood memory
            insights.memories.push(response.transcript);
            break;
          case 1: // influences
            insights.influences.push(...keywords);
            break;
          case 2: // hobbies
            insights.hobbies.push(...keywords);
            break;
          case 3: // places
            insights.places.push(...keywords);
            break;
        }
        
        if (tone) insights.tone = tone;
      }
    });

    return insights;
  };

  const insights = extractInsights();

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      {/* Success Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome to EchoStone!
        </h2>
        <p className="text-lg text-gray-600">
          Your voice profile has been created successfully
        </p>
      </div>

      {/* Profile Summary */}
      <div className="bg-gray-50 rounded-lg p-6 mb-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Your Profile Summary</h3>
        
        <div className="grid md:grid-cols-2 gap-6">
          {insights.memories?.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Cherished Memories</h4>
              <p className="text-gray-600 text-sm line-clamp-3">
                {insights.memories[0]}
              </p>
            </div>
          )}
          
          {insights.influences?.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Key Influences</h4>
              <div className="flex flex-wrap gap-2">
                {insights.influences.slice(0, 4).map((influence: string, index: number) => (
                  <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                    {influence}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {insights.hobbies?.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Interests</h4>
              <div className="flex flex-wrap gap-2">
                {insights.hobbies.slice(0, 4).map((hobby: string, index: number) => (
                  <span key={index} className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                    {hobby}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Voice Tone</h4>
            <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm capitalize">
              {insights.tone}
            </span>
          </div>
        </div>
      </div>

      {/* Voice Training Section */}
      <div className="border-t border-gray-200 pt-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          Create Your Personal Voice
        </h3>
        <p className="text-gray-600 mb-6">
          Train an AI voice model based on your recordings to make conversations even more personal.
        </p>

        {!voiceModelId && !isTrainingVoice && (
          <button
            onClick={handleTrainVoice}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Train My Voice Model
          </button>
        )}

        {isTrainingVoice && (
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="text-blue-600 font-medium">Training your voice model...</span>
            <span className="text-gray-500 text-sm">(This may take a few minutes)</span>
          </div>
        )}

        {voiceModelId && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium text-green-900">Voice model trained successfully!</span>
            </div>
            <p className="text-green-700 text-sm">
              Your personal voice is ready to use in conversations.
            </p>
          </div>
        )}
      </div>

      {/* Next Steps */}
      <div className="mt-8 pt-8 border-t border-gray-200">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          Ready to Start?
        </h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/chat"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium text-center transition-colors"
          >
            Start Chatting with Echo
          </Link>
          <Link
            href="/profile"
            className="bg-gray-100 hover:bg-gray-200 text-gray-900 px-6 py-3 rounded-lg font-medium text-center transition-colors"
          >
            View My Profile
          </Link>
        </div>
      </div>
    </div>
  );
}