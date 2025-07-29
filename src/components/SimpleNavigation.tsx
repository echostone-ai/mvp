'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function SimpleNavigation() {
  const [user, setUser] = useState<any>(null)
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    async function getUser() {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <nav className="simple-nav">
      <div className="nav-content">
        <Link href="/" className="nav-logo">
          <Image
            src="/echostone_logo.png"
            alt="EchoStone"
            width={40}
            height={40}
            className="nav-logo-img"
          />
          <span className="nav-brand">EchoStone</span>
        </Link>

        <div className="nav-links">
          <Link href="/about" className="nav-link">
            About
          </Link>
        </div>

        <div className="nav-actions">
          {user ? (
            <div className="nav-user-menu">
              <button 
                className="nav-user-button"
                onClick={() => setShowMenu(!showMenu)}
              >
                <span className="nav-user-avatar">
                  {user.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </button>
              
              {showMenu && (
                <div className="nav-dropdown">
                  <Link href="/profile" className="nav-dropdown-item">
                    👤 Profile
                  </Link>
                  <Link href="/get-started" className="nav-dropdown-item">
                    🚀 Get Started
                  </Link>
                  <button 
                    onClick={() => supabase.auth.signOut()}
                    className="nav-dropdown-item nav-dropdown-button"
                  >
                    🚪 Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="nav-auth-buttons">
              <Link href="/login" className="nav-button secondary">
                Sign In
              </Link>
              <Link href="/signup" className="nav-button primary">
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}