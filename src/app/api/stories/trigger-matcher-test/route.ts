/**
 * Test endpoint for trigger matcher directly
 */

import { NextRequest, NextResponse } from 'next/server';
import { UserStoryService } from '@/lib/services/userStoryService';
import { defaultTriggerMatcher } from '@/lib/services/storyTriggerMatcher';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, avatarId } = body;

    console.log('[TriggerMatcherTest] Testing message:', message);
    console.log('[TriggerMatcherTest] Avatar ID:', avatarId);

    // Step 1: Get stories
    console.log('[TriggerMatcherTest] Getting stories...');
    const stories = await UserStoryService.getStoriesByOwner(avatarId, 'avatar');
    console.log('[TriggerMatcherTest] Found stories:', stories.length);
    
    if (stories.length > 0) {
      console.log('[TriggerMatcherTest] First story:', {
        id: stories[0].id,
        title: stories[0].title,
        triggers: stories[0].triggers,
        triggersType: typeof stories[0].triggers
      });
    }

    // Step 2: Analyze text
    console.log('[TriggerMatcherTest] Analyzing text...');
    const keywords = defaultTriggerMatcher.analyzeText(message);
    console.log('[TriggerMatcherTest] Extracted keywords:', keywords);

    // Step 3: Test trigger matching
    console.log('[TriggerMatcherTest] Testing trigger matching...');
    const matches = await defaultTriggerMatcher.matchTriggers(keywords, stories);
    console.log('[TriggerMatcherTest] Found matches:', matches.length);
    
    if (matches.length > 0) {
      console.log('[TriggerMatcherTest] First match:', {
        storyTitle: matches[0].story.title,
        confidence: matches[0].confidence,
        matchedKeywords: matches[0].matched_keywords
      });
    }

    return NextResponse.json({
      success: true,
      message,
      avatarId,
      storiesCount: stories.length,
      keywords,
      matchesCount: matches.length,
      matches: matches.map(m => ({
        storyTitle: m.story.title,
        confidence: m.confidence,
        matchedKeywords: m.matched_keywords
      }))
    });

  } catch (error) {
    console.error('[TriggerMatcherTest] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}