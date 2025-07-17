'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { VoiceQualityOptimizer, AudioAnalysis } from '../lib/voiceQualityOptimizer';
import { EnhancedVoiceService, ProfessionalVoiceSettings, EmotionalCalibration } from '../lib/enhancedVoiceService';
import { useOnboardingWizard } from '../lib/onboardingWizardFramework';

// Define the onboarding data structure
export interface VoiceOnboardingData {
  audioFiles: File[];
  recordedAudio: Blob | null;
  qualityAnalysis: AudioAnalysis[];
  voiceSettings: ProfessionalVoiceSettings;
  emotionalCalibration: EmotionalCalibration;
  voiceName: string;
  voiceDescription: string;
  isProcessing: boolean;
  voiceId?: string;
}

// Default settings
const defaultVoiceSettings: ProfessionalVoiceSettings = {
  stability: 0.75,
  similarity_boost: 0.85,
  style: 0.2,
  use_speaker_boost: true,
  optimize_streaming_latency: 0.5,
  model_id: 'eleven_turbo_v2_5'
};

const defaultEmotionalCalibration: EmotionalCalibration = {
  happy: { stability: 0.6, similarity_boost: 0.8, style: 0.4, use_speaker_boost: true },
  sad: { stability: 0.8, similarity_boost: 0.9, style: 0.1, use_speaker_boost: true },
  excited: { stability: 0.5, similarity_boost: 0.7, style: 0.6, use_speaker_boost: true },
  calm: { stability: 0.9, similarity_boost: 0.85, style: 0.1, use_speaker_boost: true },
  serious: { stability: 0.85, similarity_boost: 0.9, style: 0.05, use_speaker_boost: true },
  playful: { stability: 0.6, similarity_boost: 0.75, style: 0.5, use_speaker_boost: true },
  angry: { stability: 0.7, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true },
  surprised: { stability: 0.5, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true },
  neutral: { stability: 0.75, similarity_boost: 0.85, style: 0.2, use_speaker_boost: true }
};

// Step Components
const WelcomeStep: React.FC<any> = ({ nextStep }) => (
  <div className="text-center space-y-6">
    <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    </div>
    <h2 className="text-2xl font-bold text-gray-900">Create Your Voice Clone</h2>
    <p className="text-gray-600 max-w-md mx-auto">
      We'll guide you through creating a high-quality voice clone with advanced emotional capabilities. 
      This process takes about 10-15 minutes.
    </p>
    <div className="bg-blue-50 p-4 rounded-lg">
      <h3 className="font-semibold text-blue-900 mb-2">What you'll need:</h3>
      <ul className="text-sm text-blue-800 space-y-1">
        <li>• 5-10 minutes of clear audio recordings</li>
        <li>• A quiet environment</li>
        <li>• Good quality microphone (built-in is fine)</li>
      </ul>
    </div>
    <button
      onClick={nextStep}
      className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
    >
      Get Started
    </button>
  </div>
);

const AudioUploadStep: React.FC<any> = ({ 
  data, 
  updateData, 
  nextStep, 
  prevStep,
  isValid,
  canGoBack 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleFiles = useCallback(async (files: FileList) => {
    const audioFiles = Array.from(files).filter(file => 
      file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|m4a|ogg)$/i)
    );
    
    if (audioFiles.length === 0) {
      return;
    }

    setIsAnalyzing(true);
    updateData({ 
      audioFiles: [...data.audioFiles, ...audioFiles],
      isProcessing: true 
    });

    // Analyze audio quality
    const optimizer = new VoiceQualityOptimizer();
    const analyses: AudioAnalysis[] = [];
    
    for (const file of audioFiles) {
      try {
        const analysis = await optimizer.analyzeAudioQuality(file);
        analyses.push(analysis);
      } catch (error) {
        console.error('Error analyzing audio:', error);
      }
    }

    updateData({ 
      qualityAnalysis: [...data.qualityAnalysis, ...analyses],
      isProcessing: false 
    });
    setIsAnalyzing(false);
  }, [data.audioFiles, data.qualityAnalysis, updateData]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const removeFile = useCallback((index: number) => {
    const newFiles = data.audioFiles.filter((_: any, i: number) => i !== index);
    const newAnalyses = data.qualityAnalysis.filter((_: any, i: number) => i !== index);
    updateData({ audioFiles: newFiles, qualityAnalysis: newAnalyses });
  }, [data.audioFiles, data.qualityAnalysis, updateData]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Audio Samples</h2>
        <p className="text-gray-600">
          Upload 3-10 audio files with clear speech. Each file should be 30 seconds to 5 minutes long.
        </p>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="w-12 h-12 mx-auto mb-4 text-gray-400">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <p className="text-lg font-medium text-gray-900 mb-2">
          Drop audio files here or click to browse
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Supports MP3, WAV, M4A, OGG formats
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Choose Files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="audio/*,.mp3,.wav,.m4a,.ogg"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {data.audioFiles.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900">Uploaded Files ({data.audioFiles.length})</h3>
          {data.audioFiles.map((file: File, index: number) => {
            const analysis = data.qualityAnalysis[index];
            return (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                    {analysis && ` • Quality: ${analysis.quality_score}/10`}
                  </p>
                  {analysis && analysis.recommendations.length > 0 && (
                    <div className="mt-1">
                      <p className="text-xs text-amber-600">
                        💡 {analysis.recommendations[0]}
                      </p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="text-red-500 hover:text-red-700 p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {isAnalyzing && (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <p className="text-sm text-gray-600 mt-2">Analyzing audio quality...</p>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={prevStep}
          disabled={!canGoBack}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
        >
          ← Back
        </button>
        <button
          onClick={nextStep}
          disabled={!isValid || isAnalyzing}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

const VoiceSettingsStep: React.FC<any> = ({ 
  data, 
  updateData, 
  nextStep, 
  prevStep,
  isValid,
  canGoBack 
}) => {
  const updateSetting = useCallback((key: keyof ProfessionalVoiceSettings, value: any) => {
    updateData({
      voiceSettings: {
        ...data.voiceSettings,
        [key]: value
      }
    });
  }, [data.voiceSettings, updateData]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Voice Settings</h2>
        <p className="text-gray-600">
          Fine-tune your voice parameters for optimal quality and naturalness.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Voice Name
          </label>
          <input
            type="text"
            value={data.voiceName}
            onChange={(e) => updateData({ voiceName: e.target.value })}
            placeholder="My Voice Clone"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description (Optional)
          </label>
          <textarea
            value={data.voiceDescription}
            onChange={(e) => updateData({ voiceDescription: e.target.value })}
            placeholder="A brief description of your voice..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stability: {data.voiceSettings.stability}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={data.voiceSettings.stability}
              onChange={(e) => updateSetting('stability', parseFloat(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Higher values make the voice more consistent but less expressive
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Similarity Boost: {data.voiceSettings.similarity_boost}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={data.voiceSettings.similarity_boost}
              onChange={(e) => updateSetting('similarity_boost', parseFloat(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enhances similarity to original voice
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Style: {data.voiceSettings.style}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={data.voiceSettings.style}
              onChange={(e) => updateSetting('style', parseFloat(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Higher values add more expressiveness and variation
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Streaming Latency: {data.voiceSettings.optimize_streaming_latency}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={data.voiceSettings.optimize_streaming_latency}
              onChange={(e) => updateSetting('optimize_streaming_latency', parseFloat(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Optimize for real-time streaming performance
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={data.voiceSettings.use_speaker_boost}
              onChange={(e) => updateSetting('use_speaker_boost', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Use Speaker Boost</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Model
          </label>
          <select
            value={data.voiceSettings.model_id}
            onChange={(e) => updateSetting('model_id', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="eleven_turbo_v2_5">Turbo v2.5 (Recommended)</option>
            <option value="eleven_multilingual_v2">Multilingual v2</option>
          </select>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={prevStep}
          disabled={!canGoBack}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
        >
          ← Back
        </button>
        <button
          onClick={nextStep}
          disabled={!isValid}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

const ProcessingStep: React.FC<any> = ({ data, updateData }) => {
  const [progress, setProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState('Preparing audio files...');

  useEffect(() => {
    const processVoice = async () => {
      try {
        updateData({ isProcessing: true });
        
        const voiceService = new EnhancedVoiceService();
        
        // Simulate progress updates
        const tasks = [
          'Preparing audio files...',
          'Uploading to ElevenLabs...',
          'Training voice model...',
          'Calibrating emotional parameters...',
          'Finalizing voice profile...'
        ];
        
        for (let i = 0; i < tasks.length; i++) {
          setCurrentTask(tasks[i]);
          setProgress((i + 1) / tasks.length * 100);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Create voice profile
        const voiceId = await voiceService.createVoiceProfile({
          files: data.audioFiles,
          name: data.voiceName,
          description: data.voiceDescription,
          settings: data.voiceSettings,
          emotionalCalibration: data.emotionalCalibration
        });
        
        updateData({ 
          isProcessing: false,
          voiceId
        });
        
      } catch (error) {
        console.error('Error processing voice:', error);
        updateData({ 
          isProcessing: false
        });
      }
    };
    
    processVoice();
  }, [data, updateData]);

  return (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 mx-auto">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600"></div>
      </div>
      
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Creating Your Voice</h2>
        <p className="text-gray-600">
          This may take a few minutes. Please don't close this window.
        </p>
      </div>
      
      <div className="max-w-md mx-auto">
        <div className="bg-gray-200 rounded-full h-2 mb-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <p className="text-sm text-gray-600">{currentTask}</p>
      </div>
    </div>
  );
};

const CompletionStep: React.FC<any> = ({ data }) => (
  <div className="text-center space-y-6">
    <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    </div>
    
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Voice Created Successfully!</h2>
      <p className="text-gray-600">
        Your voice clone "{data.voiceName}" is ready to use with advanced emotional capabilities.
      </p>
    </div>
    
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-md mx-auto">
      <h3 className="font-semibold text-green-900 mb-2">What's Next?</h3>
      <ul className="text-sm text-green-800 space-y-1 text-left">
        <li>• Test your voice with different emotions</li>
        <li>• Adjust settings in Voice Management</li>
        <li>• Start conversations with your AI agent</li>
      </ul>
    </div>
    
    <div className="space-y-3">
      <button
        onClick={() => window.location.href = '/profile/chat'}
        className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Start Chatting
      </button>
      <button
        onClick={() => window.location.href = '/profile'}
        className="w-full border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors"
      >
        Go to Profile
      </button>
    </div>
  </div>
);

// Define the onboarding steps
const createOnboardingSteps = (): any[] => [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Introduction to voice cloning',
    component: WelcomeStep,
    validation: () => ({ isValid: true, errors: [] }),
    tips: ['Take your time to read through the requirements'],
    canSkip: false
  },
  {
    id: 'upload',
    title: 'Upload Audio',
    description: 'Upload your voice samples',
    component: AudioUploadStep,
    validation: (data) => data.audioFiles.length >= 3,
    tips: [
      'Use clear, high-quality recordings',
      'Speak naturally and vary your tone',
      'Include different emotions and speaking styles'
    ],
    canSkip: false,
    requiredFields: ['audioFiles']
  },
  {
    id: 'settings',
    title: 'Voice Settings',
    description: 'Configure voice parameters',
    component: VoiceSettingsStep,
    validation: (data) => data.voiceName.length > 0,
    tips: [
      'Start with default settings and adjust as needed',
      'Higher stability = more consistent voice',
      'Higher style = more expressive voice'
    ],
    canSkip: false,
    requiredFields: ['voiceName']
  },
  {
    id: 'processing',
    title: 'Processing',
    description: 'Creating your voice clone',
    component: ProcessingStep,
    validation: () => ({ isValid: true, errors: [] }),
    tips: ['This process typically takes 3-5 minutes'],
    canSkip: false
  },
  {
    id: 'completion',
    title: 'Complete',
    description: 'Voice clone ready',
    component: CompletionStep,
    validation: () => ({ isValid: true, errors: [] }),
    tips: ['Your voice is now ready to use!'],
    canSkip: false
  }
];

// Main component
export const EnhancedVoiceOnboardingNew: React.FC = () => {
  const { wizard, state, currentStep, stepProps, progress } = useOnboardingWizard({
    steps: createOnboardingSteps(),
    initialData: {
      audioFiles: [],
      recordedAudio: null,
      qualityAnalysis: [],
      voiceSettings: defaultVoiceSettings,
      emotionalCalibration: defaultEmotionalCalibration,
      voiceName: '',
      voiceDescription: '',
      isProcessing: false
    },
    onComplete: async (data) => {
      console.log('Onboarding completed with data:', data);
      // Handle completion logic here
    },
    onStepChange: (stepId, stepIndex, data) => {
      console.log(`Step changed to ${stepId} (${stepIndex})`, data);
    },
    persistProgress: true,
    storageKey: 'voice-onboarding-progress'
  });

  const StepComponent = currentStep.component;

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Step {progress.current} of {progress.total}
          </span>
          <span className="text-sm text-gray-500">
            {progress.percentage}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress.percentage}%` }}
          ></div>
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <StepComponent {...stepProps} />
      </div>

      {/* Tips Sidebar */}
      {currentStep.tips.length > 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">💡 Tips</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            {currentStep.tips.map((tip, index) => (
              <li key={index}>• {tip}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Debug Info (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-6 p-4 bg-gray-100 rounded-lg text-xs">
          <p>Current Step: {currentStep.id}</p>
          <p>Valid: {stepProps.isValid ? 'Yes' : 'No'}</p>
          <p>Errors: {stepProps.errors.join(', ')}</p>
          <p>Completed Steps: {progress.completedSteps.join(', ')}</p>
        </div>
      )}
    </div>
  );
};

export default EnhancedVoiceOnboardingNew;