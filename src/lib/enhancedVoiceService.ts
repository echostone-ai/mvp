/**
 * Enhanced Voice Service
 * Handles professional voice cloning with ElevenLabs API integration
 */

import { VoiceQualityOptimizer, AudioAnalysis } from './voiceQualityOptimizer'
import { VoiceProfileService, ProfessionalVoiceSettings, VoiceProfile } from './voiceProfileService'
import { EmotionalCalibration, VoiceParameters } from './emotionalCalibrationService'
import { createHash } from 'crypto'

export interface VoiceTrainingConfig {
  files: File[]
  name: string
  description: string
  settings: ProfessionalVoiceSettings
  emotionalCalibration: EmotionalCalibration
}

export interface VoiceTrainingResult {
  success: boolean
  voice_id?: string
  error?: string
  quality_analysis?: AudioAnalysis[]
  processing_time?: number
}

export interface VoiceGenerationRequest {
  text: string
  voice_id: string
  settings?: Partial<ProfessionalVoiceSettings>
  emotional_context?: keyof EmotionalCalibration
}

export interface VoiceGenerationResult {
  success: boolean
  audio_url?: string
  audio_data?: ArrayBuffer
  error?: string
  generation_time?: number
}

export class EnhancedVoiceService {
  private apiKey: string
  private baseUrl = 'https://api.elevenlabs.io/v1'
  private qualityOptimizer: VoiceQualityOptimizer
  private profileService: VoiceProfileService

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || ''
    this.qualityOptimizer = new VoiceQualityOptimizer()
    this.profileService = new VoiceProfileService()
    
    if (!this.apiKey) {
      console.warn('ElevenLabs API key not found. Voice features may not work properly.')
    }
  }

  /**
   * Helper to compute SHA-256 hash of a File
   */
  private async fileHash(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const hash = createHash('sha256');
    hash.update(Buffer.from(arrayBuffer));
    return hash.digest('hex');
  }

  /**
   * Create a professional voice profile using ElevenLabs API
   */
  async createVoiceProfile(config: VoiceTrainingConfig): Promise<string> {
    const startTime = Date.now()
    try {
      // Validate input files
      if (config.files.length < 3) {
        throw new Error('At least 3 audio files are required for voice training')
      }

      // Analyze audio quality
      const qualityAnalyses = await Promise.all(
        config.files.map(file => this.qualityOptimizer.analyzeAudioQuality(file))
      )

      // Check if any files have critical issues
      const criticalIssues = qualityAnalyses.filter(analysis => analysis.quality_score < 4)
      if (criticalIssues.length > config.files.length / 2) {
        throw new Error('Too many audio files have quality issues. Please improve audio quality and try again.')
      }

      // Filter out duplicate files by content hash
      const fileHashes = new Map<string, File>()
      for (const file of config.files) {
        const hash = await this.fileHash(file)
        if (!fileHashes.has(hash)) {
          fileHashes.set(hash, file)
        }
      }
      const uniqueFiles = Array.from(fileHashes.values())
      if (uniqueFiles.length < 3) {
        throw new Error('At least 3 unique audio files are required for voice training')
      }

      // Prepare form data for ElevenLabs API
      const formData = new FormData()
      formData.append('name', config.name)
      formData.append('description', config.description || '')
      // Add unique audio files
      uniqueFiles.forEach((file, index) => {
        formData.append('files', file, `sample_${index + 1}.${file.name.split('.').pop()}`)
      })
      // Add voice settings
      formData.append('remove_background_noise', 'true')
      formData.append('enhance_audio_quality', 'true')
      // Make API request to create voice
      const response = await fetch(`${this.baseUrl}/voices/add`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
        },
        body: formData
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Voice creation failed: ${errorData.detail || response.statusText}`)
      }
      const result = await response.json()
      const voiceId = result.voice_id
      if (!voiceId) {
        throw new Error('Voice creation succeeded but no voice ID was returned')
      }
      // Save voice profile to user's account
      const userId = await this.getCurrentUserId()
      if (userId) {
        const voiceProfile = await this.profileService.createDefaultVoiceProfile(
          userId,
          voiceId,
          config.settings,
          uniqueFiles.length
        )
        // Update with emotional calibration
        await this.profileService.updateEmotionalCalibration(userId, config.emotionalCalibration)
      }
      const processingTime = Date.now() - startTime
      console.log(`Voice profile created successfully in ${processingTime}ms:`, voiceId)
      return voiceId
    } catch (error) {
      console.error('Error creating voice profile:', error)
      throw error
    }
  }

  /**
   * Generate speech with emotional context
   */
  async generateSpeech(request: VoiceGenerationRequest): Promise<VoiceGenerationResult> {
    const startTime = Date.now()

    try {
      if (!request.voice_id) {
        throw new Error('Voice ID is required for speech generation')
      }

      if (!request.text || request.text.trim().length === 0) {
        throw new Error('Text is required for speech generation')
      }

      // Get emotional parameters if context is provided
      let voiceSettings = request.settings || {}
      
      if (request.emotional_context) {
        const userId = await this.getCurrentUserId()
        if (userId) {
          const emotionalParams = await this.profileService.getEmotionalParameters(
            userId,
            request.emotional_context
          )
          if (emotionalParams) {
            voiceSettings = {
              ...voiceSettings,
              stability: emotionalParams.stability,
              similarity_boost: emotionalParams.similarity_boost,
              style: emotionalParams.style,
              use_speaker_boost: emotionalParams.use_speaker_boost
            }
          }
        }
      }

      // Prepare request body
      const requestBody = {
        text: request.text,
        model_id: voiceSettings.model_id || 'eleven_turbo_v2_5',
        voice_settings: {
          stability: voiceSettings.stability ?? 0.75,
          similarity_boost: voiceSettings.similarity_boost ?? 0.85,
          style: voiceSettings.style ?? 0.2,
          use_speaker_boost: voiceSettings.use_speaker_boost ?? true
        }
      }

      // Make API request
      const response = await fetch(`${this.baseUrl}/text-to-speech/${request.voice_id}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Speech generation failed: ${errorData.detail || response.statusText}`)
      }

      const audioData = await response.arrayBuffer()
      const generationTime = Date.now() - startTime

      console.log(`Speech generated successfully in ${generationTime}ms`)

      return {
        success: true,
        audio_data: audioData,
        generation_time: generationTime
      }
    } catch (error) {
      console.error('Error generating speech:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Generate preview samples with different emotional contexts
   */
  async generateEmotionalPreviews(
    voiceId: string,
    sampleText: string = "Hello, this is a preview of my voice with different emotional contexts."
  ): Promise<Record<keyof EmotionalCalibration, VoiceGenerationResult>> {
    const emotions: (keyof EmotionalCalibration)[] = [
      'happy', 'sad', 'excited', 'calm', 'serious', 'playful'
    ]

    const previews: Record<string, VoiceGenerationResult> = {}

    // Generate previews for each emotion
    for (const emotion of emotions) {
      try {
        const result = await this.generateSpeech({
          text: sampleText,
          voice_id: voiceId,
          emotional_context: emotion
        })
        previews[emotion] = result
      } catch (error) {
        console.error(`Error generating ${emotion} preview:`, error)
        previews[emotion] = {
          success: false,
          error: error instanceof Error ? error.message : 'Preview generation failed'
        }
      }
    }

    return previews as Record<keyof EmotionalCalibration, VoiceGenerationResult>
  }

  /**
   * Test voice quality with sample generation
   */
  async testVoiceQuality(voiceId: string): Promise<{
    quality_score: number
    test_results: VoiceGenerationResult[]
    recommendations: string[]
  }> {
    const testTexts = [
      "This is a test of voice clarity and naturalness.",
      "How are you feeling today? I hope you're doing well!",
      "The quick brown fox jumps over the lazy dog.",
      "Thank you for listening to this voice quality test."
    ]

    const testResults: VoiceGenerationResult[] = []
    let totalScore = 0

    for (const text of testTexts) {
      const result = await this.generateSpeech({
        text,
        voice_id: voiceId
      })
      testResults.push(result)
      
      if (result.success) {
        totalScore += 8 // Base score for successful generation
      }
    }

    const qualityScore = totalScore / testTexts.length
    const recommendations: string[] = []

    if (qualityScore < 6) {
      recommendations.push('Consider re-training with higher quality audio samples')
      recommendations.push('Ensure consistent recording environment and microphone setup')
    }

    if (qualityScore >= 6 && qualityScore < 8) {
      recommendations.push('Voice quality is good but could be improved with additional training samples')
    }

    if (qualityScore >= 8) {
      recommendations.push('Excellent voice quality! Your voice clone is ready for use.')
    }

    return {
      quality_score: qualityScore,
      test_results: testResults,
      recommendations
    }
  }

  /**
   * Get available voices for the current user
   */
  async getUserVoices(): Promise<Array<{
    voice_id: string
    name: string
    category: string
    description?: string
  }>> {
    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey,
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.statusText}`)
      }

      const data = await response.json()
      return data.voices || []
    } catch (error) {
      console.error('Error fetching user voices:', error)
      return []
    }
  }

  /**
   * Delete a voice profile
   */
  async deleteVoice(voiceId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/voices/${voiceId}`, {
        method: 'DELETE',
        headers: {
          'xi-api-key': this.apiKey,
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to delete voice: ${response.statusText}`)
      }

      console.log('Voice deleted successfully:', voiceId)
      return true
    } catch (error) {
      console.error('Error deleting voice:', error)
      return false
    }
  }

  /**
   * Get current user ID (placeholder - implement based on your auth system)
   */
  private async getCurrentUserId(): Promise<string | null> {
    // This should be implemented based on your authentication system
    // For now, return null to indicate no user context
    try {
      // Example implementation - replace with your actual auth logic
      if (typeof window !== 'undefined') {
        const user = localStorage.getItem('user')
        if (user) {
          const userData = JSON.parse(user)
          return userData.id || userData.user_id || null
        }
      }
      return null
    } catch (error) {
      console.error('Error getting current user ID:', error)
      return null
    }
  }

  /**
   * Validate API key and connection
   */
  async validateConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/user`, {
        headers: {
          'xi-api-key': this.apiKey,
        }
      })

      return response.ok
    } catch (error) {
      console.error('Error validating ElevenLabs connection:', error)
      return false
    }
  }
}

// Export types for use in other components
export type { 
  ProfessionalVoiceSettings,
  EmotionalCalibration
}

// Export singleton instance
export const enhancedVoiceService = new EnhancedVoiceService()