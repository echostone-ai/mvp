'use client';

import WorkingVoiceOnboarding from '@/components/WorkingVoiceOnboarding';

export default function TestWorkingOnboardingPage() {
  const handleComplete = (data: any) => {
    console.log('Onboarding completed:', data);
    alert('Onboarding completed! Check console for data.');
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Test Working Onboarding</h1>
      <p>This is an isolated test of the WorkingVoiceOnboarding component</p>
      
      <WorkingVoiceOnboarding
        onComplete={handleComplete}
        avatarId="test-avatar-123"
        avatarName="Test Avatar"
      />
    </div>
  );
}