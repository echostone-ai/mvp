// src/app/api/chat/route.ts
import { NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import { pickExpressiveStyle, buildSystemPrompt, maybeAddCatchphrase, addEmotionalNuance, adaptToContext } from '@/lib/expressiveHelpersEnhanced'
import { MemoryService } from '@/lib/memoryService'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

// Disable edge runtime for memory system compatibility
// export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    // Accept profileData, userId and avatarId in the body (from the UI)
    const { prompt, voiceId, systemPrompt: incomingSystemPrompt, profileData, userId, avatarId, partnerProfile } = await req.json()

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
      // Analyze context for additional personality adaptations, now with partnerProfile
      contextualAdaptations = adaptToContext(prompt, profileData, partnerProfile)
      // Build enhanced system prompt with emotional intelligence and partner context
      systemPrompt = buildSystemPrompt(selectedStyle, profileData, partnerProfile)
      // Add contextual modifications to the prompt
      if (contextualAdaptations?.strongOpinion) {
        systemPrompt += `\n\nIMPORTANT: The user is asking about ${contextualAdaptations.strongOpinion}, which you have strong opinions about. Let your passion and authentic views show through clearly.`
      }
      if (contextualAdaptations?.personalConnection) {
        const relationshipType = contextualAdaptations.relationshipType || 'friend';
        const friendDetails = contextualAdaptations.friendDetails;
        let personalInfo = `The user mentioned ${contextualAdaptations.mentionedFriend}, your ${relationshipType}.`;
        
        if (friendDetails) {
          if (friendDetails.traits) personalInfo += ` They are ${friendDetails.traits.join(', ')}.`;
          if (friendDetails.profession) personalInfo += ` They work as a ${friendDetails.profession}.`;
          if (friendDetails.location) personalInfo += ` They live in ${friendDetails.location}.`;
          if (friendDetails.origin) personalInfo += ` They are from ${friendDetails.origin}.`;
          if (friendDetails.age) personalInfo += ` They are ${friendDetails.age} years old.`;
          if (friendDetails.partner) {
            const partnerName = friendDetails.partner.name || friendDetails.partner;
            const partnerOrigin = friendDetails.partner.origin ? ` from ${friendDetails.partner.origin}` : '';
            personalInfo += ` Their partner is ${partnerName}${partnerOrigin}.`;
          }
          if (friendDetails.memoriesWithJonathan) personalInfo += ` You have these memories together: ${friendDetails.memoriesWithJonathan.join('; ')}.`;
          if (friendDetails.ageDifference) personalInfo += ` They are ${friendDetails.ageDifference}.`;
          if (friendDetails.children) personalInfo += ` They have children: ${friendDetails.children.join(', ')}.`;
        }
        
        systemPrompt += `\n\nIMPORTANT: ${personalInfo} Share personal details, memories, and your relationship with them naturally. Be warm and specific about your connection.`
      }
      if (contextualAdaptations?.emotionalContext) {
        systemPrompt += `\n\nIMPORTANT: The user's message has a ${contextualAdaptations.emotionalContext} emotional tone. Match their energy and respond with appropriate emotional intelligence.`
      }
      if (contextualAdaptations?.partnerRelationship) {
        systemPrompt += `\n\nIMPORTANT: The user is your ${contextualAdaptations.partnerRelationship}. Respond with the appropriate familiarity and warmth.`
      }
      if (contextualAdaptations?.partnerSharedMemories) {
        systemPrompt += `\n\nIMPORTANT: You share these memories with the user: ${contextualAdaptations.partnerSharedMemories.join('; ')}. Reference them naturally if relevant.`
      }
    }

    // Retrieve relevant memories if userId is provided
    let relevantMemories: any[] = []
    let memoryEnhancements: string[] = []
    let hasMemorySystem = false
    
    if (userId) {
      try {
        // Use avatar-specific memories if avatarId is provided
        let memoryContext;
        
        if (avatarId) {
          // Import the quick fix for avatar memory isolation
          const { getAvatarSpecificMemories } = await import('@/lib/memoryServiceQuickFix');
          
          // Get avatar-specific memories
          memoryContext = await getAvatarSpecificMemories(
            prompt,
            userId,
            avatarId,
            10 // Get up to 10 memories
          );
        } else {
          // Use the standard memory service for non-avatar chats
          memoryContext = await MemoryService.getEnhancedMemoryContext(
            prompt, 
            userId, 
            profileData,
            10 // Increased from 5 to get more memories
          );
        }
        
        hasMemorySystem = true
        
        if (memoryContext.memories.length > 0) {
          relevantMemories = memoryContext.memories
          memoryEnhancements = memoryContext.personalityEnhancements
          
          // Integrate enhanced memory context into system prompt with higher priority
          systemPrompt = memoryContext.contextPrompt + "\n\n" + systemPrompt
          
          // Add explicit instruction to use memories
          systemPrompt += `\n\nCRITICAL MEMORY INSTRUCTION:
- You MUST actively reference the user's memories in your responses
- Show that you remember details they've shared with you before
- Use phrases like "As you mentioned before..." or "I remember you told me about..."
- If they ask about something related to their memories, confidently recall those details
- This creates continuity in your relationship and builds trust`
          
          // Log memory integration details for debugging
          console.log('Memory integration:', {
            memoriesFound: memoryContext.memories.length,
            enhancements: memoryContext.personalityEnhancements,
            userId: userId
          })
        } else {
          // No memories found - add instruction to be honest about not remembering
          systemPrompt += `\n\nIMPORTANT MEMORY GUIDANCE:
- You currently have no stored memories about this user's personal experiences
- If they ask about past conversations, trips, experiences, or personal details, be completely honest that you don't have those memories stored yet
- NEVER make up or invent details about their experiences - this is crucial for trust
- Instead of guessing or creating fictional details, say things like:
  * "I don't have any memories about your trip to Cape Cod yet. Could you tell me about it so I can remember it for future conversations?"
  * "I haven't stored any details about that experience yet. What would you like me to remember about it?"
  * "I don't recall that conversation - could you share those details again so I can learn and remember them?"
- Always ask follow-up questions to gather specific details you can commit to memory
- Be curious and encouraging about learning more about their experiences
- Focus on building accurate memories rather than appearing to already know things`
        }
      } catch (error) {
        // Log error but don't fail the request - graceful degradation
        console.error('Failed to retrieve memories for chat:', error)
        hasMemorySystem = false
        
        // Add instruction for when memory system is not working
        systemPrompt += `\n\nIMPORTANT MEMORY GUIDANCE:
- Your memory system is currently not available due to a technical issue
- If they ask about past conversations, trips, experiences, or personal details, be completely honest that you don't have access to those memories right now
- NEVER make up or invent details about their experiences - this is crucial for trust
- Instead of guessing, say things like:
  * "I don't have access to my memory system right now, so I can't recall details about your trip to Cape Cod. Could you tell me about it?"
  * "My memory isn't working at the moment - could you share those details again so I can help you better in this conversation?"
  * "I'm having trouble accessing stored memories right now. What would you like to tell me about that experience?"
- Be honest about the technical limitation while still being helpful
- Ask users to share details that will help in the current conversation`
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
      
      // Add detailed logging for debugging
      console.log('🧠 Starting memory processing for user:', userId)
      console.log('🧠 User ID type:', typeof userId)
      console.log('🧠 User ID length:', userId.length)
      console.log('🧠 Message:', prompt.substring(0, 100) + '...')
      console.log('🧠 Has memory system:', hasMemorySystem)
      console.log('🧠 Relevant memories found:', relevantMemories.length)
      
      // Process user message with avatar isolation if avatarId is provided
      if (avatarId) {
        // Import the quick fix for avatar memory isolation
        const { storeMemoryFragmentWithAvatarIsolation } = await import('@/lib/memoryServiceQuickFix');
        
        // Extract and store memories with avatar isolation
        fetch('/api/extract-memories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: prompt,
            userId,
            avatarId,
            context: {
              timestamp: new Date().toISOString(),
              messageContext: 'User message in chat',
              emotionalTone: selectedStyle
            }
          })
        }).catch(error => {
          console.error('❌ Avatar memory extraction failed:', error);
        });
      } else {
        // Use standard memory service for non-avatar chats
        MemoryService.processAndStoreMemories(prompt, userId, {
          timestamp: new Date().toISOString(),
          messageContext: 'User message in chat',
          emotionalTone: selectedStyle
        }, 0.6)
          .then(fragments => {
            if (fragments.length > 0) {
              console.log(`✅ Stored ${fragments.length} memory fragments from user message`)
              // Log fragment details for debugging (in development only)
              if (process.env.NODE_ENV === 'development') {
                console.log('User memory fragments:', fragments.map(f => f.fragmentText))
              }
            }
          })
          .catch(error => {
            console.error('❌ User memory processing failed:', error)
          });
      }
      
      // Process AI response with avatar isolation if avatarId is provided
      if (avatarId) {
        // Extract and store memories with avatar isolation
        fetch('/api/extract-memories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: answer,
            userId,
            avatarId,
            context: {
              timestamp: new Date().toISOString(),
              messageContext: 'AI response in chat',
              emotionalTone: selectedStyle
            }
          })
        }).catch(error => {
          console.error('❌ Avatar memory extraction failed:', error);
        });
      } else {
        // Use standard memory service for non-avatar chats
        MemoryService.processAndStoreMemories(answer, userId, {
          timestamp: new Date().toISOString(),
          messageContext: 'AI response in chat',
          emotionalTone: selectedStyle
        }, 0.6)
          .then(fragments => {
            if (fragments.length > 0) {
              console.log(`✅ Stored ${fragments.length} memory fragments from AI response`)
              if (process.env.NODE_ENV === 'development') {
                console.log('AI memory fragments:', fragments.map(f => f.fragmentText))
              }
            }
          })
          .catch(error => {
            console.error('❌ AI memory processing failed:', error)
          });
      }
        
      // Process combined summary with avatar isolation if avatarId is provided
      if (avatarId) {
        // Extract and store memories with avatar isolation
        fetch('/api/extract-memories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `USER QUERY: ${prompt}\nAI RESPONSE: ${answer}`,
            userId,
            avatarId,
            context: {
              timestamp: new Date().toISOString(),
              messageContext: 'Conversation exchange',
              emotionalTone: 'reflective'
            }
          })
        }).catch(error => {
          console.error('❌ Avatar memory extraction failed:', error);
        });
      } else {
        // Use standard memory service for non-avatar chats
        MemoryService.processAndStoreMemories(
          `USER QUERY: ${prompt}\nAI RESPONSE: ${answer}`, 
          userId, 
          {
            timestamp: new Date().toISOString(),
            messageContext: 'Conversation exchange',
            emotionalTone: 'reflective'
          },
          0.7
        )
      }
        .then(fragments => {
          if (fragments.length > 0) {
            console.log(`✅ Stored ${fragments.length} memory fragments from conversation exchange`)
            if (process.env.NODE_ENV === 'development') {
              console.log('Exchange memory fragments:', fragments.map(f => f.fragmentText))
            }
          }
        })
        .catch(error => {
          console.error('❌ Conversation exchange memory processing failed:', error)
        })
    } else {
      console.log('⚠️  No userId provided for memory processing')
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