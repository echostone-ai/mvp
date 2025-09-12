import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LLMExtractor } from '../llmExtractor'

describe('LLMExtractor structured schema - Howard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Mock fetch
    // @ts-ignore
    global.fetch = vi.fn()
  })

  it('validates schema and nulls with mocked model response', async () => {
    const extractor = new LLMExtractor({ temperature: 0 })
    const mockJson = {
      person: { name: 'Howard Smith', birthdate: '1939-07-04' },
      places: { hometown: 'Jamesville, Ohio', settled: 'Kingsland, Texas', region: null },
      people: [{ relation: 'father', name: null, details: 'airman', unit_text: '501st', branch: null }],
      pets: [{ name: 'Frank', species: 'turtle' }],
      friends: [],
      hobbies: ['collecting baseball cards'],
      followups: [{ question: 'Was the 501st Air Force or Army?', reason: 'branch missing', priority: 1 }]
    }

    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(mockJson) } }] })
    })

    const result = await extractor.refineStructuredExtraction('dummy text')
    expect(result.errors).toHaveLength(0)
    // ensure key facts present and branch null preserved (no fact emitted for null branch)
    const keys = result.facts.map(f => f.key)
    expect(keys).toContain('birthdate')
    expect(keys).toContain('hometown')
    expect(keys).toContain('settled_location')
    expect(keys).toContain('service_unit_text')
    expect(keys).toContain('family_father_role')
    expect(result.facts.find(f => f.key === 'pet')?.value).toBe('Frank (turtle)')
  })
})


