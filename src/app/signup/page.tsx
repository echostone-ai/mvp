'use client'

import { useState } from 'react'
import { supabase } from '@/components/supabaseClient'
import AccountMenu from '@/components/AccountMenu'
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
      // Sign up the user with magic link
      const { data, error: signupError } = await supabase.auth.signInWithOtp({
        email,
        options: {
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
    <div className="min-h-screen w-screen relative">
      <div className="fixed top-9 right-9 z-50">
        <AccountMenu />
      </div>
      
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
              className="auth-submit-btn w-full py-4 bg-gradient-to-r from-purple-600 to-purple-500 text-white border-none rounded-2xl font-bold text-lg cursor-pointer shadow-lg hover:from-purple-500 hover:to-purple-600 hover:transform hover:-translate-y-1 hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
          
          {message && (
            <div className="mt-6 p-4 bg-green-500/20 border border-green-500/30 rounded-xl text-green-400 font-medium">
              {message}
            </div>
          )}
          {error && (
            <div className="mt-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 font-medium">
              {error}
            </div>
          )}
          
          <div className="mt-6 text-center">
            <p className="text-gray-300">
              Already have an account?{' '}
              <a href="/login" className="text-purple-400 hover:text-purple-300 font-semibold">
                Sign in here
              </a>
            </p>
          </div>
          
          <div className="auth-required-features mt-8">
            <h3>What you'll get access to:</h3>
            <ul>
              <li>🎤 Train your personal AI voice</li>
              <li>📝 Build your personality profile</li>
              <li>💬 Chat with your digital twin</li>
              <li>🔒 Secure, private data storage</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}