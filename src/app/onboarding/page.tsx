// Avatar Onboarding Page
import AvatarOnboarding from '@/components/AvatarOnboarding';

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <AvatarOnboarding />
    </div>
  );
}

export const metadata = {
  title: 'Create Your AI Avatar | Echostone',
  description: 'Build a personalized AI avatar with HeyGen integration'
};