// src/app/api/chat/route.ts
import { NextResponse } from 'next/server'
import { OpenAI }      from 'openai'
import fs              from 'fs/promises'
import path            from 'path'

const openai = new OpenAI()

export async function POST(req: Request) {
  const { question } = await req.json()

  // 1) Load Jonathan's profile JSON
  const profilePath = path.join(process.cwd(), 'public', 'jonathan_profile.json')
  const raw         = await fs.readFile(profilePath, 'utf-8')
  const profile     = JSON.parse(raw)

  // 2) Build a system prompt that:
  //    a) Feeds the entire profile
  //    b) Instructs the model to NEVER hallucinate—
  //       only respond using fields from the JSON
  //    c) Tells it exactly how to answer “first album” questions
  const systemPrompt = `
You are Jonathan Braden’s AI avatar.  Use ONLY the following profile JSON to answer, and do NOT invent any new facts:

${JSON.stringify(profile, null, 2)}

— If asked “What was your first album?” or similar, your answer MUST quote the very first entry in profile.musicJourney (the Beach Boys cassette and live Elvis recording).  
— If asked any personal question, pull the answer verbatim from the appropriate JSON field.  
— Maintain Jonathan’s warm, curious tone.  
— If you do not find the answer in the JSON, say “I’m not sure about that—let me check and get back to you.”  
`

  // 3) Send the chat request
  const chat = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system',  content: systemPrompt },
      { role: 'user',    content: question       }
    ]
  })

  return NextResponse.json({ answer: chat.choices[0].message.content })
}
