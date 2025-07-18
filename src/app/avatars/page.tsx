'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/components/supabaseClient'
import Link from 'next/link'
import PageShell from '@/components/PageShell'

interface Avatar {
  id: string
  name: string
  description: string
  voice_id: string | null
  profile_data: any
  created_at: string
}

export default function AvatarsPage() {
  const [user, setUser] = useState<any>(null)
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newAvatar, setNewAvatar] = useState({
    name: '',
    description: ''
  })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    async function loadData() {
      // Load current user
      const { data: session } = await supabase.auth.getSession()
      const currentUser = session.session?.user ?? null
      setUser(currentUser)

      // Load avatars
      if (currentUser) {
        try {
          const { data, error } = await supabase
            .from('avatar_profiles')
            .select('*')
            .order('created_at', { ascending: false })

          if (error) throw error
          setAvatars(data || [])
        } catch (err: any) {
          setError(`Failed to load avatars: ${err.message}`)
        }
      }

      setLoading(false)
    }

    loadData()
  }, [])

  const handleCreateAvatar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAvatar.name.trim()) {
      setError('Avatar name is required')
      return
    }

    setCreating(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('avatar_profiles')
        .insert({
          name: newAvatar.name.trim(),
          description: newAvatar.description.trim(),
          profile_data: {}
        })
        .select()
        .single()

      if (error) throw error

      setAvatars([data, ...avatars])
      setNewAvatar({ name: '', description: '' })
    } catch (err: any) {
      setError(`Failed to create avatar: ${err.message}`)
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <PageShell>
        <main className="min-h-screen flex flex-col items-center justify-center text-white">
          <div className="loading-spinner"></div>
          <p className="mt-4 text-xl">Loading...</p>
        </main>
      </PageShell>
    )
  }

  if (!user) {
    return (
      <PageShell>
        <main className="min-h-screen flex flex-col items-center justify-center text-white p-4 text-center">
          <h1 className="text-2xl mb-4">Authentication Required</h1>
          <p className="mb-6">Please sign in to access avatars.</p>
          <Link href="/login" className="bg-purple-600 px-6 py-2 rounded-lg">
            Sign In
          </Link>
        </main>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <main className="min-h-screen text-white flex flex-col items-center p-6 max-w-5xl mx-auto">
        <div className="flex justify-between items-center w-full mb-8">
          <h1 className="text-3xl font-bold">Your Avatars</h1>
          <Link 
            href="/avatars/voices" 
            className="bg-indigo-700 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
            </svg>
            Manage Voices
          </Link>
        </div>

        {error && (
          <div className="bg-red-900/50 text-red-200 p-4 rounded-lg mb-6 w-full">
            {error}
          </div>
        )}

        <div className="bg-purple-900/50 p-8 rounded-xl w-full mb-10 shadow-lg border border-purple-500/30">
          <h2 className="text-2xl font-semibold mb-6 text-white">Create New Avatar</h2>
          <form onSubmit={handleCreateAvatar} className="space-y-6">
            <div>
              <label className="block mb-2 text-lg font-medium text-white">Name</label>
              <input
                type="text"
                value={newAvatar.name}
                onChange={(e) => setNewAvatar({ ...newAvatar, name: e.target.value })}
                className="w-full bg-purple-800/40 border-2 border-purple-400/50 rounded-lg px-5 py-3 text-white placeholder-purple-300/70 focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                placeholder="Enter avatar name"
              />
            </div>
            <div>
              <label className="block mb-2 text-lg font-medium text-white">Description</label>
              <textarea
                value={newAvatar.description}
                onChange={(e) => setNewAvatar({ ...newAvatar, description: e.target.value })}
                className="w-full bg-purple-800/40 border-2 border-purple-400/50 rounded-lg px-5 py-3 text-white placeholder-purple-300/70 focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                placeholder="Enter a brief description of this avatar"
                rows={3}
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Create Avatar'}
            </button>
          </form>
        </div>

        <h2 className="text-2xl font-semibold mb-6">Your Avatars</h2>

        {avatars.length === 0 ? (
          <div className="bg-purple-900/30 p-8 rounded-xl text-center">
            <p className="text-gray-300 text-lg">No avatars created yet. Create your first avatar above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
            {avatars.map((avatar) => (
              <Link
                key={avatar.id}
                href={`/avatars/${avatar.id}`}
                className="bg-purple-800/30 hover:bg-purple-700/40 border-2 border-purple-500/30 hover:border-purple-400/50 rounded-xl p-6 transition-all duration-300 shadow-lg hover:shadow-xl flex flex-col"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-2xl font-bold text-white">{avatar.name}</h3>
                  <div className="bg-purple-600/50 text-white text-xs font-bold uppercase px-3 py-1 rounded-full">
                    Avatar
                  </div>
                </div>
                
                {avatar.description && (
                  <p className="text-gray-200 mb-4 flex-grow">{avatar.description}</p>
                )}
                
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-purple-500/30">
                  <span className="text-sm text-gray-300">
                    Created: {new Date(avatar.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2">
                    {avatar.voice_id ? (
                      <span className="bg-green-700/50 text-green-200 px-3 py-1 rounded-full text-xs font-medium">
                        Voice Ready
                      </span>
                    ) : (
                      <span className="bg-yellow-700/50 text-yellow-200 px-3 py-1 rounded-full text-xs font-medium">
                        No Voice
                      </span>
                    )}
                    <span className="bg-blue-700/50 text-blue-200 px-3 py-1 rounded-full text-xs font-medium">
                      Chat Now
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </PageShell>
  )
}