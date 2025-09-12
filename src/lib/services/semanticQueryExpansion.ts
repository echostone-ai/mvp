/**
 * Semantic Query Expansion Service
 * 
 * Addresses the core issue where different phrasings of the same question
 * ("celebrity encounters" vs "met celebrities") fail to retrieve the same memories.
 * 
 * This service expands user queries with semantically related terms, synonyms,
 * and contextual variations to ensure comprehensive memory retrieval.
 */

export interface QueryExpansion {
  originalQuery: string;
  expandedTerms: string[];
  semanticClusters: string[][];
  contextualVariations: string[];
  confidence: number;
}

export interface SemanticMapping {
  concept: string;
  variations: string[];
  relatedTerms: string[];
  contextualPhrases: string[];
}

export class SemanticQueryExpansionService {
  private static instance: SemanticQueryExpansionService;
  private semanticMappings: Map<string, SemanticMapping> = new Map();

  static getInstance(): SemanticQueryExpansionService {
    if (!SemanticQueryExpansionService.instance) {
      SemanticQueryExpansionService.instance = new SemanticQueryExpansionService();
    }
    return SemanticQueryExpansionService.instance;
  }

  constructor() {
    this.initializeSemanticMappings();
  }

  private initializeSemanticMappings() {
    // Animals and Creatures - Semantic Relationships
    this.semanticMappings.set('snakes', {
      concept: 'snake_encounters',
      variations: [
        'snake', 'snakes', 'serpent', 'serpents', 'cobra', 'cobras', 'python', 'pythons',
        'viper', 'vipers', 'rattlesnake', 'rattlesnakes', 'boa', 'boas',
        'snake bite', 'snake bites', 'bitten by snake', 'snake encounter', 'snake story',
        'snake stories', 'snake phobia', 'snake fear', 'afraid of snakes', 'terrified of snakes',
        'snake charmer', 'snake charmers', 'cobra charmer', 'cobra charmers'
      ],
      relatedTerms: ['reptile', 'reptiles', 'venomous', 'poisonous', 'slither', 'hiss'],
      contextualPhrases: ['snake in the grass', 'snake oil', 'snake pit', 'snake eyes']
    });

    // Celebrity/Famous People Encounters
    this.semanticMappings.set('celebrities', {
      concept: 'celebrity_encounters',
      variations: [
        'celebrities', 'celebrity', 'famous people', 'famous person', 'stars', 'star',
        'celebrity encounters', 'celebrity meetings', 'famous encounters', 'celebrity experiences',
        'met celebrities', 'meeting celebrities', 'celebrity interactions', 'famous interactions',
        'celebrity stories', 'famous stories', 'celebrity moments', 'famous moments',
        'celebrity sightings', 'famous sightings', 'celebrity run-ins', 'famous run-ins'
      ],
      relatedTerms: [
        'chuck d', 'thom yorke', 'radiohead', 'public enemy', 'guns n roses',
        'red hot chili peppers', 'ryan gosling', 'natalie portman', 'michael fassbender',
        'terrence malick', 'austin city limits', 'concerts', 'shows', 'performances',
        'backstage', 'onstage', 'meet and greet', 'talked to', 'chatted with',
        'stood next to', 'performed with'
      ],
      contextualPhrases: [
        'have you met any', 'did you meet', 'any encounters with', 'experiences with',
        'stories about', 'interactions with', 'run into any', 'come across any',
        'bumped into', 'crossed paths with', 'had conversations with'
      ]
    });

    // Music/Musical Experiences
    this.semanticMappings.set('music', {
      concept: 'musical_experiences',
      variations: [
        'music', 'musical', 'songs', 'bands', 'artists', 'musicians', 'concerts',
        'shows', 'performances', 'albums', 'tracks', 'genres', 'instruments',
        'guitar', 'playing music', 'musical taste', 'favorite music', 'music preferences'
      ],
      relatedTerms: [
        'beatles', 'nirvana', 'philip glass', 'velvet underground', 'voidz',
        'classical', 'delta blues', 'experimental electronic', 'orthodox chants',
        'beach boys', 'elvis', 'lenny kravitz', 'ace of base', 'radiohead',
        'daft punk', 'thom yorke', 'guitar', 'cassette', 'cd player'
      ],
      contextualPhrases: [
        'what music do you', 'favorite music', 'musical taste', 'listen to',
        'play any instruments', 'musical background', 'music journey',
        'first album', 'first song', 'musical influences', 'concerts attended'
      ]
    });

    // Travel/Places/Living Experiences
    this.semanticMappings.set('travel', {
      concept: 'travel_living_experiences',
      variations: [
        'travel', 'traveled', 'traveling', 'places', 'locations', 'countries',
        'cities', 'lived', 'living', 'moved', 'moving', 'relocating',
        'adventures', 'journeys', 'trips', 'visits', 'destinations',
        'experiences abroad', 'international', 'overseas'
      ],
      relatedTerms: [
        'vancouver island', 'maine', 'austin', 'texas', 'sofia', 'bulgaria',
        'valencia', 'spain', 'budapest', 'hungary', 'prague', 'czech',
        'croatia', 'verteillac', 'france', 'montreal', 'toronto',
        'panama', 'costa rica', 'montenegro', 'albania', 'bucharest'
      ],
      contextualPhrases: [
        'where have you', 'places you\'ve', 'countries visited', 'lived in',
        'time in', 'experiences in', 'stories from', 'adventures in',
        'what was it like', 'how long in', 'favorite places'
      ]
    });

    // Relationships/People
    this.semanticMappings.set('relationships', {
      concept: 'relationships_people',
      variations: [
        'relationships', 'friends', 'family', 'people', 'partner', 'girlfriend',
        'boyfriend', 'spouse', 'brother', 'sister', 'parents', 'mom', 'dad',
        'close friends', 'best friends', 'social circle', 'connections'
      ],
      relatedTerms: [
        'tyler', 'krissy', 'geoff', 'boris', 'eric', 'mary', 'tia',
        'matheus', 'carter', 'cansu', 'georgette', 'jason', 'justin'
      ],
      contextualPhrases: [
        'tell me about', 'who is', 'relationship with', 'close to',
        'important people', 'people in your life', 'family members',
        'friends from', 'met through', 'known since'
      ]
    });

    // Pets/Animals
    this.semanticMappings.set('pets', {
      concept: 'pets_animals',
      variations: [
        'pets', 'pet', 'animals', 'dogs', 'dog', 'poodles', 'poodle',
        'companions', 'furry friends', 'four-legged friends'
      ],
      relatedTerms: [
        'romeo', 'bucky', 'george', 'olive', 'gus', 'una', 'harley',
        'toy poodle', 'black poodle', 'french bulldog', 'street dog',
        'beagle', 'terrier', 'chihuahua'
      ],
      contextualPhrases: [
        'tell me about', 'had any pets', 'current pets', 'past pets',
        'dog stories', 'pet experiences', 'animal companions'
      ]
    });

    // Career/Work/Projects
    this.semanticMappings.set('work', {
      concept: 'career_work_projects',
      variations: [
        'work', 'job', 'career', 'profession', 'projects', 'business',
        'freelancing', 'entrepreneurship', 'ventures', 'endeavors',
        'professional', 'occupation', 'employment'
      ],
      relatedTerms: [
        'echostone', 'freelancing', 'digital projects', 'boat parties',
        'electric aquatic club', 'writing', 'museum', 'artifacts',
        'curiosities', 'storytelling', 'ai projects'
      ],
      contextualPhrases: [
        'what do you do', 'your work', 'professional background',
        'career path', 'projects working on', 'business ventures',
        'entrepreneurial', 'freelance work'
      ]
    });

    // Experiences/Adventures/Stories
    this.semanticMappings.set('experiences', {
      concept: 'experiences_adventures_stories',
      variations: [
        'experiences', 'adventures', 'stories', 'moments', 'memories',
        'encounters', 'incidents', 'events', 'happenings', 'situations',
        'anecdotes', 'tales', 'episodes', 'occurrences'
      ],
      relatedTerms: [
        'snake bite', 'france', 'morocco', 'cobra charmer', 'marrakech',
        'wooden snakes', 'terrifying', 'security guard', 'delegation',
        'artists', 'influencers', 'square'
      ],
      contextualPhrases: [
        'any interesting', 'tell me about', 'what happened', 'experiences with',
        'stories about', 'adventures in', 'memorable moments', 'crazy stories',
        'wild experiences', 'unusual encounters'
      ]
    });
  }

  /**
   * Expand a user query with semantically related terms using intelligent analysis
   */
  expandQuery(query: string): QueryExpansion {
    const queryLower = query.toLowerCase();
    const expandedTerms: string[] = [];
    const semanticClusters: string[][] = [];
    const contextualVariations: string[] = [];
    let maxConfidence = 0;

    // Intelligent semantic analysis - connect related concepts
    const intelligentExpansions = this.getIntelligentExpansions(queryLower);
    expandedTerms.push(...intelligentExpansions);

    // Find matching semantic mappings
    for (const [key, mapping] of this.semanticMappings) {
      let confidence = 0;
      const matchedTerms: string[] = [];

      // Check for direct variations
      for (const variation of mapping.variations) {
        if (queryLower.includes(variation.toLowerCase())) {
          confidence += 1.0;
          matchedTerms.push(variation);
          expandedTerms.push(...mapping.variations);
          expandedTerms.push(...mapping.relatedTerms);
        }
      }

      // Check for contextual phrases
      for (const phrase of mapping.contextualPhrases) {
        if (queryLower.includes(phrase.toLowerCase())) {
          confidence += 0.8;
          matchedTerms.push(phrase);
          expandedTerms.push(...mapping.variations);
          contextualVariations.push(...mapping.contextualPhrases);
        }
      }

      // Check for related terms
      for (const term of mapping.relatedTerms) {
        if (queryLower.includes(term.toLowerCase())) {
          confidence += 0.6;
          matchedTerms.push(term);
          expandedTerms.push(...mapping.variations);
        }
      }

      if (matchedTerms.length > 0) {
        semanticClusters.push(matchedTerms);
        maxConfidence = Math.max(maxConfidence, confidence);
      }
    }

    // Remove duplicates and normalize
    const uniqueExpandedTerms = [...new Set(expandedTerms)];
    const uniqueContextualVariations = [...new Set(contextualVariations)];

    return {
      originalQuery: query,
      expandedTerms: uniqueExpandedTerms,
      semanticClusters,
      contextualVariations: uniqueContextualVariations,
      confidence: maxConfidence
    };
  }

  /**
   * Generate alternative phrasings of a query
   */
  generateQueryVariations(query: string): string[] {
    const variations: string[] = [query];
    const queryLower = query.toLowerCase();

    // Celebrity-specific transformations
    if (queryLower.includes('celebrity encounters') || queryLower.includes('celebrity experiences')) {
      variations.push(
        query.replace(/celebrity encounters?/gi, 'met celebrities'),
        query.replace(/celebrity encounters?/gi, 'celebrity meetings'),
        query.replace(/celebrity encounters?/gi, 'famous people'),
        query.replace(/celebrity experiences?/gi, 'met famous people'),
        query.replace(/celebrity experiences?/gi, 'celebrity stories')
      );
    }

    if (queryLower.includes('met celebrities') || queryLower.includes('meet celebrities')) {
      variations.push(
        query.replace(/met celebrities/gi, 'celebrity encounters'),
        query.replace(/meet celebrities/gi, 'celebrity encounters'),
        query.replace(/met celebrities/gi, 'famous encounters'),
        query.replace(/meet celebrities/gi, 'celebrity experiences')
      );
    }

    // Music-specific transformations
    if (queryLower.includes('favorite music') || queryLower.includes('music taste')) {
      variations.push(
        query.replace(/favorite music/gi, 'musical preferences'),
        query.replace(/music taste/gi, 'musical taste'),
        query.replace(/favorite music/gi, 'music you like'),
        query.replace(/music taste/gi, 'music preferences')
      );
    }

    // Travel-specific transformations
    if (queryLower.includes('places lived') || queryLower.includes('where lived')) {
      variations.push(
        query.replace(/places lived/gi, 'travel experiences'),
        query.replace(/where lived/gi, 'places you\'ve been'),
        query.replace(/places lived/gi, 'countries visited'),
        query.replace(/where lived/gi, 'travel history')
      );
    }

    return [...new Set(variations)];
  }

  /**
   * Extract key concepts from a query for better matching
   */
  extractKeyConcepts(query: string): string[] {
    const concepts: string[] = [];
    const queryLower = query.toLowerCase();

    for (const [key, mapping] of this.semanticMappings) {
      for (const variation of mapping.variations) {
        if (queryLower.includes(variation.toLowerCase())) {
          concepts.push(mapping.concept);
          break;
        }
      }
    }

    return [...new Set(concepts)];
  }

  /**
   * Get enhanced keywords for factbook search
   */
  getEnhancedKeywords(query: string): string[] {
    const expansion = this.expandQuery(query);
    const variations = this.generateQueryVariations(query);
    
    // Combine original query words with expanded terms
    const originalWords = query.toLowerCase().split(/\s+/);
    const allTerms = [
      ...originalWords,
      ...expansion.expandedTerms,
      ...variations.flatMap(v => v.toLowerCase().split(/\s+/))
    ];

    // Filter out common words and normalize
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'any', 'some', 'all', 'no', 'not', 'you', 'your', 'i', 'my', 'me', 'we', 'us', 'they', 'them', 'their', 'it', 'its', 'this', 'that', 'these', 'those']);
    
    const filteredTerms = allTerms
      .filter(term => term.length > 2 && !stopWords.has(term))
      .map(term => term.replace(/[^\w]/g, ''))
      .filter(term => term.length > 1);

    return [...new Set(filteredTerms)];
  }

  /**
   * Intelligent semantic expansion using contextual understanding
   */
  private getIntelligentExpansions(query: string): string[] {
    const expansions: string[] = [];

    // Snake-related intelligent connections (bidirectional)
    if (this.matchesPattern(query, ['snake', 'serpent', 'reptile', 'slither', 'bite', 'phobia', 'fear', 'stories', 'encounters'])) {
      expansions.push('cobra', 'python', 'viper', 'rattlesnake', 'boa', 'charmer', 'morocco', 'france', 'terrified', 'therapy', 'bite', 'bitten', 'woods', 'rocky', 'ledge');
    }

    // Cobra specifically should connect to snakes
    if (this.matchesPattern(query, ['cobra', 'charmer'])) {
      expansions.push('snake', 'serpent', 'reptile', 'morocco', 'street', 'performance', 'exotic', 'culture', 'bite', 'phobia', 'terrified');
    }

    // Reptile should connect to all snake-related content
    if (this.matchesPattern(query, ['reptile', 'reptiles'])) {
      expansions.push('snake', 'snakes', 'cobra', 'charmer', 'morocco', 'france', 'bite', 'bitten', 'phobia', 'terrified', 'therapy');
    }

    // Celebrity/famous people connections
    if (this.matchesPattern(query, ['celebrity', 'famous', 'star', 'met', 'encounter', 'meeting'])) {
      expansions.push('obama', 'clinton', 'murray', 'gosling', 'yorke', 'chuck', 'tyson', 'hawke', 'concert', 'event', 'austin', 'sofia');
    }

    // Music connections
    if (this.matchesPattern(query, ['music', 'musician', 'band', 'concert', 'show', 'song', 'album'])) {
      expansions.push('guitar', 'drums', 'performance', 'stage', 'artist', 'radiohead', 'doors', 'beatles', 'hendrix', 'austin', 'sofia');
    }

    // Travel connections
    if (this.matchesPattern(query, ['travel', 'trip', 'visit', 'country', 'city', 'place'])) {
      expansions.push('europe', 'austin', 'maine', 'sofia', 'bulgaria', 'france', 'spain', 'croatia', 'prague', 'budapest', 'morocco');
    }

    // Pet connections
    if (this.matchesPattern(query, ['pet', 'dog', 'puppy', 'animal', 'companion'])) {
      expansions.push('poodle', 'romeo', 'bucky', 'george', 'olive', 'gus', 'una', 'energetic', 'toy', 'black', 'leash');
    }

    // Adventure/experience connections
    if (this.matchesPattern(query, ['adventure', 'experience', 'story', 'memory', 'encounter', 'incident'])) {
      expansions.push('snake', 'bite', 'cobra', 'morocco', 'budapest', 'covid', 'scary', 'therapy', 'phobia', 'france');
    }

    return Array.from(new Set(expansions));
  }

  /**
   * Check if query matches any of the given patterns
   */
  private matchesPattern(query: string, patterns: string[]): boolean {
    return patterns.some(pattern => query.includes(pattern.toLowerCase()));
  }
}

export const semanticQueryExpansionService = SemanticQueryExpansionService.getInstance();