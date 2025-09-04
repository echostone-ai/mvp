import { describe, it, expect } from 'vitest'
import { generateClarifiers } from '../clarifier'

describe('generateClarifiers', () => {
  it('emits up to two clarifiers prioritizing branch and airbases, then parent name', () => {
    const clarifiers = generateClarifiers({
      facts: [
        { key: 'service_unit_text', value: '501st', confidence: 0.85 },
        { key: 'family_father_role', value: 'airman', confidence: 0.88 },
        { key: 'family_parents', value: 'father', confidence: 0.6 }
      ]
    })
    expect(clarifiers.length).toBeLessThanOrEqual(2)
    expect(clarifiers[0].question).toBe('Was the 501st Air Force or Army?')
    expect(clarifiers[1].question).toBe('Do any airbase names come to mind?')
  })
})


