/**
 * Fast Lane Seed - Light DSL for immediate streaming
 * Composes warm, non-committal openers using cached session context
 */

import { SessionContext } from './sessionCache';

/**
 * Compose a fast lane seed prompt for immediate streaming
 * Returns a short, warm, non-committal opener that leverages persona and recent context
 */
export function composeFastLaneSeed(ctx: SessionContext, userText: string): string {
  const { personaSeed, lastTurns } = ctx;
  
  // Extract key topics from recent conversation
  const recentTopics = extractRecentTopics(lastTurns, userText);
  
  // Build a warm, engaging opener
  let seed = personaSeed;
  
  // Add conversational hook based on recent context
  if (recentTopics.length > 0) {
    const topic = recentTopics[0];
    seed += `\n\nThe user just mentioned "${topic}" - acknowledge this warmly and show interest, but keep it brief and natural. Ask if they want the quick version or more details.`;
  } else {
    seed += `\n\nRespond warmly to the user's message. Keep it conversational and engaging, but brief. You can always elaborate more if they want details.`;
  }
  
  // Add instruction for non-committal approach
  seed += `\n\nStart with a warm greeting or acknowledgment, then give a brief initial response. Don't over-commit to details you're not certain about - it's better to be warm and ask follow-up questions.`;
  
  return seed;
}

/**
 * Extract key topics from recent conversation turns and current user input
 */
function extractRecentTopics(lastTurns: SessionContext['lastTurns'], userText: string): string[] {
  const topics: string[] = [];
  
  // Extract from current user message
  const currentTopics = extractTopicsFromText(userText);
  topics.push(...currentTopics);
  
  // Extract from recent turns (last 2 turns max for speed)
  const recentTurns = lastTurns.slice(-2);
  for (const turn of recentTurns) {
    const turnTopics = extractTopicsFromText(turn.content);
    topics.push(...turnTopics);
  }
  
  // Return unique topics, prioritizing more recent ones
  return [...new Set(topics)].slice(0, 3);
}

/**
 * Simple topic extraction from text
 */
function extractTopicsFromText(text: string): string[] {
  const topics: string[] = [];
  const lowerText = text.toLowerCase();
  
  // Common topic patterns
  const patterns = [
    // Places
    /\b(spain|valencia|france|maine|austin|vancouver|texas|canada|europe)\b/gi,
    // People/relationships
    /\b(tyler|kate|katie|anna|taylor|romeo|family|friend)\b/gi,
    // Activities/interests
    /\b(work|job|travel|music|food|cooking|reading|writing)\b/gi,
    // Emotions/states
    /\b(happy|sad|excited|tired|busy|free|good|bad)\b/gi,
  ];
  
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      topics.push(...matches.map(m => m.toLowerCase()));
    }
  }
  
  // Extract quoted phrases
  const quotes = text.match(/"([^"]+)"/g);
  if (quotes) {
    topics.push(...quotes.map(q => q.replace(/"/g, '')));
  }
  
  return topics.slice(0, 5); // Limit to 5 topics per text
}

/**
 * Create a minimal persona seed for fast lane
 */
export function createMinimalPersonaSeed(
  avatarSlug: string, 
  isDemo: boolean,
  basicFacts?: Array<{ key: string; value: string }>
): string {
  if (isDemo && avatarSlug === 'jonathan-demo') {
    return `You are Jonathan Braden. You're warm, conversational, and engaging. You currently live in Spain (Valencia area) after having lived in various places including Maine. You have a dog named Romeo. Keep responses natural, personal, and in character as yourself.`;
  }
  
  // For normal avatars, build from basic facts
  let seed = `You are ${avatarSlug}. Be warm, natural, and conversational. Speak in first person as yourself.`;
  
  if (basicFacts && basicFacts.length > 0) {
    const keyFacts = basicFacts
      .filter(f => ['current_location', 'hometown', 'pet_name', 'speaking_style'].includes(f.key))
      .slice(0, 3);
    
    if (keyFacts.length > 0) {
      seed += '\n\nKey context: ';
      seed += keyFacts.map(f => `${f.key}: ${f.value}`).join(', ');
    }
  }
  
  return seed;
}