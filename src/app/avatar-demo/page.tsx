'use client';

import { useState, useRef, useEffect } from 'react';

export default function AvatarDemo() {
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('Hello! Welcome to my D-ID avatar demo.');
    const [streamData, setStreamData] = useState<any>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const [voiceId, setVoiceId] = useState('21m00Tcm4TlvDq8ikWAM'); // Default ElevenLabs voice

    const initializeStream = async () => {
        try {
            setIsLoading(true);

            // Create D-ID stream
            const response = await fetch('/api/did-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });

            if (!response.ok) throw new Error('Failed to create stream');

            const data = await response.json();
            setStreamData(data);

            // Set up WebRTC connection
            const peerConnection = new RTCPeerConnection({
                iceServers: data.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }],
            });

            peerConnectionRef.current = peerConnection;

            // Handle incoming video stream
            peerConnection.ontrack = (event) => {
                console.log('📹 Received video stream');
                if (videoRef.current && event.streams[0]) {
                    videoRef.current.srcObject = event.streams[0];
                    videoRef.current.play().catch(console.error);
                }
            };

            peerConnection.oniceconnectionstatechange = () => {
                console.log('ICE connection state:', peerConnection.iceConnectionState);
            };

            // Set remote description from D-ID offer
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));

            // Create answer
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            // Send answer back to D-ID
            const answerResponse = await fetch('/api/did-stream/answer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    streamId: data.streamId,
                    sessionId: data.sessionId,
                    answer: answer,
                }),
            });

            if (!answerResponse.ok) {
                throw new Error('Failed to send WebRTC answer');
            }

            console.log('📡 WebRTC connection established');
            setIsConnected(true);

        } catch (error) {
            console.error('Failed to initialize stream:', error);
            alert('Failed to connect to avatar. Check console for details.');
        } finally {
            setIsLoading(false);
        }
    };

    const sendMessage = async () => {
        if (!message.trim() || !streamData) return;

        try {
            setIsLoading(true);

            // Generate speech and send to D-ID
            const response = await fetch('/api/did-stream/send-audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    streamId: streamData.streamId,
                    sessionId: streamData.sessionId,
                    text: message,
                    voiceId,
                }),
            });

            if (!response.ok) throw new Error('Failed to send audio');

            console.log('🎤 Audio sent to avatar');

        } catch (error) {
            console.error('Failed to send message:', error);
            alert('Failed to send message to avatar. Check console for details.');
        } finally {
            setIsLoading(false);
        }
    };

    const cleanup = () => {
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsConnected(false);
        setStreamData(null);
    };

    useEffect(() => {
        return cleanup; // Cleanup on unmount
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-bold text-white mb-8 text-center">
                    D-ID Avatar Demo
                </h1>

                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8">
                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Video Section */}
                        <div className="space-y-4">
                            <h2 className="text-2xl font-semibold text-white">Avatar Video</h2>
                            <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted={false}
                                    className="w-full h-full object-cover"
                                />
                                {!isConnected && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                        <div className="text-white text-center">
                                            <div className="text-6xl mb-4">🎭</div>
                                            <p>Click "Connect Avatar" to start</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={initializeStream}
                                    disabled={isLoading || isConnected}
                                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                                >
                                    {isLoading ? 'Connecting...' : isConnected ? 'Connected' : 'Connect Avatar'}
                                </button>

                                <button
                                    onClick={cleanup}
                                    disabled={!isConnected}
                                    className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                                >
                                    Disconnect
                                </button>
                            </div>
                        </div>

                        {/* Controls Section */}
                        <div className="space-y-4">
                            <h2 className="text-2xl font-semibold text-white">Controls</h2>

                            <div>
                                <label className="block text-white mb-2">Voice ID (ElevenLabs)</label>
                                <input
                                    type="text"
                                    value={voiceId}
                                    onChange={(e) => setVoiceId(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/60 border border-white/30"
                                    placeholder="Enter ElevenLabs voice ID"
                                />
                            </div>

                            <div>
                                <label className="block text-white mb-2">Message to Speak</label>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-white/60 border border-white/30 resize-none"
                                    rows={4}
                                    placeholder="Enter text for the avatar to speak..."
                                />
                            </div>

                            <button
                                onClick={sendMessage}
                                disabled={isLoading || !isConnected || !message.trim()}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                            >
                                {isLoading ? 'Speaking...' : 'Make Avatar Speak'}
                            </button>

                            <div className="text-sm text-white/70 space-y-2">
                                <p><strong>Quick Test Messages:</strong></p>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        "Hello there!",
                                        "How are you doing today?",
                                        "This is a D-ID avatar demo.",
                                        "The weather is beautiful today."
                                    ].map((text) => (
                                        <button
                                            key={text}
                                            onClick={() => setMessage(text)}
                                            className="px-3 py-1 bg-white/20 rounded text-xs hover:bg-white/30 transition-colors"
                                        >
                                            {text}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status */}
                <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-white">
                            Status: {isConnected ? 'Connected to D-ID Avatar' : 'Disconnected'}
                        </span>
                    </div>
                    {streamData && (
                        <div className="mt-2 text-sm text-white/70">
                            Stream ID: {streamData.streamId}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}