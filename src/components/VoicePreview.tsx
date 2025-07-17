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
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate voice')
      }

      // Get the audio blob from the response
      const audioBlob = await response.blob()
      const url = URL.createObjectURL(audioBlob)
      setAudioUrl(url)
    } catch (err) {
      console.error('Error generating voice preview:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate voice preview')
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
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Voice Preview</h3>
        <p className="text-gray-600 text-sm">
          Generate a sample to hear how your voice clone sounds
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="flex flex-col space-y-3">
        <button
          onClick={generateVoicePreview}
          disabled={isGenerating || !voiceId}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              <span>Generating...</span>
            </div>
          ) : (
            '🎤 Generate Voice Preview'
          )}
        </button>

        {audioUrl && (
          <button
            onClick={playAudio}
            className={`px-4 py-2 rounded-lg transition-colors ${
              isPlaying
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {isPlaying ? '⏹️ Stop Preview' : '▶️ Play Preview'}
          </button>
        )}
      </div>

      {!voiceId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-yellow-700 text-sm">
            Please upload and train your voice first to generate previews.
          </p>
        </div>
      )}
    </div>
  )
}

export default VoicePreview