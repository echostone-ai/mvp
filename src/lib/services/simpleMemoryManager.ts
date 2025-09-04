import { SupabaseClient } from '@supabase/supabase-js';

export interface ConversationMemory {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/**
 * Simple memory manager that actually works
 * Fixes the conversation memory persistence issue
 */
export class SimpleMemoryManager {
  private db: SupabaseClient;
  
  constructor(dbClient: SupabaseClient) {
    this.db = dbClient;
  }

  /**
   * Store a conversation turn in memory
   */
  async storeMemory(
    avatarId: string, 
    role: 'user' | 'assistant', 
    content: string, 
    visitorId: string,
    conversationId: string = 'jonathan-demo'
  ): Promise<void> {
    try {
      // Store without role column - use conversation_context.type instead
      await this.db.from('memory_fragments').insert({
        avatar_id: avatarId,
        fragment_text: content,
        conversation_context: {
          source: 'chat',
          type: role,
          conversation_id: conversationId,
          visitor_id: visitorId,
          timestamp: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      });
      console.log(`[SimpleMemoryManager] Successfully stored ${role} memory`);
    } catch (error) {
      console.warn('[SimpleMemoryManager] Failed to store memory:', error);
      // Don't throw - memory storage is optional
    }
  }

  /**
   * Retrieve recent conversation history
   */
  async getRecentMemories(
    avatarId: string, 
    visitorId: string,
    conversationId: string = 'jonathan-demo',
    limit: number = 10
  ): Promise<ConversationMemory[]> {
    try {
      // Superset query: get recent memories for this avatar
      const { data: memories, error } = await this.db
        .from('memory_fragments')
        .select('id, fragment_text, created_at, conversation_context')
        .eq('avatar_id', avatarId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.warn('[SimpleMemoryManager] Failed to retrieve memories:', error);
        return [];
      }

      console.log(`[SimpleMemoryManager] Retrieved ${memories?.length || 0} raw memories from database`);

      // Rank: prefer current visitor exact matches; keep legacy (null visitor)
      const ranked = (memories || [])
        .map(m => {
          const ctx: any = m.conversation_context || {};
          const visitorMatch = ctx?.visitor_id === visitorId ? 1 : 0;
          // Optionally nudge same conversation_id, but don't exclude legacy
          const convoMatch = ctx?.conversation_id === conversationId ? 1 : 0;
          return { ...m, __score: visitorMatch * 2 + convoMatch };
        })
        .sort((a: any, b: any) => (b.__score - a.__score) || (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
        .slice(0, limit);

      if (ranked.length === 0) {
        // Fallback: latest N memories for avatar (no visitor filter)
        const { data: fallback } = await this.db
          .from('memory_fragments')
          .select('fragment_text, created_at, conversation_context')
          .eq('avatar_id', avatarId)
          .order('created_at', { ascending: false })
          .limit(limit);
        const items = (fallback || []).reverse();
        return items.map((mem: any) => ({
          role: (mem.conversation_context?.type as 'user' | 'assistant') || 'user',
          content: mem.fragment_text || '',
          timestamp: mem.created_at || ''
        }));
      }

      // Oldest-first for conversation flow
      return ranked
        .reverse()
        .map((mem: any) => ({
          role: (mem.conversation_context?.type as 'user' | 'assistant') || 'user',
          content: mem.fragment_text || '',
          timestamp: mem.created_at || ''
        }));

    } catch (error) {
      console.warn('[SimpleMemoryManager] Error retrieving memories:', error);
      return [];
    }
  }

  /**
   * Build conversation context string from recent memories
   */
  buildConversationContext(memories: ConversationMemory[]): string {
    if (memories.length === 0) return '';

    const contextLines = memories.map(mem => 
      `${mem.role === 'user' ? 'Human' : 'Jonathan'}: ${mem.content}`
    );

    return `Recent conversation:\n${contextLines.join('\n')}\n\n`;
  }
}