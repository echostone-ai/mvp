import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { LLMExtractor } from '../llmExtractor';
import { ExtractedFact } from '../patternExtractor';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('LLMExtractor', () => {
  let extractor: LLMExtractor;

  beforeEach(() => {
    extractor = new LLMExtractor();
    vi.clearAllMocks();
    
    // Set up environment variable
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateFact', () => {
    test('validates supported fact keys', () => {
      expect(extractor.validateFact('full_name', 'John Doe')).toBe(true);
      expect(extractor.validateFact('birth_year', '1985')).toBe(true);
      expect(extractor.validateFact('birthplace', 'Chicago')).toBe(true);
      expect(extractor.validateFact('unsupported_key', 'value')).toBe(false);
    });

    test('validates birth year ranges', () => {
      expect(extractor.validateFact('birth_year', '1985')).toBe(true);
      expect(extractor.validateFact('birth_year', '2000')).toBe(true);
      expect(extractor.validateFact('birth_year', '1899')).toBe(false);
      expect(extractor.validateFact('birth_year', '2036')).toBe(false);
      expect(extractor.validateFact('birth_year', 'invalid')).toBe(false);
    });

    test('validates full name format', () => {
      expect(extractor.validateFact('full_name', 'John Doe')).toBe(true);
      expect(extractor.validateFact('full_name', 'Mary Jane Smith')).toBe(true);
      expect(extractor.validateFact('full_name', "Patrick O'Connor")).toBe(true);
      expect(extractor.validateFact('full_name', 'John')).toBe(false); // Single name
      expect(extractor.validateFact('full_name', 'John123')).toBe(false); // Contains numbers
    });

    test('validates languages format', () => {
      expect(extractor.validateFact('languages', 'English, Spanish')).toBe(true);
      expect(extractor.validateFact('languages', 'French')).toBe(true);
      expect(extractor.validateFact('languages', 'English, ')).toBe(false); // Empty language
    });

    test('validates value length', () => {
      expect(extractor.validateFact('birthplace', '')).toBe(false);
      expect(extractor.validateFact('birthplace', 'A')).toBe(true);
      expect(extractor.validateFact('birthplace', 'A'.repeat(201))).toBe(false);
    });

    test('validates move-related keys', () => {
      expect(extractor.validateFact('moved_to__chicago__year', '2010')).toBe(true);
      expect(extractor.validateFact('moved_to__boston__age', 'age_25')).toBe(true);
    });
  });

  describe('calculateConfidence', () => {
    test('calculates base confidence for LLM extraction', () => {
      const fact: ExtractedFact = {
        key: 'birthplace',
        value: 'Chicago',
        confidence: 0,
        source_text: 'I was born in Chicago',
        extraction_method: 'llm'
      };

      const confidence = extractor.calculateConfidence(fact, 'I was born in Chicago in 1985');
      expect(confidence).toBeGreaterThan(0.7);
      expect(confidence).toBeLessThan(1.0);
    });

    test('boosts confidence when value appears in source text', () => {
      const fact: ExtractedFact = {
        key: 'birthplace',
        value: 'Chicago',
        confidence: 0,
        source_text: 'I was born in Chicago',
        extraction_method: 'llm'
      };

      const confidenceWithMatch = extractor.calculateConfidence(fact, 'I was born in Chicago');
      const confidenceWithoutMatch = extractor.calculateConfidence(fact, 'I was born somewhere');
      
      expect(confidenceWithMatch).toBeGreaterThan(confidenceWithoutMatch);
    });

    test('adjusts confidence based on fact type', () => {
      const birthYearFact: ExtractedFact = {
        key: 'birth_year',
        value: '1985',
        confidence: 0,
        source_text: 'born in 1985',
        extraction_method: 'llm'
      };

      const personalityFact: ExtractedFact = {
        key: 'personality_traits',
        value: 'outgoing',
        confidence: 0,
        source_text: 'I am outgoing',
        extraction_method: 'llm'
      };

      const birthYearConfidence = extractor.calculateConfidence(birthYearFact, 'I was born in 1985');
      const personalityConfidence = extractor.calculateConfidence(personalityFact, 'I am outgoing');
      
      expect(birthYearConfidence).toBeGreaterThan(personalityConfidence);
    });

    test('reduces confidence for very long values', () => {
      const shortFact: ExtractedFact = {
        key: 'birthplace',
        value: 'Chicago',
        confidence: 0,
        source_text: 'Chicago',
        extraction_method: 'llm'
      };

      const longFact: ExtractedFact = {
        key: 'birthplace',
        value: 'A'.repeat(60),
        confidence: 0,
        source_text: 'A'.repeat(60),
        extraction_method: 'llm'
      };

      const shortConfidence = extractor.calculateConfidence(shortFact, 'I was born in Chicago');
      const longConfidence = extractor.calculateConfidence(longFact, 'I was born in ' + 'A'.repeat(60));
      
      expect(shortConfidence).toBeGreaterThan(longConfidence);
    });
  });

  describe('refineExtraction', () => {
    test('handles successful OpenAI response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"full_name": "John Doe", "birth_year": "1985", "birthplace": "Chicago"}'
          }
        }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await extractor.refineExtraction('I am John Doe, born in Chicago in 1985');
      
      expect(result.facts).toHaveLength(3);
      expect(result.facts.some(f => f.key === 'full_name' && f.value === 'John Doe')).toBe(true);
      expect(result.facts.some(f => f.key === 'birth_year' && f.value === '1985')).toBe(true);
      expect(result.facts.some(f => f.key === 'birthplace' && f.value === 'Chicago')).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.processing_time_ms).toBeGreaterThanOrEqual(0);
    });

    test('filters out invalid facts', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"full_name": "John", "birth_year": "1800", "birthplace": "Chicago", "invalid_key": "value"}'
          }
        }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await extractor.refineExtraction('I am John, born in Chicago in 1800');
      
      // Should only include valid facts (birthplace)
      expect(result.facts).toHaveLength(1);
      expect(result.facts[0].key).toBe('birthplace');
      expect(result.facts[0].value).toBe('Chicago');
    });

    test('handles existing heuristic facts', async () => {
      const existingFacts: ExtractedFact[] = [{
        key: 'birth_year',
        value: '1985',
        confidence: 0.9,
        source_text: 'born in 1985',
        extraction_method: 'pattern'
      }];

      const mockResponse = {
        choices: [{
          message: {
            content: '{"full_name": "John Doe", "birthplace": "Chicago"}'
          }
        }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await extractor.refineExtraction('I am John Doe, born in Chicago in 1985', existingFacts);
      
      expect(result.facts).toHaveLength(2);
      expect(result.facts.some(f => f.key === 'full_name')).toBe(true);
      expect(result.facts.some(f => f.key === 'birthplace')).toBe(true);
      // Should not duplicate birth_year from existing facts
      expect(result.facts.some(f => f.key === 'birth_year')).toBe(false);
    });

    test('handles OpenAI API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      });

      const result = await extractor.refineExtraction('Some text');
      
      expect(result.facts).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('OpenAI API error');
      expect(result.llm_confidence).toBe(0);
    });

    test('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await extractor.refineExtraction('Some text');
      
      expect(result.facts).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Network error');
    });

    test('handles invalid JSON responses', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'This is not valid JSON'
          }
        }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await extractor.refineExtraction('Some text');
      
      expect(result.facts).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to parse LLM response');
    });

    test('handles empty responses', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{}'
          }
        }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await extractor.refineExtraction('Some text with no extractable facts');
      
      expect(result.facts).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.llm_confidence).toBe(0);
    });

    test('handles timeout', async () => {
      const shortTimeoutExtractor = new LLMExtractor({ timeout_ms: 100 });
      
      // Mock a slow response
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      const result = await shortTimeoutExtractor.refineExtraction('Some text');
      
      expect(result.facts).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('LLM extraction failed');
    });
  });

  describe('extractFacts', () => {
    test('extracts facts without existing heuristics', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"full_name": "Jane Smith", "current_city": "Boston"}'
          }
        }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await extractor.extractFacts('I am Jane Smith living in Boston');
      
      expect(result.facts).toHaveLength(2);
      expect(result.facts.some(f => f.key === 'full_name' && f.value === 'Jane Smith')).toBe(true);
      expect(result.facts.some(f => f.key === 'current_city' && f.value === 'Boston')).toBe(true);
    });
  });

  describe('configuration', () => {
    test('uses custom configuration', () => {
      const customExtractor = new LLMExtractor({
        model: 'gpt-3.5-turbo',
        temperature: 0.5,
        max_tokens: 500,
        timeout_ms: 5000
      });

      expect(customExtractor['config'].model).toBe('gpt-3.5-turbo');
      expect(customExtractor['config'].temperature).toBe(0.5);
      expect(customExtractor['config'].max_tokens).toBe(500);
      expect(customExtractor['config'].timeout_ms).toBe(5000);
    });

    test('uses default configuration when not provided', () => {
      const defaultExtractor = new LLMExtractor();

      expect(defaultExtractor['config'].model).toBe('gpt-4o-mini');
      expect(defaultExtractor['config'].temperature).toBe(0.1);
      expect(defaultExtractor['config'].max_tokens).toBe(1000);
      expect(defaultExtractor['config'].timeout_ms).toBe(10000);
    });
  });

  describe('edge cases', () => {
    test('handles malformed OpenAI response structure', async () => {
      const mockResponse = {
        // Missing choices array
        data: 'invalid'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await extractor.refineExtraction('Some text');
      
      expect(result.facts).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Invalid OpenAI API response format');
    });

    test('handles JSON with extra text from LLM', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Here are the extracted facts: {"full_name": "John Doe"} Hope this helps!'
          }
        }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await extractor.refineExtraction('I am John Doe');
      
      expect(result.facts).toHaveLength(1);
      expect(result.facts[0].key).toBe('full_name');
      expect(result.facts[0].value).toBe('John Doe');
    });

    test('handles facts with non-string values', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"full_name": "John Doe", "birth_year": 1985, "is_active": true}'
          }
        }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await extractor.refineExtraction('I am John Doe, born in 1985');
      
      // Should only include string values
      expect(result.facts).toHaveLength(1);
      expect(result.facts[0].key).toBe('full_name');
      expect(result.facts[0].value).toBe('John Doe');
    });
  });
});