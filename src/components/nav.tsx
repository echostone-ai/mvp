// src/components/Nav.tsx
'use client'

import Link from 'next/link'
import AccountMenu from './AccountMenu'

export default function Nav() {
  return (
    <nav className="navbar">
      <div className="nav-links">
        <Link href="/" aria-label="Home" className="nav-link">Home</Link>
        <Link href="/about" aria-label="About" className="nav-link">About</Link>
        <Link href="/profile" aria-label="Profile" className="nav-link">Profile</Link>
        {/* Add more links here with the same className */}
      </div>
      <AccountMenu />
    </nav>
  )
}