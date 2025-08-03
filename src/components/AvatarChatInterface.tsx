'use client';

import { useState, useRef } from 'react';
import HeyGenAvatar from './HeyGenAvatar';

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
  
  const avatarRef = useRef<any>(null);

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

      // 2. Make HeyGen avatar speak with your voice
      if (avatarConnected && (window as any).heygenAvatar) {
        await (window as any).heygenAvatar.speak(aiResponse, voiceId);
      }

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
        <HeyGenAvatar 
          className="aspect-video"
          onConnected={() => setAvatarConnected(true)}
          onDisconnected={() => setAvatarConnected(false)}
          onSpeaking={(speaking) => setIsAvatarSpeaking(speaking)}
        />

        {/* Avatar Status */}
        <div className="bg-white/10 rounded-lg p-4">
          <h3 className="font-medium text-white mb-2">Avatar Status</h3>
          <div className="space-y-1 text-sm text-white/70">
            <p>Platform: HeyGen</p>
            <p>Avatar ID: {process.env.HEYGEN_AVATAR_ID || '826b9af269ef40d2b54add2f4777e635'}</p>
            <p>Voice: {voiceId}</p>
            <p>Profile: {profileData?.name || 'Jonathan Braden'}</p>
            <p>Status: {
              !avatarConnected ? '○ Disconnected' :
              isAvatarSpeaking ? '🎤 Speaking' : 
              '✓ Ready'
            }</p>
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
              <p className="text-sm">Connect the avatar first, then ask about travels, projects, opinions, or anything else.</p>
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
            disabled={isLoading || !message.trim() || !avatarConnected}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
        
        {!avatarConnected && (
          <p className="text-xs text-white/50 mt-2 text-center">
            Connect the avatar first to enable chat
          </p>
        )}
      </div>
    </div>
  );
}