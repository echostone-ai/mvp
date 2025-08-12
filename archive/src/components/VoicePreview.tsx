import React, { useState, useCallback, useRef } from 'react'
import VoicePreviewTesting from './VoicePreviewTesting'

interface VoicePreviewProps {
  voiceId: string | null
  userName: string
  showAdvancedTesting?: boolean
  onSettingsSaved?: (settings: any) => void
  initialSettings?: any
}

const VoicePreview: React.FC<VoicePreviewProps> = ({ 
  voiceId, 
  userName, 
  showAdvancedTesting = false,
  onSettingsSaved,
  initialSettings
}) => {
  const [isGenerating, setIsGenerating] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const sampleTexts = [
    `Hi there! This is ${userName || 'your'} cloned voice. Pretty cool, right?`,
    `Hello! I'm ${userName || 'your'} digital voice clone. How do I sound?`,
    `Hey everyone! This is what ${userName || 'your'} voice sounds like when cloned using AI.`,
    `Greetings! This is ${userName || 'your'} voice, recreated using advanced voice cloning technology.`
  ]

  const generateVoicePreview = useCallback(async () => {
    if (!voiceId) {
      setError('No voice ID available. Please upload your voice first.')
      return
    }

    setIsGenerating(true)
    setError(null)
    setAudioUrl(null)

    try {
      const randomText = sampleTexts[Math.floor(Math.random() * sampleTexts.length)]
      
      const response = await fetch('/api/generate-voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: randomText,
          voice_id: voiceId,
        }),
      })

      if (!response.ok) {
        let errorMsg = 'Failed to generate voice.'
        try {
          const errorData = await response.json()
          errorMsg = errorData.error || errorData.message || JSON.stringify(errorData)
        } catch (e) {
          errorMsg = 'Failed to generate voice (unknown error).'
        }
        setError(errorMsg)
        return
      }

      // Get the audio blob from the response
      const audioBlob = await response.blob()
      const url = URL.createObjectURL(audioBlob)
      setAudioUrl(url)
    } catch (err) {
      let errorMsg = 'Failed to generate voice preview.'
      if (err instanceof Error) errorMsg = err.message
      setError(errorMsg)
    } finally {
      setIsGenerating(false)
    }
  }, [voiceId, sampleTexts])

  const playAudio = useCallback(() => {
    if (!audioUrl) return

    if (isPlaying) {
      audioRef.current?.pause()
      setIsPlaying(false)
    } else {
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      
      audio.onended = () => setIsPlaying(false)
      audio.onerror = () => {
        setError('Failed to play audio')
        setIsPlaying(false)
      }
      
      audio.play()
      setIsPlaying(true)
    }
  }, [audioUrl, isPlaying])

  // Show advanced testing interface if requested and voice ID is available
  if (showAdvancedTesting && voiceId) {
    return (
      <VoicePreviewTesting
        voiceId={voiceId}
        userName={userName}
        onSettingsSaved={onSettingsSaved}
        initialSettings={initialSettings}
      />
    )
  }

  return (
    <div className="voice-preview-section">
      <div className="voice-preview-header">
        <h3 className="voice-preview-title">Voice Preview</h3>
        <p className="voice-preview-desc">Generate a sample to hear how your voice clone sounds.</p>
      </div>
      {error && (
        <div className="voice-preview-error">
          <p>{error}</p>
          <p className="voice-preview-error-tip">Try re-recording, uploading a clearer sample, or check your internet connection.</p>
        </div>
      )}
      <div className="voice-preview-controls">
        <button
          onClick={generateVoicePreview}
          disabled={isGenerating || !voiceId}
          className="voice-preview-btn"
        >
          {isGenerating ? 'Generating...' : '🎤 Generate Voice Preview'}
        </button>
        {audioUrl && (
          <button
            onClick={playAudio}
            className={`voice-preview-btn${isPlaying ? ' playing' : ''}`}
          >
            {isPlaying ? '⏹️ Stop Preview' : '▶️ Play Preview'}
          </button>
        )}
      </div>
      {!voiceId && (
        <div className="voice-preview-warning">
          <p>Please upload and train your voice first to generate previews.</p>
        </div>
      )}
    </div>
  )
}

export default VoicePreview