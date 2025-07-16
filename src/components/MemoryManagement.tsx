'use client'

import React, { useState, useEffect } from 'react'
import { MemoryFragment } from '@/lib/memoryService'
import styles from './MemoryManagement.module.css'

interface MemoryManagementProps {
  userId: string
}

interface MemoryStats {
  totalFragments: number
  oldestMemory?: Date
  newestMemory?: Date
}

interface MemoryResponse {
  memories: MemoryFragment[]
  stats: MemoryStats
  pagination: {
    limit: number
    offset: number
    total: number
  }
}

export default function MemoryManagement({ userId }: MemoryManagementProps) {
  const [memories, setMemories] = useState<MemoryFragment[]>([])
  const [stats, setStats] = useState<MemoryStats>({ totalFragments: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [itemsPerPage] = useState(20)

  // Load memories on component mount and when page changes
  useEffect(() => {
    loadMemories()
  }, [currentPage, searchQuery])

  const loadMemories = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        limit: itemsPerPage.toString(),
        offset: (currentPage * itemsPerPage).toString(),
        orderBy: 'created_at',
        orderDirection: 'desc'
      })

      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim())
      }

      const response = await fetch(`/api/memories?${params}`)
      
      if (!response.ok) {
        throw new Error(`Failed to load memories: ${response.statusText}`)
      }

      const data: MemoryResponse = await response.json()
      setMemories(data.memories)
      setStats(data.stats)
    } catch (err) {
      console.error('Error loading memories:', err)
      setError(err instanceof Error ? err.message : 'Failed to load memories')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (memory: MemoryFragment) => {
    setEditingId(memory.id!)
    setEditText(memory.fragmentText)
  }

  const handleSave = async (memoryId: string) => {
    if (!editText.trim()) {
      setError('Memory text cannot be empty')
      return
    }

    try {
      setSaving(memoryId)
      setError(null)

      const response = await fetch(`/api/memories/${memoryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fragmentText: editText.trim()
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to update memory: ${response.statusText}`)
      }

      // Update the memory in the local state
      setMemories(prev => prev.map(memory => 
        memory.id === memoryId 
          ? { ...memory, fragmentText: editText.trim(), updatedAt: new Date() }
          : memory
      ))

      setEditingId(null)
      setEditText('')
    } catch (err) {
      console.error('Error saving memory:', err)
      setError(err instanceof Error ? err.message : 'Failed to save memory')
    } finally {
      setSaving(null)
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditText('')
  }

  const handleDelete = async (memoryId: string) => {
    if (!confirm('Are you sure you want to delete this memory? This action cannot be undone.')) {
      return
    }

    try {
      setDeleting(memoryId)
      setError(null)

      const response = await fetch(`/api/memories/${memoryId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`Failed to delete memory: ${response.statusText}`)
      }

      // Remove the memory from local state
      setMemories(prev => prev.filter(memory => memory.id !== memoryId))
      setStats(prev => ({ ...prev, totalFragments: prev.totalFragments - 1 }))
    } catch (err) {
      console.error('Error deleting memory:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete memory')
    } finally {
      setDeleting(null)
    }
  }

  const handleDeleteAll = async () => {
    if (!confirm(`Are you sure you want to delete all ${stats.totalFragments} memories? This action cannot be undone.`)) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/memories', {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`Failed to delete all memories: ${response.statusText}`)
      }

      setMemories([])
      setStats({ totalFragments: 0 })
      setCurrentPage(0)
    } catch (err) {
      console.error('Error deleting all memories:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete all memories')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const response = await fetch('/api/memories/export')
      
      if (!response.ok) {
        throw new Error(`Failed to export memories: ${response.statusText}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `memories-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Error exporting memories:', err)
      setError(err instanceof Error ? err.message : 'Failed to export memories')
    }
  }

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const totalPages = Math.ceil(stats.totalFragments / itemsPerPage)

  if (loading && memories.length === 0) {
    return (
      <div className={styles.memoryManagementContainer}>
        <div className={styles.memoryLoading}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading your memories...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.memoryManagementContainer}>
      {/* Header */}
      <div className={styles.memoryHeader}>
        <h2 className={styles.memoryTitle}>Your Conversation Memories</h2>
        <p className={styles.memorySubtitle}>
          Manage the personal details and experiences your avatar remembers from your conversations
        </p>
      </div>

      {/* Stats */}
      <div className={styles.memoryStats}>
        <div className={styles.memoryStatCard}>
          <div className={styles.memoryStatNumber}>{stats.totalFragments}</div>
          <div className={styles.memoryStatLabel}>Total Memories</div>
        </div>
        {stats.oldestMemory && (
          <div className={styles.memoryStatCard}>
            <div className={styles.memoryStatNumber}>{formatDate(stats.oldestMemory).split(' ')[0]}</div>
            <div className={styles.memoryStatLabel}>First Memory</div>
          </div>
        )}
        {stats.newestMemory && (
          <div className={styles.memoryStatCard}>
            <div className={styles.memoryStatNumber}>{formatDate(stats.newestMemory).split(' ')[0]}</div>
            <div className={styles.memoryStatLabel}>Latest Memory</div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className={styles.memoryControls}>
        <div className={styles.memorySearchContainer}>
          <input
            type="text"
            placeholder="Search your memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.memorySearchInput}
          />
        </div>
        <div className={styles.memoryActions}>
          <button
            onClick={handleExport}
            className={`${styles.memoryBtn} ${styles.memoryBtnSecondary}`}
            disabled={stats.totalFragments === 0}
          >
            Export All
          </button>
          <button
            onClick={handleDeleteAll}
            className={`${styles.memoryBtn} ${styles.memoryBtnDanger}`}
            disabled={stats.totalFragments === 0}
          >
            Delete All
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className={styles.memoryError}>
          {error}
        </div>
      )}

      {/* Memory List */}
      {memories.length === 0 ? (
        <div className={styles.memoryEmpty}>
          <div className={styles.memoryEmptyIcon}>🧠</div>
          <h3>No memories found</h3>
          <p>
            {searchQuery 
              ? "No memories match your search. Try a different search term."
              : "Start chatting with your avatar to build up conversation memories!"
            }
          </p>
        </div>
      ) : (
        <div className={styles.memoryList}>
          {memories.map((memory) => (
            <div key={memory.id} className={styles.memoryCard}>
              <div className={styles.memoryCardHeader}>
                <div className={styles.memoryDate}>
                  {formatDate(memory.createdAt!)}
                  {memory.updatedAt && memory.updatedAt !== memory.createdAt && (
                    <span className={styles.memoryUpdated}> (edited)</span>
                  )}
                </div>
                <div className={styles.memoryCardActions}>
                  {editingId === memory.id ? (
                    <>
                      <button
                        onClick={() => handleSave(memory.id!)}
                        disabled={saving === memory.id}
                        className={`${styles.memoryBtn} ${styles.memoryBtnSmall} ${styles.memoryBtnPrimary}`}
                      >
                        {saving === memory.id ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={handleCancel}
                        disabled={saving === memory.id}
                        className={`${styles.memoryBtn} ${styles.memoryBtnSmall} ${styles.memoryBtnSecondary}`}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEdit(memory)}
                        className={`${styles.memoryBtn} ${styles.memoryBtnSmall} ${styles.memoryBtnSecondary}`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(memory.id!)}
                        disabled={deleting === memory.id}
                        className={`${styles.memoryBtn} ${styles.memoryBtnSmall} ${styles.memoryBtnDanger}`}
                      >
                        {deleting === memory.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              <div className={styles.memoryContent}>
                {editingId === memory.id ? (
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className={styles.memoryEditTextarea}
                    rows={3}
                    maxLength={2000}
                    autoFocus
                  />
                ) : (
                  <p className={styles.memoryText}>{memory.fragmentText}</p>
                )}
              </div>

              {memory.conversationContext && (
                <div className={styles.memoryContext}>
                  <div className={styles.memoryContextItem}>
                    <span className={styles.memoryContextLabel}>Context:</span>
                    <span className={styles.memoryContextValue}>
                      {memory.conversationContext.messageContext}
                    </span>
                  </div>
                  {memory.conversationContext.emotionalTone && memory.conversationContext.emotionalTone !== 'neutral' && (
                    <div className={styles.memoryContextItem}>
                      <span className={styles.memoryContextLabel}>Tone:</span>
                      <span className={`${styles.memoryContextTone} ${styles[`memoryContextTone${memory.conversationContext.emotionalTone.charAt(0).toUpperCase() + memory.conversationContext.emotionalTone.slice(1)}`]}`}>
                        {memory.conversationContext.emotionalTone}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.memoryPagination}>
          <button
            onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
            disabled={currentPage === 0}
            className={`${styles.memoryBtn} ${styles.memoryBtnSecondary}`}
          >
            Previous
          </button>
          <span className={styles.memoryPaginationInfo}>
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
            disabled={currentPage === totalPages - 1}
            className={`${styles.memoryBtn} ${styles.memoryBtnSecondary}`}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}