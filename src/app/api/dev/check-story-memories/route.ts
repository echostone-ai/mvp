import { NextRequest, NextResponse } from 'next/server';
import { EnhancedPromptBuilder } from '@/lib/services/enhancedPromptBuilder';

/**
 * Check what memories Jonathan has that could be used for storytelling
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const avatarSlug = searchParams.get('avatar') || 'jonathan-demo';

    const enhancedBuilder = new EnhancedPromptBuilder();
    const avatarId = await enhancedBuilder.getAvatarIdFromSlug(avatarSlug);
    
    if (!avatarId) {
      return NextResponse.json({
        error: `Avatar not found: ${avatarSlug}`
      }, { status: 404 });
    }

    // Get memories for general storytelling
    const [generalMemories, spainMemories, workMemories, personalMemories] = await Promise.all([
      enhancedBuilder.fetchRelevantMemories(avatarId, 'story experience life', 10),
      enhancedBuilder.fetchRelevantMemories(avatarId, 'spain valencia lived', 5),
      enhancedBuilder.fetchRelevantMemories(avatarId, 'work company business', 5),
      enhancedBuilder.fetchRelevantMemories(avatarId, 'personal life experience', 5)
    ]);

    // Get quick facts for context
    const quickFacts = await enhancedBuilder.fetchQuickFacts(avatarId, 6);

    const storyPotential = {
      total_memories: generalMemories.length,
      spain_memories: spainMemories.length,
      work_memories: workMemories.length,
      personal_memories: personalMemories.length,
      place_facts: quickFacts.filter(f => 
        f.key.includes('place') || 
        f.key.includes('location') || 
        f.key.startsWith('places_lived_')
      ).length
    };

    return NextResponse.json({
      success: true,
      avatar_slug: avatarSlug,
      avatar_id: avatarId,
      story_potential: storyPotential,
      sample_memories: {
        general: generalMemories.slice(0, 3).map(m => ({
          id: m.id,
          preview: m.fragment_text.substring(0, 150) + '...',
          created_at: m.created_at
        })),
        spain: spainMemories.slice(0, 2).map(m => ({
          id: m.id,
          preview: m.fragment_text.substring(0, 150) + '...',
          created_at: m.created_at
        }))
      },
      place_facts: quickFacts
        .filter(f => f.key.includes('place') || f.key.includes('location') || f.key.startsWith('places_lived_'))
        .map(f => ({ key: f.key, value: f.value })),
      recommendations: [
        storyPotential.total_memories === 0 ? 'No memories found - may need to add more memory fragments' : null,
        storyPotential.spain_memories > 0 ? 'Has Spain memories - should be able to tell Spain stories' : null,
        storyPotential.place_facts > 0 ? 'Has place facts - can reference locations in stories' : null
      ].filter(Boolean)
    });

  } catch (error) {
    console.error('Story memories check error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}