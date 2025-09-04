'use client'

import React, { useState, useRef, useCallback } from 'react'
import styles from './ExpressionUploader.module.css'

interface AdminBulkExpressionUploaderProps {
  avatarId: string
  onUploadSuccess?: (result: any) => void
  onUploadError?: (error: string) => void
}

interface UploadProgress {
  uploading: boolean
  progress: number
  stage: string
}

interface BulkUploadResult {
  packName: string
  version: string
  avatarId: string
  processed: number
  total: number
  results: any[]
  errors?: string[]
}

export default function AdminBulkExpressionUploader({ 
  avatarId, 
  onUploadSuccess, 
  onUploadError 
}: AdminBulkExpressionUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [packName, setPackName] = useState('')
  const [version, setVersion] = useState('1.0.0')
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    uploading: false,
    progress: 0,
    stage: ''
  })
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [result, setResult] = useState<BulkUploadResult | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  const validateFile = (file: File): string | null => {
    // Check file size (50MB max for bulk uploads)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      return `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds maximum 50MB`
    }

    // Check file type
    if (!file.name.toLowerCase().endsWith('.zip')) {
      return `Invalid file type: ${file.type}. Only ZIP files are supported for bulk uploads.`
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
    setResult(null)

    // Auto-generate pack name from filename if not set
    if (!packName) {
      const baseName = file.name.replace(/\.zip$/i, '')
      setPackName(baseName)
    }
  }, [packName])

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

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a ZIP file to upload')
      return
    }

    if (!packName.trim()) {
      setError('Please enter a pack name')
      return
    }

    if (!version.trim()) {
      setError('Please enter a version')
      return
    }

    try {
      setUploadProgress({
        uploading: true,
        progress: 10,
        stage: 'Preparing bulk upload...'
      })
      setError(null)
      setSuccess(null)
      setResult(null)

      // Prepare form data for bulk upload
      const formData = new FormData()
      formData.append('zipFile', selectedFile)
      formData.append('avatarId', avatarId)
      formData.append('packName', packName.trim())
      formData.append('version', version.trim())

      setUploadProgress({
        uploading: true,
        progress: 30,
        stage: 'Uploading ZIP file...'
      })

      // Upload to admin bulk API
      const response = await fetch('/api/expressions/admin/bulk-upload', {
        method: 'POST',
        body: formData
      })

      setUploadProgress({
        uploading: true,
        progress: 70,
        stage: 'Processing expressions...'
      })

      const uploadResult = await response.json()

      if (!response.ok) {
        throw new Error(uploadResult.error || `Bulk upload failed: ${response.statusText}`)
      }

      setUploadProgress({
        uploading: true,
        progress: 100,
        stage: 'Bulk upload complete!'
      })

      // Success!
      setResult(uploadResult)
      setSuccess(`Successfully uploaded pack "${packName}" v${version} for avatar ${avatarId}`)
      
      // Reset form
      setSelectedFile(null)
      setPackName('')
      setVersion('1.0.0')
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Notify parent
      onUploadSuccess?.(uploadResult)

      // Clear progress after a delay
      setTimeout(() => {
        setUploadProgress({
          uploading: false,
          progress: 0,
          stage: ''
        })
      }, 3000)

    } catch (err: any) {
      console.error('Bulk upload error:', err)
      const errorMessage = err.message || 'An unexpected error occurred during bulk upload'
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
    setResult(null)
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
        <h3 className={styles.uploaderTitle}>Admin: Bulk Upload Expression Pack</h3>
        <p className={styles.uploaderSubtitle}>
          Upload a ZIP file containing multiple expressions for <strong>{avatarId}</strong> avatar
        </p>
      </div>

      {/* Instructions */}
      <div className={styles.instructionsBox}>
        <h4>📋 ZIP File Requirements:</h4>
        <ul>
          <li>Include a <code>manifest.json</code> file with expression metadata</li>
          <li>Audio files should be in MP3, WAV, M4A, AAC, or OGG format</li>
          <li>Maximum 50MB total file size</li>
          <li>Each audio file should be under 5 seconds duration</li>
        </ul>
        <details>
          <summary>📄 Example manifest.json</summary>
          <pre>{`{
  "packName": "Jonathan Demo Pack",
  "version": "1.0.0",
  "expressions": [
    {
      "filename": "laugh1.mp3",
      "type": "laugh",
      "tone": "cheerful",
      "placementHints": ["funny", "joke", "humor"],
      "priority": 60
    },
    {
      "filename": "sigh1.mp3", 
      "type": "sigh",
      "tone": "thoughtful",
      "priority": 50
    }
  ]
}`}</pre>
        </details>
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
          accept=".zip"
          onChange={handleFileInputChange}
          className={styles.fileInput}
        />
        
        {selectedFile ? (
          <div className={styles.selectedFile}>
            <div className={styles.fileIcon}>📦</div>
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
            <div className={styles.dropZoneIcon}>📦</div>
            <div className={styles.dropZoneText}>
              <strong>Drop ZIP file here</strong> or click to browse
            </div>
            <div className={styles.dropZoneHint}>
              ZIP files with manifest.json and audio files • Max 50MB
            </div>
          </div>
        )}
      </div>

      {/* Pack Metadata */}
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>
          Pack Name *
        </label>
        <input
          type="text"
          value={packName}
          onChange={(e) => setPackName(e.target.value)}
          placeholder="e.g., Jonathan Demo Pack"
          className={styles.formInput}
          maxLength={100}
        />
        <div className={styles.formHint}>
          A descriptive name for this expression pack
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>
          Version *
        </label>
        <input
          type="text"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="e.g., 1.0.0"
          className={styles.formInput}
          maxLength={20}
        />
        <div className={styles.formHint}>
          Version number for this pack (e.g., 1.0.0, 2.1.3)
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

      {/* Upload Results */}
      {result && (
        <div className={styles.resultsContainer}>
          <h4>📊 Upload Results</h4>
          <div className={styles.resultsSummary}>
            <div className={styles.resultItem}>
              <span className={styles.resultLabel}>Pack:</span>
              <span className={styles.resultValue}>{result.packName} v{result.version}</span>
            </div>
            <div className={styles.resultItem}>
              <span className={styles.resultLabel}>Processed:</span>
              <span className={styles.resultValue}>{result.processed} / {result.total} expressions</span>
            </div>
            <div className={styles.resultItem}>
              <span className={styles.resultLabel}>Avatar:</span>
              <span className={styles.resultValue}>{result.avatarId}</span>
            </div>
          </div>

          {result.errors && result.errors.length > 0 && (
            <div className={styles.resultErrors}>
              <h5>⚠️ Errors ({result.errors.length}):</h5>
              <ul>
                {result.errors.slice(0, 5).map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
                {result.errors.length > 5 && (
                  <li>... and {result.errors.length - 5} more errors</li>
                )}
              </ul>
            </div>
          )}

          {result.results && result.results.length > 0 && (
            <div className={styles.resultSuccess}>
              <h5>✅ Successfully Uploaded ({result.results.length}):</h5>
              <ul>
                {result.results.slice(0, 10).map((item, index) => (
                  <li key={index}>
                    {item.filename} ({item.type}) - {Math.round(item.durationMs / 1000 * 10) / 10}s
                  </li>
                ))}
                {result.results.length > 10 && (
                  <li>... and {result.results.length - 10} more expressions</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Upload Button */}
      <div className={styles.uploaderActions}>
        <button
          onClick={handleUpload}
          disabled={!selectedFile || !packName.trim() || !version.trim() || uploadProgress.uploading}
          className={`${styles.uploadBtn} ${(!selectedFile || !packName.trim() || !version.trim() || uploadProgress.uploading) ? styles.uploadBtnDisabled : ''}`}
        >
          {uploadProgress.uploading ? 'Processing...' : `Upload Pack to ${avatarId}`}
        </button>
      </div>
    </div>
  )
}