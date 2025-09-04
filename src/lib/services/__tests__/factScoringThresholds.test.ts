import { describe, it, expect, beforeEach } from 'vitest';
import { FactScoringService, ExtractedFact } from '../factScoringService';

describe('FactScoringService - Threshold Enforcement', () => {
  let service: FactScoringService;

  beforeEach(() => {
    service = new FactScoringService();
  });

  describe('confidence threshold enforcement', () => {
    it('should enforce 0.35 threshold for general facts', () => {
      const facts: ExtractedFact[] = [
        { key: 'hobby', value: 'reading', confidence: 0.36, priority: 5, source: 'extraction', sourceReference: '' },
        { key: 'hobby', value: 'writing', confidence: 0.35, priority: 5, source: 'extraction', sourceReference: '' },
        { key: 'hobby', value: 'painting', confidence: 0.34, priority: 5, source: 'extraction', sourceReference: '' },
      ];

      const filtered = service.filterByConfidence(facts);

      expect(filtered).toHaveLength(2);
      expect(filtered.find(f => f.value === 'reading')).toBeDefined();
      expect(filtered.find(f => f.value === 'writing')).toBeDefined();
      expect(filtered.find(f => f.value === 'painting')).toBeUndefined();
    });

    it('should enforce 0.25 threshold for place facts', () => {
      const facts: ExtractedFact[] = [
        { key: 'birthplace', value: 'Chicago', confidence: 0.26, priority: 2, source: 'extraction', sourceReference: '' },
        { key: 'current_city', value: 'New York', confidence: 0.25, priority: 2, source: 'extraction', sourceReference: '' },
        { key: 'grew_up', value: 'Boston', confidence: 0.24, priority: 3, source: 'extraction', sourceReference: '' },
        { key: 'hometown', value: 'Seattle', confidence: 0.24, priority: 3, source: 'extraction', sourceReference: '' },
      ];

      const filtered = service.filterByConfidence(facts);

      expect(filtered).toHaveLength(2);
      expect(filtered.find(f => f.value === 'Chicago')).toBeDefined();
      expect(filtered.find(f => f.value === 'New York')).toBeDefined();
      expect(filtered.find(f => f.value === 'Boston')).toBeUndefined();
      expect(filtered.find(f => f.value === 'Seattle')).toBeUndefined();
    });

    it('should correctly identify place facts for threshold application', () => {
      const placeFacts = [
        'birthplace', 'current_city', 'grew_up', 'lives_in', 
        'moved_to_chicago', 'hometown', 'location', 'address'
      ];

      const nonPlaceFacts = [
        'hobby', 'full_name', 'age', 'occupation', 'education'
      ];

      placeFacts.forEach(key => {
        const fact: ExtractedFact = {
          key,
          value: 'test',
          confidence: 0.3, // Between place threshold (0.25) and general threshold (0.35)
          priority: 5,
          source: 'extraction',
          sourceReference: '',
        };
        expect(service.meetsConfidenceThreshold(fact)).toBe(true);
      });

      nonPlaceFacts.forEach(key => {
        const fact: ExtractedFact = {
          key,
          value: 'test',
          confidence: 0.3, // Between place threshold (0.25) and general threshold (0.35)
          priority: 5,
          source: 'extraction',
          sourceReference: '',
        };
        expect(service.meetsConfidenceThreshold(fact)).toBe(false);
      });
    });
  });

  describe('source reliability scoring', () => {
    it('should apply correct source reliability order: manual > extraction > llm > heuristic', () => {
      const baseFact = {
        key: 'hobby',
        value: 'reading',
        confidence: 0.6,
        priority: 5,
        sourceReference: 'test',
        extractedAt: new Date(),
      };

      const manualFact = service.scoreFact({ ...baseFact, source: 'manual' });
      const extractionFact = service.scoreFact({ ...baseFact, source: 'extraction' });
      const llmFact = service.scoreFact({ ...baseFact, source: 'llm' });
      const heuristicFact = service.scoreFact({ ...baseFact, source: 'heuristic' });

      // Verify the ordering
      expect(manualFact.confidence).toBeGreaterThan(extractionFact.confidence);
      expect(extractionFact.confidence).toBeGreaterThan(llmFact.confidence);
      expect(llmFact.confidence).toBeGreaterThan(heuristicFact.confidence);

      // Verify that manual has higher confidence than heuristic
      expect(manualFact.confidence).toBeGreaterThan(0.8);
      expect(heuristicFact.confidence).toBeLessThanOrEqual(0.5);
    });

    it('should handle unknown source types with default reliability', () => {
      const fact: ExtractedFact = {
        key: 'hobby',
        value: 'reading',
        confidence: 0.6,
        priority: 5,
        source: 'unknown_source',
        sourceReference: 'test',
        extractedAt: new Date(),
      };

      const scored = service.scoreFact(fact);
      
      // Should use default reliability of 0.5 (same as heuristic)
      expect(scored.confidence).toBeLessThanOrEqual(0.5);
    });
  });

  describe('recency bonus application', () => {
    it('should apply maximum recency bonus for very recent facts', () => {
      const recentFact: ExtractedFact = {
        key: 'hobby',
        value: 'reading',
        confidence: 0.6,
        priority: 5,
        source: 'extraction',
        sourceReference: 'test',
        extractedAt: new Date(), // Right now
      };

      const scored = service.scoreFact(recentFact);
      
      // Should get full recency bonus plus source reliability and structure bonus
      expect(scored.confidence).toBeGreaterThan(0.7); // Should be significantly boosted
    });

    it('should apply no recency bonus for old facts', () => {
      const oldFact: ExtractedFact = {
        key: 'hobby',
        value: 'reading',
        confidence: 0.6,
        priority: 5,
        source: 'extraction',
        sourceReference: 'test',
        extractedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
      };

      const scored = service.scoreFact(oldFact);
      
      // Should get no recency bonus
      expect(scored.confidence).toBeCloseTo(0.6 * 0.85 + 0.1, 1); // Just base + source + structure
    });

    it('should apply graduated recency bonus for moderately recent facts', () => {
      const moderatelyRecentFact: ExtractedFact = {
        key: 'hobby',
        value: 'reading',
        confidence: 0.6,
        priority: 5,
        source: 'extraction',
        sourceReference: 'test',
        extractedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      };

      const scored = service.scoreFact(moderatelyRecentFact);
      
      // Should get partial recency bonus (about half of max)
      const expectedBonus = 0.15 * (1 - 15/30); // 50% of max bonus
      expect(scored.confidence).toBeCloseTo(0.6 * 0.85 + 0.1 + expectedBonus, 1);
    });
  });

  describe('conflict resolution with thresholds', () => {
    it('should not allow low-confidence facts to override high-confidence ones', () => {
      const highConfidenceFact = {
        id: '1',
        avatarId: 'avatar1',
        key: 'full_name',
        value: 'John Smith',
        confidence: 0.9,
        priority: 1,
        source: 'manual' as const,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const lowConfidenceFact: ExtractedFact = {
        key: 'full_name',
        value: 'Johnny Smith',
        confidence: 0.3, // Below general threshold
        priority: 1,
        source: 'heuristic',
        sourceReference: 'Guessed',
        extractedAt: new Date(),
      };

      const result = service.resolveConflict(highConfidenceFact, lowConfidenceFact);

      expect(result.winningFact.value).toBe('John Smith');
      expect(result.winningFact.confidence).toBe(0.9);
      expect(result.reason).toContain('higher weighted score');
    });

    it('should allow high-confidence facts to override low-confidence ones', () => {
      const lowConfidenceFact = {
        id: '1',
        avatarId: 'avatar1',
        key: 'current_city',
        value: 'Unknown',
        confidence: 0.3,
        priority: 5,
        source: 'heuristic' as const,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const highConfidenceFact: ExtractedFact = {
        key: 'current_city',
        value: 'New York',
        confidence: 0.8,
        priority: 2,
        source: 'manual',
        sourceReference: 'User confirmed',
        extractedAt: new Date(),
      };

      const result = service.resolveConflict(lowConfidenceFact, highConfidenceFact);

      expect(result.winningFact.value).toBe('New York');
      expect(result.winningFact.source).toBe('manual');
      expect(result.reason).toContain('higher weighted score');
    });
  });

  describe('priority-based filtering', () => {
    it('should prioritize core identity facts over trivia', () => {
      const facts: ExtractedFact[] = [
        { key: 'trivia', value: 'likes blue', confidence: 0.9, priority: 10, source: 'manual', sourceReference: '' },
        { key: 'full_name', value: 'John', confidence: 0.7, priority: 1, source: 'extraction', sourceReference: '' },
      ];

      const sorted = service.sortByImportance(facts);

      expect(sorted[0].key).toBe('full_name'); // Priority 1 comes first despite lower confidence
      expect(sorted[1].key).toBe('trivia');
    });

    it('should use confidence as tiebreaker for same priority', () => {
      const facts: ExtractedFact[] = [
        { key: 'hobby1', value: 'reading', confidence: 0.6, priority: 5, source: 'extraction', sourceReference: '' },
        { key: 'hobby2', value: 'writing', confidence: 0.8, priority: 5, source: 'extraction', sourceReference: '' },
      ];

      const sorted = service.sortByImportance(facts);

      expect(sorted[0].key).toBe('hobby2'); // Higher confidence wins with same priority
      expect(sorted[1].key).toBe('hobby1');
    });
  });
});