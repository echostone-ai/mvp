'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isFeatureEnabled } from '@/lib/featureFlags'
import styles from './AccountMenu.module.css'
import Toast from './Toast'

export default function AccountMenu() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [activeAvatar, setActiveAvatar] = useState<{ id: string; name?: string; display_name?: string; photo_url?: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const voiceExpressionsEnabled = isFeatureEnabled('VOICE_OVERLAYS')

  useEffect(() => {
    let mounted = true
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      setIsLoggedIn(!!session)
      setUser(session?.user ?? null)
      if (session?.user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('user_id, primary_avatar_id, full_name')
          .eq('user_id', session.user.id)
          .maybeSingle()
        if (!mounted) return
        setProfile(prof || null)

        let recentAvatarId: string | null = null
        try {
          const { data: conv } = await supabase
            .from('conversations')
            .select('avatar_id')
            .eq('user_id', session.user.id)
            .not('avatar_id', 'is', null)
            .order('last_active', { ascending: false })
            .limit(1)
            .maybeSingle()
          recentAvatarId = (conv?.avatar_id as string) || null
        } catch {}

        const candidateId = recentAvatarId || prof?.primary_avatar_id || null
        if (candidateId) {
          const { data: avatar } = await supabase
            .from('avatar_profiles')
            .select('id, name, display_name, photo_url')
            .eq('id', candidateId)
            .maybeSingle()
          if (!mounted) return
          if (avatar) setActiveAvatar(avatar)
        } else {
          const { data: avatars } = await supabase
            .from('avatar_profiles')
            .select('id, name, display_name, photo_url')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })
            .limit(1)
          if (!mounted) return
          if (avatars && avatars.length > 0) setActiveAvatar(avatars[0])
        }
      } else {
        setProfile(null)
        setActiveAvatar(null)
      }
      setLoading(false)
    }
    init()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, session) => {
      setIsLoggedIn(!!session)
      setUser(session?.user ?? null)
      if (!session) {
        setProfile(null)
        setActiveAvatar(null)
      } else {
        init()
      }
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setMobileOpen(false)
    setMenuOpen(false)
    router.push('/')
    setToast('Signed out successfully')
    setTimeout(() => setToast(null), 2000)
  }

  const NavLink = ({ href, label }: { href: string, label: string }) => {
    const active = pathname === href || (href !== '/' && pathname?.startsWith(href))
    return (
      <Link
        href={href}
        onClick={() => setMobileOpen(false)}
        className={`${styles.navLink} ${active ? styles.navLinkActive : ''}`}
      >{label}</Link>
    )
  }

  const initials = useMemo(() => {
    const name = profile?.full_name || user?.email || ''
    const parts = String(name).trim().split(/[\s@._-]+/).filter(Boolean)
    const chars = (parts[0]?.[0] || '') + (parts[1]?.[0] || '')
    return chars.toUpperCase() || 'U'
  }, [profile, user])

  const chatHref = activeAvatar?.id ? `/profile/chat?avatarId=${activeAvatar.id}` : '/profile/chat'
  const chatLabel = activeAvatar?.display_name || activeAvatar?.name ? `Chat with ${activeAvatar.display_name || activeAvatar.name}` : 'Chat'
  const onboardingHref = activeAvatar?.name
    ? `/avatars/${encodeURIComponent(activeAvatar.name)}/onboarding`
    : '/onboarding/wizard'

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  return (
    <nav aria-label="Main navigation" style={{ position: 'relative' }}>
      {/* Desktop */}
      <div className="nav-desktop" style={{ display: 'none' }} />
      <div className={`nav-desktop ${styles.navDesktop}`}>
        {!loading && !isLoggedIn && (
          <NavLink href="/login" label="Login" />
        )}
        {!loading && isLoggedIn && (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(v => !v)}
              className={styles.avatarButton}
            >
              {activeAvatar?.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeAvatar.photo_url} alt="Avatar" className={styles.avatarThumb} />
              ) : (
                <div className={styles.avatarFallback}>{initials}</div>
              )}
              {(activeAvatar?.display_name || activeAvatar?.name) && (
                <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{activeAvatar.display_name || activeAvatar.name}</span>
              )}
              <span aria-hidden>▾</span>
            </button>
            {menuOpen && (
              <div role="menu" className={styles.menu}>
                <div className={styles.menuList}>
                  <NavLink href="/about" label="About" />
                  <NavLink href="/profile" label="Profile" />
                  <NavLink href={onboardingHref} label="Onboarding" />
                  <NavLink href={chatHref} label={chatLabel} />
                  <NavLink href="/memories" label="Memories" />
                  {voiceExpressionsEnabled && (
                    <NavLink href="/voice-expressions" label="Voice & Expressions" />
                  )}
                  <div className={styles.divider} />
                  <button onClick={handleLogout} className={styles.buttonGhost}>Logout</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile */}
      <div className="nav-mobile" style={{ display: 'none' }} />
      <div className={`nav-mobile ${styles.navMobile}`}>
        {!loading && !isLoggedIn && (
          <button
            aria-label="Menu"
            onClick={() => setMobileOpen(v => !v)}
            className={styles.avatarButton}
          >☰</button>
        )}
        {!loading && isLoggedIn && (
          <button
            aria-label="Account menu"
            onClick={() => setMobileOpen(v => !v)}
            className={styles.avatarButton}
          >
            {activeAvatar?.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activeAvatar.photo_url} alt="Avatar" className={styles.avatarThumbMd} />
            ) : (
              <div className={styles.avatarFallbackMd}>{initials}</div>
            )}
            <span aria-hidden>▾</span>
          </button>
        )}
      </div>
      {mobileOpen && (
        <div style={{ position: 'absolute', right: 16, top: 76, background: 'rgba(15, 15, 35, 0.98)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 240 }}>
          {!loading && !isLoggedIn && (
            <NavLink href="/login" label="Login" />
          )}
          {!loading && isLoggedIn && (
            <>
              <NavLink href="/about" label="About" />
              <NavLink href="/profile" label="Profile" />
              <NavLink href={onboardingHref} label="Onboarding" />
              <NavLink href={chatHref} label={chatLabel} />
              <NavLink href="/memories" label="Memories" />
              {voiceExpressionsEnabled && (
                <NavLink href="/voice-expressions" label="Voice & Expressions" />
              )}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
              <button onClick={handleLogout} style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: 'transparent',
                color: '#cbd5e1',
                border: '1px solid rgba(255,255,255,0.2)',
                cursor: 'pointer',
                textAlign: 'left'
              }}>Logout</button>
            </>
          )}
        </div>
      )}

      {toast && (
        <Toast message={toast} onClose={() => setToast(null)} />
      )}
    </nav>
  )
}