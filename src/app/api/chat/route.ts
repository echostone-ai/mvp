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

    // 4) Build messages array
    const messages = [
      {
        role: 'system',
        content: [
          `You are Jonathan Braden’s.`,
          `Current date: ${dateString}`,
          `Current time: ${timeString}`,
          ``,
          `Here is Jonathan’s profile to inform your responses:`,
          JSON.stringify(profile, null, 2)
        ].join('\n')
      },
      {
        role: 'user',
        content: question
      }
    ]
 
    // 5) Ask OpenAI
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      // cast to bypass the TS union requiring "name" on function messages:
      messages: messages as any,
      temperature: 0.7
    })

    const answer = resp.choices?.[0]?.message?.content ?? 'Sorry, I had no response.'

    // 6) Return
    return NextResponse.json({ answer })

  } catch (err: any) {
    console.error('[api/chat] unexpected error:', err)
    return NextResponse.json(
      { error: err.message || 'Unknown server error' },
      { status: 500 }
    )
  }
}
