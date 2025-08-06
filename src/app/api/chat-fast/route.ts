// Ultra-Fast Chat API - Optimized for Speed
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { ProfileOptimizer } from '@/lib/profileOptimization';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

// Pre-built system prompt template for speed
const FAST_SYSTEM_PROMPT = `You are {name}, {core_personality}

Key facts: {quick_facts}
Style: {conversation_style}
Current: {current_context}

Respond in 1 brief, natural sentence. Be conversational and authentic to your personality.`;

export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    const { prompt, userId = 'demo', avatarId = 'jonathan_braden', maxTokens = 25 } = await req.json();
    
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt required' }, { status: 400 });
    }

    console.log(`[chat-fast] Processing: "${prompt.slice(0, 50)}..." for avatar: ${avatarId}`);

    // Step 1: Get optimized profile (< 50ms from cache)
    let profile = await ProfileOptimizer.getQuickProfile(avatarId);
    
    console.log(`[chat-fast] Profile found:`, !!profile);
    
    if (!profile) {
      console.log(`[chat-fast] No optimized profile found for ${avatarId}, falling back to full profile`);
      // Fallback to full profile if optimized not available
      const fullProfile = await ProfileOptimizer.getFullProfile(avatarId);
      if (fullProfile) {
        console.log(`[chat-fast] Using full profile as fallback`);
        // Create a quick optimized version on the fly
        profile = ProfileOptimizer.optimizeProfile(fullProfile);
        console.log(`[chat-fast] Quick profile created`);
      } else if (avatarId === 'jonathan_braden') {
        // Final fallback - use the original Jonathan profile from JSON
        console.log(`[chat-fast] Using original Jonathan profile as final fallback`);
        try {
          const fs = await import('fs/promises');
          const path = await import('path');
          const jonathanData = await fs.readFile(
            path.join(process.cwd(), 'src/data/jonathan_profile.json'), 
            'utf-8'
          );
          const jonathanProfile = JSON.parse(jonathanData);
          profile = ProfileOptimizer.optimizeProfile(jonathanProfile);
          console.log(`[chat-fast] Jonathan fallback profile created`);
        } catch (error) {
          console.error(`[chat-fast] Failed to load Jonathan fallback profile:`, error);
          return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }
      } else {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      }
    }

    // Step 2: Build minimal system prompt (< 5ms)
    const systemPrompt = FAST_SYSTEM_PROMPT
      .replace('{name}', profile.name)
      .replace('{core_personality}', profile.core_personality)
      .replace('{quick_facts}', profile.quick_facts)
      .replace('{conversation_style}', profile.conversation_style)
      .replace('{current_context}', profile.current_context);

    console.log(`[chat-fast] System prompt length: ${systemPrompt.length} chars`);

    // Step 3: Ultra-fast OpenAI call
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fastest model
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: maxTokens,
      temperature: 0.9,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    });

    const answer = completion.choices[0]?.message?.content || 'Sorry, I had trouble responding.';
    const totalTime = Date.now() - startTime;

    console.log(`[chat-fast] Response generated in ${totalTime}ms`);

    return NextResponse.json({
      answer,
      responseTime: totalTime,
      tokensUsed: completion.usage?.total_tokens || 0,
      model: 'gpt-4o-mini'
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[chat-fast] Error after ${totalTime}ms:`, error);
    
    return NextResponse.json({
      error: 'Failed to generate response',
      responseTime: totalTime
    }, { status: 500 });
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'Ultra-fast chat API ready'
  });
}