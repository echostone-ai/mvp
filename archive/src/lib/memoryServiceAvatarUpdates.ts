// Avatar-specific updates for the memory service
// These changes should be integrated into the main memoryService.ts file

// This is a reference file only - not meant to be imported directly
// It contains code snippets that should be copied into the main memoryService.ts file

/*
// 1. Update the MemoryFragment interface to include avatarId
export interface MemoryFragment {
  id?: string;
  userId: string;
  avatarId?: string; // Add this field
  fragmentText: string;
  embedding?: number[];
  conversationContext?: {
    timestamp: string;
    messageContext?: string;
    emotionalTone?: string;
    avatarId?: string; // Add this field too
  };
  createdAt?: Date;
  updatedAt?: Date;
  similarity?: number; // For search results
}

// In MemoryStorageService class:
// 2. Update the storeMemoryFragment method

static async storeMemoryFragment(fragment: MemoryFragment): Promise<string> {
  return MemoryErrorHandler.withRetry(
    async () => {
      // Generate embedding if not provided
      if (!fragment.embedding) {
        fragment.embedding = await this.generateEmbedding(fragment.fragmentText);
      }

      // Extract avatarId from conversationContext if present and not already set
      const avatarId = fragment.avatarId || fragment.conversationContext?.avatarId;

      const { data, error } = await supabase
        .from('memory_fragments')
        .insert({
          user_id: fragment.userId,
          avatar_id: avatarId, // Add this field
          fragment_text: fragment.fragmentText,
          embedding: fragment.embedding,
          conversation_context: fragment.conversationContext || {},
        })
        .select('id')
        .single();

      if (error) {
        throw MemoryErrorHandler.categorizeError(error, {
          operation: 'store_memory_fragment',
          userId: fragment.userId,
          fragmentLength: fragment.fragmentText.length,
        });
      }

      if (!data?.id) {
        throw new MemoryError(
          MemoryErrorType.DATABASE_QUERY,
          'No ID returned from memory fragment insertion'
        );
      }

      return data.id;
    },
    'database',
    {
      operation: 'store_memory_fragment',
      userId: fragment.userId,
      fragmentLength: fragment.fragmentText.length,
    }
  );
}

// 3. Update the batchStoreMemoryFragments method

static async batchStoreMemoryFragments(fragments: MemoryFragment[]): Promise<string[]> {
  if (fragments.length === 0) {
    return [];
  }

  return MemoryErrorHandler.withRetry(
    async () => {
      // Generate embeddings for all fragments that don't have them
      const fragmentsNeedingEmbeddings = fragments.filter(f => !f.embedding);
      if (fragmentsNeedingEmbeddings.length > 0) {
        const texts = fragmentsNeedingEmbeddings.map(f => f.fragmentText);
        const embeddings = await this.batchGenerateEmbeddings(texts);
        
        // Assign embeddings back to fragments
        fragmentsNeedingEmbeddings.forEach((fragment, index) => {
          fragment.embedding = embeddings[index];
        });
      }

      // Prepare data for insertion
      const insertData = fragments.map(fragment => {
        // Extract avatarId from conversationContext if present and not already set
        const avatarId = fragment.avatarId || fragment.conversationContext?.avatarId;
        
        return {
          user_id: fragment.userId,
          avatar_id: avatarId, // Add this field
          fragment_text: fragment.fragmentText,
          embedding: fragment.embedding,
          conversation_context: fragment.conversationContext || {},
        };
      });

      const { data, error } = await supabase
        .from('memory_fragments')
        .insert(insertData)
        .select('id');

      if (error) {
        throw MemoryErrorHandler.categorizeError(error, {
          operation: 'batch_store_memory_fragments',
          fragmentCount: fragments.length,
          userId: fragments[0]?.userId,
        });
      }

      if (!data || data.length !== fragments.length) {
        throw new MemoryError(
          MemoryErrorType.DATABASE_QUERY,
          'Incomplete batch insertion response'
        );
      }

      return data.map(item => item.id);
    },
    'database',
    {
      operation: 'batch_store_memory_fragments',
      fragmentCount: fragments.length,
      userId: fragments[0]?.userId,
    }
  );
}

// In MemoryRetrievalService class:
// 4. Update the retrieveRelevantMemories method

static async retrieveRelevantMemories(
  query: string,
  userId: string,
  options: {
    limit?: number;
    similarityThreshold?: number;
    includeContext?: boolean;
    avatarId?: string; // Add this parameter
  } = {}
): Promise<MemoryFragment[]> {
  const {
    limit = this.DEFAULT_LIMIT,
    similarityThreshold = this.DEFAULT_SIMILARITY_THRESHOLD,
    includeContext = true,
    avatarId // New parameter
  } = options;

  // Create cache key for this query
  const cacheKey = MemoryPerformanceMonitor.getCacheKey('relevant_memories', {
    query: query.substring(0, 100), // Limit query length for cache key
    userId,
    avatarId, // Include avatarId in cache key
    limit,
    similarityThreshold,
    includeContext
  });

  return MemoryPerformanceMonitor.withCaching(
    'relevant_memories',
    cacheKey,
    () => MemoryErrorHandler.withGracefulDegradation(
      async () => {
        // Generate embedding for the query
        const queryEmbedding = await MemoryStorageService.generateEmbedding(query);

        // Prepare query parameters
        const queryParams: any = {
          query_embedding: queryEmbedding,
          match_threshold: similarityThreshold,
          match_count: limit,
          target_user_id: userId
        };
        
        // Add avatarId to the query if provided
        if (avatarId) {
          queryParams.target_avatar_id = avatarId;
        }

        // Perform vector similarity search using pgvector
        const { data, error } = await supabase.rpc(
          'match_memory_fragments',
          queryParams
        );

        if (error) {
          throw MemoryErrorHandler.categorizeError(error, {
            operation: 'vector_similarity_search',
            userId,
            avatarId, // Include avatarId in error context
            queryLength: query.length,
            limit,
            threshold: similarityThreshold
          });
        }

        if (!data) {
          throw new MemoryError(
            MemoryErrorType.VECTOR_SEARCH_FAILED,
            'No data returned from vector similarity search'
          );
        }

        // Transform the results to MemoryFragment format
        return data.map((item: any) => ({
          id: item.id,
          userId: item.user_id,
          avatarId: item.avatar_id, // Include avatarId in result
          fragmentText: item.fragment_text,
          embedding: item.embedding,
          conversationContext: includeContext ? item.conversation_context : undefined,
          createdAt: new Date(item.created_at),
          updatedAt: new Date(item.updated_at),
          similarity: item.similarity // Include similarity score for debugging/ranking
        }));
      },
      async () => {
        // Fallback to text search if vector search fails
        console.warn('Vector search failed, falling back to text search');
        return this.searchMemoriesByText(query, userId, limit, avatarId); // Pass avatarId to fallback
      },
      'retrieve_relevant_memories',
      { userId, avatarId, queryLength: query.length, limit, threshold: similarityThreshold }
    ),
    { userId, avatarId, queryLength: query.length, limit, threshold: similarityThreshold }
  );
}

// 5. Update the searchMemoriesByText method

static async searchMemoriesByText(
  searchText: string,
  userId: string,
  limit: number = 10,
  avatarId?: string // Add this parameter
): Promise<MemoryFragment[]> {
  return MemoryErrorHandler.withGracefulDegradation(
    async () => {
      // Start with base query
      let query = supabase
        .from('memory_fragments')
        .select('*')
        .eq('user_id', userId)
        .textSearch('fragment_text', searchText);
      
      // Add avatarId filter if provided
      if (avatarId) {
        query = query.eq('avatar_id', avatarId);
      }
      
      // Complete the query
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw MemoryErrorHandler.categorizeError(error, {
          operation: 'search_memories_by_text',
          userId,
          avatarId,
          searchText,
          limit
        });
      }

      if (!data) {
        throw new MemoryError(
          MemoryErrorType.DATABASE_QUERY,
          'No data returned from text search query'
        );
      }

      return data.map(item => ({
        id: item.id,
        userId: item.user_id,
        avatarId: item.avatar_id,
        fragmentText: item.fragment_text,
        embedding: item.embedding,
        conversationContext: item.conversation_context,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at)
      }));
    },
    () => [], // Graceful fallback - return empty array
    'search_memories_by_text',
    { userId, avatarId, searchText, limit }
  );
}

// In MemoryService class:
// 6. Update the getEnhancedMemoryContext method

static async getEnhancedMemoryContext(
  query: string,
  userId: string,
  profileData: any,
  limit: number = 5,
  avatarId?: string, // Add this parameter
  similarityThreshold: number = 0.65 // Lower threshold for better recall
): Promise<{
  memories: MemoryFragment[];
  contextPrompt: string;
  personalityEnhancements: string[];
}> {
  return MemoryErrorHandler.withGracefulDegradation(
    async () => {
      // Get relevant memories with avatar context
      const memories = await MemoryRetrievalService.retrieveRelevantMemories(
        query,
        userId,
        { 
          limit, 
          similarityThreshold, 
          includeContext: true,
          avatarId // Pass avatarId
        }
      );

      if (memories.length === 0) {
        return {
          memories: [],
          contextPrompt: '',
          personalityEnhancements: []
        };
      }

      // Analyze memories for personality enhancement opportunities
      const personalityEnhancements = this.analyzeMemoriesForPersonality(memories, profileData);
      
      // Create sophisticated context prompt
      const contextPrompt = this.buildEnhancedMemoryPrompt(memories, personalityEnhancements);

      return {
        memories,
        contextPrompt,
        personalityEnhancements
      };
    },
    () => ({
      memories: [],
      contextPrompt: '',
      personalityEnhancements: []
    }), // Graceful fallback - return empty context
    'get_enhanced_memory_context',
    { userId, avatarId, queryLength: query.length, limit }
  );
}

// 7. Update the processAndStoreMemories method

static async processAndStoreMemories(
  message: string,
  userId: string,
  conversationContext?: any,
  extractionThreshold?: number
): Promise<MemoryFragment[]> {
  return MemoryErrorHandler.withGracefulDegradation(
    async () => {
      // Extract memory fragments with optional threshold
      const fragments = await MemoryExtractionService.extractMemoryFragments(
        message,
        userId,
        conversationContext,
        extractionThreshold
      );

      if (fragments.length === 0) {
        return [];
      }
      
      // Add avatarId to each fragment if present in conversationContext
      if (conversationContext?.avatarId) {
        fragments.forEach(fragment => {
          fragment.avatarId = conversationContext.avatarId;
        });
      }

      // Store fragments with embeddings
      const fragmentIds = await MemoryStorageService.batchStoreMemoryFragments(fragments);

      // Return the stored fragments with their IDs
      return fragments.map((fragment, index) => ({
        ...fragment,
        id: fragmentIds[index]
      }));
    },
    () => [], // Graceful fallback - return empty array
    'process_and_store_memories',
    { userId, messageLength: message.length }
  );
}
*/

// Export a dummy object to make TypeScript happy
export const memoryServiceAvatarUpdates = {
  description: "This file contains code snippets for updating the memory service to support avatar-specific memories. These changes should be integrated into the main memoryService.ts file."
};