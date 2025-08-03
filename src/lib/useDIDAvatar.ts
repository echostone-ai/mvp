import { useState, useRef, useCallback } from 'react';

interface UseDIDAvatarOptions {
  voiceId?: string;
  avatarId?: string;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: string) => void;
}

export function useDIDAvatar(options: UseDIDAvatarOptions = {}) {
  const {
    voiceId = '21m00Tcm4TlvDq8ikWAM',
    avatarId,
    onConnected,
    onDisconnected,
    onError
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [streamData, setStreamData] = useState<any>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const connect = useCallback(async () => {
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect avatar';
      console.error('Avatar connection error:', error);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [avatarId, onConnected, onError]);

  const speak = useCallback(async (text: string) => {
    if (!text.trim() || !streamData || !isConnected) return false;
    
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
      return true;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to make avatar speak';
      console.error('Avatar speak error:', error);
      onError?.(errorMessage);
      return false;
    }
  }, [streamData, isConnected, voiceId, onError]);

  const disconnect = useCallback(() => {
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
  }, [onDisconnected]);

  return {
    videoRef,
    isConnected,
    isLoading,
    connect,
    speak,
    disconnect,
  };
}