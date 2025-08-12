// TEMP: test change for deployment
'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { enhancedVoiceService, VoiceGenerationResult } from '../lib/enhancedVoiceService';
import { EmotionalCalibration } from '../lib/emotionalCalibrationService';
import { ProfessionalVoiceSettings } from '../lib/voiceProfileService';

interface VoicePreviewTestingProps {
  voiceId: string;
  userName?: string;
  userId?: string;
  onParametersChange?: (settings: ProfessionalVoiceSettings) => void;
  onSettingsSaved?: (settings: ProfessionalVoiceSettings) => void;
  initialSettings?: ProfessionalVoiceSettings;
}

interface EmotionalPreview {
  emotion: keyof EmotionalCalibration;
  label: string;
  icon: string;
  result?: { success: boolean, audioBlob?: Blob, error?: string };
  isGenerating: boolean;
  audioUrl?: string;
}

interface ContextualScenario {
  id: string;
  name: string;
  description: string;
  sampleText: string;
  icon: string;
  category: 'conversational' | 'narrative' | 'expressive' | 'professional';
  emotionalContext?: keyof EmotionalCalibration;
}

const VoicePreviewTesting: React.FC<VoicePreviewTestingProps> = ({
  voiceId,
  userName = 'your',
  userId,
  onParametersChange,
  onSettingsSaved,
  initialSettings
}) => {
  // Initialize component when props change
  useEffect(() => {
    // Component initialized with voice settings
  }, [voiceId, userName, userId])

  // Update voice settings when initialSettings changes
  useEffect(() => {
    if (initialSettings && 
        typeof initialSettings.stability === 'number' && 
        typeof initialSettings.similarity_boost === 'number' && 
        typeof initialSettings.style === 'number') {
      setVoiceSettings(prev => ({ ...prev, ...initialSettings }));
    }
  }, [initialSettings])
  const [activeTab, setActiveTab] = useState<'emotional' | 'scenarios' | 'parameters'>('emotional');
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [customText, setCustomText] = useState('');
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [scenarioFilter, setScenarioFilter] = useState<'all' | 'conversational' | 'narrative' | 'expressive' | 'professional'>('all');
  const [showParameterComparison, setShowParameterComparison] = useState(false);
  const [comparisonSettings, setComparisonSettings] = useState<ProfessionalVoiceSettings | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  // Voice parameter controls with proper null safety
  const [voiceSettings, setVoiceSettings] = useState<ProfessionalVoiceSettings>(() => {
    // Ensure we always have valid default values
    const defaults: ProfessionalVoiceSettings = {
      stability: 0.75,
      similarity_boost: 0.85,
      style: 0.2,
      use_speaker_boost: true,
      optimize_streaming_latency: 0.5,
      model_id: 'eleven_turbo_v2_5' as const
    };
    
    // If initialSettings is provided and has valid numeric values, use them
    if (initialSettings && 
        typeof initialSettings.stability === 'number' && 
        typeof initialSettings.similarity_boost === 'number' && 
        typeof initialSettings.style === 'number') {
      return { ...defaults, ...initialSettings };
    }
    
    return defaults;
  });  // 
  // Emotional previews state - all emotions from EmotionalCalibration
  const [emotionalPreviews, setEmotionalPreviews] = useState<EmotionalPreview[]>([
    // Core Positive Emotions
    { emotion: 'happy', label: 'Joyful', icon: '😊', isGenerating: false },
    { emotion: 'excited', label: 'Thrilled', icon: '🤩', isGenerating: false },
    { emotion: 'playful', label: 'Playful', icon: '😄', isGenerating: false },
    { emotion: 'confident', label: 'Confident', icon: '💪', isGenerating: false },
    { emotion: 'romantic', label: 'Romantic', icon: '💕', isGenerating: false },

    // Calm & Reflective
    { emotion: 'calm', label: 'Peaceful', icon: '😌', isGenerating: false },
    { emotion: 'serious', label: 'Focused', icon: '🧐', isGenerating: false },
    { emotion: 'nostalgic', label: 'Nostalgic', icon: '🌅', isGenerating: false },
    { emotion: 'mysterious', label: 'Mysterious', icon: '🕵️', isGenerating: false },

    // Intense Emotions
    { emotion: 'sad', label: 'Melancholy', icon: '😢', isGenerating: false },
    { emotion: 'angry', label: 'Frustrated', icon: '😠', isGenerating: false },
    { emotion: 'surprised', label: 'Amazed', icon: '😲', isGenerating: false },
    { emotion: 'determined', label: 'Determined', icon: '🔥', isGenerating: false },

    // Creative & Unique
    { emotion: 'whimsical', label: 'Whimsical', icon: '🦋', isGenerating: false },
    { emotion: 'sarcastic', label: 'Sarcastic', icon: '🙄', isGenerating: false },
    { emotion: 'neutral', label: 'Natural', icon: '😐', isGenerating: false }
  ]);

  // Contextual scenarios with emotional contexts (Requirement 3.4)
  const scenarios: ContextualScenario[] = [
    {
      id: 'greeting',
      name: 'Friendly Greeting',
      description: 'Casual, warm welcome',
      sampleText: `Hi there! I'm ${userName} digital voice. It's great to meet you!`,
      icon: '👋',
      category: 'conversational',
      emotionalContext: 'happy'
    },
    {
      id: 'storytelling',
      name: 'Storytelling',
      description: 'Narrative, engaging tone',
      sampleText: `Once upon a time, in a world where technology and humanity merged seamlessly, there lived a voice that could express every emotion with perfect clarity.`,
      icon: '📚',
      category: 'narrative',
      emotionalContext: 'calm'
    },
    {
      id: 'presentation',
      name: 'Professional Presentation',
      description: 'Clear, authoritative delivery',
      sampleText: `Good morning everyone. Today I'll be presenting our quarterly results and discussing the strategic initiatives for the upcoming period.`,
      icon: '💼',
      category: 'professional',
      emotionalContext: 'serious'
    },
    {
      id: 'empathetic',
      name: 'Empathetic Response',
      description: 'Caring, understanding tone',
      sampleText: `I understand this might be difficult for you. Please know that I'm here to listen and support you through this.`,
      icon: '🤗',
      category: 'expressive',
      emotionalContext: 'calm'
    },
    {
      id: 'excited_news',
      name: 'Exciting News',
      description: 'Enthusiastic, energetic delivery',
      sampleText: `I have some incredible news to share with you! This is going to be absolutely amazing and I can't wait for you to hear about it!`,
      icon: '🎉',
      category: 'expressive',
      emotionalContext: 'excited'
    },
    {
      id: 'instructions',
      name: 'Clear Instructions',
      description: 'Step-by-step guidance',
      sampleText: `Let me walk you through this process step by step. First, you'll need to open the application. Then, navigate to the settings menu.`,
      icon: '📋',
      category: 'professional',
      emotionalContext: 'calm'
    }
  ];  // 
  // Add error state for the whole preview section
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Add state for save status
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState<string>('');

  // Replace all calls to enhancedVoiceService.generateSpeech and generateEmotionalPreviews with fetch('/api/voice')
  // Helper to generate and play audio preview via /api/voice
  const generateVoicePreview = async ({ text, voiceId, settings = {}, emotionalContext }: { text: string, voiceId: string, settings?: any, emotionalContext?: string }) => {
    try {
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voiceId,
          emotionalStyle: emotionalContext,
          settings: settings, // Pass settings directly as a property
        }),
      })
      if (!response.ok) {
        let errorMsg = 'Failed to generate voice.'
        try {
          const errorData = await response.json()
          errorMsg = errorData.error || errorData.message || JSON.stringify(errorData)
        } catch (e) {
          errorMsg = 'Failed to generate voice (unknown error).'
        }
        return { success: false, error: errorMsg }
      }
      const audioBlob = await response.blob()
      return { success: true, audioBlob }
    } catch (err) {
      let errorMsg = 'Failed to generate voice preview.'
      if (err instanceof Error) errorMsg = err.message
      return { success: false, error: errorMsg }
    }
  }

  // Helper to get possessive form
  function getPossessive(name: string) {
    if (!name) return ''
    return name.endsWith('s') ? name + "'" : name + "'s"
  }

  // EXTREME emotion-specific settings for maximum distinction
  const emotionVoiceSettings: Record<string, any> = {
    // Core Positive Emotions - High energy, low stability
    happy: { stability: 0.20, similarity_boost: 0.60, style: 1.0 },
    excited: { stability: 0.05, similarity_boost: 0.50, style: 1.0 },
    playful: { stability: 0.10, similarity_boost: 0.55, style: 1.0 },
    confident: { stability: 0.70, similarity_boost: 0.90, style: 0.80 },
    romantic: { stability: 0.40, similarity_boost: 0.70, style: 0.90 },

    // Calm & Reflective - High stability, low style
    calm: { stability: 0.95, similarity_boost: 0.95, style: 0.05 },
    serious: { stability: 0.90, similarity_boost: 1.0, style: 0.05 },
    nostalgic: { stability: 0.80, similarity_boost: 0.85, style: 0.60 },
    mysterious: { stability: 0.85, similarity_boost: 0.75, style: 0.70 },

    // Intense Emotions - Extreme settings
    sad: { stability: 0.95, similarity_boost: 0.90, style: 0.10 },
    angry: { stability: 0.05, similarity_boost: 0.40, style: 1.0 },
    surprised: { stability: 0.10, similarity_boost: 0.60, style: 1.0 },
    determined: { stability: 0.75, similarity_boost: 0.95, style: 0.85 },

    // Creative & Unique - Varied extremes
    whimsical: { stability: 0.15, similarity_boost: 0.65, style: 1.0 },
    sarcastic: { stability: 0.60, similarity_boost: 0.80, style: 0.90 },
    neutral: { stability: 0.75, similarity_boost: 0.85, style: 0.35 },
  }

  // Emotionally distinct sample texts designed to showcase voice differences
  const emotionSampleTexts: Record<string, string> = {
    // Core Positive Emotions - High energy content
    happy: `What an absolutely wonderful day this has been! Everything just feels perfect right now, and I can't help but smile thinking about all the amazing possibilities ahead of us!`,
    excited: `Oh my gosh, this is incredible! I can barely contain myself - this is exactly what we've been hoping for! Can you believe this is actually happening right now?!`,
    playful: `Hey there, want to hear something silly? I just discovered that penguins have knees! Who knew? Life is full of these delightful little surprises, isn't it?`,
    confident: `I know exactly what needs to be done here, and I'm completely ready to handle this challenge. Trust me, I've got the experience and skills to make this work perfectly.`,
    romantic: `There's something magical happening between us right now. Your voice, your presence... it makes everything feel warm and beautiful, like we're sharing something truly special.`,

    // Calm & Reflective - Slow, measured content
    calm: `Take a deep breath and let yourself settle into this moment. There's no rush, no pressure. We can simply be here together, peaceful and present.`,
    serious: `This is a matter of critical importance that requires our complete attention and careful consideration. We must approach this with the gravity it deserves.`,
    nostalgic: `I find myself drifting back to those golden afternoons of childhood, when time moved slowly and every moment felt infinite. Those memories still warm my heart.`,
    mysterious: `There are secrets whispered in the shadows, truths hidden beneath the surface of ordinary things. Can you sense the mystery that surrounds us?`,

    // Intense Emotions - Strong emotional content
    sad: `My heart feels so heavy today. The weight of loss and longing settles deep in my chest, and sometimes the sadness feels almost overwhelming.`,
    angry: `This is absolutely unacceptable! I'm furious about how this situation has been handled. The incompetence and disregard shown here is completely infuriating!`,
    surprised: `What?! Are you serious right now?! I cannot believe what I'm hearing! This is absolutely mind-blowing - I never saw this coming in a million years!`,
    determined: `Nothing and no one will stop me from achieving this goal. I have the fire, the focus, and the unwavering determination to see this through to victory.`,

    // Creative & Unique - Distinctive content
    whimsical: `Imagine if butterflies could paint rainbows in the sky with their wings, and every flower sang a different melody when the wind danced through the garden.`,
    sarcastic: `Oh wonderful, another brilliant decision from management. Because clearly, what we really needed was more confusion and inefficiency. How absolutely delightful.`,
    neutral: `Here are the key points we need to discuss today. I'll walk through each item systematically so we can address everything in a logical order.`,
  }

  // Generate all emotional previews
  const generateEmotionalPreviews = useCallback(async () => {
    setIsGeneratingAll(true)
    setGlobalError(null)
    try {
      const results: Record<string, { success: boolean, audioBlob?: Blob, error?: string }> = {}
      for (const preview of emotionalPreviews) {
        const settings = emotionVoiceSettings[preview.emotion] || voiceSettings
        const text = emotionSampleTexts[preview.emotion] || `This is ${getPossessive(userName)} voice expressing ${preview.emotion}.`
        const result = await generateVoicePreview({
          text,
          voiceId,
          settings,
          emotionalContext: preview.emotion,
        })
        results[preview.emotion] = result
      }
      const allFailed = Object.values(results).every(r => !r.success)
      if (allFailed) {
        const firstError = Object.values(results)[0]?.error || 'Voice generation failed. Please check your API key or try again later.'
        setGlobalError(firstError)
      }
      setEmotionalPreviews(prev => prev.map(preview => {
        const result = results[preview.emotion]
        return {
          ...preview,
          result,
          audioUrl: result && result.success && result.audioBlob
            ? URL.createObjectURL(result.audioBlob)
            : undefined,
          isGenerating: false
        }
      }))
    } catch (error) {
      setGlobalError('Voice generation failed. Please check your API key or try again later.')
      setEmotionalPreviews(prev => prev.map(preview => ({
        ...preview,
        isGenerating: false
      })))
    } finally {
      setIsGeneratingAll(false)
    }
  }, [voiceId, userName, voiceSettings, emotionalPreviews])

  // Generate single emotional preview
  const generateSinglePreview = useCallback(async (emotion: keyof EmotionalCalibration) => {
    setEmotionalPreviews(prev => prev.map(p =>
      p.emotion === emotion ? { ...p, isGenerating: true } : p
    ))
    setGlobalError(null)
    const settings = emotionVoiceSettings[emotion] || voiceSettings
    const text = emotionSampleTexts[emotion] || `This is ${getPossessive(userName)} voice expressing ${emotion}.`
    const result = await generateVoicePreview({
      text,
      voiceId,
      settings,
      emotionalContext: emotion,
    })
    if (!result.success) {
      setGlobalError(result.error || 'Voice generation failed. Please check your API key or try again later.')
    }
    const audioUrl = result.success && result.audioBlob
      ? URL.createObjectURL(result.audioBlob)
      : undefined
    setEmotionalPreviews(prev => prev.map(p =>
      p.emotion === emotion
        ? { ...p, result, audioUrl, isGenerating: false }
        : p
    ))
  }, [voiceId, userName, voiceSettings])

  // Generate scenario preview
  const generateScenarioPreview = useCallback(async (scenarioId: string, customTextOverride?: string) => {
    const scenario = scenarios.find(s => s.id === scenarioId)
    if (!scenario) return
    const emotion = scenario.emotionalContext || 'neutral'
    const settings = emotionVoiceSettings[emotion] || voiceSettings
    const text = customTextOverride || scenario.sampleText
    const result = await generateVoicePreview({
      text,
      voiceId,
      settings,
      emotionalContext: emotion,
    })
    if (result.success && result.audioBlob) {
      const audioUrl = URL.createObjectURL(result.audioBlob)
      const audio = new Audio(audioUrl)
      audioRefs.current[scenarioId] = audio
      audio.onended = () => setCurrentlyPlaying(null)
      audio.play()
      setCurrentlyPlaying(scenarioId)
    } else if (!result.success) {
      setGlobalError(result.error || 'Voice generation failed. Please check your API key or try again later.')
    }
  }, [voiceId, voiceSettings, scenarios])

  // Play audio preview
  const playPreview = useCallback((previewId: string, audioUrl?: string) => {
    if (currentlyPlaying) {
      // Stop currently playing audio
      Object.values(audioRefs.current).forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
      });
      setCurrentlyPlaying(null);
    }

    if (audioUrl && currentlyPlaying !== previewId) {
      const audio = new Audio(audioUrl);
      audioRefs.current[previewId] = audio;

      audio.onended = () => setCurrentlyPlaying(null);
      audio.play();
      setCurrentlyPlaying(previewId);
    }
  }, [currentlyPlaying]);

  // Update voice parameter (Requirement 3.2)
  const updateVoiceParameter = useCallback((key: keyof ProfessionalVoiceSettings, value: any) => {
    const newSettings = { ...voiceSettings, [key]: value };
    setVoiceSettings(newSettings);
    onParametersChange?.(newSettings);
  }, [voiceSettings, onParametersChange]);
  // Generate custom text preview
  const generateCustomPreview = useCallback(async () => {
    if (!customText.trim()) return
    const result = await generateVoicePreview({
      text: customText,
      voiceId,
      settings: voiceSettings,
    })
    if (result.success && result.audioBlob) {
      const audioUrl = URL.createObjectURL(result.audioBlob)
      const audio = new Audio(audioUrl)
      audioRefs.current['custom'] = audio
      audio.onended = () => setCurrentlyPlaying(null)
      audio.play()
      setCurrentlyPlaying('custom')
    } else if (!result.success) {
      setGlobalError(result.error || 'Voice generation failed. Please check your API key or try again later.')
    }
  }, [customText, voiceId, voiceSettings])

  // Save optimized voice settings (Requirement 3.3)
  const saveVoiceSettings = useCallback(async () => {
    try {
      // Call the parent callback if provided
      onSettingsSaved?.(voiceSettings);

      // Show success feedback
      alert('Voice settings saved successfully! Your optimized parameters will be used for future voice generation.');
    } catch (error) {
      console.error('Error saving voice settings:', error);
      alert('Failed to save voice settings. Please try again.');
    }
  }, [voiceSettings, onSettingsSaved]);

  // Reset to default settings
  const resetToDefaults = useCallback(() => {
    const defaultSettings: ProfessionalVoiceSettings = {
      stability: 0.75,
      similarity_boost: 0.85,
      style: 0.2,
      use_speaker_boost: true,
      optimize_streaming_latency: 0.5,
      model_id: 'eleven_turbo_v2_5'
    };
    setVoiceSettings(defaultSettings);
    onParametersChange?.(defaultSettings);
  }, [onParametersChange]);

  // Enable parameter comparison
  const enableComparison = useCallback(() => {
    setComparisonSettings({ ...voiceSettings });
    setShowParameterComparison(true);
  }, [voiceSettings]);
  // Cleanup audio URLs on unmount
  useEffect(() => {
    return () => {
      emotionalPreviews.forEach(preview => {
        if (preview.audioUrl) {
          URL.revokeObjectURL(preview.audioUrl);
        }
      });
      Object.values(audioRefs.current).forEach(audio => {
        audio.pause();
      });
    };
  }, [emotionalPreviews]);

  // Save settings to backend
  const handleSaveSettings = useCallback(async () => {
    setSaveStatus('saving');
    setSaveMessage('');
    try {
      const response = await fetch('/api/save-voice-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId,
          settings: voiceSettings,
          userId: userId,
        }),
      });
      if (!response.ok) {
        let errorMsg = 'Failed to save settings.';
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorData.message || JSON.stringify(errorData);
        } catch (e) {
          errorMsg = 'Failed to save settings (unknown error).';
        }
        setSaveStatus('error');
        setSaveMessage(errorMsg);
        return;
      }
      setSaveStatus('success');
      setSaveMessage('Voice settings saved successfully!');
    } catch (err) {
      setSaveStatus('error');
      setSaveMessage('Failed to save settings. Please try again.');
    }
  }, [voiceId, voiceSettings]);

  return (
    <div className="voice-tuning-panel">
      {/* Tab Navigation */}
      <div className="voice-tuning-tabs">
        {[
          { id: 'emotional', label: 'Emotional Contexts', icon: '🎭' },
          { id: 'scenarios', label: 'Scenarios', icon: '🎬' },
          { id: 'parameters', label: 'Voice Parameters', icon: '🎛️' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`voice-tuning-tab${activeTab === tab.id ? ' active' : ''}`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Debug Info */}
      <div style={{ 
        background: 'rgba(0,0,0,0.1)', 
        padding: '8px 12px', 
        borderRadius: '6px', 
        fontSize: '12px', 
        color: '#666',
        marginBottom: '16px',
        fontFamily: 'monospace'
      }}>
        Debug: Using voice_id = {voiceId || 'null'} | userName = {userName} | userId = {userId || 'null'}
      </div>

      {/* Emotional Contexts Tab */}
      {activeTab === 'emotional' && (
        <div className="voice-tuning-section">
          <div className="voice-tuning-section-header">
            <h3 className="voice-tuning-section-title">Emotional Contexts</h3>
            <button
              onClick={generateEmotionalPreviews}
              disabled={isGeneratingAll}
              className="voice-tuning-btn primary"
            >
              {isGeneratingAll ? (
                <span className="voice-tuning-spinner" />
              ) : (
                '🎭 Generate All Previews'
              )}
            </button>
          </div>
          <div className="voice-tuning-grid">
            {emotionalPreviews.map(preview => (
              <div key={preview.emotion} className="voice-tuning-card">
                <div className="voice-tuning-card-header">
                  <span className="voice-tuning-emoji">{preview.icon}</span>
                  <span className="voice-tuning-card-title">{preview.label}</span>
                  {preview.result?.success && (
                    <span className="voice-tuning-status success">✓ Ready</span>
                  )}
                </div>
                <div className="voice-tuning-card-controls">
                  <button
                    onClick={() => generateSinglePreview(preview.emotion)}
                    disabled={preview.isGenerating}
                    className="voice-tuning-btn"
                  >
                    {preview.isGenerating ? 'Generating...' : '🔄 Generate'}
                  </button>
                  {preview.audioUrl && (
                    <button
                      onClick={() => playPreview(preview.emotion, preview.audioUrl)}
                      className={`voice-tuning-btn${currentlyPlaying === preview.emotion ? ' playing' : ''}`}
                    >
                      {currentlyPlaying === preview.emotion ? '⏹️ Stop' : '▶️ Play'}
                    </button>
                  )}
                </div>
                {preview.result && !preview.result.success && (
                  <div className="voice-tuning-error">Error: {preview.result.error}</div>
                )}
              </div>
            ))}
          </div>
          {globalError && (
            <div className="voice-tuning-error global">
              <p>{globalError}</p>
              <p className="voice-tuning-error-tip">Check your API key, internet connection, or try again later.</p>
            </div>
          )}
        </div>
      )}
      {/* Scenarios Tab */}
      {activeTab === 'scenarios' && (
        <div className="voice-tuning-section">
          <div className="voice-tuning-section-header">
            <h3 className="voice-tuning-section-title">Contextual Scenarios</h3>
            <div className="voice-tuning-filter">
              <span>Filter:</span>
              <select
                value={scenarioFilter}
                onChange={(e) => setScenarioFilter(e.target.value as any)}
                className="voice-tuning-select"
              >
                <option value="all">All Categories</option>
                <option value="conversational">Conversational</option>
                <option value="narrative">Narrative</option>
                <option value="expressive">Expressive</option>
                <option value="professional">Professional</option>
              </select>
            </div>
          </div>
          <div className="voice-tuning-custom-text">
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Enter your own text to test how it sounds with your voice..."
              className="voice-tuning-textarea"
              rows={2}
            />
            <button
              onClick={generateCustomPreview}
              disabled={!customText.trim() || currentlyPlaying === 'custom'}
              className="voice-tuning-btn primary"
            >
              {currentlyPlaying === 'custom' ? '⏹️ Stop' : '▶️ Test'}
            </button>
          </div>
          <div className="voice-tuning-grid scenarios">
            {scenarios
              .filter(scenario => scenarioFilter === 'all' || scenario.category === scenarioFilter)
              .map(scenario => (
                <div key={scenario.id} className="voice-tuning-card">
                  <div className="voice-tuning-card-header">
                    <span className="voice-tuning-emoji">{scenario.icon}</span>
                    <span className="voice-tuning-card-title">{scenario.name}</span>
                    <span className={`voice-tuning-category ${scenario.category}`}>{scenario.category}</span>
                  </div>
                  <div className="voice-tuning-card-desc">"{scenario.sampleText}"</div>
                  <button
                    onClick={() => generateScenarioPreview(scenario.id)}
                    disabled={currentlyPlaying === scenario.id}
                    className="voice-tuning-btn"
                  >
                    {currentlyPlaying === scenario.id ? '⏹️ Stop Playing' : '▶️ Play Scenario'}
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
      {/* Voice Parameters Tab */}
      {activeTab === 'parameters' && (
        <div className="voice-tuning-section">
          <h3 className="voice-tuning-section-title">Voice Parameter Adjustment</h3>
          <div className="voice-tuning-guide">
            <h4>💡 Parameter Guide</h4>
            <ul>
              <li><strong>Stability:</strong> Higher values = more consistent, lower = more expressive</li>
              <li><strong>Similarity Boost:</strong> How closely to match your original voice</li>
              <li><strong>Style:</strong> Amount of emotional expression and variation</li>
              <li><strong>Speaker Boost:</strong> Enhances voice clarity and presence</li>
            </ul>
          </div>
          <div className="voice-tuning-params-grid">
            {/* Stability */}
            <div className="voice-tuning-param">
              <div className="voice-tuning-param-label">
                <label>Stability</label>
                <span>{(voiceSettings.stability ?? 0.75).toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={voiceSettings.stability}
                onChange={(e) => updateVoiceParameter('stability', parseFloat(e.target.value))}
                className="voice-tuning-slider"
              />
              <div className="voice-tuning-param-desc">
                <span>More Variable</span>
                <span>More Stable</span>
              </div>
            </div>
            {/* Similarity Boost */}
            <div className="voice-tuning-param">
              <div className="voice-tuning-param-label">
                <label>Similarity Boost</label>
                <span>{(voiceSettings.similarity_boost ?? 0.85).toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={voiceSettings.similarity_boost}
                onChange={(e) => updateVoiceParameter('similarity_boost', parseFloat(e.target.value))}
                className="voice-tuning-slider"
              />
              <div className="voice-tuning-param-desc">
                <span>More Creative</span>
                <span>More Similar</span>
              </div>
            </div>
            {/* Style */}
            <div className="voice-tuning-param">
              <div className="voice-tuning-param-label">
                <label>Style</label>
                <span>{(voiceSettings.style ?? 0.2).toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={voiceSettings.style}
                onChange={(e) => updateVoiceParameter('style', parseFloat(e.target.value))}
                className="voice-tuning-slider"
              />
              <div className="voice-tuning-param-desc">
                <span>Less Expressive</span>
                <span>More Expressive</span>
              </div>
            </div>
            {/* Speaker Boost */}
            <div className="voice-tuning-param">
              <div className="voice-tuning-param-label">
                <label>Speaker Boost</label>
                <input
                  type="checkbox"
                  checked={voiceSettings.use_speaker_boost}
                  onChange={(e) => updateVoiceParameter('use_speaker_boost', e.target.checked)}
                  className="voice-tuning-checkbox"
                />
              </div>
              <div className="voice-tuning-param-desc">
                <span>Enhances voice clarity and presence</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1em', marginTop: '2em', alignItems: 'center' }}>
            <button
              className="voice-tuning-btn primary"
              onClick={handleSaveSettings}
              disabled={saveStatus === 'saving'}
              type="button"
            >
              {saveStatus === 'saving' ? 'Saving...' : '💾 Save Settings'}
            </button>
            <button
              className="voice-tuning-btn"
              onClick={resetToDefaults}
              type="button"
            >
              Reset to Defaults
            </button>
            {saveStatus === 'success' && <span style={{ color: '#22c55e', fontWeight: 600 }}>{saveMessage}</span>}
            {saveStatus === 'error' && <span style={{ color: '#f87171', fontWeight: 600 }}>{saveMessage}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default VoicePreviewTesting;