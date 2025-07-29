'use client'

import React, { useState, useRef } from 'react'
import { 
  createStreamingAudioManager, 
  splitIntoPhrases,
  StreamingAudioManager,
  stopAllAudio
} from '@/lib/streamingUtils'

export default function TestEnhancedVoice() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentText, setCurrentText] = useState('')
  const streamingAudioRef = useRef<StreamingAudioManager | null>(null)

  const testTexts = [
    "Hello there! Let me demonstrate the new enhanced voice streaming system. Notice how I start speaking immediately, with natural pauses and smooth transitions between phrases.",
    "This is a longer example to show how the system handles complex sentences. When I speak, you'll hear natural breaks at commas, conjunctions like 'and' or 'but', and other pause points that make conversation feel more human and alive.",
    "The system now includes interjections like 'hmm' or 'let's see' to fill gaps, prefetches audio for smoother playback, and breaks text into smaller, more natural speaking chunks rather than waiting for complete sentences."
  ]

  const startEnhancedDemo = async (text: string) => {
    if (streamingAudioRef.current) {
      streamingAudioRef.current.stop()
    }

    await stopAllAudio()
    setIsPlaying(true)
    setCurrentText('')

    // Use a demo voice ID - replace with actual voice ID
    const voiceId = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || 'CO6pxVrMZfyL61ZIglyr'
    
    streamingAudioRef.current = createStreamingAudioManager(voiceId)

    // Add immediate interjection
    await streamingAudioRef.current.interject("Alright...")

    // Simulate streaming text character by character
    let accumulatedText = ''
    let lastPhraseCount = 0

    for (let i = 0; i < text.length; i++) {
      accumulatedText += text[i]
      setCurrentText(accumulatedText)

      // Check for new phrases every 15 characters
      if (i % 15 === 0 && i > 10) {
        const phrases = splitIntoPhrases(accumulatedText)
        
        if (phrases.length > lastPhraseCount) {
          const endIndex = phrases.length > 1 ? phrases.length - 1 : phrases.length
          for (let j = lastPhraseCount; j < endIndex; j++) {
            const phrase = phrases[j].trim()
            if (phrase && phrase.length > 5) {
              if (phrase.match(/[.!?]$/)) {
                await streamingAudioRef.current!.addSentence(phrase)
              } else {
                await streamingAudioRef.current!.addPhrase(phrase)
              }
            }
          }
          lastPhraseCount = endIndex
        }
      }

      // Simulate streaming delay
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    // Process any remaining phrases
    const finalPhrases = splitIntoPhrases(accumulatedText)
    for (let i = lastPhraseCount; i < finalPhrases.length; i++) {
      const phrase = finalPhrases[i].trim()
      if (phrase && phrase.length > 3) {
        if (phrase.match(/[.!?]$/)) {
          await streamingAudioRef.current!.addSentence(phrase)
        } else {
          await streamingAudioRef.current!.addPhrase(phrase)
        }
      }
    }

    setIsPlaying(false)
  }

  const stopDemo = async () => {
    if (streamingAudioRef.current) {
      streamingAudioRef.current.stop()
    }
    await stopAllAudio()
    setIsPlaying(false)
    setCurrentText('')
  }

  const testInterjection = async () => {
    if (!streamingAudioRef.current) {
      const voiceId = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || 'CO6pxVrMZfyL61ZIglyr'
      streamingAudioRef.current = createStreamingAudioManager(voiceId)
    }
    
    await streamingAudioRef.current.interject("Let me think about that...")
  }

  const testThinkingSound = async () => {
    if (!streamingAudioRef.current) {
      const voiceId = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || 'CO6pxVrMZfyL61ZIglyr'
      streamingAudioRef.current = createStreamingAudioManager(voiceId)
    }
    
    await streamingAudioRef.current.addThinkingSound()
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">Enhanced Voice Streaming Test</h1>
        
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">🎯 Improvements Demonstrated:</h2>
          <ul className="space-y-2 text-gray-300">
            <li>• <strong>Immediate interjections:</strong> "Alright..." fills dead air</li>
            <li>• <strong>Phrase-level streaming:</strong> Starts speaking before full sentences</li>
            <li>• <strong>Natural pauses:</strong> Breaks at commas, conjunctions, and clauses</li>
            <li>• <strong>Audio prefetching:</strong> Next phrases load while current ones play</li>
            <li>• <strong>Reduced latency:</strong> Faster response times</li>
          </ul>
        </div>

        <div className="space-y-4 mb-8">
          {testTexts.map((text, index) => (
            <div key={index} className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Test {index + 1}:</h3>
              <p className="text-gray-300 mb-4">{text}</p>
              <button
                onClick={() => startEnhancedDemo(text)}
                disabled={isPlaying}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded mr-2"
              >
                {isPlaying ? 'Playing...' : 'Play Enhanced Demo'}
              </button>
            </div>
          ))}
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h3 className="text-xl font-semibold mb-4">Quick Tests:</h3>
          <div className="space-x-4">
            <button
              onClick={testInterjection}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
            >
              Test Interjection
            </button>
            <button
              onClick={testThinkingSound}
              className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded"
            >
              Test Thinking Sound
            </button>
            <button
              onClick={stopDemo}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
            >
              Stop All Audio
            </button>
          </div>
        </div>

        {currentText && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Current Streaming Text:</h3>
            <p className="text-gray-300 leading-relaxed">{currentText}</p>
            <div className="mt-4 text-sm text-gray-500">
              Phrases detected: {splitIntoPhrases(currentText).length}
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-gray-400">
          <p>This demo shows the enhanced voice streaming with reduced latency and more natural speech patterns.</p>
        </div>
      </div>
    </div>
  )
}