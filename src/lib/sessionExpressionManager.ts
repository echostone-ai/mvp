/**
 * Session Expression Manager
 * 
 * Manages expression state during active conversations and handles
 * graceful transitions when privacy settings change mid-conversation.
 * 
 * Requirements: 6.1, 6.5
 */

import { StreamingAudioManager } from './streamingUtils';
import { UserSettingsService } from './services/userSettingsService';
import { 
  disableExpressions, 
  enableExpressions, 
  gracefullyDisableExpressions 
} from './voiceExpressionIntegration';

export interface SessionExpressionState {
  /** Whether expressions are currently active in the session */
  active: boolean;
  /** User ID for this session */
  userId?: string;
  /** Audio manager instance */
  audioManager?: StreamingAudioManager;
  /** Last known privacy settings */
  lastSettings?: {
    expressionsEnabled: boolean;
    sessionDisabled: boolean;
  };
}

/**
 * Manages expression state for a conversation session
 */
export class SessionExpressionManager {
  private state: SessionExpressionState = { active: false };
  private checkInterval?: NodeJS.Timeout;
  private readonly CHECK_INTERVAL_MS = 5000; // Check every 5 seconds
  private isTestEnvironment = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

  /**
   * Initialize session with user and audio manager
   */
  initialize(userId: string, audioManager: StreamingAudioManager): void {
    this.state = {
      active: false,
      userId,
      audioManager
    };

    // Start periodic privacy settings check (skip in test environment)
    if (!this.isTestEnvironment) {
      this.startPrivacyCheck();
    }
  }

  /**
   * Start the session with expressions enabled based on user settings
   */
  async start(): Promise<boolean> {
    if (!this.state.userId || !this.state.audioManager) {
      console.warn('[SessionExpressionManager] Cannot start - missing userId or audioManager');
      return false;
    }

    try {
      const settings = await UserSettingsService.getExpressionSettings(this.state.userId);
      const shouldEnable = settings.expressionsEnabled && !settings.sessionDisabled;

      this.state.lastSettings = {
        expressionsEnabled: settings.expressionsEnabled,
        sessionDisabled: settings.sessionDisabled
      };

      if (shouldEnable) {
        enableExpressions(this.state.audioManager);
        this.state.active = true;
        console.log('[SessionExpressionManager] Session started with expressions enabled');
      } else {
        disableExpressions(this.state.audioManager);
        this.state.active = false;
        console.log('[SessionExpressionManager] Session started with expressions disabled');
      }

      return this.state.active;
    } catch (error) {
      console.error('[SessionExpressionManager] Failed to start session:', error);
      // Default to disabled on error
      if (this.state.audioManager) {
        disableExpressions(this.state.audioManager);
      }
      this.state.active = false;
      return false;
    }
  }

  /**
   * Stop the session and cleanup
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }

    if (this.state.audioManager) {
      gracefullyDisableExpressions(this.state.audioManager);
    }

    this.state = { active: false };
    console.log('[SessionExpressionManager] Session stopped');
  }

  /**
   * Manually disable expressions for this session
   */
  async disableForSession(): Promise<boolean> {
    if (!this.state.userId || !this.state.audioManager) {
      return false;
    }

    try {
      const success = await UserSettingsService.disableExpressionsForSession(this.state.userId);
      
      if (success) {
        gracefullyDisableExpressions(this.state.audioManager);
        this.state.active = false;
        
        // Update cached settings
        if (this.state.lastSettings) {
          this.state.lastSettings.sessionDisabled = true;
        }
        
        console.log('[SessionExpressionManager] Expressions disabled for session');
      }
      
      return success;
    } catch (error) {
      console.error('[SessionExpressionManager] Failed to disable expressions for session:', error);
      return false;
    }
  }

  /**
   * Manually enable expressions for this session
   */
  async enableForSession(): Promise<boolean> {
    if (!this.state.userId || !this.state.audioManager) {
      return false;
    }

    try {
      const success = await UserSettingsService.enableExpressionsForSession(this.state.userId);
      
      if (success) {
        enableExpressions(this.state.audioManager);
        this.state.active = true;
        
        // Update cached settings
        if (this.state.lastSettings) {
          this.state.lastSettings.sessionDisabled = false;
        }
        
        console.log('[SessionExpressionManager] Expressions enabled for session');
      }
      
      return success;
    } catch (error) {
      console.error('[SessionExpressionManager] Failed to enable expressions for session:', error);
      return false;
    }
  }

  /**
   * Get current session state
   */
  getState(): Readonly<SessionExpressionState> {
    return { ...this.state };
  }

  /**
   * Manually trigger privacy settings check (for testing)
   */
  async triggerPrivacyCheck(): Promise<void> {
    await this.checkPrivacySettings();
  }

  /**
   * Check if expressions are currently active
   */
  isActive(): boolean {
    return this.state.active;
  }

  /**
   * Start periodic privacy settings check
   */
  private startPrivacyCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.checkPrivacySettings();
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Check for privacy settings changes and update session accordingly
   */
  private async checkPrivacySettings(): Promise<void> {
    if (!this.state.userId || !this.state.audioManager || !this.state.lastSettings) {
      return;
    }

    try {
      const currentSettings = await UserSettingsService.getExpressionSettings(this.state.userId);
      const lastSettings = this.state.lastSettings;

      // Check if settings have changed
      const settingsChanged = 
        currentSettings.expressionsEnabled !== lastSettings.expressionsEnabled ||
        currentSettings.sessionDisabled !== lastSettings.sessionDisabled;

      if (!settingsChanged) {
        return;
      }

      // Update cached settings
      this.state.lastSettings = {
        expressionsEnabled: currentSettings.expressionsEnabled,
        sessionDisabled: currentSettings.sessionDisabled
      };

      // Determine new state
      const shouldBeActive = currentSettings.expressionsEnabled && !currentSettings.sessionDisabled;

      if (shouldBeActive && !this.state.active) {
        // Enable expressions
        enableExpressions(this.state.audioManager);
        this.state.active = true;
        console.log('[SessionExpressionManager] Expressions enabled due to settings change');
      } else if (!shouldBeActive && this.state.active) {
        // Disable expressions gracefully
        gracefullyDisableExpressions(this.state.audioManager);
        this.state.active = false;
        console.log('[SessionExpressionManager] Expressions disabled due to settings change');
      }
    } catch (error) {
      console.warn('[SessionExpressionManager] Failed to check privacy settings:', error);
      // Don't change state on error to avoid disruption
    }
  }
}

/**
 * Global session manager instance
 * Components can use this to manage expressions during conversations
 */
export const globalSessionExpressionManager = new SessionExpressionManager();