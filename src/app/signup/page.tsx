'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import PageShell from '@/components/PageShell'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setError('')
    setLoading(true)

    try {
      // Get current origin for redirect URL
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.echostone.ai'
      
      // Sign up the user with magic link
      const { data, error: signupError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: origin,
          data: {
            full_name: name,
          }
        }
      })

      if (signupError) {
        setError(signupError.message)
        setLoading(false)
        return
      }

      // For OTP signup, we don't get a user immediately
      // The profile will be created when they confirm their email
      setMessage('Check your email for the confirmation link!')
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageShell>
      <main className="min-h-screen flex flex-col items-center justify-center text-white p-4 text-center">
        <img
          src="/echostone_logo.png"
          alt="EchoStone Logo"
          className="logo-pulse w-36 mb-8 select-none"
        />
        
        <div className="auth-required-card">
          <h1 className="auth-required-title">
            Join EchoStone
          </h1>
          <p className="auth-required-subtitle">
            Create your account to start building your digital voice and personality profile.
          </p>
          
          <form onSubmit={handleSignup} className="w-full">
            <div className="mb-6 text-left">
              <label 
                htmlFor="name" 
                className="block text-white font-semibold text-lg mb-3"
              >
                Full Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="auth-input w-full px-5 py-4 rounded-2xl border-2 border-purple-500/30 bg-purple-950/60 text-white text-lg shadow-lg outline-none focus:border-purple-400 focus:shadow-purple-400/20 focus:shadow-xl transition-all font-sans"
                placeholder="Enter your full name"
              />
            </div>

            <div className="mb-6 text-left">
              <label 
                htmlFor="email" 
                className="block text-white font-semibold text-lg mb-3"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="auth-input w-full px-5 py-4 rounded-2xl border-2 border-purple-500/30 bg-purple-950/60 text-white text-lg shadow-lg outline-none focus:border-purple-400 focus:shadow-purple-400/20 focus:shadow-xl transition-all font-sans"
                placeholder="Enter your email address"
              />
            </div>
            
            <button
              type="submit"
              disabled={!email.trim() || !name.trim() || loading}
              className="auth-submit-btn w-full"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
          
          {message && (
            <div className="auth-message success">
              {message}
            </div>
          )}
          {error && (
            <div className="auth-message error">
              {error}
            </div>
          )}
          
          <div className="auth-required-actions">
            <a href="/login" className="auth-btn secondary">
              Already have an account? Sign in
            </a>
          </div>
        </div>
      </main>
    </PageShell>
  )
}