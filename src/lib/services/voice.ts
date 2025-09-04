import { sbAdmin as supabaseAdmin } from '@/lib/data/supabaseAdmin'

export async function resolveVoiceIdForAvatar(admin = supabaseAdmin as any, avatarId: string, name?: string) {
  try {
    if (admin) {
      const { data } = await admin.from('avatar_profiles').select('voice_id, name').eq('id', avatarId).single()
      if (data?.voice_id) return data.voice_id as string
    }
  } catch {
    // ignore admin lookup failures
  }
  const hardcodedJonathan = 'CO6pxVrMZfyL61ZIglyr'
  const demoVo = process.env.JONATHAN_DEMO_VOICE_ID || hardcodedJonathan
  if (name === 'jonathan_braden') return demoVo as string
  return (process.env.DEFAULT_VOICE_ID as string) || hardcodedJonathan
}


