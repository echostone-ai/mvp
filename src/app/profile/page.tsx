'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { QUESTIONS } from '@/data/questions'
import { supabase } from '@/components/supabaseClient'
import VoiceRecorder from '@/components/VoiceRecorder'
import StoriesSection from '@/components/StoriesSection'
import AccountMenu from '@/components/AccountMenu'
import PageShell from '@/components/PageShell'

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
  const [activeTab, setActiveTab] = useState<'voice'|'stories'|'personality'>('voice')
  const [progress, setProgress] = useState<Record<string,Progress>>({})
  const [voiceId, setVoiceId] = useState<string|null>(null)
  const [error, setError] = useState<string|null>(null)
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
            const prog: Record<string,Progress> = {}
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
          <h1 className="text-4xl font-black text-white mb-4">
            Your Profile
          </h1>
          <div className="flex gap-3 mb-6">
            <button
              className={`px-6 py-3 text-xl font-bold rounded-lg cursor-pointer border-2 border-transparent transition-all duration-300 ${
                activeTab === 'voice' 
                  ? 'bg-primary text-white' 
                  : 'bg-purple-800 text-white hover:bg-purple-700'
              }`}
              onClick={() => setActiveTab('voice')}
            >
              Voice
            </button>
            <button
              className={`px-6 py-3 text-xl font-bold rounded-lg cursor-pointer border-2 border-transparent transition-all duration-300 ${
                activeTab === 'stories' 
                  ? 'bg-primary text-white' 
                  : 'bg-purple-800 text-white hover:bg-purple-700'
              }`}
              onClick={() => setActiveTab('stories')}
            >
              Your Stories
            </button>
            <button
              className={`px-6 py-3 text-xl font-bold rounded-lg cursor-pointer border-2 border-transparent transition-all duration-300 ${
                activeTab === 'personality' 
                  ? 'bg-primary text-white' 
                  : 'bg-purple-800 text-white hover:bg-purple-700'
              }`}
              onClick={() => setActiveTab('personality')}
            >
              Personality
            </button>
          </div>
        </div>

        <div className="max-w-5xl w-[94vw] mx-auto mb-12">
          {error && (
            <div className="text-red-400 bg-purple-900/50 px-6 py-4 rounded-xl mb-5 text-lg text-center font-medium">
              {error}
            </div>
          )}

          {activeTab === 'voice' && (
            <VoiceRecorder
              userName={userName}
              onVoiceUploaded={async (voiceId) => {
                setVoiceId(voiceId)
                if (user?.id) {
                  await supabase.from('profiles').update({ voice_id: voiceId }).eq('user_id', user.id)
                }
              }}
            />
          )}

          {activeTab === 'stories' && (
            <StoriesSection userId={user?.id} />
          )}

          {activeTab === 'personality' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-7 max-w-5xl w-full">
              {Object.entries(QUESTIONS || {}).map(([section, qs]) => {
                const prog = progress[section] || { total: qs.length, answered: 0, isComplete: false }
                return (
                  <Link key={section} href={`/profile/edit/${section}`} className="no-underline text-inherit">
                    <div className={`personality-block p-5 rounded-2xl shadow-lg transition-all duration-300 text-left min-h-24 relative flex flex-col justify-start ${
                      prog.isComplete 
                        ? 'bg-purple-800/95 shadow-green-400/20 shadow-xl opacity-100' 
                        : 'bg-purple-900/75 shadow-black/30 opacity-90'
                    }`}>
                      <h2 className="m-0 text-xl font-semibold text-white capitalize mb-2 leading-tight">
                        {section.replace(/_/g,' ')}
                      </h2>
                      <p className="m-0 mb-1 text-base text-purple-200">
                        {prog.answered} of {prog.total} answered
                      </p>
                      {prog.answered > 0 && prog.answered < prog.total && (
                        <div className="text-xs text-blue-300 mt-1">
                          ✨ Some auto-filled from stories
                        </div>
                      )}
                      {prog.isComplete && (
                        <span className="text-green-400 text-2xl absolute top-4 right-4">✓</span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </PageShell>
  )
}