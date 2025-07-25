'use client'

import { useState } from 'react'

export default function TestSharingPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testCreateShare = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/avatar-sharing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'create-share',
          avatarId: 'test-avatar-id',
          ownerEmail: 'owner@test.com',
          shareWithEmail: 'friend@test.com',
          permissions: ['chat', 'viewMemories']
        })
      })

      const data = await response.json()
      setResult({ type: 'create', data, status: response.status })
    } catch (error) {
      setResult({ type: 'create', error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const testGetSharedAvatar = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/avatar-sharing?shareToken=test-token-123')
      const data = await response.json()
      setResult({ type: 'get', data, status: response.status })
    } catch (error) {
      setResult({ type: 'get', error: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Avatar Sharing Test</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={testCreateShare} 
          disabled={loading}
          style={{ marginRight: '10px', padding: '10px 20px' }}
        >
          Test Create Share
        </button>
        
        <button 
          onClick={testGetSharedAvatar} 
          disabled={loading}
          style={{ padding: '10px 20px' }}
        >
          Test Get Shared Avatar
        </button>
      </div>

      {loading && <p>Loading...</p>}

      {result && (
        <div style={{ marginTop: '20px' }}>
          <h3>Result ({result.type}):</h3>
          <pre style={{ 
            background: '#f5f5f5', 
            padding: '15px', 
            borderRadius: '5px',
            overflow: 'auto',
            fontSize: '12px'
          }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}