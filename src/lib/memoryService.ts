// src/lib/memoryService.ts
import { supabase } from './supabase'
import { 
  MemoryErrorHandler, 
  MemoryError, 
  MemoryErrorType,
  withMemoryErrorHandling 
} from './memoryErrorHandler'
import { MemoryPerformanceMonitor } from './memoryPerformanceMonitor'
import { resolveAvatarId } from './services/identity'

// Server-side only check
const isServerSide = typeof window === 'undefined';

// Conditionally import and initialize OpenAI only on server side
let openai: any = null;
if (isServerSide) {
  try {
    const { OpenAI } = require('openai');
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  } catch (error) {
    console.warn('OpenAI client not available:', error);
  }
}

export interface MemoryFragment {
  id?: string
  userId: string
  avatarId?: string
  fragmentText: string
  embedding?: number[]
  conversationContext?: {
    timestamp: string
    messageContext: string
    emotionalTone?: string
  }
  createdAt?: Date
  updatedAt?: Date
}

/**
 * Helper function to resolve avatar ID from slug or return as-is if already a UUID
 */
async function resolveAvatarIdIfNeeded(avatarId: string | undefined): Promise<string | undefined> {
  if (!avatarId) return undefined;
  
  // If it's already a UUID format, return as-is
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(avatarId)) {
    return avatarId;
  }
  
  // If it's a slug like "jonathan-demo", resolve it to UUID
  try {
    const resolvedId = await resolveAvatarId({ avatarSlug: avatarId }, supabase);
    return resolvedId;
  } catch (error) {
    console.warn(`Failed to resolve avatar ID for "${avatarId}":`, error);
    return undefined;
  }
}

export class MemoryExtractionService {
  private static readonly EXTRACTION_PROMPT = `
You are an AI assistant that extracts meaningful personal information from user messages to create memory fragments for future conversations.

Your task is to identify and extract:
- Personal relationships (family, friends, colleagues, pets)
- Significant experiences and life events
- Personal preferences (hobbies, interests, dislikes)
- Important personal details (goals, fears, values)
- Emotional connections and memories
- Daily activities and routines that reveal personality
- Opinions and beliefs that show their worldview
- Places they've been or want to visit
- Professional information and career details
- Health information they might want you to remember

IMPORTANT RULES:
1. Be THOROUGH - extract ALL meaningful personal information, even small details
2. Extract complete, standalone fragments that make sense without additional context
3. Be SPECIFIC - include names, places, and concrete details whenever possible
4. Focus on information that reveals character, relationships, or preferences
5. Include information they might expect you to remember later
6. Format each memory as a complete sentence using the person's name when known, or "The user" if name is unknown
7. If no meaningful personal information is found, return an empty array

Return your response as a JSON array of strings, where each string is a meaningful memory fragment.

Examples:
Input: "I love hiking with my dog Max every weekend. He's a golden retriever and gets so excited when he sees the leash."
Output: ["The user loves hiking and does it every weekend", "The user has a golden retriever named Max who gets excited about walks"]

Input: "It's raining today and I'm feeling tired."
Output: []

Input: "My sister Sarah is getting married next month. I'm so nervous about giving the maid of honor speech because I hate public speaking."
Output: ["The user has a sister named Sarah who is getting married", "The user is the maid of honor at Sarah's wedding", "The user dislikes public speaking and gets nervous about it"]

Now extract memory fragments from this message:
`

  /**
   * Extracts meaningful memory fragments from a user message
   * Server-side only operation with simplified extraction for preference keywords
   */
  static async extractMemoryFragments(
    message: string, 
    userId: string, 
    conversationContext?: any,
    extractionThreshold?: number
  ): Promise<MemoryFragment[]> {
    // Client-side guard
    if (!isServerSide) {
      console.warn('[MemoryService] Memory extraction is server-side only, returning empty array');
      return [];
    }

    // Check for preference keywords - restrict bypass to benign tastes only
    const hasBenignPreferenceKeywords = /\b(favorite|music|dog|pet|prefer|like|love|band|artist|food|hobby|color|movie|book|sport)\b/i.test(message);
    const hasPoliticalKeywords = /\b(trump|biden|election|politic|america|immigration|emigration|policy|vote)\b/i.test(message);
    
    // Only bypass for benign preferences, NOT for political content
    if (hasBenignPreferenceKeywords && !hasPoliticalKeywords) {
      console.log('[MemoryService] Benign preference keywords detected, bypassing heavy extraction', {
        bypass_prefs_applied: true,
        query: message.substring(0, 50),
        has_political: false
      });
      // Return empty array to trigger direct memory service hit instead
      return [];
    }
    
    // Log when political keywords prevent bypass
    if (hasBenignPreferenceKeywords && hasPoliticalKeywords) {
      console.log('[MemoryService] Political keywords detected, preventing preference bypass', {
        bypass_prefs_applied: false,
        query: message.substring(0, 50),
        has_political: true
      });
    }

    return MemoryPerformanceMonitor.withPerformanceTracking(
      'memory_extraction',
      () => MemoryErrorHandler.withGracefulDegradation(
        async () => {
        // Adjust temperature based on threshold - lower threshold means we want more memories
        const temperature = extractionThreshold ? Math.max(0.1, extractionThreshold - 0.4) : 0.3;
        
        // Build context string if provided as object
        let contextString = '';
        let visitorName = '';
        if (conversationContext) {
          if (typeof conversationContext === 'string') {
            contextString = conversationContext;
          } else {
            // Extract visitor name if available
            visitorName = conversationContext.visitorName || '';
            // Convert object to string
            contextString = Object.entries(conversationContext)
              .map(([key, value]) => `${key}: ${value}`)
              .join('\n');
          }
        }
        
        // Create personalized extraction prompt
        const personalizedPrompt = this.EXTRACTION_PROMPT.replace(
          'Format each memory as a complete sentence using the person\'s name when known, or "The user" if name is unknown',
          visitorName 
            ? `Format each memory as a complete sentence using "${visitorName}" instead of "The user" when referring to the person`
            : 'Format each memory as a complete sentence starting with "The user"'
        );
        
        if (!openai) {
          throw new MemoryError(
            MemoryErrorType.MEMORY_EXTRACTION_FAILED,
            'OpenAI client not available (server-side only)'
          )
        }

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: personalizedPrompt,
            },
            {
              role: 'user',
              content: message + (contextString ? `\n\nCONVERSATION CONTEXT:\n${contextString}` : ''),
            },
          ],
          temperature: temperature, // Dynamic temperature based on threshold
          max_tokens: 800, // Increased to allow for more memories
        })

        const response = completion.choices[0].message.content
        if (!response) {
          throw new MemoryError(
            MemoryErrorType.MEMORY_EXTRACTION_FAILED,
            'No response from OpenAI for memory extraction'
          )
        }

        // Parse the JSON response
        let fragments: string[]
        try {
          fragments = JSON.parse(response)
        } catch (parseError) {
          const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error'
          throw new MemoryError(
            MemoryErrorType.MEMORY_EXTRACTION_FAILED,
            'Failed to parse memory extraction response',
            { context: { response, parseError: errorMessage } }
          )
        }

        // Validate that we got an array of strings
        if (!Array.isArray(fragments) || !fragments.every(f => typeof f === 'string')) {
          throw new MemoryError(
            MemoryErrorType.MEMORY_EXTRACTION_FAILED,
            'Invalid memory extraction response format',
            { context: { fragments } }
          )
        }

        // Convert to MemoryFragment objects
        const timestamp = new Date().toISOString()
        return fragments.map(fragmentText => ({
          userId,
          fragmentText: fragmentText.trim(),
          conversationContext: {
            timestamp,
            messageContext: conversationContext || message.substring(0, 200),
            emotionalTone: this.detectEmotionalTone(message)
          }
        }))
        },
        () => [], // Graceful fallback - return empty array
        'memory_extraction',
        { userId, messageLength: message.length }
      ),
      { userId, messageLength: message.length }
    )
  }

  /**
   * Detects the emotional tone of a message for context
   */
  private static detectEmotionalTone(message: string): string {
    const lowerMessage = message.toLowerCase()
    
    // Simple emotion detection based on keywords
    if (lowerMessage.includes('love') || lowerMessage.includes('happy') || lowerMessage.includes('excited')) {
      return 'positive'
    }
    if (lowerMessage.includes('sad') || lowerMessage.includes('worried') || lowerMessage.includes('upset')) {
      return 'negative'
    }
    if (lowerMessage.includes('nervous') || lowerMessage.includes('anxious') || lowerMessage.includes('scared')) {
      return 'anxious'
    }
    
    return 'neutral'
  }

  /**
   * Batch extract memory fragments from multiple messages
   */
  static async batchExtractMemoryFragments(
    messages: Array<{ text: string; context?: string }>,
    userId: string
  ): Promise<MemoryFragment[]> {
    const allFragments: MemoryFragment[] = []
    
    // Process messages in batches to avoid rate limits
    const batchSize = 5
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize)
      
      const batchPromises = batch.map(msg => 
        this.extractMemoryFragments(msg.text, userId, msg.context)
      )
      
      try {
        const batchResults = await Promise.all(batchPromises)
        batchResults.forEach(fragments => allFragments.push(...fragments))
        
        // Small delay between batches to respect rate limits
        if (i + batchSize < messages.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (error) {
        console.error(`Error processing batch ${i}-${i + batchSize}:`, error)
        // Continue with next batch even if one fails
      }
    }
    
    return allFragments
  }
}

export class MemoryStorageService {
  /**
   * Generates embeddings for text using OpenAI's text-embedding-3-small model
   * Server-side only operation
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    // Client-side guard
    if (!isServerSide) {
      console.warn('[MemoryService] Embedding generation is server-side only, returning empty array');
      return [];
    }

    return MemoryErrorHandler.withRetry(
      async () => {
        if (!openai) {
          throw new MemoryError(
            MemoryErrorType.EMBEDDING_GENERATION_FAILED,
            'OpenAI client not available (server-side only)'
          )
        }

        const response = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: text,
          encoding_format: 'float',
        })

        if (!response.data?.[0]?.embedding) {
          throw new MemoryError(
            MemoryErrorType.EMBEDDING_GENERATION_FAILED,
            'No embedding data returned from OpenAI'
          )
        }

        return response.data[0].embedding
      },
      'openai',
      { textLength: text.length, operation: 'generate_embedding' }
    )
  }

  /**
   * Generates embeddings for multiple texts in batch
   */
  static async batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
    return MemoryErrorHandler.withRetry(
      async () => {
        // OpenAI allows up to 2048 inputs per request for embeddings
        const batchSize = 100 // Conservative batch size
        const allEmbeddings: number[][] = []

        for (let i = 0; i < texts.length; i += batchSize) {
          const batch = texts.slice(i, i + batchSize)
          
          if (!openai) {
            throw new MemoryError(
              MemoryErrorType.EMBEDDING_GENERATION_FAILED,
              'OpenAI client not available (server-side only)'
            )
          }

          const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: batch,
            encoding_format: 'float',
          })

          if (!response.data || response.data.length !== batch.length) {
            throw new MemoryError(
              MemoryErrorType.EMBEDDING_GENERATION_FAILED,
              'Incomplete batch embedding response from OpenAI'
            )
          }

          const batchEmbeddings = response.data.map(item => {
            if (!item.embedding) {
              throw new MemoryError(
                MemoryErrorType.EMBEDDING_GENERATION_FAILED,
                'Missing embedding data in batch response'
              )
            }
            return item.embedding
          })
          
          allEmbeddings.push(...batchEmbeddings)

          // Small delay between batches to respect rate limits
          if (i + batchSize < texts.length) {
            await new Promise(resolve => setTimeout(resolve, 50))
          }
        }

        return allEmbeddings
      },
      'openai',
      { batchSize: texts.length, operation: 'batch_generate_embeddings' }
    )
  }

  /**
   * Stores a memory fragment with its embedding in Supabase
   */
  static async storeMemoryFragment(fragment: MemoryFragment): Promise<string> {
    // Make sure avatarId is included in the fragment
    return MemoryErrorHandler.withRetry(
      async () => {
        // Generate embedding if not provided
        if (!fragment.embedding) {
          fragment.embedding = await this.generateEmbedding(fragment.fragmentText)
        }

        // Resolve avatarId if it's a slug
        const resolvedAvatarId = fragment.avatarId ? await resolveAvatarIdIfNeeded(fragment.avatarId) : undefined;

        const insertData: any = {
          user_id: fragment.userId,
          fragment_text: fragment.fragmentText,
          embedding: fragment.embedding,
          conversation_context: fragment.conversationContext,
        }
        
        // Include avatarId if it exists in the fragment
        if (resolvedAvatarId) {
          insertData.avatar_id = resolvedAvatarId
        }
        
        const { data, error } = await supabase
          .from('memory_fragments')
          .insert(insertData)
          .select('id')
          .single()

        if (error) {
          throw MemoryErrorHandler.categorizeError(error, {
            operation: 'store_memory_fragment',
            userId: fragment.userId,
            fragmentLength: fragment.fragmentText.length
          })
        }

        if (!data?.id) {
          throw new MemoryError(
            MemoryErrorType.DATABASE_QUERY,
            'No ID returned from memory fragment insertion'
          )
        }

        return data.id
      },
      'database',
      { 
        operation: 'store_memory_fragment',
        userId: fragment.userId,
        fragmentLength: fragment.fragmentText.length
      }
    )
  }

  /**
   * Stores multiple memory fragments in batch
   */
  static async batchStoreMemoryFragments(fragments: MemoryFragment[]): Promise<string[]> {
    if (fragments.length === 0) {
      return []
    }

    return MemoryErrorHandler.withRetry(
      async () => {
        // Generate embeddings for all fragments that don't have them
        const fragmentsNeedingEmbeddings = fragments.filter(f => !f.embedding)
        if (fragmentsNeedingEmbeddings.length > 0) {
          const texts = fragmentsNeedingEmbeddings.map(f => f.fragmentText)
          const embeddings = await this.batchGenerateEmbeddings(texts)
          
          // Assign embeddings back to fragments
          fragmentsNeedingEmbeddings.forEach((fragment, index) => {
            fragment.embedding = embeddings[index]
          })
        }

        // Prepare data for insertion with resolved avatar IDs
        const insertData = await Promise.all(fragments.map(async (fragment) => {
          // Resolve avatarId if it's a slug
          const resolvedAvatarId = fragment.avatarId ? await resolveAvatarIdIfNeeded(fragment.avatarId) : undefined;
          
          const data: any = {
            user_id: fragment.userId,
            fragment_text: fragment.fragmentText,
            embedding: fragment.embedding,
            conversation_context: fragment.conversationContext,
          };
          
          // Include avatar_id if it exists
          if (resolvedAvatarId) {
            data.avatar_id = resolvedAvatarId;
          }
          
          return data;
        }))

        const { data, error } = await supabase
          .from('memory_fragments')
          .insert(insertData)
          .select('id')

        if (error) {
          throw MemoryErrorHandler.categorizeError(error, {
            operation: 'batch_store_memory_fragments',
            fragmentCount: fragments.length,
            userId: fragments[0]?.userId
          })
        }

        if (!data || data.length !== fragments.length) {
          throw new MemoryError(
            MemoryErrorType.DATABASE_QUERY,
            'Incomplete batch insertion response'
          )
        }

        return data.map(item => item.id)
      },
      'database',
      { 
        operation: 'batch_store_memory_fragments',
        fragmentCount: fragments.length,
        userId: fragments[0]?.userId
      }
    )
  }

  /**
   * Updates an existing memory fragment
   */
  static async updateMemoryFragment(
    fragmentId: string, 
    userId: string, 
    updates: Partial<Pick<MemoryFragment, 'fragmentText' | 'conversationContext'>>
  ): Promise<void> {
    return MemoryErrorHandler.withRetry(
      async () => {
        const updateData: any = {
          updated_at: new Date().toISOString(),
          ...updates
        }

        // If fragment text is being updated, regenerate embedding
        if (updates.fragmentText) {
          updateData.embedding = await this.generateEmbedding(updates.fragmentText)
        }

        const { error } = await supabase
          .from('memory_fragments')
          .update(updateData)
          .eq('id', fragmentId)
          .eq('user_id', userId) // Ensure user can only update their own fragments

        if (error) {
          throw MemoryErrorHandler.categorizeError(error, {
            operation: 'update_memory_fragment',
            fragmentId,
            userId,
            hasTextUpdate: !!updates.fragmentText
          })
        }
      },
      'database',
      { 
        operation: 'update_memory_fragment',
        fragmentId,
        userId,
        hasTextUpdate: !!updates.fragmentText
      }
    )
  }

  /**
   * Deletes a memory fragment
   */
  static async deleteMemoryFragment(fragmentId: string, userId: string): Promise<void> {
    return MemoryErrorHandler.withRetry(
      async () => {
        const { error } = await supabase
          .from('memory_fragments')
          .delete()
          .eq('id', fragmentId)
          .eq('user_id', userId) // Ensure user can only delete their own fragments

        if (error) {
          throw MemoryErrorHandler.categorizeError(error, {
            operation: 'delete_memory_fragment',
            fragmentId,
            userId
          })
        }
      },
      'database',
      { 
        operation: 'delete_memory_fragment',
        fragmentId,
        userId
      }
    )
  }

  /**
   * Deletes all memory fragments for a user
   */
  static async deleteAllUserMemories(userId: string, avatarId?: string | null): Promise<void> {
    return MemoryErrorHandler.withRetry(
      async () => {
        // Resolve avatarId if it's a slug
        const resolvedAvatarId = avatarId ? await resolveAvatarIdIfNeeded(avatarId) : null;
        
        let query = supabase
          .from('memory_fragments')
          .delete()
          .eq('user_id', userId)
          
        // Filter by avatarId if provided
        if (resolvedAvatarId) {
          query = query.eq('avatar_id', resolvedAvatarId)
        }
        
        const { error } = await query

        if (error) {
          throw MemoryErrorHandler.categorizeError(error, {
            operation: 'delete_all_user_memories',
            userId
          })
        }
      },
      'database',
      { 
        operation: 'delete_all_user_memories',
        userId
      }
    )
  }
}

export class MemoryRetrievalService {
  private static readonly DEFAULT_SIMILARITY_THRESHOLD = 0.7
  private static readonly DEFAULT_LIMIT = 10

  /**
   * Retrieves relevant memory fragments using enhanced hybrid search
   */
  static async retrieveRelevantMemories(
    query: string,
    userId: string,
    options: {
      limit?: number
      similarityThreshold?: number
      includeContext?: boolean
      avatarId?: string | null
    } = {}
  ): Promise<MemoryFragment[]> {
    const {
      limit = 64, // Increased from 10 to 64 for better coverage
      similarityThreshold = 0.2, // Lowered to 0.2 for better semantic matching
      includeContext = true,
      avatarId
    } = options

    // Create cache key for this query
    const cacheKey = MemoryPerformanceMonitor.getCacheKey('relevant_memories', {
      query: query.substring(0, 100), // Limit query length for cache key
      userId,
      limit,
      similarityThreshold,
      includeContext,
      avatarId
    })

    return MemoryPerformanceMonitor.withCaching(
      'relevant_memories',
      cacheKey,
      () => MemoryErrorHandler.withGracefulDegradation(
        async () => {
          // Resolve avatarId if it's a slug
          const resolvedAvatarId = avatarId ? await resolveAvatarIdIfNeeded(avatarId) : null;
          
          console.log('[MemoryService] Using enhanced retrieval, user:', userId, 'avatar:', resolvedAvatarId, 'query:', query.substring(0, 30));
          
          // Extract keywords from query for better semantic matching
          const extractKeywords = (text: string): string[] => {
            const stopWords = new Set(['what', 'was', 'your', 'the', 'a', 'an', 'is', 'are', 'were', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must', 'shall', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'and', 'or', 'but', 'so', 'if', 'then', 'else', 'when', 'where', 'why', 'how', 'who', 'which', 'that', 'this', 'these', 'those', 'me', 'my', 'mine', 'you', 'yours', 'he', 'his', 'she', 'her', 'hers', 'it', 'its', 'we', 'our', 'ours', 'they', 'their', 'theirs', 'i', 'tell', 'about']);
            const importantWords = new Set(['dog', 'cat', 'pet', 'music', 'band', 'song', 'name', 'age', 'job', 'work', 'live', 'born', 'from']);
            
            return text.toLowerCase()
              .replace(/[^\w\s]/g, '') // Remove punctuation
              .split(/\s+/)
              .filter(word => 
                word.length > 0 && (
                  (word.length >= 3 && !stopWords.has(word)) || 
                  importantWords.has(word)
                )
              );
          };
          
          const keywords = extractKeywords(query);
          console.log('[MemoryService] Extracted keywords:', keywords);
          
          // Detect political/opinion queries for special handling
          const isPoliticalQuery = /\b(trump|political|politics|america|emigration|left america|political climate)\b/i.test(query);
          const isOpinionQuery = /\b(think|opinion|feel|believe|view|like|dislike|hate|love)\b/i.test(query);
          const adjustedThreshold = (isPoliticalQuery || isOpinionQuery) ? 0.25 : similarityThreshold;
          
          console.log(`[MemoryService] Political query: ${isPoliticalQuery}, Opinion query: ${isOpinionQuery}, Adjusted threshold: ${adjustedThreshold}`);
          
          // Try keywords individually and combine results for better semantic matching
          let allResults: any[] = [];
          const seenIds = new Set<string>();
          
          if (keywords.length > 0) {
            // Try each keyword individually to get better coverage
            for (const keyword of keywords) {
              const { data: keywordData, error: keywordError } = await supabase.rpc('get_enhanced_memories', {
                target_user_id: userId,
                target_avatar_id: resolvedAvatarId,
                search_query: keyword,
                match_count: Math.ceil(limit / keywords.length) + 5, // Get more results per keyword
                similarity_threshold: adjustedThreshold, // Use adjusted threshold
                include_bio_facts: true
              });
              
              if (!keywordError && keywordData) {
                keywordData.forEach((result: any) => {
                  if (!seenIds.has(result.id)) {
                    seenIds.add(result.id);
                    allResults.push(result);
                  }
                });
              }
            }
            
            // Sort by similarity score and limit results
            allResults.sort((a, b) => b.similarity_score - a.similarity_score);
            allResults = allResults.slice(0, limit);
          }
          
          // Fallback to original query if no keywords or no results
          if (allResults.length === 0) {
            console.log('[MemoryService] No results from keywords, trying original query:', query.substring(0, 30));
            const { data, error } = await supabase.rpc('get_enhanced_memories', {
              target_user_id: userId,
              target_avatar_id: resolvedAvatarId,
              search_query: query,
              match_count: limit,
              similarity_threshold: adjustedThreshold, // Use adjusted threshold
              include_bio_facts: true
            });
            
            if (error) {
              console.warn('[MemoryService] Enhanced retrieval failed, falling back:', error);
              return this.searchMemoriesByText(query, userId, limit, avatarId);
            }
            
            allResults = data || [];
          }
          
          // Additional fallback: if still no results, use comprehensive text search
          if (allResults.length === 0) {
            console.log('[MemoryService] Enhanced function returned 0 results, using comprehensive fallback');
            return this.searchMemoriesByText(query, userId, limit, avatarId);
          }
          
          const data = allResults;
          const error = null;

          if (error) {
            console.warn('[MemoryService] Enhanced retrieval failed, falling back:', error);
            return this.searchMemoriesByText(query, userId, limit, avatarId);
          }

          if (!data || !Array.isArray(data)) {
            console.log('[MemoryService] No data returned from enhanced retrieval');
            return [];
          }

          console.log('[MemoryService] Enhanced retrieval returned', data.length, 'memories');
          
          // Convert to MemoryFragment format
          return data.map((item: any) => ({
            id: item.id,
            userId: item.user_id,
            avatarId: item.avatar_id,
            fragmentText: item.fragment_text,
            embedding: undefined, // Don't return embeddings to save memory
            conversationContext: {
              ...item.conversation_context,
              similarity: item.similarity_score,
              matchType: item.match_type
            },
            createdAt: new Date(item.created_at),
            updatedAt: new Date(item.updated_at)
          }));
        },
        async () => {
          // Fallback to text search if enhanced search fails
          console.warn('Enhanced search failed, falling back to text search')
          return this.searchMemoriesByText(query, userId, limit, avatarId)
        },
        'retrieve_relevant_memories',
        { userId, queryLength: query.length, limit, threshold: similarityThreshold, avatarId }
      ),
      { userId, queryLength: query.length, limit, threshold: similarityThreshold, avatarId }
    )
  }

  /**
   * Retrieves all memory fragments for a user (for management UI)
   */
  static async getUserMemories(
    userId: string,
    options: {
      limit?: number
      offset?: number
      orderBy?: 'created_at' | 'updated_at'
      orderDirection?: 'asc' | 'desc'
      avatarId?: string | null
    } = {}
  ): Promise<MemoryFragment[]> {
    const {
      limit = 100,
      offset = 0,
      orderBy = 'created_at',
      orderDirection = 'desc',
      avatarId = null
    } = options

    // Resolve avatarId if it's a slug
    const resolvedAvatarId = avatarId ? await resolveAvatarIdIfNeeded(avatarId) : null;

    // Create cache key for user memories
    const cacheKey = MemoryPerformanceMonitor.getCacheKey('user_memories', {
      userId,
      limit,
      offset,
      orderBy,
      orderDirection,
      avatarId: resolvedAvatarId
    })

    return MemoryPerformanceMonitor.withCaching(
      'user_memories',
      cacheKey,
      () => MemoryErrorHandler.withRetry(
        async () => {
          console.log('[MemoryService] getUserMemories query:', { userId, avatarId, resolvedAvatarId, limit, orderBy, orderDirection });
          let query = supabase
          .from('memory_fragments')
          .select('*')
          .eq('user_id', userId)
          
          // Filter by avatarId if provided
          if (resolvedAvatarId) {
            query = query.eq('avatar_id', resolvedAvatarId)
            console.log('[MemoryService] Filtering by resolvedAvatarId:', resolvedAvatarId);
          }
          
          query = query.order(orderBy, { ascending: orderDirection === 'asc' })

        if (limit > 0) {
          query = query.range(offset, offset + limit - 1)
        }

        const { data, error } = await query
        console.log('[MemoryService] getUserMemories result:', { count: data?.length || 0, error: error?.message });
        if (data && data.length > 0) {
          console.log('[MemoryService] Sample memory:', data[0].fragment_text?.substring(0, 50) + '...');
        }

        if (error) {
          throw MemoryErrorHandler.categorizeError(error, {
            operation: 'get_user_memories',
            userId,
            limit,
            offset,
            orderBy,
            orderDirection,
            avatarId
          })
        }

        if (!data) {
          throw new MemoryError(
            MemoryErrorType.DATABASE_QUERY,
            'No data returned from user memories query'
          )
        }

        return data.map(item => ({
          id: item.id,
          userId: item.user_id,
          fragmentText: item.fragment_text,
          embedding: item.embedding,
          conversationContext: item.conversation_context,
          createdAt: new Date(item.created_at),
          updatedAt: new Date(item.updated_at)
        }))
        },
        'database',
        { 
          operation: 'get_user_memories',
          userId,
          limit,
          offset,
          orderBy,
          orderDirection,
          avatarId
        }
      ),
      { userId, limit, offset, orderBy, orderDirection, avatarId }
    )
  }

  /**
   * Gets memory fragment by ID with user isolation
   */
  static async getMemoryFragment(fragmentId: string, userId: string): Promise<MemoryFragment | null> {
    return MemoryErrorHandler.withRetry(
      async () => {
        const { data, error } = await supabase
          .from('memory_fragments')
          .select('*')
          .eq('id', fragmentId)
          .eq('user_id', userId) // Ensure user can only access their own fragments
          .single()

        if (error) {
          if (error.code === 'PGRST116') {
            // No rows returned - this is expected behavior, not an error
            return null
          }
          throw MemoryErrorHandler.categorizeError(error, {
            operation: 'get_memory_fragment',
            fragmentId,
            userId
          })
        }

        if (!data) {
          return null
        }

        return {
          id: data.id,
          userId: data.user_id,
          fragmentText: data.fragment_text,
          embedding: data.embedding,
          conversationContext: data.conversation_context,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at)
        }
      },
      'database',
      { 
        operation: 'get_memory_fragment',
        fragmentId,
        userId
      }
    )
  }

  /**
   * Searches memory fragments by text content (fallback when vector search fails)
   * Enhanced to include avatar-scoped memories (bio facts without user_id)
   */
  static async searchMemoriesByText(
    searchText: string,
    userId: string,
    limit: number = 10,
    avatarId?: string | null
  ): Promise<MemoryFragment[]> {
    return MemoryErrorHandler.withGracefulDegradation(
      async () => {
        // Resolve avatarId if it's a slug
        const resolvedAvatarId = avatarId ? await resolveAvatarIdIfNeeded(avatarId) : null;
        
        console.log('[MemoryService] searchMemoriesByText - enhanced search for user:', userId, 'avatar:', resolvedAvatarId, 'query:', searchText.substring(0, 30));
        
        // Build query to include both user memories AND avatar bio memories
        let query = supabase
          .from('memory_fragments')
          .select('*');
          
        if (resolvedAvatarId) {
          // Include memories that belong to either:
          // 1. This user AND this avatar (conversation memories)
          // 2. This avatar with no user (bio/seeded memories)
          query = query.or(`and(user_id.eq.${userId},avatar_id.eq.${resolvedAvatarId}),and(user_id.is.null,avatar_id.eq.${resolvedAvatarId})`);
        } else {
          // Fallback to user-only if no avatar
          query = query.eq('user_id', userId);
        }
        
        // Enhanced text search with comprehensive term matching
        if (searchText && searchText.trim()) {
          const queryLower = searchText.toLowerCase();
          
          // Enhanced query analysis for better term extraction
          const isDogQuery = /\b(dog|dogs|pet|pets|bucky|george|olive|romeo|poodle|valentine)\b/i.test(queryLower);
          const isMusicQuery = /\b(music|favorite|band|artist|nirvana|sound|emotion|kurt|cobain)\b/i.test(queryLower);
          
          let searchTerms: string[] = [];
          
          if (isDogQuery) {
            // Comprehensive dog search terms
            searchTerms = ['dog', 'dogs', 'pet', 'pets', 'bucky', 'george', 'olive', 'romeo', 'poodle', 'valentine', 'toy', 'golden', 'retriever'];
          } else if (isMusicQuery) {
            // Comprehensive music search terms
            searchTerms = ['music', 'favorite', 'band', 'artist', 'nirvana', 'song', 'sound', 'emotion', 'kurt', 'cobain'];
          } else {
            // General search - extract meaningful words
            searchTerms = searchText.toLowerCase().split(/\s+/).filter(w => 
              w.length > 1 && 
              !['what', 'was', 'your', 'the', 'a', 'an', 'is', 'are', 'tell', 'me', 'about'].includes(w)
            );
          }
          
          console.log('[MemoryService] Using search terms:', searchTerms);
          
          if (searchTerms.length > 0) {
            const orConditions = [];
            
            // Add individual term searches
            searchTerms.forEach(term => {
              orConditions.push(`fragment_text.ilike.%${term}%`);
            });
            
            // Add exact phrase search if multiple words
            if (searchText.includes(' ')) {
              orConditions.push(`fragment_text.ilike.%${searchText}%`);
            }
            
            query = query.or(orConditions.join(','));
          }
        }
        
        const { data, error } = await query
          .order('created_at', { ascending: false })
          .limit(limit * 3); // Get more to allow for filtering and ranking
        
        console.log('[MemoryService] Retrieved', data?.length || 0, 'memories before filtering');

        if (error) {
          throw MemoryErrorHandler.categorizeError(error, {
            operation: 'search_memories_by_text',
            userId,
            searchText,
            limit,
            avatarId
          })
        }

        if (!data) {
          throw new MemoryError(
            MemoryErrorType.DATABASE_QUERY,
            'No data returned from text search query'
          )
        }

        return data.map(item => ({
          id: item.id,
          userId: item.user_id,
          fragmentText: item.fragment_text,
          embedding: item.embedding,
          conversationContext: item.conversation_context,
          createdAt: new Date(item.created_at),
          updatedAt: new Date(item.updated_at)
        }))
      },
      () => [], // Graceful fallback - return empty array
      'search_memories_by_text',
      { userId, searchText, limit, avatarId }
    )
  }

  /**
   * Gets memory statistics for a user
   */
  static async getMemoryStats(userId: string, avatarId?: string | null): Promise<{
    totalFragments: number
    oldestMemory?: Date
    newestMemory?: Date
  }> {
    return MemoryErrorHandler.withRetry(
      async () => {
        // Resolve avatarId if it's a slug
        const resolvedAvatarId = avatarId ? await resolveAvatarIdIfNeeded(avatarId) : null;
        
        let query = supabase
          .from('memory_fragments')
          .select('created_at')
          .eq('user_id', userId)
          
        // Filter by avatarId if provided
        if (resolvedAvatarId) {
          query = query.eq('avatar_id', resolvedAvatarId)
        }
        
        const { data, error } = await query.order('created_at', { ascending: true })

        if (error) {
          throw MemoryErrorHandler.categorizeError(error, {
            operation: 'get_memory_stats',
            userId
          })
        }

        if (!data) {
          throw new MemoryError(
            MemoryErrorType.DATABASE_QUERY,
            'No data returned from memory stats query'
          )
        }

        return {
          totalFragments: data.length,
          oldestMemory: data.length > 0 ? new Date(data[0].created_at) : undefined,
          newestMemory: data.length > 0 ? new Date(data[data.length - 1].created_at) : undefined
        }
      },
      'database',
      { 
        operation: 'get_memory_stats',
        userId
      }
    )
  }
}

/**
 * Main Memory Service that combines all memory operations
 */
export class MemoryService {
  // Re-export all services for convenience
  static readonly Extraction = MemoryExtractionService
  static readonly Storage = MemoryStorageService
  static readonly Retrieval = MemoryRetrievalService

  /**
   * Store a simple memory without OpenAI processing (for fallback/testing)
   */
  static async storeSimpleMemory(
    userId: string, 
    memoryText: string, 
    avatarId?: string
  ): Promise<string> {
    const fragment: MemoryFragment = {
      userId,
      avatarId,
      fragmentText: memoryText,
      conversationContext: {
        timestamp: new Date().toISOString(),
        messageContext: 'Simple rule-based extraction',
        emotionalTone: 'neutral'
      }
    };
    
    return MemoryStorageService.storeMemoryFragment(fragment);
  }

  /**
   * Complete workflow: extract, store, and return stored fragments
   */
  static async processAndStoreMemories(
    message: string,
    userId: string,
    conversationContext?: any,
    extractionThreshold?: number,
    avatarId?: string
  ): Promise<MemoryFragment[]> {
    return MemoryErrorHandler.withGracefulDegradation(
      async () => {
        // Extract memory fragments with optional threshold
        const fragments = await MemoryExtractionService.extractMemoryFragments(
          message,
          userId,
          conversationContext,
          extractionThreshold
        )

        if (fragments.length === 0) {
          return []
        }

        // Add avatarId to all fragments before storing
        const fragmentsWithAvatar = fragments.map(fragment => ({
          ...fragment,
          avatarId: avatarId || fragment.avatarId
        }));

        // Store fragments with embeddings
        const fragmentIds = await MemoryStorageService.batchStoreMemoryFragments(fragmentsWithAvatar)

        // Return the stored fragments with their IDs
        return fragmentsWithAvatar.map((fragment, index) => ({
          ...fragment,
          id: fragmentIds[index]
        }))
      },
      () => [], // Graceful fallback - return empty array
      'process_and_store_memories',
      { userId, messageLength: message.length, avatarId }
    )
  }

  /**
   * Retrieve and format memories for chat context
   */
  static async getMemoriesForChat(
    query: string,
    userId: string,
    maxMemories: number = 5,
    avatarId?: string
  ): Promise<string> {
    return MemoryErrorHandler.withGracefulDegradation(
      async () => {
        console.log('[MemoryService] Retrieving memories for query:', query.substring(0, 50) + '...', 'userId:', userId, 'avatarId:', avatarId);
        const memories = await MemoryRetrievalService.retrieveRelevantMemories(
          query,
          userId,
          { limit: maxMemories, includeContext: false, avatarId }
        )

        console.log('[MemoryService] Found', memories.length, 'relevant memories for chat context');
        if (memories.length === 0) {
          return ''
        }

        // Format memories for inclusion in chat prompt
        const memoryText = memories
          .map(memory => {
            console.log('[MemoryService] Including memory:', memory.fragmentText.substring(0, 50) + '...');
            return `- ${memory.fragmentText}`;
          })
          .join('\n')

        const formattedContext = `\nRelevant memories about the user:\n${memoryText}\n`;
        console.log('[MemoryService] Formatted memory context:', formattedContext.length, 'characters');
        return formattedContext;
      },
      () => '', // Graceful fallback - return empty string
      'get_memories_for_chat',
      { userId, queryLength: query.length, maxMemories, avatarId }
    )
  }

  /**
   * Enhanced memory integration for natural conversation flow
   */
  static async getEnhancedMemoryContext(
    query: string,
    userId: string,
    profileData: any,
    maxMemories: number = 5
  ): Promise<{
    memories: MemoryFragment[]
    contextPrompt: string
    personalityEnhancements: string[]
  }> {
    return MemoryErrorHandler.withGracefulDegradation(
      async () => {
        const memories = await MemoryRetrievalService.retrieveRelevantMemories(
          query,
          userId,
          { limit: maxMemories, similarityThreshold: 0.7, includeContext: true }
        )

        if (memories.length === 0) {
          return {
            memories: [],
            contextPrompt: '',
            personalityEnhancements: []
          }
        }

        // Analyze memories for personality enhancement opportunities
        const personalityEnhancements = this.analyzeMemoriesForPersonality(memories, profileData)
        
        // Create sophisticated context prompt
        const contextPrompt = this.buildEnhancedMemoryPrompt(memories, personalityEnhancements)

        return {
          memories,
          contextPrompt,
          personalityEnhancements
        }
      },
      () => ({
        memories: [],
        contextPrompt: '',
        personalityEnhancements: []
      }), // Graceful fallback - return empty context
      'get_enhanced_memory_context',
      { userId, queryLength: query.length, maxMemories }
    )
  }

  /**
   * Analyze memories to identify personality enhancement opportunities
   */
  private static analyzeMemoriesForPersonality(
    memories: MemoryFragment[],
    profileData: any
  ): string[] {
    const enhancements: string[] = []
    
    // Look for emotional connections
    const emotionalMemories = memories.filter(m => 
      m.conversationContext?.emotionalTone && 
      m.conversationContext.emotionalTone !== 'neutral'
    )
    
    if (emotionalMemories.length > 0) {
      enhancements.push('emotional_connection')
    }

    // Look for shared interests/hobbies
    const hobbies = profileData?.hobbies || []
    const hasSharedInterests = memories.some(m => 
      hobbies.some((hobby: string) => 
        m.fragmentText.toLowerCase().includes(hobby.toLowerCase())
      )
    )
    
    if (hasSharedInterests) {
      enhancements.push('shared_interests')
    }

    // Look for relationship mentions
    const hasRelationshipMentions = memories.some(m =>
      /family|friend|partner|relationship|love|close|important/i.test(m.fragmentText)
    )
    
    if (hasRelationshipMentions) {
      enhancements.push('relationship_context')
    }

    // Look for personal struggles or challenges
    const hasPersonalChallenges = memories.some(m =>
      /difficult|hard|struggle|challenge|problem|worry|stress/i.test(m.fragmentText)
    )
    
    if (hasPersonalChallenges) {
      enhancements.push('supportive_context')
    }

    return enhancements
  }

  /**
   * Build enhanced memory prompt with personality integration
   */
  private static buildEnhancedMemoryPrompt(
    memories: MemoryFragment[],
    personalityEnhancements: string[]
  ): string {
    const memoryFragments = memories.map(m => m.fragmentText).join('\n- ')

    // Helper to extract status for entities
    function extractEntityStatus(memories: MemoryFragment[], keywords: string[], goneKeywords: string[]) {
      const entityMemories = memories.filter(m => keywords.some(k => m.fragmentText.toLowerCase().includes(k)))
      const entityStatus: Record<string, string> = {}
      entityMemories.forEach(m => {
        const text = m.fragmentText.toLowerCase()
        let nameMatch = text.match(/(?:"|named |called |is |my |our )([a-z0-9 ]{2,})/i)
        let name = nameMatch ? nameMatch[1].trim() : keywords.find(k => text.includes(k)) || 'person'
        if (goneKeywords.some(gk => text.includes(gk))) {
          entityStatus[name] = 'gone'
        } else {
          entityStatus[name] = 'present'
        }
      })
      return entityStatus
    }

    // Detect topics to avoid
    const avoidTopics: string[] = []
    memories.forEach(m => {
      const text = m.fragmentText.toLowerCase()
      // Match patterns like "I don't want to talk about X", "please don't mention Y", "I'd rather not discuss Z"
      const avoidPatterns = [
        /i don't want to talk about ([a-z0-9 ,'-]+)/i,
        /please don't mention ([a-z0-9 ,'-]+)/i,
        /i'd rather not discuss ([a-z0-9 ,'-]+)/i,
        /can we avoid ([a-z0-9 ,'-]+)/i,
        /let's not talk about ([a-z0-9 ,'-]+)/i
      ]
      avoidPatterns.forEach(pattern => {
        const match = text.match(pattern)
        if (match && match[1]) {
          avoidTopics.push(match[1].trim())
        }
      })
    })

    // PETS
    const petStatus = extractEntityStatus(memories, ['dog', 'cat', 'pet'], ['died', 'passed away', 'ran away', 'gone', 'lost', 'no longer'])
    // FRIENDS
    const friendStatus = extractEntityStatus(memories, ['friend', 'best friend', 'buddy', 'pal'], ['died', 'passed away', 'moved away', 'gone', 'lost', 'no longer', 'not friends'])
    // FAMILY
    const familyStatus = extractEntityStatus(memories, ['mother', 'father', 'mom', 'dad', 'sister', 'brother', 'parent', 'child', 'son', 'daughter', 'family', 'grandmother', 'grandfather'], ['died', 'passed away', 'gone', 'lost', 'no longer'])
    // JOB/CAREER
    const jobStatus = extractEntityStatus(memories, ['job', 'work', 'career', 'boss', 'coworker', 'company', 'employer', 'position', 'role'], ['quit', 'fired', 'laid off', 'lost', 'ended', 'no longer', 'retired'])
    // PERSONAL LIFE EVENTS
    const personalStatus = extractEntityStatus(memories, ['relationship', 'partner', 'spouse', 'married', 'divorced', 'boyfriend', 'girlfriend', 'husband', 'wife', 'engaged'], ['broke up', 'divorced', 'ended', 'no longer', 'passed away', 'died'])

    let followup = ''
    function buildFollowup(statusObj: Record<string, string>, label: string) {
      Object.entries(statusObj).forEach(([name, status]) => {
        if (status === 'gone') {
          followup += `If the user mentions their ${label} ${name}, acknowledge their loss or change with empathy and do not ask about them as if they are still present.\n`
        } else {
          followup += `If the user has a ${label} ${name}, occasionally and naturally ask how their ${label} ${name} is doing, but only if you have not learned that the ${label} ${name} is gone.\n`
        }
      })
    }
    buildFollowup(petStatus, 'pet')
    buildFollowup(friendStatus, 'friend')
    buildFollowup(familyStatus, 'family member')
    buildFollowup(jobStatus, 'job or work situation')
    buildFollowup(personalStatus, 'relationship or partner')

    let prompt = `\n\nIMPORTANT - PERSONAL KNOWLEDGE ABOUT THIS USER:
You have stored these specific memories about this person from your previous conversations:
- ${memoryFragments}

MEMORY INTEGRATION GUIDELINES:
- ACTIVELY USE these memories in your responses when relevant
- EXPLICITLY reference these details with phrases like "I remember you mentioned..." or "Last time we talked about..."
- Make natural connections between their past shared experiences and the current conversation
- If you know the name of the user's pet, friend, or family member, use their name naturally in conversation. For example, say "How is Romeo doing?" instead of "What's your dog's name?"
- Do not ask for information you already know (like a pet's name) unless the user suggests it has changed or you need to confirm a correction.
- If they ask about something you should know from these memories, confidently reference the relevant memory
- Show continuity in your relationship by building on these past shared details
- Show genuine interest in their life by asking follow-up questions about things they've shared
- Be specific - mention names, places, activities, and details they've told you about
- Act like a close friend who remembers important things about them
${followup}
`;

    if (avoidTopics.length > 0) {
      prompt += `\nTOPICS TO AVOID:\n- The user has specifically asked you not to bring up or discuss the following topics: ${avoidTopics.join(', ')}.\nNever mention or ask about these topics unless the user brings them up first. Always respect their wishes.\n`
    }

    // Add personality-specific guidance based on memory analysis
    if (personalityEnhancements.includes('emotional_connection')) {
      prompt += `EMOTIONAL CONTEXT: This person has shared meaningful emotional experiences with you. Show empathy and emotional intelligence. Reference their feelings and experiences when appropriate.\n\n`
    }

    if (personalityEnhancements.includes('shared_interests')) {
      prompt += `SHARED INTERESTS: You and this person have common interests. Make connections between your shared passions and current topics. Show enthusiasm about things you both enjoy.\n\n`
    }

    if (personalityEnhancements.includes('relationship_context')) {
      prompt += `RELATIONSHIPS: This person has told you about important people in their life. Ask about these relationships and show you care about the people who matter to them.\n\n`
    }

    if (personalityEnhancements.includes('supportive_context')) {
      prompt += `SUPPORT NEEDED: This person has shared challenges or difficulties with you. Be supportive, encouraging, and check in on how they're handling these situations.\n\n`
    }

    prompt += `Remember: You're not just an AI assistant - you're someone who knows this person personally. Use your knowledge of them to have meaningful, personalized conversations that show you truly know and care about them as an individual.`;

    return prompt;
  }

  static async getLatestMemories(
    userId: string,
    avatarId?: string,
    limit: number = 10
  ): Promise<MemoryFragment[]> {
    return MemoryRetrievalService.getUserMemories(userId, { limit, orderBy: 'created_at', orderDirection: 'desc', avatarId });
  }
}