/**
 * Memory Injection Service - Extract and store facts from user messages
 * Fire-and-forget service that never blocks the main response flow
 */

export async function injectFactsFromMessage(args: { avatarId: string; text: string }) {
  try {
    // Minimal fact extraction - could be enhanced later
    const { avatarId, text } = args;
    
    // Simple patterns for common facts
    const patterns = [
      { re: /my name is (\w+)/i, key: 'user_name' },
      { re: /i live in ([^,.]+)/i, key: 'user_location' },
      { re: /i work as a? ([^,.]+)/i, key: 'user_job' },
      { re: /i'm from ([^,.]+)/i, key: 'user_origin' }
    ];
    
    const facts = [];
    for (const pattern of patterns) {
      const match = text.match(pattern.re);
      if (match) {
        facts.push({
          key: pattern.key,
          value: match[1].trim(),
          source: 'user_message',
          confidence: 0.8
        });
      }
    }
    
    if (facts.length > 0) {
      console.log('memory_injection_extracted', { avatarId, facts: facts.length });
      // Could store to database here in the future
    }
    
    return facts;
  } catch (error) {
    console.warn('memory_injection_error', error);
    return [];
  }
}

export default { injectFactsFromMessage };