// src/lib/conversationService.ts
import { supabase } from './supabase'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

export interface Conversation {
  id?: string
  userId: string
  avatarId?: string // Add avatarId to associate conversations with specific avatars
  messages: ChatMessage[]
  lastActive: string
  createdAt?: string
  updatedAt?: string
}

export class ConversationService {
  /**
   * Get the current active conversation for a user and avatar
   */
  static async getCurrentConversation(userId: string, avatarId?: string): Promise<Conversation | null> {
    try {
      // Build query with user ID
      let query = supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId);
      
      // Add avatar ID filter if provided
      if (avatarId) {
        query = query.eq('avatar_id', avatarId);
      }
      
      // Complete the query
      const { data, error } = await query
        .order('last_active', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No conversation found - this is normal for new users
          return null
        }
        console.error('Error fetching conversation:', error)
        return null
      }

      return {
        id: data.id,
        userId: data.user_id,
        avatarId: data.avatar_id,
        messages: data.messages || [],
        lastActive: data.last_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      }
    } catch (error) {
      console.error('Error in getCurrentConversation:', error)
      return null
    }
  }

  /**
   * Save or update a conversation
   */
  static async saveConversation(conversation: Conversation): Promise<string | null> {
    try {
      // Prepare conversation data
      const conversationData: any = {
        user_id: conversation.userId,
        messages: conversation.messages,
        last_active: new Date().toISOString()
      }
      
      // Include avatarId if provided
      if (conversation.avatarId) {
        conversationData.avatar_id = conversation.avatarId;
      }

      if (conversation.id) {
        // Update existing conversation
        let query = supabase
          .from('conversations')
          .update(conversationData)
          .eq('id', conversation.id)
          .eq('user_id', conversation.userId);
        
        // Add avatar ID filter if provided
        if (conversation.avatarId) {
          query = query.eq('avatar_id', conversation.avatarId);
        }
        
        const { error } = await query;

        if (error) {
          console.error('Error updating conversation:', error)
          return null
        }
        return conversation.id
      } else {
        // Create new conversation
        const { data, error } = await supabase
          .from('conversations')
          .insert(conversationData)
          .select('id')
          .single()

        if (error) {
          console.error('Error creating conversation:', error)
          return null
        }
        return data.id
      }
    } catch (error) {
      console.error('Error in saveConversation:', error)
      return null
    }
  }

  /**
   * Add a message to the conversation and save it
   */
  static async addMessage(
    userId: string, 
    message: ChatMessage, 
    conversationId?: string,
    avatarId?: string
  ): Promise<{ conversationId: string | null; success: boolean }> {
    try {
      // Get current conversation or create new one
      let conversation = conversationId 
        ? await this.getConversationById(conversationId, userId)
        : await this.getCurrentConversation(userId, avatarId)

      if (!conversation) {
        conversation = {
          userId,
          avatarId, // Include avatarId in new conversation
          messages: [],
          lastActive: new Date().toISOString()
        }
      }

      // Add timestamp to message
      const messageWithTimestamp = {
        ...message,
        timestamp: new Date().toISOString()
      }

      // Add message to conversation
      conversation.messages.push(messageWithTimestamp)

      // Keep only last 50 messages to prevent conversations from getting too large
      if (conversation.messages.length > 50) {
        conversation.messages = conversation.messages.slice(-50)
      }

      // Save conversation
      const savedId = await this.saveConversation(conversation)
      
      return {
        conversationId: savedId,
        success: !!savedId
      }
    } catch (error) {
      console.error('Error in addMessage:', error)
      return { conversationId: null, success: false }
    }
  }

  /**
   * Get a specific conversation by ID
   */
  static async getConversationById(conversationId: string, userId: string, avatarId?: string): Promise<Conversation | null> {
    try {
      // Build query with user ID and conversation ID
      let query = supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', userId);
      
      // Add avatar ID filter if provided
      if (avatarId) {
        query = query.eq('avatar_id', avatarId);
      }
      
      // Complete the query
      const { data, error } = await query.single();

      if (error) {
        console.error('Error fetching conversation by ID:', error)
        return null
      }

      return {
        id: data.id,
        userId: data.user_id,
        avatarId: data.avatar_id,
        messages: data.messages || [],
        lastActive: data.last_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      }
    } catch (error) {
      console.error('Error in getConversationById:', error)
      return null
    }
  }

  /**
   * Start a new conversation (clear current conversation)
   */
  static async startNewConversation(userId: string): Promise<string | null> {
    const newConversation: Conversation = {
      userId,
      messages: [],
      lastActive: new Date().toISOString()
    }

    return await this.saveConversation(newConversation)
  }

  /**
   * Get conversation history for a user
   */
  static async getConversationHistory(userId: string, limit: number = 10): Promise<Conversation[]> {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .order('last_active', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Error fetching conversation history:', error)
        return []
      }

      return data.map(item => ({
        id: item.id,
        userId: item.user_id,
        messages: item.messages || [],
        lastActive: item.last_active,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }))
    } catch (error) {
      console.error('Error in getConversationHistory:', error)
      return []
    }
  }

  /**
   * Clear a specific conversation
   */
  static async clearConversation(userId: string, conversationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', userId)

      if (error) {
        console.error('Error clearing conversation:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in clearConversation:', error)
      return false
    }
  }

  /**
   * Clear all conversations for a user
   */
  static async clearAllConversations(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('user_id', userId)

      if (error) {
        console.error('Error clearing all conversations:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in clearAllConversations:', error)
      return false
    }
  }
}