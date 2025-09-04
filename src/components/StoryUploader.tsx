'use client'

import React, { useState, useRef, useCallback } from 'react'
import { StoryCategory, STORY_CONSTRAINTS, validateStoryFile, validateStoryMetadata } from '@/lib/types/stories'
import styles from './StoryUploader.module.css'

interface StoryUploaderProps {
  userId: string
  avatarId?: string
  onUploadSuccess?: (story: any) => void
  onUploadError?: (error: string) => void
}

interface UploadProgress {
  uploading: boolean
  progress: number
  stage: string
}

export default function StoryUploader({ 
  userId, 
  avatarId, 
  onUploadSuccess, 
  onUploadError 
}: StoryUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<StoryCategory>('memory')
  const [triggers, setTriggers] = useState('')
  const [transcript, setTranscript] = useState('')
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    uploading: false,
    progress: 0,
    stage: ''
  })
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  const storyCategories: { value: StoryCategory; label: string; description: string }[] = [
    { value: 'memory', label: '💭 Memory', description: 'Personal memories and experiences from the past' },
    { value: 'experience', label: '🌟 Experience', description: 'Life experiences and adventures' },
    { value: 'advice', label: '💡 Advice', description: 'Wisdom and guidance to share' },
    { value: 'anecdote', label: '📖 Anecdote', description: 'Short interesting or amusing stories' }
  ]

  const validateFile = (file: File): string | null => {
    const validation = validateStoryFile(file)
    return validation.valid ? null : validation.error!
  }

  const handleFileSelect = useCallback((file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setSelectedFile(file)
    setError(null)
    setSuccess(null)
  }, [])

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files[0]) {
      handleFileSelect(files[0])
    }
  }

  const parseTriggers = (triggersString: string): string[] => {
    if (!triggersString.trim()) return []
    
    return triggersString
      .split(',')
      .map(trigger => trigger.trim().toLowerCase())
      .filter(trigger => trigger.length > 0)
      .slice(0, STORY_CONSTRAINTS.MAX_TRIGGERS)
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select an audio file to upload')
      return
    }

    // Validate metadata
    const triggerArray = parseTriggers(triggers)
    const metadata = {
      title: title.trim(),
      category,
      triggers: triggerArray,
      transcript: transcript.trim() || undefined
    }

    const validation = validateStoryMetadata(metadata)
    if (!validation.valid) {
      setError(validation.errors.join(', '))
      return
    }

    try {
      setUploadProgress({
        uploading: true,
        progress: 10,
        stage: 'Preparing upload...'
      })
      setError(null)
      setSuccess(null)

      // Prepare form data
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('title', metadata.title)
      formData.append('category', metadata.category)
      formData.append('triggers', triggerArray.join(','))
      
      if (metadata.transcript) {
        formData.append('transcript', metadata.transcript)
      }
      
      if (avatarId) {
        formData.append('avatarId', avatarId)
      }
      
      // Add userId for demo mode support
      formData.append('userId', userId)

      setUploadProgress({
        uploading: true,
        progress: 30,
        stage: 'Uploading file...'
      })

      // Upload to API
      const response = await fetch('/api/stories', {
        method: 'POST',
        body: formData
      })

      setUploadProgress({
        uploading: true,
        progress: 70,
        stage: 'Processing audio...'
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || `Upload failed: ${response.statusText}`)
      }

      setUploadProgress({
        uploading: true,
        progress: 100,
        stage: 'Upload complete!'
      })

      // Success!
      setSuccess(`Successfully uploaded story "${metadata.title}"`)
      setSelectedFile(null)
      setTitle('')
      setTriggers('')
      setTranscript('')
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Notify parent
      onUploadSuccess?.(result.data)

      // Clear progress after a delay
      setTimeout(() => {
        setUploadProgress({
          uploading: false,
          progress: 0,
          stage: ''
        })
        setSuccess(null)
      }, 3000)

    } catch (err: any) {
      console.error('Upload error:', err)
      const errorMessage = err.message || 'An unexpected error occurred during upload'
      setError(errorMessage)
      onUploadError?.(errorMessage)
      
      setUploadProgress({
        uploading: false,
        progress: 0,
        stage: ''
      })
    }
  }

  const handleClearFile = () => {
    setSelectedFile(null)
    setError(null)
    setSuccess(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDuration = (durationMs: number) => {
    const minutes = Math.floor(durationMs / 60000)
    const seconds = Math.floor((durationMs % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const triggerCount = parseTriggers(triggers).length
  const isFormValid = selectedFile && title.trim() && category && triggerCount > 0

  return (
    <div className={styles.uploaderContainer}>
      <div className={styles.uploaderHeader}>
        <h3 className={styles.uploaderTitle}>Upload Story</h3>
        <p className={styles.uploaderSubtitle}>
          Share authentic voice stories that will play when triggered by conversation topics
        </p>
      </div>

      {/* File Drop Zone */}
      <div
        ref={dropZoneRef}
        className={`${styles.dropZone} ${dragActive ? styles.dropZoneActive : ''} ${selectedFile ? styles.dropZoneHasFile : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/mp3,audio/mpeg"
          onChange={handleFileInputChange}
          className={styles.fileInput}
        />
        
        {selectedFile ? (
          <div className={styles.selectedFile}>
            <div className={styles.fileIcon}>🎵</div>
            <div className={styles.fileInfo}>
              <div className={styles.fileName}>{selectedFile.name}</div>
              <div className={styles.fileSize}>{formatFileSize(selectedFile.size)}</div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleClearFile()
              }}
              className={styles.clearFileBtn}
              title="Remove file"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className={styles.dropZoneContent}>
            <div className={styles.dropZoneIcon}>📁</div>
            <div className={styles.dropZoneText}>
              <strong>Drop MP3 file here</strong> or click to browse
            </div>
            <div className={styles.dropZoneHint}>
              MP3 format • 30s-5min duration • Max {STORY_CONSTRAINTS.MAX_FILE_SIZE_MB}MB
            </div>
          </div>
        )}
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
          Give your story a memorable title ({title.length}/{STORY_CONSTRAINTS.MAX_TITLE_LENGTH} characters)
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

      {/* Trigger Keywords */}
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>
          Trigger Keywords * ({triggerCount}/{STORY_CONSTRAINTS.MAX_TRIGGERS})
        </label>
        <input
          type="text"
          value={triggers}
          onChange={(e) => setTriggers(e.target.value)}
          placeholder="e.g., college, university, first day, nervous"
          className={styles.formInput}
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

      {/* Optional Transcript */}
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
          rows={4}
        />
        <div className={styles.formHint}>
          Optional transcript for accessibility ({transcript.length}/{STORY_CONSTRAINTS.MAX_TRANSCRIPT_LENGTH} characters)
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

      {/* Upload Progress */}
      {uploadProgress.uploading && (
        <div className={styles.progressContainer}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill}
              style={{ width: `${uploadProgress.progress}%` }}
            />
          </div>
          <div className={styles.progressText}>
            {uploadProgress.stage} ({uploadProgress.progress}%)
          </div>
        </div>
      )}

      {/* Upload Button */}
      <div className={styles.uploaderActions}>
        <button
          onClick={handleUpload}
          disabled={!isFormValid || uploadProgress.uploading}
          className={`${styles.uploadBtn} ${!isFormValid || uploadProgress.uploading ? styles.uploadBtnDisabled : ''}`}
        >
          {uploadProgress.uploading ? 'Uploading...' : 'Upload Story'}
        </button>
      </div>
    </div>
  )
}