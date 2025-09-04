'use client'

import React, { useState, useEffect } from 'react'
import { UserStory, StoryCategory, StoryStatus, STORY_CONSTRAINTS, validateStoryMetadata } from '@/lib/types/stories'
import styles from './StoryEditor.module.css'

interface StoryEditorProps {
  story: UserStory
  onSave: (updatedStory: UserStory) => void
  onCancel: () => void
  onDelete?: (storyId: string) => void
}

export default function StoryEditor({ story, onSave, onCancel, onDelete }: StoryEditorProps) {
  const [title, setTitle] = useState(story.title)
  const [category, setCategory] = useState<StoryCategory>(story.category)
  const [triggers, setTriggers] = useState(story.triggers)
  const [transcript, setTranscript] = useState(story.transcript || '')
  const [priority, setPriority] = useState(story.priority)
  const [status, setStatus] = useState<StoryStatus>(story.status)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const storyCategories: { value: StoryCategory; label: string; description: string }[] = [
    { value: 'memory', label: '💭 Memory', description: 'Personal memories and experiences from the past' },
    { value: 'experience', label: '🌟 Experience', description: 'Life experiences and adventures' },
    { value: 'advice', label: '💡 Advice', description: 'Wisdom and guidance to share' },
    { value: 'anecdote', label: '📖 Anecdote', description: 'Short interesting or amusing stories' }
  ]

  const storyStatuses: { value: StoryStatus; label: string; description: string }[] = [
    { value: 'active', label: '✅ Active', description: 'Story can be triggered during conversations' },
    { value: 'inactive', label: '⏸️ Inactive', description: 'Story is disabled and won\'t be triggered' },
    { value: 'processing', label: '⏳ Processing', description: 'Story is being processed' },
    { value: 'failed', label: '❌ Failed', description: 'Story processing failed' }
  ]

  const parseTriggers = (triggersString: string): string[] => {
    if (!triggersString.trim()) return []
    
    return triggersString
      .split(',')
      .map(trigger => trigger.trim().toLowerCase())
      .filter(trigger => trigger.length > 0)
      .slice(0, STORY_CONSTRAINTS.MAX_TRIGGERS)
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

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      // Validate metadata
      const triggerArray = parseTriggers(triggers)
      const metadata = {
        title: title.trim(),
        category,
        triggers: triggerArray,
        transcript: transcript.trim() || undefined,
        priority
      }

      const validation = validateStoryMetadata(metadata)
      if (!validation.valid) {
        setError(validation.errors.join(', '))
        return
      }

      // Prepare update data
      const updateData = {
        title: metadata.title,
        category: metadata.category,
        triggers: triggerArray,
        transcript: metadata.transcript,
        priority: metadata.priority,
        status
      }

      // Call API to update story
      const response = await fetch(`/api/stories/${story.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || `Update failed: ${response.statusText}`)
      }

      // Create updated story object
      const updatedStory: UserStory = {
        ...story,
        title: updateData.title,
        category: updateData.category,
        triggers: triggerArray.join(', '),
        transcript: updateData.transcript,
        priority: updateData.priority,
        status: updateData.status,
        updated_at: result.data.updatedAt || new Date().toISOString()
      }

      setSuccess('Story updated successfully!')
      
      // Notify parent component
      onSave(updatedStory)

      // Clear success message after delay
      setTimeout(() => {
        setSuccess(null)
      }, 3000)

    } catch (err: any) {
      console.error('Save error:', err)
      setError(err.message || 'Failed to update story')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return

    if (!confirm(`Are you sure you want to delete "${story.title}"? This action cannot be undone.`)) {
      return
    }

    try {
      setDeleting(true)
      setError(null)

      const response = await fetch(`/api/stories/${story.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to delete story: ${response.statusText}`)
      }

      // Notify parent component
      onDelete(story.id)

    } catch (err: any) {
      console.error('Delete error:', err)
      setError(err.message || 'Failed to delete story')
    } finally {
      setDeleting(false)
    }
  }

  const triggerCount = parseTriggers(triggers).length
  const hasChanges = 
    title !== story.title ||
    category !== story.category ||
    triggers !== story.triggers ||
    transcript !== (story.transcript || '') ||
    priority !== story.priority ||
    status !== story.status

  return (
    <div className={styles.editorContainer}>
      <div className={styles.editorHeader}>
        <h3 className={styles.editorTitle}>Edit Story</h3>
        <div className={styles.storyMeta}>
          <span>Duration: {formatDuration(story.duration_ms)}</span>
          <span>Created: {formatDate(story.created_at)}</span>
          <span>Updated: {formatDate(story.updated_at)}</span>
        </div>
      </div>

      {/* Story Title */}
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>
          Story Title *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., My first day at college"
          className={styles.formInput}
          maxLength={STORY_CONSTRAINTS.MAX_TITLE_LENGTH}
        />
        <div className={styles.formHint}>
          {title.length}/{STORY_CONSTRAINTS.MAX_TITLE_LENGTH} characters
        </div>
      </div>

      {/* Category Selection */}
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>
          Category *
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as StoryCategory)}
          className={styles.formSelect}
        >
          {storyCategories.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label} - {cat.description}
            </option>
          ))}
        </select>
      </div>

      {/* Status Selection */}
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>
          Status *
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StoryStatus)}
          className={styles.formSelect}
        >
          {storyStatuses.map((stat) => (
            <option key={stat.value} value={stat.value}>
              {stat.label} - {stat.description}
            </option>
          ))}
        </select>
      </div>

      {/* Priority Slider */}
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>
          Priority: {priority}/100
        </label>
        <div className={styles.priorityContainer}>
          <input
            type="range"
            min={STORY_CONSTRAINTS.MIN_PRIORITY}
            max={STORY_CONSTRAINTS.MAX_PRIORITY}
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value))}
            className={styles.prioritySlider}
          />
          <div className={styles.priorityLabels}>
            <span>Low (0)</span>
            <span>Medium (50)</span>
            <span>High (100)</span>
          </div>
        </div>
        <div className={styles.formHint}>
          Higher priority stories are more likely to be selected when multiple stories match
        </div>
      </div>

      {/* Trigger Keywords */}
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>
          Trigger Keywords * ({triggerCount}/{STORY_CONSTRAINTS.MAX_TRIGGERS})
        </label>
        <textarea
          value={triggers}
          onChange={(e) => setTriggers(e.target.value)}
          placeholder="e.g., college, university, first day, nervous"
          className={styles.formTextarea}
          rows={3}
          maxLength={500}
        />
        <div className={styles.formHint}>
          Keywords that will trigger this story during conversation (comma-separated)
        </div>
        {triggerCount > 0 && (
          <div className={styles.triggerPreview}>
            <strong>Triggers:</strong> {parseTriggers(triggers).map((trigger, index) => (
              <span key={index} className={styles.triggerTag}>{trigger}</span>
            ))}
          </div>
        )}
      </div>

      {/* Transcript */}
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>
          Transcript (Optional)
        </label>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Enter the text of your story for better accessibility and searchability..."
          className={styles.formTextarea}
          maxLength={STORY_CONSTRAINTS.MAX_TRANSCRIPT_LENGTH}
          rows={6}
        />
        <div className={styles.formHint}>
          {transcript.length}/{STORY_CONSTRAINTS.MAX_TRANSCRIPT_LENGTH} characters
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}

      {/* Success Display */}
      {success && (
        <div className={styles.successMessage}>
          {success}
        </div>
      )}

      {/* Action Buttons */}
      <div className={styles.editorActions}>
        <div className={styles.primaryActions}>
          <button
            onClick={onCancel}
            className={styles.cancelBtn}
            disabled={saving || deleting}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving || deleting || triggerCount === 0 || !title.trim()}
            className={`${styles.saveBtn} ${(!hasChanges || saving || deleting || triggerCount === 0 || !title.trim()) ? styles.saveBtnDisabled : ''}`}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
        
        {onDelete && (
          <div className={styles.dangerActions}>
            <button
              onClick={handleDelete}
              disabled={saving || deleting}
              className={styles.deleteBtn}
            >
              {deleting ? 'Deleting...' : '🗑️ Delete Story'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}