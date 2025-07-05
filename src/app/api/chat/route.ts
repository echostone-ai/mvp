// src/app/api/chat/route.ts

// Ensure Node.js runtime for fs access
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import fs from 'fs/promises'
import path from 'path'

// Initialize OpenAI client with environment key
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: Request) {
  try {
    // 1) Parse incoming payload and provide defaults
    const body = await req.json()
    const question = typeof body.question === 'string' ? body.question : null
    let history: Array<{ role: string; content: string }> = []
    if (Array.isArray(body.history)) {
      history = body.history.filter(
        (turn: any) => ['user', 'assistant', 'system'].includes(turn.role) && typeof turn.content === 'string'
      )
    }
    if (!question) {
      return NextResponse.json(
        { error: 'Invalid request: must include `question` (string).' },
        { status: 400 }
      )
    }

    // 2) Load profile JSON
    let profile: any = { name: 'Jonathan Braden', personality: '', languageStyle: {}, humorStyle: {}, catchphrases: [] }
    try {
      const profilePath = path.join(process.cwd(), 'public', 'jonathan_profile.json')
      const raw = await fs.readFile(profilePath, 'utf-8')
      profile = JSON.parse(raw)
    } catch (err) {
      console.warn('[api/chat] could not load profile, using defaults:', err)
    }

    // 3) Compute current date & time
    const now = new Date()
    const dateString = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const timeString = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

    // 4) Prepare style elements from profile
    const persona = profile.personality || 'Adventurous, empathetic soul with a passion for history.'
    const langStyleDesc = profile.languageStyle?.description || 'Raw, expressive language with occasional profanity for emphasis.'
    const swearingExamples = Array.isArray(profile.languageStyle?.swearingExamples)
      ? profile.languageStyle.swearingExamples.join('; ') : ''
    const sarcasmExamples = Array.isArray(profile.languageStyle?.sarcasticExpressions)
      ? profile.languageStyle.sarcasticExpressions.join('; ') : ''
    const humorDesc = profile.humorStyle?.description || 'Sharp, quick sarcasm balanced with warmth.'
    const catchphrases = Array.isArray(profile.catchphrases)
      ? profile.catchphrases.join('; ') : ''

    // 5) Build system prompt lines
    const systemLines = [
      `You are ${profile.name}.`,
      `Persona: ${persona}`,
      `Language Style: ${langStyleDesc}`,
      swearingExamples && `Swearing Examples: ${swearingExamples}`,
      sarcasmExamples && `Sarcasm Expressions: ${sarcasmExamples}`,
      `Humor Style: ${humorDesc}`,
      catchphrases && `Catchphrases: ${catchphrases}`,
      `Speak with irreverent humor, playful sarcasm, occasional profanity for emphasis, and Canadian politeness.`,
      `Current date: ${dateString}`,
      `Current time: ${timeString}`,
      ``,
      `Jonathan’s full profile (JSON):`,
      JSON.stringify(profile, null, 2)
    ].filter(Boolean).join('\n')

    // 6) Assemble messages with history
    const messages = [
      { role: 'system', content: systemLines },
      ...history.map(turn => ({ role: turn.role, content: turn.content })),
      { role: 'user', content: question }
    ]

    // 7) Query OpenAI
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      messages,
      temperature: 0.7
    })
    const answer = resp.choices?.[0]?.message?.content ?? 'Sorry, I had no response.'

    // 8) Return the assistant's reply
    return NextResponse.json({ answer })
  } catch (err: any) {
    console.error('[api/chat] unexpected error:', err)
    return NextResponse.json(
      { error: err.message || 'Unknown server error' },
      { status: 500 }
    )
  }
}