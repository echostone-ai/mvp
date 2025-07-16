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
  messages: ChatMessage[]
  lastActive: string
  createdAt?: string
  updatedAt?: string
}

export class ConversationService {
  /**
   * Get the current active conversation for a user
   */
  static async getCurrentConversation(userId: string): Promise<Conversation | null> {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .order('last_active', { ascending: false })
        .limit(1)
        .single()

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
      const conversationData = {
        user_id: conversation.userId,
        messages: conversation.messages,
        last_active: new Date().toISOString()
      }

      if (conversation.id) {
        // Update existing conversation
        const { error } = await supabase
          .from('conversations')
          .update(conversationData)
          .eq('id', conversation.id)
          .eq('user_id', conversation.userId)

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
    conversationId?: string
  ): Promise<{ conversationId: string | null; success: boolean }> {
    try {
      // Get current conversation or create new one
      let conversation = conversationId 
        ? await this.getConversationById(conversationId, userId)
        : await this.getCurrentConversation(userId)

      if (!conversation) {
        conversation = {
          userId,
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
  static async getConversationById(conversationId: string, userId: string): Promise<Conversation | null> {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single()

      if (error) {
        console.error('Error fetching conversation by ID:', error)
        return null
      }

      return {
        id: data.id,
        userId: data.user_id,
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
}