'use client'

import React, { useState, useEffect, useRef } from 'react'
import { ExpressionClip, ExpressionStatus } from '@/lib/types/expressions'
import styles from './ExpressionList.module.css'

interface AdminExpressionListProps {
  avatarId: string
  onExpressionUpdate?: () => void
}

interface AdminExpressionListResponse {
  expressions: ExpressionClip[]
  expressionsByType: Record<string, ExpressionClip[]>
  total: number
  limit: number
  offset: number
  stats: {
    totalActive: number
    totalInactive: number
    averagePriority: number
    typeDistribution: Record<string, number>
  }
}

export default function AdminExpressionList({ avatarId, onExpressionUpdate }: AdminExpressionListProps) {
  const [expressions, setExpressions] = useState<ExpressionClip[]>([])
  const [expressionsByType, setExpressionsByType] = useState<Record<string, ExpressionClip[]>>({})
  const [stats, setStats] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedExpressions, setSelectedExpressions] = useState<Set<string>>(new Set())
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [itemsPerPage] = useState(50)
  const [totalExpressions, setTotalExpressions] = useState(0)

  // Audio context for preview playback
  const audioContextRef = useRef<AudioContext | null>(null)
  const currentAudioRef = useRef<AudioBufferSourceNode | null>(null)

  useEffect(() => {
    loadExpressions()
  }, [currentPage, avatarId])

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

  const loadExpressions = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        limit: itemsPerPage.toString(),
        offset: (currentPage * itemsPerPage).toString(),
        status: 'active'
      })

      const response = await fetch(`/api/expressions/admin/avatars/${avatarId}?${params}`)
      
      if (!response.ok) {
        throw new Error(`Failed to load avatar expressions: ${response.statusText}`)
      }

      const data: AdminExpressionListResponse = await response.json()
      setExpressions(data.expressions || [])
      setExpressionsByType(data.expressionsByType || {})
      setStats(data.stats || {})
      setTotalExpressions(data.total || 0)
    } catch (err) {
      console.error('Error loading avatar expressions:', err)
      setError(err instanceof Error ? err.message : 'Failed to load avatar expressions')
    } finally {
      setLoading(false)
    }
  }

  const handlePreview = async (expression: ExpressionClip) => {
    if (playingId === expression.id) {
      // Stop current playback
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

      // Resume audio context if suspended
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume()
      }

      // Stop any currently playing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.stop()
      }

      // Fetch and decode audio
      const response = await fetch(expression.cdn_url)
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
      console.error('Error playing expression:', err)
      setError('Failed to play expression preview')
      setPlayingId(null)
    }
  }

  const handleToggleStatus = async (expression: ExpressionClip) => {
    const newStatus: ExpressionStatus = expression.status === 'active' ? 'inactive' : 'active'
    
    try {
      setUpdatingIds(prev => new Set(prev).add(expression.id))
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

      // Update local state
      setExpressions(prev => prev.map(expr => 
        expr.id === expression.id 
          ? { ...expr, status: newStatus }
          : expr
      ))

      // Notify parent component
      onExpressionUpdate?.()

    } catch (err) {
      console.error('Error updating expression:', err)
      setError(err instanceof Error ? err.message : 'Failed to update expression')
    } finally {
      setUpdatingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(expression.id)
        return newSet
      })
    }
  }

  const handlePriorityChange = async (expression: ExpressionClip, newPriority: number) => {
    try {
      setUpdatingIds(prev => new Set(prev).add(expression.id))
      setError(null)

      const response = await fetch(`/api/expressions/${expression.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priority: newPriority
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to update priority: ${response.statusText}`)
      }

      // Update local state
      setExpressions(prev => prev.map(expr => 
        expr.id === expression.id 
          ? { ...expr, priority: newPriority }
          : expr
      ))

      // Notify parent component
      onExpressionUpdate?.()

    } catch (err) {
      console.error('Error updating priority:', err)
      setError(err instanceof Error ? err.message : 'Failed to update priority')
    } finally {
      setUpdatingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(expression.id)
        return newSet
      })
    }
  }

  const handleDelete = async (expression: ExpressionClip) => {
    if (!confirm(`Are you sure you want to delete "${expression.filename}" from avatar ${avatarId}? This action cannot be undone.`)) {
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

      // Remove from local state
      setExpressions(prev => prev.filter(expr => expr.id !== expression.id))
      setTotalExpressions(prev => prev - 1)

      // Notify parent component
      onExpressionUpdate?.()

    } catch (err) {
      console.error('Error deleting expression:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete expression')
    } finally {
      setDeletingId(null)
    }
  }

  const handleSelectExpression = (expressionId: string, selected: boolean) => {
    setSelectedExpressions(prev => {
      const newSet = new Set(prev)
      if (selected) {
        newSet.add(expressionId)
      } else {
        newSet.delete(expressionId)
      }
      return newSet
    })
  }

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedExpressions(new Set(expressions.map(e => e.id)))
    } else {
      setSelectedExpressions(new Set())
    }
  }

  const handleBulkStatusUpdate = async (newStatus: ExpressionStatus) => {
    if (selectedExpressions.size === 0) return

    try {
      setBulkUpdating(true)
      setError(null)

      const updates = Array.from(selectedExpressions).map(id => ({
        id,
        status: newStatus
      }))

      const response = await fetch(`/api/expressions/admin/avatars/${avatarId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates })
      })

      if (!response.ok) {
        throw new Error(`Failed to bulk update: ${response.statusText}`)
      }

      const result = await response.json()

      // Update local state for successful updates
      if (result.results) {
        setExpressions(prev => prev.map(expr => {
          const update = result.results.find((r: any) => r.id === expr.id)
          return update ? { ...expr, status: newStatus } : expr
        }))
      }

      // Clear selection
      setSelectedExpressions(new Set())

      // Show errors if any
      if (result.errors && result.errors.length > 0) {
        setError(`Some updates failed: ${result.errors.slice(0, 3).join(', ')}`)
      }

      // Notify parent component
      onExpressionUpdate?.()

    } catch (err) {
      console.error('Error bulk updating:', err)
      setError(err instanceof Error ? err.message : 'Failed to bulk update expressions')
    } finally {
      setBulkUpdating(false)
    }
  }

  const formatDuration = (durationMs: number) => {
    const seconds = Math.round(durationMs / 1000 * 10) / 10
    return `${seconds}s`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getExpressionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      laugh: '😄 Laugh',
      sigh: '😔 Sigh',
      breath: '💨 Breath',
      affirmation: '✅ Affirmation',
      greeting: '👋 Greeting',
      catchphrase: '💬 Catchphrase',
      filler: '🤔 Filler'
    }
    return labels[type] || type
  }

  const totalPages = Math.ceil(totalExpressions / itemsPerPage)

  if (loading && expressions.length === 0) {
    return (
      <div className={styles.expressionListContainer}>
        <div className={styles.expressionLoading}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading avatar expressions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.expressionListContainer}>
      {/* Header */}
      <div className={styles.expressionHeader}>
        <div className={styles.expressionTitleRow}>
          <div>
            <h3 className={styles.expressionTitle}>Admin: {avatarId} Expressions</h3>
            <p className={styles.expressionSubtitle}>
              {totalExpressions} expression{totalExpressions !== 1 ? 's' : ''} • 
              {stats.totalActive} active • 
              Avg priority: {stats.averagePriority}
            </p>
          </div>
          <button
            onClick={loadExpressions}
            className={styles.refreshButton}
            disabled={loading}
            title="Refresh expressions"
          >
            {loading ? '⟳' : '🔄'} Refresh
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      {stats.typeDistribution && Object.keys(stats.typeDistribution).length > 0 && (
        <div className={styles.expressionStats}>
          <h4>Type Distribution:</h4>
          <div className={styles.statsGrid}>
            {Object.entries(stats.typeDistribution).map(([type, count]) => (
              <div key={type} className={styles.statItem}>
                <span className={styles.statLabel}>{getExpressionTypeLabel(type)}</span>
                <span className={styles.statValue}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedExpressions.size > 0 && (
        <div className={styles.bulkActions}>
          <span className={styles.bulkSelection}>
            {selectedExpressions.size} expression{selectedExpressions.size !== 1 ? 's' : ''} selected
          </span>
          <div className={styles.bulkButtons}>
            <button
              onClick={() => handleBulkStatusUpdate('active')}
              disabled={bulkUpdating}
              className={`${styles.expressionBtn} ${styles.expressionBtnActive}`}
            >
              {bulkUpdating ? '⟳' : '✅'} Activate
            </button>
            <button
              onClick={() => handleBulkStatusUpdate('inactive')}
              disabled={bulkUpdating}
              className={`${styles.expressionBtn} ${styles.expressionBtnInactive}`}
            >
              {bulkUpdating ? '⟳' : '❌'} Deactivate
            </button>
            <button
              onClick={() => setSelectedExpressions(new Set())}
              className={`${styles.expressionBtn} ${styles.expressionBtnSecondary}`}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className={styles.expressionError}>
          {error}
        </div>
      )}

      {/* Expression List */}
      {expressions.length === 0 ? (
        <div className={styles.expressionEmpty}>
          <div className={styles.expressionEmptyIcon}>🎵</div>
          <h3>No expressions found for {avatarId}</h3>
          <p>
            Upload expressions for this avatar using the admin uploader above.
          </p>
        </div>
      ) : (
        <>
          {/* Select All */}
          <div className={styles.selectAllRow}>
            <label className={styles.selectAllLabel}>
              <input
                type="checkbox"
                checked={selectedExpressions.size === expressions.length && expressions.length > 0}
                onChange={(e) => handleSelectAll(e.target.checked)}
              />
              Select All ({expressions.length})
            </label>
          </div>

          <div className={styles.expressionList}>
            {expressions.map((expression) => (
              <div key={expression.id} className={styles.expressionCard}>
                <div className={styles.expressionCardHeader}>
                  <div className={styles.expressionCheckbox}>
                    <input
                      type="checkbox"
                      checked={selectedExpressions.has(expression.id)}
                      onChange={(e) => handleSelectExpression(expression.id, e.target.checked)}
                    />
                  </div>
                  <div className={styles.expressionInfo}>
                    <div className={styles.expressionType}>
                      {getExpressionTypeLabel(expression.type)}
                    </div>
                    <div className={styles.expressionFilename}>
                      {expression.filename}
                    </div>
                    <div className={styles.expressionMeta}>
                      {formatDuration(expression.duration_ms)} • Priority: {expression.priority} • {formatDate(expression.created_at)}
                    </div>
                  </div>
                  <div className={styles.expressionActions}>
                    <button
                      onClick={() => handlePreview(expression)}
                      className={`${styles.expressionBtn} ${styles.expressionBtnSecondary} ${playingId === expression.id ? styles.expressionBtnPlaying : ''}`}
                      title={playingId === expression.id ? 'Stop preview' : 'Play preview'}
                    >
                      {playingId === expression.id ? '⏹️' : '▶️'}
                    </button>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={expression.priority}
                      onChange={(e) => handlePriorityChange(expression, parseInt(e.target.value) || 0)}
                      disabled={updatingIds.has(expression.id)}
                      className={styles.priorityInput}
                      title="Priority (0-100)"
                    />
                    <button
                      onClick={() => handleToggleStatus(expression)}
                      disabled={updatingIds.has(expression.id)}
                      className={`${styles.expressionBtn} ${expression.status === 'active' ? styles.expressionBtnActive : styles.expressionBtnInactive}`}
                      title={expression.status === 'active' ? 'Deactivate expression' : 'Activate expression'}
                    >
                      {updatingIds.has(expression.id) ? '⟳' : (expression.status === 'active' ? '✅' : '❌')}
                    </button>
                    <button
                      onClick={() => handleDelete(expression)}
                      disabled={deletingId === expression.id}
                      className={`${styles.expressionBtn} ${styles.expressionBtnDanger}`}
                      title="Delete expression"
                    >
                      {deletingId === expression.id ? '⟳' : '🗑️'}
                    </button>
                  </div>
                </div>
                
                {expression.tone && (
                  <div className={styles.expressionDetails}>
                    <span className={styles.expressionTone}>
                      Tone: {expression.tone}
                    </span>
                  </div>
                )}
                
                {expression.placement_hints && expression.placement_hints.length > 0 && (
                  <div className={styles.expressionDetails}>
                    <span className={styles.expressionHints}>
                      Hints: {expression.placement_hints.join(', ')}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.expressionPagination}>
          <button
            onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
            disabled={currentPage === 0}
            className={`${styles.expressionBtn} ${styles.expressionBtnSecondary}`}
          >
            Previous
          </button>
          <span className={styles.expressionPaginationInfo}>
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
            disabled={currentPage === totalPages - 1}
            className={`${styles.expressionBtn} ${styles.expressionBtnSecondary}`}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}