import { describe, it, expect } from 'vitest'
import { PatternExtractor } from '../patternExtractor'

describe('PatternExtractor - Howard sample', () => {
  it('extracts kinship, pets, service unit, fuzzy time, places, and birthdate/hobby', () => {
    const text = "I’m Howard Smith… grew up in Jamesville, Ohio. Born July 4th, 1939… daddy was an airman in the 501st… settled in Kingsland, Texas… pet turtle named Frank… collected baseball cards.";
    const extractor = new PatternExtractor();
    const res = extractor.extractFacts(text);
    const keys = res.facts.map(f => f.key);

    // birthdate
    const birthdate = res.facts.find(f => f.key === 'birthdate');
    expect(birthdate?.value).toBe('1939-07-04');

    // hometown and settled
    const hometown = res.facts.find(f => f.key === 'hometown');
    expect(hometown?.value).toContain('Jamesville');
    expect(hometown?.value).toContain('Ohio');

    const settled = res.facts.find(f => f.key === 'settled_location');
    expect(settled?.value).toContain('Kingsland');
    expect(settled?.value).toContain('Texas');

    // father role + unit
    const role = res.facts.find(f => f.key === 'family_father_role' || f.key === 'service_role');
    expect(role?.value).toBe('airman');
    const unit = res.facts.find(f => f.key === 'service_unit_text');
    expect(unit?.value).toBe('501st');

    // pet
    const pet = res.facts.find(f => f.key === 'pet');
    expect(pet?.value).toBe('Frank (turtle)');

    // hobby (collecting baseball cards)
    const hobby = res.facts.find(f => f.key === 'hobbies');
    expect(hobby?.value.toLowerCase()).toContain('collect');
    expect(hobby?.value.toLowerCase()).toContain('baseball');
    expect(hobby?.value.toLowerCase()).toContain('cards');
  });
});


