import { describe, it, expect, vi } from 'vitest'
import { resolveVoiceIdForAvatar } from '../voice'

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { voice_id: 'avatar-voice', name: 'x' }, error: null }) }) }) })
  }
}))

const mockAdmin = {
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { voice_id: 'avatar-voice', name: 'x' }, error: null }) }) }) })
} as any

describe('resolveVoiceIdForAvatar', () => {
  it('returns avatar_profiles.voice_id when present', async () => {
    const id = await resolveVoiceIdForAvatar(mockAdmin, 'a1')
    expect(id).toBe('avatar-voice')
  })

  it('falls back to JONATHAN_DEMO_VOICE_ID for jonathan_braden', async () => {
    const admin = {
      from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { voice_id: null, name: 'jonathan_braden' } }) }) }) })
    } as any
    process.env.JONATHAN_DEMO_VOICE_ID = 'jon-voice'
    const id = await resolveVoiceIdForAvatar(admin, 'a1', 'jonathan_braden')
    expect(id).toBe('jon-voice')
  })

  it('falls back to DEFAULT_VOICE_ID', async () => {
    const admin = {
      from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { voice_id: null, name: 'x' } }) }) }) })
    } as any
    process.env.DEFAULT_VOICE_ID = 'default-voice'
    const id = await resolveVoiceIdForAvatar(admin, 'a1')
    expect(id).toBe('default-voice')
  })
})


