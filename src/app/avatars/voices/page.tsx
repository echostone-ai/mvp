'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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

export default function AvatarVoicesPage() {
  const [user, setUser] = useState<any>(null)
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const router = useRouter()

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
            .eq('user_id', currentUser.id)
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

  const clearVoice = async (avatarId: string) => {
    if (!confirm('Are you sure you want to clear this avatar\'s voice? This action cannot be undone.')) {
      return
    }

    if (!user?.id) {
      setError('User not authenticated')
      return
    }

    setUpdating(avatarId)
    try {
      const { error } = await supabase
        .from('avatar_profiles')
        .update({ voice_id: null })
        .eq('id', avatarId)
        .eq('user_id', user.id)

      if (error) throw error

      // Update local state
      setAvatars(avatars.map(avatar => 
        avatar.id === avatarId ? { ...avatar, voice_id: null } : avatar
      ))
    } catch (err: any) {
      setError(`Failed to clear voice: ${err.message}`)
    } finally {
      setUpdating(null)
    }
  }

  if (loading) {
    return (
      <PageShell>
        <main className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading...</p>
        </main>
      </PageShell>
    )
  }

  if (!user) {
    return (
      <PageShell>
        <main className="min-h-screen flex flex-col items-center justify-center text-white p-4 text-center">
          <h1 className="text-2xl mb-4">Authentication Required</h1>
          <p className="mb-6">Please sign in to manage avatar voices.</p>
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
        <h1 className="text-3xl font-bold mb-4">Manage Avatar Voices</h1>
        <p className="text-gray-300 mb-8 text-center">
          Each avatar can have its own unique voice. Clear a voice to start fresh or assign a different voice.
        </p>

        {error && (
          <div className="bg-red-900/50 text-red-200 p-4 rounded-lg mb-6 w-full">
            {error}
          </div>
        )}

        <div className="w-full mb-6">
          <Link 
            href="/avatars" 
            className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors inline-flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to Avatars
          </Link>
        </div>

        {avatars.length === 0 ? (
          <div className="bg-purple-900/30 p-8 rounded-xl text-center">
            <p className="text-gray-300 text-lg">No avatars found. Create an avatar first.</p>
            <Link 
              href="/avatars" 
              className="mt-4 bg-purple-700 hover:bg-purple-600 text-white px-6 py-2 rounded-lg inline-block"
            >
              Create Avatar
            </Link>
          </div>
        ) : (
          <div className="w-full">
            <div className="bg-purple-900/30 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-purple-800/50">
                    <th className="py-3 px-4 text-left">Avatar Name</th>
                    <th className="py-3 px-4 text-left">Voice Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {avatars.map((avatar) => (
                    <tr key={avatar.id} className="border-t border-purple-700/30">
                      <td className="py-4 px-4">
                        <div className="font-medium text-lg">{avatar.name}</div>
                        {avatar.description && (
                          <div className="text-gray-400 text-sm mt-1">{avatar.description}</div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        {avatar.voice_id ? (
                          <span className="bg-green-700/50 text-green-200 px-3 py-1 rounded-full text-sm">
                            Voice Ready
                          </span>
                        ) : (
                          <span className="bg-yellow-700/50 text-yellow-200 px-3 py-1 rounded-full text-sm">
                            No Voice
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/avatars/${avatar.id}`}
                            className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                          >
                            Chat
                          </Link>
                          {avatar.voice_id && (
                            <button
                              onClick={() => clearVoice(avatar.id)}
                              disabled={updating === avatar.id}
                              className="bg-red-700 hover:bg-red-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                            >
                              {updating === avatar.id ? 'Clearing...' : 'Clear Voice'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-8 bg-blue-900/30 border border-blue-500/30 rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-2">How to Assign a Voice to an Avatar</h2>
              <ol className="list-decimal list-inside space-y-2 text-gray-200">
                <li>Click "Chat" to go to the avatar's chat page</li>
                <li>Record a voice sample for the avatar</li>
                <li>The voice will be automatically assigned to that avatar</li>
              </ol>
            </div>
          </div>
        )}
      </main>
    </PageShell>
  )
}