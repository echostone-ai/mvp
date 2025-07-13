'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { QUESTIONS } from '@/data/questions'
import { supabase } from '@/components/supabaseClient'
import VoiceRecorder from '@/components/VoiceRecorder'

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
  const [activeTab, setActiveTab] = useState<'voice'|'personality'>('voice')
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

  // Responsive, styled!
  return (
    <main
      className="profile-main"
      style={{
        background: 'linear-gradient(120deg, #232946 0%, #413076 50%, #af7ea8 100%)',
        minHeight: '100vh'
      }}
    >
      <div className="profile-header">
        <Image className="profile-logo logo-pulse" src="/echostone_logo.png" width={160} height={160} alt="EchoStone Logo" />
        <h1
          className="profile-title"
          style={{
            fontSize: '2.5rem',
            fontWeight: '900',
            color: '#fff',
            marginBottom: '1rem'
          }}
        >
          Your Profile
        </h1>
        <div className="profile-tabs">
          <button
            className={`profile-tab ${activeTab==='voice' ? 'active' : ''}`}
            onClick={() => setActiveTab('voice')}
            style={{ fontSize: '1.25rem', fontWeight: '700', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer', border: '2px solid transparent', transition: 'all 0.3s ease' }}
          >
            <span>Voice</span>
          </button>
          <button
            className={`profile-tab ${activeTab==='personality' ? 'active' : ''}`}
            onClick={() => setActiveTab('personality')}
            style={{ fontSize: '1.25rem', fontWeight: '700', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer', border: '2px solid transparent', transition: 'all 0.3s ease' }}
          >
            <span>Personality</span>
          </button>
        </div>
      </div>

      <div className="profile-content">
        {error && <div className="profile-error">{error}</div>}

        {activeTab === 'voice' && (
          <VoiceRecorder
            userName={userName}
            onVoiceUploaded={async (voiceId) => {
              setVoiceId(voiceId)
              if (user?.id) {
                await supabase.from('profiles').update({ voice_id: voiceId }).eq('user_id', user.id)
              }
            }}
            instructionsStyle={{
              color: '#fff',
              textShadow: '0 2px 8px rgba(0,0,0,0.45), 0 1px 0 #232946',
              filter: 'brightness(1.18)',
              marginBottom: 8
            }}
          />
        )}

        {activeTab === 'personality' && (
          <div className="profile-sections">
            {Object.entries(QUESTIONS || {}).map(([section, qs]) => {
              const prog = progress[section] || { total: qs.length, answered: 0, isComplete: false }
              return (
                <Link key={section} href={`/profile/edit/${section}`} className="profile-section-link">
                  <div className={`profile-section-card${prog.isComplete ? ' complete' : ''}`} style={{ padding: '1.25rem 1.5rem', borderRadius: '10px', boxShadow: prog.isComplete ? '0 0 10px 2px #4caf50' : '0 2px 8px rgba(0,0,0,0.1)', backgroundColor: prog.isComplete ? '#e6f4ea' : '#fff', transition: 'background-color 0.3s ease, box-shadow 0.3s ease' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: prog.isComplete ? '#2e7d32' : '#333', marginBottom: '0.5rem' }}>{section.replace(/_/g,' ')}</h2>
                    <p style={{ fontSize: '1.1rem', fontWeight: '600', color: prog.isComplete ? '#388e3c' : '#555' }}>{prog.answered} of {prog.total} answered</p>
                    {prog.isComplete && <span className="profile-section-check" style={{ color: '#4caf50', fontWeight: '900', fontSize: '1.5rem', marginLeft: '0.5rem' }}>✓</span>}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}