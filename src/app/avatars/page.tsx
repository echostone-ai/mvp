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
      <style jsx global>{`
        .avatar-card-container {
          perspective: 1000px;
        }
        
        .avatar-card {
          backface-visibility: hidden;
          will-change: transform;
        }
        
        .avatar-card:hover {
          box-shadow: 0 15px 30px rgba(79, 70, 229, 0.2);
        }
        
        @media (max-width: 640px) {
          .avatar-card-container {
            perspective: none;
          }
        }
      `}</style>
      <main className="min-h-screen text-white flex flex-col items-center p-6 max-w-6xl mx-auto">
        <div className="flex justify-between items-center w-full mb-8">
          <h1 className="text-3xl font-bold">Your Avatars</h1>
          <div className="flex gap-3">
            <Link 
              href="/test-memory-isolation" 
              className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Test Memory
            </Link>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {avatars.map((avatar) => (
              <div key={avatar.id} className="avatar-card-container">
                <Link
                  href={`/avatars/${avatar.id}`}
                  className="avatar-card bg-gradient-to-br from-purple-900/80 to-indigo-900/80 hover:from-purple-800/80 hover:to-indigo-800/80 border-2 border-purple-500/40 hover:border-purple-400/60 rounded-xl overflow-hidden transition-all duration-300 shadow-lg hover:shadow-xl flex flex-col h-full transform hover:-translate-y-1"
                >
                  {/* Avatar Header with Gradient Accent */}
                  <div className="h-2 bg-gradient-to-r from-purple-500 to-indigo-500"></div>
                  
                  {/* Avatar Icon and Name */}
                  <div className="p-6 pb-4">
                    <div className="flex items-start">
                      <div className="bg-gradient-to-br from-purple-600 to-indigo-600 p-3 rounded-lg shadow-md mr-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white mb-1">{avatar.name}</h3>
                        <div className="flex items-center">
                          {avatar.voice_id ? (
                            <span className="bg-green-700/60 text-green-200 px-2 py-0.5 rounded-full text-xs font-medium flex items-center">
                              <span className="w-2 h-2 bg-green-400 rounded-full mr-1"></span>
                              Voice Ready
                            </span>
                          ) : (
                            <span className="bg-yellow-700/60 text-yellow-200 px-2 py-0.5 rounded-full text-xs font-medium flex items-center">
                              <span className="w-2 h-2 bg-yellow-400 rounded-full mr-1"></span>
                              No Voice
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Avatar Description */}
                  <div className="px-6 pb-4 flex-grow">
                    {avatar.description ? (
                      <p className="text-gray-200">{avatar.description}</p>
                    ) : (
                      <p className="text-gray-400 italic">No description provided</p>
                    )}
                  </div>
                  
                  {/* Avatar Footer */}
                  <div className="px-6 py-4 bg-purple-950/50 border-t border-purple-500/30 mt-auto">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        Created: {new Date(avatar.created_at).toLocaleDateString()}
                      </span>
                      <span className="bg-blue-700/60 text-blue-200 px-3 py-1 rounded-full text-xs font-medium flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Chat Now
                      </span>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </PageShell>
  )
}