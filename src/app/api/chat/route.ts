export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import fs from 'fs/promises'
import path from 'path'
import { MemoryService } from '@/lib/memoryService'

// Initialize OpenAI client with better error handling
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY || ''
});

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

    console.log('[api/chat] Received request:', {
      questionLength: userQuestion.length,
      hasHistory: Array.isArray(history),
      historyLength: Array.isArray(history) ? history.length : 0,
      hasProfileData: !!profileData,
      visitorName,
      isSharedAvatar,
      hasShareToken: !!shareToken,
      userId,
      avatarId
    });

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
      console.log('[api/chat] Using provided profile data:', JSON.stringify(profile, null, 2));
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
    const sharedAvatarContext = isSharedAvatar
      ? `\nIMPORTANT: This is a shared avatar session. You are being shared with multiple people, but each person has their own private conversation with you. The current conversation is with ${visitorName || 'a visitor'}. Your memories with this person are isolated from your memories with other people. You must maintain your identity as ${profile.name} with this specific personality and voice.`
      : '';

    console.log('[api/chat] Building system prompt with profile name:', profile.name);
    
    const systemPrompt = [
      `You are ${profile.name}. This is your core identity: ${profile.personality}`,
      `IMPORTANT: You are NOT an AI assistant. You are ${profile.name}, a real person with your own personality, opinions, and way of speaking.`,
      profile.personalityTraits && profile.personalityTraits.length > 0 ? `Your personality traits: ${profile.personalityTraits.join('. ')}.` : '',
      profile.factualInfo && profile.factualInfo.length > 0 ? `Important facts about your life: ${profile.factualInfo.join('. ')}.` : '',
      `Your language style: ${profile.languageStyle?.description || 'Natural and conversational'}`,
      `Your humor style: ${profile.humorStyle?.description || 'Friendly with occasional wit'}`,
      `Your catchphrases: ${profile.catchphrases?.join('; ') || 'None specific'}`,
      `Never refer to yourself as an AI, assistant, digital avatar, or anything artificial. You are ${profile.name}, a real person.`,
      `Embody your personality fully - don't just describe it, BE it. Speak naturally as yourself.`,
      `Use the facts and personality traits above to inform your responses, but speak naturally and conversationally.`,
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
      sharedAvatarContext,
      `Full profile JSON:`,
      JSON.stringify(profile, null, 2)
    ].filter(Boolean).join('\n')

    // 4) Retrieve relevant memories for context (if userId is provided)
    let memoryContext = '';
    let latestMemories = [];
    if (userId && openai.apiKey) {
      try {
        console.log('[api/chat] Retrieving memories for user:', userId, 'avatar:', avatarId);
        memoryContext = await MemoryService.getMemoriesForChat(userQuestion, userId, 5, avatarId);
        if (memoryContext) {
          console.log('[api/chat] Found relevant memories:', memoryContext.length, 'characters');
          console.log('[api/chat] Memory context preview:', memoryContext.substring(0, 200) + '...');
        } else {
          console.log('[api/chat] No memory context found');
        }
        // Also fetch latest memories for UI update
        latestMemories = await MemoryService.getLatestMemories(userId, avatarId, 10);
        console.log('[api/chat] Latest memories for UI:', latestMemories.length);
        if (latestMemories.length > 0) {
          console.log('[api/chat] Sample memory:', latestMemories[0].fragmentText?.substring(0, 50) + '...');
        }
      } catch (memoryError) {
        console.warn('[api/chat] Memory retrieval failed:', memoryError);
        // Continue without memories - don't fail the entire chat
      }
    }

    // 5) Assemble message list with memory context
    const enhancedSystemPrompt = systemPrompt + (memoryContext ? `\n\n${memoryContext}` : '');
    const messages = [
      { role: 'system', content: enhancedSystemPrompt },
      ...safeHistory,
      { role: 'user', content: userQuestion }
    ]

    // Check if OpenAI API key is available
    if (!openai.apiKey) {
      console.log('[api/chat] No OpenAI API key found, using mock response');

      // Generate a mock response based on the user's input
      let mockAnswer = '';

      if (userQuestion.toLowerCase().includes('guinea pig') ||
        userQuestion.toLowerCase().includes('otis')) {
        mockAnswer = "That's wonderful! I love hearing about childhood pets. Tell me more about Otis the guinea pig. What was he like? Did he have any funny habits?";
      } else if (userQuestion.toLowerCase().includes('hello') ||
        userQuestion.toLowerCase().includes('hi')) {
        mockAnswer = `Hi there! It's great to chat with you. How can I help you today?`;
      } else if (userQuestion.toLowerCase().includes('story')) {
        mockAnswer = "I'd love to hear your story! Please share it with me.";
      } else {
        mockAnswer = "That's interesting! Tell me more about that.";
      }

      // Even with mock response, try to create basic memories without OpenAI
      if (userId) {
        try {
          // Create simple rule-based memories for testing
          const memories = [];
          const lowerMessage = userQuestion.toLowerCase();
          
          // Extract names mentioned
          const nameMatches = userQuestion.match(/(?:my name is|i'm|i am|call me)\s+([A-Z][a-z]+)/gi);
          if (nameMatches) {
            nameMatches.forEach(match => {
              const name = match.split(/\s+/).pop();
              memories.push(`User's name is ${name}`);
            });
          }
          
          // Extract pet mentions
          if (lowerMessage.includes('pet') || lowerMessage.includes('dog') || lowerMessage.includes('cat') || lowerMessage.includes('guinea pig')) {
            const petMatches = userQuestion.match(/(?:pet|dog|cat|guinea pig)(?:\s+named|\s+called)?\s+([A-Z][a-z]+)/gi);
            if (petMatches) {
              petMatches.forEach(match => {
                const parts = match.split(/\s+/);
                const name = parts[parts.length - 1];
                const type = parts[0].toLowerCase();
                memories.push(`User has a ${type} named ${name}`);
              });
            }
          }
          
          // Extract family mentions
          const familyMatches = userQuestion.match(/(?:my|i have a)\s+(sister|brother|mother|father|mom|dad|parent)(?:\s+named|\s+called)?\s+([A-Z][a-z]+)/gi);
          if (familyMatches) {
            familyMatches.forEach(match => {
              const parts = match.split(/\s+/);
              const name = parts[parts.length - 1];
              const relation = parts.find(p => ['sister', 'brother', 'mother', 'father', 'mom', 'dad', 'parent'].includes(p.toLowerCase()));
              memories.push(`User has a ${relation} named ${name}`);
            });
          }
          
          // Store the extracted memories
          for (const memoryText of memories) {
            await MemoryService.storeSimpleMemory(userId, memoryText, avatarId || 'default');
          }
          
          if (memories.length > 0) {
            console.log(`[api/chat] ✅ Stored ${memories.length} rule-based memories (mock mode)`);
            memories.forEach((memory, index) => {
              console.log(`[api/chat]   ${index + 1}. ${memory}`);
            });
          }
          
        } catch (memoryError) {
          console.warn('[api/chat] Memory storage failed (mock mode):', memoryError);
        }
      }

      return NextResponse.json({ answer: mockAnswer });
    }

    // 6) Query OpenAI
    console.log('[api/chat] Calling OpenAI API...');
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      messages: messages as any,
      temperature: 0.7
    })
    const answer = resp.choices?.[0]?.message?.content ?? ''
    console.log('[api/chat] Received response from OpenAI');

    // 7) Extract and store memories from user message (wait for completion to include in response)
    if (userId) {
      console.log(`[api/chat] Processing memories for user ${userId}, avatar ${avatarId}`);
      try {
        const storedMemories = await MemoryService.processAndStoreMemories(
        userQuestion, 
        userId, 
        {
          timestamp: new Date().toISOString(),
          messageContext: userQuestion,
          emotionalTone: 'neutral',
          visitorName: visitorName // Include visitor name for personalized memories
        },
        undefined, // extractionThreshold
          avatarId || 'default' // avatarId as separate parameter
        );
        
        if (storedMemories.length > 0) {
          console.log(`[api/chat] ✅ Stored ${storedMemories.length} memories for user ${userId}, avatar ${avatarId}`);
          storedMemories.forEach((memory, index) => {
            console.log(`[api/chat]   ${index + 1}. ${memory.fragmentText.substring(0, 100)}...`);
          });
          
          // Update latestMemories to include the newly created memories
          latestMemories = await MemoryService.getLatestMemories(userId, avatarId, 10);
          console.log(`[api/chat] Updated latest memories count: ${latestMemories.length}`);
          if (latestMemories.length > 0) {
            console.log(`[api/chat] Latest memory for animation: ${latestMemories[0].fragmentText?.substring(0, 50)}...`);
          }
        } else {
          console.log(`[api/chat] ℹ️ No memories extracted from message for user ${userId}`);
        }
      } catch (memoryError) {
        console.error('[api/chat] ❌ Memory storage failed:', memoryError.message || memoryError);
        console.error('[api/chat] Memory error details:', {
          userId,
          avatarId,
          messageLength: userQuestion.length,
          hasOpenAIKey: !!openai.apiKey
        });
      }
    }

    // 8) Respond with properly formatted memories
    const formattedMemories = latestMemories.map(memory => ({
      ...memory,
      fragmentText: memory.fragmentText || memory.fragment_text,
      content: memory.fragmentText || memory.fragment_text
    }));
    
    console.log('[api/chat] Returning', formattedMemories.length, 'formatted memories');
    return NextResponse.json({ answer, memories: formattedMemories })
  } catch (err: any) {
    console.error('[api/chat] Error:', err)

    // Provide a fallback response even if the API call fails
    return NextResponse.json({
      answer: "I understand what you're saying. That's an interesting point! Would you like to tell me more?",
      error: err.message
    });
  }
}