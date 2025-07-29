'use client'

import React, { useState } from 'react'

export default function DebugVoice() {
  const [debugInfo, setDebugInfo] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const checkEnvironment = () => {
    const info = `
🔍 CLIENT-SIDE ENVIRONMENT CHECK:
=====================================

Voice ID:
- NEXT_PUBLIC_ELEVENLABS_VOICE_ID: ${process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || 'NOT SET'}
- Expected: CO6pxVrMZfyL61ZIglyr
- Match: ${process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID === 'CO6pxVrMZfyL61ZIglyr' ? '✅' : '❌'}

API Key:
- NEXT_PUBLIC_ELEVENLABS_API_KEY: ${process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY ? `Set (${process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY.length} chars)` : 'NOT SET'}
- Starts with 'sk_': ${process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY?.startsWith('sk_') ? '✅' : '❌'}

Other Environment:
- NODE_ENV: ${process.env.NODE_ENV}
- NEXT_PUBLIC_BASE_URL: ${process.env.NEXT_PUBLIC_BASE_URL}

⚠️  NOTE: Only NEXT_PUBLIC_ variables are available on the client side.
Server-side variables (without NEXT_PUBLIC_) won't show here.
    `.trim()
    
    setDebugInfo(info)
  }

  const testServerEnvironment = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/debug-env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true })
      })
      
      if (response.ok) {
        const data = await response.json()
        setDebugInfo(`🔍 SERVER-SIDE ENVIRONMENT CHECK:
=====================================

${data.debug || 'No debug info returned'}`)
      } else {
        setDebugInfo(`❌ Server environment check failed: ${response.status}`)
      }
    } catch (error) {
      setDebugInfo(`❌ Server environment check error: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const testVoiceAPI = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Test voice synthesis',
          voiceId: 'CO6pxVrMZfyL61ZIglyr'
        })
      })
      
      const responseText = await response.text()
      
      setDebugInfo(`🔍 VOICE API TEST:
=====================================

Status: ${response.status}
Content-Type: ${response.headers.get('content-type')}
Response Size: ${responseText.length} bytes

${response.ok ? '✅ API call successful' : '❌ API call failed'}

Response Preview: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`)
      
    } catch (error) {
      setDebugInfo(`❌ Voice API test error: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">Voice Debug Tool</h1>
        
        <div className="bg-red-900/20 border border-red-600 rounded-lg p-4 mb-8">
          <h2 className="text-red-300 font-semibold mb-2">🚨 Current Issue:</h2>
          <p className="text-red-200">
            Homepage is using different accents instead of the expected voice ID: CO6pxVrMZfyL61ZIglyr
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <button
            onClick={checkEnvironment}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded w-full"
          >
            Check Client Environment Variables
          </button>
          
          <button
            onClick={testServerEnvironment}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-3 rounded w-full"
          >
            {isLoading ? 'Checking Server Environment...' : 'Check Server Environment Variables'}
          </button>
          
          <button
            onClick={testVoiceAPI}
            disabled={isLoading}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-6 py-3 rounded w-full"
          >
            {isLoading ? 'Testing Voice API...' : 'Test Voice API Call'}
          </button>
        </div>

        {debugInfo && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Debug Results:</h3>
            <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">{debugInfo}</pre>
          </div>
        )}

        <div className="mt-8 bg-yellow-900/20 border border-yellow-600 rounded-lg p-4">
          <h3 className="text-yellow-300 font-semibold mb-2">🔧 Troubleshooting Steps:</h3>
          <ol className="text-yellow-200 text-sm space-y-2 list-decimal list-inside">
            <li>Check if .env.local has the correct API key (not masked with asterisks)</li>
            <li>Restart the Next.js development server after changing environment variables</li>
            <li>Verify the ElevenLabs API key is valid and has access to voice CO6pxVrMZfyL61ZIglyr</li>
            <li>Check browser console and server logs for detailed error messages</li>
            <li>Test with a different voice ID to see if the issue is voice-specific</li>
          </ol>
        </div>
      </div>
    </div>
  )
}