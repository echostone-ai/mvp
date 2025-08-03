'use client';

import { useState, useEffect } from 'react';
import AvatarChatInterface from '@/components/AvatarChatInterface';
import jonathanProfile from '@/data/jonathan_profile.json';

export default function AvatarChat() {
  const [profileData, setProfileData] = useState<any>(null);
  const voiceId = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || 'CO6pxVrMZfyL61ZIglyr';

  useEffect(() => {
    // Load profile context
    fetch('/api/profile-context')
      .then(res => res.json())
      .then(data => setProfileData(data))
      .catch(err => {
        console.error('Failed to load profile context:', err);
        // Fallback to local profile data
        setProfileData(jonathanProfile);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Chat with Jonathan's Avatar
          </h1>
          <p className="text-white/70">
            Real conversation with AI personality + ElevenLabs voice
          </p>
        </div>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8">
          <AvatarChatInterface 
            profileData={profileData}
            voiceId={voiceId}
            onMessage={(msg) => console.log('User message:', msg)}
          />
        </div>

        {/* Status and Instructions */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-3">HeyGen Integration</h3>
            <div className="space-y-2 text-white/80 text-sm">
              <p>✓ Chat with Jonathan's AI using his profile data</p>
              <p>✓ Responses generated with his personality & memories</p>
              <p>✓ HeyGen avatar with real-time lip-sync</p>
              <p>✓ ElevenLabs voice integration ({voiceId})</p>
              <p>✓ WebRTC streaming for smooth video</p>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-3">Setup Required</h3>
            <div className="space-y-2 text-white/80 text-sm">
              <p>○ Add HeyGen API key to .env.local</p>
              <p>○ Avatar ID: 826b9af269ef40d2b54add2f4777e635</p>
              <p>○ Connect avatar first, then start chatting</p>
              <p>○ Avatar will speak with your ElevenLabs voice</p>
              <p className="text-yellow-300 mt-3">
                💡 Add HEYGEN_API_KEY to .env.local to enable avatar
              </p>
            </div>
          </div>
        </div>

        {/* Quick Test Suggestions */}
        <div className="mt-6 bg-white/10 backdrop-blur-lg rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-3">Try Asking About</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-white/70">
            <div>
              <h4 className="font-medium text-white mb-2">Personal Life</h4>
              <ul className="space-y-1">
                <li>• "Tell me about your partner Krissy"</li>
                <li>• "What's your dog Romeo like?"</li>
                <li>• "How do you like living in Sofia?"</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-white mb-2">Experiences</h4>
              <ul className="space-y-1">
                <li>• "What was Austin like?"</li>
                <li>• "Tell me about your travels"</li>
                <li>• "What celebrities have you met?"</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-white mb-2">Projects & Opinions</h4>
              <ul className="space-y-1">
                <li>• "What is Echostone?"</li>
                <li>• "What do you think about AI?"</li>
                <li>• "What's your political view?"</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}