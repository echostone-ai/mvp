'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/components/supabaseClient'
import ChatInterface from '@/components/ChatInterface'
import AccountMenu from '@/components/AccountMenu'

const buttonStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.9em 2em',
  backgroundColor: 'var(--color-primary)',
  color: '#fff',
  borderRadius: 12,
  fontWeight: 700,
  textDecoration: 'none',
  cursor: 'pointer',
  boxShadow: '0 4px 20px #6a00ffaa',
  transition: 'background-color 0.3s ease',
  userSelect: 'none',
}

export default function ProfileChat() {
  const [user, setUser] = useState<any>(null)
  const [profileData, setProfileData] = useState<any>(null)
  const [voiceId, setVoiceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadSignal, setReloadSignal] = useState<number>(Date.now())

  async function loadUserData() {
    try {
      setLoading(true)
      const { data: session } = await supabase.auth.getSession()
      const currentUser = session.session?.user ?? null
      if (!currentUser) {
        setUser(null)
        setLoading(false)
        return
      }
      setUser(currentUser)

      const { data, error } = await supabase
        .from('profiles')
        .select('profile_data, voice_id')
        .eq('user_id', currentUser.id)
        .single()

      if (error) {
        setError('Failed to load profile data: ' + error.message)
        setLoading(false)
        return
      }

      setProfileData(data.profile_data)
      setVoiceId(data.voice_id)
      setLoading(false)
      setError(null)
    } catch (err: any) {
      setError('Unexpected error: ' + (err.message || err))
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUserData()
  }, [reloadSignal])

  const refreshProfileData = () => {
    setReloadSignal(Date.now())
  }

  return (
    <>
      <div style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: '1.2rem 2.2rem 0 2.2rem',
        minHeight: 0,
        background: 'transparent',
        boxSizing: 'border-box'
      }}>
        <AccountMenu />
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', marginTop: 40 }}>Loading...</p>
      ) : !user ? (
        <main
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            padding: '1em',
            textAlign: 'center',
          }}
        >
          <img
            src="/echostone_logo.png"
            alt="EchoStone Logo"
            className="logo-pulse"
            style={{ width: 140, marginBottom: 24, userSelect: 'none' }}
          />
          <div
            style={{
              maxWidth: 360,
              width: '90%',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 16,
              padding: '2em',
              boxShadow: '0 0 24px rgba(106, 0, 255, 0.7)',
            }}
          >
            <p style={{ fontSize: '1.2em', marginBottom: '1.5em' }}>
              Please sign up or log in to chat with your EchoStone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <a href="/login" style={buttonStyle}>
                Log In
              </a>
              <a href="/signup" style={{ ...buttonStyle, backgroundColor: '#9147ff' }}>
                Sign Up
              </a>
            </div>
          </div>
        </main>
      ) : error ? (
        <p style={{ textAlign: 'center', marginTop: 40, color: 'red' }}>
          {error}
        </p>
      ) : !profileData ? (
        <p style={{ textAlign: 'center', marginTop: 40 }}>
          No profile data found.
        </p>
      ) : (
        <>
          <div style={{ textAlign: 'center', margin: '1em 0' }}>
            <button onClick={refreshProfileData} style={{ ...buttonStyle, minWidth: 180 }}>
              Refresh Profile Data
            </button>
          </div>

          <ChatInterface profileData={profileData} voiceId={voiceId} />
        </>
      )}
    </>
  )
}