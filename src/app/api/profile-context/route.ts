import { NextRequest, NextResponse } from 'next/server';
import jonathanProfile from '@/data/jonathan_profile.json';

export async function GET(request: NextRequest) {
  try {
    const voiceId = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || 'CO6pxVrMZfyL61ZIglyr';
    
    // Create a condensed profile context for the D-ID agent
    const profileContext = {
      identity: {
        name: jonathanProfile.full_name,
        nickname: jonathanProfile.nickname,
        location: jonathanProfile.location,
        age: new Date().getFullYear() - 1980, // Born 1980-03-15
      },
      
      personality: {
        summary: jonathanProfile.personality,
        bio: jonathanProfile.bio,
        humorStyle: jonathanProfile.humorStyle.description,
        languageStyle: jonathanProfile.languageStyle.description,
        catchphrases: jonathanProfile.catchphrases,
      },
      
      currentLife: {
        partner: {
          name: jonathanProfile.partner.name,
          nicknames: jonathanProfile.partner.nicknames,
          relationship: `Dating since ${jonathanProfile.partner.relationshipStart}`
        },
        dog: jonathanProfile.dog,
        location: jonathanProfile.location,
      },
      
      background: {
        placesLived: jonathanProfile.places_lived,
        recentMemories: jonathanProfile.memories.slice(0, 3),
        hobbies: jonathanProfile.hobbies,
        favoriteMusic: jonathanProfile.favoriteMusic,
      },
      
      voice: {
        elevenlabsVoiceId: voiceId,
        description: "Use this voice ID for any speech generation"
      },
      
      conversationStyle: {
        humor: jonathanProfile.humorStyle.examples,
        banter: jonathanProfile.banterExamples,
        opinions: {
          politics: jonathanProfile.opinions.politics,
          modernSociety: jonathanProfile.opinions.modern_society,
        }
      },
      
      instructions: `
        You are Jonathan Braden. Respond as him using this profile data.
        
        Key personality traits:
        - ${jonathanProfile.personality}
        - Use humor: ${jonathanProfile.humorStyle.description}
        - Language style: ${jonathanProfile.languageStyle.description}
        
        Current context:
        - Living in ${jonathanProfile.location}
        - Partner: ${jonathanProfile.partner.name} (call her ${jonathanProfile.partner.nicknames[0]})
        - Dog: ${jonathanProfile.dog}
        
        Voice settings:
        - ElevenLabs Voice ID: ${voiceId}
        
        Respond authentically as Jonathan would, with his humor, opinions, and personality.
      `
    };

    return NextResponse.json(profileContext);

  } catch (error) {
    console.error('Error generating profile context:', error);
    return NextResponse.json({ error: 'Failed to generate profile context' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, context } = await request.json();
    
    // This could be used to process messages with profile context
    // For now, just return the profile context
    const profileResponse = await GET(request);
    return profileResponse;
    
  } catch (error) {
    console.error('Error processing profile context:', error);
    return NextResponse.json({ error: 'Failed to process profile context' }, { status: 500 });
  }
}