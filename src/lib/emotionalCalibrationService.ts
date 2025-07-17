/**
 * Emotional Calibration Service
 * Handles emotional parameter calculation and voice calibration for different contexts
 */

export interface VoiceParameters {
  stability: number
  similarity_boost: number
  style: number
  use_speaker_boost: boolean
}

export interface EmotionalCalibration {
  happy: VoiceParameters
  sad: VoiceParameters
  excited: VoiceParameters
  calm: VoiceParameters
  serious: VoiceParameters
  playful: VoiceParameters
  angry: VoiceParameters
  surprised: VoiceParameters
  neutral: VoiceParameters
}

export interface EmotionalContext {
  emotion: keyof EmotionalCalibration
  intensity: number // 0-1 scale
  context_type: 'conversation' | 'narrative' | 'expressive' | 'formal'
  user_preference?: Partial<VoiceParameters>
}

export interface CalibrationSample {
  emotion: keyof EmotionalCalibration
  text: string
  voice_id: string
  parameters: VoiceParameters
  audio_url?: string
  quality_score?: number
}

export interface CalibrationWorkflow {
  user_id: string
  voice_id: string
  samples: CalibrationSample[]
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  created_at: string
  completed_at?: string
}

export class EmotionalCalibrationService {
  // Base emotional parameter templates
  private readonly EMOTIONAL_TEMPLATES: EmotionalCalibration = {
    happy: {
      stability: 0.6,
      similarity_boost: 0.8,
      style: 0.4,
      use_speaker_boost: true
    },
    sad: {
      stability: 0.8,
      similarity_boost: 0.9,
      style: 0.1,
      use_speaker_boost: true
    },
    excited: {
      stability: 0.5,
      similarity_boost: 0.7,
      style: 0.6,
      use_speaker_boost: true
    },
    calm: {
      stability: 0.9,
      similarity_boost: 0.85,
      style: 0.1,
      use_speaker_boost: true
    },
    serious: {
      stability: 0.85,
      similarity_boost: 0.9,
      style: 0.05,
      use_speaker_boost: true
    },
    playful: {
      stability: 0.6,
      similarity_boost: 0.75,
      style: 0.5,
      use_speaker_boost: true
    },
    angry: {
      stability: 0.7,
      similarity_boost: 0.8,
      style: 0.3,
      use_speaker_boost: true
    },
    surprised: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.4,
      use_speaker_boost: true
    },
    neutral: {
      stability: 0.75,
      similarity_boost: 0.85,
      style: 0.2,
      use_speaker_boost: true
    }
  }

  // Sample texts for emotional calibration
  private readonly CALIBRATION_TEXTS: Record<keyof EmotionalCalibration, string[]> = {
    happy: [
      "I'm so excited to share this wonderful news with you!",
      "This is absolutely fantastic! I couldn't be happier about how things turned out.",
      "What a beautiful day! Everything seems to be going perfectly."
    ],
    sad: [
      "I'm feeling quite down about this situation. It's been really difficult.",
      "This news is heartbreaking. I need some time to process everything.",
      "I'm sorry to hear about what happened. My thoughts are with you."
    ],
    excited: [
      "Oh my goodness, this is incredible! I can barely contain my excitement!",
      "This is the best thing that's happened all year! I'm absolutely thrilled!",
      "I can't wait to get started! This is going to be amazing!"
    ],
    calm: [
      "Let's take a moment to breathe and think this through carefully.",
      "Everything will work out fine. We just need to stay focused and patient.",
      "I feel peaceful and centered. This is a good place to make decisions from."
    ],
    serious: [
      "We need to address this matter with the utmost care and attention.",
      "This is a significant issue that requires our immediate and focused attention.",
      "I want to be completely clear about the importance of this situation."
    ],
    playful: [
      "Hey there! Want to try something fun and silly together?",
      "Life's too short not to laugh and enjoy the little moments!",
      "Come on, let's be a little mischievous and see what happens!"
    ],
    angry: [
      "This is completely unacceptable! I'm very frustrated with this situation.",
      "I'm really upset about how this was handled. This needs to change immediately.",
      "This makes me angry. We cannot let this continue any longer."
    ],
    surprised: [
      "Wow! I definitely wasn't expecting that to happen!",
      "Oh my! That caught me completely off guard!",
      "Really? That's quite surprising! I never would have guessed."
    ],
    neutral: [
      "Let me explain the situation clearly and objectively.",
      "Here are the facts as I understand them currently.",
      "I'd like to discuss this matter in a straightforward way."
    ]
  }

  /**
   * Calculate emotional parameters based on context and user preferences
   */
  calculateEmotionalParameters(
    context: EmotionalContext,
    baseCalibration?: EmotionalCalibration
  ): VoiceParameters {
    const calibration = baseCalibration || this.EMOTIONAL_TEMPLATES
    const baseParams = calibration[context.emotion]
    
    // Apply intensity scaling
    const intensityFactor = context.intensity
    const adjustedParams = this.applyIntensityScaling(baseParams, intensityFactor)
    
    // Apply context-specific modifications
    const contextAdjustedParams = this.applyContextModifications(adjustedParams, context.context_type)
    
    // Apply user preferences if provided
    const finalParams = context.user_preference 
      ? { ...contextAdjustedParams, ...context.user_preference }
      : contextAdjustedParams
    
    return this.validateParameters(finalParams)
  }

  /**
   * Apply intensity scaling to voice parameters
   */
  private applyIntensityScaling(params: VoiceParameters, intensity: number): VoiceParameters {
    // Clamp intensity between 0 and 1
    const clampedIntensity = Math.max(0, Math.min(1, intensity))
    
    return {
      stability: this.scaleParameter(params.stability, clampedIntensity, 0.1, 0.9),
      similarity_boost: this.scaleParameter(params.similarity_boost, clampedIntensity, 0.5, 1.0),
      style: this.scaleParameter(params.style, clampedIntensity, 0, 1),
      use_speaker_boost: params.use_speaker_boost
    }
  }

  /**
   * Scale individual parameter based on intensity
   */
  private scaleParameter(baseValue: number, intensity: number, min: number, max: number): number {
    // For low intensity, move towards neutral (0.5 for most params)
    // For high intensity, enhance the characteristic
    const neutral = 0.5
    const scaledValue = intensity < 0.5 
      ? baseValue + (neutral - baseValue) * (1 - intensity * 2)
      : baseValue + (baseValue > neutral ? (max - baseValue) : (baseValue - min)) * ((intensity - 0.5) * 2)
    
    return Math.max(min, Math.min(max, scaledValue))
  }

  /**
   * Apply context-specific modifications
   */
  private applyContextModifications(params: VoiceParameters, contextType: EmotionalContext['context_type']): VoiceParameters {
    const modifications = {
      conversation: { stability: 0.05, style: 0.1 }, // Slightly more natural
      narrative: { stability: 0.1, style: -0.05 }, // More stable for storytelling
      expressive: { stability: -0.1, style: 0.15 }, // More expressive
      formal: { stability: 0.15, style: -0.1 } // More controlled
    }

    const mod = modifications[contextType]
    
    return {
      stability: Math.max(0, Math.min(1, params.stability + mod.stability)),
      similarity_boost: params.similarity_boost,
      style: Math.max(0, Math.min(1, params.style + mod.style)),
      use_speaker_boost: params.use_speaker_boost
    }
  }

  /**
   * Validate and clamp parameters to acceptable ranges
   */
  private validateParameters(params: VoiceParameters): VoiceParameters {
    return {
      stability: Math.max(0, Math.min(1, params.stability)),
      similarity_boost: Math.max(0, Math.min(1, params.similarity_boost)),
      style: Math.max(0, Math.min(1, params.style)),
      use_speaker_boost: params.use_speaker_boost
    }
  }

  /**
   * Create calibration workflow for a user's voice
   */
  async createCalibrationWorkflow(userId: string, voiceId: string): Promise<CalibrationWorkflow> {
    const samples: CalibrationSample[] = []
    
    // Create samples for each emotion
    for (const emotion of Object.keys(this.EMOTIONAL_TEMPLATES) as Array<keyof EmotionalCalibration>) {
      const parameters = this.EMOTIONAL_TEMPLATES[emotion]
      const texts = this.CALIBRATION_TEXTS[emotion]
      
      // Use the first text for initial calibration
      samples.push({
        emotion,
        text: texts[0],
        voice_id: voiceId,
        parameters
      })
    }

    const workflow: CalibrationWorkflow = {
      user_id: userId,
      voice_id: voiceId,
      samples,
      status: 'pending',
      created_at: new Date().toISOString()
    }

    return workflow
  }

  /**
   * Generate voice samples for emotional calibration
   */
  async generateCalibrationSamples(workflow: CalibrationWorkflow): Promise<CalibrationWorkflow> {
    const updatedSamples: CalibrationSample[] = []
    
    for (const sample of workflow.samples) {
      try {
        const audioUrl = await this.generateVoiceSample(
          sample.text,
          sample.voice_id,
          sample.parameters
        )
        
        const qualityScore = await this.evaluateSampleQuality(audioUrl)
        
        updatedSamples.push({
          ...sample,
          audio_url: audioUrl,
          quality_score: qualityScore
        })
      } catch (error) {
        console.error(`Failed to generate sample for ${sample.emotion}:`, error)
        updatedSamples.push(sample) // Keep original without audio
      }
    }

    return {
      ...workflow,
      samples: updatedSamples,
      status: 'completed',
      completed_at: new Date().toISOString()
    }
  }

  /**
   * Generate a single voice sample using ElevenLabs API
   */
  private async generateVoiceSample(
    text: string,
    voiceId: string,
    parameters: VoiceParameters
  ): Promise<string> {
    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      throw new Error('Missing ELEVENLABS_API_KEY')
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: parameters.stability,
          similarity_boost: parameters.similarity_boost,
          style: parameters.style,
          use_speaker_boost: parameters.use_speaker_boost
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Voice generation failed: ${response.statusText}`)
    }

    // In a real implementation, you would save the audio blob and return a URL
    // For now, return a placeholder URL
    return `https://example.com/audio/${voiceId}_${Date.now()}.mp3`
  }

  /**
   * Evaluate the quality of a generated sample
   */
  private async evaluateSampleQuality(audioUrl: string): Promise<number> {
    // In a real implementation, this would analyze the audio quality
    // For now, return a random score between 7-9
    return 7 + Math.random() * 2
  }

  /**
   * Optimize emotional calibration based on user feedback
   */
  optimizeCalibration(
    currentCalibration: EmotionalCalibration,
    feedback: Array<{
      emotion: keyof EmotionalCalibration
      rating: number // 1-5 scale
      adjustments?: Partial<VoiceParameters>
    }>
  ): EmotionalCalibration {
    const optimizedCalibration = { ...currentCalibration }

    for (const item of feedback) {
      const currentParams = optimizedCalibration[item.emotion]
      
      if (item.adjustments) {
        // Apply user-specified adjustments
        optimizedCalibration[item.emotion] = {
          ...currentParams,
          ...item.adjustments
        }
      } else if (item.rating < 3) {
        // Poor rating - adjust towards more neutral settings
        optimizedCalibration[item.emotion] = {
          stability: this.adjustTowardsNeutral(currentParams.stability, 0.75),
          similarity_boost: this.adjustTowardsNeutral(currentParams.similarity_boost, 0.85),
          style: this.adjustTowardsNeutral(currentParams.style, 0.2),
          use_speaker_boost: currentParams.use_speaker_boost
        }
      } else if (item.rating > 4) {
        // Good rating - slightly enhance the characteristics
        optimizedCalibration[item.emotion] = {
          stability: this.enhanceCharacteristic(currentParams.stability, item.emotion),
          similarity_boost: Math.min(1, currentParams.similarity_boost + 0.02),
          style: this.enhanceCharacteristic(currentParams.style, item.emotion),
          use_speaker_boost: currentParams.use_speaker_boost
        }
      }
    }

    return optimizedCalibration
  }

  /**
   * Adjust parameter towards neutral value
   */
  private adjustTowardsNeutral(current: number, neutral: number): number {
    const adjustment = (neutral - current) * 0.3
    return Math.max(0, Math.min(1, current + adjustment))
  }

  /**
   * Enhance characteristic based on emotion type
   */
  private enhanceCharacteristic(current: number, emotion: keyof EmotionalCalibration): number {
    const enhancementMap = {
      happy: 0.02,
      excited: 0.03,
      playful: 0.02,
      sad: -0.02,
      calm: -0.01,
      serious: -0.02,
      angry: 0.01,
      surprised: 0.02,
      neutral: 0
    }

    const enhancement = enhancementMap[emotion] || 0
    return Math.max(0, Math.min(1, current + enhancement))
  }

  /**
   * Get sample texts for a specific emotion
   */
  getCalibrationTexts(emotion: keyof EmotionalCalibration): string[] {
    return [...this.CALIBRATION_TEXTS[emotion]]
  }

  /**
   * Get default emotional calibration template
   */
  getDefaultCalibration(): EmotionalCalibration {
    return { ...this.EMOTIONAL_TEMPLATES }
  }

  /**
   * Analyze conversation context to determine appropriate emotion
   */
  analyzeConversationContext(message: string, conversationHistory?: string[]): EmotionalContext {
    // Simple keyword-based emotion detection
    // In a real implementation, this would use NLP/sentiment analysis
    
    const lowerMessage = message.toLowerCase()
    const words = lowerMessage.split(/\s+/)
    
    // Emotion keywords
    const emotionKeywords = {
      happy: ['happy', 'joy', 'excited', 'wonderful', 'great', 'amazing', 'fantastic', 'love'],
      sad: ['sad', 'sorry', 'disappointed', 'upset', 'hurt', 'crying', 'depressed'],
      excited: ['excited', 'thrilled', 'amazing', 'incredible', 'wow', 'awesome', 'fantastic'],
      calm: ['calm', 'peaceful', 'relax', 'breathe', 'quiet', 'serene', 'tranquil'],
      serious: ['serious', 'important', 'urgent', 'critical', 'significant', 'matter'],
      playful: ['fun', 'play', 'silly', 'joke', 'laugh', 'funny', 'amusing'],
      angry: ['angry', 'mad', 'furious', 'upset', 'frustrated', 'annoyed'],
      surprised: ['surprised', 'wow', 'unexpected', 'shocking', 'amazing', 'incredible']
    }

    let detectedEmotion: keyof EmotionalCalibration = 'neutral'
    let maxScore = 0

    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      const score = keywords.filter(keyword => words.includes(keyword)).length
      if (score > maxScore) {
        maxScore = score
        detectedEmotion = emotion as keyof EmotionalCalibration
      }
    }

    // Determine intensity based on punctuation and capitalization
    const hasExclamation = message.includes('!')
    const hasMultipleExclamation = (message.match(/!/g) || []).length > 1
    const hasAllCaps = message.toUpperCase() === message && message.length > 3
    
    let intensity = 0.5 // Default neutral intensity
    if (hasMultipleExclamation || hasAllCaps) {
      intensity = 0.9
    } else if (hasExclamation) {
      intensity = 0.7
    }

    // Determine context type based on message characteristics
    let contextType: EmotionalContext['context_type'] = 'conversation'
    if (message.length > 200) {
      contextType = 'narrative'
    } else if (maxScore > 2) {
      contextType = 'expressive'
    }

    return {
      emotion: detectedEmotion,
      intensity,
      context_type: contextType
    }
  }
}

// Export singleton instance
export const emotionalCalibrationService = new EmotionalCalibrationService()