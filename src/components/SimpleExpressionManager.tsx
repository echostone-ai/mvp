'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { ExpressionType, ExpressionClip, ExpressionStatus } from '@/lib/types/expressions'
import styles from './SimpleExpressionManager.module.css'

interface SimpleExpressionManagerProps {
  userId: string
  avatarId?: string
  onExpressionUpdate?: () => void
  className?: string
}

interface UploadProgress {
  uploading: boolean
  progress: number
  stage: string
}

interface ExpressionWithPreview extends ExpressionClip {
  isPlaying?: boolean
}

export default function SimpleExpressionManager({ 
  userId, 
  avatarId, 
  onExpressionUpdate,
  className 
}: SimpleExpressionManagerProps) {
  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [expressionType, setExpressionType] = useState<ExpressionType>('laugh')
  const [tone, setTone] = useState('')
  const [placementHints, setPlacementHints] = useState('')
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    uploading: false,
    progress: 0,
    stage: ''
  })
  const [dragActive, setDragActive] = useState(false)
  
  // Management state
  const [expressions, setExpressions] = useState<ExpressionWithPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const currentAudioRef = useRef<AudioBufferSourceNode | null>(null)

  const expressionTypes: { value: ExpressionType; label: string; description: string; emoji: string }[] = [
    { value: 'laugh', label: 'Laugh', description: 'Natural laughter sounds', emoji: '😄' },
    { value: 'sigh', label: 'Sigh', description: 'Thoughtful or contemplative sighs', emoji: '😔' },
    { value: 'breath', label: 'Breath', description: 'Natural breathing sounds', emoji: '💨' },
    { value: 'affirmation', label: 'Affirmation', description: 'Agreement sounds like "mm-hmm"', emoji: '✅' },
    { value: 'greeting', label: 'Greeting', description: 'Hello or hey sounds', emoji: '👋' },
    { value: 'catchphrase', label: 'Catchphrase', description: 'Personal expressions', emoji: '💬' },
    { value: 'filler', label: 'Filler', description: 'Thinking sounds like "um" or "uh"', emoji: '🤔' }
  ]

  // Load expressions on mount
  useEffect(() => {
    loadExpressions()
  }, [userId, avatarId])

  // Initialize audio context on first user interaction
  useEffect(() => {
    const initAudioContext = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
    }

    const events = ['click', 'touchstart', 'keydown']
    events.forEach(event => {
      document.addEventListener(event, initAudioContext, { once: true })
    })

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, initAudioContext)
      })
      
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  const loadExpressions = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        owner_type: avatarId ? 'avatar' : 'user',
        owner_key: avatarId || userId,
        limit: '50',
        offset: '0',
        status: 'active'
      })

      const response = await fetch(`/api/expressions?${params}`)
      
      if (!response.ok) {
        throw new Error(`Failed to load expressions: ${response.statusText}`)
      }

      const data = await response.json()
      setExpressions(data.expressions || [])
    } catch (err) {
      console.error('Error loading expressions:', err)
      setError(err instanceof Error ? err.message : 'Failed to load expressions')
    } finally {
      setLoading(false)
    }
  }

  const validateFile = (file: File): string | null => {
    // Check file size (5MB max)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds maximum 5MB`
    }

    // Check file type
    const allowedTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav',
      'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/mp4a-latm',
      'audio/aac', 'audio/aacp', 'audio/ogg', 'audio/webm'
    ]

    if (!allowedTypes.includes(file.type)) {
      return `Unsupported audio format: ${file.type}. Supported formats: MP3, WAV, M4A, AAC, OGG`
    }

    return null
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

  const parseHints = (hintsString: string): string[] => {
    if (!hintsString.trim()) return []
    
    return hintsString
      .split(',')
      .map(hint => hint.trim())
      .filter(hint => hint.length > 0)
      .slice(0, 10)
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload')
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

      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('type', expressionType)
      
      if (tone.trim()) {
        formData.append('tone', tone.trim())
      }
      
      const hints = parseHints(placementHints)
      if (hints.length > 0) {
        formData.append('placementHints', JSON.stringify(hints))
      }
      
      if (avatarId) {
        formData.append('avatarId', avatarId)
      }

      setUploadProgress({
        uploading: true,
        progress: 30,
        stage: 'Uploading and processing...'
      })

      const response = await fetch('/api/expressions/upload', {
        method: 'POST',
        body: formData
      })

      setUploadProgress({
        uploading: true,
        progress: 70,
        stage: 'Normalizing audio...'
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

      setSuccess(`Successfully uploaded "${selectedFile.name}" as ${expressionType}`)
      setSelectedFile(null)
      setTone('')
      setPlacementHints('')
      
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Reload expressions to show the new one
      await loadExpressions()
      onExpressionUpdate?.()

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
      
      setUploadProgress({
        uploading: false,
        progress: 0,
        stage: ''
      })
    }
  }

  const handlePreview = async (expression: ExpressionClip) => {
    if (playingId === expression.id) {
      if (currentAudioRef.current) {
        currentAudioRef.current.stop()
        currentAudioRef.current = null
      }
      setPlayingId(null)
      return
    }

    try {
      setPlayingId(expression.id)
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume()
      }

      if (currentAudioRef.current) {
        currentAudioRef.current.stop()
      }

      const response = await fetch(expression.cdn_url)
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer)

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
      console.error('Error playing expression:', err)
      setError('Failed to play expression preview')
      setPlayingId(null)
    }
  }

  const handleToggleStatus = async (expression: ExpressionClip) => {
    const newStatus: ExpressionStatus = expression.status === 'active' ? 'inactive' : 'active'
    
    try {
      setUpdatingId(expression.id)
      setError(null)

      const response = await fetch(`/api/expressions/${expression.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to update expression: ${response.statusText}`)
      }

      setExpressions(prev => prev.map(expr => 
        expr.id === expression.id 
          ? { ...expr, status: newStatus }
          : expr
      ))

      onExpressionUpdate?.()

    } catch (err) {
      console.error('Error updating expression:', err)
      setError(err instanceof Error ? err.message : 'Failed to update expression')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async (expression: ExpressionClip) => {
    if (!confirm(`Delete "${expression.filename}"? This cannot be undone.`)) {
      return
    }

    try {
      setDeletingId(expression.id)
      setError(null)

      const response = await fetch(`/api/expressions/${expression.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`Failed to delete expression: ${response.statusText}`)
      }

      setExpressions(prev => prev.filter(expr => expr.id !== expression.id))
      onExpressionUpdate?.()

    } catch (err) {
      console.error('Error deleting expression:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete expression')
    } finally {
      setDeletingId(null)
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
    const seconds = Math.round(durationMs / 1000 * 10) / 10
    return `${seconds}s`
  }

  const getExpressionTypeInfo = (type: string) => {
    return expressionTypes.find(t => t.value === type) || { 
      emoji: '🎵', 
      label: type, 
      description: type 
    }
  }

  return (
    <div className={`${styles.container} ${className || ''}`}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>Expression Manager</h3>
        <p className={styles.subtitle}>
          Upload and manage voice expressions to make conversations more natural
        </p>
      </div>

      {/* Upload Section */}
      <div className={styles.uploadSection}>
        <h4 className={styles.sectionTitle}>Upload New Expression</h4>
        
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
            accept="audio/*"
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
                <strong>Drop audio file here</strong> or click to browse
              </div>
              <div className={styles.dropZoneHint}>
                MP3, WAV, M4A, AAC, OGG • Max 5MB • Up to 5 seconds
              </div>
            </div>
          )}
        </div>

        {/* Upload Form */}
        <div className={styles.uploadForm}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Expression Type</label>
              <select
                value={expressionType}
                onChange={(e) => setExpressionType(e.target.value as ExpressionType)}
                className={styles.formSelect}
              >
                {expressionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.emoji} {type.label} - {type.description}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Tone (Optional)</label>
              <input
                type="text"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="e.g., cheerful, sarcastic, tired"
                className={styles.formInput}
                maxLength={50}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Keywords (Optional)</label>
              <input
                type="text"
                value={placementHints}
                onChange={(e) => setPlacementHints(e.target.value)}
                placeholder="e.g., funny, joke, agreement"
                className={styles.formInput}
                maxLength={200}
              />
            </div>
          </div>

          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploadProgress.uploading}
            className={`${styles.uploadBtn} ${!selectedFile || uploadProgress.uploading ? styles.uploadBtnDisabled : ''}`}
          >
            {uploadProgress.uploading ? 'Processing...' : 'Upload Expression'}
          </button>
        </div>

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
      </div>

      {/* Messages */}
      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}

      {success && (
        <div className={styles.successMessage}>
          {success}
        </div>
      )}

      {/* Expression List */}
      <div className={styles.listSection}>
        <div className={styles.listHeader}>
          <h4 className={styles.sectionTitle}>Your Expressions ({expressions.length})</h4>
          <button
            onClick={loadExpressions}
            className={styles.refreshBtn}
            disabled={loading}
            title="Refresh expressions"
          >
            {loading ? '⟳' : '🔄'}
          </button>
        </div>

        {loading && expressions.length === 0 ? (
          <div className={styles.loading}>
            <div className={styles.loadingSpinner}></div>
            <p>Loading expressions...</p>
          </div>
        ) : expressions.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🎵</div>
            <h4>No expressions yet</h4>
            <p>Upload your first expression above to get started!</p>
          </div>
        ) : (
          <div className={styles.expressionGrid}>
            {expressions.map((expression) => {
              const typeInfo = getExpressionTypeInfo(expression.type)
              return (
                <div key={expression.id} className={styles.expressionCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardType}>
                      {typeInfo.emoji} {typeInfo.label}
                    </div>
                    <div className={styles.cardActions}>
                      <button
                        onClick={() => handlePreview(expression)}
                        className={`${styles.actionBtn} ${styles.playBtn} ${playingId === expression.id ? styles.playing : ''}`}
                        title={playingId === expression.id ? 'Stop' : 'Play'}
                      >
                        {playingId === expression.id ? '⏹️' : '▶️'}
                      </button>
                      <button
                        onClick={() => handleToggleStatus(expression)}
                        disabled={updatingId === expression.id}
                        className={`${styles.actionBtn} ${expression.status === 'active' ? styles.activeBtn : styles.inactiveBtn}`}
                        title={expression.status === 'active' ? 'Disable' : 'Enable'}
                      >
                        {updatingId === expression.id ? '⟳' : (expression.status === 'active' ? '✅' : '❌')}
                      </button>
                      <button
                        onClick={() => handleDelete(expression)}
                        disabled={deletingId === expression.id}
                        className={`${styles.actionBtn} ${styles.deleteBtn}`}
                        title="Delete"
                      >
                        {deletingId === expression.id ? '⟳' : '🗑️'}
                      </button>
                    </div>
                  </div>
                  
                  <div className={styles.cardContent}>
                    <div className={styles.cardFilename}>{expression.filename}</div>
                    <div className={styles.cardMeta}>
                      {formatDuration(expression.duration_ms)}
                      {expression.tone && ` • ${expression.tone}`}
                    </div>
                    {expression.placement_hints && expression.placement_hints.length > 0 && (
                      <div className={styles.cardHints}>
                        {expression.placement_hints.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}