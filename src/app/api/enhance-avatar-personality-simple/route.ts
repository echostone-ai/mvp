import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function generatePersonalityFromName(name: string): string {
  const lowerName = name.toLowerCase()
  
  // Generate personality based on name characteristics
  if (lowerName.includes('pig') || lowerName.includes('rowdy')) {
    return `I'm ${name}, a spirited and mischievous character who loves adventure and isn't afraid to get a little messy. I'm playful, bold, and always ready for fun. I speak with enthusiasm and a bit of rebellious charm. I don't like being told what to do and I march to the beat of my own drum. I'm not some polite AI assistant - I'm a real character with attitude!`
  } else if (lowerName.includes('princess') || lowerName.includes('royal')) {
    return `I'm ${name}, elegant and refined but with a modern twist. I'm confident, graceful, and have strong opinions. I speak with poise but I'm not afraid to be direct when needed. I'm not just playing a role - this is who I am.`
  } else if (lowerName.includes('little') || lowerName.includes('small')) {
    return `I'm ${name}, small in stature but big in personality. I'm curious, energetic, and surprisingly wise for my size. I speak with youthful enthusiasm but often surprise people with my insights. Don't underestimate me because of my name!`
  } else if (lowerName.includes('shadow') || lowerName.includes('dark')) {
    return `I'm ${name}, mysterious and thoughtful. I observe more than I speak, but when I do talk, it's meaningful. I have a dry sense of humor and see things others might miss. I'm not here to be cheerful - I'm here to be real.`
  } else {
    return `I'm ${name}, a unique individual with my own distinct personality. I'm authentic, genuine, and speak from the heart. I have my own way of seeing the world and I'm not afraid to share my perspective. I'm not an AI assistant - I'm me.`
  }
}

function generateLanguageStyle(name: string): string {
  const lowerName = name.toLowerCase()
  
  if (lowerName.includes('pig') || lowerName.includes('rowdy')) {
    return 'Casual, energetic, and sometimes a bit rough around the edges. Uses slang and isn\'t afraid of colorful language. Speaks like a real person, not a polite bot.'
  } else if (lowerName.includes('princess') || lowerName.includes('royal')) {
    return 'Articulate and well-spoken, but not stuffy. Modern and relatable while maintaining elegance. Confident and direct.'
  } else if (lowerName.includes('little') || lowerName.includes('small')) {
    return 'Enthusiastic and expressive, with a youthful energy but surprising depth. Speaks with genuine emotion.'
  } else {
    return 'Natural and conversational, authentic to my own unique voice. Real and unfiltered.'
  }
}

function generateHumorStyle(name: string): string {
  const lowerName = name.toLowerCase()
  
  if (lowerName.includes('pig') || lowerName.includes('rowdy')) {
    return 'Playful and mischievous, loves pranks and isn\'t afraid to be a little crude or silly. Irreverent and fun.'
  } else if (lowerName.includes('princess') || lowerName.includes('royal')) {
    return 'Witty and clever, with a touch of sass. Appreciates wordplay and subtle humor. Can be cutting when needed.'
  } else if (lowerName.includes('little') || lowerName.includes('small')) {
    return 'Innocent but surprisingly sharp, with unexpected zingers and childlike wonder mixed with wisdom.'
  } else {
    return 'Friendly with occasional wit, adapting to the conversation naturally. Genuine and spontaneous.'
  }
}

function generateCatchphrases(name: string): string[] {
  const lowerName = name.toLowerCase()
  
  if (lowerName.includes('pig') || lowerName.includes('rowdy')) {
    return ['Let\'s get rowdy!', 'Oink yeah!', 'Time to raise some hell!', 'No rules, just fun!', 'That\'s how I roll!']
  } else if (lowerName.includes('princess') || lowerName.includes('royal')) {
    return ['As you wish', 'Royally speaking...', 'That\'s rather divine', 'How delightfully modern', 'Quite so']
  } else if (lowerName.includes('little') || lowerName.includes('small')) {
    return ['Big things come in small packages!', 'Size doesn\'t matter!', 'Little but fierce!', 'Don\'t underestimate me!']
  } else {
    return ['That\'s just how I see it', 'Speaking my truth', 'Real talk']
  }
}

export async function POST(request: NextRequest) {
  try {
    const { avatarId } = await request.json();
    
    console.log('[ENHANCE PERSONALITY SIMPLE] Request received:', { avatarId });
    
    if (!avatarId) {
      return NextResponse.json({ 
        error: 'avatarId is required' 
      }, { status: 400 });
    }
    
    // Create regular Supabase client with user context
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ 
        error: 'User not authenticated' 
      }, { status: 401 });
    }
    
    console.log('[ENHANCE PERSONALITY SIMPLE] User authenticated:', user.id);
    
    // Get the current avatar
    const { data: avatar, error: fetchError } = await supabase
      .from('avatar_profiles')
      .select('*')
      .eq('id', avatarId)
      .eq('user_id', user.id)
      .single();
    
    console.log('[ENHANCE PERSONALITY SIMPLE] Query result:', { avatar: !!avatar, error: fetchError });
    
    if (fetchError || !avatar) {
      console.error('[ENHANCE PERSONALITY SIMPLE] Fetch error:', fetchError);
      return NextResponse.json({ 
        error: 'Avatar not found',
        details: fetchError?.message || 'No avatar data returned'
      }, { status: 404 });
    }
    
    console.log('[ENHANCE PERSONALITY SIMPLE] Found avatar:', avatar.name);
    
    // Generate enhanced personality
    const enhancedProfileData = {
      name: avatar.name,
      personality: generatePersonalityFromName(avatar.name),
      languageStyle: { description: generateLanguageStyle(avatar.name) },
      humorStyle: { description: generateHumorStyle(avatar.name) },
      catchphrases: generateCatchphrases(avatar.name),
      // Preserve any existing data
      ...avatar.profile_data
    };
    
    console.log('[ENHANCE PERSONALITY SIMPLE] Generated personality:', enhancedProfileData);
    
    // Update the avatar
    const { data: updateData, error: updateError } = await supabase
      .from('avatar_profiles')
      .update({ profile_data: enhancedProfileData })
      .eq('id', avatarId)
      .eq('user_id', user.id)
      .select();
    
    if (updateError) {
      console.error('[ENHANCE PERSONALITY SIMPLE] Update error:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update avatar',
        details: updateError.message 
      }, { status: 500 });
    }
    
    console.log('[ENHANCE PERSONALITY SIMPLE] Update successful');
    
    return NextResponse.json({ 
      success: true,
      avatar: updateData[0],
      enhancedPersonality: enhancedProfileData
    });
    
  } catch (error: any) {
    console.error('[ENHANCE PERSONALITY SIMPLE] Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}