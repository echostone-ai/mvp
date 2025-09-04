import { createClient, SupabaseClient } from '@supabase/supabase-js'
import path from 'path'
import fs from 'fs'

type SeedResult = {
  avatarId: string
  avatarTable: 'avatar_profiles' | 'avatars'
  createdAvatar: boolean
  updatedVoice: boolean
  factsUpserted: number
  factsKeys: string[]
  factsAttempted: number
  attemptedPreview: Array<{ key: string; value: string }>
  sourceUsed: 'manual'
}

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

function normalizeBirthDate(input: string | undefined): string | undefined {
  if (!input) return undefined
  try {
    const d = new Date(input)
    if (Number.isNaN(d.getTime())) return undefined
    return d.toISOString().slice(0, 10)
  } catch {
    return undefined
  }
}

export async function seedAvatarFromProfile(slug: string = 'jonathan_braden'): Promise<SeedResult> {
  const supabase = getServiceClient()

  // Load profile JSON
  const jsonPath = path.resolve(process.cwd(), 'src/data/jonathan_profile.json')
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Profile JSON not found at ${jsonPath}`)
  }
  const profile = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as any

  // Always ensure and use avatar_profiles (project schema)
  let avatarId: string | null = null
  let avatarTable: 'avatar_profiles' | 'avatars' = 'avatar_profiles'
  let createdAvatar = false
  let updatedVoice = false

  const { data: existing } = await supabase
    .from('avatar_profiles')
    .select('id, voice_id, profile_data')
    .eq('name', slug)
    .single()

  const voiceFromEnv = process.env.JONATHAN_DEMO_VOICE_ID || process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || null

  if (!existing) {
    const insertPayload: any = {
      name: slug,
      description: 'Seeded from profile JSON',
      profile_data: profile,
      voice_id: voiceFromEnv
    }
    const { data: ins, error: insErr } = await supabase
      .from('avatar_profiles')
      .insert(insertPayload)
      .select('id')
      .single()
    if (insErr) throw insErr
    avatarId = ins.id
    createdAvatar = true
  } else {
    avatarId = existing.id
    if (voiceFromEnv && existing.voice_id !== voiceFromEnv) {
      const { error: upErr } = await supabase
        .from('avatar_profiles')
        .update({ voice_id: voiceFromEnv })
        .eq('id', existing.id)
      if (upErr) throw upErr
      updatedVoice = true
    }
    // Optionally store profile json
    if (!existing.profile_data) {
      await supabase.from('avatar_profiles').update({ profile_data: profile }).eq('id', existing.id)
    }
  }

  if (!avatarId) throw new Error('Failed to resolve avatarId')

  // Map profile to quick_facts
  const facts: Array<any> = []
  const pushFact = (key: string, value: string | undefined, priority: number) => {
    if (!value) return
    facts.push({
      avatar_id: avatarId,
      key,
      value,
      confidence: 0.9,
      priority,
      source: 'manual',
      source_reference: 'json:jonathan_profile'
    })
  }

  pushFact('full_name', profile.full_name, 1)
  pushFact('nickname', profile.nickname, 2)
  pushFact('birth_date', normalizeBirthDate(profile.birthday), 1)
  pushFact('birth_place', profile.birth_place || profile.birthplace, 1)

  // Derived name components
  if (typeof profile.full_name === 'string') {
    const parts = (profile.full_name as string).trim().split(/\s+/)
    if (parts.length > 0) pushFact('name_first', parts[0], 1)
    if (parts.length > 1) pushFact('name_last', parts[parts.length - 1], 1)
  }

  // Derived nickname primary (first token before comma)
  if (typeof profile.nickname === 'string') {
    const primaryNick = (profile.nickname as string).split(',')[0].trim()
    if (primaryNick) pushFact('nickname_primary', primaryNick, 2)
  }

  const places = Array.isArray(profile.places_lived) ? profile.places_lived as string[] : []
  places.forEach((place, idx) => {
    const pr = idx === 0 ? 2 : 3
    pushFact(`places_lived_${idx}`, place, pr)
  })

  if (places.length > 0) {
    pushFact('home_base', places[0], 2)
    pushFact('current_location', places[places.length - 1], 3)
    pushFact('places_count', String(places.length), 3)
  }

  pushFact('speaking_style', profile.speaking_style, 4)
  pushFact('personality', profile.personality, 5)

  // Partner / family
  pushFact('partner_name', profile.partner_name, 2)
  pushFact('father_name', profile.father_name, 3)
  pushFact('mother_name', profile.mother_name, 3)

  // Pets
  if (profile.pets && Array.isArray(profile.pets)) {
    for (const p of profile.pets) {
      pushFact('pet_name', p.name, 2)
      pushFact('pet_type', p.type, 3)
    }
  } else if (profile.pet_name || profile.pet_type) {
    pushFact('pet_name', profile.pet_name, 2)
    pushFact('pet_type', profile.pet_type, 3)
  }

  // Service
  pushFact('service_unit', profile.service_unit, 3)
  pushFact('service_branch', profile.service_branch, 3)
  pushFact('service_role', profile.service_role, 3)

  // Hobbies/favorites
  if (Array.isArray(profile.hobbies)) {
    pushFact('hobbies', profile.hobbies.join(', '), 4)
  }
  pushFact('hobby_collecting_baseball_cards', profile.hobby_collecting_baseball_cards, 5)
  pushFact('favorite_food', profile.favorite_food, 4)

  // Derived age from birthday
  const birthDateIso = normalizeBirthDate(profile.birthday)
  if (birthDateIso) {
    const today = new Date()
    const bd = new Date(birthDateIso)
    let age = today.getFullYear() - bd.getFullYear()
    const m = today.getMonth() - bd.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) {
      age -= 1
    }
    if (!Number.isNaN(age)) {
      pushFact('age', String(age), 2)
    }
  }

  // Upsert facts
  let factsUpserted = 0
  if (facts.length > 0) {
    const { data: upData, error: upErr } = await (supabase as any)
      .from('quick_facts')
      .upsert(facts, { onConflict: 'avatar_id,key' })
      .select('id')
    if (upErr) throw upErr
    factsUpserted = Array.isArray(upData) ? upData.length : 0
  }

  return {
    avatarId,
    avatarTable,
    createdAvatar,
    updatedVoice,
    factsUpserted,
    factsKeys: facts.map(f => f.key),
    factsAttempted: facts.length,
    attemptedPreview: facts.slice(0, 10).map((f: any) => ({ key: f.key, value: f.value })),
    sourceUsed: 'manual'
  }
}

export default seedAvatarFromProfile


