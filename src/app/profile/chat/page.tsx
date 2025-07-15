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
    <div className="min-h-screen w-screen relative">
      <div className="fixed top-9 right-9 z-50">
        <AccountMenu />
      </div>

      {loading ? (
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-center text-xl text-white">Loading...</p>
        </div>
      ) : !user ? (
        <main className="min-h-screen flex flex-col items-center justify-center text-white p-4 text-center">
          <img
            src="/echostone_logo.png"
            alt="EchoStone Logo"
            className="logo-pulse w-36 mb-6 select-none"
          />
          <div className="max-w-sm w-full bg-white/10 rounded-2xl p-8 shadow-2xl border border-purple-500/30">
            <p className="text-xl mb-6">
              Please sign up or log in to chat with your EchoStone.
            </p>
            <div className="flex justify-center gap-4">
              <a 
                href="/login" 
                className="inline-block px-8 py-4 bg-primary text-white rounded-xl font-bold no-underline cursor-pointer shadow-lg hover:bg-purple-600 transition-colors"
              >
                Log In
              </a>
              <a 
                href="/signup" 
                className="inline-block px-8 py-4 bg-purple-500 text-white rounded-xl font-bold no-underline cursor-pointer shadow-lg hover:bg-purple-600 transition-colors"
              >
                Sign Up
              </a>
            </div>
          </div>
        </main>
      ) : error ? (
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-center text-xl text-red-400">{error}</p>
        </div>
      ) : !profileData ? (
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-center text-xl text-white">No profile data found.</p>
        </div>
      ) : (
        <>
          <div className="text-center my-4 pt-20">
            <button 
              onClick={refreshProfileData} 
              className="inline-block px-8 py-4 bg-primary text-white rounded-xl font-bold cursor-pointer shadow-lg hover:bg-purple-600 transition-colors min-w-48"
            >
              Refresh Profile Data
            </button>
          </div>

          <ChatInterface profileData={profileData} voiceId={voiceId} />
        </>
      )}
    </div>
  )
}