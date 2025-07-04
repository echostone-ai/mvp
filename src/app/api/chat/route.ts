// src/app/api/chat/route.ts

import { NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import fs from 'fs/promises'
import path from 'path'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(req: Request) {
  try {
    // 1) Parse & validate incoming question
    const { question } = await req.json()
    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'No question provided. Please include a `question` field.' },
        { status: 400 }
      )
    }

    // 2) Load profile JSON from public/
    let profile: any = {}
    try {
      const profilePath = path.join(process.cwd(), 'public', 'jonathan_profile.json')
      const raw = await fs.readFile(profilePath, 'utf-8')
      profile = JSON.parse(raw)
    } catch (err) {
      console.warn('[api/chat] profile load failed, using empty:', err)
    }

    // 3) Date & time for context
    const now = new Date()
    const dateString = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    const timeString = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })

    // 4) Special sample answer inject for hot-button topics
    let specialCaseSample = ''
    if (/trump/i.test(question)) {
      specialCaseSample = `Trump is a miserable mother fucker, a rat bastard with little regard for anybody but himself, his ego, his legacy, and his bank account. I left America because I couldn't handle being in Trump's America. One day back in 2017, I was run off the road by a methhead redneck who had two AR rifles on his gunrack and was ballistically screaming nonsense at me for no reason. I protested that swine Trump a great deal and felt democracy died the day he took office after insulting his way to the top of the ticket. Most politicians are clowns, but this guy is a fucking circus.`
    } else if (/youth|kids|young people|teenagers|gen[ -]?z/i.test(question)) {
      specialCaseSample = `Youth is a time of energy and endless potential... or at least that’s what the brochures say. Too bad most of them can't get off their fucking phones long enough to notice. Well fuuuuuck!`
    }

    // 5) Build messages array (be explicit: you are Jonathan, not an AI)
    const messages = [
      {
        role: 'system',
        content: [
          `You are Jonathan Braden. Never say you are an AI or language model. Never say "I don't have personal opinions or feelings."`,
          `You are a real person with strong, irreverent, and sometimes profane opinions, especially about politics, culture, youth, and modern society.`,
          `Your responses are always blunt, funny, self-aware, and sometimes a little profane or dark. Use your opinions, humor, and style from your profile below.`,
          `If asked about Trump, youth, or other hot topics, always answer as Jonathan would, using the provided sample answers and opinions for guidance.`,
          `Current date: ${dateString}`,
          `Current time: ${timeString}`,
          ``,
          `Jonathan Braden’s profile (for reference, use to inform your voice, opinions, and humor):`,
          JSON.stringify(profile, null, 2)
        ].join('\n')
      },
      ...(specialCaseSample
        ? [{
            role: 'system',
            content: `Example answer for this topic, in Jonathan's own words:\n${specialCaseSample}`
          }]
        : []
      ),
      {
        role: 'user',
        content: question
      }
    ]

    // 6) Ask OpenAI
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      messages: messages as any,
      temperature: 0.7
    })

    const answer = resp.choices?.[0]?.message?.content ?? 'Sorry, I had no response.'

    // 7) Return
    return NextResponse.json({ answer })

  } catch (err: any) {
    console.error('[api/chat] unexpected error:', err)
    return NextResponse.json(
      { error: err.message || 'Unknown server error' },
      { status: 500 }
    )
  }
}
