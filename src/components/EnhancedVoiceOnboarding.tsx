'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { VoiceQualityOptimizer, AudioAnalysis } from '../lib/voiceQualityOptimizer';
import { EnhancedVoiceService, ProfessionalVoiceSettings, EmotionalCalibration } from '../lib/enhancedVoiceService';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<OnboardingStepProps>;
  validation: (data: OnboardingState) => { isValid: boolean; errors: string[] };
  tips: string[];
  canSkip?: boolean;
  requiredFields?: string[];
}

export interface OnboardingStepProps {
  data: OnboardingState;
  updateData: (updates: Partial<OnboardingState>) => void;
  nextStep: () => void;
  prevStep: () => void;
  isValid: boolean;
}

export interface OnboardingState {
  currentStep: number;
  audioFiles: File[];
  recordedAudio: Blob | null;
  qualityAnalysis: AudioAnalysis[];
  voiceSettings: ProfessionalVoiceSettings;
  emotionalCalibration: EmotionalCalibration;
  voiceName: string;
  voiceDescription: string;
  isProcessing: boolean;
  errors: string[];
  voiceId?: string; // added
}

const defaultVoiceSettings: ProfessionalVoiceSettings = {
  stability: 0.75,
  similarity_boost: 0.85,
  style: 0.2,
  use_speaker_boost: true,
  optimize_streaming_latency: 0.5,
  model_id: 'eleven_turbo_v2_5'
};

const defaultEmotionalCalibration: EmotionalCalibration = {
  // Core Positive Emotions
  happy: { stability: 0.35, similarity_boost: 0.75, style: 0.85, use_speaker_boost: true },
  excited: { stability: 0.15, similarity_boost: 0.65, style: 0.95, use_speaker_boost: true },
  playful: { stability: 0.25, similarity_boost: 0.70, style: 0.90, use_speaker_boost: true },
  confident: { stability: 0.65, similarity_boost: 0.85, style: 0.60, use_speaker_boost: true },
  romantic: { stability: 0.55, similarity_boost: 0.80, style: 0.70, use_speaker_boost: true },
  
  // Calm & Reflective
  calm: { stability: 0.85, similarity_boost: 0.90, style: 0.25, use_speaker_boost: true },
  serious: { stability: 0.80, similarity_boost: 0.95, style: 0.20, use_speaker_boost: true },
  nostalgic: { stability: 0.70, similarity_boost: 0.85, style: 0.45, use_speaker_boost: true },
  mysterious: { stability: 0.75, similarity_boost: 0.80, style: 0.55, use_speaker_boost: true },
  
  // Intense Emotions
  sad: { stability: 0.90, similarity_boost: 0.85, style: 0.30, use_speaker_boost: true },
  angry: { stability: 0.20, similarity_boost: 0.60, style: 0.85, use_speaker_boost: true },
  surprised: { stability: 0.30, similarity_boost: 0.70, style: 0.80, use_speaker_boost: true },
  determined: { stability: 0.60, similarity_boost: 0.85, style: 0.65, use_speaker_boost: true },
  
  // Creative & Unique
  whimsical: { stability: 0.40, similarity_boost: 0.75, style: 0.75, use_speaker_boost: true },
  sarcastic: { stability: 0.50, similarity_boost: 0.80, style: 0.70, use_speaker_boost: true },
  neutral: { stability: 0.75, similarity_boost: 0.85, style: 0.35, use_speaker_boost: true }
};

// Step Components
const WelcomeStep: React.FC<OnboardingStepProps> = ({ nextStep }) => (
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

const AudioUploadStep: React.FC<OnboardingStepProps> = ({ data, updateData, nextStep, isValid }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const [dragActive, setDragActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [liveAudioMetrics, setLiveAudioMetrics] = useState<{
    volume: number;
    noiseLevel: number;
    quality: 'poor' | 'fair' | 'good' | 'excellent';
    suggestions: string[];
  }>({
    volume: 0,
    noiseLevel: 0,
    quality: 'fair',
    suggestions: []
  });
  
  const [realTimeFeedback, setRealTimeFeedback] = useState<{
    currentFile?: string;
    progress: number;
    status: 'idle' | 'analyzing' | 'complete' | 'error';
    message: string;
  }>({
    progress: 0,
    status: 'idle',
    message: 'Ready to analyze audio files'
  });

  const handleFiles = useCallback(async (files: FileList) => {
    const audioFiles = Array.from(files).filter(file => 
      file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|m4a|ogg)$/i)
    );
    
    if (audioFiles.length === 0) {
      updateData({ errors: ['Please select valid audio files'] });
      setRealTimeFeedback({
        progress: 0,
        status: 'error',
        message: 'No valid audio files found'
      });
      return;
    }

    updateData({ 
      audioFiles: [...data.audioFiles, ...audioFiles],
      errors: [],
      isProcessing: true 
    });

    // Real-time analysis with progress feedback
    const optimizer = new VoiceQualityOptimizer();
    const analyses: AudioAnalysis[] = [];
    
    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      const progress = ((i + 1) / audioFiles.length) * 100;
      
      setRealTimeFeedback({
        currentFile: file.name,
        progress,
        status: 'analyzing',
        message: `Analyzing ${file.name}... (${i + 1}/${audioFiles.length})`
      });
      
      try {
        const analysis = await optimizer.analyzeAudioQuality(file);
        analyses.push(analysis);
        
        // Provide immediate feedback for each file
        if (analysis.quality_score < 4) {
          setRealTimeFeedback({
            currentFile: file.name,
            progress,
            status: 'error',
            message: `⚠️ ${file.name}: Quality issues detected - ${analysis.recommendations[0] || 'Consider re-recording'}`
          });
          await new Promise(resolve => setTimeout(resolve, 2000)); // Show message for 2 seconds
        } else if (analysis.quality_score >= 8) {
          setRealTimeFeedback({
            currentFile: file.name,
            progress,
            status: 'complete',
            message: `✅ ${file.name}: Excellent quality!`
          });
          await new Promise(resolve => setTimeout(resolve, 1000)); // Show message for 1 second
        }
      } catch (error) {
        console.error('Error analyzing audio:', error);
        setRealTimeFeedback({
          currentFile: file.name,
          progress,
          status: 'error',
          message: `❌ ${file.name}: Analysis failed`
        });
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    setRealTimeFeedback({
      progress: 100,
      status: 'complete',
      message: `Analysis complete! ${analyses.length} files processed.`
    });

    updateData({ 
      qualityAnalysis: [...data.qualityAnalysis, ...analyses],
      isProcessing: false 
    });
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
    const newFiles = data.audioFiles.filter((_, i) => i !== index);
    const newAnalyses = data.qualityAnalysis.filter((_, i) => i !== index);
    updateData({ audioFiles: newFiles, qualityAnalysis: newAnalyses });
  }, [data.audioFiles, data.qualityAnalysis, updateData]);

  // Live recording functions
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });
      
      // Set up audio context for real-time analysis
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      analyserRef.current.fftSize = 2048;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      // Start real-time audio analysis
      const analyzeAudio = () => {
        if (!analyserRef.current || !isRecording) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate volume level
        const volume = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length / 255;
        
        // Estimate noise level (simplified)
        const lowFreqEnergy = dataArray.slice(0, 10).reduce((sum, value) => sum + value, 0) / 10;
        const noiseLevel = lowFreqEnergy / 255;
        
        // Determine quality based on volume and noise
        let quality: 'poor' | 'fair' | 'good' | 'excellent' = 'fair';
        const suggestions: string[] = [];
        
        if (volume < 0.1) {
          quality = 'poor';
          suggestions.push('Speak louder or move closer to the microphone');
        } else if (volume > 0.8) {
          quality = 'poor';
          suggestions.push('Reduce volume to avoid clipping');
        } else if (noiseLevel > 0.3) {
          quality = 'fair';
          suggestions.push('Try to reduce background noise');
        } else if (volume > 0.3 && volume < 0.7 && noiseLevel < 0.2) {
          quality = 'excellent';
          suggestions.push('Perfect! Keep speaking at this level');
        } else {
          quality = 'good';
          suggestions.push('Good quality - continue speaking naturally');
        }
        
        setLiveAudioMetrics({
          volume,
          noiseLevel,
          quality,
          suggestions
        });
        
        animationFrameRef.current = requestAnimationFrame(analyzeAudio);
      };
      
      analyzeAudio();
      
      // Set up MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        chunks.push(event.data);
      };
      
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const file = new File([blob], `recording_${Date.now()}.wav`, { type: 'audio/wav' });
        
        // Add recorded file to the list
        updateData({ 
          audioFiles: [...data.audioFiles, file],
          recordedAudio: blob 
        });
        
        // Analyze the recorded file
        const optimizer = new VoiceQualityOptimizer();
        try {
          const analysis = await optimizer.analyzeAudioQuality(file);
          updateData({ 
            qualityAnalysis: [...data.qualityAnalysis, analysis]
          });
        } catch (error) {
          console.error('Error analyzing recorded audio:', error);
        }
        
        // Clean up
        stream.getTracks().forEach(track => track.stop());
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start recording timer
      const timer = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // Store timer reference for cleanup
      (mediaRecorderRef.current as any).timer = timer;
      
    } catch (error) {
      console.error('Error starting recording:', error);
      setLiveAudioMetrics(prev => ({
        ...prev,
        quality: 'poor',
        suggestions: ['Microphone access denied or not available']
      }));
    }
  }, [data.audioFiles, data.qualityAnalysis, updateData, isRecording]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Clear timer
      if ((mediaRecorderRef.current as any).timer) {
        clearInterval((mediaRecorderRef.current as any).timer);
      }
      
      // Stop real-time analysis
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  }, [isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Audio Samples</h2>
        <p className="text-gray-600">
          Upload 3-10 audio files with clear speech. Each file should be 30 seconds to 5 minutes long.
        </p>
      </div>

      {/* Upload and Recording Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* File Upload Section */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragActive 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="w-10 h-10 mx-auto mb-3 text-gray-400">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="font-medium text-gray-900 mb-1">Upload Files</p>
          <p className="text-sm text-gray-500 mb-3">
            Drop files or click to browse
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
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

        {/* Live Recording Section */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <div className="w-10 h-10 mx-auto mb-3 text-gray-400">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <p className="font-medium text-gray-900 mb-1">Record Live</p>
          <p className="text-sm text-gray-500 mb-3">
            Record directly in your browser
          </p>
          
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              🎤 Start Recording
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-red-600">
                  Recording: {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <button
                onClick={stopRecording}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm"
              >
                ⏹️ Stop Recording
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Live Recording Feedback */}
      {isRecording && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Live Audio Feedback</h4>
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
              liveAudioMetrics.quality === 'excellent' 
                ? 'bg-green-100 text-green-800'
                : liveAudioMetrics.quality === 'good'
                ? 'bg-blue-100 text-blue-800'
                : liveAudioMetrics.quality === 'fair'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {liveAudioMetrics.quality === 'excellent' && '🟢 Excellent'}
              {liveAudioMetrics.quality === 'good' && '🔵 Good'}
              {liveAudioMetrics.quality === 'fair' && '🟡 Fair'}
              {liveAudioMetrics.quality === 'poor' && '🔴 Poor'}
            </div>
          </div>
          
          {/* Volume and Noise Meters */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Volume Level</span>
                <span className="text-gray-900 font-medium">{Math.round(liveAudioMetrics.volume * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-100 ${
                    liveAudioMetrics.volume < 0.1 
                      ? 'bg-red-500' 
                      : liveAudioMetrics.volume > 0.8
                      ? 'bg-red-500'
                      : liveAudioMetrics.volume > 0.3
                      ? 'bg-green-500'
                      : 'bg-yellow-500'
                  }`}
                  style={{ width: `${Math.min(100, liveAudioMetrics.volume * 100)}%` }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Noise Level</span>
                <span className="text-gray-900 font-medium">{Math.round(liveAudioMetrics.noiseLevel * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-100 ${
                    liveAudioMetrics.noiseLevel < 0.2 
                      ? 'bg-green-500' 
                      : liveAudioMetrics.noiseLevel < 0.4
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(100, liveAudioMetrics.noiseLevel * 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          {/* Real-time Suggestions */}
          {liveAudioMetrics.suggestions.length > 0 && (
            <div className={`rounded-lg p-3 ${
              liveAudioMetrics.quality === 'excellent' 
                ? 'bg-green-50 border border-green-200'
                : liveAudioMetrics.quality === 'good'
                ? 'bg-blue-50 border border-blue-200'
                : liveAudioMetrics.quality === 'fair'
                ? 'bg-yellow-50 border border-yellow-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              <p className={`text-sm font-medium mb-1 ${
                liveAudioMetrics.quality === 'excellent' 
                  ? 'text-green-900'
                  : liveAudioMetrics.quality === 'good'
                  ? 'text-blue-900'
                  : liveAudioMetrics.quality === 'fair'
                  ? 'text-yellow-900'
                  : 'text-red-900'
              }`}>
                💡 Live Tip:
              </p>
              <p className={`text-sm ${
                liveAudioMetrics.quality === 'excellent' 
                  ? 'text-green-800'
                  : liveAudioMetrics.quality === 'good'
                  ? 'text-blue-800'
                  : liveAudioMetrics.quality === 'fair'
                  ? 'text-yellow-800'
                  : 'text-red-800'
              }`}>
                {liveAudioMetrics.suggestions[0]}
              </p>
            </div>
          )}
        </div>
      )}

      {data.audioFiles.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900">Uploaded Files ({data.audioFiles.length})</h3>
          {data.audioFiles.map((file, index) => {
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

      {/* Real-time Audio Feedback */}
      {(data.isProcessing || realTimeFeedback.status !== 'idle') && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Audio Analysis</h4>
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
              realTimeFeedback.status === 'analyzing' 
                ? 'bg-blue-100 text-blue-800'
                : realTimeFeedback.status === 'complete'
                ? 'bg-green-100 text-green-800'
                : realTimeFeedback.status === 'error'
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {realTimeFeedback.status === 'analyzing' && '🔄 Analyzing'}
              {realTimeFeedback.status === 'complete' && '✅ Complete'}
              {realTimeFeedback.status === 'error' && '⚠️ Issues Found'}
              {realTimeFeedback.status === 'idle' && '⏳ Ready'}
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Progress</span>
              <span className="text-gray-900 font-medium">{Math.round(realTimeFeedback.progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  realTimeFeedback.status === 'error' 
                    ? 'bg-red-500' 
                    : realTimeFeedback.status === 'complete'
                    ? 'bg-green-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${realTimeFeedback.progress}%` }}
              ></div>
            </div>
          </div>
          
          {/* Current Status Message */}
          <div className="flex items-start space-x-2">
            {realTimeFeedback.status === 'analyzing' && (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent mt-0.5"></div>
            )}
            <p className={`text-sm flex-1 ${
              realTimeFeedback.status === 'error' 
                ? 'text-red-700' 
                : realTimeFeedback.status === 'complete'
                ? 'text-green-700'
                : 'text-gray-700'
            }`}>
              {realTimeFeedback.message}
            </p>
          </div>
          
          {/* Real-time Tips */}
          {realTimeFeedback.status === 'analyzing' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h5 className="text-sm font-medium text-blue-900 mb-1">💡 While we analyze...</h5>
              <p className="text-xs text-blue-800">
                We're checking audio quality, noise levels, and duration. 
                High-quality recordings will give you the best voice clone results.
              </p>
            </div>
          )}
          
          {/* Quality Summary */}
          {data.qualityAnalysis.length > 0 && realTimeFeedback.status === 'complete' && (
            <div className="bg-gray-50 rounded-lg p-3">
              <h5 className="text-sm font-medium text-gray-900 mb-2">📊 Quality Summary</h5>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-600">Average Quality:</span>
                  <span className="ml-1 font-medium">
                    {(data.qualityAnalysis.reduce((sum, a) => sum + a.quality_score, 0) / data.qualityAnalysis.length).toFixed(1)}/10
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Total Duration:</span>
                  <span className="ml-1 font-medium">
                    {Math.round(data.qualityAnalysis.reduce((sum, a) => sum + a.duration, 0))}s
                  </span>
                </div>
              </div>
              
              {/* Best Practices Tips */}
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-600 mb-1">🎯 Best Practices:</p>
                <ul className="text-xs text-gray-600 space-y-0.5">
                  <li>• Aim for 5-10 minutes total audio</li>
                  <li>• Include varied emotions and speaking styles</li>
                  <li>• Ensure consistent audio quality across files</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {data.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          {data.errors.map((error, index) => (
            <p key={index} className="text-red-700 text-sm">{error}</p>
          ))}
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={() => updateData({ currentStep: data.currentStep - 1 })}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={nextStep}
          disabled={!isValid || data.isProcessing}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

const VoiceSettingsStep: React.FC<OnboardingStepProps> = ({ data, updateData, nextStep, prevStep }) => {
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
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={nextStep}
          disabled={!data.voiceName.trim()}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

const ProcessingStep: React.FC<OnboardingStepProps> = ({ data, updateData, nextStep }) => {
  const [progress, setProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState('Preparing audio files...');

  useEffect(() => {
    const processVoice = async () => {
      try {
        updateData({ isProcessing: true, errors: [] });
        
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
          voiceSettings: { ...data.voiceSettings }, // removed voice_id
          voiceId // add this if not already in state
        });
        
        nextStep();
      } catch (error) {
        console.error('Error processing voice:', error);
        updateData({ 
          isProcessing: false,
          errors: ['Failed to create voice profile. Please try again.']
        });
      }
    };
    
    processVoice();
  }, []);

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
      
      {data.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md mx-auto">
          {data.errors.map((error, index) => (
            <p key={index} className="text-red-700 text-sm">{error}</p>
          ))}
          <button
            onClick={() => window.location.reload()}
            className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};

const CompletionStep: React.FC<OnboardingStepProps> = ({ data }) => (
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

export const EnhancedVoiceOnboarding: React.FC = () => {
  const [state, setState] = useState<OnboardingState>({
    currentStep: 0,
    audioFiles: [],
    recordedAudio: null,
    qualityAnalysis: [],
    voiceSettings: defaultVoiceSettings,
    emotionalCalibration: defaultEmotionalCalibration,
    voiceName: '',
    voiceDescription: '',
    isProcessing: false,
    errors: [],
    voiceId: undefined // added
  });

  const steps: OnboardingStep[] = [
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
      validation: (data: OnboardingState) => {
        const errors: string[] = [];
        
        if (data.audioFiles.length < 3) {
          errors.push('Please upload at least 3 audio files');
        }
        
        if (data.audioFiles.length > 10) {
          errors.push('Maximum 10 audio files allowed');
        }
        
        // Check for quality issues
        const lowQualityFiles = data.qualityAnalysis.filter(analysis => analysis.quality_score < 4);
        if (lowQualityFiles.length > data.audioFiles.length / 2) {
          errors.push('Too many files have quality issues. Please improve audio quality.');
        }
        
        // Check for processing state
        if (data.isProcessing) {
          errors.push('Please wait for audio analysis to complete');
        }
        
        return {
          isValid: errors.length === 0,
          errors
        };
      },
      tips: [
        'Use clear, high-quality recordings',
        'Speak naturally and vary your tone',
        'Include different emotions and speaking styles',
        'Each file should be 30 seconds to 5 minutes long'
      ],
      requiredFields: ['audioFiles'],
      canSkip: false
    },
    {
      id: 'settings',
      title: 'Voice Settings',
      description: 'Configure voice parameters',
      component: VoiceSettingsStep,
      validation: (data: OnboardingState) => {
        const errors: string[] = [];
        
        if (!data.voiceName.trim()) {
          errors.push('Voice name is required');
        }
        
        if (data.voiceName.trim().length < 2) {
          errors.push('Voice name must be at least 2 characters long');
        }
        
        if (data.voiceName.trim().length > 50) {
          errors.push('Voice name must be less than 50 characters');
        }
        
        return {
          isValid: errors.length === 0,
          errors
        };
      },
      tips: [
        'Start with default settings and adjust as needed',
        'Higher stability = more consistent voice',
        'Higher style = more expressive voice',
        'Use Speaker Boost for better quality with your voice'
      ],
      requiredFields: ['voiceName'],
      canSkip: false
    },
    {
      id: 'processing',
      title: 'Processing',
      description: 'Creating your voice clone',
      component: ProcessingStep,
      validation: () => ({ isValid: true, errors: [] }),
      tips: ['This process typically takes 3-5 minutes', 'Please keep this window open'],
      canSkip: false
    },
    {
      id: 'preview',
      title: 'Preview & Test',
      description: 'Test your voice with different emotions',
      // component: VoicePreviewStep, // Temporarily comment out or replace if not defined
      component: CompletionStep, // Use CompletionStep as a placeholder
      validation: (data: OnboardingState) => {
        const errors: string[] = [];
        // Check if voice has been created
        if (!data.voiceId) {
          errors.push('Voice must be created before testing');
        }
        return {
          isValid: errors.length === 0,
          errors
        };
      },
      tips: [
        'Test your voice with different emotional contexts',
        'Adjust parameters to fine-tune the output',
        'Try different sample texts to hear variations'
      ],
      canSkip: true
    },
    {
      id: 'completion',
      title: 'Complete',
      description: 'Voice clone ready',
      component: CompletionStep,
      validation: () => ({ isValid: true, errors: [] }),
      tips: ['Your voice is now ready to use!', 'Test different emotional contexts'],
      canSkip: false
    }
  ];

  const updateData = useCallback((updates: Partial<OnboardingState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const nextStep = useCallback(() => {
    const currentValidation = steps[state.currentStep].validation(state);
    if (currentValidation.isValid && state.currentStep < steps.length - 1) {
      setState(prev => ({ ...prev, currentStep: prev.currentStep + 1, errors: [] }));
    } else if (!currentValidation.isValid) {
      setState(prev => ({ ...prev, errors: currentValidation.errors }));
    }
  }, [state, steps]);

  const prevStep = useCallback(() => {
    if (state.currentStep > 0) {
      setState(prev => ({ ...prev, currentStep: prev.currentStep - 1, errors: [] }));
    }
  }, [state.currentStep]);

  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < steps.length) {
      // Validate all previous steps before allowing navigation
      let canNavigate = true;
      for (let i = 0; i < stepIndex; i++) {
        const stepValidation = steps[i].validation(state);
        if (!stepValidation.isValid && !steps[i].canSkip) {
          canNavigate = false;
          break;
        }
      }
      
      if (canNavigate) {
        setState(prev => ({ ...prev, currentStep: stepIndex, errors: [] }));
      }
    }
  }, [state, steps]);

  const currentStepData = steps[state.currentStep];
  const validationResult = currentStepData.validation(state);
  const isValid = validationResult.isValid;
  const StepComponent = currentStepData.component;

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Step Navigation */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-gray-700">
            Step {state.currentStep + 1} of {steps.length}
          </span>
          <span className="text-sm text-gray-500">
            {Math.round(((state.currentStep + 1) / steps.length) * 100)}%
          </span>
        </div>
        
        {/* Step Indicators */}
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => {
            const stepValidation = step.validation(state);
            const isCompleted = index < state.currentStep || (index === state.currentStep && stepValidation.isValid);
            const isCurrent = index === state.currentStep;
            const canNavigate = index <= state.currentStep || (index === state.currentStep + 1 && stepValidation.isValid);
            
            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => canNavigate ? goToStep(index) : undefined}
                  disabled={!canNavigate}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    isCompleted
                      ? 'bg-green-600 text-white'
                      : isCurrent
                      ? 'bg-blue-600 text-white'
                      : canNavigate
                      ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                  title={step.title}
                >
                  {isCompleted && index < state.currentStep ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </button>
                {index < steps.length - 1 && (
                  <div className={`w-8 h-0.5 mx-2 ${
                    index < state.currentStep ? 'bg-green-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
        
        {/* Current Step Title */}
        <div className="text-center">
          <h1 className="text-lg font-semibold text-gray-900">{currentStepData.title}</h1>
          <p className="text-sm text-gray-600">{currentStepData.description}</p>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((state.currentStep + 1) / steps.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <StepComponent
          data={state}
          updateData={updateData}
          nextStep={nextStep}
          prevStep={prevStep}
          isValid={isValid}
        />
      </div>

      {/* Validation Errors */}
      {!isValid && validationResult.errors.length > 0 && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-semibold text-red-900 mb-2">⚠️ Please fix these issues:</h3>
          <ul className="text-sm text-red-800 space-y-1">
            {validationResult.errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Tips Sidebar */}
      {currentStepData.tips.length > 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">💡 Tips</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            {currentStepData.tips.map((tip, index) => (
              <li key={index}>• {tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default EnhancedVoiceOnboarding;