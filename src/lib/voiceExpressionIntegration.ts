/**
 * Voice Expression Integration Utilities
 * 
 * Helper functions to integrate expression overlays with the existing voice pipeline.
 * Provides easy-to-use functions for components to add expression support.
 * 
 * Requirements: 9.1, 9.2, 5.2
 */

import { StreamingAudioManager } from './streamingUtils';
import { StoredExpression, ExpressionStorageService } from './services/expressionStorageService';
import { isFeatureEnabled } from './featureFlags';
import { UserSettingsService } from './services/userSettingsService';

export interface ExpressionIntegrationOptions {
  /** Owner ID (user ID or avatar ID) */
  ownerId: string;
  /** Owner type - 'user' or 'avatar' */
  ownerType?: 'user' | 'avatar';
  /** Whether to enable expressions by default */
  enableByDefault?: boolean;
  /** Maximum number of expressions to preload */
  maxExpressions?: number;
  /** User ID for privacy settings (required for user expressions) */
  userId?: string;
  /** Whether to respect user privacy settings */
  respectPrivacySettings?: boolean;
}

export interface ExpressionIntegrationResult {
  /** Whether expressions were successfully integrated */
  success: boolean;
  /** Number of expressions loaded */
  expressionCount: number;
  /** Any error that occurred */
  error?: string;
}

/**
 * Integrate expressions with a StreamingAudioManager
 * This is the main function components should use to add expression support
 */
export async function integrateExpressionsWithVoice(
  audioManager: StreamingAudioManager,
  options: ExpressionIntegrationOptions
): Promise<ExpressionIntegrationResult> {
  // Early return if feature is disabled
  if (!isFeatureEnabled('VOICE_OVERLAYS')) {
    return {
      success: false,
      expressionCount: 0,
      error: 'Voice overlays feature is disabled'
    };
  }

  const { 
    ownerId, 
    ownerType = 'user', 
    enableByDefault = true, 
    maxExpressions = 50,
    userId,
    respectPrivacySettings = true
  } = options;

  // Check user privacy settings if this is for user expressions or if userId is provided
  if (respectPrivacySettings && (ownerType === 'user' || userId)) {
    const userIdToCheck = userId || (ownerType === 'user' ? ownerId : undefined);
    
    if (userIdToCheck) {
      try {
        const expressionsAllowed = await UserSettingsService.shouldEnableExpressions(userIdToCheck);
        
        if (!expressionsAllowed) {
          // User has disabled expressions - graceful degradation
          audioManager.enableExpressions(false);
          return {
            success: true,
            expressionCount: 0,
            error: 'Expressions disabled by user privacy settings'
          };
        }
      } catch (error) {
        console.warn('[VoiceExpressionIntegration] Failed to check privacy settings, proceeding with expressions:', error);
        // Continue with expressions on privacy check failure for graceful degradation
      }
    }
  }

  try {
    // Load expressions from storage
    const expressions = await ExpressionStorageService.listExpressions({
      ownerType,
      ownerKey: ownerId,
      status: 'active',
      limit: maxExpressions
    });

    if (expressions.length === 0) {
      // No expressions available - this is not an error, just no overlays
      audioManager.enableExpressions(false);
      return {
        success: true,
        expressionCount: 0
      };
    }

    // Preload audio buffers for expressions
    const buffers = await preloadExpressionBuffers(expressions);

    // Set up the audio manager with expressions
    audioManager.setExpressionPack(expressions, buffers);
    audioManager.enableExpressions(enableByDefault);

    console.log(`[VoiceExpressionIntegration] Successfully integrated ${expressions.length} expressions for ${ownerType} ${ownerId}`);

    return {
      success: true,
      expressionCount: expressions.length
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.warn('[VoiceExpressionIntegration] Failed to integrate expressions:', error);

    // Graceful degradation - disable expressions but don't break voice
    audioManager.enableExpressions(false);

    return {
      success: false,
      expressionCount: 0,
      error: errorMessage
    };
  }
}

/**
 * Preload audio buffers for expressions with concurrency control
 */
async function preloadExpressionBuffers(
  expressions: StoredExpression[],
  maxConcurrent: number = 3
): Promise<Map<string, AudioBuffer>> {
  const buffers = new Map<string, AudioBuffer>();
  
  if (typeof window === 'undefined' || !window.AudioContext) {
    console.warn('[VoiceExpressionIntegration] AudioContext not available, skipping preload');
    return buffers;
  }

  let audioContext: AudioContext;
  try {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Resume context if suspended
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
  } catch (error) {
    console.warn('[VoiceExpressionIntegration] Failed to create AudioContext:', error);
    return buffers;
  }

  const loadBuffer = async (expression: StoredExpression): Promise<void> => {
    try {
      const response = await fetch(expression.cdnUrl, {
        cache: 'force-cache', // Prefer cached version
        priority: 'low' // Don't compete with TTS requests
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      buffers.set(expression.id, audioBuffer);
      console.log(`[VoiceExpressionIntegration] Preloaded buffer for expression ${expression.id}`);
    } catch (error) {
      console.warn(`[VoiceExpressionIntegration] Failed to preload expression ${expression.id}:`, error);
      // Continue with other expressions - graceful degradation
    }
  };

  // Process expressions in batches to control concurrency
  for (let i = 0; i < expressions.length; i += maxConcurrent) {
    const batch = expressions.slice(i, i + maxConcurrent);
    await Promise.allSettled(batch.map(loadBuffer));
  }

  return buffers;
}

/**
 * Quick setup function for user expressions
 * Convenience function for the most common use case
 */
export async function setupUserExpressions(
  audioManager: StreamingAudioManager,
  userId: string
): Promise<ExpressionIntegrationResult> {
  return integrateExpressionsWithVoice(audioManager, {
    ownerId: userId,
    ownerType: 'user',
    enableByDefault: true,
    userId: userId,
    respectPrivacySettings: true
  });
}

/**
 * Quick setup function for avatar expressions
 * Convenience function for demo avatars and shared avatars
 */
export async function setupAvatarExpressions(
  audioManager: StreamingAudioManager,
  avatarId: string
): Promise<ExpressionIntegrationResult> {
  return integrateExpressionsWithVoice(audioManager, {
    ownerId: avatarId,
    ownerType: 'avatar',
    enableByDefault: true
  });
}

/**
 * Disable expressions for an audio manager
 * Useful for user privacy settings or error recovery
 */
export function disableExpressions(audioManager: StreamingAudioManager): void {
  audioManager.enableExpressions(false);
  console.log('[VoiceExpressionIntegration] Expressions disabled');
}

/**
 * Enable expressions for an audio manager
 * Useful for re-enabling after user changes settings
 */
export function enableExpressions(audioManager: StreamingAudioManager): void {
  if (!isFeatureEnabled('VOICE_OVERLAYS')) {
    console.warn('[VoiceExpressionIntegration] Cannot enable expressions - feature flag is disabled');
    return;
  }
  
  audioManager.enableExpressions(true);
  console.log('[VoiceExpressionIntegration] Expressions enabled');
}

/**
 * Check if expressions are available for a given owner
 * Useful for UI components to show/hide expression-related features
 */
export async function checkExpressionsAvailable(
  ownerId: string,
  ownerType: 'user' | 'avatar' = 'user'
): Promise<boolean> {
  if (!isFeatureEnabled('VOICE_OVERLAYS')) {
    return false;
  }

  try {
    const count = await ExpressionStorageService.countExpressions({
      ownerType,
      ownerKey: ownerId,
      status: 'active'
    });
    
    return count > 0;
  } catch (error) {
    console.warn('[VoiceExpressionIntegration] Failed to check expressions availability:', error);
    return false;
  }
}

/**
 * Check if expressions should be enabled for a user considering privacy settings
 * Useful for UI components to show appropriate controls
 */
export async function checkExpressionsEnabledForUser(userId: string): Promise<boolean> {
  if (!isFeatureEnabled('VOICE_OVERLAYS')) {
    return false;
  }

  try {
    return await UserSettingsService.shouldEnableExpressions(userId);
  } catch (error) {
    console.warn('[VoiceExpressionIntegration] Failed to check user expression settings:', error);
    return true; // Default to enabled on error
  }
}

/**
 * Disable expressions for a user's current session
 * Useful for mid-conversation privacy controls
 */
export async function disableExpressionsForUserSession(
  audioManager: StreamingAudioManager,
  userId: string
): Promise<boolean> {
  try {
    // Disable in audio manager immediately
    audioManager.enableExpressions(false);
    
    // Update user settings
    const success = await UserSettingsService.disableExpressionsForSession(userId);
    
    if (success) {
      console.log('[VoiceExpressionIntegration] Expressions disabled for user session');
    }
    
    return success;
  } catch (error) {
    console.error('[VoiceExpressionIntegration] Failed to disable expressions for session:', error);
    return false;
  }
}

/**
 * Re-enable expressions for a user's current session
 * Useful for mid-conversation privacy controls
 */
export async function enableExpressionsForUserSession(
  audioManager: StreamingAudioManager,
  userId: string
): Promise<boolean> {
  if (!isFeatureEnabled('VOICE_OVERLAYS')) {
    console.warn('[VoiceExpressionIntegration] Cannot enable expressions - feature flag is disabled');
    return false;
  }

  try {
    // Update user settings first
    const success = await UserSettingsService.enableExpressionsForSession(userId);
    
    if (success) {
      // Re-enable in audio manager
      audioManager.enableExpressions(true);
      console.log('[VoiceExpressionIntegration] Expressions re-enabled for user session');
    }
    
    return success;
  } catch (error) {
    console.error('[VoiceExpressionIntegration] Failed to enable expressions for session:', error);
    return false;
  }
}

/**
 * Gracefully handle expression disable during active conversation
 * Ensures smooth transition without breaking TTS flow
 */
export function gracefullyDisableExpressions(audioManager: StreamingAudioManager): void {
  try {
    // Disable expressions without interrupting current audio
    audioManager.enableExpressions(false);
    
    console.log('[VoiceExpressionIntegration] Expressions gracefully disabled mid-conversation');
  } catch (error) {
    console.warn('[VoiceExpressionIntegration] Error during graceful expression disable:', error);
    // Continue anyway - this should not break the conversation
  }
}