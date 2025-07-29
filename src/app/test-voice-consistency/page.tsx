'use client'

import React, { useState, useRef } from 'react'
import { 
  createStreamingAudioManager, 
  splitIntoPhrases,
  StreamingAudioManager,
  stopAllAudio
} from '@/lib/streamingUtils'

export default function TestVoiceConsistency() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTest, setCurrentTest] = useState<string>('')
  const streamingAudioRef = useRef<StreamingAudioManager | null>(null)

  const consistencyTests = [
    {
      title: "Tone Consistency Test",
      description: "Multiple sentences with similar emotional tone",
      sentences: [
        "Hello, I'm excited to help you today.",
        "This is going to be a wonderful conversation.",
        "I'm really looking forward to our discussion.",
        "Let's explore some interesting topics together."
      ]
    },
    {
      title: "Technical Explanation Test", 
      description: "Complex technical content with consistent delivery",
      sentences: [
        "Machine learning algorithms process data through neural networks.",
        "These networks consist of interconnected nodes called neurons.",
        "Each neuron applies mathematical functions to input data.",
        "The result is a system that can recognize patterns and make predictions."
      ]
    },
    {
      title: "Conversational Flow Test",
      description: "Natural conversation with varied sentence structures",
      sentences: [
        "So, what would you like to know about this topic?",
        "Well, there are several important aspects to consider.",
        "First, let's look at the fundamental principles.",
        "Then we can explore some practical applications."
      ]
    },
    {
      title: "Punctuation Consistency Test",
      description: "Different punctuation marks with consistent voice",
      sentences: [
        "This is a statement with a period.",
        "Is this a question with proper intonation?",
        "This is exciting news with an exclamation!",
        "Here's a pause... followed by more content."
      ]
    }
  ]

  const runConsistencyTest = async (test: typeof consistencyTests[0]) => {
    if (streamingAudioRef.current) {
      streamingAudioRef.current.stop()
    }

    await stopAllAudio()
    setIsPlaying(true)
    setCurrentTest(test.title)

    const voiceId = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || 'CO6pxVrMZfyL61ZIglyr'
    
    // Create manager with conversation ID for consistency
    streamingAudioRef.current = createStreamingAudioManager(voiceId, undefined, undefined, {
      conversationId: `consistency-test-${Date.now()}`
    })

    // Add slight delay between sentences to hear consistency
    for (let i = 0; i < test.sentences.length; i++) {
      const sentence = test.sentences[i]
      console.log(`Playing sentence ${i + 1}: ${sentence}`)
      
      await streamingAudioRef.current.addSentence(sentence)
      
      // Small delay between sentences to clearly hear the transition
      if (i < test.sentences.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    setIsPlaying(false)
    setCurrentTest('')
  }

  const runOldStyleTest = async (test: typeof consistencyTests[0]) => {
    if (streamingAudioRef.current) {
      streamingAudioRef.current.stop()
    }

    await stopAllAudio()
    setIsPlaying(true)
    setCurrentTest(`${test.title} (Old Style)`)

    const voiceId = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || 'CO6pxVrMZfyL61ZIglyr'
    
    // Create manager WITHOUT conversation ID (old behavior)
    streamingAudioRef.current = createStreamingAudioManager(voiceId)

    // Process each sentence independently (old way)
    for (let i = 0; i < test.sentences.length; i++) {
      const sentence = test.sentences[i]
      console.log(`Playing sentence ${i + 1} (old style): ${sentence}`)
      
      // Create new manager for each sentence (simulating old inconsistent behavior)
      if (i > 0) {
        streamingAudioRef.current.stop()
        streamingAudioRef.current = createStreamingAudioManager(voiceId)
      }
      
      await streamingAudioRef.current.addSentence(sentence)
      await new Promise(resolve => setTimeout(resolve, 1500))
    }

    setIsPlaying(false)
    setCurrentTest('')
  }

  const stopTest = async () => {
    if (streamingAudioRef.current) {
      streamingAudioRef.current.stop()
    }
    await stopAllAudio()
    setIsPlaying(false)
    setCurrentTest('')
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">Voice Consistency Test</h1>
        
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">🎯 Consistency Improvements:</h2>
          <ul className="space-y-2 text-gray-300">
            <li>• <strong>Conversation Context:</strong> Uses conversation ID for consistent voice characteristics</li>
            <li>• <strong>Previous Text Context:</strong> Each sentence considers the previous text for continuity</li>
            <li>• <strong>Consistent Seed:</strong> Same generation seed for similar voice patterns</li>
            <li>• <strong>Optimized Settings:</strong> High stability (0.98) and low style variation (0.02)</li>
            <li>• <strong>Text Normalization:</strong> Consistent punctuation and formatting</li>
            <li>• <strong>Model Upgrade:</strong> Using eleven_turbo_v2_5 for better consistency</li>
          </ul>
        </div>

        <div className="space-y-6">
          {consistencyTests.map((test, index) => (
            <div key={index} className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-2">{test.title}</h3>
              <p className="text-gray-400 mb-4">{test.description}</p>
              
              <div className="bg-gray-700 rounded p-4 mb-4">
                <h4 className="font-medium mb-2">Test Sentences:</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-300">
                  {test.sentences.map((sentence, i) => (
                    <li key={i}>{sentence}</li>
                  ))}
                </ol>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => runConsistencyTest(test)}
                  disabled={isPlaying}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded"
                >
                  {isPlaying && currentTest === test.title ? 'Playing...' : 'Test New (Consistent)'}
                </button>
                <button
                  onClick={() => runOldStyleTest(test)}
                  disabled={isPlaying}
                  className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 px-4 py-2 rounded"
                >
                  {isPlaying && currentTest === `${test.title} (Old Style)` ? 'Playing...' : 'Test Old (Inconsistent)'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mt-8">
          <h3 className="text-xl font-semibold mb-4">Test Controls:</h3>
          <div className="space-x-4">
            <button
              onClick={stopTest}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
            >
              Stop All Tests
            </button>
          </div>
          
          {currentTest && (
            <div className="mt-4 p-4 bg-blue-900/30 rounded">
              <p className="text-blue-300">Currently running: <strong>{currentTest}</strong></p>
              <p className="text-sm text-gray-400 mt-1">
                Listen carefully to the voice consistency between sentences. 
                The new system should maintain the same tone, pace, and vocal characteristics.
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 text-center text-gray-400">
          <p>Compare the voice consistency between the "New (Consistent)" and "Old (Inconsistent)" versions.</p>
          <p className="text-sm mt-2">The new system should have much more consistent tone and vocal characteristics across sentences.</p>
        </div>
      </div>
    </div>
  )
}