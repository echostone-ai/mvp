'use client';

import { useState } from 'react';
import VoiceOnboarding from '@/components/VoiceOnboarding';
import VoiceOnboardingComplete from '@/components/VoiceOnboardingComplete';

export default function GetStartedPage() {
  const [isComplete, setIsComplete] = useState(false);
  const [profileData, setProfileData] = useState(null);

  const handleOnboardingComplete = (data: any) => {
    setProfileData(data);
    setIsComplete(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Get Started with EchoStone
          </h1>
          <p className="text-lg text-gray-600">
            Let's create your personalized voice experience in just a few minutes
          </p>
        </div>

        {!isComplete ? (
          <VoiceOnboarding onComplete={handleOnboardingComplete} />
        ) : (
          <VoiceOnboardingComplete profileData={profileData} />
        )}
      </div>
    </div>
  );
}