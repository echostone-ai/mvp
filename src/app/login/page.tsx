'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import './login.css'

export default function LoginPage() {
  const supabase = createClientComponentClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    const { error } = await supabase.auth.signInWithOtp({ email })

    if (error) {
      setErrorMsg(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <main className="login-container">
      <div className="login-card">
        <h1>Sign In</h1>
        {sent ? (
          <p className="login-info">
            ✔️ Magic link sent to <strong>{email}</strong>.<br/>
            Check your inbox and click it to continue.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <button type="submit">Send Magic Link</button>
          </form>
        )}
        {errorMsg && <p className="login-error">{errorMsg}</p>}
        <p>
          Don’t have an account?{' '}
          <a onClick={() => router.push('/sign-up')}>Sign up</a>
        </p>
      </div>
    </main>
  )
}
