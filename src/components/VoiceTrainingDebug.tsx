'use client'

import React, { useState } from 'react'

interface VoiceTrainingDebugProps {
  avatarId?: string
}

export default function VoiceTrainingDebug({ avatarId }: VoiceTrainingDebugProps) {
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [showDebug, setShowDebug] = useState(false)

  const checkElevenLabsConnection = async () => {
    setLoading(true)
    setLogs(prev => [...prev, '🔍 Testing ElevenLabs API connection...'])
    
    try {
      const response = await fetch('/api/debug/elevenlabs', {
        method: 'GET'
      })
      
      const data = await response.json()
      
      if (data.success) {
        setLogs(prev => [...prev, '✅ ElevenLabs API connection successful'])
        setLogs(prev => [...prev, `📊 Subscription tier: ${data.tier || 'Unknown'}`])
        setLogs(prev => [...prev, `🔢 Character quota: ${data.characterQuota || 'Unknown'}`])
        setLogs(prev => [...prev, `🎭 Voice count: ${data.voiceCount || 'Unknown'}`])
      } else {
        setLogs(prev => [...prev, `❌ ElevenLabs API error: ${data.error || 'Unknown error'}`])
      }
    } catch (error: any) {
      setLogs(prev => [...prev, `❌ Connection test failed: ${error.message || 'Unknown error'}`])
    } finally {
      setLoading(false)
    }
  }

  const checkSupabaseConnection = async () => {
    setLoading(true)
    setLogs(prev => [...prev, '🔍 Testing Supabase connection...'])
    
    try {
      const response = await fetch('/api/debug/supabase', {
        method: 'GET'
      })
      
      const data = await response.json()
      
      if (data.success) {
        setLogs(prev => [...prev, '✅ Supabase connection successful'])
        if (data.user) {
          setLogs(prev => [...prev, `👤 Authenticated as: ${data.user.email || 'Unknown'}`])
        } else {
          setLogs(prev => [...prev, '⚠️ Not authenticated'])
        }
      } else {
        setLogs(prev => [...prev, `❌ Supabase error: ${data.error || 'Unknown error'}`])
      }
    } catch (error: any) {
      setLogs(prev => [...prev, `❌ Connection test failed: ${error.message || 'Unknown error'}`])
    } finally {
      setLoading(false)
    }
  }

  const checkAvatarDetails = async () => {
    if (!avatarId) {
      setLogs(prev => [...prev, '❌ No avatar ID provided'])
      return
    }
    
    setLoading(true)
    setLogs(prev => [...prev, `🔍 Checking avatar details for ID: ${avatarId}...`])
    
    try {
      const response = await fetch(`/api/debug/avatar?id=${avatarId}`, {
        method: 'GET'
      })
      
      const data = await response.json()
      
      if (data.success && data.avatar) {
        setLogs(prev => [...prev, '✅ Avatar details retrieved successfully'])
        setLogs(prev => [...prev, `📝 Name: ${data.avatar.name || 'Unknown'}`])
        setLogs(prev => [...prev, `🎤 Voice ID: ${data.avatar.voice_id || 'None'}`])
        setLogs(prev => [...prev, `👤 User ID: ${data.avatar.user_id || 'Unknown'}`])
      } else {
        setLogs(prev => [...prev, `❌ Avatar error: ${data.error || 'Unknown error'}`])
      }
    } catch (error: any) {
      setLogs(prev => [...prev, `❌ Avatar check failed: ${error.message || 'Unknown error'}`])
    } finally {
      setLoading(false)
    }
  }

  const clearLogs = () => {
    setLogs([])
  }

  if (!showDebug) {
    return (
      <div className="mt-4 text-center">
        <button 
          onClick={() => setShowDebug(true)}
          className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded"
        >
          Show Debug Tools
        </button>
      </div>
    )
  }

  return (
    <div className="mt-8 p-4 bg-gray-900 border border-gray-700 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-purple-300">Voice Training Debug Tools</h3>
        <button 
          onClick={() => setShowDebug(false)}
          className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded"
        >
          Hide
        </button>
      </div>
      
      <div className="flex flex-wrap gap-2 mb-4">
        <button 
          onClick={checkElevenLabsConnection}
          disabled={loading}
          className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
        >
          Test ElevenLabs API
        </button>
        <button 
          onClick={checkSupabaseConnection}
          disabled={loading}
          className="bg-green-700 hover:bg-green-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
        >
          Test Supabase
        </button>
        <button 
          onClick={checkAvatarDetails}
          disabled={loading || !avatarId}
          className="bg-purple-700 hover:bg-purple-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
        >
          Check Avatar Details
        </button>
        <button 
          onClick={clearLogs}
          className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
        >
          Clear Logs
        </button>
      </div>
      
      <div className="bg-black p-3 rounded h-48 overflow-y-auto font-mono text-xs">
        {logs.length === 0 ? (
          <div className="text-gray-500">No logs yet. Run a test to see results.</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="text-green-400 mb-1">{log}</div>
          ))
        )}
        {loading && <div className="text-yellow-400 animate-pulse">Processing...</div>}
      </div>
      
      <div className="mt-4 text-xs text-gray-400">
        Note: These tools are for debugging voice training issues only.
      </div>
    </div>
  )
}