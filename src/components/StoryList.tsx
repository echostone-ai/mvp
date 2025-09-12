'use client'

import React, { useState, useEffect, useRef } from 'react'
import { UserStory, StoryCategory, StoryStatus } from '@/lib/types/stories'
import styles from './StoryList.module.css'

interface StoryListProps {
  userId: string
  avatarId?: string
  onStoryUpdate?: () => void
}

interface StoryListResponse {
  success: boolean
  stories: UserStory[]
  count: number
}

export default function StoryList({ userId, avatarId, onStoryUpdate }: StoryListProps) {
  const [stories, setStories] = useState<UserStory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Audio context for preview playback
  const audioContextRef = useRef<AudioContext | null>(null)
  const currentAudioRef = useRef<AudioBufferSourceNode | null>(null)

  useEffect(() => {
    loadStories()
  }, [userId, avatarId])

  // Initialize audio context on first user interaction
  useEffect(() => {
    const initAudioContext = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
    }

    // Add event listeners for user interaction
    const events = ['click', 'touchstart', 'keydown']
    events.forEach(event => {
      document.addEventListener(event, initAudioContext, { once: true })
    })

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, initAudioContext)
      })
      
      // Cleanup audio context
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  const loadStories = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        ownerType: avatarId ? 'avatar' : 'user',
        avatarId: avatarId || userId,
        userId: userId
      })

      const response = await fetch(`/api/stories?${params}`)
      
      if (!response.ok) {
        throw new Error(`Failed to load stories: ${response.statusText}`)
      }

      const data: StoryListResponse = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load stories')
      }

      setStories(data.stories || [])
    } catch (err) {
      console.error('Error loading stories:', err)
      setError(err instanceof Error ? err.message : 'Failed to load stories')
    } finally {
      setLoading(false)
    }
  }

  const handlePreview = async (story: UserStory) => {
    if (playingId === story.id) {
      // Stop current playback
      if (currentAudioRef.current) {
        currentAudioRef.current.stop()
        currentAudioRef.current = null
      }
      setPlayingId(null)
      return
    }

    try {
      setPlayingId(story.id)
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      // Resume audio context if suspended
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume()
      }

      // Stop any currently playing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.stop()
      }

      // Fetch and decode audio
      const response = await fetch(story.audio_url)
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer)

      // Create and play audio source
      const source = audioContextRef.current.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContextRef.current.destination)
      
      source.onended = () => {
        setPlayingId(null)
        currentAudioRef.current = null
      }

      currentAudioRef.current = source
      source.start()

    } catch (err) {
      console.error('Error playing story:', err)
      setError('Failed to play story preview')
      setPlayingId(null)
    }
  }

  const handleDelete = async (story: UserStory) => {
    if (!confirm(`Are you sure you want to delete "${story.title}"? This action cannot be undone.`)) {
      return
    }

    try {
      setDeletingId(story.id)
      setError(null)

      const response = await fetch(`/api/stories/${story.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to delete story: ${response.statusText}`)
      }

      // Remove from local state
      setStories(prev => prev.filter(s => s.id !== story.id))

      // Notify parent component
      onStoryUpdate?.()

    } catch (err) {
      console.error('Error deleting story:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete story')
    } finally {
      setDeletingId(null)
    }
  }

  const formatDuration = (durationMs: number) => {
    const minutes = Math.floor(durationMs / 60000)
    const seconds = Math.floor((durationMs % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getCategoryLabel = (category: StoryCategory) => {
    const labels: Record<StoryCategory, string> = {
      memory: '💭 Memory',
      experience: '🌟 Experience',
      advice: '💡 Advice',
      anecdote: '📖 Anecdote'
    }
    return labels[category] || category
  }

  const getStatusColor = (status: StoryStatus) => {
    switch (status) {
      case 'active': return '#28a745'
      case 'inactive': return '#6c757d'
      case 'processing': return '#ffc107'
      case 'failed': return '#dc3545'
      default: return '#6c757d'
    }
  }

  const parseTriggersFromString = (triggers: string): string[] => {
    return triggers.split(',').map(t => t.trim()).filter(t => t.length > 0)
  }

  if (loading && stories.length === 0) {
    return (
      <div className={styles.storyListContainer}>
        <div className={styles.storyLoading}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading your stories...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.storyListContainer}>
      {/* Header */}
      <div className={styles.storyHeader}>
        <div className={styles.storyTitleRow}>
          <div>
            <h3 className={styles.storyTitle}>Your Stories</h3>
            <p className={styles.storySubtitle}>
              {stories.length} of 5 stories uploaded
            </p>
          </div>
          <button
            onClick={loadStories}
            className={styles.refreshButton}
            disabled={loading}
            title="Refresh stories"
          >
            {loading ? '⟳' : '🔄'} Refresh
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className={styles.storyError}>
          {error}
        </div>
      )}

      {/* Story List */}
      {stories.length === 0 ? (
        <div className={styles.storyEmpty}>
          <div className={styles.storyEmptyIcon}>🎙️</div>
          <h3>No stories found</h3>
          <p>
            Upload your first authentic voice story! Record personal memories, experiences, or advice that your avatar can share during conversations.
          </p>
        </div>
      ) : (
        <div className={styles.storyList}>
          {stories.map((story) => (
            <div key={story.id} className={styles.storyCard}>
              <div className={styles.storyCardHeader}>
                <div className={styles.storyInfo}>
                  <div className={styles.storyCategory}>
                    {getCategoryLabel(story.category)}
                  </div>
                  <div className={styles.storyTitle}>
                    {story.title}
                  </div>
                  <div className={styles.storyMeta}>
                    {formatDuration(story.duration_ms)} • {formatDate(story.created_at)}
                    <span 
                      className={styles.storyStatus}
                      style={{ color: getStatusColor(story.status) }}
                    >
                      • {story.status}
                    </span>
                  </div>
                </div>
                <div className={styles.storyActions}>
                  <button
                    onClick={() => handlePreview(story)}
                    className={`${styles.storyBtn} ${styles.storyBtnSecondary} ${playingId === story.id ? styles.storyBtnPlaying : ''}`}
                    title={playingId === story.id ? 'Stop preview' : 'Play preview'}
                  >
                    {playingId === story.id ? '⏹️' : '▶️'}
                  </button>
                  <button
                    onClick={() => handleDelete(story)}
                    disabled={deletingId === story.id}
                    className={`${styles.storyBtn} ${styles.storyBtnDanger}`}
                    title="Delete story"
                  >
                    {deletingId === story.id ? '⟳' : '🗑️'}
                  </button>
                </div>
              </div>
              
              {/* Triggers */}
              <div className={styles.storyDetails}>
                <div className={styles.storyTriggers}>
                  <strong>Triggers:</strong>
                  {parseTriggersFromString(story.triggers).map((trigger, index) => (
                    <span key={index} className={styles.triggerTag}>{trigger}</span>
                  ))}
                </div>
              </div>

              {/* Transcript Preview */}
              {story.transcript && (
                <div className={styles.storyDetails}>
                  <div className={styles.storyTranscript}>
                    <strong>Transcript:</strong>
                    <p>{story.transcript.length > 200 ? `${story.transcript.substring(0, 200)}...` : story.transcript}</p>
                  </div>
                </div>
              )}

              {/* Priority */}
              <div className={styles.storyDetails}>
                <div className={styles.storyPriority}>
                  <strong>Priority:</strong> {story.priority}/100
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}