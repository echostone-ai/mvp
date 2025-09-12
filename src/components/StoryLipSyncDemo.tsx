'use client';

import { useState, useEffect } from 'react';
import { globalStoryAudioManager } from '../lib/services/storyAudioManager';
import { UserStory } from '../lib/types/stories';

/**
 * StoryLipSyncDemo - Demonstration component for experimental lip-sync feature
 * 
 * Task 17: Integrate with avatar lip-sync system (experimental, off by default)
 * Shows how the lip-sync integration works with story playback
 */

export default function StoryLipSyncDemo() {
  const [lipSyncEnabled, setLipSyncEnabled] = useState(false);
  const [lipSyncStatus, setLipSyncStatus] = useState({
    enabled: false,
    available: false,
    currentState: 'idle',
    avatarConnected: false
  });
  const [isPlaying, setIsPlaying] = useState(false);

  // Mock story for demonstration
  const demoStory: UserStory = {
    id: 'demo-story-123',
    owner_id: 'demo-avatar',
    owner_type: 'avatar',
    title: 'My Childhood Memory',
    category: 'memory',
    triggers: 'childhood, memory, growing up',
    audio_url: '/demo-story.mp3',
    duration_ms: 45000,
    transcript: 'When I was seven years old, I remember the first time I saw snow falling outside my bedroom window. The flakes looked like tiny dancers in the moonlight, each one unique and beautiful. I pressed my face against the cold glass and watched in wonder as the world transformed into a magical winter wonderland.',
    priority: 75,
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  };

  useEffect(() => {
    updateStatus();
  }, [lipSyncEnabled]);

  const updateStatus = async () => {
    const status = globalStoryAudioManager.getLipSyncStatus();
    const available = await globalStoryAudioManager.isLipSyncAvailable();
    
    setLipSyncStatus({
      ...status,
      available
    });
  };

  const handleToggleLipSync = async () => {
    const newEnabled = !lipSyncEnabled;
    setLipSyncEnabled(newEnabled);
    
    globalStoryAudioManager.setLipSyncEnabled(newEnabled);
    await updateStatus();
  };

  const handleTestLipSync = async () => {
    if (isPlaying) return;
    
    setIsPlaying(true);
    
    try {
      console.log('🎭 Testing lip-sync with demo story...');
      
      // Create a mock streaming manager for the demo
      const mockStreamingManager = {
        stop: () => console.log('TTS stopped for story'),
        addSentence: async (text: string) => console.log('TTS fallback:', text)
      } as any;

      const result = await globalStoryAudioManager.replaceNextTTSWithStory(
        demoStory,
        mockStreamingManager
      );

      console.log('🎭 Lip-sync test result:', result);
      
      if (result.success) {
        console.log(`✅ Story played with lip-sync: ${result.lip_sync_method}`);
      } else {
        console.log(`❌ Story playback failed: ${result.error_message}`);
      }
      
    } catch (error) {
      console.error('🎭 Lip-sync test error:', error);
    } finally {
      setTimeout(() => setIsPlaying(false), 2000); // Reset after 2 seconds
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'text-green-600';
      case 'connected': return 'text-blue-600';
      case 'unavailable': return 'text-yellow-600';
      case 'disabled': return 'text-gray-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusText = () => {
    if (!lipSyncStatus.enabled) return 'Disabled';
    if (lipSyncStatus.available) return 'Available & Ready';
    if (lipSyncStatus.avatarConnected) return 'Avatar Connected (Initializing)';
    return 'Avatar Not Connected';
  };

  return (
    <div className="story-lipsync-demo max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            🎭 Experimental Lip-Sync Demo
          </h2>
          <p className="text-gray-600">
            Test the integration between story audio and avatar lip-sync
          </p>
        </div>

        {/* Experimental Warning */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Experimental Feature:</strong> This lip-sync integration is experimental and requires a connected HeyGen avatar. 
                It will gracefully fallback to idle animation if unavailable.
              </p>
            </div>
          </div>
        </div>

        {/* Status Display */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Lip-Sync Status</h3>
            <div className={`text-lg font-semibold ${getStatusColor(getStatusText().toLowerCase())}`}>
              {getStatusText()}
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Current State</h3>
            <div className="text-lg font-semibold text-gray-900 capitalize">
              {lipSyncStatus.currentState}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4 mb-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Enable Experimental Lip-Sync</h3>
              <p className="text-sm text-gray-500">Attempt to sync avatar lips with story audio</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={lipSyncEnabled}
                onChange={handleToggleLipSync}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Test Button */}
          <button
            onClick={handleTestLipSync}
            disabled={isPlaying}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              isPlaying
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : lipSyncEnabled
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-600 hover:bg-gray-700 text-white'
            }`}
          >
            {isPlaying ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Testing Lip-Sync...
              </div>
            ) : (
              '🎭 Test Lip-Sync with Demo Story'
            )}
          </button>
        </div>

        {/* Demo Story Info */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Demo Story Details</h3>
          
          <div className="bg-blue-50 rounded-lg p-4 space-y-3">
            <div>
              <span className="text-sm font-medium text-blue-900">Title:</span>
              <span className="text-sm text-blue-800 ml-2">{demoStory.title}</span>
            </div>
            
            <div>
              <span className="text-sm font-medium text-blue-900">Category:</span>
              <span className="text-sm text-blue-800 ml-2 capitalize">{demoStory.category}</span>
            </div>
            
            <div>
              <span className="text-sm font-medium text-blue-900">Duration:</span>
              <span className="text-sm text-blue-800 ml-2">{Math.round(demoStory.duration_ms / 1000)}s</span>
            </div>
            
            <div>
              <span className="text-sm font-medium text-blue-900">Transcript:</span>
              <p className="text-sm text-blue-800 mt-1 italic">
                "{demoStory.transcript?.substring(0, 120)}..."
              </p>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="border-t border-gray-200 pt-6 mt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">How Lip-Sync Works</h3>
          
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start">
              <span className="text-blue-600 font-bold mr-2">1.</span>
              <span>System checks if HeyGen avatar is connected and available</span>
            </div>
            
            <div className="flex items-start">
              <span className="text-blue-600 font-bold mr-2">2.</span>
              <span>Uses story transcript for accurate lip-sync, or generates fallback text</span>
            </div>
            
            <div className="flex items-start">
              <span className="text-blue-600 font-bold mr-2">3.</span>
              <span>Attempts to sync avatar lips with the text while story audio plays</span>
            </div>
            
            <div className="flex items-start">
              <span className="text-blue-600 font-bold mr-2">4.</span>
              <span>Falls back to idle animation if lip-sync is unavailable</span>
            </div>
            
            <div className="flex items-start">
              <span className="text-blue-600 font-bold mr-2">5.</span>
              <span>Smoothly transitions back to TTS lip-sync after story completes</span>
            </div>
          </div>
        </div>

        {/* Console Instructions */}
        <div className="bg-gray-50 rounded-lg p-4 mt-6">
          <p className="text-sm text-gray-600">
            <strong>💡 Tip:</strong> Open your browser's developer console to see detailed lip-sync logs and debug information.
          </p>
        </div>
      </div>
    </div>
  );
}