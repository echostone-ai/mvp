/**
 * useExpressionPack Hook
 * 
 * Client runtime hook for loading and managing expression audio buffers.
 * Handles feature flag gating, automatic preloading, and memory management.
 * 
 * Requirements: 5.1, 6.4, 8.1
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ExpressionPack, ExpressionClip } from '../types/expressions';
import { useFeatureFlag } from '../featureFlags';
import { UserSettingsService } from '../services/userSettingsService';
import { 
  expressionErrorHandler, 
  ExpressionErrorType, 
  ExpressionErrorStage,
  PlaybackContext,
  withExpressionErrorHandling 
} from '../expressionErrorHandler';
import { expressionMetrics, expressionMetricsRecorder } from '../expressionMetrics';
import { expressionNetworkManager } from '../expressionNetworkManager';
import { withPerformanceMonitoring } from '../expressionPerformanceMonitor';

interface UseExpressionPackOptions {
  /** Owner ID (user ID or avatar ID) */
  ownerId: string;
  /** Owner type - 'user' or 'avatar' */
  ownerType?: 'user' | 'avatar';
  /** Auto-preload on first user interaction */
  autoPreload?: boolean;
  /** Maximum number of concurrent preloads */
  maxConcurrentLoads?: number;
  /** User ID for privacy settings (required for user expressions) */
  userId?: string;
  /** Whether to respect user privacy settings */
  respectPrivacySettings?: boolean;
}

interface UseExpressionPackReturn {
  /** The loaded expression pack */
  pack: ExpressionPack | null;
  /** Whether the pack is currently loading */
  isLoading: boolean;
  /** Any error that occurred during loading */
  error: string | null;
  /** Whether buffers are preloaded and ready */
  isReady: boolean;
  /** Manually trigger preloading */
  preload: () => Promise<void>;
  /** Clear all loaded buffers to free memory */
  cleanup: () => void;
  /** Get a specific expression buffer by ID */
  getBuffer: (expressionId: string) => AudioBuffer | null;
}

/**
 * Hook for loading and managing expression packs with audio buffers
 */
export function useExpressionPack(options: UseExpressionPackOptions): UseExpressionPackReturn {
  const { 
    ownerId, 
    ownerType = 'user', 
    autoPreload = true, 
    maxConcurrentLoads = 3,
    userId,
    respectPrivacySettings = true
  } = options;
  
  // Feature flag check - return disabled state if feature is off
  const isFeatureEnabled = useFeatureFlag('VOICE_OVERLAYS');
  
  const [pack, setPack] = useState<ExpressionPack | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  // Track user interaction for auto-preloading
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const preloadTriggeredRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Initialize AudioContext lazily
   */
  const getAudioContext = useCallback((): AudioContext | null => {
    if (!isFeatureEnabled) return null;
    
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (err) {
        console.warn('Failed to create AudioContext:', err);
        return null;
      }
    }
    return audioContextRef.current;
  }, [isFeatureEnabled]);

  /**
   * Load expression metadata from API
   */
  const loadExpressionMetadata = useCallback(async (): Promise<ExpressionClip[]> => {
    if (!isFeatureEnabled) return [];
    
    try {
      // For demo avatars, load admin expressions only
      // For regular users, load user expressions only
      const isAvatarDemo = ownerType === 'avatar' || ownerId.includes('demo');
      
      let expressions: ExpressionClip[] = [];
      
      if (isAvatarDemo) {
        // Load admin expressions for avatar
        const params = new URLSearchParams({
          owner_type: 'avatar',
          owner_key: ownerId,
          status: 'active',
          limit: '50'
        });

        const response = await fetch(`/api/expressions?${params}`, {
          signal: abortControllerRef.current?.signal
        });

        if (response.ok) {
          const data = await response.json();
          expressions = data.expressions || [];
        }
      } else {
        // Load user expressions for regular users
        const params = new URLSearchParams({
          owner_type: 'user',
          owner_key: ownerId,
          status: 'active',
          limit: '50'
        });

        const response = await fetch(`/api/expressions?${params}`, {
          signal: abortControllerRef.current?.signal
        });

        if (response.ok) {
          const data = await response.json();
          expressions = data.expressions || [];
        }
      }

      // Sort by priority (higher priority first) for better selection
      expressions.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      
      return expressions;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return [];
      }
      throw err;
    }
  }, [ownerId, ownerType, isFeatureEnabled]);

  /**
   * Preload audio buffer for a single expression
   */
  const preloadBuffer = useCallback(async (clip: ExpressionClip): Promise<AudioBuffer | null> => {
    const audioContext = getAudioContext();
    if (!audioContext || !isFeatureEnabled) return null;

    // Create playback context for error handling
    const context: PlaybackContext = {
      sessionId: `session_${Date.now()}`,
      ownerId,
      ownerType,
      skipExpressions: false,
      disabledExpressions: new Set(),
      temporaryDisableUntil: 0,
      isExpressionsEnabled: true,
      removeExpression: () => {},
      disableExpressions: () => {},
      temporaryDisable: () => {}
    };

    return withExpressionErrorHandling(
      async () => {
        // Use network manager for resilient loading
        const networkResult = await expressionNetworkManager.loadExpressionAudio(
          clip.cdn_url,
          context
        );

        if (!networkResult.success || !networkResult.data) {
          throw new Error(networkResult.error?.message || 'Network request failed');
        }

        // Record cache hit metrics
        if (networkResult.cacheHit) {
          expressionMetrics.cacheHitRate.inc({
            cache_type: 'browser',
            owner_type: ownerType
          });
        }

        // Decode audio data with error handling
        try {
          const buffer = await audioContext.decodeAudioData(networkResult.data);
          
          // Record buffer memory usage
          const bufferSize = buffer.length * buffer.numberOfChannels * 4; // 4 bytes per float32 sample
          expressionMetricsRecorder.recordBufferMemoryUsage(
            ownerType,
            1,
            bufferSize
          );

          return buffer;
        } catch (decodeError) {
          await expressionErrorHandler.handleDecodeError(
            clip.id,
            decodeError instanceof Error ? decodeError : new Error('Decode failed'),
            context
          );
          return null;
        }
      },
      context,
      ExpressionErrorType.NETWORK_ERROR,
      ExpressionErrorStage.PRELOADING,
      clip.id
    );
  }, [getAudioContext, isFeatureEnabled, ownerId, ownerType]);

  /**
   * Preload all audio buffers with concurrency control
   */
  const preloadAllBuffers = useCallback(async (clips: ExpressionClip[]): Promise<Map<string, AudioBuffer>> => {
    if (!isFeatureEnabled || clips.length === 0) {
      return new Map();
    }

    return withPerformanceMonitoring(
      async () => {
        const buffers = new Map<string, AudioBuffer>();
        let totalBufferSize = 0;
        let cacheHits = 0;
        
        const loadClip = async (clip: ExpressionClip): Promise<void> => {
          const buffer = await preloadBuffer(clip);
          if (buffer) {
            buffers.set(clip.id, buffer);
            totalBufferSize += buffer.length * buffer.numberOfChannels * 4;
          }
        };

        // Process clips in batches to control concurrency
        for (let i = 0; i < clips.length; i += maxConcurrentLoads) {
          const batch = clips.slice(i, i + maxConcurrentLoads);
          await Promise.allSettled(batch.map(loadClip));
        }

        // Record final buffer memory usage
        expressionMetricsRecorder.recordBufferMemoryUsage(
          ownerType,
          buffers.size,
          totalBufferSize
        );

        // Determine cache status
        const cacheStatus = cacheHits === clips.length ? 'hit' : 
                           cacheHits === 0 ? 'miss' : 'partial';

        return buffers;
      },
      'preload',
      {
        ownerType,
        expressionCount: clips.length,
        cacheStatus: 'unknown' // Will be updated in the monitoring
      }
    );
  }, [preloadBuffer, maxConcurrentLoads, isFeatureEnabled, ownerType]);

  /**
   * Main preload function
   */
  const preload = useCallback(async (): Promise<void> => {
    if (!isFeatureEnabled || isLoading || preloadTriggeredRef.current) {
      return;
    }

    // Check user privacy settings if applicable
    if (respectPrivacySettings && (ownerType === 'user' || userId)) {
      const userIdToCheck = userId || (ownerType === 'user' ? ownerId : undefined);
      
      if (userIdToCheck) {
        try {
          const expressionsAllowed = await UserSettingsService.shouldEnableExpressions(userIdToCheck);
          
          if (!expressionsAllowed) {
            // User has disabled expressions - set empty pack
            setPack({
              clips: [],
              preloaded_buffers: new Map(),
              is_loaded: true
            });
            setIsReady(true);
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.warn('[useExpressionPack] Failed to check privacy settings, proceeding with expressions:', error);
          // Continue with expressions on privacy check failure
        }
      }
    }

    preloadTriggeredRef.current = true;
    setIsLoading(true);
    setError(null);

    // Cancel any existing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      // Load expression metadata
      const clips = await loadExpressionMetadata();
      
      if (clips.length === 0) {
        setPack({
          clips: [],
          preloaded_buffers: new Map(),
          is_loaded: true
        });
        setIsReady(true);
        return;
      }

      // Preload audio buffers
      const buffers = await preloadAllBuffers(clips);

      // Create the pack
      const newPack: ExpressionPack = {
        clips,
        preloaded_buffers: buffers,
        is_loaded: true
      };

      setPack(newPack);
      setIsReady(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Expression pack preload failed:', err);
      
      // Set empty pack on error for graceful degradation
      setPack({
        clips: [],
        preloaded_buffers: new Map(),
        is_loaded: false
      });
    } finally {
      setIsLoading(false);
    }
  }, [isFeatureEnabled, isLoading, loadExpressionMetadata, preloadAllBuffers, respectPrivacySettings, ownerType, userId, ownerId]);

  /**
   * Cleanup function to free memory
   */
  const cleanup = useCallback((): void => {
    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear buffers
    setPack(null);
    setIsReady(false);
    setError(null);
    preloadTriggeredRef.current = false;

    // Close AudioContext if we created it
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.warn);
      audioContextRef.current = null;
    }
  }, []);

  /**
   * Get buffer for specific expression
   */
  const getBuffer = useCallback((expressionId: string): AudioBuffer | null => {
    if (!pack || !isFeatureEnabled) return null;
    return pack.preloaded_buffers.get(expressionId) || null;
  }, [pack, isFeatureEnabled]);

  /**
   * Set up user interaction listener for auto-preload
   */
  useEffect(() => {
    if (!isFeatureEnabled || !autoPreload || hasUserInteracted) {
      return;
    }

    const handleUserInteraction = () => {
      setHasUserInteracted(true);
      preload();
    };

    // Listen for first user interaction
    const events = ['click', 'touchstart', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, handleUserInteraction, { once: true, passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserInteraction);
      });
    };
  }, [isFeatureEnabled, autoPreload, hasUserInteracted, preload]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  /**
   * Return disabled state when feature flag is off
   */
  if (!isFeatureEnabled) {
    return {
      pack: null,
      isLoading: false,
      error: null,
      isReady: false,
      preload: async () => {},
      cleanup: () => {},
      getBuffer: () => null
    };
  }

  return {
    pack,
    isLoading,
    error,
    isReady,
    preload,
    cleanup,
    getBuffer
  };
}

/**
 * Utility hook for checking if expressions are available for an owner
 */
export function useHasExpressions(ownerId: string, ownerType: 'user' | 'avatar' = 'user'): boolean {
  const { pack, isReady } = useExpressionPack({ ownerId, ownerType, autoPreload: false });
  return isReady && pack !== null && pack.clips.length > 0;
}