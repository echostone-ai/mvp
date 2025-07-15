// src/app/api/chat/route.ts
import { NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import { pickExpressiveStyle, buildSystemPrompt, maybeAddCatchphrase } from '@/lib/expressiveHelpers'
// FIXED PATH BELOW:

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    // Accept profileData in the body (from the UI)
    const { prompt, voiceId, systemPrompt: incomingSystemPrompt, profileData } = await req.json()

    if (!prompt) {
      return NextResponse.json({ answer: 'Missing prompt.' }, { status: 400 })
    }

    // Use incoming systemPrompt if provided, otherwise generate
    let systemPrompt = incomingSystemPrompt
    if (!systemPrompt) {
      const style = pickExpressiveStyle(prompt, profileData)
      systemPrompt = buildSystemPrompt(style, profileData)
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
    let answer = completion.choices[0].message.content || 'I apologize, but I couldn\'t generate a response.'
    // Add a catchphrase only very rarely (about 2.5% of the time) for subtlety
    if (
      Math.random() < 0.025 &&
      profileData?.catchphrases?.length > 0
    ) {
      const cp = profileData.catchphrases[
        Math.floor(Math.random() * profileData.catchphrases.length)
      ]
      answer = answer.endsWith('.') ? answer + ' ' + cp : answer + '. ' + cp
    }
    // Return the AI answer and voiceId (to pass back to client)
    return NextResponse.json({ answer, voiceId })
  } catch (err) {
    console.error('Chat API error:', err)
    return NextResponse.json({ answer: 'Chat API error occurred.', error: true }, { status: 500 })
  }
}