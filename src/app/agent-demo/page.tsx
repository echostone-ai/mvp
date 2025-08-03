'use client';

import { useEffect, useRef } from 'react';

export default function AgentDemo() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Optional: Add any iframe communication logic here
    const handleMessage = (event: MessageEvent) => {
      // Handle messages from the D-ID iframe if needed
      console.log('Message from D-ID agent:', event.data);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8 text-center">
          Echostone AI Agent
        </h1>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8">
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <iframe
              ref={iframeRef}
              src="https://studio.d-id.com/agents/share?id=v2_agt_B5dtCog7&utm_source=copy&key=WjI5dloyeGxNVzloZFhSb01ud3hNVEV3TnpnME9ESTFNRFExTlRJME5qSTBOakk2YlhOSFIzQnpPVEZTZVhCNFJWRk5WWFJqU2xaVA=="
              className="w-full h-full border-0"
              allow="camera; microphone; autoplay; encrypted-media; fullscreen"
              allowFullScreen
              title="Echostone AI Agent"
            />
          </div>
          
          <div className="mt-6 text-center">
            <p className="text-white/80 mb-4">
              Click the avatar above to start talking with your AI agent!
            </p>
            <div className="flex justify-center gap-4 text-sm text-white/60">
              <span>🎤 Voice enabled</span>
              <span>🎭 Real-time avatar</span>
              <span>🧠 AI powered</span>
            </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">How to Use</h2>
          <div className="space-y-2 text-white/80">
            <p>• Click the avatar to activate voice chat</p>
            <p>• Speak naturally - the AI will respond with voice and lip-sync</p>
            <p>• No login required - anyone can interact with your agent</p>
            <p>• The conversation is powered by your D-ID agent configuration</p>
          </div>
        </div>
      </div>
    </div>
  );
}