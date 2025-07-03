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
      return NextResponse.json({ error: 'No question provided' }, { status: 400 })
    }

    // 3) Load profile JSON (replace 'jonathan_profile.json' as needed)
    let profile = {}
    try {
      const profilePath = path.join(process.cwd(), 'public', 'jonathan_profile.json')
      const raw = await fs.readFile(profilePath, 'utf-8')
      profile = JSON.parse(raw)
    } catch (err) {
      console.warn('[chat] could not load profile, using empty:', err)
    }

    // 4) Compute current date & time
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

    // 5) Build messages array
    const messages = [
      {
        role: 'system',
        content: [
          `You are Jonathan Braden, an AI speaking as Jonathan.`,
          `Current date: ${dateString}`,
          `Current time: ${timeString}`,
          ``,
          `Here is Jonathan’s profile data:`,
          JSON.stringify(profile, null, 2)
        ].join('\n')
      },
      {
        role: 'user',
        content: question
      }
    ]

    // 6) Ask OpenAI for a completion
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-2024-08-06',    // or your preferred model
      messages
    })

    const answer = resp.choices?.[0]?.message?.content ?? 'Sorry, I had no response.'

    // 7) Return JSON
    return NextResponse.json({ answer })

  } catch (err: any) {
    console.error('[chat] error', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
