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
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Voice Preview & Testing</h2>
        <p className="text-gray-600">
          Test your voice with different emotions, scenarios, and parameter adjustments
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        {[
          { id: 'emotional', label: 'Emotional Contexts', icon: '🎭' },
          { id: 'scenarios', label: 'Scenarios', icon: '🎬' },
          { id: 'parameters', label: 'Voice Parameters', icon: '🎛️' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>      
{/* Emotional Contexts Tab */}
      {activeTab === 'emotional' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Emotional Contexts</h3>
            <button
              onClick={generateEmotionalPreviews}
              disabled={isGeneratingAll}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {isGeneratingAll ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Generating All...</span>
                </div>
              ) : (
                '🎭 Generate All Previews'
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {emotionalPreviews.map(preview => (
              <div key={preview.emotion} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{preview.icon}</span>
                    <h4 className="font-medium text-gray-900">{preview.label}</h4>
                  </div>
                  {preview.result?.success && (
                    <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                      ✓ Ready
                    </div>
                  )}
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => generateSinglePreview(preview.emotion)}
                    disabled={preview.isGenerating}
                    className="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-200 disabled:opacity-50 text-sm transition-colors"
                  >
                    {preview.isGenerating ? (
                      <div className="flex items-center justify-center space-x-1">
                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-gray-600 border-t-transparent"></div>
                        <span>Generating...</span>
                      </div>
                    ) : (
                      '🔄 Generate'
                    )}
                  </button>
                  
                  {preview.audioUrl && (
                    <button
                      onClick={() => playPreview(preview.emotion, preview.audioUrl)}
                      className={`px-3 py-2 rounded-md text-sm transition-colors ${
                        currentlyPlaying === preview.emotion
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }`}
                    >
                      {currentlyPlaying === preview.emotion ? '⏹️ Stop' : '▶️ Play'}
                    </button>
                  )}
                </div>

                {preview.result && !preview.result.success && (
                  <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                    Error: {preview.result.error}
                  </div>
                )}
              </div>
            ))}
          </div>
          {globalError && (
            <div className="voice-preview-error">
              <p>{globalError}</p>
              <p className="voice-preview-error-tip">Check your API key, internet connection, or try again later.</p>
            </div>
          )}
        </div>
      )}    
  {/* Scenarios Tab */}
      {activeTab === 'scenarios' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Contextual Scenarios</h3>
            
            {/* Scenario Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Filter:</span>
              <select
                value={scenarioFilter}
                onChange={(e) => setScenarioFilter(e.target.value as any)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-gray-900">Custom Text Testing</h4>
            <div className="flex space-x-2">
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Enter your own text to test how it sounds with your voice..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={2}
              />
              <button
                onClick={generateCustomPreview}
                disabled={!customText.trim() || currentlyPlaying === 'custom'}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {currentlyPlaying === 'custom' ? '⏹️ Stop' : '▶️ Test'}
              </button>
            </div>
          </div>

          {/* Predefined Scenarios */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {scenarios
              .filter(scenario => scenarioFilter === 'all' || scenario.category === scenarioFilter)
              .map(scenario => (
              <div key={scenario.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">{scenario.icon}</span>
                    <div>
                      <h4 className="font-medium text-gray-900">{scenario.name}</h4>
                      <p className="text-xs text-gray-500">{scenario.description}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    scenario.category === 'conversational' ? 'bg-blue-100 text-blue-800' :
                    scenario.category === 'narrative' ? 'bg-purple-100 text-purple-800' :
                    scenario.category === 'expressive' ? 'bg-pink-100 text-pink-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {scenario.category}
                  </span>
                </div>

                <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded border-l-4 border-gray-300">
                  "{scenario.sampleText}"
                </div>

                <button
                  onClick={() => generateScenarioPreview(scenario.id)}
                  disabled={currentlyPlaying === scenario.id}
                  className={`w-full px-3 py-2 rounded-md text-sm transition-colors ${
                    currentlyPlaying === scenario.id
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  }`}
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
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Voice Parameter Adjustment</h3>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">💡 Parameter Guide</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li><strong>Stability:</strong> Higher values = more consistent, lower = more expressive</li>
              <li><strong>Similarity Boost:</strong> How closely to match your original voice</li>
              <li><strong>Style:</strong> Amount of emotional expression and variation</li>
              <li><strong>Speaker Boost:</strong> Enhances voice clarity and presence</li>
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Stability */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium text-gray-700">Stability</label>
                <span className="text-sm text-gray-500">{voiceSettings.stability.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={voiceSettings.stability}
                onChange={(e) => updateVoiceParameter('stability', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>More Variable</span>
                <span>More Stable</span>
              </div>
            </div>

            {/* Similarity Boost */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium text-gray-700">Similarity Boost</label>
                <span className="text-sm text-gray-500">{voiceSettings.similarity_boost.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={voiceSettings.similarity_boost}
                onChange={(e) => updateVoiceParameter('similarity_boost', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>More Creative</span>
                <span>More Similar</span>
              </div>
            </div>

            {/* Style */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium text-gray-700">Style</label>
                <span className="text-sm text-gray-500">{voiceSettings.style.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={voiceSettings.style}
                onChange={(e) => updateVoiceParameter('style', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Less Expressive</span>
                <span>More Expressive</span>
              </div>
            </div>

            {/* Speaker Boost */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700">Speaker Boost</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={voiceSettings.use_speaker_boost}
                    onChange={(e) => updateVoiceParameter('use_speaker_boost', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <p className="text-xs text-gray-500">
                Enhances voice clarity and presence
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VoicePreviewTesting;