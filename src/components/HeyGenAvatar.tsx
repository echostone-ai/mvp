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

      if (!tokenResponse.ok) {
        const error = await tokenResponse.json();
        throw new Error(error.error || 'Failed to create HeyGen token');
      }
      
      const { token } = await tokenResponse.json();
      console.log('✅ HeyGen token created');

      // 2. Set up WebRTC connection
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
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
        if (peerConnection.iceConnectionState === 'connected' || 
            peerConnection.iceConnectionState === 'completed') {
          setIsConnected(true);
          onConnected?.();
        } else if (peerConnection.iceConnectionState === 'disconnected' ||
                   peerConnection.iceConnectionState === 'failed') {
          setIsConnected(false);
          onDisconnected?.();
        }
      };

      // Create offer
      const offer = await peerConnection.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true,
      });
      await peerConnection.setLocalDescription(offer);

      // 3. Start HeyGen session
      const startResponse = await fetch('/api/heygen/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          sdp: offer,
        }),
      });

      if (!startResponse.ok) {
        const error = await startResponse.json();
        throw new Error(error.error || 'Failed to start HeyGen session');
      }
      
      const { sdp, session_id, ice_servers } = await startResponse.json();
      setSessionId(session_id);

      // Update ICE servers if provided
      if (ice_servers && ice_servers.length > 0) {
        console.log('Using HeyGen ICE servers:', ice_servers);
      }

      // Set remote description
      await peerConnection.setRemoteDescription(new RTCSessionDescription({
        type: 'answer',
        sdp: sdp,
      }));

      console.log('✅ HeyGen avatar connected with session:', session_id);
      
    } catch (error) {
      console.error('Failed to connect HeyGen avatar:', error);
      setIsConnected(false);
      alert(`Failed to connect avatar: ${error.message}`);
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

      console.log('🎤 Avatar speaking:', text.substring(0, 50) + '...');

      const response = await fetch('/api/heygen/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          text,
          voiceId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to make avatar speak');
      }
      
      const { task_id, status } = await response.json();
      console.log('✅ HeyGen task submitted:', task_id, 'Status:', status);
      
      // More accurate timing based on text length and speaking rate
      const estimatedDuration = Math.max(3000, text.length * 100); // Minimum 3 seconds
      
      setTimeout(() => {
        setIsSpeaking(false);
        onSpeaking?.(false);
      }, estimatedDuration);

      return true;
      
    } catch (error) {
      console.error('Failed to make avatar speak:', error);
      setIsSpeaking(false);
      onSpeaking?.(false);
      return false;
    }
  };

  const disconnect = async () => {
    try {
      // Close HeyGen session first
      if (sessionId) {
        await fetch('/api/heygen/close-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
      }
    } catch (error) {
      console.warn('Error closing HeyGen session:', error);
    }

    // Close WebRTC connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Clear video
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    // Reset state
    setIsConnected(false);
    setSessionId(null);
    setIsSpeaking(false);
    onDisconnected?.();
    
    console.log('🔚 HeyGen avatar disconnected');
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