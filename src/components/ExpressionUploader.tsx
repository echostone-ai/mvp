'use client'

import React, { useState, useRef, useCallback } from 'react'
import { ExpressionType } from '@/lib/types/expressions'
import styles from './ExpressionUploader.module.css'

interface ExpressionUploaderProps {
  userId: string
  avatarId?: string
  onUploadSuccess?: (expression: any) => void
  onUploadError?: (error: string) => void
}

interface UploadProgress {
  uploading: boolean
  progress: number
  stage: string
}

export default function ExpressionUploader({ 
  userId, 
  avatarId, 
  onUploadSuccess, 
  onUploadError 
}: ExpressionUploaderProps) {
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
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  const expressionTypes: { value: ExpressionType; label: string; description: string }[] = [
    { value: 'laugh', label: '😄 Laugh', description: 'Natural laughter sounds' },
    { value: 'sigh', label: '😔 Sigh', description: 'Thoughtful or contemplative sighs' },
    { value: 'breath', label: '💨 Breath', description: 'Natural breathing sounds' },
    { value: 'affirmation', label: '✅ Affirmation', description: 'Agreement sounds like "mm-hmm"' },
    { value: 'greeting', label: '👋 Greeting', description: 'Hello or hey sounds' },
    { value: 'catchphrase', label: '💬 Catchphrase', description: 'Personal expressions' },
    { value: 'filler', label: '🤔 Filler', description: 'Thinking sounds like "um" or "uh"' }
  ]

  const validateFile = (file: File): string | null => {
    // Check file size (5MB max)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds maximum 5MB`
    }

    // Check file type
    const allowedTypes = [
      'audio/mpeg',
      'audio/mp3', 
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/mp4',
      'audio/m4a',
      'audio/x-m4a',
      'audio/mp4a-latm',
      'audio/aac',
      'audio/aacp',
      'audio/ogg',
      'audio/webm'
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
      .slice(0, 10) // Limit to 10 hints
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

      // Prepare form data
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
        stage: 'Uploading file...'
      })

      // Upload to API
      const response = await fetch('/api/expressions/upload', {
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
      setSuccess(`Successfully uploaded "${selectedFile.name}" as ${expressionType}`)
      setSelectedFile(null)
      setTone('')
      setPlacementHints('')
      
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

  return (
    <div className={styles.uploaderContainer}>
      <div className={styles.uploaderHeader}>
        <h3 className={styles.uploaderTitle}>Upload Expression</h3>
        <p className={styles.uploaderSubtitle}>
          Add authentic sounds to make your avatar more expressive
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
              Supports MP3, WAV, M4A, AAC, OGG • Max 5MB
            </div>
          </div>
        )}
      </div>

      {/* Expression Type Selection */}
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>
          Expression Type *
        </label>
        <select
          value={expressionType}
          onChange={(e) => setExpressionType(e.target.value as ExpressionType)}
          className={styles.formSelect}
        >
          {expressionTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label} - {type.description}
            </option>
          ))}
        </select>
      </div>

      {/* Tone Input */}
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>
          Tone (Optional)
        </label>
        <input
          type="text"
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          placeholder="e.g., cheerful, sarcastic, tired"
          className={styles.formInput}
          maxLength={50}
        />
        <div className={styles.formHint}>
          Describe the emotional tone or style of this expression
        </div>
      </div>

      {/* Placement Hints */}
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>
          Placement Hints (Optional)
        </label>
        <input
          type="text"
          value={placementHints}
          onChange={(e) => setPlacementHints(e.target.value)}
          placeholder="e.g., funny, joke, agreement, thinking"
          className={styles.formInput}
          maxLength={200}
        />
        <div className={styles.formHint}>
          Keywords for when to use this expression (comma-separated)
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
          disabled={!selectedFile || uploadProgress.uploading}
          className={`${styles.uploadBtn} ${!selectedFile || uploadProgress.uploading ? styles.uploadBtnDisabled : ''}`}
        >
          {uploadProgress.uploading ? 'Uploading...' : 'Upload Expression'}
        </button>
      </div>
    </div>
  )
}