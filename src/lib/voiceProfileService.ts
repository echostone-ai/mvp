/**
 * Voice Profile Service
 * Handles storage and retrieval of voice profiles with emotional calibration data
 */

import { supabase } from './supabase'
import { EmotionalCalibration, VoiceParameters } from './emotionalCalibrationService'

export interface VoiceProfile {
  voice_id: string
  professional_settings: ProfessionalVoiceSettings
  emotional_calibration: EmotionalCalibration
  quality_metrics: QualityMetrics
  created_at: string
  last_updated: string
  training_samples?: number
  model_used?: string
}

export interface ProfessionalVoiceSettings {
  stability: number
  similarity_boost: number
  style: number
  use_speaker_boost: boolean
  optimize_streaming_latency: number
  model_id: 'eleven_turbo_v2_5' | 'eleven_multilingual_v2'
}

export interface QualityMetrics {
  overall_score: number
  emotional_range: number
  clarity: number
  naturalness: number
}

export interface VoiceTrainingSession {
  id: string
  user_id: string
  session_data: {
    name: string
    description: string
    file_count: number
    professional_mode: boolean
    settings: ProfessionalVoiceSettings
  }
  audio_files: string[]
  quality_analysis: any
  status: 'pending' | 'processing' | 'completed' | 'failed'
  voice_id?: string
  created_at: string
  completed_at?: string
  error_message?: string
}

export class VoiceProfileService {
  /**
   * Save voice profile data to user's profile
   */
  async saveVoiceProfile(userId: string, voiceProfile: VoiceProfile): Promise<void> {
    try {
      // First ensure the profile exists
      await this.ensureProfileExists(userId)

      // Update the profile with voice data
      const { error } = await supabase
        .from('profiles')
        .update({
          voice_id: voiceProfile.voice_id,
          voice_profile: voiceProfile
        })
        .eq('user_id', userId)

      if (error) {
        throw new Error(`Failed to save voice profile: ${error.message}`)
      }

      console.log('Voice profile saved successfully for user:', userId)
    } catch (error) {
      console.error('Error saving voice profile:', error)
      throw error
    }
  }

  /**
   * Retrieve voice profile data for a user
   */
  async getVoiceProfile(userId: string): Promise<VoiceProfile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('voice_id, voice_profile')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        throw new Error(`Failed to retrieve voice profile: ${error.message}`)
      }

      if (!data || !data.voice_profile) {
        return null
      }

      return data.voice_profile as VoiceProfile
    } catch (error) {
      console.error('Error retrieving voice profile:', error)
      throw error
    }
  }

  /**
   * Update emotional calibration for a voice profile
   */
  async updateEmotionalCalibration(
    userId: string, 
    emotionalCalibration: EmotionalCalibration
  ): Promise<void> {
    try {
      const existingProfile = await this.getVoiceProfile(userId)
      
      if (!existingProfile) {
        throw new Error('No voice profile found for user')
      }

      const updatedProfile: VoiceProfile = {
        ...existingProfile,
        emotional_calibration: emotionalCalibration,
        last_updated: new Date().toISOString()
      }

      await this.saveVoiceProfile(userId, updatedProfile)
      console.log('Emotional calibration updated successfully')
    } catch (error) {
      console.error('Error updating emotional calibration:', error)
      throw error
    }
  }

  /**
   * Create a new voice training session
   */
  async createVoiceTrainingSession(
    userId: string,
    sessionData: VoiceTrainingSession['session_data'],
    audioFiles: string[]
  ): Promise<string> {
    try {
      const session: Omit<VoiceTrainingSession, 'id'> = {
        user_id: userId,
        session_data: sessionData,
        audio_files: audioFiles,
        quality_analysis: {},
        status: 'pending',
        created_at: new Date().toISOString()
      }

      // For now, store in localStorage or return a generated ID
      // In a real implementation, this would be stored in a database table
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Store in localStorage for now
      const existingSessions = this.getStoredSessions()
      existingSessions[sessionId] = { id: sessionId, ...session }
      localStorage.setItem('voice_training_sessions', JSON.stringify(existingSessions))

      console.log('Voice training session created:', sessionId)
      return sessionId
    } catch (error) {
      console.error('Error creating voice training session:', error)
      throw error
    }
  }

  /**
   * Update voice training session status
   */
  async updateVoiceTrainingSession(
    sessionId: string,
    updates: Partial<VoiceTrainingSession>
  ): Promise<void> {
    try {
      const existingSessions = this.getStoredSessions()
      
      if (!existingSessions[sessionId]) {
        throw new Error('Voice training session not found')
      }

      existingSessions[sessionId] = {
        ...existingSessions[sessionId],
        ...updates
      }

      localStorage.setItem('voice_training_sessions', JSON.stringify(existingSessions))
      console.log('Voice training session updated:', sessionId)
    } catch (error) {
      console.error('Error updating voice training session:', error)
      throw error
    }
  }

  /**
   * Get voice training session by ID
   */
  async getVoiceTrainingSession(sessionId: string): Promise<VoiceTrainingSession | null> {
    try {
      const existingSessions = this.getStoredSessions()
      return existingSessions[sessionId] || null
    } catch (error) {
      console.error('Error retrieving voice training session:', error)
      return null
    }
  }

  /**
   * Get all voice training sessions for a user
   */
  async getUserVoiceTrainingSessions(userId: string): Promise<VoiceTrainingSession[]> {
    try {
      const existingSessions = this.getStoredSessions()
      return Object.values(existingSessions).filter(session => session.user_id === userId)
    } catch (error) {
      console.error('Error retrieving user voice training sessions:', error)
      return []
    }
  }

  /**
   * Create default voice profile after successful training
   */
  async createDefaultVoiceProfile(
    userId: string,
    voiceId: string,
    professionalSettings: ProfessionalVoiceSettings,
    trainingSamples: number = 0
  ): Promise<VoiceProfile> {
    const defaultEmotionalCalibration: EmotionalCalibration = {
      // Core Positive Emotions
      happy: { stability: 0.35, similarity_boost: 0.75, style: 0.85, use_speaker_boost: true },
      excited: { stability: 0.15, similarity_boost: 0.65, style: 0.95, use_speaker_boost: true },
      playful: { stability: 0.25, similarity_boost: 0.70, style: 0.90, use_speaker_boost: true },
      confident: { stability: 0.65, similarity_boost: 0.85, style: 0.60, use_speaker_boost: true },
      romantic: { stability: 0.55, similarity_boost: 0.80, style: 0.70, use_speaker_boost: true },
      
      // Calm & Reflective
      calm: { stability: 0.85, similarity_boost: 0.90, style: 0.25, use_speaker_boost: true },
      serious: { stability: 0.80, similarity_boost: 0.95, style: 0.20, use_speaker_boost: true },
      nostalgic: { stability: 0.70, similarity_boost: 0.85, style: 0.45, use_speaker_boost: true },
      mysterious: { stability: 0.75, similarity_boost: 0.80, style: 0.55, use_speaker_boost: true },
      
      // Intense Emotions
      sad: { stability: 0.90, similarity_boost: 0.85, style: 0.30, use_speaker_boost: true },
      angry: { stability: 0.20, similarity_boost: 0.60, style: 0.85, use_speaker_boost: true },
      surprised: { stability: 0.30, similarity_boost: 0.70, style: 0.80, use_speaker_boost: true },
      determined: { stability: 0.60, similarity_boost: 0.85, style: 0.65, use_speaker_boost: true },
      
      // Creative & Unique
      whimsical: { stability: 0.40, similarity_boost: 0.75, style: 0.75, use_speaker_boost: true },
      sarcastic: { stability: 0.50, similarity_boost: 0.80, style: 0.70, use_speaker_boost: true },
      neutral: { stability: 0.75, similarity_boost: 0.85, style: 0.35, use_speaker_boost: true }
    }

    const voiceProfile: VoiceProfile = {
      voice_id: voiceId,
      professional_settings: professionalSettings,
      emotional_calibration: defaultEmotionalCalibration,
      quality_metrics: {
        overall_score: 8.0, // Default score, will be updated after analysis
        emotional_range: 8.5,
        clarity: 8.2,
        naturalness: 8.3
      },
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      training_samples: trainingSamples,
      model_used: professionalSettings.model_id
    }

    await this.saveVoiceProfile(userId, voiceProfile)
    return voiceProfile
  }

  /**
   * Get emotional parameters for a specific context
   */
  async getEmotionalParameters(
    userId: string,
    emotion: keyof EmotionalCalibration
  ): Promise<VoiceParameters | null> {
    try {
      const voiceProfile = await this.getVoiceProfile(userId)
      
      if (!voiceProfile || !voiceProfile.emotional_calibration) {
        return null
      }

      return voiceProfile.emotional_calibration[emotion] || null
    } catch (error) {
      console.error('Error getting emotional parameters:', error)
      return null
    }
  }

  /**
   * Update quality metrics for a voice profile
   */
  async updateQualityMetrics(
    userId: string,
    qualityMetrics: QualityMetrics
  ): Promise<void> {
    try {
      const existingProfile = await this.getVoiceProfile(userId)
      
      if (!existingProfile) {
        throw new Error('No voice profile found for user')
      }

      const updatedProfile: VoiceProfile = {
        ...existingProfile,
        quality_metrics: qualityMetrics,
        last_updated: new Date().toISOString()
      }

      await this.saveVoiceProfile(userId, updatedProfile)
      console.log('Quality metrics updated successfully')
    } catch (error) {
      console.error('Error updating quality metrics:', error)
      throw error
    }
  }

  /**
   * Ensure user profile exists in the database
   */
  private async ensureProfileExists(userId: string): Promise<void> {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to check profile existence: ${error.message}`)
    }

    if (!data) {
      const { error: insertError } = await supabase
        .from('profiles')
        .insert([{ user_id: userId }])

      if (insertError) {
        throw new Error(`Failed to create profile: ${insertError.message}`)
      }
    }
  }

  /**
   * Get stored sessions from localStorage (fallback storage)
   */
  private getStoredSessions(): Record<string, VoiceTrainingSession> {
    try {
      const stored = localStorage.getItem('voice_training_sessions')
      return stored ? JSON.parse(stored) : {}
    } catch (error) {
      console.error('Error reading stored sessions:', error)
      return {}
    }
  }

  /**
   * Clear all stored voice training sessions (cleanup utility)
   */
  async clearVoiceTrainingSessions(): Promise<void> {
    try {
      localStorage.removeItem('voice_training_sessions')
      console.log('Voice training sessions cleared')
    } catch (error) {
      console.error('Error clearing voice training sessions:', error)
    }
  }

  /**
   * Export voice profile data for backup
   */
  async exportVoiceProfile(userId: string): Promise<string> {
    try {
      const voiceProfile = await this.getVoiceProfile(userId)
      
      if (!voiceProfile) {
        throw new Error('No voice profile found for user')
      }

      return JSON.stringify(voiceProfile, null, 2)
    } catch (error) {
      console.error('Error exporting voice profile:', error)
      throw error
    }
  }

  /**
   * Import voice profile data from backup
   */
  async importVoiceProfile(userId: string, profileData: string): Promise<void> {
    try {
      const voiceProfile: VoiceProfile = JSON.parse(profileData)
      
      // Validate the imported data structure
      if (!voiceProfile.voice_id || !voiceProfile.emotional_calibration) {
        throw new Error('Invalid voice profile data format')
      }

      // Update timestamps
      voiceProfile.last_updated = new Date().toISOString()

      await this.saveVoiceProfile(userId, voiceProfile)
      console.log('Voice profile imported successfully')
    } catch (error) {
      console.error('Error importing voice profile:', error)
      throw error
    }
  }
}

// Export singleton instance
export const voiceProfileService = new VoiceProfileService()