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
        <h1 className="text-3xl font-bold mb-8">Your Avatars</h1>

        {error && (
          <div className="bg-red-900/50 text-red-200 p-4 rounded-lg mb-6 w-full">
            {error}
          </div>
        )}

        <div className="bg-purple-900/30 p-6 rounded-xl w-full mb-10">
          <h2 className="text-xl font-semibold mb-4">Create New Avatar</h2>
          <form onSubmit={handleCreateAvatar} className="space-y-4">
            <div>
              <label className="block mb-1">Name</label>
              <input
                type="text"
                value={newAvatar.name}
                onChange={(e) => setNewAvatar({ ...newAvatar, name: e.target.value })}
                className="w-full bg-purple-900/50 border border-purple-500 rounded-lg px-4 py-2"
                placeholder="Avatar name"
              />
            </div>
            <div>
              <label className="block mb-1">Description</label>
              <textarea
                value={newAvatar.description}
                onChange={(e) => setNewAvatar({ ...newAvatar, description: e.target.value })}
                className="w-full bg-purple-900/50 border border-purple-500 rounded-lg px-4 py-2"
                placeholder="Brief description"
                rows={3}
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg"
            >
              {creating ? 'Creating...' : 'Create Avatar'}
            </button>
          </form>
        </div>

        <h2 className="text-2xl font-semibold mb-6">Your Avatars</h2>

        {avatars.length === 0 ? (
          <p className="text-gray-400">No avatars created yet. Create your first avatar above.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            {avatars.map((avatar) => (
              <Link
                key={avatar.id}
                href={`/avatars/${avatar.id}`}
                className="bg-purple-900/40 hover:bg-purple-900/60 border border-purple-500/50 rounded-xl p-6 transition-all"
              >
                <h3 className="text-xl font-semibold mb-2">{avatar.name}</h3>
                {avatar.description && (
                  <p className="text-gray-300 mb-4">{avatar.description}</p>
                )}
                <div className="flex items-center text-sm text-gray-400">
                  <span>Created: {new Date(avatar.created_at).toLocaleDateString()}</span>
                  {avatar.voice_id && (
                    <span className="ml-4 bg-green-900/50 text-green-300 px-2 py-1 rounded">
                      Has Voice
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </PageShell>
  )
}