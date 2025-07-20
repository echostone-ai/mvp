'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import PageShell from '@/components/PageShell'

export default function TestAvatarMemoriesPage() {
  const [user, setUser] = useState<any>(null)
  const [avatars, setAvatars] = useState<any[]>([])
  const [selectedAvatar, setSelectedAvatar] = useState<string>('')
  const [testResults, setTestResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function loadData() {
      const { data: session } = await supabase.auth.getSession()
      const currentUser = session.session?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        const { data: avatarData } = await supabase
          .from('avatar_profiles')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false })
        
        setAvatars(avatarData || [])
        if (avatarData && avatarData.length > 0) {
          setSelectedAvatar(avatarData[0].id)
        }
      }
    }
    loadData()
  }, [])

  const runTest = async () => {
    if (!user || !selectedAvatar) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/test-avatar-memories?userId=${user.id}&avatarId=${selectedAvatar}`)
      const results = await response.json()
      setTestResults(results)
    } catch (error) {
      console.error('Test failed:', error)
      setTestResults({ error: 'Test failed to run' })
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <PageShell>
        <main className="min-h-screen flex flex-col items-center justify-center text-white p-4">
          <h1 className="text-2xl mb-4">Please sign in to test avatar memories</h1>
        </main>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <main className="min-h-screen text-white p-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Avatar Memory System Test</h1>
        
        <div className="bg-purple-900/30 p-6 rounded-xl mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Configuration</h2>
          
          <div className="mb-4">
            <label className="block mb-2">Select Avatar to Test:</label>
            <select 
              value={selectedAvatar}
              onChange={(e) => setSelectedAvatar(e.target.value)}
              className="bg-purple-800/50 border border-purple-500 rounded px-3 py-2 text-white"
            >
              <option value="">Select an avatar...</option>
              {avatars.map(avatar => (
                <option key={avatar.id} value={avatar.id}>
                  {avatar.name}
                </option>
              ))}
            </select>
          </div>
          
          <button
            onClick={runTest}
            disabled={loading || !selectedAvatar}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Running Test...' : 'Run Avatar Memory Test'}
          </button>
        </div>

        {testResults && (
          <div className="bg-gray-900/50 p-6 rounded-xl">
            <h2 className="text-xl font-semibold mb-4">Test Results</h2>
            
            {testResults.error ? (
              <div className="text-red-400">
                <p>Error: {testResults.error}</p>
                {testResults.details && <p>Details: {testResults.details}</p>}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className={`p-4 rounded-lg ${testResults.tests.avatarTable.success ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                    <h3 className="font-semibold">Avatar Table</h3>
                    <p>Status: {testResults.tests.avatarTable.success ? '✅ Working' : '❌ Failed'}</p>
                    <p>Avatars: {testResults.tests.avatarTable.data}</p>
                    {testResults.tests.avatarTable.error && (
                      <p className="text-red-400 text-sm">Error: {testResults.tests.avatarTable.error}</p>
                    )}
                  </div>
                  
                  <div className={`p-4 rounded-lg ${testResults.tests.memoryTable.success ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                    <h3 className="font-semibold">Memory Table</h3>
                    <p>Status: {testResults.tests.memoryTable.success ? '✅ Working' : '❌ Failed'}</p>
                    <p>Total Memories: {testResults.tests.memoryTable.totalMemories}</p>
                    <p>Avatar-Specific: {testResults.tests.memoryTable.avatarSpecificMemories}</p>
                    <p>Has Avatar Column: {testResults.tests.memoryTable.hasAvatarColumn}</p>
                    {testResults.tests.memoryTable.error && (
                      <p className="text-red-400 text-sm">Error: {testResults.tests.memoryTable.error}</p>
                    )}
                  </div>
                  
                  <div className={`p-4 rounded-lg ${testResults.tests.vectorFunction.success ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                    <h3 className="font-semibold">Vector Function</h3>
                    <p>Status: {testResults.tests.vectorFunction.success ? '✅ Working' : '❌ Failed'}</p>
                    {testResults.tests.vectorFunction.error && (
                      <p className="text-red-400 text-sm">Error: {testResults.tests.vectorFunction.error}</p>
                    )}
                  </div>
                </div>
                
                <div className={`p-4 rounded-lg ${testResults.summary.avatarSystemReady ? 'bg-green-900/30' : 'bg-yellow-900/30'}`}>
                  <h3 className="font-semibold text-lg">Overall Status</h3>
                  <p className="text-lg">
                    {testResults.summary.avatarSystemReady ? '✅ Avatar System Ready' : '⚠️ Issues Found'}
                  </p>
                  {testResults.summary.issues.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium">Issues to fix:</p>
                      <ul className="list-disc list-inside">
                        {testResults.summary.issues.map((issue: string, index: number) => (
                          <li key={index} className="text-yellow-200">{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <details className="mt-4">
              <summary className="cursor-pointer text-gray-400">Raw Test Data</summary>
              <pre className="mt-2 p-4 bg-black/50 rounded text-xs overflow-auto">
                {JSON.stringify(testResults, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </main>
    </PageShell>
  )
}