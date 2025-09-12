import { describe, it, expect, beforeEach } from 'vitest';
import { FactScoringService, ExtractedFact, QuickFact } from '../factScoringService';

describe('FactScoringService', () => {
  let service: FactScoringService;

  beforeEach(() => {
    service = new FactScoringService();
  });

  describe('scoreFact', () => {
    it('should assign correct confidence and priority for high-priority facts', () => {
      const fact: ExtractedFact = {
        key: 'full_name',
        value: 'John Smith',
        confidence: 0.8,
        priority: 5, // Will be overridden
        source: 'manual',
        sourceReference: 'User provided during onboarding',
        extractedAt: new Date(),
      };

      const scored = service.scoreFact(fact);

      expect(scored.priority).toBe(1); // full_name should be priority 1
      expect(scored.confidence).toBeGreaterThan(0.8); // Should be boosted by source reliability
      expect(scored.confidence).toBeLessThanOrEqual(1.0);
    });

    it('should apply source reliability scoring correctly', () => {
      const baseFact = {
        key: 'current_city',
        value: 'New York',
        confidence: 0.7,
        priority: 5,
        sourceReference: 'Extracted from conversation',
        extractedAt: new Date(),
      };

      const manualFact = service.scoreFact({ ...baseFact, source: 'manual' });
      const extractionFact = service.scoreFact({ ...baseFact, source: 'extraction' });
      const llmFact = service.scoreFact({ ...baseFact, source: 'llm' });
      const heuristicFact = service.scoreFact({ ...baseFact, source: 'heuristic' });

      expect(manualFact.confidence).toBeGreaterThan(extractionFact.confidence);
      expect(extractionFact.confidence).toBeGreaterThan(llmFact.confidence);
      expect(llmFact.confidence).toBeGreaterThan(heuristicFact.confidence);
    });

    it('should apply recency bonus for newer facts', () => {
      const oldFact: ExtractedFact = {
        key: 'hobby',
        value: 'reading',
        confidence: 0.6,
        priority: 5,
        source: 'extraction',
        sourceReference: 'Old conversation',
        extractedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
      };

      const newFact: ExtractedFact = {
        ...oldFact,
        extractedAt: new Date(), // Now
      };

      const scoredOld = service.scoreFact(oldFact);
      const scoredNew = service.scoreFact(newFact);

      expect(scoredNew.confidence).toBeGreaterThan(scoredOld.confidence);
    });

    it('should reduce confidence for uncertain language', () => {
      const certainFact: ExtractedFact = {
        key: 'hobby',
        value: 'I love playing guitar',
        confidence: 0.7,
        priority: 5,
        source: 'extraction',
        sourceReference: 'User statement',
        extractedAt: new Date(),
      };

      const uncertainFact: ExtractedFact = {
        ...certainFact,
        value: 'I think I might like playing guitar',
      };

      const scoredCertain = service.scoreFact(certainFact);
      const scoredUncertain = service.scoreFact(uncertainFact);

      expect(scoredCertain.confidence).toBeGreaterThan(scoredUncertain.confidence);
    });

    it('should assign appropriate priorities based on fact keys', () => {
      const facts: ExtractedFact[] = [
        { key: 'full_name', value: 'John', confidence: 0.8, priority: 0, source: 'manual', sourceReference: '' },
        { key: 'hobby', value: 'reading', confidence: 0.8, priority: 0, source: 'manual', sourceReference: '' },
        { key: 'trivia', value: 'likes blue', confidence: 0.8, priority: 0, source: 'manual', sourceReference: '' },
        { key: 'family_mother', value: 'Mary', confidence: 0.8, priority: 0, source: 'manual', sourceReference: '' },
      ];

      const scored = facts.map(fact => service.scoreFact(fact));

      expect(scored.find(f => f.key === 'full_name')?.priority).toBe(1);
      expect(scored.find(f => f.key === 'family_mother')?.priority).toBe(2);
      expect(scored.find(f => f.key === 'hobby')?.priority).toBe(5);
      expect(scored.find(f => f.key === 'trivia')?.priority).toBe(10);
    });
  });

  describe('meetsConfidenceThreshold', () => {
    it('should enforce general confidence threshold', () => {
      const highConfidenceFact: ExtractedFact = {
        key: 'hobby',
        value: 'reading',
        confidence: 0.4,
        priority: 5,
        source: 'extraction',
        sourceReference: '',
      };

      const lowConfidenceFact: ExtractedFact = {
        ...highConfidenceFact,
        confidence: 0.3,
      };

      expect(service.meetsConfidenceThreshold(highConfidenceFact)).toBe(true);
      expect(service.meetsConfidenceThreshold(lowConfidenceFact)).toBe(false);
    });

    it('should use lower threshold for place facts', () => {
      const placeFact: ExtractedFact = {
        key: 'birthplace',
        value: 'Chicago',
        confidence: 0.3,
        priority: 2,
        source: 'extraction',
        sourceReference: '',
      };

      const nonPlaceFact: ExtractedFact = {
        key: 'hobby',
        value: 'reading',
        confidence: 0.3,
        priority: 5,
        source: 'extraction',
        sourceReference: '',
      };

      expect(service.meetsConfidenceThreshold(placeFact)).toBe(true);
      expect(service.meetsConfidenceThreshold(nonPlaceFact)).toBe(false);
    });
  });

  describe('resolveConflict', () => {
    it('should choose fact with higher weighted score', () => {
      const existingFact: QuickFact = {
        id: '1',
        avatarId: 'avatar1',
        key: 'current_city',
        value: 'Boston',
        confidence: 0.6,
        priority: 3,
        source: 'heuristic',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const newFact: ExtractedFact = {
        key: 'current_city',
        value: 'New York',
        confidence: 0.8,
        priority: 2,
        source: 'manual',
        sourceReference: 'User confirmed location',
        extractedAt: new Date(),
      };

      const result = service.resolveConflict(existingFact, newFact);

      expect(result.winningFact.value).toBe('New York');
      expect(result.winningFact.source).toBe('manual');
      expect(result.confidenceAdjustment).toBeGreaterThan(0);
      expect(result.reason).toContain('higher weighted score');
    });

    it('should boost confidence when scores are very close', () => {
      const existingFact: QuickFact = {
        id: '1',
        avatarId: 'avatar1',
        key: 'hobby',
        value: 'reading',
        confidence: 0.7,
        priority: 5,
        source: 'extraction',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const newFact: ExtractedFact = {
        key: 'hobby',
        value: 'reading books',
        confidence: 0.7, // Same base confidence
        priority: 5,
        source: 'extraction', // Same source
        sourceReference: 'Recent conversation',
        extractedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // Old enough to not get recency bonus
      };

      const result = service.resolveConflict(existingFact, newFact);

      expect(result.winningFact.confidence).toBeGreaterThan(existingFact.confidence);
      expect(result.confidenceAdjustment).toBeGreaterThan(0);
      expect(result.reason).toContain('similar scores');
    });

    it('should keep existing fact when it has higher score', () => {
      const existingFact: QuickFact = {
        id: '1',
        avatarId: 'avatar1',
        key: 'full_name',
        value: 'John Smith',
        confidence: 0.95,
        priority: 1,
        source: 'manual',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const newFact: ExtractedFact = {
        key: 'full_name',
        value: 'Johnny Smith',
        confidence: 0.6,
        priority: 1,
        source: 'heuristic',
        sourceReference: 'Guessed from context',
        extractedAt: new Date(),
      };

      const result = service.resolveConflict(existingFact, newFact);

      expect(result.winningFact.value).toBe('John Smith');
      expect(result.winningFact.source).toBe('manual');
      expect(result.confidenceAdjustment).toBe(0);
    });
  });

  describe('filterByConfidence', () => {
    it('should filter out facts below confidence threshold', () => {
      const facts: ExtractedFact[] = [
        { key: 'hobby', value: 'reading', confidence: 0.4, priority: 5, source: 'extraction', sourceReference: '' },
        { key: 'name', value: 'John', confidence: 0.3, priority: 1, source: 'extraction', sourceReference: '' },
        { key: 'birthplace', value: 'Chicago', confidence: 0.3, priority: 2, source: 'extraction', sourceReference: '' },
        { key: 'pet', value: 'dog', confidence: 0.2, priority: 7, source: 'extraction', sourceReference: '' },
      ];

      const filtered = service.filterByConfidence(facts);

      expect(filtered).toHaveLength(2); // hobby (0.4 > 0.35) and birthplace (0.3 > 0.25 for places)
      expect(filtered.find(f => f.key === 'hobby')).toBeDefined();
      expect(filtered.find(f => f.key === 'birthplace')).toBeDefined();
      expect(filtered.find(f => f.key === 'name')).toBeUndefined();
      expect(filtered.find(f => f.key === 'pet')).toBeUndefined();
    });
  });

  describe('sortByImportance', () => {
    it('should sort facts by priority then confidence', () => {
      const facts: ExtractedFact[] = [
        { key: 'hobby', value: 'reading', confidence: 0.8, priority: 5, source: 'extraction', sourceReference: '' },
        { key: 'name', value: 'John', confidence: 0.7, priority: 1, source: 'extraction', sourceReference: '' },
        { key: 'name2', value: 'Johnny', confidence: 0.9, priority: 1, source: 'extraction', sourceReference: '' },
        { key: 'trivia', value: 'likes blue', confidence: 0.9, priority: 10, source: 'extraction', sourceReference: '' },
      ];

      const sorted = service.sortByImportance(facts);

      expect(sorted[0].key).toBe('name2'); // Priority 1, confidence 0.9
      expect(sorted[1].key).toBe('name'); // Priority 1, confidence 0.7
      expect(sorted[2].key).toBe('hobby'); // Priority 5
      expect(sorted[3].key).toBe('trivia'); // Priority 10
    });
  });

  describe('custom configuration', () => {
    it('should accept custom configuration', () => {
      const customService = new FactScoringService({
        confidenceThresholds: {
          general: 0.5,
          place: 0.4,
        },
        sourceReliability: {
          manual: 1.0,
          extraction: 0.9,
          llm: 0.8,
          heuristic: 0.6,
        },
      });

      const fact: ExtractedFact = {
        key: 'hobby',
        value: 'reading',
        confidence: 0.45,
        priority: 5,
        source: 'extraction',
        sourceReference: '',
      };

      // Should fail with default config but pass with custom
      expect(service.meetsConfidenceThreshold(fact)).toBe(true); // 0.45 > 0.35
      expect(customService.meetsConfidenceThreshold(fact)).toBe(false); // 0.45 < 0.5
    });
  });

  describe('edge cases', () => {
    it('should handle facts without extractedAt date', () => {
      const fact: ExtractedFact = {
        key: 'hobby',
        value: 'reading',
        confidence: 0.7,
        priority: 5,
        source: 'extraction',
        sourceReference: '',
        // No extractedAt
      };

      const scored = service.scoreFact(fact);
      expect(scored.confidence).toBeDefined();
      expect(scored.priority).toBeDefined();
    });

    it('should handle empty or invalid values gracefully', () => {
      const fact: ExtractedFact = {
        key: '',
        value: '',
        confidence: 0,
        priority: 0,
        source: 'unknown',
        sourceReference: '',
      };

      const scored = service.scoreFact(fact);
      expect(scored.confidence).toBeGreaterThan(0);
      expect(scored.priority).toBeGreaterThan(0);
    });

    it('should cap confidence at 1.0', () => {
      const fact: ExtractedFact = {
        key: 'full_name',
        value: 'John Smith with detailed source reference',
        confidence: 0.95,
        priority: 1,
        source: 'manual',
        sourceReference: 'Very detailed source reference with lots of context',
        extractedAt: new Date(),
      };

      const scored = service.scoreFact(fact);
      expect(scored.confidence).toBeLessThanOrEqual(1.0);
    });
  });
});