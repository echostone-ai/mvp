/**
 * Tests for feature flags and kill switch functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { featureFlagManager, shouldUseFactbook, shouldUseLegacyMemory } from '../featureFlags';

describe('FeatureFlagManager', () => {
  beforeEach(() => {
    // Clear any existing kill switch state
    featureFlagManager.clearKillSwitch();
    
    // Reset environment variables
    delete process.env.FACTBOOK_ENABLED;
    delete process.env.FALLBACK_PIPELINE_ENABLED;
  });

  describe('Default behavior', () => {
    it('should default to factbook enabled when no env vars set', () => {
      const flags = featureFlagManager.getFeatureFlags();
      expect(flags.factbookEnabled).toBe(true);
      expect(flags.fallbackPipelineEnabled).toBe(false);
      expect(shouldUseFactbook()).toBe(true);
      expect(shouldUseLegacyMemory()).toBe(false);
    });

    it('should respect FACTBOOK_ENABLED=false', () => {
      process.env.FACTBOOK_ENABLED = 'false';
      const flags = featureFlagManager.getFeatureFlags();
      expect(flags.factbookEnabled).toBe(false);
      expect(shouldUseFactbook()).toBe(false);
      expect(shouldUseLegacyMemory()).toBe(true);
    });

    it('should respect FALLBACK_PIPELINE_ENABLED=true', () => {
      process.env.FALLBACK_PIPELINE_ENABLED = 'true';
      const flags = featureFlagManager.getFeatureFlags();
      expect(flags.fallbackPipelineEnabled).toBe(true);
      expect(shouldUseFactbook()).toBe(false);
      expect(shouldUseLegacyMemory()).toBe(true);
    });
  });

  describe('Kill switch functionality', () => {
    it('should disable factbook when kill switch activated', () => {
      // Start with factbook enabled
      expect(shouldUseFactbook()).toBe(true);
      
      // Activate kill switch
      featureFlagManager.setKillSwitch({
        disableFactbook: true,
        reason: 'Test disable'
      });
      
      expect(shouldUseFactbook()).toBe(false);
      expect(shouldUseLegacyMemory()).toBe(true);
      
      const killSwitchStatus = featureFlagManager.getKillSwitchStatus();
      expect(killSwitchStatus?.factbookDisabled).toBe(true);
      expect(killSwitchStatus?.reason).toBe('Test disable');
    });

    it('should force fallback when kill switch activated', () => {
      // Start with factbook enabled
      expect(shouldUseFactbook()).toBe(true);
      
      // Activate fallback kill switch
      featureFlagManager.setKillSwitch({
        forceFallback: true,
        reason: 'Test fallback'
      });
      
      expect(shouldUseFactbook()).toBe(false);
      expect(shouldUseLegacyMemory()).toBe(true);
      
      const flags = featureFlagManager.getFeatureFlags();
      expect(flags.fallbackPipelineEnabled).toBe(true);
    });

    it('should clear kill switch properly', () => {
      // Activate kill switch
      featureFlagManager.setKillSwitch({
        disableFactbook: true,
        reason: 'Test'
      });
      expect(shouldUseFactbook()).toBe(false);
      
      // Clear kill switch
      featureFlagManager.clearKillSwitch();
      expect(shouldUseFactbook()).toBe(true);
      expect(featureFlagManager.getKillSwitchStatus()).toBeNull();
    });

    it('should handle emergency disable correctly', () => {
      featureFlagManager.setKillSwitch({
        disableFactbook: true,
        forceFallback: true,
        reason: 'Emergency'
      });
      
      expect(shouldUseFactbook()).toBe(false);
      expect(shouldUseLegacyMemory()).toBe(true);
      
      const flags = featureFlagManager.getFeatureFlags();
      expect(flags.factbookEnabled).toBe(false);
      expect(flags.fallbackPipelineEnabled).toBe(true);
    });
  });

  describe('Environment variable precedence', () => {
    it('should override env vars with kill switch', () => {
      // Set env to enable factbook
      process.env.FACTBOOK_ENABLED = 'true';
      process.env.FALLBACK_PIPELINE_ENABLED = 'false';
      
      expect(shouldUseFactbook()).toBe(true);
      
      // Kill switch should override
      featureFlagManager.setKillSwitch({
        disableFactbook: true
      });
      
      expect(shouldUseFactbook()).toBe(false);
    });

    it('should not override kill switch with env vars', () => {
      // Activate kill switch first
      featureFlagManager.setKillSwitch({
        forceFallback: true
      });
      
      // Change env vars (simulating runtime change)
      process.env.FACTBOOK_ENABLED = 'true';
      process.env.FALLBACK_PIPELINE_ENABLED = 'false';
      
      // Kill switch should still be active
      expect(shouldUseLegacyMemory()).toBe(true);
    });
  });
});