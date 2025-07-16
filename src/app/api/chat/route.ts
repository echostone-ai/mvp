// src/app/api/chat/route.ts
import { NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import { pickExpressiveStyle, buildSystemPrompt, maybeAddCatchphrase, addEmotionalNuance, adaptToContext } from '@/lib/expressiveHelpersEnhanced'
import { MemoryService } from '@/lib/memoryService'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    // Accept profileData and userId in the body (from the UI)
    const { prompt, voiceId, systemPrompt: incomingSystemPrompt, profileData, userId } = await req.json()

    if (!prompt) {
      return NextResponse.json({ answer: 'Missing prompt.' }, { status: 400 })
    }

    // Validate userId if provided (for memory operations)
    if (userId && typeof userId !== 'string') {
      return NextResponse.json({ answer: 'Invalid userId format.' }, { status: 400 })
    }

    // Enhanced personality system with contextual adaptation
    let systemPrompt = incomingSystemPrompt
    let selectedStyle = 'default'
    let contextualAdaptations: any = {}
    
    if (!systemPrompt) {
      // Pick expressive style based on user input and context
      selectedStyle = pickExpressiveStyle(prompt, profileData)
      
      // Analyze context for additional personality adaptations
      contextualAdaptations = adaptToContext(prompt, profileData)
      
      // Build enhanced system prompt with emotional intelligence
      systemPrompt = buildSystemPrompt(selectedStyle, profileData)
      
      // Add contextual modifications to the prompt
      if (contextualAdaptations?.strongOpinion) {
        systemPrompt += `\n\nIMPORTANT: The user is asking about ${contextualAdaptations.strongOpinion}, which you have strong opinions about. Let your passion and authentic views show through clearly.`
      }
      
      if (contextualAdaptations?.personalConnection) {
        systemPrompt += `\n\nIMPORTANT: The user mentioned ${contextualAdaptations.mentionedFriend}, someone important in your life. Share personal details and memories about them naturally.`
      }
      
      if (contextualAdaptations?.emotionalContext) {
        systemPrompt += `\n\nIMPORTANT: The user's message has a ${contextualAdaptations.emotionalContext} emotional tone. Match their energy and respond with appropriate emotional intelligence.`
      }
    }

    // Retrieve relevant memories if userId is provided
    let relevantMemories: any[] = []
    let memoryEnhancements: string[] = []
    if (userId) {
      try {
        const memoryContext = await MemoryService.getEnhancedMemoryContext(
          prompt, 
          userId, 
          profileData,
          5
        )
        
        if (memoryContext.memories.length > 0) {
          relevantMemories = memoryContext.memories
          memoryEnhancements = memoryContext.personalityEnhancements
          
          // Integrate enhanced memory context into system prompt
          systemPrompt += memoryContext.contextPrompt
          
          // Log memory integration details for debugging
          console.log('Memory integration:', {
            memoriesFound: memoryContext.memories.length,
            enhancements: memoryContext.personalityEnhancements,
            userId: userId
          })
        }
      } catch (error) {
        // Log error but don't fail the request - graceful degradation
        console.error('Failed to retrieve memories for chat:', error)
      }
    }

    // For debugging—log the enhanced prompt details
    console.log('Enhanced Chat System:', {
      style: selectedStyle,
      adaptations: contextualAdaptations,
      promptLength: systemPrompt.length
    })

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
      temperature: 0.8, // Higher temperature for more personality variation
      max_tokens: 500, // Allow for longer, more expressive responses
    })
    
    let answer = completion.choices[0].message.content || 'I apologize, but I couldn\'t generate a response.'
    
    // Add emotional nuance based on the selected style
    answer = addEmotionalNuance(answer, selectedStyle, profileData)
    
    // Enhanced catchphrase system - more likely when excited or playful
    let catchphraseChance = 0.025 // base chance
    if (selectedStyle === 'excited' || selectedStyle === 'playful') {
      catchphraseChance = 0.08 // higher chance for energetic moods
    }
    
    if (Math.random() < catchphraseChance && profileData?.catchphrases?.length > 0) {
      const cp = profileData.catchphrases[
        Math.floor(Math.random() * profileData.catchphrases.length)
      ]
      answer = answer.endsWith('.') ? answer + ' ' + cp : answer + '. ' + cp
    }

    // Background memory processing - don't await to avoid impacting response time
    if (userId) {
      // Process memory capture in background without blocking response
      const conversationContext = `Chat conversation at ${new Date().toISOString()}`
      
      MemoryService.processAndStoreMemories(prompt, userId, conversationContext)
        .then(fragments => {
          if (fragments.length > 0) {
            console.log(`Successfully stored ${fragments.length} memory fragments for user ${userId}`)
            // Log fragment details for debugging (in development only)
            if (process.env.NODE_ENV === 'development') {
              console.log('Memory fragments:', fragments.map(f => f.fragmentText))
            }
          }
        })
        .catch(error => {
          // Log detailed error information but don't fail the request
          console.error('Background memory processing failed for user', userId, ':', error)
          
          // In development, log more details for debugging
          if (process.env.NODE_ENV === 'development') {
            console.error('Failed message:', prompt)
            console.error('Error stack:', error.stack)
          }
        })
    }

    // Return the AI answer, voiceId, and memory information for transparency
    return NextResponse.json({ 
      answer, 
      voiceId,
      memoriesUsed: relevantMemories.length > 0 ? relevantMemories.map(m => ({
        id: m.id,
        fragmentText: m.fragmentText,
        similarity: m.similarity
      })) : undefined
    })
  } catch (err) {
    console.error('Chat API error:', err)
    return NextResponse.json({ answer: 'Chat API error occurred.', error: true }, { status: 500 })
  }
}