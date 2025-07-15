'use client'

import { useState } from 'react'
import { supabase } from '@/components/supabaseClient'
import PageShell from '@/components/PageShell'

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
    <PageShell>
      <form
        onSubmit={handleLogin}
        className="backdrop-blur-2xl bg-purple-900/85 rounded-[2.3em] p-12 shadow-2xl border border-purple-500/30 flex flex-col items-center max-w-md w-full mx-4"
      >
        <h1 className="text-4xl font-bold mb-3 tracking-wide text-white text-center">
          Sign In to EchoStone
        </h1>
        <label 
          htmlFor="email" 
          className="font-medium text-purple-200 text-lg mb-3 tracking-wide text-left self-start"
        >
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full mb-5 px-4 py-4 rounded-2xl border border-purple-500/30 bg-purple-950 text-purple-100 text-lg shadow-lg outline-none focus:border-purple-400 transition-colors"
        />
        <button
          type="submit"
          className="w-full py-4 bg-gradient-to-r from-purple-600 to-purple-500 text-white border-none rounded-2xl font-bold text-lg cursor-pointer shadow-lg mt-2 hover:from-purple-500 hover:to-purple-600 transition-all"
        >
          Send Magic Link
        </button>
        {message && (
          <div className="text-green-400 mt-5 text-center font-medium">
            {message}
          </div>
        )}
        {error && (
          <div className="text-red-400 mt-5 text-center font-medium">
            {error}
          </div>
        )}
      </form>
    </PageShell>
  )
}