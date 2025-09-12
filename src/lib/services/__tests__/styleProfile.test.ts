// src/lib/services/__tests__/styleProfile.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { StyleProfile } from '../styleProfile';

describe('StyleProfile', () => {
  let styleProfile: StyleProfile;

  beforeEach(() => {
    styleProfile = StyleProfile.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = StyleProfile.getInstance();
      const instance2 = StyleProfile.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('applyStyleToFacts', () => {
    it('should apply enthusiastic style for Austin topics', () => {
      const factualContent = "I lived in Austin from 2009 to 2018.";
      const result = styleProfile.applyStyleToFacts(factualContent, {
        topics: ['austin', 'places'],
        tone: 'enthusiastic'
      });

      // Should not modify the factual content
      expect(result).toBe(factualContent);
    });

    it('should apply warm style for pet topics', () => {
      const factualContent = "Olive was my Puerto Rican street dog.";
      const result = styleProfile.applyStyleToFacts(factualContent, {
        topics: ['pets', 'olive'],
        tone: 'warm'
      });

      expect(result).toBe(factualContent);
    });

    it('should apply assertive style for political topics', () => {
      const factualContent = "I think Trump is terrible for America.";
      const result = styleProfile.applyStyleToFacts(factualContent, {
        topics: ['politics', 'trump'],
        tone: 'assertive'
      });

      expect(result).toBe(factualContent);
    });

    it('should determine tone from topics when not provided', () => {
      const factualContent = "Austin was an incredible chapter.";
      const result = styleProfile.applyStyleToFacts(factualContent, {
        topics: ['austin', 'places']
      });

      expect(result).toBe(factualContent);
    });
  });

  describe('generateStyleInstructions', () => {
    it('should generate appropriate instructions for enthusiastic tone', () => {
      const instructions = styleProfile.generateStyleInstructions(
        'enthusiastic',
        ['austin', 'places'],
        false
      );

      expect(instructions).toContain('Tone: enthusiastic');
      expect(instructions).toContain('Jonathan\'s authentic voice');
      expect(instructions).toContain('Fast lane');
      expect(instructions).toContain('CRITICAL: Apply style ONLY to presentation');
    });

    it('should generate deep lane instructions', () => {
      const instructions = styleProfile.generateStyleInstructions(
        'warm',
        ['pets', 'olive'],
        true
      );

      expect(instructions).toContain('Deep lane: Build on facts');
      expect(instructions).toContain('warm tone');
    });

    it('should include voice tics in instructions', () => {
      const instructions = styleProfile.generateStyleInstructions(
        'conversational',
        ['general'],
        false
      );

      expect(instructions).toContain('Voice tics');
      expect(instructions).toContain('Oh absolutely!');
    });

    it('should enforce fact/style separation in instructions', () => {
      const instructions = styleProfile.generateStyleInstructions(
        'assertive',
        ['politics'],
        true
      );

      expect(instructions).toContain('Never let personality influence fact selection');
      expect(instructions).toContain('create non-factual content');
    });
  });

  describe('tone determination', () => {
    it('should prioritize political topics for assertive tone', () => {
      const instructions = styleProfile.generateStyleInstructions(
        'conversational', // This should be overridden
        ['trump', 'politics'],
        false
      );

      // The style application should reflect political context
      expect(instructions).toContain('assertive');
    });

    it('should use enthusiastic tone for Austin topics', () => {
      const styleMarkers = styleProfile.getStyleMarkers();
      expect(styleMarkers.emotionalTones.austin).toBe('enthusiastic');
    });

    it('should use warm tone for pet topics', () => {
      const styleMarkers = styleProfile.getStyleMarkers();
      expect(styleMarkers.emotionalTones.olive).toBe('warm');
    });
  });

  describe('validateFactStyleSeparation', () => {
    it('should detect personality-driven uncertainty phrases', () => {
      const content = "I think I remember living in Austin.";
      const result = styleProfile.validateFactStyleSeparation(content, ['austin.years']);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Personality-driven uncertainty: "I think I remember"');
    });

    it('should detect emotional embellishment', () => {
      const content = "Here's an amazing fact about Austin.";
      const result = styleProfile.validateFactStyleSeparation(content, ['austin.years']);

      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should pass validation for clean factual content', () => {
      const content = "I lived in Austin from 2009 to 2018.";
      const result = styleProfile.validateFactStyleSeparation(content, ['austin.years']);

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect multiple violations', () => {
      const content = "I think I remember this amazing fact about Austin.";
      const result = styleProfile.validateFactStyleSeparation(content, ['austin.years']);

      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(1);
    });
  });

  describe('style markers', () => {
    it('should provide access to style markers', () => {
      const markers = styleProfile.getStyleMarkers();

      expect(markers.voiceTics).toContain('Oh absolutely!');
      expect(markers.personalityTraits).toContain('enthusiastic about experiences');
      expect(markers.conversationalStyle).toContain('uses specific details and examples');
      expect(markers.emotionalTones.austin).toBe('enthusiastic');
      expect(markers.responsePatterns.enthusiastic).toBeDefined();
    });

    it('should allow updating style markers', () => {
      const originalMarkers = styleProfile.getStyleMarkers();
      const newVoiceTics = ['Test phrase'];

      styleProfile.updateStyleMarkers({
        voiceTics: newVoiceTics
      });

      const updatedMarkers = styleProfile.getStyleMarkers();
      expect(updatedMarkers.voiceTics).toEqual(newVoiceTics);
      expect(updatedMarkers.personalityTraits).toEqual(originalMarkers.personalityTraits);

      // Reset for other tests
      styleProfile.updateStyleMarkers({
        voiceTics: originalMarkers.voiceTics
      });
    });
  });

  describe('response patterns', () => {
    it('should have patterns for all emotional tones', () => {
      const markers = styleProfile.getStyleMarkers();
      const tones = Object.keys(markers.emotionalTones);

      for (const tone of tones) {
        if (tone !== 'general') { // general maps to conversational
          const toneName = markers.emotionalTones[tone];
          expect(markers.responsePatterns[toneName]).toBeDefined();
        }
      }
    });

    it('should provide fallback conversational patterns', () => {
      const markers = styleProfile.getStyleMarkers();
      expect(markers.responsePatterns.conversational).toBeDefined();
      expect(markers.responsePatterns.conversational.length).toBeGreaterThan(0);
    });
  });

  describe('facts first pattern enforcement', () => {
    it('should never modify factual content in applyStyleToFacts', () => {
      const originalFact = "I lived in Austin from 2009 to 2018.";
      
      // Test with different tones and contexts
      const contexts = [
        { topics: ['austin'], tone: 'enthusiastic' },
        { topics: ['pets'], tone: 'warm' },
        { topics: ['politics'], tone: 'assertive' },
        { topics: ['general'], tone: 'conversational' }
      ];

      for (const context of contexts) {
        const result = styleProfile.applyStyleToFacts(originalFact, context);
        expect(result).toBe(originalFact);
      }
    });

    it('should generate instructions that enforce separation', () => {
      const instructions = styleProfile.generateStyleInstructions(
        'enthusiastic',
        ['austin'],
        false
      );

      expect(instructions).toContain('apply AFTER selecting facts');
      expect(instructions).toContain('Never let personality influence fact selection');
      expect(instructions).toContain('create non-factual content');
    });
  });
});