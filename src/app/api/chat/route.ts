export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import fs from 'fs/promises'
import path from 'path'

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: Request) {
  try {
    // 1) Parse incoming payload
    const { question, history } = await req.json()
    if (typeof question !== 'string') {
      return NextResponse.json({ error: 'Invalid request: `question` is required.' },
      { status: 400 })
    }

    // Sanitize history
    const safeHistory = Array.isArray(history)
      ? history.filter((turn: any) =>
          ['system', 'user', 'assistant'].includes(turn.role) &&
          typeof turn.content === 'string')
      : []

    // 2) Load profile JSON
    let profile: any = {
      name: 'Jonathan Braden',
      personality: '',
      languageStyle: {},
      humorStyle: {},
      catchphrases: []
    }
    try {
      const raw = await fs.readFile(path.join(process.cwd(), 'public', 'jonathan_profile.json'),
      'utf-8')
      profile = JSON.parse(raw)
    } catch (e) {
      console.warn('[api/chat] Failed to load profile, using defaults', e)
    }

    // 3) Build system prompt
    const now = new Date()
    const systemPrompt = [
      `You are ${profile.name}. Persona: ${profile.personality}`,
      `Language: ${profile.languageStyle?.description || ''}`,
      `Humor: ${profile.humorStyle?.description || ''}`,
      `Catchphrases: ${profile.catchphrases?.join('; ') || ''}`,
      `Speak with wit, sarcasm, occasional profanity, and warmth.`,
      `Current date: ${now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}`,
      `Current time: ${now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })}`,
      `Full profile JSON:`,
      JSON.stringify(profile, null, 2)
    ].join('\n')

    // 4) Assemble message list
    const messages = [
      { role: 'system', content: systemPrompt },
      ...safeHistory,
      { role: 'user', content: question }
    ]

    // 5) Query OpenAI
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      messages: messages as any,
      temperature: 0.7
    })
    const answer = resp.choices?.[0]?.message?.content ?? ''

    // 6) Respond
    return NextResponse.json({ answer })
  } catch (err: any) {
    console.error('[api/chat] Error:', err)
    return NextResponse.json({ error: err.message },
    { status: 500 })
  }
}