import { describe, it, expect, beforeEach } from 'vitest';
import { LightweightAnalyzer } from '../lightweightAnalyzer';
import { FactbookService } from '../factbookService';

describe('LightweightAnalyzer', () => {
  let analyzer: LightweightAnalyzer;
  let factbookService: FactbookService;
  
  beforeEach(() => {
    analyzer = new LightweightAnalyzer();
    factbookService = FactbookService.getInstance();
  });
  
  describe('analyzeQuery', () => {
    it('should analyze pet queries correctly', () => {
      const result = analyzer.analyzeQuery("Tell me about Olive");
      
      expect(result.keywords).toContain('olive');
      expect(result.entities).toContain('olive');
      expect(result.topics).toContain('pets');
      expect(result.intent).toBe('story');
      expect(result.processingTimeMs).toBeLessThan(10);
    });
    
    it('should analyze place queries correctly', () => {
      const result = analyzer.analyzeQuery("When did you live in Austin?");
      
      expect(result.keywords).toContain('austin');
      expect(result.entities).toContain('austin');
      expect(result.topics).toContain('places');
      expect(result.intent).toBe('factual');
    });
    
    it('should analyze political queries correctly', () => {
      const result = analyzer.analyzeQuery("What do you think about Trump?");
      
      expect(result.keywords).toContain('trump');
      expect(result.entities).toContain('trump');
      expect(result.topics).toContain('politics');
      expect(result.intent).toBe('opinion');
    });
    
    it('should complete analysis within performance target', () => {
      const result = analyzer.analyzeQuery("Tell me about your dog Olive and Austin");
      expect(result.processingTimeMs).toBeLessThan(10);
    });
  });
  
  describe('extractKeywords', () => {
    it('should extract and normalize keywords', () => {
      const keywords = analyzer.extractKeywords("Tell me about Olive's adventures!");
      
      expect(keywords).toContain('olive');
      expect(keywords).toContain('adventur'); // Stemmed
      expect(keywords).not.toContain('me'); // Stopword removed
      expect(keywords).not.toContain('about'); // Stopword removed
    });
    
    it('should handle empty input', () => {
      const keywords = analyzer.extractKeywords("");
      expect(keywords).toHaveLength(0);
    });
    
    it('should handle punctuation and special characters', () => {
      const keywords = analyzer.extractKeywords("What's Austin like? It's amazing!");
      expect(keywords).toContain('austin');
      expect(keywords).toContain('amaz'); // Stemmed from "amazing"
    });
  });
  
  describe('detectEntities', () => {
    it('should detect people entities', () => {
      const entities = analyzer.detectEntities("Jonathan and Tyler are friends");
      expect(entities).toContain('jonathan');
      expect(entities).toContain('tyler');
    });
    
    it('should detect place entities', () => {
      const entities = analyzer.detectEntities("I lived in Austin, Texas");
      expect(entities).toContain('austin');
      expect(entities).toContain('texas');
    });
    
    it('should detect pet entities', () => {
      const entities = analyzer.detectEntities("My dog Olive was amazing");
      expect(entities).toContain('olive');
      expect(entities).toContain('dog');
    });
    
    it('should detect year entities', () => {
      const entities = analyzer.detectEntities("From 2009 to 2018");
      expect(entities).toContain('2009');
      expect(entities).toContain('2018');
    });
  });
  
  describe('classifyTopics', () => {
    it('should classify pet topics', () => {
      const topics = analyzer.classifyTopics("Tell me about Olive", ['olive'], ['olive']);
      expect(topics).toContain('pets');
    });
    
    it('should classify place topics', () => {
      const topics = analyzer.classifyTopics("Austin was great", ['austin'], ['austin']);
      expect(topics).toContain('places');
    });
    
    it('should classify political topics', () => {
      const topics = analyzer.classifyTopics("Trump is terrible", ['trump'], ['trump']);
      expect(topics).toContain('politics');
    });
    
    it('should classify relationship topics', () => {
      const topics = analyzer.classifyTopics("Tyler is my friend", ['tyler'], ['tyler']);
      expect(topics).toContain('relationships');
    });
  });
  
  describe('applyTopicFences', () => {
    it('should prevent pets and politics cross-contamination', () => {
      const topics = ['pets', 'politics'];
      const fenced = analyzer.applyTopicFences(topics);
      
      expect(fenced).toContain('pets');
      expect(fenced).not.toContain('politics');
    });
    
    it('should prevent politics and pets cross-contamination', () => {
      const topics = ['politics', 'pets'];
      const fenced = analyzer.applyTopicFences(topics);
      
      // When both politics and pets are present, pets takes priority (filters out politics)
      expect(fenced).toContain('pets');
      expect(fenced).not.toContain('politics');
    });
    
    it('should allow compatible topics', () => {
      const topics = ['places', 'timeline'];
      const fenced = analyzer.applyTopicFences(topics);
      
      expect(fenced).toContain('places');
      expect(fenced).toContain('timeline');
    });
  });
  
  describe('detectIntent', () => {
    it('should detect factual intent', () => {
      const intent = analyzer.detectIntent("When did you live in Austin?");
      expect(intent).toBe('factual');
    });
    
    it('should detect opinion intent', () => {
      const intent = analyzer.detectIntent("What do you think about Trump?");
      expect(intent).toBe('opinion');
    });
    
    it('should detect story intent', () => {
      const intent = analyzer.detectIntent("Tell me about your experiences");
      expect(intent).toBe('story');
    });
    
    it('should default to general intent', () => {
      const intent = analyzer.detectIntent("Hello there");
      expect(intent).toBe('general');
    });
  });
  
  describe('snippet mapping', () => {
    it('should map queries to relevant snippets when factbook is available', async () => {
      // Mock factbook data with required identity section
      const mockFactbook = {
        identity: {
          name: {
            id: 'identity.name',
            text: 'My name is Jonathan Braden, but people call me Jon or JB.',
            topics: ['identity', 'name'],
            keywords: ['jonathan', 'braden', 'jon', 'jb', 'name']
          }
        },
        pets: {
          olive: {
            id: 'pets.olive',
            text: 'Olive was my beloved Puerto Rican street dog who came with me to Maine.',
            topics: ['pets', 'dogs', 'olive'],
            keywords: ['olive', 'puerto', 'rican', 'street', 'dog', 'maine']
          }
        }
      };
      
      await factbookService.loadFactbook(mockFactbook);
      
      const result = analyzer.analyzeQuery("Tell me about Olive", true);
      
      expect(result.relevantSnippets).toBeDefined();
      expect(result.relevantSnippets!.length).toBeGreaterThan(0);
      expect(result.relevantSnippets!.length).toBeLessThanOrEqual(3);
    });
    
    it('should handle queries when factbook is not available', () => {
      const result = analyzer.analyzeQuery("Tell me about something", true);
      
      // Should not throw error, may have empty snippets
      expect(result.relevantSnippets).toBeDefined();
    });
  });
  
  describe('performance requirements', () => {
    it('should complete analysis within 10ms target', () => {
      const benchmark = analyzer.benchmarkAnalysis("Tell me about Olive and Austin", 50);
      
      expect(benchmark.passesTarget).toBe(true);
      expect(benchmark.maxTimeMs).toBeLessThan(10);
    });
    
    it('should maintain performance with complex queries', () => {
      const complexQuery = "Tell me about Olive the Puerto Rican street dog who lived in Austin Texas with Tyler and survived Maine winters";
      const benchmark = analyzer.benchmarkAnalysis(complexQuery, 20);
      
      expect(benchmark.passesTarget).toBe(true);
    });
  });
  
  describe('token normalization', () => {
    it('should apply ASCII folding to remove diacritics', () => {
      const keywords = analyzer.extractKeywords("Café résumé naïve");
      
      expect(keywords).toContain('cafe');
      expect(keywords).toContain('resume');
      expect(keywords).toContain('naive');
    });
    
    it('should normalize tokens consistently with FactbookService', () => {
      const keywords = analyzer.extractKeywords("Olivé's adventures!");
      const entities = analyzer.detectEntities("Olivé's adventures!");
      
      expect(keywords).toContain('olive');
      expect(entities).toContain('olive');
    });
    
    it('should produce deterministic output', () => {
      const query = "Tell me about Olive and Austin";
      const result1 = analyzer.analyzeQuery(query);
      const result2 = analyzer.analyzeQuery(query);
      
      expect(result1.keywords).toEqual(result2.keywords);
      expect(result1.entities).toEqual(result2.entities);
      expect(result1.topics).toEqual(result2.topics);
    });
  });
  
  describe('edge cases', () => {
    it('should handle very long queries', () => {
      const longQuery = "Tell me about ".repeat(100) + "Olive";
      const result = analyzer.analyzeQuery(longQuery);
      
      expect(result.entities).toContain('olive');
      expect(result.topics).toContain('pets');
    });
    
    it('should handle queries with no meaningful content', () => {
      const result = analyzer.analyzeQuery("the and or but");
      
      expect(result.keywords).toHaveLength(0);
      expect(result.entities).toHaveLength(0);
      expect(result.topics).toHaveLength(0);
    });
    
    it('should handle mixed case and accents', () => {
      const result = analyzer.analyzeQuery("TELL me about Olivé");
      
      expect(result.keywords).toContain('olive');
      expect(result.entities).toContain('olive');
    });
  });
});