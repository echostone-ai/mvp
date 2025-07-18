// This file contains updates to the MemoryService class to support avatar-specific memories
// These changes should be integrated into the existing memoryService.ts file

// Update MemoryFragment interface
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
}

// Update retrieveRelevantMemories method
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
  // ...existing code...
  
  // Add avatarId to the query if provided
  const queryParams: any = {
    query_embedding: embedding,
    match_threshold: options.similarityThreshold || 0.7,
    match_count: options.limit || 10,
    target_user_id: userId
  };
  
  if (options.avatarId) {
    queryParams.target_avatar_id = options.avatarId;
  }
  
  const { data, error } = await supabase.rpc(
    'match_memory_fragments',
    queryParams
  );
  
  // ...rest of the function...
}

// Update storeMemoryFragment method
static async storeMemoryFragment(
  fragment: MemoryFragment
): Promise<MemoryFragment> {
  // ...existing code...
  
  // Extract avatarId from conversationContext if present
  const avatarId = fragment.avatarId || fragment.conversationContext?.avatarId;
  
  const { data, error } = await supabase
    .from('memory_fragments')
    .insert({
      user_id: fragment.userId,
      avatar_id: avatarId, // Add this field
      fragment_text: fragment.fragmentText,
      embedding: fragment.embedding,
      conversation_context: fragment.conversationContext || {}
    })
    .select()
    .single();
  
  // ...rest of the function...
}

// Update getEnhancedMemoryContext method
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
  // ...existing code...
  
  // Get relevant memories with avatar context
  const memories = await this.retrieveRelevantMemories(query, userId, {
    limit,
    similarityThreshold,
    includeContext: true,
    avatarId // Pass avatarId
  });
  
  // ...rest of the function...
}

// Update processAndStoreMemories method to handle avatarId
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