export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import fs from 'fs/promises'
import path from 'path'

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: Request) {
  try {
    // 1) Parse incoming payload
    const { 
      question, 
      prompt, 
      history, 
      profileData, 
      visitorName, 
      isSharedAvatar,
      shareToken,
      userId,
      avatarId
    } = await req.json()
    
    // Support both the old and new API formats
    const userQuestion = question || prompt
    
    if (typeof userQuestion !== 'string') {
      return NextResponse.json({ error: 'Invalid request: `question` or `prompt` is required.' },
      { status: 400 })
    }

    // Sanitize history
    const safeHistory = Array.isArray(history)
      ? history.filter((turn: any) =>
          ['system', 'user', 'assistant'].includes(turn.role) &&
          typeof turn.content === 'string')
      : []

    // 2) Load profile JSON
    let profile: any = {
      name: 'Jonathan Braden',
      personality: '',
      languageStyle: {},
      humorStyle: {},
      catchphrases: []
    }
    
    // Use provided profileData if available
    if (profileData) {
      profile = profileData;
    } else {
      try {
        const raw = await fs.readFile(path.join(process.cwd(), 'public', 'jonathan_profile.json'),
        'utf-8')
        profile = JSON.parse(raw)
      } catch (e) {
        console.warn('[api/chat] Failed to load profile, using defaults', e)
      }
    }

    // 3) Build system prompt
    const now = new Date()
    
    // Add visitor name context for shared avatars
    const visitorContext = visitorName 
      ? `\nYou are talking to ${visitorName}. Address them by name occasionally in a natural way. Make them feel welcome and remembered.` 
      : '';
      
    // Add memory isolation context for shared avatars
    const memoryContext = isSharedAvatar 
      ? `\nIMPORTANT: This is a shared avatar session. You are being shared with multiple people, but each person has their own private conversation with you. The current conversation is with ${visitorName || 'a visitor'}. Your memories with this person are isolated from your memories with other people. You must maintain your identity as ${profile.name} with this specific personality and voice.` 
      : '';
    
    const systemPrompt = [
      `You are ${profile.name}. Persona: ${profile.personality}`,
      `Language: ${profile.languageStyle?.description || ''}`,
      `Humor: ${profile.humorStyle?.description || ''}`,
      `Catchphrases: ${profile.catchphrases?.join('; ') || ''}`,
      `Speak with wit, sarcasm, occasional profanity, and warmth.`,
      `Current date: ${now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}`,
      `Current time: ${now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })}`,
      visitorContext,
      memoryContext,
      `Full profile JSON:`,
      JSON.stringify(profile, null, 2)
    ].filter(Boolean).join('\n')

    // 4) Assemble message list
    const messages = [
      { role: 'system', content: systemPrompt },
      ...safeHistory,
      { role: 'user', content: userQuestion }
    ]

    // 5) Query OpenAI
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      messages: messages as any,
      temperature: 0.7
    })
    const answer = resp.choices?.[0]?.message?.content ?? ''

    // 6) Respond
    return NextResponse.json({ answer })
  } catch (err: any) {
    console.error('[api/chat] Error:', err)
    return NextResponse.json({ error: err.message },
    { status: 500 })
  }
}