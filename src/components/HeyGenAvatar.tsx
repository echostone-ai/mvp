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
    if (isConnected || isLoading) {
      console.log('⚠️ Already connected or connecting, skipping...');
      return;
    }
    
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
          setIsLoading(false);
          onConnected?.();
        } else if (peerConnection.iceConnectionState === 'disconnected' ||
                   peerConnection.iceConnectionState === 'failed') {
          setIsConnected(false);
          setIsLoading(false);
          onDisconnected?.();
        }
      };

      // 3. Create HeyGen session (this returns an SDP offer from HeyGen)
      console.log('🚀 Starting HeyGen session with token:', token);
      const startResponse = await fetch('/api/heygen/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
        }),
      });
      
      console.log('📡 Start session response status:', startResponse.status);
      console.log('📡 Start session response headers:', Object.fromEntries(startResponse.headers.entries()));

      if (!startResponse.ok) {
        let error;
        let errorText;
        try {
          errorText = await startResponse.text();
          error = JSON.parse(errorText);
        } catch (parseError) {
          console.error('❌ HeyGen start session error (non-JSON):', errorText);
          console.error('❌ Parse error:', parseError);
          throw new Error(`Failed to start HeyGen session: ${startResponse.status} ${startResponse.statusText}`);
        }
        console.error('❌ HeyGen start session error:', error);
        console.error('❌ Raw error text:', errorText);
        throw new Error(error.error || error.message || `Failed to start HeyGen session: ${startResponse.status}`);
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
        const newPeerConnection = peerConnectionRef.current;
        
        // Re-setup event handlers
        newPeerConnection.ontrack = (event) => {
          console.log('📹 Received HeyGen video stream');
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
            videoRef.current.play().catch(console.error);
          }
        };

        newPeerConnection.oniceconnectionstatechange = () => {
          console.log('ICE connection state:', newPeerConnection.iceConnectionState);
          if (newPeerConnection.iceConnectionState === 'connected' || 
              newPeerConnection.iceConnectionState === 'completed') {
            setIsConnected(true);
            setIsLoading(false);
            onConnected?.();
          } else if (newPeerConnection.iceConnectionState === 'disconnected' ||
                     newPeerConnection.iceConnectionState === 'failed') {
            setIsConnected(false);
            setIsLoading(false);
            onDisconnected?.();
          }
        };
      }

      // Get the current peer connection (either original or new one)
      const currentPeerConnection = peerConnectionRef.current;

      // Set HeyGen's offer as remote description
      await currentPeerConnection.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: sdp.sdp,
      }));

      // Create answer
      const answer = await currentPeerConnection.createAnswer();
      await currentPeerConnection.setLocalDescription(answer);

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
      
      // Try to cleanup any stuck sessions
      try {
        await fetch('/api/heygen/close-all-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        console.log('🧹 Attempted to clean up stuck sessions');
      } catch (cleanupError) {
        console.warn('Failed to cleanup sessions:', cleanupError);
      }
      
      alert(`Failed to connect avatar: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const speak = async (text: string, voiceId: string) => {
    console.log('🗣️ HeyGen speak method called:', { 
      text: text.substring(0, 50) + '...', 
      voiceId, 
      sessionId, 
      isConnected 
    });
    
    if (!sessionId || !isConnected) {
      console.warn('❌ Avatar not connected, cannot speak:', { sessionId, isConnected });
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
      
      const responseData = await response.json();
      const { task_id, status } = responseData;
      console.log('✅ HeyGen task submitted:', task_id, 'Status:', status);
      console.log('📋 Full HeyGen response:', responseData);
      
      // More accurate timing based on text length and speaking rate
      // Increased timing to account for HeyGen processing and speaking delays
      const estimatedDuration = Math.max(4000, text.length * 120); // Minimum 4 seconds, slower rate
      console.log('⏰ Setting speaking timeout for:', estimatedDuration, 'ms');
      
      setTimeout(() => {
        console.log('⏰ Speaking timeout completed, setting isSpeaking to false');
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