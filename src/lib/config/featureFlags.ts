/**
 * Feature flags configuration for factbook architecture rollout
 * Provides safe rollout capabilities with runtime kill switches
 */

export interface FactbookFeatureFlags {
  factbookEnabled: boolean;
  fallbackPipelineEnabled: boolean;
}

export interface RuntimeKillSwitch {
  factbookDisabled: boolean;
  forceFallback: boolean;
  timestamp: number;
  reason?: string;
}

class FeatureFlagManager {
  private static instance: FeatureFlagManager;
  private runtimeKillSwitch: RuntimeKillSwitch | null = null;

  static getInstance(): FeatureFlagManager {
    if (!FeatureFlagManager.instance) {
      FeatureFlagManager.instance = new FeatureFlagManager();
    }
    return FeatureFlagManager.instance;
  }

  /**
   * Get current feature flags with runtime overrides
   */
  getFeatureFlags(): FactbookFeatureFlags {
    // Base configuration from environment variables
    const baseFlags: FactbookFeatureFlags = {
      factbookEnabled: process.env.FACTBOOK_ENABLED !== 'false', // Default true in demo
      fallbackPipelineEnabled: process.env.FALLBACK_PIPELINE_ENABLED === 'true', // Default false
    };

    // Apply runtime kill switch overrides
    if (this.runtimeKillSwitch) {
      if (this.runtimeKillSwitch.factbookDisabled) {
        baseFlags.factbookEnabled = false;
      }
      if (this.runtimeKillSwitch.forceFallback) {
        baseFlags.fallbackPipelineEnabled = true;
      }
    }

    return baseFlags;
  }

  /**
   * Check if factbook system should be used
   */
  shouldUseFactbook(): boolean {
    const flags = this.getFeatureFlags();
    return flags.factbookEnabled && !flags.fallbackPipelineEnabled;
  }

  /**
   * Check if legacy memory system should be used
   */
  shouldUseLegacyMemory(): boolean {
    const flags = this.getFeatureFlags();
    return !flags.factbookEnabled || flags.fallbackPipelineEnabled;
  }

  /**
   * Set runtime kill switch to disable factbook
   */
  setKillSwitch(options: {
    disableFactbook?: boolean;
    forceFallback?: boolean;
    reason?: string;
  }): void {
    this.runtimeKillSwitch = {
      factbookDisabled: options.disableFactbook || false,
      forceFallback: options.forceFallback || false,
      timestamp: Date.now(),
      reason: options.reason,
    };

    console.log('feature_flag_kill_switch_activated', {
      factbook_disabled: this.runtimeKillSwitch.factbookDisabled,
      force_fallback: this.runtimeKillSwitch.forceFallback,
      reason: this.runtimeKillSwitch.reason,
      timestamp: this.runtimeKillSwitch.timestamp,
    });
  }

  /**
   * Clear runtime kill switch
   */
  clearKillSwitch(): void {
    if (this.runtimeKillSwitch) {
      console.log('feature_flag_kill_switch_cleared', {
        previous_state: this.runtimeKillSwitch,
        cleared_at: Date.now(),
      });
    }
    this.runtimeKillSwitch = null;
  }

  /**
   * Get current kill switch status
   */
  getKillSwitchStatus(): RuntimeKillSwitch | null {
    return this.runtimeKillSwitch;
  }

  /**
   * Log current feature flag state
   */
  logCurrentState(context: string): void {
    const flags = this.getFeatureFlags();
    console.log('feature_flags_state', {
      context,
      factbook_enabled: flags.factbookEnabled,
      fallback_pipeline_enabled: flags.fallbackPipelineEnabled,
      should_use_factbook: this.shouldUseFactbook(),
      should_use_legacy: this.shouldUseLegacyMemory(),
      kill_switch_active: !!this.runtimeKillSwitch,
      kill_switch_details: this.runtimeKillSwitch,
    });
  }
}

export const featureFlagManager = FeatureFlagManager.getInstance();

/**
 * Convenience functions for feature flag checks
 */
export const shouldUseFactbook = () => featureFlagManager.shouldUseFactbook();
export const shouldUseLegacyMemory = () => featureFlagManager.shouldUseLegacyMemory();
export const getFeatureFlags = () => featureFlagManager.getFeatureFlags();
export const logFeatureFlagState = (context: string) => featureFlagManager.logCurrentState(context);