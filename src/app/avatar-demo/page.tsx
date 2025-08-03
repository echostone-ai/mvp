'use client';

import { useState, useRef, useEffect } from 'react';
import HeyGenAvatar from '@/components/HeyGenAvatar';
import jonathanProfile from '@/data/jonathan_profile.json';
import { createSeamlessStreamingManager, stopAllSeamlessAudio, splitTextForSeamlessStreaming, SeamlessStreamingManager } from '@/lib/seamlessStreamingUtils';
import { getHomepageDemoSettings } from '@/lib/naturalVoiceSettings';

export default function AvatarDemo() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [conversation, setConversation] = useState<Array<{role: string, content: string}>>([]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [avatarConnected, setAvatarConnected] = useState(false);
  const [avatarSpeaking, setAvatarSpeaking] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const streamingAudioRef = useRef<SeamlessStreamingManager | null>(null);
  const voiceId = 'CO6pxVrMZfyL61ZIglyr'; // Your ElevenLabs voice

  // Check if Web Speech API is available
  const hasSpeechRecognition = typeof window !== 'undefined' &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  useEffect(() => {
    // Auto-connect avatar and give initial greeting
    const initializeAvatar = async () => {
      // Small delay to let component mount
      setTimeout(async () => {
        if ((window as any).heygenAvatar && !avatarConnected) {
          await (window as any).heygenAvatar.connect();
          
          // Give initial greeting after connection
          setTimeout(() => {
            if (avatarConnected) {
              const greetings = [
                "Hey there! I'm Jonathan. Ask me anything about my travels, projects, or life experiences.",
                "Hello! I'm Jonathan Braden. What would you like to know about me?",
                "Hi! I'm Jonathan. I've lived all over the world and love sharing stories. What's on your mind?"
              ];
              const greeting = greetings[Math.floor(Math.random() * greetings.length)];
              speakWithAvatar(greeting);
            }
          }, 2000);
        }
      }, 1000);
    };

    initializeAvatar();

    // Cleanup
    return () => {
      if (streamingAudioRef.current) {
        streamingAudioRef.current.stop();
      }
      stopAllSeamlessAudio();
    };
  }, [avatarConnected]);

  const speakWithAvatar = async (text: string) => {
    if (!avatarConnected || !text.trim()) return;

    try {
      setAvatarSpeaking(true);
      
      // Use HeyGen avatar to speak with your voice
      if ((window as any).heygenAvatar) {
        await (window as any).heygenAvatar.speak(text, voiceId);
      }
      
      // Reset speaking state after estimated duration
      setTimeout(() => {
        setAvatarSpeaking(false);
      }, text.length * 80); // Rough estimate
      
    } catch (error) {
      console.error('Avatar speak error:', error);
      setAvatarSpeaking(false);
    }
  };

  const askQuestion = async (text: string) => {
    if (!text.trim()) return;

    // Stop any existing audio
    await stopAllSeamlessAudio();
    if (streamingAudioRef.current) {
      streamingAudioRef.current.stop();
    }

    setLoading(true);
    setAnswer('');
    
    // Add user message to conversation
    const newConversation = [...conversation, { role: 'user', content: text }];
    setConversation(newConversation);

    try {
      // Get AI response using your existing chat system
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          profileData: jonathanProfile,
          userId: 'jonathan_avatar_demo',
          partnerProfile: null,
          stream: true
        })
      });

      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';
        let lastProcessedLength = 0;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullResponse += chunk;
            setAnswer(fullResponse);

            // Stream to avatar as we get text
            if (avatarConnected && fullResponse.length > lastProcessedLength + 50) {
              const newText = fullResponse.substring(lastProcessedLength);
              const segments = splitTextForSeamlessStreaming(newText);
              
              for (const segment of segments) {
                if (segment.trim() && segment.length > 10 && /[.!?]$/.test(segment)) {
                  await speakWithAvatar(segment);
                  lastProcessedLength = fullResponse.length;
                  break; // Process one segment at a time for real-time feel
                }
              }
            }
          }

          // Process any remaining text
          if (fullResponse.trim() && avatarConnected) {
            const remainingText = fullResponse.substring(lastProcessedLength);
            if (remainingText.trim()) {
              await speakWithAvatar(remainingText);
            }
          }

          // Add AI response to conversation
          setConversation(prev => [...prev, { role: 'assistant', content: fullResponse }]);

        } finally {
          reader.releaseLock();
        }
      } else {
        // Fallback to non-streaming
        const data = await res.json();
        const aiResponse = data.answer || 'Sorry, I encountered an error.';
        setAnswer(aiResponse);
        setConversation(prev => [...prev, { role: 'assistant', content: aiResponse }]);
        
        if (avatarConnected) {
          await speakWithAvatar(aiResponse);
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg = 'Sorry, there was an error processing your request.';
      setAnswer(errorMsg);
      setConversation(prev => [...prev, { role: 'assistant', content: errorMsg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim()) {
      askQuestion(question);
      setQuestion('');
    }
  };

  const startListening = () => {
    if (!hasSpeechRecognition) {
      alert('Speech recognition not supported on this device');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => setListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.trim();
      setQuestion(transcript);
      recognition.stop();
      setListening(false);
      askQuestion(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      alert('Speech recognition error');
    };
    
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setListening(false);
  };

  const quickQuestions = [
    "Tell me about your partner Krissy",
    "What's your dog Romeo like?",
    "How do you like living in Sofia?",
    "What was Austin like?",
    "Tell me about Echostone",
    "What do you think about AI?"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2">
            Talk with Jonathan
          </h1>
          <p className="text-white/70">
            Real-time conversational avatar with my personality and voice
          </p>
        </div>
        
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Avatar Section - Larger */}
          <div className="lg:col-span-2">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
              <HeyGenAvatar 
                className="aspect-video w-full"
                onConnected={() => setAvatarConnected(true)}
                onDisconnected={() => setAvatarConnected(false)}
                onSpeaking={(speaking) => setAvatarSpeaking(speaking)}
              />
              
              {/* Avatar Status */}
              <div className="mt-4 flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    avatarConnected ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className="text-white/70">
                    {avatarConnected ? 'Avatar Connected' : 'Avatar Disconnected'}
                  </span>
                </div>
                
                {avatarSpeaking && (
                  <div className="flex items-center gap-2 text-blue-300">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span>Speaking...</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chat Controls */}
          <div className="space-y-6">
            {/* Voice Input */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Voice Chat</h3>
              
              <button
                onClick={listening ? stopListening : startListening}
                disabled={loading || !avatarConnected}
                className={`w-full py-4 rounded-lg font-medium transition-all ${
                  listening 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white'
                }`}
              >
                {listening ? '🎤 Listening... (tap to stop)' : 
                 loading ? '⏳ Processing...' : 
                 !avatarConnected ? '○ Connect Avatar First' :
                 '🎤 Start Speaking'}
              </button>
              
              {hasSpeechRecognition ? (
                <p className="text-xs text-white/60 mt-2 text-center">
                  Speech recognition supported
                </p>
              ) : (
                <p className="text-xs text-white/60 mt-2 text-center">
                  Speech recognition not available
                </p>
              )}
            </div>

            {/* Text Input */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Text Chat</h3>
              
              <form onSubmit={handleSubmit} className="space-y-3">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask me anything..."
                  className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-white/60 border border-white/30 resize-none"
                  rows={3}
                  disabled={loading || !avatarConnected}
                />
                <button
                  type="submit"
                  disabled={loading || !question.trim() || !avatarConnected}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-2 rounded-lg font-medium transition-colors"
                >
                  {loading ? 'Thinking...' : 'Send'}
                </button>
              </form>
            </div>

            {/* Quick Questions */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Questions</h3>
              <div className="space-y-2">
                {quickQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setQuestion(q);
                      askQuestion(q);
                    }}
                    disabled={loading || !avatarConnected}
                    className="w-full text-left px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:bg-white/5 text-white/80 text-sm transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Current Response */}
        {answer && (
          <div className="mt-6 bg-white/10 backdrop-blur-lg rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-3">Jonathan says:</h3>
            <p className="text-white/90 leading-relaxed">{answer}</p>
          </div>
        )}

        {/* Setup Instructions */}
        {!avatarConnected && (
          <div className="mt-6 bg-yellow-500/10 border border-yellow-500/30 backdrop-blur-lg rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-yellow-300 mb-3">Setup Required</h3>
            <div className="text-yellow-200/80 space-y-2 text-sm">
              <p>To enable the avatar:</p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Get a HeyGen API key from <a href="https://www.heygen.com/" target="_blank" className="underline">heygen.com</a></li>
                <li>Add <code className="bg-black/30 px-2 py-1 rounded">HEYGEN_API_KEY=your_key_here</code> to .env.local</li>
                <li>Refresh the page and click "Connect Avatar"</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}