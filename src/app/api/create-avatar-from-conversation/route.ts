import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { avatarName, conversation, audioSamples } = await request.json();

    if (!avatarName || !conversation) {
      return NextResponse.json({ error: 'Avatar name and conversation are required' }, { status: 400 });
    }

    console.log('🎭 Creating avatar from conversation:', avatarName);
    console.log('💬 Conversation turns:', conversation.length);
    console.log('🎤 Audio samples:', audioSamples?.length || 0);

    // Extract user responses from conversation
    const userResponses = conversation
      .filter((turn: any) => turn.type === 'user')
      .map((turn: any) => turn.text);

    if (userResponses.length === 0) {
      return NextResponse.json({ error: 'No user responses found in conversation' }, { status: 400 });
    }

    // Use OpenAI to analyze the conversation and extract profile data
    const profileData = await analyzeConversationForProfile(avatarName, userResponses);

    // Get user session
    const { data: session } = await supabase.auth.getSession();
    const user = session.session?.user;

    if (!user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Create avatar in database
    const avatarId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { data: avatar, error: createError } = await supabase
      .from('avatar_profiles')
      .insert({
        id: avatarId,
        name: avatarName,
        description: `Meet ${avatarName} - created through conversational onboarding`,
        profile_data: profileData,
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('Database creation error:', createError);
      return NextResponse.json({ error: 'Failed to create avatar' }, { status: 500 });
    }

    console.log('✅ Avatar created successfully:', avatarId);

    // Train voice model if we have audio samples
    let voiceId = null;
    if (audioSamples && audioSamples.length > 0) {
      try {
        console.log('🎤 Training voice with', audioSamples.length, 'samples...');
        
        const voiceResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/onboarding/train-voice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileData: {
              responses: audioSamples.map((audio: string, index: number) => ({
                questionId: `conversation_${index}`,
                transcript: userResponses[index] || '',
                audioBase64: audio
              })),
              avatarId,
              avatarName
            }
          }),
        });

        if (voiceResponse.ok) {
          const voiceData = await voiceResponse.json();
          voiceId = voiceData.voice_model_id;
          
          // Update avatar with voice ID
          await supabase
            .from('avatar_profiles')
            .update({ voice_id: voiceId })
            .eq('id', avatarId);
            
          console.log('✅ Voice trained:', voiceId);
        }
      } catch (voiceError) {
        console.error('Voice training failed:', voiceError);
      }
    }

    return NextResponse.json({
      success: true,
      avatar: {
        id: avatarId,
        name: avatarName,
        profile_data: profileData,
        voice_id: voiceId
      },
      message: 'Avatar created successfully from conversation'
    });

  } catch (error) {
    console.error('Avatar creation error:', error);
    return NextResponse.json({ error: 'Failed to create avatar' }, { status: 500 });
  }
}

async function analyzeConversationForProfile(avatarName: string, userResponses: string[]) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const conversationText = userResponses.join('\n\n');
    
    const prompt = `Analyze this conversation with ${avatarName} and extract a comprehensive personality profile. The user shared these responses during our conversation:

${conversationText}

Create a detailed profile with the following structure:
{
  "name": "${avatarName}",
  "personality": "A comprehensive personality description in first person",
  "memories": ["Array of specific memories or experiences mentioned"],
  "influences": ["People or things that influenced them"],
  "passions": ["Things they're passionate about or enjoy"],
  "places": ["Locations, travel experiences, or places mentioned"],
  "philosophy": ["Life beliefs, values, or principles"],
  "creativity": ["Creative pursuits, hobbies, or artistic interests"],
  "personalityTraits": ["Specific personality characteristics extracted"],
  "factualInfo": ["Key facts about their life and experiences"],
  "languageStyle": {"description": "How they communicate based on their responses"},
  "humorStyle": {"description": "Their sense of humor or communication style"},
  "catchphrases": ["Any repeated phrases or unique expressions"]
}

Extract real, specific information from what they shared. Don't make assumptions - only include what they actually mentioned. Be thorough and capture the nuances of their personality.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert personality analyst. Extract detailed, accurate personality profiles from conversations. Return valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error('OpenAI API request failed');
    }

    const data = await response.json();
    const profileText = data.choices[0]?.message?.content?.trim();
    
    if (!profileText) {
      throw new Error('No profile data generated');
    }

    // Parse the JSON response
    const profileData = JSON.parse(profileText);
    
    console.log('✅ Profile extracted:', Object.keys(profileData));
    return profileData;

  } catch (error) {
    console.error('Profile analysis failed:', error);
    
    // Fallback profile if AI analysis fails
    return {
      name: avatarName,
      personality: `I am ${avatarName}. I shared my thoughts and experiences during our conversation.`,
      memories: userResponses.filter(r => r.toLowerCase().includes('remember') || r.toLowerCase().includes('memory')),
      influences: [],
      passions: [],
      places: [],
      philosophy: [],
      creativity: [],
      personalityTraits: ['Conversational', 'Open to sharing'],
      factualInfo: [`My name is ${avatarName}`, ...userResponses],
      languageStyle: { description: 'Natural and conversational' },
      humorStyle: { description: 'Friendly and approachable' },
      catchphrases: []
    };
  }
}