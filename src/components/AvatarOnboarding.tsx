'use client';

import { useState, useCallback } from 'react';
import { ProfileOptimizer } from '@/lib/profileOptimization';
import styles from './AvatarOnboarding.module.css';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<any>;
}

interface AvatarConfig {
  name: string;
  personality: string;
  background: string;
  conversationStyle: string;
  currentSituation: string;
  heygenAvatarId: string;
  voiceId: string;
  // Additional fields for seed endpoint
  given_name?: string;
  pronouns?: string;
  home_city?: string;
  home_country?: string;
  timezone?: string;
  birth_year?: string;
  profession?: string;
  passions?: string;
  partner_name?: string;
  children?: string;
  parents?: string;
  pets?: string;
  tagline?: string;
  tone_style?: string;
  identity_pillars?: string;
  signature_memories?: string;
}

export default function AvatarOnboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [config, setConfig] = useState<Partial<AvatarConfig>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [basicsReady, setBasicsReady] = useState(false);
  const [seedingBasics, setSeedingBasics] = useState(false);

  const steps: OnboardingStep[] = [
    {
      id: 'basic-info',
      title: 'Basic Information',
      description: 'Tell us about your avatar',
      component: BasicInfoStep
    },
    {
      id: 'personality',
      title: 'Personality',
      description: 'Define their character',
      component: PersonalityStep
    },
    {
      id: 'voice-avatar',
      title: 'Voice & Avatar',
      description: 'Choose appearance and voice',
      component: VoiceAvatarStep
    },
    {
      id: 'test-chat',
      title: 'Test & Deploy',
      description: 'Try your avatar',
      component: TestChatStep
    }
  ];

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, steps.length]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const handleSeedBasics = useCallback(async () => {
    setSeedingBasics(true);
    
    try {
      // Prepare form basics from config
      const formBasics = {
        full_name: config.name,
        given_name: config.given_name || config.name?.split(' ')[0],
        profession: config.profession,
        tone_style: config.conversationStyle,
        identity_pillars: config.personality,
        signature_memories: config.background,
        home_city: config.home_city,
        home_country: config.home_country,
        timezone: config.timezone,
        birth_year: config.birth_year,
        pronouns: config.pronouns,
        passions: config.passions,
        partner_name: config.partner_name,
        children: config.children,
        parents: config.parents,
        pets: config.pets,
        tagline: config.tagline
      };

      // Remove undefined values
      const cleanedBasics = Object.fromEntries(
        Object.entries(formBasics).filter(([_, value]) => value !== undefined && value !== '')
      );

      const response = await fetch('/api/onboarding/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatarSlug: config.name?.toLowerCase().replace(/\s+/g, '-'),
          formBasics: cleanedBasics,
          freeText: config.background
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Basics seeded:', result);
        setBasicsReady(true);
      } else {
        const error = await response.json();
        console.error('Failed to seed basics:', error);
      }
    } catch (error) {
      console.error('Failed to seed basics:', error);
    } finally {
      setSeedingBasics(false);
    }
  }, [config]);

  const handleCreateAvatar = useCallback(async () => {
    setIsCreating(true);
    
    try {
      // First seed basics if not already done
      if (!basicsReady) {
        await handleSeedBasics();
      }

      // Create optimized profile
      const optimizedProfile = ProfileOptimizer.optimizeProfile({
        full_name: config.name,
        personality: config.personality,
        summary: config.background,
        location: config.currentSituation,
        humorStyle: { description: config.conversationStyle }
      });

      // Save to Supabase
      const response = await fetch('/api/avatars/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: optimizedProfile,
          heygenConfig: {
            avatarId: config.heygenAvatarId,
            voiceId: config.voiceId
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Avatar created:', result);
        // Redirect to avatar demo with new ID
        window.location.href = `/avatar-demo?id=${result.avatarId}`;
      }
    } catch (error) {
      console.error('Failed to create avatar:', error);
    } finally {
      setIsCreating(false);
    }
  }, [config, basicsReady, handleSeedBasics]);

  const CurrentStepComponent = steps[currentStep].component;

  return (
    <div className={styles.onboardingContainer}>
      <div className={styles.onboardingHeader}>
        <h1>Create Your AI Avatar</h1>
        <div className={styles.progressBar}>
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`${styles.progressStep} ${index <= currentStep ? styles.active : ''}`}
            >
              <div className={styles.stepNumber}>{index + 1}</div>
              <div className={styles.stepTitle}>{step.title}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.onboardingContent}>
        <CurrentStepComponent
          config={config}
          setConfig={setConfig}
          onNext={handleNext}
          onBack={handleBack}
          isLast={currentStep === steps.length - 1}
          onCreateAvatar={handleCreateAvatar}
          isCreating={isCreating}
          onSeedBasics={handleSeedBasics}
          basicsReady={basicsReady}
          seedingBasics={seedingBasics}
        />
      </div>
    </div>
  );
}

// Step Components
function BasicInfoStep({ config, setConfig, onNext, onSeedBasics, basicsReady, seedingBasics }: any) {
  return (
    <div className="step-content">
      <h2>Basic Information</h2>
      <div className="form-group">
        <label>Avatar Name</label>
        <input
          type="text"
          value={config.name || ''}
          onChange={(e) => setConfig({ ...config, name: e.target.value })}
          placeholder="e.g., Sarah Johnson"
        />
      </div>
      <div className="form-group">
        <label>Background (2-3 sentences)</label>
        <textarea
          value={config.background || ''}
          onChange={(e) => setConfig({ ...config, background: e.target.value })}
          placeholder="Brief background about who they are..."
          rows={3}
        />
      </div>
      <div className="form-group">
        <label>Current Situation</label>
        <input
          type="text"
          value={config.currentSituation || ''}
          onChange={(e) => setConfig({ ...config, currentSituation: e.target.value })}
          placeholder="e.g., Living in New York, working as a designer"
        />
      </div>
      
      {/* Optional additional fields */}
      <div className="form-group">
        <label>Profession (optional)</label>
        <input
          type="text"
          value={config.profession || ''}
          onChange={(e) => setConfig({ ...config, profession: e.target.value })}
          placeholder="e.g., Software Engineer, Teacher"
        />
      </div>
      <div className="form-group">
        <label>Location (optional)</label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={config.home_city || ''}
            onChange={(e) => setConfig({ ...config, home_city: e.target.value })}
            placeholder="City"
          />
          <input
            type="text"
            value={config.home_country || ''}
            onChange={(e) => setConfig({ ...config, home_country: e.target.value })}
            placeholder="Country"
          />
        </div>
      </div>

      <div className="button-group" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button 
          onClick={onSeedBasics}
          disabled={!config.name || !config.background || seedingBasics || basicsReady}
          className="seed-btn"
          style={{ 
            backgroundColor: basicsReady ? '#10b981' : '#3b82f6',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '5px',
            cursor: basicsReady ? 'default' : 'pointer'
          }}
        >
          {seedingBasics ? 'Seeding Basics...' : basicsReady ? '✓ Basics Ready' : 'Seed Basics'}
        </button>
        <button 
          onClick={onNext}
          disabled={!config.name || !config.background}
          className="next-btn"
        >
          Next: Personality
        </button>
      </div>
    </div>
  );
}

function PersonalityStep({ config, setConfig, onNext, onBack, basicsReady }: any) {
  const personalityOptions = [
    { id: 'friendly', label: 'Friendly & Warm', description: 'Welcoming and approachable' },
    { id: 'witty', label: 'Witty & Sarcastic', description: 'Quick with jokes and clever remarks' },
    { id: 'professional', label: 'Professional & Polished', description: 'Business-focused and articulate' },
    { id: 'casual', label: 'Casual & Laid-back', description: 'Relaxed and conversational' },
    { id: 'energetic', label: 'Energetic & Enthusiastic', description: 'High energy and positive' }
  ];

  return (
    <div className="step-content">
      <h2>Personality</h2>
      <div className="personality-grid">
        {personalityOptions.map((option) => (
          <div
            key={option.id}
            className={`personality-card ${config.personality === option.id ? 'selected' : ''}`}
            onClick={() => setConfig({ ...config, personality: option.id })}
          >
            <h3>{option.label}</h3>
            <p>{option.description}</p>
          </div>
        ))}
      </div>
      <div className="form-group">
        <label>Conversation Style (optional)</label>
        <textarea
          value={config.conversationStyle || ''}
          onChange={(e) => setConfig({ ...config, conversationStyle: e.target.value })}
          placeholder="Any specific way they should talk or respond..."
          rows={2}
        />
      </div>
      <div className="button-group">
        <button onClick={onBack} className="back-btn">Back</button>
        {basicsReady && (
          <div style={{ color: '#10b981', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            ✓ Basics Ready
          </div>
        )}
        <button 
          onClick={onNext}
          disabled={!config.personality}
          className="next-btn"
        >
          Next: Voice & Avatar
        </button>
      </div>
    </div>
  );
}

function VoiceAvatarStep({ config, setConfig, onNext, onBack, basicsReady }: any) {
  const avatarOptions = [
    { id: 'avatar1', name: 'Professional Male', preview: '/avatars/male-professional.jpg' },
    { id: 'avatar2', name: 'Casual Female', preview: '/avatars/female-casual.jpg' },
    { id: 'avatar3', name: 'Young Professional', preview: '/avatars/young-professional.jpg' }
  ];

  const voiceOptions = [
    { id: 'voice1', name: 'Warm Male Voice', sample: '/voices/warm-male.mp3' },
    { id: 'voice2', name: 'Professional Female', sample: '/voices/professional-female.mp3' },
    { id: 'voice3', name: 'Friendly Neutral', sample: '/voices/friendly-neutral.mp3' }
  ];

  return (
    <div className="step-content">
      <h2>Choose Avatar & Voice</h2>
      
      <div className="section">
        <h3>Avatar Appearance</h3>
        <div className="avatar-grid">
          {avatarOptions.map((avatar) => (
            <div
              key={avatar.id}
              className={`avatar-option ${config.heygenAvatarId === avatar.id ? 'selected' : ''}`}
              onClick={() => setConfig({ ...config, heygenAvatarId: avatar.id })}
            >
              <img src={avatar.preview} alt={avatar.name} />
              <p>{avatar.name}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <h3>Voice</h3>
        <div className="voice-grid">
          {voiceOptions.map((voice) => (
            <div
              key={voice.id}
              className={`voice-option ${config.voiceId === voice.id ? 'selected' : ''}`}
              onClick={() => setConfig({ ...config, voiceId: voice.id })}
            >
              <div className="voice-info">
                <h4>{voice.name}</h4>
                <button className="play-sample">▶ Play Sample</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="button-group">
        <button onClick={onBack} className="back-btn">Back</button>
        {basicsReady && (
          <div style={{ color: '#10b981', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            ✓ Basics Ready
          </div>
        )}
        <button 
          onClick={onNext}
          disabled={!config.heygenAvatarId || !config.voiceId}
          className="next-btn"
        >
          Next: Test & Deploy
        </button>
      </div>
    </div>
  );
}

function TestChatStep({ config, onBack, onCreateAvatar, isCreating, basicsReady }: any) {
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState('');

  const handleTest = async () => {
    if (!testMessage.trim()) return;
    
    try {
      const response = await fetch('/api/chat-fast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: testMessage,
          profile: config
        })
      });
      
      const result = await response.json();
      setTestResponse(result.answer);
    } catch (error) {
      setTestResponse('Error testing avatar');
    }
  };

  return (
    <div className="step-content">
      <h2>Test Your Avatar</h2>
      
      <div className="avatar-preview">
        <h3>{config.name}</h3>
        <p>Personality: {config.personality}</p>
        <p>Background: {config.background}</p>
      </div>

      <div className="test-chat">
        <h3>Test Conversation</h3>
        <div className="chat-input">
          <input
            type="text"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="Ask your avatar something..."
          />
          <button onClick={handleTest}>Test</button>
        </div>
        {testResponse && (
          <div className="test-response">
            <strong>{config.name}:</strong> {testResponse}
          </div>
        )}
      </div>

      <div className="button-group">
        <button onClick={onBack} className="back-btn">Back</button>
        {basicsReady && (
          <div style={{ color: '#10b981', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            ✓ Basics Ready
          </div>
        )}
        <button 
          onClick={onCreateAvatar}
          disabled={isCreating}
          className="create-btn"
        >
          {isCreating ? 'Creating Avatar...' : 'Create Avatar'}
        </button>
      </div>
    </div>
  );
}