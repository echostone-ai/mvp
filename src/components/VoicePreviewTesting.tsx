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
  result?: VoiceGenerationResult;
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
    { emotion: 'happy', label: 'Happy', icon: '😊', isGenerating: false },
    { emotion: 'sad', label: 'Sad', icon: '😢', isGenerating: false },
    { emotion: 'excited', label: 'Excited', icon: '🤩', isGenerating: false },
    { emotion: 'calm', label: 'Calm', icon: '😌', isGenerating: false },
    { emotion: 'serious', label: 'Serious', icon: '🧐', isGenerating: false },
    { emotion: 'playful', label: 'Playful', icon: '😄', isGenerating: false },
    { emotion: 'angry', label: 'Angry', icon: '😠', isGenerating: false },
    { emotion: 'surprised', label: 'Surprised', icon: '😲', isGenerating: false },
    { emotion: 'neutral', label: 'Neutral', icon: '😐', isGenerating: false }
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

  // Generate emotional previews (Requirement 3.1)
  const generateEmotionalPreviews = useCallback(async () => {
    setIsGeneratingAll(true);
    setGlobalError(null);
    const sampleText = `Hello! This is ${userName} voice expressing different emotions. Each emotion brings out unique characteristics in my speech patterns.`;
    try {
      const results = await enhancedVoiceService.generateEmotionalPreviews(voiceId, sampleText);
      // Check for any global errors (e.g., all fail with the same error)
      const allFailed = Object.values(results).every(r => !r.success);
      if (allFailed) {
        const firstError = Object.values(results)[0]?.error || 'Voice generation failed. Please check your API key or try again later.';
        setGlobalError(firstError);
      }
      setEmotionalPreviews(prev => prev.map(preview => ({
        ...preview,
        result: results[preview.emotion],
        audioUrl: results[preview.emotion] && results[preview.emotion].success
          ? URL.createObjectURL(new Blob([results[preview.emotion].audio_data!], { type: 'audio/mpeg' }))
          : undefined,
        isGenerating: false
      })));
    } catch (error) {
      setGlobalError('Voice generation failed. Please check your API key or try again later.');
      setEmotionalPreviews(prev => prev.map(preview => ({
        ...preview,
        isGenerating: false
      })));
    } finally {
      setIsGeneratingAll(false);
    }
  }, [voiceId, userName]);

  // Generate single emotional preview
  const generateSinglePreview = useCallback(async (emotion: keyof EmotionalCalibration) => {
    setEmotionalPreviews(prev => prev.map(p =>
      p.emotion === emotion ? { ...p, isGenerating: true } : p
    ));
    setGlobalError(null);
    try {
      const sampleText = `This is ${userName} voice expressing ${emotion}. Notice how the tone and delivery change to match this emotional context.`;
      const result = await enhancedVoiceService.generateSpeech({
        text: sampleText,
        voice_id: voiceId,
        emotional_context: emotion,
        settings: voiceSettings
      });
      if (!result.success) {
        setGlobalError(result.error || 'Voice generation failed. Please check your API key or try again later.');
      }
      const audioUrl = result.success
        ? URL.createObjectURL(new Blob([result.audio_data!], { type: 'audio/mpeg' }))
        : undefined;
      setEmotionalPreviews(prev => prev.map(p =>
        p.emotion === emotion
          ? { ...p, result, audioUrl, isGenerating: false }
          : p
      ));
    } catch (error) {
      setGlobalError('Voice generation failed. Please check your API key or try again later.');
      setEmotionalPreviews(prev => prev.map(p =>
        p.emotion === emotion ? { ...p, isGenerating: false } : p
      ));
    }
  }, [voiceId, userName, voiceSettings]);  // 
// Generate scenario preview
  const generateScenarioPreview = useCallback(async (scenarioId: string, customTextOverride?: string) => {
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (!scenario) return;

    const text = customTextOverride || scenario.sampleText;
    
    try {
      const result = await enhancedVoiceService.generateSpeech({
        text,
        voice_id: voiceId,
        settings: voiceSettings,
        emotional_context: scenario.emotionalContext
      });

      if (result.success && result.audio_data) {
        const audioUrl = URL.createObjectURL(new Blob([result.audio_data], { type: 'audio/mpeg' }));
        
        // Create and play audio
        const audio = new Audio(audioUrl);
        audioRefs.current[scenarioId] = audio;
        
        audio.onended = () => setCurrentlyPlaying(null);
        audio.play();
        setCurrentlyPlaying(scenarioId);
      }
    } catch (error) {
      console.error('Error generating scenario preview:', error);
    }
  }, [voiceId, voiceSettings, scenarios]);

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
    if (!customText.trim()) return;
    
    try {
      const result = await enhancedVoiceService.generateSpeech({
        text: customText,
        voice_id: voiceId,
        settings: voiceSettings
      });

      if (result.success && result.audio_data) {
        const audioUrl = URL.createObjectURL(new Blob([result.audio_data], { type: 'audio/mpeg' }));
        const audio = new Audio(audioUrl);
        audioRefs.current['custom'] = audio;
        
        audio.onended = () => setCurrentlyPlaying(null);
        audio.play();
        setCurrentlyPlaying('custom');
      }
    } catch (error) {
      console.error('Error generating custom preview:', error);
    }
  }, [customText, voiceId, voiceSettings]);

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

  return (
    <div className="voice-tuning-panel">
      {/* Header */}
      <div className="voice-tuning-header">
        <h2 className="voice-tuning-title">Voice Preview & Testing</h2>
        <p className="voice-tuning-desc">
          Test your voice with different emotions, scenarios, and parameter adjustments
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
          
          {/* Custom Text Input */}
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

          {/* Predefined Scenarios */}
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
        </div>
      )}
    </div>
  );
}

export default VoicePreviewTesting;