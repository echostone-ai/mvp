'use client';

import { useState, useEffect } from 'react';
import { globalStoryAudioManager } from '../lib/services/storyAudioManager';

/**
 * StoryLipSyncSettings - Configuration component for experimental lip-sync feature
 * 
 * Task 17: Integrate with avatar lip-sync system (experimental, off by default)
 * - Add configuration option to enable/disable lip-sync attempts
 * - Label as experimental feature with graceful degradation
 * 
 * Requirements: 3.2, 7.4
 */

interface LipSyncStatus {
  enabled: boolean;
  available: boolean;
  currentState: string;
  avatarConnected: boolean;
}

interface LipSyncConfig {
  fallbackToIdle: boolean;
  transitionDurationMs: number;
  debugMode: boolean;
}

export default function StoryLipSyncSettings() {
  const [status, setStatus] = useState<LipSyncStatus>({
    enabled: false,
    available: false,
    currentState: 'idle',
    avatarConnected: false
  });
  
  const [config, setConfig] = useState<LipSyncConfig>({
    fallbackToIdle: true,
    transitionDurationMs: 300,
    debugMode: false
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load current status and configuration
  useEffect(() => {
    loadCurrentStatus();
  }, []);

  const loadCurrentStatus = async () => {
    try {
      const currentStatus = globalStoryAudioManager.getLipSyncStatus();
      setStatus(currentStatus);
      
      // Check availability
      const available = await globalStoryAudioManager.isLipSyncAvailable();
      setStatus(prev => ({ ...prev, available }));
    } catch (error) {
      console.error('Failed to load lip-sync status:', error);
    }
  };

  const handleToggleLipSync = async (enabled: boolean) => {
    setIsLoading(true);
    
    try {
      globalStoryAudioManager.setLipSyncEnabled(enabled);
      
      // Update status
      await loadCurrentStatus();
      
      console.log(`Lip-sync ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to toggle lip-sync:', error);
      alert('Failed to update lip-sync setting. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigUpdate = (updates: Partial<LipSyncConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    
    try {
      globalStoryAudioManager.updateLipSyncConfig(newConfig);
      console.log('Lip-sync configuration updated:', newConfig);
    } catch (error) {
      console.error('Failed to update lip-sync config:', error);
    }
  };

  const getStatusColor = () => {
    if (!status.enabled) return 'text-gray-500';
    if (status.available) return 'text-green-600';
    return 'text-yellow-600';
  };

  const getStatusText = () => {
    if (!status.enabled) return 'Disabled';
    if (status.available) return 'Available';
    if (status.avatarConnected) return 'Avatar Connected (Initializing)';
    return 'Avatar Not Connected';
  };

  return (
    <div className="story-lipsync-settings">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Experimental Lip-Sync
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Sync avatar lip movements with story audio (experimental feature)
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <span className={`text-sm font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </span>
            
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={status.enabled}
                onChange={(e) => handleToggleLipSync(e.target.checked)}
                disabled={isLoading}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Experimental Warning */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-yellow-800">
                Experimental Feature
              </h4>
              <p className="text-sm text-yellow-700 mt-1">
                This feature is experimental and may not work reliably. It requires a connected HeyGen avatar 
                and will gracefully fallback to idle animation if unavailable.
              </p>
            </div>
          </div>
        </div>

        {/* Status Information */}
        {status.enabled && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-50 rounded-md p-3">
              <div className="text-sm font-medium text-gray-700">Current State</div>
              <div className="text-lg font-semibold text-gray-900 capitalize">
                {status.currentState}
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-md p-3">
              <div className="text-sm font-medium text-gray-700">Avatar Connection</div>
              <div className={`text-lg font-semibold ${status.avatarConnected ? 'text-green-600' : 'text-red-600'}`}>
                {status.avatarConnected ? 'Connected' : 'Disconnected'}
              </div>
            </div>
          </div>
        )}

        {/* Advanced Configuration */}
        {status.enabled && (
          <div className="border-t border-gray-200 pt-4">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              <svg 
                className={`w-4 h-4 mr-2 transform transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Advanced Settings
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-4 pl-6">
                {/* Fallback to Idle */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Fallback to Idle Animation
                    </label>
                    <p className="text-xs text-gray-500">
                      Show idle animation when lip-sync is unavailable
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.fallbackToIdle}
                      onChange={(e) => handleConfigUpdate({ fallbackToIdle: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Transition Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Transition Duration: {config.transitionDurationMs}ms
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    step="50"
                    value={config.transitionDurationMs}
                    onChange={(e) => handleConfigUpdate({ transitionDurationMs: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Instant</span>
                    <span>1 second</span>
                  </div>
                </div>

                {/* Debug Mode */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Debug Mode
                    </label>
                    <p className="text-xs text-gray-500">
                      Enable detailed console logging for troubleshooting
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.debugMode}
                      onChange={(e) => handleConfigUpdate({ debugMode: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Help Text */}
        <div className="mt-4 text-xs text-gray-500">
          <p>
            <strong>How it works:</strong> When enabled, the system attempts to sync avatar lip movements 
            with story audio using the story transcript or fallback text. If the avatar is not connected 
            or lip-sync fails, it gracefully falls back to idle animation or continues without visual sync.
          </p>
        </div>
      </div>
    </div>
  );
}