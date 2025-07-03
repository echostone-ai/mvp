// src/app/api/chat/route.ts
import { NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import fs from 'fs/promises'
import path from 'path'

// 1) Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(req: Request) {
  try {
    // 2) Parse & validate incoming question
    const { question } = await req.json()
    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'No question provided. Please include a `question` field in your JSON.' },
        { status: 400 }
      )
    }

    // 3) Load profile JSON (falls back to empty if missing or invalid)
    let profile: any = {}
    try {
      const profilePath = path.join(process.cwd(), 'public', 'jonathan_profile.json')
      const raw = await fs.readFile(profilePath, 'utf-8')
      profile = JSON.parse(raw)
    } catch (err) {
      console.warn('[api/chat] could not load profile, using empty object:', err)
    }

    // 4) Compute current date & time for contextual awareness
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

    // 5) Build the messages array for the chat completion
    const messages = [
      {
        role: 'system',
        content: [
          `You are EchoStone, the AI avatar of Jonathan Braden.`,
          `Current date: ${dateString}`,
          `Current time: ${timeString}`,
          ``,
          `Here is Jonathan’s profile data (use this to inform tone & facts):`,
          JSON.stringify(profile, null, 2)
        ].join('\n')
      },
      {
        role: 'user',
        content: question
      }
    ]

    // 6) Call OpenAI Chat Completion
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      messages,
      temperature: 0.7
    })

    const answer = resp.choices?.[0]?.message?.content ?? 'Sorry, I had no response.'

    // 7) Return the answer
    return NextResponse.json({ answer })

  } catch (err: any) {
    console.error('[api/chat] unexpected error →', err)
    return NextResponse.json(
      { error: err.message || 'Unknown server error' },
      { status: 500 }
    )
  }
}
