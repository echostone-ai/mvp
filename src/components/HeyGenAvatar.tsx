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

      // 3. Create HeyGen session (this returns an SDP offer from HeyGen)
      const startResponse = await fetch('/api/heygen/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
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
        // Update peer connection with HeyGen's ICE servers
        peerConnection.close();
        peerConnectionRef.current = new RTCPeerConnection({
          iceServers: ice_servers,
        });
        peerConnection = peerConnectionRef.current;
        
        // Re-setup event handlers
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
      }

      // Set HeyGen's offer as remote description
      await peerConnection.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: sdp.sdp,
      }));

      // Create answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      // Send answer back to HeyGen (we need a new API endpoint for this)
      const answerResponse = await fetch('/api/heygen/set-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session_id,
          sdp: answer,
        }),
      });

      if (!answerResponse.ok) {
        console.warn('Failed to send answer to HeyGen:', await answerResponse.text());
      }

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
    <div className={`heygen-avatar-container ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        className="heygen-avatar-video"
      />
      
      {/* Connection overlay */}
      {!isConnected && (
        <div className="heygen-avatar-overlay">
          <div className="heygen-avatar-connect-prompt">
            <div className="heygen-avatar-icon">🎭</div>
            <h3 className="heygen-avatar-title">HeyGen Avatar</h3>
            <p className="heygen-avatar-description">
              Connect to start your conversation with Jonathan
            </p>
            <button
              onClick={connect}
              disabled={isLoading}
              className="heygen-avatar-connect-btn"
            >
              <div className="heygen-avatar-connect-content">
                {isLoading ? (
                  <>
                    <div className="loading-spinner" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <span className="heygen-avatar-connect-icon">⚡</span>
                    <span>Connect Avatar</span>
                  </>
                )}
              </div>
            </button>
          </div>
        </div>
      )}
      
      {/* Disconnect button */}
      {isConnected && (
        <div className="heygen-avatar-disconnect">
          <button
            onClick={disconnect}
            className="heygen-avatar-disconnect-btn"
            title="Disconnect Avatar"
          >
            <span className="heygen-avatar-disconnect-icon">×</span>
          </button>
        </div>
      )}
    </div>
  );
}