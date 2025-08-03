'use client';

import { useEffect, useRef } from 'react';

interface DIDAgentProps {
  agentId?: string;
  shareKey?: string;
  className?: string;
  width?: string;
  height?: string;
  onMessage?: (data: any) => void;
}

export default function DIDAgent({ 
  agentId = 'v2_agt_B5dtCog7',
  shareKey = 'WjI5dloyeGxNVzloZFhSb01ud3hNVEV3TnpnME9ESTFNRFExTlRJME5qSTBOakk2YlhOSFIzQnpPVEZTZVhCNFJWRk5WWFJqU2xaVA==',
  className = '',
  width = '100%',
  height = '100%',
  onMessage
}: DIDAgentProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Handle messages from the D-ID iframe
      if (event.origin === 'https://studio.d-id.com') {
        console.log('D-ID Agent message:', event.data);
        onMessage?.(event.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onMessage]);

  const shareUrl = `https://studio.d-id.com/agents/share?id=${agentId}&utm_source=copy&key=${shareKey}`;

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      <iframe
        ref={iframeRef}
        src={shareUrl}
        className="w-full h-full border-0 rounded-lg"
        allow="camera; microphone; autoplay; encrypted-media; fullscreen"
        allowFullScreen
        title="D-ID AI Agent"
        loading="lazy"
      />
    </div>
  );
}