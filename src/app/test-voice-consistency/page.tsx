'use client'

import { useState } from 'react'
import { getHomepageDemoSettings } from '@/lib/naturalVoiceSettings'
import PageShell from '@/components/PageShell'

export default function VoiceConsistencyTest() {
  const [testText] = useState('Hello! This is a test of voice consistency. The streaming voice and the fallback voice should now sound very similar.')
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)

  const testStreamingVoice = async () => {
    setLoading(true)
    setPlaying(true)
    
    try {
      const res = await fetch('/api/voice-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentence: testText,
          voiceId: 'CO6pxVrMZfyL61ZIglyr',
          settings: getHomepageDemoSettings()
        })
      })

      if (res.ok) {
        const audioBuffer = await res.arrayBuffer()
        const blob = new Blob([audioBuffer], { type: 'audio/mpeg' })
        const audio = new Audio(URL.createObjectURL(blob))
        audio.volume = 1.0
        audio.playbackRate = 1.0
        
        audio.onended = () => setPlaying(false)
        await audio.play()
      }
    } catch (error) {
      console.error('Streaming voice test failed:', error)
      setPlaying(false)
    } finally {
      setLoading(false)
    }
  }

  const testRegularVoice = async () => {
    setLoading(true)
    setPlaying(true)
    
    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testText,
          voiceId: 'CO6pxVrMZfyL61ZIglyr',
          settings: getHomepageDemoSettings()
        })
      })

      if (res.ok) {
        const audioBuffer = await res.arrayBuffer()
        const blob = new Blob([audioBuffer], { type: 'audio/mpeg' })
        const audio = new Audio(URL.createObjectURL(blob))
        audio.volume = 1.0
        audio.playbackRate = 1.0
        
        audio.onended = () => setPlaying(false)
        await audio.play()
      }
    } catch (error) {
      console.error('Regular voice test failed:', error)
      setPlaying(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageShell>
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Voice Consistency Test</h1>
      <p>This page helps test if the streaming voice and regular voice sound consistent.</p>
      
      <div style={{ margin: '2rem 0', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
        <h3>Test Text:</h3>
        <p style={{ fontStyle: 'italic' }}>"{testText}"</p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button 
          onClick={testStreamingVoice}
          disabled={loading || playing}
          style={{
            padding: '12px 24px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading || playing ? 'not-allowed' : 'pointer',
            opacity: loading || playing ? 0.6 : 1
          }}
        >
          {loading ? 'Loading...' : 'Test Streaming Voice'}
        </button>

        <button 
          onClick={testRegularVoice}
          disabled={loading || playing}
          style={{
            padding: '12px 24px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading || playing ? 'not-allowed' : 'pointer',
            opacity: loading || playing ? 0.6 : 1
          }}
        >
          {loading ? 'Loading...' : 'Test Regular Voice'}
        </button>
      </div>

      {playing && (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#d4edda', 
          border: '1px solid #c3e6cb',
          borderRadius: '6px',
          color: '#155724'
        }}>
          🔊 Playing audio... Listen carefully for any differences in voice characteristics.
        </div>
      )}

      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#e7f3ff', borderRadius: '8px' }}>
        <h3>What to Listen For:</h3>
        <ul>
          <li><strong>Accent consistency</strong> - Both voices should have the same accent</li>
          <li><strong>Tone consistency</strong> - Both voices should have similar tone and pitch</li>
          <li><strong>Speech patterns</strong> - Both voices should have similar rhythm and pacing</li>
          <li><strong>Voice character</strong> - Both should sound like the same person</li>
        </ul>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <a href="/" style={{ color: '#007bff', textDecoration: 'none' }}>
          ← Back to Homepage
        </a>
      </div>
    </PageShell>
  )
} 