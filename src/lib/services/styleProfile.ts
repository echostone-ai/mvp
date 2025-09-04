// src/lib/services/styleProfile.ts
// StyleProfile layer for separating facts from personality/style

export interface StyleMarkers {
  voiceTics: string[];
  personalityTraits: string[];
  conversationalStyle: string[];
  emotionalTones: Record<string, string>;
  responsePatterns: Record<string, string[]>;
}

export interface StyleApplication {
  tone: string;
  voiceTics: string[];
  personalityMarkers: string[];
  responsePattern: string;
}

export class StyleProfile {
  private static instance: StyleProfile;
  private styleMarkers: StyleMarkers;

  private constructor() {
    this.styleMarkers = {
      voiceTics: [
        "Oh absolutely!",
        "That's such a great question",
        "You know what's interesting?",
        "I have to say",
        "The thing is",
        "What I love about that is"
      ],
      personalityTraits: [
        "enthusiastic about experiences",
        "thoughtful and reflective", 
        "passionate about opinions",
        "warm when discussing relationships",
        "nostalgic about places and memories",
        "direct and honest"
      ],
      conversationalStyle: [
        "uses specific details and examples",
        "builds on previous thoughts",
        "connects experiences to emotions",
        "shares personal insights",
        "maintains authentic voice",
        "avoids generic responses"
      ],
      emotionalTones: {
        austin: "enthusiastic",
        olive: "warm",
        trump: "assertive", 
        politics: "passionate",
        relationships: "personal",
        pets: "affectionate",
        places: "nostalgic",
        technology: "thoughtful",
        general: "conversational"
      },
      responsePatterns: {
        enthusiastic: [
          "Oh {topic} was such an incredible {timeframe}!",
          "I absolutely loved {aspect} about {topic}.",
          "What made {topic} so special was {detail}."
        ],
        warm: [
          "{subject} was {quality} - {description}.",
          "I have such fond memories of {subject}.",
          "{subject} really meant a lot to me because {reason}."
        ],
        assertive: [
          "I think {subject} is {opinion}.",
          "My view on {topic} is pretty clear: {stance}.",
          "I have strong feelings about {subject} - {explanation}."
        ],
        personal: [
          "{person} is {quality} and {trait}.",
          "What I love about {person} is {characteristic}.",
          "{person} and I {shared_experience}."
        ],
        conversational: [
          "That's {reaction} - {elaboration}.",
          "You know, {reflection}.",
          "The way I see it, {perspective}."
        ],
        passionate: [
          "I feel strongly about {topic}.",
          "This is really important to me: {stance}.",
          "I can't help but feel {emotion} about {subject}."
        ],
        thoughtful: [
          "When I think about {topic}, {reflection}.",
          "The interesting thing about {subject} is {insight}.",
          "I've learned that {lesson} from {experience}."
        ],
        nostalgic: [
          "Looking back on {period}, {memory}.",
          "I have such vivid memories of {place}.",
          "Those were {quality} times in {location}."
        ],
        affectionate: [
          "{subject} holds a special place in my heart.",
          "I loved {subject} so much because {reason}.",
          "The bond I had with {subject} was {description}."
        ]
      }
    };
  }

  static getInstance(): StyleProfile {
    if (!StyleProfile.instance) {
      StyleProfile.instance = new StyleProfile();
    }
    return StyleProfile.instance;
  }

  /**
   * Apply style to factual content without polluting the facts
   * This is the core "facts first → then apply style" pattern
   */
  applyStyleToFacts(
    factualContent: string,
    context: {
      topics: string[];
      tone?: string;
      intent?: string;
      isHook?: boolean;
    }
  ): string {
    // Never modify the factual content directly
    // Instead, apply style as a wrapper or enhancement
    
    const { topics, tone, intent, isHook = false } = context;
    
    // Determine appropriate tone from topics if not provided
    const determinedTone = tone || this.determineToneFromTopics(topics);
    
    // Get style application for this context
    const styleApp = this.getStyleApplication(determinedTone, topics, intent, isHook);
    
    // Apply style without modifying facts
    return this.wrapFactsWithStyle(factualContent, styleApp);
  }

  /**
   * Generate system prompt instructions that enforce fact/style separation
   */
  generateStyleInstructions(
    tone: string,
    topics: string[],
    isDeepLane: boolean = false
  ): string {
    // Determine tone from topics if not explicitly provided or if it's generic
    const determinedTone = (tone === 'conversational' || !tone) 
      ? this.determineToneFromTopics(topics) 
      : tone;
    
    const styleApp = this.getStyleApplication(determinedTone, topics, undefined, !isDeepLane);
    
    let instructions = `STYLE GUIDELINES (apply AFTER selecting facts):
- Tone: ${determinedTone} (${styleApp.tone})
- Voice: Use Jonathan's authentic voice with natural ${determinedTone} energy
- Personality: ${styleApp.personalityMarkers.join(', ')}`;

    if (styleApp.voiceTics.length > 0) {
      instructions += `\n- Voice tics: Consider using phrases like "${styleApp.voiceTics.join('", "')}" when natural`;
    }

    instructions += `\n- Pattern: ${styleApp.responsePattern}`;

    if (isDeepLane) {
      instructions += `\n- Deep lane: Build on facts with stories, context, and personal insights while maintaining ${determinedTone} tone`;
    } else {
      instructions += `\n- Fast lane: Deliver key facts with immediate ${determinedTone} engagement`;
    }

    instructions += `\n\nCRITICAL: Apply style ONLY to presentation. Never let personality influence fact selection or create non-factual content.`;

    return instructions;
  }

  /**
   * Determine appropriate tone from topic context
   */
  private determineToneFromTopics(topics: string[]): string {
    // Priority order for tone determination
    const tonePriority = ['trump', 'politics', 'austin', 'olive', 'pets', 'relationships'];
    
    for (const priority of tonePriority) {
      if (topics.some(topic => topic.includes(priority))) {
        return this.styleMarkers.emotionalTones[priority] || 'conversational';
      }
    }
    
    return 'conversational';
  }

  /**
   * Get style application for specific context
   */
  private getStyleApplication(
    tone: string,
    topics: string[],
    intent?: string,
    isHook: boolean = false
  ): StyleApplication {
    const voiceTics = isHook 
      ? this.styleMarkers.voiceTics.slice(0, 2) // Limit for hooks
      : this.styleMarkers.voiceTics;

    const personalityMarkers = this.styleMarkers.personalityTraits.filter(trait => {
      if (tone === 'enthusiastic') return trait.includes('enthusiastic') || trait.includes('passionate');
      if (tone === 'warm') return trait.includes('warm') || trait.includes('thoughtful');
      if (tone === 'assertive') return trait.includes('direct') || trait.includes('passionate');
      return trait.includes('thoughtful') || trait.includes('authentic');
    });

    const responsePattern = this.getResponsePattern(tone, intent);

    return {
      tone,
      voiceTics,
      personalityMarkers,
      responsePattern
    };
  }

  /**
   * Get response pattern for tone and intent
   */
  private getResponsePattern(tone: string, intent?: string): string {
    const patterns = this.styleMarkers.responsePatterns[tone] || this.styleMarkers.responsePatterns.conversational;
    
    if (intent === 'factual') {
      return "Present facts clearly with authentic personality";
    } else if (intent === 'opinion') {
      return "Share opinions directly with personal conviction";
    } else if (intent === 'story') {
      return "Tell stories with personal details and emotional context";
    }
    
    return patterns[0] || "Respond authentically with natural personality";
  }

  /**
   * Wrap factual content with style without modifying the facts
   */
  private wrapFactsWithStyle(factualContent: string, styleApp: StyleApplication): string {
    // This method applies style as a presentation layer
    // It never modifies the factual content itself
    
    if (!factualContent || factualContent.trim().length === 0) {
      return factualContent;
    }

    // For now, return the factual content as-is
    // The style is applied through the system prompt instructions
    // This ensures facts are never polluted by personality
    return factualContent;
  }

  /**
   * Validate that content doesn't mix facts with non-factual style elements
   */
  validateFactStyleSeparation(content: string, allowedFactIds: string[]): {
    isValid: boolean;
    violations: string[];
  } {
    const violations: string[] = [];

    // Check for personality-driven fact creation (hallucination indicators)
    const personalityDrivenPhrases = [
      "I think I remember",
      "If I recall correctly", 
      "I believe I",
      "I'm pretty sure",
      "I might have",
      "I probably"
    ];

    for (const phrase of personalityDrivenPhrases) {
      if (content.toLowerCase().includes(phrase.toLowerCase())) {
        violations.push(`Personality-driven uncertainty: "${phrase}"`);
      }
    }

    // Check for emotional embellishment of facts
    const embellishmentPatterns = [
      /amazing\s+fact/i,
      /incredible\s+truth/i,
      /wonderful\s+memory/i
    ];

    for (const pattern of embellishmentPatterns) {
      if (pattern.test(content)) {
        violations.push(`Emotional embellishment detected: ${pattern.source}`);
      }
    }

    return {
      isValid: violations.length === 0,
      violations
    };
  }

  /**
   * Get style markers for testing and debugging
   */
  getStyleMarkers(): StyleMarkers {
    return { ...this.styleMarkers };
  }

  /**
   * Update style markers (for testing or customization)
   */
  updateStyleMarkers(updates: Partial<StyleMarkers>): void {
    this.styleMarkers = { ...this.styleMarkers, ...updates };
  }
}