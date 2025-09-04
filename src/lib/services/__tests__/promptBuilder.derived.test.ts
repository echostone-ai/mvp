import { describe, it, expect, vi } from 'vitest'
import { PromptBuilder, QuickFact } from '../promptBuilder'

describe('PromptBuilder derived facts', () => {
  it('injects [derived] entries when quick_facts missing but memories contain info', async () => {
    const pb = new PromptBuilder()
    vi.spyOn(pb, 'fetchQuickFacts').mockResolvedValue([])
    vi.spyOn(pb, 'fetchStyleProfile').mockResolvedValue({})
    vi.spyOn(pb, 'fetchRelevantMemories').mockResolvedValue([
      { id: 'm1', fragment_text: 'My daddy was an airman in the 501st.', created_at: new Date().toISOString() },
      { id: 'm2', fragment_text: 'Our pet turtle named Frank.', created_at: new Date().toISOString() }
    ] as any)

    const prompt = await pb.buildPrompt({ avatarId: 'a1', conversationSnippet: '', userQuery: 'Tell me about family', memoryLimit: 6, maxFacts: 10 })
    expect(prompt).toContain('derived')
    expect(prompt).toMatch(/pet: .*Frank.*\[derived\]/i)
    expect(prompt.toLowerCase()).toContain('airman')
  })
})


