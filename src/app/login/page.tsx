'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
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
      
      <main className="auth-container">
        <a href="/" className="inline-block">
          <img
            src="/echostone_logo.png"
            alt="EchoStone Logo"
            className="auth-logo"
          />
        </a>
        
        <div className="auth-required-card">
          <h1 className="auth-required-title">
            Welcome to EchoStone
          </h1>
          <p className="auth-required-subtitle">
            Sign in to access your digital voice and personality profile.
          </p>
          
          <form onSubmit={handleLogin} className="auth-form">
            <div className="auth-form-group">
              <label 
                htmlFor="email" 
                className="auth-form-label"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="auth-form-input"
                placeholder="Enter your email address"
              />
            </div>
            
            <button
              type="submit"
              disabled={!email.trim()}
              className="auth-submit-btn"
            >
              Send Magic Link
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