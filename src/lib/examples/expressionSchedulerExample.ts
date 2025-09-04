/**
 * Example usage of Expression Overlay Scheduler
 * This demonstrates how to use the scheduler in a real conversation flow
 */

import { 
  scheduleOverlays, 
  convertStoredExpressionsToClips,
  ExpressionClip,
  OverlaySchedule 
} from '../expressionScheduler';
import { ExpressionStorageService, StoredExpression } from '../services/expressionStorageService';

/**
 * Example: Schedule expressions for a user's conversation turn
 */
export async function scheduleExpressionsForUser(
  userId: string, 
  conversationText: string
): Promise<OverlaySchedule[]> {
  try {
    // 1. Load user's active expressions from storage
    const storedExpressions = await ExpressionStorageService.getExpressionsByOwner(userId, 'user');
    
    // 2. Convert to clips format for scheduling
    const clips = convertStoredExpressionsToClips(storedExpressions);
    
    // 3. Schedule overlays with default settings
    const schedule = scheduleOverlays(conversationText, clips, {
      maxOverlays: 2,        // Maximum 2 overlays per turn
      minSpacingMs: 4000,    // 4 second minimum spacing
      duckingAmount: 0.4     // 40% ducking (3-6dB reduction)
    });
    
    console.log(`Scheduled ${schedule.length} expressions for user ${userId}`);
    return schedule;
    
  } catch (error) {
    console.error('Failed to schedule expressions:', error);
    return []; // Graceful fallback - no expressions
  }
}

/**
 * Example: Schedule expressions for an avatar (like jonathan-demo)
 */
export async function scheduleExpressionsForAvatar(
  avatarId: string, 
  conversationText: string
): Promise<OverlaySchedule[]> {
  try {
    // 1. Load avatar's curated expressions
    const storedExpressions = await ExpressionStorageService.getExpressionsByOwner(avatarId, 'avatar');
    
    // 2. Convert to clips format
    const clips = convertStoredExpressionsToClips(storedExpressions);
    
    // 3. Schedule with avatar-specific settings (might be more conservative)
    const schedule = scheduleOverlays(conversationText, clips, {
      maxOverlays: 1,        // Avatars might use fewer overlays
      minSpacingMs: 5000,    // Longer spacing for avatars
      duckingAmount: 0.3     // Gentler ducking for avatars
    });
    
    console.log(`Scheduled ${schedule.length} expressions for avatar ${avatarId}`);
    return schedule;
    
  } catch (error) {
    console.error('Failed to schedule avatar expressions:', error);
    return [];
  }
}

/**
 * Example: Custom scheduling for specific conversation contexts
 */
export function scheduleExpressionsForContext(
  clips: ExpressionClip[],
  conversationText: string,
  context: 'casual' | 'professional' | 'demo'
): OverlaySchedule[] {
  
  const contextSettings = {
    casual: {
      maxOverlays: 2,
      minSpacingMs: 3000,
      duckingAmount: 0.5
    },
    professional: {
      maxOverlays: 1,
      minSpacingMs: 6000,
      duckingAmount: 0.3
    },
    demo: {
      maxOverlays: 2,
      minSpacingMs: 4000,
      duckingAmount: 0.4
    }
  };
  
  const settings = contextSettings[context];
  return scheduleOverlays(conversationText, clips, settings);
}

/**
 * Example: Real-time conversation flow with expression scheduling
 */
export class ConversationExpressionManager {
  private userClips: ExpressionClip[] = [];
  private lastScheduleTime = 0;
  
  constructor(private userId: string) {}
  
  async initialize(): Promise<void> {
    // Load user expressions once at conversation start
    const stored = await ExpressionStorageService.getExpressionsByOwner(this.userId, 'user');
    this.userClips = convertStoredExpressionsToClips(stored);
    console.log(`Loaded ${this.userClips.length} expressions for user ${this.userId}`);
  }
  
  scheduleForTurn(conversationText: string): OverlaySchedule[] {
    const now = Date.now();
    
    // Prevent too frequent scheduling (rate limiting)
    if (now - this.lastScheduleTime < 1000) {
      console.log('Rate limiting: skipping expression scheduling');
      return [];
    }
    
    this.lastScheduleTime = now;
    
    // Schedule expressions for this turn
    const schedule = scheduleOverlays(conversationText, this.userClips, {
      maxOverlays: 2,
      minSpacingMs: 4000,
      duckingAmount: 0.4
    });
    
    // Log for debugging/monitoring
    if (schedule.length > 0) {
      console.log('Expression schedule:', schedule.map(s => ({
        type: s.clip.type,
        startTime: s.startTimeMs,
        duration: s.clip.durationMs
      })));
    }
    
    return schedule;
  }
  
  async refreshExpressions(): Promise<void> {
    // Reload expressions (e.g., if user uploaded new ones)
    await this.initialize();
  }
}

/**
 * Example conversation scenarios for testing
 */
export const exampleConversations = {
  funny: "That's absolutely hilarious! I can't stop laughing at that joke. You really got me there!",
  
  agreement: "Yes, exactly! I completely agree with your point and that's definitely the right approach.",
  
  disappointment: "Unfortunately, that's not going to work out. It's sadly disappointing, but oh well.",
  
  greeting: "Hello there! Welcome to our conversation. It's great to meet you!",
  
  longForm: `This is a longer conversation that naturally flows with multiple ideas and concepts. 
             It's the kind of response that would benefit from natural breathing pauses and maybe 
             some authentic expressions to make it sound more human and engaging. The key is to 
             make sure the expressions enhance rather than distract from the main message.`,
  
  neutral: "The weather is nice today. I think we should proceed with the plan as discussed.",
  
  mixed: "Hello! That's absolutely hilarious and I definitely agree. Unfortunately, this longer response might need some breathing room to sound natural."
};

/**
 * Example: Test all conversation scenarios
 */
export function testAllScenarios(clips: ExpressionClip[]): void {
  console.log('Testing expression scheduling scenarios...\n');
  
  Object.entries(exampleConversations).forEach(([scenario, text]) => {
    console.log(`--- ${scenario.toUpperCase()} ---`);
    console.log(`Text: "${text.substring(0, 100)}..."`);
    
    const schedule = scheduleOverlays(text, clips);
    
    console.log(`Scheduled expressions: ${schedule.length}`);
    schedule.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.clip.type} at ${s.startTimeMs}ms (ducking: ${s.duckingLevel})`);
    });
    console.log('');
  });
}