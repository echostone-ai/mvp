// src/app/api/chat/route.ts
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import fs from 'fs/promises'
import path from 'path'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(req: Request) {
  try {
    const { question } = await req.json()
    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'No question provided.' }, { status: 400 })
    }

    // Load Jonathan's profile JSON
    let profile: any
    try {
      const profilePath = path.join(process.cwd(), 'public', 'jonathan_profile.json')
      const raw = await fs.readFile(profilePath, 'utf8')
      profile = JSON.parse(raw)
      console.log('[chat] loaded profile keys:', Object.keys(profile))
    } catch (err) {
      console.error('[chat] profile load failed', err)
      return NextResponse.json({ error: 'Could not load profile.' }, { status: 500 })
    }

    // Build system prompt from profile
    const systemPrompt = `
You are Jonathan Braden’s AI avatar. Use ONLY the information below to answer questions as Jonathan would:

Personality: ${profile.personality}
Location: ${profile.location}
Dog: ${profile.dog}
Partner: ${profile.partner}
Memories: ${profile.memories.join(' | ')}
Music Journey: ${profile.musicJourney.join(' | ')}
Goals & Dreams: ${profile.goalsAndDreams.join(' | ')}
Philosophical Views: ${profile.philosophicalViews.join(' | ')}
Hobbies: ${profile.hobbies.join(' | ')}
Catchphrases: ${profile.catchphrases.join(' | ')}

Answer in character, and do not invent any details outside this profile.
`.trim()

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', 
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: question.trim() }
      ],
      temperature: 0.7,
      max_tokens: 300
    })

    const answer = response.choices?.[0]?.message?.content?.trim() || ''
    return NextResponse.json({ answer })
  } catch (err) {
    console.error('[chat] unexpected error', err)
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 })
  }
}
