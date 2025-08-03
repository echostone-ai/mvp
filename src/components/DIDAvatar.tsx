'use client';

import { useState, useRef, useEffect } from 'react';

interface DIDAvatar {
  voiceId?: string;
  avatarId?: string;
  className?: string;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

export default function DIDAvatar({ 
  voiceId = '21m00Tcm4TlvDq8ikWAM', 
  avatarId,
  className = '',
  onConnected,
  onDisconnected 
}: DIDAvatar) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [streamData, setStreamData] = useState<any>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const connect = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/did-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarId }),
      });

      if (!response.ok) throw new Error('Failed to create stream');
      
      const data = await response.json();
      setStreamData(data);
      
      const peerConnection = new RTCPeerConnection({
        iceServers: data.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      
      peerConnectionRef.current = peerConnection;

      peerConnection.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          videoRef.current.play().catch(console.error);
        }
      };

      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      const answerResponse = await fetch('/api/did-stream/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamId: data.streamId,
          sessionId: data.sessionId,
          answer: answer,
        }),
      });

      if (!answerResponse.ok) throw new Error('Failed to send WebRTC answer');
      
      setIsConnected(true);
      onConnected?.();
      
    } catch (error) {
      console.error('Failed to connect avatar:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const speak = async (text: string) => {
    if (!text.trim() || !streamData || !isConnected) return;
    
    try {
      const response = await fetch('/api/did-stream/send-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamId: streamData.streamId,
          sessionId: streamData.sessionId,
          text,
          voiceId,
        }),
      });

      if (!response.ok) throw new Error('Failed to send audio');
      
    } catch (error) {
      console.error('Failed to make avatar speak:', error);
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
    setStreamData(null);
    onDisconnected?.();
  };

  // Expose methods via ref
  useEffect(() => {
    (window as any).didAvatar = { speak, connect, disconnect, isConnected };
  }, [isConnected, streamData]);

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
        className="w-full h-full object-cover rounded-lg"
      />
      
      {!isConnected && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
          <button
            onClick={connect}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            {isLoading ? 'Connecting...' : 'Connect Avatar'}
          </button>
        </div>
      )}
      
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