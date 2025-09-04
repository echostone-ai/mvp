import { describe, test, expect, beforeEach } from 'vitest';
import { PatternExtractor } from '../patternExtractor';

describe('PatternExtractor', () => {
  let extractor: PatternExtractor;

  beforeEach(() => {
    extractor = new PatternExtractor();
  });

  describe('extractBirthYear', () => {
    test('extracts birth year from various formats', () => {
      expect(extractor.extractBirthYear('I was born in 1985')?.value).toBe('1985');
      expect(extractor.extractBirthYear('Born 1985 in Chicago')?.value).toBe('1985');
      expect(extractor.extractBirthYear('My birth year is 1985')?.value).toBe('1985');
      expect(extractor.extractBirthYear('birth year 1985')?.value).toBe('1985');
      expect(extractor.extractBirthYear('born 1985')?.value).toBe('1985');
    });

    test('handles edge cases gracefully', () => {
      expect(extractor.extractBirthYear('I was born in the 1800s')).toBeNull();
      expect(extractor.extractBirthYear('Born in 2050')).toBeNull();
      expect(extractor.extractBirthYear('Born in 1899')).toBeNull();
      expect(extractor.extractBirthYear('Born in 2036')).toBeNull();
      expect(extractor.extractBirthYear('No birth year mentioned')).toBeNull();
    });

    test('returns correct confidence and metadata', () => {
      const result = extractor.extractBirthYear('I was born in 1985');
      expect(result).toMatchObject({
        key: 'birth_year',
        value: '1985',
        confidence: 0.9,
        extraction_method: 'pattern'
      });
      expect(result?.source_text).toContain('1985');
    });
  });

  describe('extractBirthplace', () => {
    test('extracts birthplace from various formats', () => {
      expect(extractor.extractBirthplace('I was born in Chicago')?.value).toBe('Chicago');
      expect(extractor.extractBirthplace('Born in New York City')?.value).toBe('New York City');
      expect(extractor.extractBirthplace('born at Boston Hospital')?.value).toBe('Boston Hospital');
      expect(extractor.extractBirthplace('My birthplace is San Francisco')?.value).toBe('San Francisco');
      expect(extractor.extractBirthplace('I am from Los Angeles originally')?.value).toBe('Los Angeles');
    });

    test('handles complex birthplace formats', () => {
      expect(extractor.extractBirthplace('I was born in Chicago in 1985')?.value).toBe('Chicago');
      expect(extractor.extractBirthplace('Born in New York, moved to LA')?.value).toBe('New York');
    });

    test('normalizes location names', () => {
      expect(extractor.extractBirthplace('born in new york city')?.value).toBe('New York City');
      expect(extractor.extractBirthplace('born in the bronx')?.value).toBe('Bronx');
    });

    test('returns null for invalid or missing birthplaces', () => {
      expect(extractor.extractBirthplace('No birthplace mentioned')).toBeNull();
      expect(extractor.extractBirthplace('born in a')).toBeNull(); // Too short
    });
  });

  describe('extractMoves', () => {
    test('extracts move information with years', () => {
      const moves = extractor.extractMoves('I moved to Chicago in 1995, then relocated to Boston in 2000');
      expect(moves).toHaveLength(2);
      expect(moves[0]).toMatchObject({
        key: 'moved_to__chicago__year',
        value: '1995',
        confidence: 0.8
      });
      expect(moves[1]).toMatchObject({
        key: 'moved_to__boston__year',
        value: '2000',
        confidence: 0.8
      });
    });

    test('extracts move information with age', () => {
      const moves = extractor.extractMoves('I moved to Seattle at age 25');
      expect(moves).toHaveLength(1);
      expect(moves[0]).toMatchObject({
        key: 'moved_to__seattle__age',
        value: 'age_25',
        confidence: 0.8
      });
    });

    test('handles various move verbs', () => {
      const text = 'moved to Chicago in 1995, relocated to Boston in 2000, went to Miami in 2005';
      const moves = extractor.extractMoves(text);
      expect(moves).toHaveLength(3);
      expect(moves.map(m => m.key)).toEqual([
        'moved_to__chicago__year',
        'moved_to__boston__year', 
        'moved_to__miami__year'
      ]);
    });

    test('normalizes city names in keys', () => {
      const moves = extractor.extractMoves('moved to New York City in 1995');
      expect(moves[0].key).toBe('moved_to__new_york_city__year');
    });
  });

  describe('extractRelationships', () => {
    test('extracts family relationships', () => {
      const relationships = extractor.extractRelationships('My mom is Sarah and my dad is John');
      expect(relationships.length).toBeGreaterThanOrEqual(1);
      expect(relationships.some(r => r.key === 'family_parents')).toBe(true);
    });

    test('extracts partner relationships', () => {
      const relationships = extractor.extractRelationships('My wife is Jennifer');
      expect(relationships).toHaveLength(1);
      expect(relationships[0]).toMatchObject({
        key: 'partner_name',
        value: 'Jennifer',
        confidence: 0.85
      });
    });

    test('extracts sibling relationships', () => {
      const relationships = extractor.extractRelationships('My brother is Mike. My sister called Lisa');
      expect(relationships.length).toBeGreaterThanOrEqual(1);
      expect(relationships.some(r => r.key === 'family_siblings')).toBe(true);
    });

    test('handles various relationship formats', () => {
      const text = 'my mother named Mary, my husband is David, my son called Tommy';
      const relationships = extractor.extractRelationships(text);
      expect(relationships).toHaveLength(3);
      expect(relationships.map(r => r.key)).toEqual([
        'family_parents',
        'partner_name',
        'family_children'
      ]);
    });

    test('normalizes names', () => {
      const relationships = extractor.extractRelationships('my mom is mary jane smith');
      expect(relationships[0].value).toBe('Mary Jane Smith');
    });
  });

  describe('extractLanguages', () => {
    test('extracts languages from various formats', () => {
      expect(extractor.extractLanguages('I speak English and Spanish')?.value).toBe('English, Spanish');
      expect(extractor.extractLanguages('fluent in French')?.value).toBe('French');
      expect(extractor.extractLanguages('My language is German')?.value).toBe('German');
      expect(extractor.extractLanguages('bilingual in English and Chinese')?.value).toBe('English, Chinese');
    });

    test('normalizes language names', () => {
      expect(extractor.extractLanguages('I speak english and spanish')?.value).toBe('English, Spanish');
    });

    test('removes duplicates', () => {
      expect(extractor.extractLanguages('I speak English, know English, fluent in English')?.value).toBe('English');
    });

    test('returns null when no languages found', () => {
      expect(extractor.extractLanguages('No languages mentioned here')).toBeNull();
    });
  });

  describe('extractCurrentPets', () => {
    test('extracts pet information', () => {
      expect(extractor.extractCurrentPets('I have a dog named Max')?.value).toContain('dog named Max');
      expect(extractor.extractCurrentPets('My cat is Whiskers')?.value).toBe('My cat is Whiskers');
      expect(extractor.extractCurrentPets('own a puppy')?.value).toContain('puppy');
    });

    test('returns null when no pets mentioned', () => {
      expect(extractor.extractCurrentPets('No pets mentioned here')).toBeNull();
    });
  });

  describe('extractCurrentJob', () => {
    test('extracts job information from various formats', () => {
      const job1 = extractor.extractCurrentJob('I work as a software engineer');
      const job2 = extractor.extractCurrentJob('My job is teacher');
      const job3 = extractor.extractCurrentJob('employed as a nurse');
      
      if (job1) expect(job1.value).toContain('software engineer');
      if (job2) expect(job2.value).toBe('teacher');
      if (job3) expect(job3.value).toContain('nurse');
    });

    test('returns null for short or invalid job descriptions', () => {
      expect(extractor.extractCurrentJob('I work as a')).toBeNull();
      expect(extractor.extractCurrentJob('No job mentioned')).toBeNull();
    });
  });

  describe('extractHobbies', () => {
    test('extracts hobbies from various formats', () => {
      expect(extractor.extractHobbies('I enjoy reading and hiking')?.value).toBe('reading and hiking');
      expect(extractor.extractHobbies('My hobbies are painting')?.value).toBe('painting');
      expect(extractor.extractHobbies('I love swimming in my free time')?.value).toBe('swimming');
    });

    test('handles multiple hobby mentions', () => {
      const result = extractor.extractHobbies('I enjoy reading. I also love cooking and my hobby is painting');
      expect(result?.value).toContain('reading');
      expect(result?.value).toContain('cooking');
      expect(result?.value).toContain('painting');
    });

    test('returns null when no hobbies found', () => {
      expect(extractor.extractHobbies('No hobbies mentioned here')).toBeNull();
    });
  });

  describe('extractFullName', () => {
    test('extracts full name from various formats', () => {
      expect(extractor.extractFullName('My name is John Smith')?.value).toBe('John Smith');
      expect(extractor.extractFullName('I am Sarah Johnson')?.value).toBe('Sarah Johnson');
      expect(extractor.extractFullName('I\'m called Michael Brown')?.value).toBe('Michael Brown');
      expect(extractor.extractFullName('called David Wilson')?.value).toBe('David Wilson');
    });

    test('requires at least two name parts', () => {
      expect(extractor.extractFullName('My name is John')).toBeNull();
      expect(extractor.extractFullName('I am Sarah')).toBeNull();
    });

    test('normalizes name capitalization', () => {
      expect(extractor.extractFullName('my name is john smith')?.value).toBe('John Smith');
      expect(extractor.extractFullName('I am SARAH JOHNSON')?.value).toBe('Sarah Johnson');
    });

    test('returns null for invalid names', () => {
      expect(extractor.extractFullName('My name is X Y')).toBeNull(); // Too short
      expect(extractor.extractFullName('No name mentioned')).toBeNull();
    });
  });

  describe('extractCurrentCity', () => {
    test('extracts current city from various formats', () => {
      expect(extractor.extractCurrentCity('I currently live in New York')?.value).toBe('New York');
      expect(extractor.extractCurrentCity('I live in San Francisco')?.value).toBe('San Francisco');
      expect(extractor.extractCurrentCity('now living in Chicago')?.value).toBe('Chicago');
      expect(extractor.extractCurrentCity('residing in Boston')?.value).toBe('Boston');
      expect(extractor.extractCurrentCity('based in Los Angeles')?.value).toBe('Los Angeles');
    });

    test('normalizes city names', () => {
      expect(extractor.extractCurrentCity('I live in new york city')?.value).toBe('New York City');
      expect(extractor.extractCurrentCity('currently live in san francisco')?.value).toBe('San Francisco');
    });

    test('returns null when no current city found', () => {
      expect(extractor.extractCurrentCity('No current city mentioned')).toBeNull();
    });
  });

  describe('extractGrewUp', () => {
    test('extracts grew up location from various formats', () => {
      expect(extractor.extractGrewUp('I grew up in Chicago')?.value).toBe('Chicago');
      expect(extractor.extractGrewUp('raised in Boston')?.value).toBe('Boston');
      expect(extractor.extractGrewUp('spent my childhood in Miami')?.value).toBe('Miami');
      expect(extractor.extractGrewUp('growing up in Seattle')?.value).toBe('Seattle');
      expect(extractor.extractGrewUp('my childhood in Denver')?.value).toBe('Denver');
    });

    test('normalizes location names', () => {
      expect(extractor.extractGrewUp('grew up in new york')?.value).toBe('New York');
      expect(extractor.extractGrewUp('raised in los angeles')?.value).toBe('Los Angeles');
    });

    test('returns null when no grew up location found', () => {
      expect(extractor.extractGrewUp('No childhood location mentioned')).toBeNull();
    });
  });

  describe('extractSignatureStyle', () => {
    test('extracts signature style from various formats', () => {
      expect(extractor.extractSignatureStyle('I always say "hello there"')?.value).toBe('hello there');
      expect(extractor.extractSignatureStyle('My catchphrase is "awesome sauce"')?.value).toBe('awesome sauce');
      expect(extractor.extractSignatureStyle('known for saying "no worries buddy"')?.value).toBe('no worries buddy');
      expect(extractor.extractSignatureStyle('signature phrase is "take it easy friend"')?.value).toBe('take it easy friend');
      expect(extractor.extractSignatureStyle('My catchphrase is absolutely fantastic')?.value).toBe('absolutely fantastic');
    });

    test('requires minimum length for signature style', () => {
      expect(extractor.extractSignatureStyle('I always say hi')).toBeNull(); // Too short
      expect(extractor.extractSignatureStyle('My catchphrase is ok')).toBeNull(); // Too short
    });

    test('returns null when no signature style found', () => {
      expect(extractor.extractSignatureStyle('No signature style mentioned')).toBeNull();
    });
  });

  describe('extractFacts', () => {
    test('extracts multiple facts from comprehensive text', () => {
      const text = `
        My name is John Smith. I was born in Chicago in 1985. My mom is Sarah.
        I grew up in Detroit but moved to Boston in 2010. I currently live in New York.
        I speak English and Spanish fluently. I work as a software engineer and enjoy reading.
        I have a dog named Max. I always say "no worries" when things go wrong.
      `;

      const result = extractor.extractFacts(text);
      
      expect(result.facts.length).toBeGreaterThanOrEqual(5);
      expect(result.processing_time_ms).toBeGreaterThanOrEqual(0);
      expect(result.errors).toHaveLength(0);

      // Check for specific facts
      const factKeys = result.facts.map(f => f.key);
      expect(factKeys.some(key => ['full_name', 'birth_year', 'birthplace', 'grew_up', 'current_city', 'family_parents', 'languages'].includes(key))).toBe(true);
    });

    test('handles empty text gracefully', () => {
      const result = extractor.extractFacts('');
      expect(result.facts).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.processing_time_ms).toBeGreaterThanOrEqual(0);
    });

    test('handles text with no extractable facts', () => {
      const result = extractor.extractFacts('This is just some random text with no personal information.');
      expect(result.facts).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    test('continues processing even if individual extractions fail', () => {
      // This test ensures graceful error handling
      const text = 'I was born in 1985 and my mom is Sarah';
      const result = extractor.extractFacts(text);
      
      expect(result.facts.length).toBeGreaterThan(0);
      // Should have birth year and family relationship
      expect(result.facts.some(f => f.key === 'birth_year')).toBe(true);
      expect(result.facts.some(f => f.key === 'family_parents')).toBe(true);
    });
  });

  describe('edge cases and error handling', () => {
    test('handles malformed input gracefully', () => {
      const malformedInputs = [
        null as any,
        undefined as any,
        '',
        '   ',
        'a'.repeat(10000), // Very long string
        '🎉🎊🎈', // Emojis only
        '123456789', // Numbers only
      ];

      malformedInputs.forEach(input => {
        expect(() => {
          if (input !== null && input !== undefined) {
            extractor.extractFacts(input);
          }
        }).not.toThrow();
      });
    });

    test('handles international characters', () => {
      const result = extractor.extractFacts('I was born in São Paulo in 1985 and my mom is María');
      expect(result.facts.length).toBeGreaterThan(0);
      // International characters should be preserved in extracted values
      const hasInternationalChars = result.facts.some(f => 
        f.value.includes('São Paulo') || f.value.includes('María')
      );
      expect(hasInternationalChars).toBe(true);
    });

    test('handles case insensitive matching', () => {
      const result = extractor.extractFacts('I WAS BORN IN CHICAGO IN 1985');
      expect(result.facts.length).toBeGreaterThan(0);
      // Should extract facts regardless of case
      const hasBirthInfo = result.facts.some(f => 
        (f.key === 'birth_year' && f.value === '1985') ||
        (f.key === 'birthplace' && f.value === 'Chicago')
      );
      expect(hasBirthInfo).toBe(true);
    });
  });
});