'use client'

import React, { useState } from 'react'

export default function TestVoiceId() {
  const [testResult, setTestResult] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const testVoiceId = async () => {
    setIsLoading(true)
    setTestResult('')

    try {
      const testText = "Hello, this is a test to verify the voice ID CO6pxVrMZfyL61ZIglyr is being used correctly."
      
      console.log('Testing voice ID: CO6pxVrMZfyL61ZIglyr')
      
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testText,
          voiceId: 'CO6pxVrMZfyL61ZIglyr',
          settings: {
            stability: 0.98,
            similarity_boost: 0.82,
            style: 0.02,
            use_speaker_boost: true
          }
        })
      })

      if (response.ok) {
        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)
        
        setTestResult(`✅ Voice synthesis successful! Audio size: ${audioBlob.size} bytes`)
        
        // Play the audio
        audio.play().catch(error => {
          console.error('Audio play failed:', error)
          setTestResult(prev => prev + '\n⚠️ Audio playback failed, but synthesis was successful')
        })
        
        // Clean up
        audio.onended = () => URL.revokeObjectURL(audioUrl)
        
      } else {
        const errorText = await response.text()
        setTestResult(`❌ Voice synthesis failed: ${response.status} - ${errorText}`)
      }
    } catch (error) {
      setTestResult(`❌ Request failed: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const testStreamingVoiceId = async () => {
    setIsLoading(true)
    setTestResult('')

    try {
      const testText = "This is a streaming voice test using the specific voice ID."
      
      console.log('Testing streaming voice ID: CO6pxVrMZfyL61ZIglyr')
      
      const response = await fetch('/api/voice-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentence: testText,
          voiceId: 'CO6pxVrMZfyL61ZIglyr',
          settings: {
            stability: 0.98,
            similarity_boost: 0.82,
            style: 0.02,
            use_speaker_boost: true
          }
        })
      })

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer()
        const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })
        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)
        
        setTestResult(`✅ Streaming voice synthesis successful! Audio size: ${audioBuffer.byteLength} bytes`)
        
        // Play the audio
        audio.play().catch(error => {
          console.error('Audio play failed:', error)
          setTestResult(prev => prev + '\n⚠️ Audio playback failed, but synthesis was successful')
        })
        
        // Clean up
        audio.onended = () => URL.revokeObjectURL(audioUrl)
        
      } else {
        const errorText = await response.text()
        setTestResult(`❌ Streaming voice synthesis failed: ${response.status} - ${errorText}`)
      }
    } catch (error) {
      setTestResult(`❌ Streaming request failed: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const testEnvironmentVariables = () => {
    const envVoiceId = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID
    const envApiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY
    
    setTestResult(`Environment Variables:
📍 NEXT_PUBLIC_ELEVENLABS_VOICE_ID: ${envVoiceId || 'Not set'}
🔑 NEXT_PUBLIC_ELEVENLABS_API_KEY: ${envApiKey ? 'Set (length: ' + envApiKey.length + ')' : 'Not set'}

Expected Voice ID: CO6pxVrMZfyL61ZIglyr
Match: ${envVoiceId === 'CO6pxVrMZfyL61ZIglyr' ? '✅ Yes' : '❌ No'}`)
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">Voice ID Test</h1>
        
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">🎯 Testing Voice ID: CO6pxVrMZfyL61ZIglyr</h2>
          <p className="text-gray-300 mb-4">
            This page tests whether the correct voice ID is being used for voice synthesis.
            If you're hearing different accents, this will help identify the issue.
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <button
            onClick={testEnvironmentVariables}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded w-full"
          >
            Check Environment Variables
          </button>
          
          <button
            onClick={testVoiceId}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-3 rounded w-full"
          >
            {isLoading ? 'Testing Regular Voice API...' : 'Test Regular Voice API'}
          </button>
          
          <button
            onClick={testStreamingVoiceId}
            disabled={isLoading}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-6 py-3 rounded w-full"
          >
            {isLoading ? 'Testing Streaming Voice API...' : 'Test Streaming Voice API'}
          </button>
        </div>

        {testResult && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Test Results:</h3>
            <pre className="text-sm text-gray-300 whitespace-pre-wrap">{testResult}</pre>
          </div>
        )}

        <div className="mt-8 bg-yellow-900/20 border border-yellow-600 rounded-lg p-4">
          <h3 className="text-yellow-300 font-semibold mb-2">🔍 Debugging Tips:</h3>
          <ul className="text-yellow-200 text-sm space-y-1">
            <li>• If environment variables don't match, check .env.local file</li>
            <li>• If synthesis fails, check ElevenLabs API key and voice ID validity</li>
            <li>• If you hear different accents, the voice ID might be wrong or the voice might have been modified</li>
            <li>• Check browser console for detailed error messages</li>
          </ul>
        </div>
      </div>
    </div>
  )
}