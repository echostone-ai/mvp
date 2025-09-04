'use client'

import React, { useEffect, useState } from 'react'
import StoryManager from '@/components/StoryManager'
import PageShell from '@/components/PageShell'

// Demo system configuration
const DEMO_SYSTEM_USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const DEMO_AVATAR_SLUG = 'jonathan-demo'

export default function StoriesPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // For demo mode, we'll use the predefined demo user
    // In production, this would check for proper authentication
    const initializeDemoMode = async () => {
      try {
        // Check if stories feature is enabled
        const storiesEnabled = process.env.NEXT_PUBLIC_STORIES_ENABLED !== 'false'
        
        if (!storiesEnabled) {
          setError('Stories feature is currently disabled')
          return
        }

        // Demo mode is ready
        setLoading(false)
      } catch (err) {
        console.error('Error initializing demo mode:', err)
        setError(err instanceof Error ? err.message : 'Failed to initialize')
      }
    }

    initializeDemoMode()
  }, [])

  if (loading) {
    return (
      <PageShell>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '400px',
          color: 'white'
        }}>
          <div>Loading...</div>
        </div>
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '400px',
          color: '#ff6b7a'
        }}>
          <div>Error: {error}</div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '2rem 1rem',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ 
            fontSize: '2.5rem', 
            fontWeight: '700', 
            marginBottom: '1rem',
            background: 'linear-gradient(135deg, #9147ff, #667eea)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Jonathan Demo - Authentic Voice Stories
          </h1>
          <p style={{ 
            fontSize: '1.2rem', 
            color: '#e2e2f6', 
            maxWidth: '600px', 
            margin: '0 auto',
            lineHeight: '1.6'
          }}>
            Upload personal stories in Jonathan's authentic voice that the avatar can share during conversations. 
            Create meaningful connections through genuine storytelling.
          </p>
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem 1.5rem',
            backgroundColor: 'rgba(145, 71, 255, 0.1)',
            border: '1px solid rgba(145, 71, 255, 0.3)',
            borderRadius: '8px',
            fontSize: '0.9rem',
            color: '#b8a9ff'
          }}>
            Demo Mode: Managing stories for {DEMO_AVATAR_SLUG}
          </div>
        </div>

        <StoryManager userId={DEMO_SYSTEM_USER_ID} avatarId={DEMO_AVATAR_SLUG} />
      </div>
    </PageShell>
  )
}