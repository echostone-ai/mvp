/**
 * Generic topic extraction utility for factbook entries
 * Auto-detects topics from ID prefix and content analysis
 */

/**
 * Extract topics from factbook entry ID and content
 */
export function extractTopics(fact: {
  id: string;
  text: string;
  topics?: string[];
}): string[] {
  const existingTopics = fact.topics || [];
  const extractedTopics = new Set<string>(existingTopics.map(t => t.toLowerCase()));
  
  // Extract primary topic from ID prefix
  const idParts = fact.id.split('.');
  if (idParts.length >= 2) {
    const primaryTopic = idParts[0];
    extractedTopics.add(primaryTopic);
  }
  
  // Extract secondary topics from content analysis
  const contentTopics = analyzeContentForTopics(fact.text);
  contentTopics.forEach(topic => extractedTopics.add(topic));
  
  return Array.from(extractedTopics).sort();
}

/**
 * Analyze text content to identify relevant topics
 */
function analyzeContentForTopics(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  const topics: string[] = [];
  const textLower = text.toLowerCase();
  
  // Topic patterns based on content analysis
  const topicPatterns = {
    // Places and locations
    places: [
      /\b(lived|live|living|moved|city|country|state|province|island|mountain|coast|street)\b/i,
      /\b(sofia|bulgaria|austin|texas|maine|vancouver|europe|france|spain|croatia)\b/i
    ],
    
    // Timeline and dates
    timeline: [
      /\b(born|birth|age|year|years|1979|1994|2008|2018|2023|2024)\b/i,
      /\b(childhood|teen|college|married|moved|died|retired)\b/i
    ],
    
    // Relationships and people
    relationships: [
      /\b(partner|married|marriage|friend|brother|parents|family|love|dating)\b/i,
      /\b(tyler|eric|carter|matheus|krissy|tia|geoff|boris)\b/i
    ],
    
    // Pets and animals
    pets: [
      /\b(dog|poodle|puppy|pet|animal|romeo|bucky|george|olive|gus|una)\b/i,
      /\b(energetic|adopted|died|buried|leash|toy|black|street)\b/i
    ],
    
    // Music and entertainment
    music: [
      /\b(music|song|album|band|artist|guitar|cassette|cd|concert|show)\b/i,
      /\b(beatles|hendrix|doors|nirvana|techno|classical|hip hop|radiohead)\b/i
    ],
    
    // Technology and projects
    technology: [
      /\b(ai|platform|digital|technology|computer|software|developer|designer)\b/i,
      /\b(echostone|memorial|interactive|crypto|gowalla)\b/i
    ],
    
    // Politics and opinions
    politics: [
      /\b(trump|putin|politics|political|government|leadership|protest|america)\b/i,
      /\b(ukraine|russia|israel|palestine|society|culture)\b/i
    ],
    
    // Hobbies and interests
    hobbies: [
      /\b(cooking|guitar|painting|hiking|comedy|yoga|collecting|museum)\b/i,
      /\b(artifacts|curiosities|recipes|exercise|nature|art)\b/i
    ],
    
    // Humor and personality
    humor: [
      /\b(funny|humor|jokes|puns|sarcastic|witty|wild|dang|trip)\b/i,
      /\b(canadian|politeness|sorry|laughing|comedy|hunter thompson)\b/i
    ],
    
    // Memories and experiences
    memories: [
      /\b(remember|memory|experience|adventure|encounter|celebrity|famous)\b/i,
      /\b(acl|boat parties|snake bite|cobra|hockey cards|gowalla launch)\b/i
    ],
    
    // Travel and adventures
    travel: [
      /\b(travel|journey|adventure|explore|continent|country|culture|language)\b/i,
      /\b(panama|albania|costa rica|toronto|bucharest|montenegro|croatia)\b/i
    ]
  };
  
  // Check each topic pattern
  for (const [topic, patterns] of Object.entries(topicPatterns)) {
    if (patterns.some(pattern => pattern.test(textLower))) {
      topics.push(topic);
    }
  }
  
  // Special cases for compound topics
  if (textLower.includes('childhood') || textLower.includes('elementary') || textLower.includes('born')) {
    topics.push('childhood');
  }
  
  if (textLower.includes('current') || textLower.includes('now') || textLower.includes('lives in')) {
    topics.push('current');
  }
  
  if (textLower.includes('opinion') || textLower.includes('believe') || textLower.includes('think')) {
    topics.push('opinions');
  }
  
  return topics;
}

/**
 * Get fallback topics based on fact ID structure
 */
export function getFallbackTopics(factId: string): string[] {
  const parts = factId.split('.');
  const topics: string[] = [];
  
  // Always include the primary section as a topic
  if (parts.length >= 1) {
    topics.push(parts[0]);
  }
  
  // Add secondary topic based on common patterns
  if (parts.length >= 2) {
    const secondary = parts[1];
    
    // Map common secondary patterns to broader topics
    const secondaryMappings: Record<string, string[]> = {
      'current': ['places', 'current'],
      'childhood': ['timeline', 'childhood'],
      'years': ['timeline', 'places'],
      'period': ['timeline', 'places'],
      'journey': ['timeline', 'travel'],
      'move': ['timeline', 'places'],
      'partner': ['relationships', 'love'],
      'nicknames': ['relationships', 'identity'],
      'appearance': ['relationships', 'identity'],
      'details': ['relationships', 'friends'],
      'work': ['projects', 'career'],
      'vision': ['projects', 'future'],
      'style': ['humor', 'personality'],
      'catchphrases': ['humor', 'identity'],
      'list': ['personality', 'identity']
    };
    
    const mappedTopics = secondaryMappings[secondary];
    if (mappedTopics) {
      topics.push(...mappedTopics);
    }
  }
  
  return Array.from(new Set(topics));
}

/**
 * Validate and normalize topics
 */
export function normalizeTopics(topics: string[]): string[] {
  return topics
    .map(topic => topic.toLowerCase().trim())
    .filter(topic => topic.length > 0)
    .filter((topic, index, array) => array.indexOf(topic) === index) // Remove duplicates
    .sort();
}