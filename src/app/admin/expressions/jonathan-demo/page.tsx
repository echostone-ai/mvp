'use client'

import React, { useState, useEffect } from 'react'
import { getServerFeatureFlag } from '@/lib/featureFlags'
import AdminExpressionUploader from '@/components/AdminExpressionUploader'
import AdminBulkExpressionUploader from '@/components/AdminBulkExpressionUploader'
import AdminExpressionList from '@/components/AdminExpressionList'
import PageShell from '@/components/PageShell'

const AVATAR_ID = 'jonathan-demo'

export default function JonathanDemoAdminPage() {
  const [activeTab, setActiveTab] = useState<'single' | 'bulk' | 'manage'>('manage')
  const [refreshKey, setRefreshKey] = useState(0)
  const [featureEnabled, setFeatureEnabled] = useState(false)

  useEffect(() => {
    // Check feature flag on client side
    const checkFeature = async () => {
      try {
        const response = await fetch('/api/expressions')
        setFeatureEnabled(response.status !== 404)
      } catch (error) {
        setFeatureEnabled(false)
      }
    }
    checkFeature()
  }, [])

  const handleUploadSuccess = () => {
    // Refresh the expression list
    setRefreshKey(prev => prev + 1)
  }

  const handleUploadError = (error: string) => {
    console.error('Upload error:', error)
    // Could show a toast notification here
  }

  if (!featureEnabled) {
    return (
      <PageShell>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '400px',
          color: 'white',
          textAlign: 'center'
        }}>
          <div>
            <h2>Expression Management Not Available</h2>
            <p>The voice expressions feature is currently disabled.</p>
            <p>Please enable the FEATURE_VOICE_OVERLAYS environment variable.</p>
          </div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '2rem',
        color: 'white'
      }}>
        {/* Header */}
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '2rem',
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '2rem',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(10px)'
        }}>
          <h1 style={{ 
            fontSize: '2rem', 
            fontWeight: '700', 
            marginBottom: '0.5rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            🎭 Admin: Jonathan Demo Expressions
          </h1>
          <p style={{ 
            fontSize: '1.1rem', 
            color: '#e2e2f6', 
            margin: 0,
            lineHeight: '1.5'
          }}>
            Manage expression clips for the jonathan-demo avatar
          </p>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '2rem',
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '8px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(10px)'
        }}>
          <button
            onClick={() => setActiveTab('manage')}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderRadius: '8px',
              background: activeTab === 'manage' 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                : 'transparent',
              color: 'white',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginRight: '8px'
            }}
          >
            📋 Manage Expressions
          </button>
          <button
            onClick={() => setActiveTab('single')}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderRadius: '8px',
              background: activeTab === 'single' 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                : 'transparent',
              color: 'white',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginRight: '8px'
            }}
          >
            📤 Single Upload
          </button>
          <button
            onClick={() => setActiveTab('bulk')}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderRadius: '8px',
              background: activeTab === 'bulk' 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                : 'transparent',
              color: 'white',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            📦 Bulk Upload
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'manage' && (
          <AdminExpressionList
            key={refreshKey}
            avatarId={AVATAR_ID}
            onExpressionUpdate={handleUploadSuccess}
          />
        )}

        {activeTab === 'single' && (
          <AdminExpressionUploader
            avatarId={AVATAR_ID}
            onUploadSuccess={handleUploadSuccess}
            onUploadError={handleUploadError}
          />
        )}

        {activeTab === 'bulk' && (
          <AdminBulkExpressionUploader
            avatarId={AVATAR_ID}
            onUploadSuccess={handleUploadSuccess}
            onUploadError={handleUploadError}
          />
        )}

        {/* Footer Info */}
        <div style={{
          marginTop: '3rem',
          padding: '1.5rem',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <h3 style={{ 
            fontSize: '1.1rem', 
            fontWeight: '600', 
            marginBottom: '0.5rem',
            color: 'white'
          }}>
            ℹ️ Admin Expression Management
          </h3>
          <p style={{ 
            fontSize: '0.9rem', 
            color: '#e2e2f6', 
            margin: 0,
            lineHeight: '1.5'
          }}>
            Admin expressions have higher priority than user expressions and are used exclusively for demo avatars.
            <br />
            Priority range: 0-100 (higher numbers = more likely to be selected)
            <br />
            Demo avatars like jonathan-demo will only use admin expressions, not user expressions.
          </p>
        </div>
      </div>
    </PageShell>
  )
}