import { describe, it, expect, vi } from 'vitest'
import { PromptBuilder } from '../promptBuilder'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn()
  }
}))

describe('PromptBuilder family/service-aware search', () => {
  it('retrieves brother memory when asking about family', async () => {
    const mockLimit = vi.fn().mockResolvedValue({ data: [
      { id: 'f1', fragment_text: 'My brother Alan taught me chess.', created_at: '2024-01-01T00:00:00Z', conversation_context: { raw: 'family story' } }
    ], error: null })
    const mockOrder = vi.fn(() => ({ limit: mockLimit }))
    const mockOr2 = vi.fn(() => ({ order: mockOrder }))
    const mockOr1 = vi.fn(() => ({ or: mockOr2 }))
    const mockEq = vi.fn(() => ({ or: mockOr1 }))
    const mockSelect = vi.fn(() => ({ eq: mockEq }))
    const mockFrom = { select: mockSelect }

    ;(supabase.from as any).mockReturnValueOnce(mockFrom)
    const pb = new PromptBuilder()
    vi.spyOn(pb as any, 'getAvatarSlugById').mockResolvedValue(null)
    const mems = await pb.fetchRelevantMemories('a1', 'who is your family?')
    expect(mems.length).toBe(1)
    expect(mems[0].fragment_text).toContain('brother')
  })
})


