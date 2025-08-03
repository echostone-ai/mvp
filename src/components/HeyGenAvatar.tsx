'use client';

import { useState, useRef, useEffect } from 'react';

interface HeyGenAvatarProps {
  className?: string;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onSpeaking?: (speaking: boolean) => void;
}

export default function HeyGenAvatar({ 
  className = '',
  onConnected,
  onDisconnected,
  onSpeaking
}: HeyGenAvatarProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const connect = async () => {
    try {
      setIsLoading(true);
      console.log('🎭 Connecting to HeyGen avatar...');

      // 1. Create session token
      const tokenResponse = await fetch('/api/heygen/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!tokenResponse.ok) throw new Error('Failed to create HeyGen session');
      
      const { token } = await tokenResponse.json();

      // 2. Set up WebRTC connection
      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      
      peerConnectionRef.current = peerConnection;

      // Handle incoming video stream
      peerConnection.ontrack = (event) => {
        console.log('📹 Received HeyGen video stream');
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          videoRef.current.play().catch(console.error);
        }
      };

      peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'connected') {
          setIsConnected(true);
          onConnected?.();
        }
      };

      // Create offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // 3. Start HeyGen session
      const startResponse = await fetch('/api/heygen/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: token,
          sdp: offer,
        }),
      });

      if (!startResponse.ok) throw new Error('Failed to start HeyGen session');
      
      const { sdp, session_id } = await startResponse.json();
      setSessionId(session_id);

      // Set remote description
      await peerConnection.setRemoteDescription(new RTCSessionDescription({
        type: 'answer',
        sdp: sdp,
      }));

      console.log('✅ HeyGen avatar connected');
      
    } catch (error) {
      console.error('Failed to connect HeyGen avatar:', error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const speak = async (text: string, voiceId: string) => {
    if (!sessionId || !isConnected) {
      console.warn('Avatar not connected, cannot speak');
      return false;
    }

    try {
      setIsSpeaking(true);
      onSpeaking?.(true);

      const response = await fetch('/api/heygen/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          text,
          voiceId,
        }),
      });

      if (!response.ok) throw new Error('Failed to make avatar speak');
      
      console.log('🎤 Avatar is speaking:', text.substring(0, 50) + '...');
      
      // HeyGen will handle the timing, but we'll reset after a delay
      setTimeout(() => {
        setIsSpeaking(false);
        onSpeaking?.(false);
      }, text.length * 100); // Rough estimate based on text length

      return true;
      
    } catch (error) {
      console.error('Failed to make avatar speak:', error);
      setIsSpeaking(false);
      onSpeaking?.(false);
      return false;
    }
  };

  const disconnect = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsConnected(false);
    setSessionId(null);
    setIsSpeaking(false);
    onDisconnected?.();
  };

  // Expose methods globally for easy access
  useEffect(() => {
    (window as any).heygenAvatar = { speak, connect, disconnect, isConnected };
  }, [isConnected, sessionId]);

  useEffect(() => {
    return disconnect; // Cleanup on unmount
  }, []);

  return (
    <div className={`relative ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        className="w-full h-full object-cover rounded-lg bg-black"
      />
      
      {/* Connection overlay */}
      {!isConnected && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-lg">
          <div className="text-center text-white">
            <div className="text-6xl mb-4">🎭</div>
            <p className="text-lg mb-4">HeyGen Avatar</p>
            <button
              onClick={connect}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {isLoading ? 'Connecting...' : 'Connect Avatar'}
            </button>
          </div>
        </div>
      )}
      
      {/* Status indicators */}
      {isConnected && (
        <div className="absolute top-2 left-2 space-y-1">
          <div className="bg-green-500/90 text-white px-2 py-1 rounded text-xs font-medium">
            ✓ Connected
          </div>
          {isSpeaking && (
            <div className="bg-blue-500/90 text-white px-2 py-1 rounded text-xs font-medium">
              🎤 Speaking
            </div>
          )}
        </div>
      )}
      
      {/* Disconnect button */}
      {isConnected && (
        <div className="absolute top-2 right-2">
          <button
            onClick={disconnect}
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}