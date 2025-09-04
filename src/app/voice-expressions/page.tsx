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

// Check feature flag
const FEATURE_VOICE_OVERLAYS = process.env.NEXT_PUBLIC_FEATURE_VOICE_OVERLAYS === 'true';

function VoiceExpressionsContent() {
  // Return early if feature is disabled
  if (!FEATURE_VOICE_OVERLAYS) {
    return (
      <PageShell>
        <div className="expressions-container">
          <h1>Voice & Expressions</h1>
          <p>This feature is currently disabled.</p>
          <Link href="/profile" className="back-link">← Back to Profile</Link>
        </div>
      </PageShell>
    );
  }
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
            <h1>Loading Voice & Expressions...</h1>
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
            <p>Please sign in to manage your voice expressions.</p>
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
            Add authentic expressions to make your avatar more natural and expressive during conversations.
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
          <div className="expression-upload-section">
            <h2>Upload New Expression</h2>
            <p>Record or upload authentic sounds like laughs, sighs, or catchphrases.</p>
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
          </div>
          
          <div className="expression-list-section">
            <h2>Your Expressions</h2>
            <p>Manage your uploaded expressions and control when they're used.</p>
            <ExpressionList 
              key={refreshKey}
              userId={user.id}
              onExpressionUpdate={() => {
                // Handle expression updates if needed
                console.log('Expression updated')
              }}
            />
          </div>
        </div>
        
        <div className="expression-help-section">
          <h2>Expression Types</h2>
          <p>Different types of expressions enhance your avatar's personality in various ways:</p>
          <div className="expression-help-grid">
            <div className="expression-help-item">
              <div className="expression-help-icon">😄</div>
              <h3>Laughs</h3>
              <p>Natural laughter sounds that play during funny or joyful moments in conversation</p>
            </div>
            <div className="expression-help-item">
              <div className="expression-help-icon">😔</div>
              <h3>Sighs</h3>
              <p>Thoughtful sighs for contemplative, sad, or reflective moments</p>
            </div>
            <div className="expression-help-item">
              <div className="expression-help-icon">💨</div>
              <h3>Breaths</h3>
              <p>Natural breathing sounds for pauses, emphasis, and thinking moments</p>
            </div>
            <div className="expression-help-item">
              <div className="expression-help-icon">✅</div>
              <h3>Affirmations</h3>
              <p>Sounds like "mm-hmm", "yeah", or "exactly" to show agreement and understanding</p>
            </div>
            <div className="expression-help-item">
              <div className="expression-help-icon">👋</div>
              <h3>Greetings</h3>
              <p>Natural "hello", "hey", or "hi" sounds for starting conversations</p>
            </div>
            <div className="expression-help-item">
              <div className="expression-help-icon">💬</div>
              <h3>Catchphrases</h3>
              <p>Personal expressions and phrases unique to your speaking style</p>
            </div>
            <div className="expression-help-item">
              <div className="expression-help-icon">🤔</div>
              <h3>Fillers</h3>
              <p>Natural "um", "uh", or thinking sounds that add authenticity to speech</p>
            </div>
          </div>
        </div>

        <div className="expression-tips-section">
          <h2>Tips for Great Expressions</h2>
          <div className="expression-tips-list">
            <div className="expression-tip">
              <strong>Keep it short:</strong> Best expressions are under 2 seconds for natural flow
            </div>
            <div className="expression-tip">
              <strong>Record in quiet space:</strong> Clear audio without background noise works best
            </div>
            <div className="expression-tip">
              <strong>Be authentic:</strong> Use your natural voice and expressions for best results
            </div>
            <div className="expression-tip">
              <strong>Test different tones:</strong> Upload variations for different emotional contexts
            </div>
          </div>
        </div>
      </main>
    </PageShell>
  )
}

export default function VoiceExpressionsPage() {
  // Check feature flag on server side
  const featureEnabled = getServerFeatureFlag('VOICE_OVERLAYS')
  
  if (!featureEnabled) {
    return (
      <PageShell>
        <main className="expression-management-container">
          <div className="expression-feature-disabled">
            <div className="expression-feature-icon">🚧</div>
            <h1>Feature Not Available</h1>
            <p>The Voice & Expressions feature is currently disabled.</p>
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
            <h1>Loading Voice & Expressions...</h1>
            <div className="loading-spinner"></div>
          </div>
        </main>
      </PageShell>
    }>
      <VoiceExpressionsContent />
    </Suspense>
  )
}