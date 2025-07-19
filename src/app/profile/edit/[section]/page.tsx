'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { QUESTIONS, Question } from '@/data/questions'
import useEmblaCarousel from 'embla-carousel-react'
import LogoHeader from '@/components/LogoHeader'
import AccountMenu from '@/components/AccountMenu'
import { supabase } from '@/components/supabaseClient'

interface Avatar {
  id: string
  name: string
  description: string
  voice_id: string | null
  photo_url?: string
  profile_data: any
  created_at: string
}

export default function EditSectionPage() {
  const params = useParams() as { section: string }
  const searchParams = useSearchParams()
  const section = params.section
  const avatarId = searchParams.get('avatarId')
  const router = useRouter()
  const questions: Question[] = QUESTIONS[section] || []

  const [user, setUser] = useState<any>(null)
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string|null>(null)
  // No skipSnaps! Just use loop: false for natural UX
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false })

  // Check authentication and load avatar if avatarId is provided
  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          console.error('Session error:', sessionError)
          setLoadingUser(false)
          return
        }
        const currentUser = sessionData.session?.user ?? null
        setUser(currentUser)
        
        // Load avatar data if avatarId is provided
        if (avatarId && currentUser) {
          try {
            const { data: avatarData, error: avatarError } = await supabase
              .from('avatar_profiles')
              .select('*')
              .eq('id', avatarId)
              .eq('user_id', currentUser.id)
              .single()
            
            if (avatarError) {
              console.error('Avatar load error:', avatarError)
              setError('Failed to load avatar data')
            } else {
              setSelectedAvatar(avatarData)
            }
          } catch (e: any) {
            console.error('Avatar load error:', e)
            setError('Failed to load avatar data')
          }
        }
        
        setLoadingUser(false)
      } catch (e: any) {
        console.error('Auth check error:', e)
        setLoadingUser(false)
      }
    }
    checkAuth()
  }, [avatarId])

  // Set/restore answers
  useEffect(() => {
    const storageKey = avatarId ? `echostone_avatar_${avatarId}_profile_${section}` : `echostone_profile_${section}`
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      setAnswers(JSON.parse(stored))
    } else {
      // If we have avatar data, try to load existing answers from avatar profile_data
      if (selectedAvatar?.profile_data?.[section]) {
        setAnswers(selectedAvatar.profile_data[section])
      } else {
        const initial: Record<string, string> = {}
        questions.forEach(q => { initial[q.key] = '' })
        setAnswers(initial)
      }
    }
  }, [section, questions, selectedAvatar, avatarId])

  // Arrow key navigation for Embla
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!emblaApi) return
      if (e.key === 'ArrowRight') {
        emblaApi.scrollNext()
        e.preventDefault()
      }
      if (e.key === 'ArrowLeft') {
        emblaApi.scrollPrev()
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [emblaApi])

  // Save & route
  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const storageKey = avatarId ? `echostone_avatar_${avatarId}_profile_${section}` : `echostone_profile_${section}`
      // Save to localStorage as backup
      localStorage.setItem(storageKey, JSON.stringify(answers))

      // Fetch session & user info
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) throw new Error('Not logged in!')

      if (avatarId && selectedAvatar) {
        // Save to avatar profile_data
        const prevData = selectedAvatar.profile_data || {}
        const newProfileData = { ...prevData, [section]: answers }

        const { error: updateErr } = await supabase
          .from('avatar_profiles')
          .update({ profile_data: newProfileData })
          .eq('id', avatarId)
          .eq('user_id', user.id)
        if (updateErr) throw updateErr

        // Update local avatar state
        setSelectedAvatar(prev => prev ? { ...prev, profile_data: newProfileData } : null)
      } else {
        // Save to user profile_data (original behavior)
        const { data: profileData, error: profileErr } = await supabase
          .from('profiles')
          .select('profile_data')
          .eq('user_id', user.id)
          .maybeSingle()
        if (profileErr) throw profileErr

        // Merge updated answers for this section with previous data
        const prevData = profileData?.profile_data || {}
        const newProfileData = { ...prevData, [section]: answers }

        // Update the profile_data column in Supabase
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({ profile_data: newProfileData })
          .eq('user_id', user.id)
        if (updateErr) throw updateErr
      }

      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        // Redirect back to profile page with avatar context if applicable
        if (avatarId) {
          router.push('/profile')
        } else {
          router.push('/profile')
        }
      }, 800)
    } catch (err: any) {
      setError(err.message || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }, [answers, section, router, avatarId, selectedAvatar])

  // Answer edit
  const handleChange = (key: string, value: string) => {
    setAnswers(a => ({ ...a, [key]: value }))
    setSaved(false)
  }

  // Slide selection
  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap())
    emblaApi.on('select', onSelect)
    onSelect()
    return () => { emblaApi.off('select', onSelect) }
  }, [emblaApi])

  // Always go to first slide when changing section
  useEffect(() => {
    if (emblaApi) emblaApi.scrollTo(0)
  }, [section, emblaApi])

  const scrollPrev = () => emblaApi?.scrollPrev()
  const scrollNext = () => emblaApi?.scrollNext()

  // Show loading state
  if (loadingUser) {
    return (
      <div className="min-h-screen w-screen relative">
        <div className="fixed top-9 right-9 z-50">
          <AccountMenu />
        </div>
        <main className="min-h-screen flex flex-col items-center justify-center text-white">
          <div className="loading-spinner"></div>
          <p className="mt-4 text-xl">Loading...</p>
        </main>
      </div>
    )
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen w-screen relative">
        <div className="fixed top-9 right-9 z-50">
          <AccountMenu />
        </div>
        <main className="min-h-screen flex flex-col items-center justify-center text-white p-4 text-center">
          <img
            src="/echostone_logo.png"
            alt="EchoStone Logo"
            className="logo-pulse w-36 mb-8 select-none"
          />
          <div className="auth-required-card">
            <h1 className="auth-required-title">
              Authentication Required
            </h1>
            <p className="auth-required-subtitle">
              Please sign in to edit your profile and answer questions.
            </p>
            <div className="auth-required-actions">
              <a 
                href="/login" 
                className="auth-btn primary"
              >
                Sign In
              </a>
              <a 
                href="/login" 
                className="auth-btn secondary"
              >
                Create Account
              </a>
            </div>
            <div className="auth-required-features">
              <h3>Complete your profile to:</h3>
              <ul>
                <li>🎯 Build a comprehensive personality profile</li>
                <li>🤖 Train your AI to respond like you</li>
                <li>💾 Save your progress securely</li>
                <li>🔄 Sync across all your devices</li>
              </ul>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!questions.length) {
    return (
      <main style={{ padding: '2em', color: '#fff' }}>
        <LogoHeader />
        <h2>Section not found</h2>
        <button onClick={() => router.back()}>Go Back</button>
      </main>
    )
  }

  return (
    <div className="min-h-screen w-screen relative">
      <div className="fixed top-9 right-9 z-50">
        <AccountMenu />
      </div>
      
      <main className="profile-edit-main">
        {/* Avatar Header Banner */}
        {selectedAvatar && (
          <div className="avatar-header">
            <div className="avatar-header-info">
              <div className="avatar-header-photo">
                {selectedAvatar.photo_url ? (
                  <img 
                    src={selectedAvatar.photo_url} 
                    alt={selectedAvatar.name}
                    className="avatar-photo"
                    onError={(e) => {
                      // Fallback to icon if image fails to load
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      target.nextElementSibling?.classList.remove('avatar-photo-fallback-hidden')
                    }}
                  />
                ) : null}
                <div className={`avatar-photo-fallback ${selectedAvatar.photo_url ? 'avatar-photo-fallback-hidden' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="avatar-header-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
              <div>
                <h2 className="avatar-header-title">Editing: {selectedAvatar.name}</h2>
                <p className="avatar-header-desc">{selectedAvatar.description || "No description provided"}</p>
              </div>
            </div>
            <div className="avatar-header-status">
              <a
                href={`/profile/chat?avatarId=${selectedAvatar.id}`}
                className="avatar-header-chat-btn"
              >
                💬 Chat with {selectedAvatar.name}
              </a>
              <button
                onClick={() => router.push('/profile')}
                className="avatar-header-change-btn"
              >
                Back to Profile
              </button>
              <div className="avatar-header-active">
                <span className="avatar-header-active-dot"></span>
                <span>Editing</span>
              </div>
            </div>
          </div>
        )}

        <div className="profile-edit-header">
          <img
            src="/echostone_logo.png"
            alt="EchoStone Logo"
            className="logo-pulse profile-edit-logo"
          />
          <h1 className="profile-edit-title">
            {selectedAvatar ? `${selectedAvatar.name}'s ${section.replace(/_/g, ' ')}` : section.replace(/_/g, ' ')}
          </h1>
          <p className="profile-edit-subtitle">
            {selectedAvatar 
              ? `Share your thoughts and experiences to help build ${selectedAvatar.name}'s personality profile`
              : 'Share your thoughts and experiences to help build your digital profile'
            }
          </p>
        </div>

        <div className="profile-edit-carousel" ref={emblaRef}>
          <div className="embla__container">
            {questions.map((q, idx) => (
              <div className="embla__slide" key={q.key}>
                <div className="profile-edit-card">
                  <div className="question-header">
                    <span className="question-counter">
                      Question {idx + 1} of {questions.length}
                    </span>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${((idx + 1) / questions.length) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <label className="question-label">
                    {q.q}
                  </label>
                  
                  <textarea
                    value={answers[q.key] || ''}
                    onChange={e => handleChange(q.key, e.target.value)}
                    className="profile-edit-textarea"
                    placeholder="Share your thoughts here..."
                    rows={4}
                  />
                  
                  <div className="profile-edit-actions">
                    <button
                      type="button"
                      onClick={scrollPrev}
                      disabled={selectedIndex === 0}
                      className={`profile-edit-btn secondary ${selectedIndex === 0 ? 'disabled' : ''}`}
                    >
                      ← Previous
                    </button>
                    
                    <button
                      type="button"
                      onClick={scrollNext}
                      disabled={selectedIndex === questions.length - 1}
                      className={`profile-edit-btn primary ${selectedIndex === questions.length - 1 ? 'disabled' : ''}`}
                    >
                      Next →
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="profile-edit-btn save"
                    >
                      {saving ? (
                        <>
                          <span className="loading-spinner small"></span>
                          Saving...
                        </>
                      ) : saved ? (
                        <>
                          <span>✓</span>
                          Saved!
                        </>
                      ) : (
                        'Save Progress'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="profile-edit-help">
          <span>💡 Use arrow keys or swipe to navigate between questions</span>
        </div>
        
        {error && (
          <div className="profile-edit-error">
            {error}
          </div>
        )}
      </main>
    </div>
  )
}