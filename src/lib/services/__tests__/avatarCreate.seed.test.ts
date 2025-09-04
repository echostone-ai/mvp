import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mocks
const mockInsert = vi.fn()
const mockSelect = vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: null, error: null }) })) }))
const mockSelectChain = vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: 'avatar-123', name: 'howard_test', description: 'Howard Test', profile_data: {}, created_at: '2025-01-01T00:00:00Z' }, error: null }) }))
const mockFrom = vi.fn((table?: string) => {
  if (table === 'avatar_profiles') {
    return {
      select: mockSelect,
      insert: vi.fn(() => ({ select: mockSelectChain })),
      eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: null, error: null }) }))
    } as any
  }
  if (table === 'quick_facts' || table === 'fact_promotion_queue') {
    return { insert: mockInsert } as any
  }
  return { insert: mockInsert } as any
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom }))
}))

// Mock MemoryService to avoid side effects
vi.mock('@/lib/memoryService', () => ({
  MemoryService: { storeSimpleMemory: vi.fn().mockResolvedValue('m1') }
}))

// FactExtractionEngine mocked but we will rely on inline seeding count
vi.mock('@/lib/services/factExtractionEngine', () => ({
  FactExtractionEngine: vi.fn(() => ({ extractFactsWithTimeout: vi.fn().mockResolvedValue({ facts: [], processing_time_ms: 10, errors: [], stage_results: { pattern: { facts: [] }, llm: { facts: [] } }, performance_metrics: { pattern_facts_count: 0, llm_facts_count: 0, total_facts_count: 0, deduplication_removed: 0, confidence_filtered: 0 } }) }))
}))

// Mock LLMExtractor used for inline seeding to ensure >=8 facts
vi.mock('@/lib/services/llmExtractor', () => ({
  LLMExtractor: vi.fn(() => ({
    refineExtraction: vi.fn(async (_text: string) => ({
      facts: [
        { key: 'full_name', value: 'Howard Smith', confidence: 0.9, source_text: '', extraction_method: 'llm' },
        { key: 'birthdate', value: '1939-07-04', confidence: 0.9, source_text: '', extraction_method: 'llm' },
        { key: 'hometown', value: 'Jamesville, Ohio', confidence: 0.9, source_text: '', extraction_method: 'llm' },
        { key: 'settled_location', value: 'Kingsland, Texas', confidence: 0.9, source_text: '', extraction_method: 'llm' },
        { key: 'family_father_role', value: 'airman', confidence: 0.9, source_text: '', extraction_method: 'llm' },
        { key: 'service_unit_text', value: '501st', confidence: 0.9, source_text: '', extraction_method: 'llm' },
        { key: 'pet', value: 'Frank (turtle)', confidence: 0.9, source_text: '', extraction_method: 'llm' },
        { key: 'hobbies', value: 'collecting baseball cards', confidence: 0.8, source_text: '', extraction_method: 'llm' },
      ],
      processing_time_ms: 200,
      errors: [],
      llm_confidence: 0.9,
    })),
  }))
}))

describe('avatar creation inline seeding', () => {
  let POST: any
  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/avatars/route')
    POST = mod.POST
  })

  it('persists at least 8 quick facts for Howard input', async () => {
    const body = {
      slug: 'howard_test',
      display_name: 'Howard Test',
      seed_text: "I’m Howard Smith… grew up in Jamesville, Ohio. Born July 4th, 1939… daddy was an airman in the 501st… settled in Kingsland, Texas… pet turtle named Frank… collected baseball cards.",
      user_id: 'u1'
    }

    // Track inserted rows (second insert call goes to quick_facts)
    const inserted: any[] = []
    mockInsert.mockImplementation((rows: any) => { if (Array.isArray(rows)) inserted.push(...rows); return Promise.resolve({ data: rows, error: null }) })

    const req = new NextRequest('http://localhost/api/avatars', { method: 'POST', body: JSON.stringify(body) })
    const resp = await POST(req)
    const json = await resp.json()

    expect(resp.status).toBe(201)
    expect(json.extraction_results.seeded_facts_count).toBeGreaterThanOrEqual(8)
  })
})


