/**
 * Generic hook for streaming audio with expression integration
 * Works with any avatar that has uploaded expressions
 */

import { useRef } from 'react'
import { globalAudioManager } from '@/lib/globalAudioManager'

interface StreamingAudioOptions {
  avatarId: string
  onTextUpdate?: (text: string) => void
  onComplete?: (fullText: string) => void
}

export function useStreamingWithExpressions(options: StreamingAudioOptions) {
  const { avatarId, onTextUpdate, onComplete } = options
  
  // Sequential audio queue manager with expression support
  class SequentialAudioQueue {
    private queue: Array<{ 
      sentence: string; 
      audioPromise: Promise<ArrayBuffer>;
      hasExpression?: boolean;
      expressionType?: string;
    }> = []
    private isPlaying = false
    
    async addSentence(sentence: string) {
      console.log('🎵 Queuing sentence:', sentence.substring(0, 50) + '...')
      
      // Check if this sentence should have an expression
      const expressionType = this.detectExpression(sentence)
      
      // Start TTS generation immediately (parallel)
      const audioPromise = this.generateTTS(sentence)
      this.queue.push({ 
        sentence, 
        audioPromise,
        hasExpression: !!expressionType,
        expressionType 
      })
      
      // Start playing if not already playing
      if (!this.isPlaying) {
        this.playNext()
      }
    }
    
    private detectExpression(sentence: string): string | null {
      const lowerSentence = sentence.toLowerCase()
      
      // Laugh triggers
      if (lowerSentence.includes('funny') || lowerSentence.includes('hilarious') || 
          lowerSentence.includes('laugh') || lowerSentence.includes('joke') ||
          lowerSentence.includes('ridiculous') || lowerSentence.includes('crazy') ||
          lowerSentence.includes('silly') || lowerSentence.includes('couldn\'t help but laugh')) {
        return 'laugh'
      }
      
      // Sigh triggers  
      if (lowerSentence.includes('unfortunately') || lowerSentence.includes('sad') ||
          lowerSentence.includes('disappointing') || lowerSentence.includes('tough') ||
          lowerSentence.includes('sigh') || lowerSentence.includes('oh well')) {
        return 'sigh'
      }
      
      // Jeez triggers (frustration/surprise)
      if (lowerSentence.includes('jeez') || lowerSentence.includes('geez') ||
          lowerSentence.includes('wow') || lowerSentence.includes('unbelievable') ||
          lowerSentence.includes('can you believe')) {
        return 'jeez'
      }
      
      return null
    }
    
    private async generateTTS(sentence: string): Promise<ArrayBuffer> {
      const response = await fetch('/api/voice-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sentence,
          avatar: avatarId // Use dynamic avatar ID
        })
      })
      
      if (!response.ok) {
        throw new Error(`TTS failed: ${response.status}`)
      }
      
      return await response.arrayBuffer()
    }
    
    private async playNext() {
      if (this.queue.length === 0) {
        this.isPlaying = false
        return
      }
      
      this.isPlaying = true
      const { sentence, audioPromise, hasExpression, expressionType } = this.queue.shift()!
      
      try {
        console.log('🎵 Playing:', sentence.substring(0, 30) + '...')
        
        // Play expression first if detected
        if (hasExpression && expressionType) {
          console.log('🎭 Playing expression before sentence:', expressionType)
          await this.playExpression(expressionType)
          // Small pause after expression
          await new Promise(resolve => setTimeout(resolve, 200))
        }
        
        // Wait for TTS to complete, then play immediately
        const audioBuffer = await audioPromise
        const blob = new Blob([audioBuffer], { type: 'audio/mpeg' })
        const audio = new Audio(URL.createObjectURL(blob))
        audio.volume = 1.0
        
        // Play and wait for completion
        await globalAudioManager.playAudio(audio)
        
        // Clean up URL
        URL.revokeObjectURL(audio.src)
        
        console.log('🎵 Completed:', sentence.substring(0, 30) + '...')
        
        // Small natural pause between sentences (like Siri)
        await new Promise(resolve => setTimeout(resolve, 150))
        
      } catch (error) {
        console.warn('Audio playback failed:', error)
      }
      
      // Continue to next sentence
      this.playNext()
    }
    
    private async playExpression(expressionType: string) {
      try {
        const response = await fetch('/api/expressions/play', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            avatarId: avatarId, // Use dynamic avatar ID
            type: expressionType
          })
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.expression && data.expression.cdnUrl) {
            console.log('🎭 Playing expression:', data.expression.cdnUrl)
            
            // Enhanced audio processing for better volume matching
            const audio = await this.createNormalizedAudio(data.expression.cdnUrl)
            await globalAudioManager.playAudio(audio)
          }
        } else {
          console.warn('🎭 No expression found for type:', expressionType)
        }
      } catch (error) {
        console.warn('🎭 Expression playback failed:', error)
      }
    }
    
    private async createNormalizedAudio(url: string): Promise<HTMLAudioElement> {
      return new Promise((resolve, reject) => {
        const audio = new Audio(url)
        
        // Boost volume significantly to match ElevenLabs TTS
        audio.volume = 1.0
        
        // Use Web Audio API for better volume control and normalization
        audio.addEventListener('canplaythrough', () => {
          try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
            const source = audioContext.createMediaElementSource(audio)
            const gainNode = audioContext.createGain()
            
            // Boost gain to match TTS volume (2.5x louder)
            gainNode.gain.value = 2.5
            
            // Connect: source -> gain -> destination
            source.connect(gainNode)
            gainNode.connect(audioContext.destination)
            
            console.log('🎭 Audio normalized with 2.5x gain boost')
            resolve(audio)
          } catch (error) {
            console.warn('🎭 Web Audio API failed, using standard audio:', error)
            // Fallback: just use higher volume
            audio.volume = 1.0
            resolve(audio)
          }
        })
        
        audio.addEventListener('error', reject)
        
        // Preload the audio
        audio.preload = 'auto'
        audio.load()
      })
    }
    
    async waitForCompletion() {
      while (this.isPlaying || this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
  }
  
  const audioQueueRef = useRef<SequentialAudioQueue | null>(null)
  
  const processStreamingResponse = async (response: Response, userMessage: string) => {
    if (!response.body) return
    
    const audioQueue = new SequentialAudioQueue()
    audioQueueRef.current = audioQueue
    
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let full = ''
    let processedSentences = 0
    
    // Helper function to extract complete sentences
    const extractCompleteSentences = (text: string): string[] => {
      const sentences = text.split(/(?<=[.!?])\s+/)
      return sentences.filter(s => {
        const trimmed = s.trim()
        return trimmed.length > 10 && /[.!?]$/.test(trimmed)
      })
    }

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value, { stream: true })
        
        // Parse SSE format
        const lines = chunk.split('\n')
        let shouldEnd = false
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.event === 'meta') continue
              
              if (data.event === 'end') {
                shouldEnd = true
                continue
              }
              
              if (data.delta) {
                full += data.delta
                onTextUpdate?.(full)
                
                // Check for new complete sentences
                const completeSentences = extractCompleteSentences(full)
                if (completeSentences.length > processedSentences) {
                  // Add new sentences to queue
                  for (let i = processedSentences; i < completeSentences.length; i++) {
                    await audioQueue.addSentence(completeSentences[i])
                  }
                  processedSentences = completeSentences.length
                }
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
        
        if (shouldEnd) break
      }

      // Handle any remaining partial sentence
      const allSentences = full.split(/(?<=[.!?])\s+/)
      const lastPart = allSentences[allSentences.length - 1]?.trim()
      
      if (lastPart && lastPart.length > 5 && !lastPart.match(/[.!?]$/)) {
        const finalSentence = lastPart + '...'
        await audioQueue.addSentence(finalSentence)
      }

      // Wait for all audio to complete sequentially
      await audioQueue.waitForCompletion()
      onComplete?.(full)
      
    } finally {
      reader.releaseLock()
    }
  }
  
  const stopAudio = () => {
    // Stop current audio playback
    globalAudioManager.stopAll?.()
  }
  
  return {
    processStreamingResponse,
    stopAudio
  }
}