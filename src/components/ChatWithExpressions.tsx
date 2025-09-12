/**
 * Generic chat component that works with any avatar and their expressions
 * Can be used for user-generated avatars or demo avatars
 */

'use client'

import { useState } from 'react'
import { useStreamingWithExpressions } from '@/lib/hooks/useStreamingWithExpressions'

interface ChatWithExpressionsProps {
  avatarId: string
  avatarName?: string
  placeholder?: string
  className?: string
}

export default function ChatWithExpressions({ 
  avatarId, 
  avatarName = 'Avatar',
  placeholder = 'Ask me anything...',
  className = ''
}: ChatWithExpressionsProps) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  
  const { processStreamingResponse, stopAudio } = useStreamingWithExpressions({
    avatarId,
    onTextUpdate: (text) => setAnswer(text),
    onComplete: (fullText) => {
      console.log('🎵 Chat response completed:', fullText.length, 'characters')
      setLoading(false)
    }
  })

  const askQuestion = async (text: string) => {
    if (!text.trim()) return
    
    stopAudio()
    setLoading(true)
    setAnswer('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatarSlug: avatarId,
          message: text,
          stream: true,
          storeMemory: true
        })
      })

      if (res.ok && res.body) {
        await processStreamingResponse(res, text)
      } else {
        // Fallback for non-streaming
        const data = await res.json().catch(() => ({}))
        const reply = data.answer || '😕 No answer.'
        setAnswer(reply)
        setLoading(false)
      }
    } catch (err) {
      console.error('Chat error:', err)
      setAnswer('Sorry, there was an error processing your request.')
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    askQuestion(question)
  }

  return (
    <div className={`chat-with-expressions ${className}`}>
      <div className="chat-header">
        <h2>Chat with {avatarName}</h2>
        <p>Ask questions and hear natural responses with expressions!</p>
      </div>

      <form onSubmit={handleSubmit} className="chat-form">
        <input
          type="text"
          placeholder={placeholder}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          disabled={loading}
          className="chat-input"
        />
        <button type="submit" disabled={loading || !question.trim()} className="chat-submit">
          {loading ? '...' : '→'}
        </button>
      </form>

      {answer && (
        <div className="chat-response">
          <h3>{avatarName} says:</h3>
          <p>{answer}</p>
          {loading && <div className="loading-indicator">🎵 Speaking...</div>}
        </div>
      )}
    </div>
  )
}