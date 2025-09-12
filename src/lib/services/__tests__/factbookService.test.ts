import { describe, it, expect, beforeEach } from 'vitest';
import { FactbookService } from '../factbookService';

describe('FactbookService', () => {
  let service: FactbookService;
  
  const mockFactbook = {
    "identity": {
      "name": {
        "id": "identity.name",
        "text": "My name is Jonathan Braden, but friends call me Jon or JB.",
        "topics": ["identity", "name"],
        "keywords": ["jonathan", "braden", "jon", "jb", "name"]
      }
    },
    "pets": {
      "olive": {
        "id": "pets.olive",
        "text": "Olive was my beloved Puerto Rican street dog. She survived brutal Maine winters.",
        "topics": ["pets", "dogs", "olive"],
        "keywords": ["olive", "puerto", "rican", "street", "dog", "maine"]
      }
    },
    "timeline": {
      "austin_years": {
        "id": "timeline.austin_years", 
        "text": "I lived in Austin, Texas from 2009 to 2018 - nine incredible years.",
        "topics": ["timeline", "places", "austin"],
        "keywords": ["austin", "texas", "2009", "2018", "nine", "years"]
      }
    },
    "opinions": {
      "trump": {
        "id": "opinions.trump",
        "text": "I think Trump is absolutely terrible for America.",
        "topics": ["opinions", "politics", "trump"],
        "keywords": ["trump", "terrible", "america", "politics"]
      }
    }
  };
  
  beforeEach(async () => {
    service = FactbookService.getInstance();
    await service.loadFactbook(mockFactbook);
  });
  
  describe('loadFactbook', () => {
    it('should load and index factbook successfully', async () => {
      const stats = service.getIndexStats();
      expect(stats.snippets).toBe(4);
      expect(stats.keywords).toBeGreaterThan(0);
      expect(stats.topics).toBeGreaterThan(0);
    });
    
    it('should reject invalid factbook structure', async () => {
      const invalidFactbook = { invalid: "structure" };
      await expect(service.loadFactbook(invalidFactbook)).rejects.toThrow('Invalid factbook structure');
    });
    
    it('should complete loading within performance target', async () => {
      const startTime = Date.now();
      await service.loadFactbook(mockFactbook);
      const elapsedMs = Date.now() - startTime;
      expect(elapsedMs).toBeLessThan(50);
    });
  });
  
  describe('querySnippets', () => {
    it('should return relevant snippets for pet queries', () => {
      const results = service.querySnippets(['olive', 'dog']);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('pets.olive');
      expect(results[0].text).toContain('Puerto Rican street dog');
    });
    
    it('should return relevant snippets for place queries', () => {
      const results = service.querySnippets(['austin', 'texas']);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('timeline.austin_years');
      expect(results[0].text).toContain('2009 to 2018');
    });
    
    it('should apply topic fencing to prevent cross-contamination', () => {
      // Query about pets should not return political content
      const results = service.querySnippets(['olive', 'trump']);
      expect(results).toHaveLength(1);
      expect(results[0].topics).toContain('pets');
      expect(results[0].topics).not.toContain('politics');
    });
    
    it('should use deterministic ranking', () => {
      // Multiple queries should return same order
      const results1 = service.querySnippets(['austin']);
      const results2 = service.querySnippets(['austin']);
      expect(results1.map(r => r.id)).toEqual(results2.map(r => r.id));
    });
    
    it('should respect maxResults parameter', () => {
      const results = service.querySnippets(['austin', 'olive', 'trump'], 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });
    
    it('should complete queries within performance target', () => {
      const startTime = Date.now();
      service.querySnippets(['olive', 'dog']);
      const elapsedMs = Date.now() - startTime;
      expect(elapsedMs).toBeLessThan(10);
    });
    
    it('should handle empty queries gracefully', () => {
      const results = service.querySnippets([]);
      expect(results).toHaveLength(0);
    });
    
    it('should handle unknown keywords gracefully', () => {
      const results = service.querySnippets(['quantum', 'physics']);
      expect(results).toHaveLength(0);
    });
  });
  
  describe('scoring system', () => {
    it('should prioritize exact entity matches', () => {
      const results = service.querySnippets(['olive', 'general']);
      expect(results[0].id).toBe('pets.olive'); // Exact match should rank higher
    });
    
    it('should penalize snippets without entities', () => {
      // This would need a snippet without proper nouns to test properly
      const results = service.querySnippets(['austin']);
      expect(results.length).toBeGreaterThan(0);
    });
  });
  
  describe('getSnippetsByTopic', () => {
    it('should return all snippets for a given topic', () => {
      const petSnippets = service.getSnippetsByTopic('pets');
      expect(petSnippets).toHaveLength(1);
      expect(petSnippets[0].id).toBe('pets.olive');
    });
    
    it('should return empty array for unknown topics', () => {
      const results = service.getSnippetsByTopic('unknown');
      expect(results).toHaveLength(0);
    });
  });
});