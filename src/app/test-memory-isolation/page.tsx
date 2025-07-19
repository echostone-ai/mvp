'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/components/supabaseClient'
import PageShell from '@/components/PageShell'

export default function TestMemoryIsolationPage() {
  const [user, setUser] = useState<any>(null)
  const [avatars, setAvatars] = useState<any[]>([])
  const [avatar1, setAvatar1] = useState<string>('')
  const [avatar2, setAvatar2] = useState<string>('')
  const [testMessage, setTestMessage] = useState('I love chocolate ice cream and I have a cat named Whiskers')
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
        if (avatarData && avatarData.length >= 2) {
          setAvatar1(avatarData[0].id)
          setAvatar2(avatarData[1].id)
        }
      }
    }
    loadData()
  }, [])

  const runIsolationTest = async () => {
    if (!user || !avatar1 || !avatar2) return
    
    setLoading(true)
    try {
      const response = await fetch('/api/test-memory-isolation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          avatar1Id: avatar1,
          avatar2Id: avatar2,
          testMessage
        })
      })
      const results = await response.json()
      setTestResults(results)
    } catch (error) {
      console.error('Test failed:', error)
      setTestResults({ error: 'Test failed to run' })
    } finally {
      setLoading(false)
    }
  }

  const cleanupTestMemory = async () => {
    if (!testResults?.testMemoryId) return
    
    try {
      await supabase
        .from('memory_fragments')
        .delete()
        .eq('id', testResults.testMemoryId)
      
      setTestResults(null)
      alert('Test memory cleaned up')
    } catch (error) {
      console.error('Cleanup failed:', error)
    }
  }

  if (!user) {
    return (
      <PageShell>
        <main className="min-h-screen flex flex-col items-center justify-center text-white p-4">
          <h1 className="text-2xl mb-4">Please sign in to test memory isolation</h1>
        </main>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <main className="min-h-screen text-white p-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Memory Isolation Test</h1>
        
        <div className="bg-purple-900/30 p-6 rounded-xl mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Configuration</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block mb-2">Avatar 1 (will receive memory):</label>
              <select 
                value={avatar1}
                onChange={(e) => setAvatar1(e.target.value)}
                className="w-full bg-purple-800/50 border border-purple-500 rounded px-3 py-2 text-white"
              >
                <option value="">Select avatar 1...</option>
                {avatars.map(avatar => (
                  <option key={avatar.id} value={avatar.id}>
                    {avatar.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block mb-2">Avatar 2 (should NOT see memory):</label>
              <select 
                value={avatar2}
                onChange={(e) => setAvatar2(e.target.value)}
                className="w-full bg-purple-800/50 border border-purple-500 rounded px-3 py-2 text-white"
              >
                <option value="">Select avatar 2...</option>
                {avatars.map(avatar => (
                  <option key={avatar.id} value={avatar.id}>
                    {avatar.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block mb-2">Test Message:</label>
            <input
              type="text"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              className="w-full bg-purple-800/50 border border-purple-500 rounded px-3 py-2 text-white"
              placeholder="Enter a test message to store as memory"
            />
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={runIsolationTest}
              disabled={loading || !avatar1 || !avatar2 || avatar1 === avatar2}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Running Test...' : 'Test Memory Isolation'}
            </button>
            
            {testResults?.testMemoryId && (
              <button
                onClick={cleanupTestMemory}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg"
              >
                Clean Up Test Memory
              </button>
            )}
          </div>
          
          {avatar1 === avatar2 && avatar1 && (
            <p className="text-yellow-400 mt-2">Please select two different avatars for the test.</p>
          )}
        </div>

        {testResults && (
          <div className="bg-gray-900/50 p-6 rounded-xl">
            <h2 className="text-xl font-semibold mb-4">Test Results</h2>
            
            {testResults.error ? (
              <div className="text-red-400">
                <p>Error: {testResults.error}</p>
                {testResults.details && <p>Details: {JSON.stringify(testResults.details)}</p>}
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${testResults.isolation.working ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                  <h3 className="font-semibold text-lg">Isolation Status</h3>
                  <p className="text-lg">{testResults.isolation.message}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-900/30 rounded-lg">
                    <h3 className="font-semibold">Avatar 1 Memories</h3>
                    <p>Total: {testResults.results.avatar1Memories.count}</p>
                    <p>Has Test Memory: {testResults.results.avatar1Memories.hasTestMemory ? '✅ Yes' : '❌ No'}</p>
                    {testResults.results.avatar1Memories.error && (
                      <p className="text-red-400 text-sm">Error: {testResults.results.avatar1Memories.error}</p>
                    )}
                  </div>
                  
                  <div className="p-4 bg-purple-900/30 rounded-lg">
                    <h3 className="font-semibold">Avatar 2 Memories</h3>
                    <p>Total: {testResults.results.avatar2Memories.count}</p>
                    <p>Has Test Memory: {testResults.results.avatar2Memories.hasTestMemory ? '❌ Yes (BAD!)' : '✅ No (GOOD!)'}</p>
                    {testResults.results.avatar2Memories.error && (
                      <p className="text-red-400 text-sm">Error: {testResults.results.avatar2Memories.error}</p>
                    )}
                  </div>
                  
                  <div className="p-4 bg-gray-700/30 rounded-lg">
                    <h3 className="font-semibold">All User Memories</h3>
                    <p>Total: {testResults.results.allMemories.count}</p>
                    <p>Has Test Memory: {testResults.results.allMemories.hasTestMemory ? '✅ Yes' : '❌ No'}</p>
                    {testResults.results.allMemories.error && (
                      <p className="text-red-400 text-sm">Error: {testResults.results.allMemories.error}</p>
                    )}
                  </div>
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
        
        <div className="mt-8 bg-blue-900/30 p-6 rounded-xl">
          <h2 className="text-xl font-semibold mb-4">How This Test Works</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>Creates a test memory and assigns it to Avatar 1</li>
            <li>Checks if Avatar 1 can see the memory (should be YES)</li>
            <li>Checks if Avatar 2 can see the memory (should be NO)</li>
            <li>Verifies the memory exists in your overall memory store</li>
          </ol>
          <p className="mt-4 text-gray-300">
            If isolation is working correctly, Avatar 1 will have the memory but Avatar 2 won't see it.
          </p>
        </div>
      </main>
    </PageShell>
  )
}