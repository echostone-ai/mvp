'use client'

import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import PageShell from '@/components/PageShell'
import ExpressionList from '@/components/ExpressionList'
import ExpressionUploader from '@/components/ExpressionUploader'
import { getServerFeatureFlag } from '@/lib/featureFlags'
import '@/styles/expressions.css'

interface User {
  id: string
  email: string
}

function ExpressionsContent() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: session } = await supabase.auth.getSession()
        const currentUser = session.session?.user ?? null
        
        if (currentUser) {
          setUser({
            id: currentUser.id,
            email: currentUser.email || ''
          })
        }
      } catch (err: any) {
        setError(`Failed to load user: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [])

  if (loading) {
    return (
      <PageShell>
        <main className="expression-management-container">
          <div className="expression-management-header">
            <h1>Loading Expressions...</h1>
            <div className="loading-spinner"></div>
          </div>
        </main>
      </PageShell>
    )
  }

  if (!user) {
    return (
      <PageShell>
        <main className="expression-management-container">
          <div className="expression-auth-required">
            <div className="expression-auth-icon">🔐</div>
            <h1>Authentication Required</h1>
            <p>Please sign in to manage your expressions.</p>
            <Link href="/login" className="expression-auth-button">
              Sign In to Continue
            </Link>
          </div>
        </main>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <main className="expression-management-container">
        <div className="expression-management-header">
          <h1>Voice & Expressions</h1>
          <p>
            Manage your authentic expressions to make your avatar more natural and expressive.
          </p>
        </div>

        {error && (
          <div className="expression-management-error">
            {error}
          </div>
        )}

        <div className="expression-management-actions">
          <Link 
            href="/profile" 
            className="expression-back-link"
          >
            ← Back to Profile
          </Link>
        </div>

        <div className="expression-management-content">
          <ExpressionUploader
            userId={user.id}
            onUploadSuccess={() => {
              // Refresh the expression list when upload succeeds
              setRefreshKey(prev => prev + 1)
            }}
            onUploadError={(error) => {
              setError(`Upload failed: ${error}`)
            }}
          />
          
          <ExpressionList 
            key={refreshKey}
            userId={user.id}
            onExpressionUpdate={() => {
              // Handle expression updates if needed
              console.log('Expression updated')
            }}
          />
        </div>
        
        <div className="expression-help-section">
          <h2>About Expressions</h2>
          <div className="expression-help-grid">
            <div className="expression-help-item">
              <h3>😄 Laughs</h3>
              <p>Natural laughter sounds that play during funny moments</p>
            </div>
            <div className="expression-help-item">
              <h3>😔 Sighs</h3>
              <p>Thoughtful sighs for contemplative or sad moments</p>
            </div>
            <div className="expression-help-item">
              <h3>💨 Breaths</h3>
              <p>Natural breathing sounds for pauses and emphasis</p>
            </div>
            <div className="expression-help-item">
              <h3>✅ Affirmations</h3>
              <p>Sounds like "mm-hmm" or "yeah" for agreement</p>
            </div>
            <div className="expression-help-item">
              <h3>👋 Greetings</h3>
              <p>Natural "hello" or "hey" sounds for conversations</p>
            </div>
            <div className="expression-help-item">
              <h3>💬 Catchphrases</h3>
              <p>Personal expressions unique to your speaking style</p>
            </div>
          </div>
        </div>
      </main>
    </PageShell>
  )
}

export default function ExpressionsPage() {
  // Check feature flag on server side
  const featureEnabled = getServerFeatureFlag('VOICE_OVERLAYS')
  
  if (!featureEnabled) {
    return (
      <PageShell>
        <main className="expression-management-container">
          <div className="expression-feature-disabled">
            <h1>Feature Not Available</h1>
            <p>The expressions feature is currently disabled.</p>
            <Link href="/profile" className="expression-back-link">
              ← Back to Profile
            </Link>
          </div>
        </main>
      </PageShell>
    )
  }

  return (
    <Suspense fallback={
      <PageShell>
        <main className="expression-management-container">
          <div className="expression-management-header">
            <h1>Loading...</h1>
          </div>
        </main>
      </PageShell>
    }>
      <ExpressionsContent />
    </Suspense>
  )
}