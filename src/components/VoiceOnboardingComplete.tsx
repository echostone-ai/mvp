'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Avatar {
  id: string;
  name: string;
  description: string;
  voice_id: string | null;
  profile_data: any;
  created_at: string;
}

interface VoiceOnboardingCompleteProps {
  profileData: any;
  selectedAvatar?: Avatar | null;
}

export default function VoiceOnboardingComplete({ profileData, selectedAvatar }: VoiceOnboardingCompleteProps) {
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
    <div className="get-started-card">
      <div className="completion-container">
        {/* Success Header */}
        <div className="completion-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="completion-title">
          Welcome to EchoStone!
        </h2>
        <p className="completion-subtitle">
          Your voice profile has been created successfully
          {selectedAvatar && ` for ${selectedAvatar.name}`}
        </p>

        {/* Profile Summary */}
        <div className="profile-summary">
          <h3 className="profile-summary-title">Your Profile Summary</h3>
          
          <div className="profile-summary-grid">
            {insights.memories?.length > 0 && (
              <div className="profile-summary-item">
                <h4>Cherished Memories</h4>
                <p>{insights.memories[0]}</p>
              </div>
            )}
            
            {insights.influences?.length > 0 && (
              <div className="profile-summary-item">
                <h4>Key Influences</h4>
                <div className="profile-tags">
                  {insights.influences.slice(0, 4).map((influence: string, index: number) => (
                    <span key={index} className="profile-tag influence">
                      {influence}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {insights.hobbies?.length > 0 && (
              <div className="profile-summary-item">
                <h4>Interests</h4>
                <div className="profile-tags">
                  {insights.hobbies.slice(0, 4).map((hobby: string, index: number) => (
                    <span key={index} className="profile-tag hobby">
                      {hobby}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            <div className="profile-summary-item">
              <h4>Voice Tone</h4>
              <div className="profile-tags">
                <span className="profile-tag tone">
                  {insights.tone}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Voice Training Section */}
        <div className="voice-training-section">
          <h3 className="voice-training-title">
            Create Your Personal Voice
          </h3>
          <p className="voice-training-description">
            Train an AI voice model based on your recordings to make conversations even more personal.
          </p>

          {!voiceModelId && !isTrainingVoice && (
            <button
              onClick={handleTrainVoice}
              className="train-voice-button"
            >
              Train My Voice Model
            </button>
          )}

          {isTrainingVoice && (
            <div className="voice-training-status">
              <div className="processing-spinner"></div>
              <span>Training your voice model...</span>
              <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>(This may take a few minutes)</span>
            </div>
          )}

          {voiceModelId && (
            <div className="voice-training-success">
              <div className="voice-training-success-icon">
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Voice model trained successfully!</span>
              </div>
              <p className="voice-training-success-text">
                Your personal voice is ready to use in conversations.
              </p>
            </div>
          )}
        </div>

        {/* Next Steps */}
        <div className="next-steps-section">
          <h3 className="next-steps-title">
            Ready to Start?
          </h3>
          <div className="next-steps-actions">
            <Link
              href={selectedAvatar ? `/chat?avatar=${selectedAvatar.id}` : "/chat"}
              className="next-step-button primary"
            >
              Start Chatting with {selectedAvatar?.name || 'Echo'}
            </Link>
            <Link
              href="/profile"
              className="next-step-button secondary"
            >
              View My Profile
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}