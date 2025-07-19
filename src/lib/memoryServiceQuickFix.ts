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

  console.log('🔍 Retrieving memories with avatar isolation:', { 
    userId, 
    avatarId, 
    limit, 
    similarityThreshold,
    query: query.substring(0, 50) + '...'
  });

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
    console.log('✅ Generated embedding for query');

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
      console.log('🎭 Using avatar isolation with avatarId:', avatarId);
    } else {
      console.log('👤 No avatar isolation - searching all user memories');
    }

    console.log('📡 Calling match_memory_fragments with params:', {
      ...queryParams,
      query_embedding: '[embedding array]' // Don't log the full embedding
    });

    // Call the updated match_memory_fragments function with avatar support
    const { data, error } = await supabase.rpc(
      'match_memory_fragments',
      queryParams
    );

    if (error) {
      console.error('❌ Memory retrieval RPC error:', error);
      
      // Try a fallback query without avatar isolation to see if the basic function works
      console.log('🔄 Trying fallback query without avatar isolation...');
      const fallbackParams = {
        query_embedding: embedding,
        match_threshold: similarityThreshold,
        match_count: limit,
        target_user_id: userId
      };
      
      const { data: fallbackData, error: fallbackError } = await supabase.rpc(
        'match_memory_fragments',
        fallbackParams
      );
      
      if (fallbackError) {
        console.error('❌ Fallback query also failed:', fallbackError);
        return [];
      } else {
        console.log('✅ Fallback query succeeded, returning', fallbackData?.length || 0, 'memories');
        return fallbackData?.map((item: any) => ({
          id: item.id,
          userId: item.user_id,
          avatarId: item.avatar_id,
          fragmentText: item.fragment_text,
          embedding: item.embedding,
          conversationContext: includeContext ? item.conversation_context : undefined,
          createdAt: new Date(item.created_at),
          updatedAt: new Date(item.updated_at),
          similarity: item.similarity
        })) || [];
      }
    }

    if (!data) {
      console.log('⚠️ No data returned from memory search');
      return [];
    }

    console.log('✅ Memory search successful:', {
      totalResults: data.length,
      avatarSpecific: data.filter((item: any) => item.avatar_id === avatarId).length,
      similarities: data.map((item: any) => item.similarity)
    });

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
    console.error('❌ Failed to retrieve memories:', error);
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
  console.log('🔍 Getting avatar-specific memories:', { query: query.substring(0, 50), userId, avatarId, limit });
  
  try {
    const memories = await retrieveRelevantMemoriesWithAvatarIsolation(
      query,
      userId,
      avatarId,
      { limit, similarityThreshold: 0.65 }
    );
    
    console.log('📝 Retrieved memories:', { 
      count: memories.length, 
      avatarId,
      memoryTexts: memories.map((m: any) => m.fragmentText.substring(0, 50) + '...') 
    });
    
    if (memories.length === 0) {
      console.log('⚠️ No memories found for avatar:', avatarId);
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
MEMORY CONTEXT - Previous conversations with this user:

${memoryText}

INSTRUCTIONS FOR USING MEMORIES:
- Reference these memories naturally when relevant to the conversation
- Show that you remember by using phrases like "I remember when you told me..." or "You mentioned that..."
- Build upon previous conversations to create continuity
- Don't force memories into every response, but use them when they add value
- These are YOUR memories of what this specific user has shared with you
`;
    
    console.log('✅ Generated memory context with', memories.length, 'memories');
    
    return {
      memories,
      contextPrompt,
      personalityEnhancements: []
    };
  } catch (error) {
    console.error('❌ Failed to get avatar-specific memories:', error);
    return {
      memories: [],
      contextPrompt: '',
      personalityEnhancements: []
    };
  }
}