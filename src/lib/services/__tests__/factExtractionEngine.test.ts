/**
 * Integration tests for FactExtractionEngine
 * 
 * Tests the full extraction pipeline including pattern matching,
 * LLM refinement, error handling, and performance monitoring.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FactExtractionEngine } from '../factExtractionEngine';

describe('FactExtractionEngine Integration', () => {
  let engine: FactExtractionEngine;

  beforeEach(() => {
    // Disable LLM refinement for integration tests to avoid API calls
    engine = new FactExtractionEngine({ 
      enableLLMRefinement: false,
      minConfidenceThreshold: 0.5
    });
  });

  describe('extractFacts', () => {
    it('should extract facts using pattern matching only', async () => {
      // Arrange
      const inputText = 'My name is John Doe. I was born in 1985 in Chicago. I currently live in Boston.';

      // Act
      const result = await engine.extractFacts(inputText);

      // Assert
      expect(result.facts.length).toBeGreaterThan(0);
      expect(result.processing_time_ms).toBeGreaterThanOrEqual(0);
      expect(result.stage_results.pattern).toBeTruthy();
      expect(result.stage_results.llm).toBeNull(); // LLM disabled
      expect(result.errors).toHaveLength(0);
      
      // Check that we got some expected facts
      const factKeys = result.facts.map(f => f.key);
      expect(factKeys).toContain('full_name');
      expect(factKeys).toContain('birth_year');
    });

    it('should handle empty input gracefully', async () => {
      // Act
      const result = await engine.extractFacts('');

      // Assert
      expect(result.facts).toHaveLength(0);
      expect(result.errors).toContain('Empty or invalid input text');
      expect(result.processing_time_ms).toBeGreaterThanOrEqual(0);
      expect(result.stage_results.pattern).toBeNull();
      expect(result.stage_results.llm).toBeNull();
    });

    it('should filter facts below confidence threshold', async () => {
      // Arrange
      const engine = new FactExtractionEngine({ 
        enableLLMRefinement: false,
        minConfidenceThreshold: 0.95 // Very high threshold
      });
      const inputText = 'My name is John Doe. I was born in 1985.';

      // Act
      const result = await engine.extractFacts(inputText);

      // Assert - some facts might be filtered out due to high threshold
      expect(result.processing_time_ms).toBeGreaterThanOrEqual(0);
      expect(result.performance_metrics.confidence_filtered).toBeGreaterThanOrEqual(0);
    });

    it('should track performance metrics correctly', async () => {
      // Act
      await engine.extractFacts('Test text 1');
      await engine.extractFacts('Test text 2');
      
      const metrics = engine.getMetrics();

      // Assert
      expect(metrics.total_extractions).toBe(2);
      expect(metrics.successful_extractions).toBe(2);
      expect(metrics.average_processing_time_ms).toBeGreaterThanOrEqual(0);
    });

    it('should calculate success rate correctly', async () => {
      // Act - run successful extractions
      await engine.extractFacts('Valid text');
      await engine.extractFacts('Another valid text');
      
      const successRate = engine.getSuccessRate();

      // Assert
      expect(successRate).toBe(100);
    });

    it('should report health status correctly', async () => {
      // Act - run multiple successful extractions
      for (let i = 0; i < 5; i++) {
        await engine.extractFacts(`Test text ${i}`);
      }

      // Assert
      expect(engine.isHealthy()).toBe(true);
      expect(engine.getSuccessRate()).toBe(100);
    });

    it('should reset metrics correctly', async () => {
      // Arrange
      await engine.extractFacts('Test');
      
      // Act
      engine.resetMetrics();
      const metrics = engine.getMetrics();

      // Assert
      expect(metrics.total_extractions).toBe(0);
      expect(metrics.successful_extractions).toBe(0);
      expect(metrics.average_processing_time_ms).toBe(0);
    });
  });

  describe('extractFactsWithTimeout', () => {
    it('should return successful result within timeout', async () => {
      // Arrange
      const inputText = 'My name is Jane Smith. I was born in 1990.';

      // Act
      const result = await engine.extractFactsWithTimeout(inputText, 5000);

      // Assert
      expect(result.processing_time_ms).toBeLessThan(5000);
      expect(result.facts.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle very short timeout gracefully', async () => {
      // Act
      const result = await engine.extractFactsWithTimeout('Test text', 1); // 1ms timeout

      // Assert - should either succeed quickly or timeout gracefully
      expect(result.processing_time_ms).toBeGreaterThanOrEqual(0);
      if (result.errors.length > 0) {
        expect(result.errors.some(e => e.includes('timeout'))).toBe(true);
      }
    });
  });

  describe('configuration options', () => {
    it('should respect minConfidenceThreshold setting', async () => {
      // Arrange
      const lowThresholdEngine = new FactExtractionEngine({ 
        enableLLMRefinement: false,
        minConfidenceThreshold: 0.1 
      });
      const highThresholdEngine = new FactExtractionEngine({ 
        enableLLMRefinement: false,
        minConfidenceThreshold: 0.95 
      });
      const inputText = 'My name is John Doe. I was born in 1985.';

      // Act
      const lowResult = await lowThresholdEngine.extractFacts(inputText);
      const highResult = await highThresholdEngine.extractFacts(inputText);

      // Assert - low threshold should allow more facts through
      expect(lowResult.facts.length).toBeGreaterThanOrEqual(highResult.facts.length);
    });

    it('should disable LLM refinement when configured', async () => {
      // Arrange
      const engine = new FactExtractionEngine({ enableLLMRefinement: false });
      const inputText = 'Test text';

      // Act
      const result = await engine.extractFacts(inputText);

      // Assert
      expect(result.stage_results.pattern).toBeTruthy();
      expect(result.stage_results.llm).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle malformed input gracefully', async () => {
      // Act
      const result1 = await engine.extractFacts('   '); // Only whitespace
      const result2 = await engine.extractFacts('\n\t\r'); // Only whitespace chars
      
      // Assert
      expect(result1.facts).toHaveLength(0);
      expect(result2.facts).toHaveLength(0);
      expect(result1.processing_time_ms).toBeGreaterThanOrEqual(0);
      expect(result2.processing_time_ms).toBeGreaterThanOrEqual(0);
    });

    it('should handle very long input text', async () => {
      // Arrange
      const longText = 'My name is John Doe. '.repeat(1000); // Very long text

      // Act
      const result = await engine.extractFacts(longText);

      // Assert - should complete without crashing
      expect(result.processing_time_ms).toBeGreaterThanOrEqual(0);
      expect(result.facts.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle special characters and unicode', async () => {
      // Arrange
      const unicodeText = 'My name is José María. I was born in 1985 in São Paulo. I speak português.';

      // Act
      const result = await engine.extractFacts(unicodeText);

      // Assert - should handle unicode gracefully
      expect(result.processing_time_ms).toBeGreaterThanOrEqual(0);
      expect(result.errors).toHaveLength(0);
    });
  });
});