import { NextRequest, NextResponse } from 'next/server'
import profileData from '@/../jonathanpersonality.json'

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json()
    console.log("🔍 Got question:", question)

   const systemPrompt = `
You are Jonathan. ${profileData.personality}
Here are his memories and life highlights: ${profileData.memories.join(", ")}
Answer briefly, like a normal person having a quick conversation — 2-3 sentences max. Be warm and personal, but keep it short and natural.
`;

    console.log("🗝 Using OPENAI_API_KEY:", process.env.OPENAI_API_KEY?.slice(0,8) + "...")

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ]
      })
    });

    const text = await response.text()
    console.log("🌐 Raw OpenAI response text:", text)

    if (!text) {
      console.log("⚠️ Empty response from OpenAI.")
      return NextResponse.json({ answer: "Sorry, I didn't get a response from the brain." })
    }

    const data = JSON.parse(text)
    return NextResponse.json({ answer: data.choices?.[0]?.message?.content || "No idea how to answer that." })

  } catch (err) {
    console.error("🔥 Error in /api/chat:", err)
    return NextResponse.json({ answer: "Sorry, there was a server error. Check console logs." })
  }
}
