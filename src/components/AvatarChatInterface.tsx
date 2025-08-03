'use client';

import { useState, useRef, useEffect } from 'react';

interface AvatarChatInterfaceProps {
  profileData: any;
  voiceId: string;
  onMessage?: (message: string) => void;
}

export default function AvatarChatInterface({ 
  profileData, 
  voiceId,
  onMessage 
}: AvatarChatInterfaceProps) {
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState<Array<{role: string, content: string}>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [avatarConnected, setAvatarConnected] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const sendMessage = async () => {
    if (!message.trim()) return;
    
    const userMessage = message;
    setMessage('');
    setConversation(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    onMessage?.(userMessage);

    try {
      // 1. Get AI response using your existing chat system
      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: conversation,
        }),
      });

      if (!chatResponse.ok) throw new Error('Chat API failed');
      
      const aiResponse = await chatResponse.text();
      setConversation(prev => [...prev, { role: 'assistant', content: aiResponse }]);

      // 2. Generate speech with your ElevenLabs voice
      await generateSpeechAndAvatar(aiResponse);

    } catch (error) {
      console.error('Chat error:', error);
      setConversation(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSpeechAndAvatar = async (text: string) => {
    try {
      setIsAvatarSpeaking(true);

      // Generate speech with ElevenLabs
      const speechResponse = await fetch('/api/generate-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          voiceId: voiceId,
        }),
      });

      if (speechResponse.ok) {
        const audioBlob = await speechResponse.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Play audio
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.play();
        }

        // TODO: When D-ID API key is added, also send to D-ID for lip-sync
        // This would make the avatar video sync with the speech
        
        // Clean up when audio ends
        if (audioRef.current) {
          audioRef.current.onended = () => {
            setIsAvatarSpeaking(false);
            URL.revokeObjectURL(audioUrl);
          };
        }
      }

    } catch (error) {
      console.error('Speech generation error:', error);
      setIsAvatarSpeaking(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6 h-full">
      {/* Avatar Section */}
      <div className="space-y-4">
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={false}
            className="w-full h-full object-cover"
            poster="/api/placeholder/640/360"
          />
          
          {/* Avatar placeholder when not connected */}
          {!avatarConnected && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center text-white">
                <div className="text-6xl mb-4">🎭</div>
                <p className="text-lg mb-2">{profileData?.name || 'Jonathan Braden'}</p>
                <p className="text-sm text-white/70">Add D-ID API key for live avatar</p>
              </div>
            </div>
          )}
          
          {/* Speaking indicator */}
          {isAvatarSpeaking && (
            <div className="absolute top-4 left-4 bg-green-500/90 text-white px-3 py-1 rounded-full text-sm font-medium">
              🎤 Speaking...
            </div>
          )}
        </div>

        {/* Avatar Status */}
        <div className="bg-white/10 rounded-lg p-4">
          <h3 className="font-medium text-white mb-2">Avatar Status</h3>
          <div className="space-y-1 text-sm text-white/70">
            <p>Voice: {voiceId}</p>
            <p>Profile: {profileData?.name || 'Jonathan Braden'}</p>
            <p>Status: {isAvatarSpeaking ? '🎤 Speaking' : '💤 Idle'}</p>
          </div>
        </div>
      </div>

      {/* Chat Section */}
      <div className="flex flex-col h-full">
        {/* Chat History */}
        <div className="flex-1 bg-black/20 rounded-lg p-4 overflow-y-auto mb-4 space-y-3">
          {conversation.length === 0 && (
            <div className="text-white/60 text-center py-8">
              <p className="text-lg mb-2">Start chatting with {profileData?.name || 'Jonathan'}!</p>
              <p className="text-sm">Ask about travels, projects, opinions, or anything else.</p>
            </div>
          )}
          
          {conversation.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white/20 text-white'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/20 text-white px-4 py-2 rounded-lg">
                <p className="text-sm">Thinking...</p>
              </div>
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="flex gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Chat with ${profileData?.name || 'Jonathan'}...`}
            className="flex-1 px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/60 border border-white/30 resize-none"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !message.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
      </div>

      {/* Hidden audio element for speech playback */}
      <audio ref={audioRef} />
    </div>
  );
}