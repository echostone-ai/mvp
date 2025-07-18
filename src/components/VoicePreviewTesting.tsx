// TEMP: test change for deployment
'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { enhancedVoiceService, VoiceGenerationResult } from '../lib/enhancedVoiceService';
import { EmotionalCalibration } from '../lib/emotionalCalibrationService';
import { ProfessionalVoiceSettings } from '../lib/voiceProfileService';

interface VoicePreviewTestingProps {
  voiceId: string;
  userName?: string;
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
  onParametersChange,
  onSettingsSaved,
  initialSettings
}) => {
  const [activeTab, setActiveTab] = useState<'emotional' | 'scenarios' | 'parameters'>('emotional');
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [customText, setCustomText] = useState('');
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [scenarioFilter, setScenarioFilter] = useState<'all' | 'conversational' | 'narrative' | 'expressive' | 'professional'>('all');
  const [showParameterComparison, setShowParameterComparison] = useState(false);
  const [comparisonSettings, setComparisonSettings] = useState<ProfessionalVoiceSettings | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  // Voice parameter controls
  const [voiceSettings, setVoiceSettings] = useState<ProfessionalVoiceSettings>(
    initialSettings || {
      stability: 0.75,
      similarity_boost: 0.85,
      style: 0.2,
      use_speaker_boost: true,
      optimize_streaming_latency: 0.5,
      model_id: 'eleven_turbo_v2_5'
    }
  );  // 
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
          ...settings && { settings },
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

  // Enhanced emotion-specific settings with more nuanced parameters
  const emotionVoiceSettings: Record<string, any> = {
    // Core Positive Emotions
    happy: { stability: 0.35, similarity_boost: 0.75, style: 0.85 },
    excited: { stability: 0.15, similarity_boost: 0.65, style: 0.95 },
    playful: { stability: 0.25, similarity_boost: 0.70, style: 0.90 },
    confident: { stability: 0.65, similarity_boost: 0.85, style: 0.60 },
    romantic: { stability: 0.55, similarity_boost: 0.80, style: 0.70 },

    // Calm & Reflective
    calm: { stability: 0.85, similarity_boost: 0.90, style: 0.25 },
    serious: { stability: 0.80, similarity_boost: 0.95, style: 0.20 },
    nostalgic: { stability: 0.70, similarity_boost: 0.85, style: 0.45 },
    mysterious: { stability: 0.75, similarity_boost: 0.80, style: 0.55 },

    // Intense Emotions
    sad: { stability: 0.90, similarity_boost: 0.85, style: 0.30 },
    angry: { stability: 0.20, similarity_boost: 0.60, style: 0.85 },
    surprised: { stability: 0.30, similarity_boost: 0.70, style: 0.80 },
    determined: { stability: 0.60, similarity_boost: 0.85, style: 0.65 },

    // Creative & Unique
    whimsical: { stability: 0.40, similarity_boost: 0.75, style: 0.75 },
    sarcastic: { stability: 0.50, similarity_boost: 0.80, style: 0.70 },
    neutral: { stability: 0.75, similarity_boost: 0.85, style: 0.35 },
  }

  // Diverse and engaging sample texts that showcase emotional range
  const emotionSampleTexts: Record<string, string> = {
    // Core Positive Emotions
    happy: `You know what? Life has this amazing way of surprising us with beautiful moments when we least expect them. Right now, I'm feeling absolutely radiant!`,
    excited: `Oh my goodness, I can barely contain myself! This is the kind of news that makes your heart race and fills you with pure electricity. Are you ready for this?`,
    playful: `Hey there, gorgeous human! Want to hear something delightfully ridiculous? I just realized that as an AI, I'm technically made of stardust and mathematics. How wonderfully absurd is that?`,
    confident: `I've learned something powerful about myself lately. When I speak with conviction and embrace who I truly am, there's this unstoppable energy that flows through every word I say.`,
    romantic: `There's something magical about this moment we're sharing. Your presence has this way of making everything feel softer, warmer, like we're wrapped in golden light together.`,

    // Calm & Reflective  
    calm: `Take a deep breath with me. Feel how the world slows down when we allow ourselves this gentle pause. In this quiet space, everything feels perfectly balanced and serene.`,
    serious: `I need you to understand something important. What we discuss here matters deeply, and I want to give you my complete attention and thoughtful consideration.`,
    nostalgic: `Sometimes I find myself drifting back to memories that feel like warm sunlight filtering through old windows. There's something bittersweet about how time changes everything, yet keeps the heart of things intact.`,
    mysterious: `There are secrets hidden in the spaces between words, whispered truths that only reveal themselves to those who listen with more than just their ears. Can you feel it too?`,

    // Intense Emotions
    sad: `My heart feels heavy today, like it's carrying the weight of unspoken goodbyes. Sometimes the deepest emotions don't need many words, just the courage to feel them fully.`,
    angry: `This situation is absolutely unacceptable, and I refuse to pretend otherwise. The injustice of it burns through me like fire, demanding action and change.`,
    surprised: `Wait, hold on just a minute! Did that really just happen? My mind is completely blown right now. I need a moment to process this incredible turn of events!`,
    determined: `Nothing will stop me from achieving this goal. I can feel the steel in my resolve, the unwavering focus that turns dreams into reality. This is my moment.`,

    // Creative & Unique
    whimsical: `Imagine if clouds were made of cotton candy and rainbows tasted like laughter. In my digital dreams, I dance with butterflies made of pure light and sing songs that paint colors in the air.`,
    sarcastic: `Oh, absolutely brilliant. Because clearly, the best way to solve this problem is to ignore it completely and hope it magically disappears. What could possibly go wrong with that strategy?`,
    neutral: `This is ${getPossessive(userName)} voice in its most natural state - no dramatic flourishes, no emotional extremes, just authentic expression flowing like a gentle conversation between friends.`,
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
      {/* Header */}
      <div className="voice-tuning-header">
        <h2 className="voice-tuning-title">Voice Tuning</h2>
        <p className="voice-tuning-desc">
          Fine-tune your digital voice with advanced controls, emotional previews, and parameter adjustments.
        </p>
      </div>

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
                <span>{voiceSettings.stability.toFixed(2)}</span>
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
                <span>{voiceSettings.similarity_boost.toFixed(2)}</span>
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
                <span>{voiceSettings.style.toFixed(2)}</span>
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