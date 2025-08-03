'use client';

import { useState, useEffect } from 'react';
import SmartDIDAgent from '@/components/SmartDIDAgent';

export default function AgentDemo() {
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load profile context
    fetch('/api/profile-context')
      .then(res => res.json())
      .then(data => {
        setProfileData(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to load profile context:', err);
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8 text-center">
          Talk to Jonathan Braden
        </h1>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8">
          <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
            <SmartDIDAgent 
              className="w-full h-full"
              showProfileSync={true}
            />
          </div>
          
          <div className="mt-6 text-center">
            <p className="text-white/80 mb-4">
              Click the avatar above to start talking with Jonathan's AI!
            </p>
            <div className="flex justify-center gap-4 text-sm text-white/60">
              <span>🎤 Voice enabled</span>
              <span>🎭 Real-time avatar</span>
              <span>🧠 Profile-aware AI</span>
              <span>🎵 ElevenLabs voice</span>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">How to Use</h2>
            <div className="space-y-2 text-white/80">
              <p>• Click the avatar to activate voice chat</p>
              <p>• Speak naturally - Jonathan will respond authentically</p>
              <p>• Ask about his life, travels, opinions, or projects</p>
              <p>• The AI knows his personality, memories, and voice</p>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Profile Status</h2>
            {isLoading ? (
              <div className="text-white/60">Loading profile data...</div>
            ) : profileData ? (
              <div className="space-y-2 text-white/80 text-sm">
                <p>✓ Name: {profileData.identity?.name}</p>
                <p>✓ Location: {profileData.identity?.location}</p>
                <p>✓ Voice ID: {profileData.voice?.elevenlabsVoiceId}</p>
                <p>✓ Personality: Loaded</p>
                <p>✓ Memories: {profileData.background?.recentMemories?.length || 0} recent</p>
                <p>✓ Humor & Language Style: Configured</p>
              </div>
            ) : (
              <div className="text-red-400">Failed to load profile data</div>
            )}
          </div>
        </div>

        <div className="mt-6 bg-white/10 backdrop-blur-lg rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Try Asking About</h2>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2 text-white/70">
              <h3 className="font-medium text-white">Personal Life</h3>
              <p>• His partner Krissy</p>
              <p>• His dog Romeo</p>
              <p>• Living in Sofia, Bulgaria</p>
              <p>• His family in France</p>
            </div>
            <div className="space-y-2 text-white/70">
              <h3 className="font-medium text-white">Experiences</h3>
              <p>• Travels across Europe</p>
              <p>• Austin boat parties</p>
              <p>• Meeting celebrities</p>
              <p>• Remote Year adventures</p>
            </div>
            <div className="space-y-2 text-white/70">
              <h3 className="font-medium text-white">Projects & Opinions</h3>
              <p>• Echostone project</p>
              <p>• Politics and society</p>
              <p>• Music and culture</p>
              <p>• AI and the future</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}