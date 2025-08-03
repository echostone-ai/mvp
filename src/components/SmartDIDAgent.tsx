'use client';

import { useEffect, useRef, useState } from 'react';
import jonathanProfile from '@/data/jonathan_profile.json';

interface SmartDIDAgentProps {
  className?: string;
  width?: string;
  height?: string;
  showProfileSync?: boolean;
}

export default function SmartDIDAgent({ 
  className = '',
  width = '100%',
  height = '100%',
  showProfileSync = true
}: SmartDIDAgentProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isProfileSynced, setIsProfileSynced] = useState(false);
  const [voiceId] = useState(process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || 'CO6pxVrMZfyL61ZIglyr');

  // Extract key profile data for the agent
  const profileContext = {
    name: jonathanProfile.full_name,
    nickname: jonathanProfile.nickname,
    location: jonathanProfile.location,
    personality: jonathanProfile.personality,
    bio: jonathanProfile.bio,
    partner: jonathanProfile.partner,
    dog: jonathanProfile.dog,
    hobbies: jonathanProfile.hobbies,
    catchphrases: jonathanProfile.catchphrases,
    favoriteMusic: jonathanProfile.favoriteMusic,
    voiceId: voiceId,
    humorStyle: jonathanProfile.humorStyle.description,
    languageStyle: jonathanProfile.languageStyle.description,
    recentMemories: jonathanProfile.memories.slice(0, 5), // Last 5 memories
    friends: jonathanProfile.friends_summary,
    goals: jonathanProfile.goalsAndDreams
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin === 'https://studio.d-id.com') {
        console.log('D-ID Agent message:', event.data);
        
        // If the agent is ready, send profile context
        if (event.data.type === 'agent_ready' && !isProfileSynced) {
          sendProfileContext();
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isProfileSynced]);

  const sendProfileContext = () => {
    if (iframeRef.current) {
      const contextMessage = {
        type: 'profile_context',
        data: {
          profile: profileContext,
          instructions: `
            You are Jonathan Braden, speaking as yourself. Use this profile data to respond authentically:
            
            - Your personality: ${profileContext.personality}
            - Your current location: ${profileContext.location}
            - Your humor style: ${profileContext.humorStyle}
            - Your language style: ${profileContext.languageStyle}
            - Your voice ID for ElevenLabs: ${profileContext.voiceId}
            
            Key details to remember:
            - You live with your partner ${profileContext.partner.name} (nicknames: ${profileContext.partner.nicknames.join(', ')})
            - Your dog is ${profileContext.dog}
            - Your catchphrases include: ${profileContext.catchphrases.join(', ')}
            - You love music like: ${profileContext.favoriteMusic.join(', ')}
            
            Recent memories to reference:
            ${profileContext.recentMemories.map((memory, i) => `${i + 1}. ${memory}`).join('\n')}
            
            Respond as Jonathan would - with humor, authenticity, and the personality described in your profile.
          `
        }
      };

      iframeRef.current.contentWindow?.postMessage(contextMessage, 'https://studio.d-id.com');
      setIsProfileSynced(true);
      console.log('Profile context sent to D-ID agent');
    }
  };

  // Try to send context after a delay (in case agent loads slowly)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isProfileSynced) {
        sendProfileContext();
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [isProfileSynced]);

  const shareUrl = `https://studio.d-id.com/agents/share?id=v2_agt_B5dtCog7&utm_source=copy&key=WjI5dloyeGxNVzloZFhSb01ud3hNVEV3TnpnME9ESTFNRFExTlRJME5qSTBOakk2YlhOSFIzQnpPVEZTZVhCNFJWRk5WWFJqU2xaVA==`;

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      <iframe
        ref={iframeRef}
        src={shareUrl}
        className="w-full h-full border-0 rounded-lg"
        allow="camera; microphone; autoplay; encrypted-media; fullscreen"
        allowFullScreen
        title="Jonathan Braden AI Agent"
        loading="lazy"
      />
      
      {showProfileSync && (
        <div className="absolute top-2 left-2 z-10">
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            isProfileSynced 
              ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
              : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
          }`}>
            {isProfileSynced ? '✓ Profile Synced' : '⏳ Syncing Profile...'}
          </div>
        </div>
      )}
    </div>
  );
}