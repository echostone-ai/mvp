'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { QUESTIONS } from '@/data/questions'
import { supabase } from '@/components/supabaseClient'
import VoiceRecorder from '@/components/VoiceRecorder'
import StoriesSection from '@/components/StoriesSection'
import MemoryManagement from '@/components/MemoryManagement'
import AccountMenu from '@/components/AccountMenu'
import PageShell from '@/components/PageShell'
import VoicePreview from '@/components/VoicePreview'
import VoicePreviewTesting from '@/components/VoicePreviewTesting'

type Progress = { total: number; answered: number; isComplete: boolean }

async function ensureProfileExists(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    const { error: insertError } = await supabase
      .from('profiles')
      .insert([{ user_id: userId }])
    if (insertError) throw insertError
  }
}

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [activeTab, setActiveTab] = useState<'voice' | 'stories' | 'personality' | 'memories' | 'voicetuning'>('voice')
  const [progress, setProgress] = useState<Record<string, Progress>>({})
  const [voiceId, setVoiceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    let mounted = true
    async function load() {
      setError(null)
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          setError("Failed to get session: " + sessionError.message)
          setLoadingUser(false)
          return
        }
        const me = sessionData.session?.user ?? null
        if (mounted) setUser(me)
        if (me) {
          try {
            await ensureProfileExists(me.id)
          } catch (e: any) {
            setError('Could not ensure profile exists: ' + e.message)
          }
          const { data, error } = await supabase
            .from('profiles')
            .select('profile_data, voice_id')
            .eq('user_id', me.id)
            .maybeSingle()
          if (error) {
            setError("Profile fetch error: " + error.message)
          }
          if (data && mounted) {
            const prog: Record<string, Progress> = {}
            Object.entries(QUESTIONS || {}).forEach(([section, qs]) => {
              const answers = data.profile_data?.[section] || {}
              const cnt = qs.filter(q => answers[q.key]?.trim()).length
              prog[section] = { total: qs.length, answered: cnt, isComplete: cnt === qs.length && qs.length > 0 }
            })
            setProgress(prog)
            setVoiceId(data.voice_id)

            // Extract first name from profile data for voice naming
            const profileData = data.profile_data
            let firstName = ''
            if (profileData?.personal_snapshot?.full_legal_name) {
              firstName = profileData.personal_snapshot.full_legal_name.split(' ')[0]
            } else if (profileData?.full_legal_name) {
              firstName = profileData.full_legal_name.split(' ')[0]
            } else if (profileData?.name) {
              firstName = profileData.name.split(' ')[0]
            } else if (me?.user_metadata?.full_name) {
              firstName = me.user_metadata.full_name.split(' ')[0]
            } else if (me?.email) {
              // Fallback to email username
              firstName = me.email.split('@')[0]
            } else {
              firstName = 'User'
            }
            setUserName(firstName)
          }
        }
        setLoadingUser(false)
      } catch (e: any) {
        setError("Unexpected error: " + (e?.message || e))
        setLoadingUser(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  // Show loading state
  if (loadingUser) {
    return (
      <PageShell>
        <main className="min-h-screen flex flex-col items-center justify-center text-white">
          <div className="loading-spinner"></div>
          <p className="mt-4 text-xl">Loading...</p>
        </main>
      </PageShell>
    )
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <PageShell>
        <main className="min-h-screen flex flex-col items-center justify-center text-white p-4 text-center">
          <a href="/" className="inline-block">
            <img
              src="/echostone_logo.png"
              alt="EchoStone Logo"
              className="logo-pulse w-36 mb-8 select-none cursor-pointer hover:scale-110 transition-transform duration-300"
            />
          </a>
          <div className="auth-required-card">
            <h1 className="auth-required-title">
              Authentication Required
            </h1>
            <p className="auth-required-subtitle">
              Please sign in to access your profile and build your digital voice.
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
              <h3>With your profile, you can:</h3>
              <ul>
                <li>🎤 Train your personal voice</li>
                <li>📝 Build your personality profile</li>
                <li>💬 Chat with your digital twin</li>
                <li>🔒 Keep your data secure and private</li>
              </ul>
            </div>
          </div>
        </main>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <main className="min-h-screen text-white flex flex-col items-center p-0 max-w-full">
        <div className="flex flex-col items-center my-8 mb-2">
          <a href="/" className="inline-block">
            <Image
              className="logo-pulse mb-6 cursor-pointer hover:scale-110 transition-transform duration-300"
              src="/echostone_logo.png"
              width={160}
              height={160}
              alt="EchoStone Logo"
            />
          </a>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mb-4 px-4 text-center">
            Your Profile
          </h1>

          {/* Tab navigation with inline styles that actually work */}
          <div style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: '2rem',
            padding: '0 1rem'
          }}>
            {[
              { id: 'voice', label: 'Voice', icon: '🎤' },
              { id: 'voicetuning', label: 'Voice Tuning', icon: '🎛️' },
              { id: 'stories', label: 'Your Stories', icon: '📚' },
              { id: 'personality', label: 'Personality', icon: '👤' },
              { id: 'memories', label: 'New Memories', icon: '🧠' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  background: activeTab === tab.id
                    ? 'linear-gradient(135deg, #9147ff, #7c3aed)'
                    : 'rgba(147, 71, 255, 0.8)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '18px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  minHeight: '48px',
                  boxShadow: activeTab === tab.id
                    ? '0 8px 24px rgba(145, 71, 255, 0.5)'
                    : '0 4px 12px rgba(147, 71, 255, 0.3)',
                  transform: activeTab === tab.id ? 'translateY(-1px)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.background = 'rgba(147, 71, 255, 0.9)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.background = 'rgba(147, 71, 255, 0.8)';
                    e.currentTarget.style.transform = 'none';
                  }
                }}
              >
                <span style={{ fontSize: '20px' }}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-5xl w-full px-4 sm:px-6 lg:px-8 mx-auto mb-12 tab-content">
          {error && (
            <div className="text-red-400 bg-purple-900/50 px-6 py-4 rounded-xl mb-5 text-lg text-center font-medium">
              {error}
            </div>
          )}

          {activeTab === 'voice' && (
            <div
              role="tabpanel"
              id="voice-panel"
              aria-labelledby="voice-tab"
              className="w-full"
            >
              <VoiceRecorder
                userName={userName}
                onVoiceUploaded={async (voiceId) => {
                  setVoiceId(voiceId)
                  if (user?.id) {
                    await supabase.from('profiles').update({ voice_id: voiceId }).eq('user_id', user.id)
                  }
                }}
              />
              {/* Show basic voice preview if a voiceId is available */}
              {voiceId && (
                <div className="mt-6 sm:mt-10">
                  <h2 className="text-xl sm:text-2xl font-bold mb-4 text-white text-center">Test Your Digital Voice</h2>
                  <VoicePreview
                    voiceId={voiceId}
                    userName={userName}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'voicetuning' && voiceId && (
            <div
              role="tabpanel"
              id="voicetuning-panel"
              aria-labelledby="voicetuning-tab"
              className="mt-6 sm:mt-10 w-full"
            >
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-white text-center">Voice Tuning</h2>
              <p className="text-base sm:text-lg text-gray-300 mb-6 text-center px-2">Fine-tune your digital voice with advanced controls, emotional previews, and parameter adjustments.</p>
              <VoicePreviewTesting
                voiceId={voiceId}
                userName={userName}
                userId={user?.id}
              />
            </div>
          )}

          {activeTab === 'stories' && (
            <div
              role="tabpanel"
              id="stories-panel"
              aria-labelledby="stories-tab"
              className="w-full"
            >
              <StoriesSection userId={user?.id} />
            </div>
          )}

          {activeTab === 'personality' && (
            <div
              role="tabpanel"
              id="personality-panel"
              aria-labelledby="personality-tab"
              style={{
                marginTop: '2rem',
                width: '100%',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '16px',
                padding: '0 16px'
              }}
            >
              {Object.entries(QUESTIONS || {}).map(([section, qs]) => {
                const prog = progress[section] || { total: qs.length, answered: 0, isComplete: false }
                return (
                  <Link
                    key={section}
                    href={`/profile/edit/${section}`}
                    style={{
                      textDecoration: 'none',
                      color: 'inherit',
                      display: 'block',
                      touchAction: 'manipulation'
                    }}
                  >
                    <div style={{
                      padding: '16px',
                      borderRadius: '16px',
                      boxShadow: prog.isComplete
                        ? '0 10px 25px rgba(0, 0, 0, 0.2), 0 0 15px rgba(74, 222, 128, 0.2)'
                        : '0 8px 20px rgba(0, 0, 0, 0.2)',
                      transition: 'all 0.3s ease',
                      textAlign: 'left',
                      minHeight: '120px',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-start',
                      background: prog.isComplete
                        ? 'rgba(107, 33, 168, 0.95)'
                        : 'rgba(88, 28, 135, 0.75)',
                      opacity: prog.isComplete ? 1 : 0.9,
                      cursor: 'pointer'
                    }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'scale(1.03)';
                        e.currentTarget.style.opacity = '1';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        if (!prog.isComplete) {
                          e.currentTarget.style.opacity = '0.9';
                        }
                      }}
                      onMouseDown={(e) => {
                        e.currentTarget.style.transform = 'scale(0.98)';
                      }}
                      onMouseUp={(e) => {
                        e.currentTarget.style.transform = 'scale(1.03)';
                      }}
                    >
                      <h2 style={{
                        margin: 0,
                        fontSize: '20px',
                        fontWeight: 600,
                        color: 'white',
                        textTransform: 'capitalize',
                        marginBottom: '8px',
                        lineHeight: 1.2
                      }}>
                        {section.replace(/_/g, ' ')}
                      </h2>
                      <p style={{
                        margin: 0,
                        marginBottom: '4px',
                        fontSize: '16px',
                        color: 'rgb(233, 213, 255)'
                      }}>
                        {prog.answered} of {prog.total} answered
                      </p>
                      {prog.answered > 0 && prog.answered < prog.total && (
                        <div style={{
                          fontSize: '12px',
                          color: 'rgb(191, 219, 254)',
                          marginTop: '4px'
                        }}>
                          ✨ Some auto-filled from stories
                        </div>
                      )}
                      {prog.isComplete && (
                        <span style={{
                          color: 'rgb(74, 222, 128)',
                          fontSize: '24px',
                          position: 'absolute',
                          top: '16px',
                          right: '16px'
                        }}>✓</span>
                      )}

                      {/* Mobile-friendly progress indicator */}
                      <div style={{
                        marginTop: '12px',
                        width: '100%',
                        backgroundColor: 'rgba(107, 33, 168, 0.5)',
                        borderRadius: '9999px',
                        height: '8px',
                        overflow: 'hidden'
                      }}>
                        <div
                          style={{
                            width: `${(prog.answered / prog.total) * 100}%`,
                            height: '100%',
                            borderRadius: '9999px',
                            background: 'linear-gradient(to right, rgb(168, 85, 247), rgb(236, 72, 153))',
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          {activeTab === 'memories' && user?.id && (
            <div
              role="tabpanel"
              id="memories-panel"
              aria-labelledby="memories-tab"
              className="w-full"
            >
              <MemoryManagement userId={user.id} />
            </div>
          )}
        </div>
      </main>
    </PageShell>
  )
}