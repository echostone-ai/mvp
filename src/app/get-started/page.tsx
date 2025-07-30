'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import VoiceOnboardingComplete from '@/components/VoiceOnboardingComplete';
import AvatarCreationFlow from '@/components/AvatarCreationFlow';
import WorkingVoiceOnboarding from '@/components/WorkingVoiceOnboarding';
import PageShell from '@/components/PageShell';
import LoadingSpinner from '@/components/LoadingSpinner';
import '@/styles/get-started.css';

interface Avatar {
  id: string;
  name: string;
  description: string;
  voice_id: string | null;
  profile_data: any;
  created_at: string;
}

function GetStartedContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  
  const [isComplete, setIsComplete] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [user, setUser] = useState<any>(null);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);
  const [avatarChoice, setAvatarChoice] = useState<'existing' | 'new' | null>(null);
  const [loading, setLoading] = useState(true);
  const [resumingSession, setResumingSession] = useState(false);
  const [newAvatarData, setNewAvatarData] = useState<{name: string; photo: File | null; avatarId: string} | null>(null);
  const [showDynamicOnboarding, setShowDynamicOnboarding] = useState(false);

  useEffect(() => {
    async function loadUserData() {
      const { data: session } = await supabase.auth.getSession();
      const currentUser = session.session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        // Load existing avatars
        const { data: avatarData } = await supabase
          .from('avatar_profiles')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false });
        
        setAvatars(avatarData || []);

        // If resuming a session, load session data
        if (sessionId) {
          setResumingSession(true);
          try {
            const response = await fetch(`/api/onboarding/get-session?sessionId=${sessionId}`);
            const sessionData = await response.json();
            
            if (sessionData.success && sessionData.session) {
              // Find the avatar for this session
              const sessionAvatar = avatarData?.find(a => a.id === sessionData.session.avatar_id);
              if (sessionAvatar) {
                setSelectedAvatar(sessionAvatar);
                setAvatarChoice('existing');
              } else {
                setAvatarChoice('new');
              }
            }
          } catch (error) {
            console.error('Error loading session:', error);
          }
        }
      }
      
      setLoading(false);
    }

    loadUserData();
  }, [sessionId]);

  const handleOnboardingComplete = (data: any) => {
    setProfileData(data);
    setIsComplete(true);
  };

  const handleAvatarCreated = (avatarData: {name: string; photo: File | null; avatarId: string}) => {
    setNewAvatarData(avatarData);
    setShowDynamicOnboarding(true);
  };

  const handleBackToAvatarChoice = () => {
    setAvatarChoice(null);
    setNewAvatarData(null);
    setShowDynamicOnboarding(false);
  };

  if (loading) {
    return (
      <PageShell>
        <div className="get-started-container">
          <LoadingSpinner message="Loading your profile..." size="lg" />
        </div>
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell>
        <div className="get-started-container">
          <div className="get-started-content">
            <div className="get-started-header">
              <h1 className="get-started-title">Get Started with EchoStone</h1>
              <p className="get-started-subtitle">
                Please sign in to create your personalized voice experience
              </p>
            </div>
            <div className="enhanced-card">
              <div style={{ textAlign: 'center' }}>
                <a href="/login" className="next-step-button primary">
                  Sign In to Continue
                </a>
              </div>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="get-started-container">
        <div className="get-started-content">
          <div className="get-started-header">
          <h1 className="get-started-title">Get Started with EchoStone</h1>
          <p className="get-started-subtitle">
            Let's create your personalized voice experience in just a few minutes
          </p>
          
          {/* New Conversational Option */}
          <div style={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '15px',
            padding: '20px',
            margin: '20px 0',
            textAlign: 'center',
            color: 'white'
          }}>
            <h3 style={{ margin: '0 0 10px 0' }}>🎭 Try Our New Conversational Experience!</h3>
            <p style={{ margin: '0 0 15px 0', opacity: 0.9 }}>
              Have a natural conversation with AI that asks dynamic follow-up questions
            </p>
            <button
              onClick={() => window.location.href = '/conversational-onboarding'}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '25px',
                padding: '10px 20px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              🚀 Try Conversational Onboarding
            </button>
          </div>
        </div>

        {!avatarChoice && (
          <div className="get-started-card">
            <div className="avatar-selection-section">
              <h2 className="avatar-selection-title">Choose Your Avatar</h2>
              <p className="avatar-selection-description">
                Would you like to add voice training to an existing avatar or create a new one?
              </p>
              
              <div className="avatar-options">
                {avatars.length > 0 && (
                  <div 
                    className="avatar-option"
                    onClick={() => setAvatarChoice('existing')}
                  >
                    <div className="avatar-option-title">Use Existing Avatar</div>
                    <div className="avatar-option-description">
                      Add voice training to one of your {avatars.length} existing avatar{avatars.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                )}
                
                <div 
                  className="avatar-option"
                  onClick={() => setAvatarChoice('new')}
                >
                  <div className="avatar-option-title">Create New Avatar</div>
                  <div className="avatar-option-description">
                    Create a brand new avatar with personalized voice training
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {avatarChoice === 'existing' && !selectedAvatar && (
          <div className="get-started-card">
            <div className="avatar-selection-section">
              <h2 className="avatar-selection-title">Select an Avatar</h2>
              <p className="avatar-selection-description">
                Choose which avatar you'd like to add voice training to:
              </p>
              
              <div className="avatar-options">
                {avatars.map((avatar) => (
                  <div 
                    key={avatar.id}
                    className="avatar-option"
                    onClick={() => {
                      console.log('Selected avatar:', avatar);
                      setSelectedAvatar(avatar);
                    }}
                  >
                    <div className="avatar-option-title">{avatar.name}</div>
                    <div className="avatar-option-description">
                      {avatar.description || 'No description'}
                    </div>
                  </div>
                ))}
              </div>
              
              <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                <button 
                  className="next-step-button secondary"
                  onClick={() => setAvatarChoice(null)}
                >
                  ← Back to Options
                </button>
              </div>
            </div>
          </div>
        )}

        {avatarChoice === 'new' && !showDynamicOnboarding && (
          <AvatarCreationFlow 
            onComplete={handleAvatarCreated}
            onBack={handleBackToAvatarChoice}
          />
        )}

        {(showDynamicOnboarding || (selectedAvatar && avatarChoice === 'existing') || resumingSession) && !isComplete && (
          <>
            {/* Only render if we have valid avatar data */}
            {(newAvatarData?.avatarId || selectedAvatar?.id) ? (
              <WorkingVoiceOnboarding 
                key={newAvatarData?.avatarId || selectedAvatar?.id} // Add stable key
                onComplete={handleOnboardingComplete}
                avatarId={newAvatarData?.avatarId || selectedAvatar?.id || ''}
                avatarName={newAvatarData?.name || selectedAvatar?.name || 'Your Avatar'}
              />
            ) : (
              <div className="get-started-card">
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <p style={{ color: '#ef4444', marginBottom: '1rem' }}>
                    Error: Avatar information is missing. Please try again.
                  </p>
                  <button 
                    onClick={() => {
                      setSelectedAvatar(null);
                      setAvatarChoice(null);
                      setShowDynamicOnboarding(false);
                    }}
                    className="next-step-button secondary"
                  >
                    ← Back to Avatar Selection
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {isComplete && (
          <VoiceOnboardingComplete 
            profileData={profileData}
            selectedAvatar={selectedAvatar}
          />
        )}
        </div>
      </div>
    </PageShell>
  );
}

export default function GetStartedPage() {
  return (
    <Suspense fallback={
      <PageShell>
        <div className="get-started-container">
          <LoadingSpinner message="Loading..." size="lg" />
        </div>
      </PageShell>
    }>
      <GetStartedContent />
    </Suspense>
  );
}