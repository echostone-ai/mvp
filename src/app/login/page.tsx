'use client'

import { useState } from 'react'
import { supabase } from '@/components/supabaseClient'
import AccountMenu from '@/components/AccountMenu'
import Footer from '@/components/Footer'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setError('')
    
    // Get current origin for redirect URL
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.echostone.ai'
    
    const { error } = await supabase.auth.signInWithOtp({ 
      email,
      options: {
        emailRedirectTo: origin
      }
    })
    
    if (error) {
      setError(error.message)
    } else {
      setMessage('Check your email for the magic link!')
    }
  }

  return (
    <div className="min-h-screen w-screen relative">
      <div className="fixed top-9 right-9 z-50">
        <AccountMenu />
      </div>
      
      <main className="min-h-screen flex flex-col items-center justify-center text-white p-4 text-center">
        <a href="/" className="inline-block">
          <img
            src="/echostone_logo.png"
            alt="EchoStone Logo"
            className="logo-pulse w-36 mb-8 select-none cursor-pointer hover:scale-110 transition-transform duration-300"
          />
        </a>
        
        <div className="auth-required-card">
          <h1 className="auth-required-title">
            Welcome to EchoStone
          </h1>
          <p className="auth-required-subtitle">
            Sign in to access your digital voice and personality profile.
          </p>
          
          <form onSubmit={handleLogin} className="w-full mb-6">
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
                className="w-full px-5 py-4 rounded-2xl border-2 border-purple-500/30 bg-purple-950/60 text-white text-lg shadow-lg outline-none focus:border-purple-400 focus:shadow-purple-400/20 focus:shadow-xl transition-all font-sans"
                placeholder="Enter your email address"
              />
            </div>
            
            <button
              type="submit"
              disabled={!email.trim()}
              className="auth-submit-btn w-full py-4 rounded-2xl font-bold text-lg cursor-pointer shadow-lg transition-all"
            >
              Send Magic Link
            </button>
          </form>
          
          {message && (
            <div className="mb-6 p-4 bg-green-500/20 border border-green-500/30 rounded-xl text-green-400 font-medium">
              {message}
            </div>
          )}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 font-medium">
              {error}
            </div>
          )}
          
          <div className="auth-required-actions">
            <a href="/signup" className="auth-btn secondary">
              Create Account
            </a>
          </div>
          
          <div className="auth-required-features">
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