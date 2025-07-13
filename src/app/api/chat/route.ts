// src/app/api/chat/route.ts
import { NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import { pickExpressiveStyle, buildSystemPrompt, maybeAddCatchphrase } from '@/lib/expressiveHelpers'
// FIXED PATH BELOW:
import jonathanProfile from '@/data/jonathan_profile.json'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    // Accept systemPrompt as well, for more flexibility
    const { prompt, voiceId, systemPrompt: incomingSystemPrompt } = await req.json()

    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
    }

    // Use incoming systemPrompt if provided, otherwise generate
    let systemPrompt = incomingSystemPrompt
    if (!systemPrompt) {
      const style = pickExpressiveStyle(prompt)
      systemPrompt = buildSystemPrompt(style)
    }

    // For debugging—log the systemPrompt so you can see it in Vercel/console
    console.log('systemPrompt:', systemPrompt)

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // or 'gpt-4o' for best results
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    })
    let answer = completion.choices[0].message.content
    // Add a catchphrase only very rarely (about 2.5% of the time) for subtlety
    if (Math.random() < 0.025 && jonathanProfile.catchphrases.length > 0) {
      const cp = jonathanProfile.catchphrases[
        Math.floor(Math.random() * jonathanProfile.catchphrases.length)
      ]
      answer = answer.endsWith('.') ? answer + ' ' + cp : answer + '. ' + cp
    }
    // Return the AI answer and voiceId (to pass back to client)
    return NextResponse.json({ answer, voiceId })
  } catch (err) {
    console.error('Chat API error:', err)
    return NextResponse.json({ error: 'Chat API error' }, { status: 500 })
  }
}