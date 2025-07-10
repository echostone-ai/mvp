'use client'

import { useState } from 'react'
import { supabase } from '@/components/supabaseClient'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setError('')
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) {
      setError(error.message)
    } else {
      setMessage('Check your email for the magic link!')
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        width: '100vw',
        background: 'radial-gradient(ellipse at 50% 15%, #201744 0%, #18122e 80%, #0a001a 100%)',
        color: '#e0d4f7',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, Arial, sans-serif',
        padding: 0,
        margin: 0,
        overflow: 'hidden'
      }}
    >
      <form
        onSubmit={handleLogin}
        style={{
          backdropFilter: 'blur(24px)',
          background: 'rgba(34, 24, 56, 0.85)',
          borderRadius: '2.3em',
          padding: '3em 2.4em 2.6em 2.4em',
          boxShadow: '0 8px 44px #6a00ff33, 0 0 0 1.5px #5a008855',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 430,
          width: '100%',
        }}
      >
        <h1
          style={{
            fontSize: '2.45rem',
            fontWeight: 700,
            marginBottom: '0.35em',
            letterSpacing: '0.01em',
            color: '#fff',
            textShadow: '0 2px 18px #6a00ff33',
            textAlign: 'center'
          }}
        >
          Sign In to EchoStone
        </h1>
        <label htmlFor="email" style={{
          fontWeight: 500,
          color: '#b7b0d8',
          fontSize: '1.1em',
          marginBottom: 10,
          letterSpacing: '0.02em',
          textAlign: 'left',
          alignSelf: 'flex-start'
        }}>
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{
            width: '100%',
            marginBottom: 18,
            padding: '0.88em',
            borderRadius: 14,
            border: '1.5px solid #5a008855',
            background: '#1b1231',
            color: '#e0d4f7',
            fontSize: '1.09em',
            boxShadow: '0 1px 5px #6a00ff18',
            outline: 'none',
            marginTop: 2
          }}
        />
        <button
          type="submit"
          style={{
            width: '100%',
            padding: '1.06em',
            background: 'linear-gradient(90deg, #6a00ff 65%, #9147ff 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: 14,
            fontWeight: 700,
            fontSize: '1.13em',
            cursor: 'pointer',
            boxShadow: '0 4px 20px #6a00ff22',
            marginTop: 8,
            transition: 'background 0.3s'
          }}
        >
          Send Magic Link
        </button>
        {message && <div style={{ color: '#71ffb3', marginTop: 18, textAlign: 'center' }}>{message}</div>}
        {error && <div style={{ color: 'salmon', marginTop: 18, textAlign: 'center' }}>{error}</div>}
      </form>
    </main>
  )
}