// Quick fix for avatar memory isolation
// Import this file in your memory service and use these functions

import { supabase } from './supabase';

/**
 * Retrieves relevant memory fragments using semantic similarity search with avatar isolation
 */
export async function retrieveRelevantMemoriesWithAvatarIsolation(
  query: string,
  userId: string,
  avatarId?: string,
  options: {
    limit?: number;
    similarityThreshold?: number;
    includeContext?: boolean;
  } = {}
) {
  const {
    limit = 10,
    similarityThreshold = 0.7,
    includeContext = true
  } = options;

  try {
    // Generate embedding for the query
    const response = await fetch('/api/embedding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: query })
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate embedding');
    }
    
    const { embedding } = await response.json();

    // Prepare query parameters with avatar isolation
    const queryParams: any = {
      query_embedding: embedding,
      match_threshold: similarityThreshold,
      match_count: limit,
      target_user_id: userId
    };
    
    // Add avatarId to the query if provided
    if (avatarId) {
      queryParams.target_avatar_id = avatarId;
    }

    // Call the updated match_memory_fragments function with avatar support
    const { data, error } = await supabase.rpc(
      'match_memory_fragments',
      queryParams
    );

    if (error) {
      console.error('Memory retrieval error:', error);
      return [];
    }

    if (!data) {
      return [];
    }

    // Transform the results
    return data.map((item: any) => ({
      id: item.id,
      userId: item.user_id,
      avatarId: item.avatar_id,
      fragmentText: item.fragment_text,
      embedding: item.embedding,
      conversationContext: includeContext ? item.conversation_context : undefined,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
      similarity: item.similarity
    }));
  } catch (error) {
    console.error('Failed to retrieve memories:', error);
    return [];
  }
}

/**
 * Stores a memory fragment with avatar isolation
 */
export async function storeMemoryFragmentWithAvatarIsolation(
  fragmentText: string,
  userId: string,
  avatarId?: string,
  conversationContext?: any
) {
  try {
    // Generate embedding
    const response = await fetch('/api/embedding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: fragmentText })
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate embedding');
    }
    
    const { embedding } = await response.json();

    // Store the memory fragment with avatar isolation
    const { data, error } = await supabase
      .from('memory_fragments')
      .insert({
        user_id: userId,
        avatar_id: avatarId, // This ensures avatar isolation
        fragment_text: fragmentText,
        embedding: embedding,
        conversation_context: conversationContext || {}
      })
      .select('id')
      .single();

    if (error) {
      console.error('Memory storage error:', error);
      return null;
    }

    return data?.id;
  } catch (error) {
    console.error('Failed to store memory:', error);
    return null;
  }
}

/**
 * Updates the chat API to use avatar-specific memories
 * This is a temporary solution until the memory service is fully updated
 */
export async function getAvatarSpecificMemories(
  query: string,
  userId: string,
  avatarId?: string,
  limit: number = 10
) {
  try {
    const memories = await retrieveRelevantMemoriesWithAvatarIsolation(
      query,
      userId,
      avatarId,
      { limit, similarityThreshold: 0.65 }
    );
    
    if (memories.length === 0) {
      return {
        memories: [],
        contextPrompt: '',
        personalityEnhancements: []
      };
    }
    
    // Format memories for inclusion in chat prompt
    const memoryText = memories
      .map(memory => `- ${memory.fragmentText}`)
      .join('\n');
    
    const contextPrompt = `
You have the following memories about this user:

${memoryText}

Use these memories to personalize your responses. Refer to these memories naturally when relevant.
`;
    
    return {
      memories,
      contextPrompt,
      personalityEnhancements: []
    };
  } catch (error) {
    console.error('Failed to get avatar-specific memories:', error);
    return {
      memories: [],
      contextPrompt: '',
      personalityEnhancements: []
    };
  }
}