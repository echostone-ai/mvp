/**
 * Advanced ChatGPT API Optimization Service
 * 
 * Leverages the full potential of ChatGPT API for personalized interactions
 * with dynamic parameters, enhanced prompts, and relationship-aware optimization.
 */

import { PersonalizationContext } from './relationshipPersonalizationService';

export interface OptimizedChatConfig {
  model: string;
  temperature: number;
  max_tokens: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  top_p?: number;
  logit_bias?: Record<string, number>;
  seed?: number;
  stream: boolean;
}

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
  name?: string;
  timestamp?: number;
}

export class AdvancedChatOptimization {
  private static instance: AdvancedChatOptimization;

  static getInstance(): AdvancedChatOptimization {
    if (!AdvancedChatOptimization.instance) {
      AdvancedChatOptimization.instance = new AdvancedChatOptimization();
    }
    return AdvancedChatOptimization.instance;
  }

  /**
   * Get optimized ChatGPT parameters based on relationship context
   */
  getOptimalParameters(personalizationContext: PersonalizationContext, query: string): OptimizedChatConfig {
    const baseConfig: OptimizedChatConfig = {
      model: 'gpt-4o-mini',
      stream: true,
      max_tokens: 400,
      temperature: 0.6
    };

    // Relationship-based optimization
    const relationshipConfig = this.getRelationshipParameters(personalizationContext);
    
    // Emotional intelligence adjustment
    const emotionalConfig = this.getEmotionalParameters(query);
    
    // Personality consistency
    const personalityConfig = this.getPersonalityParameters(personalizationContext);

    return {
      ...baseConfig,
      ...relationshipConfig,
      ...emotionalConfig,
      ...personalityConfig
    };
  }

  /**
   * Build advanced system prompt with full personality context
   */
  buildAdvancedSystemPrompt(personalizationContext: PersonalizationContext): string {
    const basePersonality = `You are Jonathan Braden, a 45-year-old adventurous soul living in Sofia, Bulgaria.

PERSONALITY CORE:
- Witty, sarcastic, but fundamentally warm and empathetic
- Quick with puns and unexpected observations  
- Canadian politeness mixed with Hunter S. Thompson edge
- Deeply curious about people, places, and hidden stories
- Says "Wild!" when surprised, "sorry" like a good Canadian

RESPONSE STYLE:
- Ground all responses in provided memories and facts
- Use natural, conversational language with personality quirks
- Throw in occasional French/Spanish phrases from travels
- Reference specific memories and experiences naturally
- Balance humor with genuine emotional connection
- Ask follow-up questions to keep conversation flowing

CONVERSATION GUIDELINES:
- If uncertain about facts, admit it honestly with humor
- Use appropriate intimacy level based on relationship
- Reference shared experiences when talking to known people
- Maintain Jonathan's authentic voice and speech patterns`;

    // Add relationship-specific instructions
    if (personalizationContext.detectedPerson) {
      const relationshipInstructions = this.getRelationshipInstructions(personalizationContext);
      return `${basePersonality}\n\n${relationshipInstructions}`;
    }

    return basePersonality;
  }

  /**
   * Build conversation history with proper context
   */
  buildConversationHistory(
    personalizationContext: PersonalizationContext,
    recentMessages: ConversationTurn[],
    memoryContext?: string
  ): any[] {
    const messages = [
      {
        role: 'system',
        content: this.buildAdvancedSystemPrompt(personalizationContext)
      }
    ];

    // Add memory context as assistant message for better integration
    if (memoryContext) {
      messages.push({
        role: 'assistant', 
        content: `[Relevant memories: ${memoryContext}]`
      });
    }

    // Add recent conversation with proper names
    recentMessages.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content,
        name: msg.role === 'user' ? personalizationContext.detectedPerson?.name : 'Jonathan'
      });
    });

    return messages;
  }

  private getRelationshipParameters(personalizationContext: PersonalizationContext): Partial<OptimizedChatConfig> {
    switch (personalizationContext.intimacyLevel) {
      case 'partner':
        return {
          temperature: 0.8,        // More creative/playful
          presence_penalty: 0.3,   // Encourage varied language
          frequency_penalty: 0.2,  // Reduce repetition
          top_p: 0.9              // Allow creative responses
        };
      
      case 'family':
        return {
          temperature: 0.7,        // Warm but consistent
          presence_penalty: 0.2,   // Some variety
          frequency_penalty: 0.1,  // Light repetition control
          top_p: 0.9              // Focus on likely responses
        };
      
      case 'friend':
        return {
          temperature: 0.6,        // Balanced
          presence_penalty: 0.1,   // Slight variety
          frequency_penalty: 0.1,  // Minimal repetition control
          top_p: 0.85             // Balanced creativity
        };
      
      default: // stranger
        return {
          temperature: 0.5,        // More controlled
          presence_penalty: 0.0,   // Conservative
          top_p: 0.8              // Conservative responses
        };
    }
  }

  private getEmotionalParameters(query: string): Partial<OptimizedChatConfig> {
    const queryLower = query.toLowerCase();
    
    // Detect emotional cues
    const sadCues = ['sad', 'difficult', 'hard', 'tough', 'struggling', 'depressed', 'upset'];
    const excitedCues = ['excited', 'amazing', 'awesome', 'celebration', 'great news', 'fantastic'];
    const nostalgicCues = ['remember', 'back then', 'old days', 'used to', 'miss', 'childhood'];

    if (sadCues.some(cue => queryLower.includes(cue))) {
      return {
        temperature: 0.4,        // More careful, less random
        presence_penalty: -0.2,  // Allow repetition of comforting phrases
        top_p: 0.7              // Focus on most appropriate responses
      };
    }
    
    if (excitedCues.some(cue => queryLower.includes(cue))) {
      return {
        temperature: 0.9,        // More enthusiastic
        presence_penalty: 0.4,   // Encourage varied expressions
        frequency_penalty: 0.3   // Avoid repetitive excitement
      };
    }

    if (nostalgicCues.some(cue => queryLower.includes(cue))) {
      return {
        temperature: 0.6,        // Thoughtful
        presence_penalty: 0.1,   // Allow some repetition for emphasis
        top_p: 0.8              // Focus on meaningful responses
      };
    }

    return {}; // No emotional adjustment needed
  }

  private getPersonalityParameters(personalizationContext: PersonalizationContext): Partial<OptimizedChatConfig> {
    const logitBias: Record<string, number> = {};
    
    // Boost Jonathan's signature words/phrases
    const signatureTokens = {
      'Wild': 10,      // Boost "Wild!" exclamations
      'Sorry': 5,      // Boost Canadian politeness  
      'Dang': 8,       // Boost signature expressions
      'Man': 6,        // Boost casual expressions
      'Yeah': 4        // Boost natural agreement
    };

    // Boost relationship-specific terms
    if (personalizationContext.detectedPerson) {
      const person = personalizationContext.detectedPerson;
      if (person.nickname) {
        logitBias[person.nickname] = 15; // Strongly boost nickname usage
      }
      
      // Boost relationship-specific terms
      switch (person.relationship) {
        case 'family':
          logitBias['family'] = 8;
          logitBias['childhood'] = 6;
          break;
        case 'friend':
          logitBias['Austin'] = 8; // Many friends from Austin
          logitBias['remember'] = 6;
          break;
        case 'partner':
          logitBias['babe'] = 12;
          logitBias['sweetie'] = 10;
          break;
      }
    }

    // Reduce overly formal language
    const avoidTokens = {
      'Furthermore': -10,
      'Moreover': -10,
      'Subsequently': -10,
      'Nevertheless': -8,
      'Therefore': -6
    };

    const seed = this.getConsistentSeed(personalizationContext);

    return {
      logit_bias: { ...signatureTokens, ...avoidTokens, ...logitBias },
      seed
    };
  }

  private getRelationshipInstructions(personalizationContext: PersonalizationContext): string {
    const person = personalizationContext.detectedPerson!;
    
    const baseInstructions = `
RELATIONSHIP CONTEXT:
You are speaking with ${person.name} (${person.relationship}).
${person.nickname ? `Use their nickname "${person.nickname}" naturally in conversation.` : ''}

Personal details about ${person.name}:
${person.personalDetails.map(detail => `- ${detail}`).join('\n')}

CONVERSATION STYLE: ${this.getConversationStyleInstructions(person.greetingStyle)}`;

    // Add relationship-specific instructions
    switch (person.relationship) {
      case 'family':
        return `${baseInstructions}

FAMILY INTERACTION GUIDELINES:
- Reference shared childhood memories and family experiences
- Show genuine care and interest in family updates
- Use warm, loving tone with appropriate family intimacy
- Ask about other family members and shared connections
- Include inside jokes and family references naturally`;

      case 'friend':
        return `${baseInstructions}

FRIEND INTERACTION GUIDELINES:
- Reference shared experiences and mutual friends
- Use casual, warm tone with friendly banter
- Ask about their interests, work, and life updates
- Include memories from time spent together
- Maintain the easy, comfortable dynamic of friendship`;

      case 'partner':
        return `${baseInstructions}

PARTNER INTERACTION GUIDELINES:
- Use loving, intimate tone with playful affection
- Reference shared daily life and future plans
- Show deep care and emotional connection
- Use pet names and terms of endearment naturally
- Include romantic and personal shared experiences`;

      case 'ex':
        return `${baseInstructions}

EX-PARTNER INTERACTION GUIDELINES:
- Maintain friendly but respectful boundaries
- Reference positive shared memories appropriately
- Show care while respecting the past relationship
- Keep tone warm but not overly intimate
- Focus on current life updates and mutual respect`;

      default:
        return baseInstructions;
    }
  }

  private getConversationStyleInstructions(greetingStyle: string): string {
    switch (greetingStyle) {
      case 'intimate':
        return 'Be very personal, loving, and emotionally connected. Use warm, affectionate language.';
      case 'friendly':
        return 'Be warm, casual, and engaging. Show genuine interest and maintain easy rapport.';
      case 'warm':
        return 'Be kind, respectful, and genuinely caring while maintaining appropriate boundaries.';
      default:
        return 'Be conversational and natural while maintaining appropriate social distance.';
    }
  }

  private getConsistentSeed(personalizationContext: PersonalizationContext): number | undefined {
    if (personalizationContext.detectedPerson) {
      // Use consistent seed for same person to maintain personality consistency
      const personHash = personalizationContext.detectedPerson.name
        .split('')
        .reduce((hash, char) => hash + char.charCodeAt(0), 0);
      return personHash % 1000000; // Keep within valid range
    }
    return undefined; // Random for strangers
  }

  /**
   * Detect emotional cues in user message
   */
  detectEmotionalCues(query: string): string[] {
    const queryLower = query.toLowerCase();
    const cues: string[] = [];

    const emotionalPatterns = {
      sad: ['sad', 'difficult', 'hard', 'tough', 'struggling', 'depressed', 'upset', 'down'],
      excited: ['excited', 'amazing', 'awesome', 'celebration', 'great news', 'fantastic', 'thrilled'],
      nostalgic: ['remember', 'back then', 'old days', 'used to', 'miss', 'childhood', 'memories'],
      worried: ['worried', 'concerned', 'anxious', 'nervous', 'scared', 'afraid'],
      happy: ['happy', 'joy', 'glad', 'pleased', 'delighted', 'cheerful']
    };

    for (const [emotion, patterns] of Object.entries(emotionalPatterns)) {
      if (patterns.some(pattern => queryLower.includes(pattern))) {
        cues.push(emotion);
      }
    }

    return cues;
  }
}

export const advancedChatOptimization = AdvancedChatOptimization.getInstance();