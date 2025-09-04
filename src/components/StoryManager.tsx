'use client'

import React, { useState } from 'react'
import StoryUploader from './StoryUploader'
import StoryList from './StoryList'
import StoryLipSyncSettings from './StoryLipSyncSettings'
import styles from './StoryManager.module.css'

interface StoryManagerProps {
  userId: string
  avatarId?: string
}

export default function StoryManager({ userId, avatarId }: StoryManagerProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'manage' | 'lipsync'>('upload')
  const [refreshKey, setRefreshKey] = useState(0)

  const handleUploadSuccess = () => {
    // Refresh the story list when a new story is uploaded
    setRefreshKey(prev => prev + 1)
    // Switch to manage tab to see the uploaded story
    setActiveTab('manage')
  }

  const handleStoryUpdate = () => {
    // Refresh the story list when a story is updated/deleted
    setRefreshKey(prev => prev + 1)
  }

  return (
    <div className={styles.storyManagerContainer}>
      {/* Tab Navigation */}
      <div className={styles.tabNavigation}>
        <button
          onClick={() => setActiveTab('upload')}
          className={`${styles.tabButton} ${activeTab === 'upload' ? styles.tabButtonActive : ''}`}
        >
          📤 Upload Story
        </button>
        <button
          onClick={() => setActiveTab('manage')}
          className={`${styles.tabButton} ${activeTab === 'manage' ? styles.tabButtonActive : ''}`}
        >
          📋 Manage Stories
        </button>
        <button
          onClick={() => setActiveTab('lipsync')}
          className={`${styles.tabButton} ${activeTab === 'lipsync' ? styles.tabButtonActive : ''}`}
        >
          🎭 Lip-Sync (Beta)
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {activeTab === 'upload' && (
          <StoryUploader
            userId={userId}
            avatarId={avatarId}
            onUploadSuccess={handleUploadSuccess}
            onUploadError={(error) => console.error('Upload error:', error)}
          />
        )}
        
        {activeTab === 'manage' && (
          <StoryList
            key={refreshKey}
            userId={userId}
            avatarId={avatarId}
            onStoryUpdate={handleStoryUpdate}
          />
        )}
        
        {activeTab === 'lipsync' && (
          <div>
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                🎭 Experimental Lip-Sync Feature
              </h3>
              <p className="text-blue-800 text-sm">
                Configure experimental lip-sync integration for your avatar stories. 
                This feature attempts to synchronize avatar lip movements with story audio.
              </p>
            </div>
            <StoryLipSyncSettings />
          </div>
        )}
      </div>
    </div>
  )
}