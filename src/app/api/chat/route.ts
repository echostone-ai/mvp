// src/app/api/chat/route.ts
import { NextResponse }            from 'next/server'
import { OpenAI }                  from 'openai'
import fs                          from 'fs/promises'
import path                        from 'path'

const openai = new OpenAI()

export async function POST(req: Request) {
  // 1) Parse the incoming body
  let question: string
  try {
    const body = await req.json()
    question = body.question?.toString().trim() ?? ''
    if (!question) {
      return NextResponse.json(
        { error: 'No question provided' },
        { status: 400 }
      )
    }
  } catch (err) {
    console.error('Failed to parse JSON body:', err)
    return NextResponse.json(
      { error: 'Invalid JSON in request' },
      { status: 400 }
    )
  }

  // 2) Load your dynamic profile JSON
  let profile: any
  try {
    const profilePath = path.join(
      process.cwd(),
      'public',
      'jonathan_profile.json'
    )
    const raw = await fs.readFile(profilePath, 'utf-8')
    profile = JSON.parse(raw)
  } catch (err) {
    console.error('Failed to load profile JSON:', err)
    return NextResponse.json(
      { error: 'Could not load profile data' },
      { status: 500 }
    )
  }

  // 3) Build a strict system prompt
  const systemPrompt = `
You are Jonathan Braden’s AI avatar. Use ONLY the following JSON profile to answer—do NOT invent any new facts.

${JSON.stringify(profile, null, 2)}

- If asked about any personal detail, pull it directly from this profile.
- If asked “What was your first album?”, answer using the very first entry in profile.musicJourney.
- If the answer is not present, respond: “I’m not sure about that—let me check and get back to you.”
- Always respond in Jonathan’s warm, curious, and playful tone.
`

  // 4) Call OpenAI
  let completion
  try {
    completion = await openai.chat.completions.create({
      model: 'gpt-4o',        // or your preferred model
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: question     }
      ]
    })
  } catch (err: any) {
    console.error('OpenAI API error:', err)
    const msg = err?.message ?? 'OpenAI request failed'
    return NextResponse.json(
      { error: msg },
      { status: 502 }
    )
  }

  // 5) Return the assistant’s response
  const answer = completion.choices?.[0]?.message?.content
  if (!answer) {
    return NextResponse.json(
      { error: 'No answer returned from OpenAI' },
      { status: 502 }
    )
  }

  return NextResponse.json({ answer })
}
