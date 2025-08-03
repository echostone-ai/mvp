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
  const [isInitializing, setIsInitializing] = useState(true);
  
  const recognitionRef = useRef<any>(null);
  const streamingAudioRef = useRef<SeamlessStreamingManager | null>(null);
  const voiceId = 'CO6pxVrMZfyL61ZIglyr';

  const hasSpeechRecognition = typeof window !== 'undefined' &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  useEffect(() => {
    const initializeAvatar = async () => {
      setTimeout(async () => {
        if ((window as any).heygenAvatar && !avatarConnected) {
          await (window as any).heygenAvatar.connect();
          
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
            setIsInitializing(false);
          }, 2000);
        } else {
          setIsInitializing(false);
        }
      }, 1000);
    };

    initializeAvatar();

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
      
      if ((window as any).heygenAvatar) {
        await (window as any).heygenAvatar.speak(text, voiceId);
      }
      
      setTimeout(() => {
        setAvatarSpeaking(false);
      }, text.length * 80);
      
    } catch (error) {
      console.error('Avatar speak error:', error);
      setAvatarSpeaking(false);
    }
  };

  const askQuestion = async (text: string) => {
    if (!text.trim()) return;

    await stopAllSeamlessAudio();
    if (streamingAudioRef.current) {
      streamingAudioRef.current.stop();
    }

    setLoading(true);
    setAnswer('');
    
    const newConversation = [...conversation, { role: 'user', content: text }];
    setConversation(newConversation);

    try {
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

            if (avatarConnected && fullResponse.length > lastProcessedLength + 50) {
              const newText = fullResponse.substring(lastProcessedLength);
              const segments = splitTextForSeamlessStreaming(newText);
              
              for (const segment of segments) {
                if (segment.trim() && segment.length > 10 && /[.!?]$/.test(segment)) {
                  await speakWithAvatar(segment);
                  lastProcessedLength = fullResponse.length;
                  break;
                }
              }
            }
          }

          if (fullResponse.trim() && avatarConnected) {
            const remainingText = fullResponse.substring(lastProcessedLength);
            if (remainingText.trim()) {
              await speakWithAvatar(remainingText);
            }
          }

          setConversation(prev => [...prev, { role: 'assistant', content: fullResponse }]);

        } finally {
          reader.releaseLock();
        }
      } else {
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
    if (!hasSpeechRecognition) return;

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
    recognition.onerror = () => setListening(false);
    
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
    <div className="avatar-demo-container">
      <div className="avatar-demo-content">
        <header className="avatar-demo-header">
          <div className="avatar-demo-title-container">
            <h1 className="avatar-demo-title">Talk with Jonathan</h1>
            <p className="avatar-demo-subtitle">
              Real-time conversational avatar with my personality and voice
            </p>
          </div>
        </header>

        <main className="avatar-demo-main">
          <div className="avatar-demo-layout">
            {/* Avatar Section */}
            <section className="avatar-demo-video-section">
              <div className="avatar-demo-video-container">
                <HeyGenAvatar 
                  className="avatar-demo-video"
                  onConnected={() => setAvatarConnected(true)}
                  onDisconnected={() => setAvatarConnected(false)}
                  onSpeaking={(speaking) => setAvatarSpeaking(speaking)}
                />
                
                {/* Status Overlay */}
                <div className="avatar-demo-status-overlay">
                  <div className="avatar-demo-connection-status">
                    <div className={`avatar-demo-status-dot ${avatarConnected ? 'connected' : 'disconnected'}`} />
                    <span className="avatar-demo-status-text">
                      {isInitializing ? 'Initializing...' : 
                       avatarConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  
                  {avatarSpeaking && (
                    <div className="avatar-demo-speaking-indicator">
                      <div className="avatar-demo-speaking-dot" />
                      <span>Speaking</span>
                      <div className="soundbars">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="soundbar" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Controls Section */}
            <aside className="avatar-demo-controls-section">
              {/* Voice Input */}
              <div className="avatar-demo-control-panel">
                <h3 className="avatar-demo-control-title">Voice Chat</h3>
                
                <button
                  onClick={listening ? stopListening : startListening}
                  disabled={loading || !avatarConnected}
                  className={`avatar-demo-voice-btn ${listening ? 'listening' : ''} ${!avatarConnected ? 'disabled' : ''}`}
                >
                  <div className="avatar-demo-voice-btn-content">
                    <div className={`avatar-demo-mic-icon ${listening ? 'active' : ''}`}>
                      {listening ? '🔴' : '🎤'}
                    </div>
                    <span className="avatar-demo-voice-btn-text">
                      {listening ? 'Listening... (tap to stop)' : 
                       loading ? 'Processing...' : 
                       !avatarConnected ? 'Connect Avatar First' :
                       'Start Speaking'}
                    </span>
                  </div>
                </button>
                
                <p className="avatar-demo-voice-support">
                  {hasSpeechRecognition ? 
                    '✓ Speech recognition supported' : 
                    '✗ Speech recognition not available'}
                </p>
              </div>

              {/* Text Input */}
              <div className="avatar-demo-control-panel">
                <h3 className="avatar-demo-control-title">Text Chat</h3>
                
                <form onSubmit={handleSubmit} className="avatar-demo-text-form">
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask me anything..."
                    className="avatar-demo-textarea"
                    rows={3}
                    disabled={loading || !avatarConnected}
                  />
                  <button
                    type="submit"
                    disabled={loading || !question.trim() || !avatarConnected}
                    className="avatar-demo-send-btn"
                  >
                    {loading ? (
                      <div className="avatar-demo-loading">
                        <div className="loading-spinner" />
                        <span>Thinking...</span>
                      </div>
                    ) : (
                      <span>Send Message</span>
                    )}
                  </button>
                </form>
              </div>

              {/* Quick Questions */}
              <div className="avatar-demo-control-panel">
                <h3 className="avatar-demo-control-title">Quick Questions</h3>
                <div className="avatar-demo-quick-questions">
                  {quickQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setQuestion(q);
                        askQuestion(q);
                      }}
                      disabled={loading || !avatarConnected}
                      className="avatar-demo-quick-btn"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </div>

          {/* Current Response */}
          {answer && (
            <section className="avatar-demo-response-section">
              <div className="avatar-demo-response-container">
                <h3 className="avatar-demo-response-title">Jonathan says:</h3>
                <div className="avatar-demo-response-content">
                  <p className="avatar-demo-response-text">{answer}</p>
                </div>
              </div>
            </section>
          )}

          {/* Setup Instructions */}
          {!avatarConnected && !isInitializing && (
            <section className="avatar-demo-setup-section">
              <div className="avatar-demo-setup-container">
                <h3 className="avatar-demo-setup-title">Setup Required</h3>
                <div className="avatar-demo-setup-content">
                  <p className="avatar-demo-setup-description">To enable the avatar:</p>
                  <ol className="avatar-demo-setup-steps">
                    <li>Get a HeyGen API key from <a href="https://www.heygen.com/" target="_blank" rel="noopener noreferrer" className="avatar-demo-setup-link">heygen.com</a></li>
                    <li>Add <code className="avatar-demo-setup-code">HEYGEN_API_KEY=your_key_here</code> to .env.local</li>
                    <li>Refresh the page and click "Connect Avatar"</li>
                  </ol>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}